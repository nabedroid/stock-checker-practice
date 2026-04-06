import React, { useState, useCallback, useEffect, ChangeEvent } from 'react'
import { ImageUploader } from './components/ImageUploader'
import { AnalysisProgress } from './components/AnalysisProgress'
import { GridDetector } from './services/gridDetector'
import { DictionaryService } from './services/dictionaryService'
import { Deduplicator } from './services/deduplicator'
import { TesseractOcrEngine } from './services/ocr/tesseractEngine'
import { PHash } from './utils/phash'
import { ImageUtils } from './services/imageUtils'
import type { AnalyzedItem, AnalysisProgress as ProgressType } from './types'

declare const cv: any;

type Page = 'user' | 'builder'

function App() {
  const [page, setPage] = useState<Page>('user')
  const [images, setImages] = useState<File[]>([])
  const [results, setResults] = useState<AnalyzedItem[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState<ProgressType | null>(null)
  const [ocrEngine] = useState(() => new TesseractOcrEngine())

  // URL ハッシュによるページ切り替え (#builder でビルダー表示)
  useEffect(() => {
    const handleHashChange = () => {
      setPage(window.location.hash === '#builder' ? 'builder' : 'user')
    }
    window.addEventListener('hashchange', handleHashChange)
    handleHashChange()
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  useEffect(() => {
    DictionaryService.initialize()
  }, [])

  const handleImagesSelected = useCallback((files: File[]) => {
    setImages(prev => [...prev, ...files])
  }, [])

  const handleRemoveImage = useCallback((index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (images.length === 0) return
    setIsAnalyzing(true)
    setResults([])

    try {
      await ocrEngine.initialize()
      const allExtractedItems: AnalyzedItem[] = []

      for (let i = 0; i < images.length; i++) {
        const file = images[i]
        const imgIndex = i + 1
        setProgress({
          step: 'loading',
          percent: (i / images.length) * 100,
          message: `画像読み込み中 (${imgIndex}/${images.length}): ${file.name}`
        })

        // 1. 画像読み込み
        const img = await loadImage(file)
        const src = cv.imread(img)

        // 2. グリッド検出
        setProgress({
          step: 'grid-detection',
          percent: (i / images.length) * 100 + 5,
          message: `グリッド検出中 (${imgIndex}/${images.length})`
        })
        const iconRegions = await GridDetector.detectIcons(img)

        // 3. アイコン切り出し & OCR & pHash
        for (let j = 0; j < iconRegions.length; j++) {
          const region = iconRegions[j]

          setProgress({
            step: 'ocr',
            percent: (i / images.length) * 100 + 10 + (j / iconRegions.length) * 30 / images.length,
            message: `解析中 (${imgIndex}/${images.length}) - アイテム ${j + 1}/${iconRegions.length}`
          })

          // OpenCV Mat で ROI 切り出し
          const iconMat = ImageUtils.crop(src, region.x, region.y, region.width, region.height)
          const iconDataUrl = ImageUtils.matToDataUrl(iconMat)

          const phash = await PHash.compute(iconMat)

          // 4. 所持数クロップ & 前処理 & OCR
          // アイコン下部 20% の所持数部分のみ OCR 対象とする
          const cropH = Math.round(iconMat.rows * 0.20)
          const ocrRoi = ImageUtils.crop(iconMat, 0, iconMat.rows - cropH, iconMat.cols, cropH)
          const ocrImageData = ImageUtils.preprocessForOcr(ocrRoi)
          const ocrResult = await ocrEngine.recognize(ocrImageData)

          // OCR 結果に "x" 的な記号が含まれているか確認
          const hasIndicator = /x*.*\d+/.test(ocrResult.text)
          if (!hasIndicator || ocrResult.quantity <= 0) {
            iconMat.delete()
            ocrRoi.delete()
            continue
          }

          const dictionaryEntry = DictionaryService.findItem(phash)

          allExtractedItems.push({
            iconDataUrl,
            phash,
            name: dictionaryEntry?.name || '',
            quantity: ocrResult.quantity,
            confidence: ocrResult.confidence,
            sourceImageIndex: i
          })

          // Memory Cleanup
          iconMat.delete()
          ocrRoi.delete()
        }

        src.delete()
      }

      // 4. 重複排除
      setProgress({ step: 'dedup', percent: 95, message: '重複アイテムを統合中...' })
      const uniqueItems = await Deduplicator.deduplicate(allExtractedItems)
      setResults(uniqueItems)

      setProgress({ step: 'done', percent: 100, message: '解析完了！' })
    } catch (e: any) {
      console.error(e)
      setProgress({ step: 'done', percent: 0, message: `エラーが発生しました: ${e.message}` })
    } finally {
      setIsAnalyzing(false)
    }
  }, [images, ocrEngine])

  return (
    <div className="app">
      <nav style={{
        backgroundColor: '#264278',
        padding: '10px 20px',
        display: 'flex',
        gap: '20px',
        color: 'white',
        fontSize: '14px'
      }}>
        <a href="#/" style={{ color: page === 'user' ? '#fff' : '#ccc', fontWeight: page === 'user' ? 'bold' : 'normal', textDecoration: 'none' }}>ユーザー表示</a>
        <a href="#builder" style={{ color: page === 'builder' ? '#fff' : '#ccc', fontWeight: page === 'builder' ? 'bold' : 'normal', textDecoration: 'none' }}>辞書構築ツール</a>
      </nav>

      <header className="app-header" style={{ padding: '20px' }}>
        <h1>StellaSora Stock Checker {page === 'builder' && <span style={{ color: '#ff6b6b' }}>(Builder Mode)</span>}</h1>
        <p className="app-subtitle">
          {page === 'user' ? 'アイテム一覧のスクリーンショットから在庫データを自動抽出' : '解析結果にアイテム名を付けて辞書データを作成します'}
        </p>
      </header>

      <main className="app-main" style={{ padding: '0 20px 40px' }}>
        <section className="upload-section">
          <ImageUploader
            images={images}
            onImagesSelected={handleImagesSelected}
            onRemoveImage={handleRemoveImage}
          />
          <div className="actions" style={{ marginTop: '15px' }}>
            <button
              className="analyze-button"
              onClick={handleAnalyze}
              disabled={images.length === 0 || isAnalyzing}
              style={{
                padding: '10px 24px',
                backgroundColor: '#264278',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold'
              }}
            >
              {isAnalyzing ? '解析中...' : `解析開始（${images.length}枚）`}
            </button>
          </div>
        </section>

        {/* 解析プログレス */}
        {progress && <AnalysisProgress progress={progress} />}

        {/* 解析結果（ユーザー表示） */}
        {results.length > 0 && page === 'user' && (
          <section className="results-user" style={{ marginTop: '30px' }}>
            <h2>在庫抽出結果 ({results.length} 件)</h2>
            <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #264278', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>アイコン</th>
                  <th style={{ padding: '10px' }}>アイテム名</th>
                  <th style={{ padding: '10px' }}>所持数</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item: AnalyzedItem, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      <img src={item.iconDataUrl} alt="icon" style={{ width: '40px', height: '40px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: '10px' }}>{item.name || '未登録'}</td>
                    <td style={{ padding: '10px', fontSize: '18px', fontWeight: 'bold', color: '#264278' }}>
                      {item.quantity}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {results.length > 0 && page === 'builder' && (
          <section className="results-builder" style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2>辞書構築モード</h2>
              <button
                onClick={() => {
                  const json = DictionaryService.exportDictionary()
                  const blob = new Blob([json], { type: 'application/json' })
                  const url = URL.createObjectURL(blob)
                  const a = document.createElement('a')
                  a.href = url
                  a.download = 'master-dictionary.json'
                  a.click()
                }}
                style={{ padding: '10px 20px', backgroundColor: '#264278', color: 'white', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}
              >
                辞書 JSON をエクスポート
              </button>
            </div>
            <p style={{ color: '#666', marginBottom: '20px' }}>名前を入力して辞書を完成させてください。入力内容は自動保存されます。</p>

            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid #264278', textAlign: 'left' }}>
                  <th style={{ padding: '10px' }}>アイコン</th>
                  <th style={{ padding: '10px' }}>アイテム名入力</th>
                  <th style={{ padding: '10px' }}>所持数</th>
                </tr>
              </thead>
              <tbody>
                {results.map((item: AnalyzedItem, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                    <td style={{ padding: '10px' }}>
                      <img src={item.iconDataUrl} alt="icon" style={{ width: '40px', height: '40px', borderRadius: '4px' }} />
                    </td>
                    <td style={{ padding: '10px' }}>
                      <input
                        type="text"
                        placeholder="アイテム名を入力..."
                        value={item.name}
                        onChange={(e: ChangeEvent<HTMLInputElement>) => {
                          const newName = e.target.value
                          const newResults = [...results]
                          newResults[idx].name = newName
                          setResults(newResults)
                          DictionaryService.updateItem({ phash: item.phash, name: newName, iconDataUrl: item.iconDataUrl })
                        }}
                        style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', boxSizing: 'border-box' }}
                      />
                    </td>
                    <td style={{ padding: '10px', color: '#666' }}>{item.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}
      </main>
    </div>
  )
}

// Utils
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = e.target?.result as string
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default App
