import { useState, useCallback, useEffect } from 'react'
import { ImageUploader } from '@common/components/ImageUploader'
import { AnalysisProgress } from '@common/components/AnalysisProgress'
import { InventoryExtractionService } from './services/inventoryExtractionService'
import { ItemMasterService } from '../../common/src/services/itemMasterService'
import { SummaryView } from './components/SummaryView'
import type { AnalyzedItem, AnalysisProgress as ProgressType, ExtractionSettings } from '@common/types'
const DEFAULT_SETTINGS: ExtractionSettings = {
  minGoodMatches: 5,
  earlyReturnThreshold: 50,
  colorThreshold: 30
};

declare const cv: any;

function App() {
  const [images, setImages] = useState<File[]>([])
  const [results, setResults] = useState<AnalyzedItem[]>([])
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [progress, setProgress] = useState<ProgressType | null>(null)
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settings, setSettings] = useState<ExtractionSettings>(DEFAULT_SETTINGS)
  const [viewMode, setViewMode] = useState<'list' | 'summary'>('list')
  const [masterData, setMasterData] = useState<any[]>([])

  useEffect(() => {
    ItemMasterService.getInstanceAsync().then(service => {
      setMasterData(service.masterData);
    });
  }, []);

  const handleImagesSelected = useCallback((files: File[]) => {
    setImages((prev: File[]) => [...prev, ...files])
  }, [])

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev: File[]) => prev.filter((_, i) => i !== index))
  }, [])

  const handleAnalyze = useCallback(async () => {
    if (images.length === 0) return
    setIsAnalyzing(true)
    setResults([])

    const inventoryExtractionService = await InventoryExtractionService.getInstanceAsync()

    try {

      const items = await inventoryExtractionService.extractAllAsync(images, settings, (percent, message) => {
        setProgress({ step: 'ocr', percent, message })
      })

      setResults(items)

      setProgress({ step: 'done', percent: 100, message: '解析完了！' })
    } catch (e: any) {
      console.error(e)
      setProgress({ step: 'done', percent: 0, message: `エラーが発生しました: ${e.message}` })
    } finally {
      setIsAnalyzing(false)
      inventoryExtractionService.dispose()
    }
  }, [images, settings])

  const handleExportCSV = useCallback(() => {
    const csvRows = ['アイテム名,所持数']
    results.forEach((item: AnalyzedItem) => {
      csvRows.push(`${item.name || '未登録'},${item.quantity}`)
    })
    const csvContent = '\uFEFF' + csvRows.join('\n') // BOM for Excel
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `inventory_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [results])

  const handleReset = useCallback(() => {
    setImages([])
    setResults([])
    setProgress(null)
  }, [])

  const handleUpdateResult = useCallback((index: number, field: keyof AnalyzedItem, value: any) => {
    setResults((prev) => {
      const updated = [...prev]
      updated[index] = { ...updated[index], [field]: value }
      return updated
    })
  }, [])

  const handleRemoveResult = useCallback((index: number) => {
    setResults((prev) => prev.filter((_, i) => i !== index))
  }, [])

  return (
    <div className="app">
      <header className="app-header" style={{ padding: '20px', backgroundColor: '#ffffff', color: '#000000', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ margin: 0 }}>ステラソラ アイテム所持数チェッカー</h1>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={() => setViewMode(prev => prev === 'list' ? 'summary' : 'list')}
            style={{
              padding: '8px 16px',
              backgroundColor: viewMode === 'list' ? '#f39c12' : '#4a69bd',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            {viewMode === 'list' ? 'サマリー表示に切替' : 'リスト表示に戻る'}
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            style={{
              padding: '8px 16px',
              backgroundColor: '#f1f2f6',
              color: '#2f3542',
              border: '1px solid #ced6e0',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            ⚙️ 設定
          </button>
        </div>
      </header>

      <main className="app-main" style={{ padding: '20px' }}>
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

        {progress && <AnalysisProgress progress={progress} />}

        {viewMode === 'summary' && (
          <section className="summary-section" style={{ marginTop: '30px' }}>
            {results.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginBottom: '15px' }}>
                <button
                  onClick={handleExportCSV}
                  style={{ padding: '8px 16px', backgroundColor: '#4a69bd', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  CSVエクスポート
                </button>
                <button
                  onClick={handleReset}
                  style={{ padding: '8px 16px', backgroundColor: '#e55039', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  リセット
                </button>
              </div>
            )}
            <SummaryView results={results} masterData={masterData} />
          </section>
        )}

        {viewMode === 'list' && results.length > 0 && (
          <section className="results-user" style={{ marginTop: '30px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h2 style={{ margin: 0 }}>在庫抽出結果 ({results.length} 件)</h2>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleExportCSV}
                  style={{ padding: '8px 16px', backgroundColor: '#4a69bd', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  CSVエクスポート
                </button>
                <button
                  onClick={handleReset}
                  style={{ padding: '8px 16px', backgroundColor: '#e55039', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                  リセット
                </button>
              </div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '20px' }}>
              {results.map((item: AnalyzedItem, idx: number) => (
                <div key={idx} style={{
                  border: '1px solid var(--border)',
                  padding: '8px',
                  borderRadius: '4px',
                  backgroundColor: 'var(--bg-panel)',
                  width: '120px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  position: 'relative'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '5px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-dim)', fontWeight: 'bold' }}>#{idx + 1}</span>
                    <button
                      onClick={() => handleRemoveResult(idx)}
                      style={{
                        color: 'var(--danger)',
                        border: 'none',
                        background: 'none',
                        cursor: 'pointer',
                        fontSize: '1rem',
                        lineHeight: 1,
                        padding: 0
                      }}
                      title="削除"
                    >
                      ×
                    </button>
                  </div>
                  <img src={item.iconDataUrl} alt="icon" style={{ width: '48px', height: '48px', borderRadius: '4px', marginBottom: '8px', border: '1px solid var(--border)' }} />
                  <input
                    type="text"
                    value={item.name}
                    onChange={(e) => handleUpdateResult(idx, 'name', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '2px 4px',
                      fontSize: '0.8rem',
                      textAlign: 'center',
                      boxSizing: 'border-box',
                      border: '1px solid var(--border)',
                      borderRadius: '3px',
                      color: 'var(--text-main)',
                      backgroundColor: 'transparent'
                    }}
                  />
                  <input
                    type="text"
                    value={item.quantity ?? ''}
                    onChange={(e: any) => handleUpdateResult(idx, 'quantity', e.target.value)}
                    style={{
                      width: '60%',
                      marginTop: '5px',
                      padding: '2px 4px',
                      fontSize: '1rem',
                      fontWeight: 'bold',
                      color: 'var(--primary)',
                      textAlign: 'center',
                      border: '1px solid var(--border)',
                      borderRadius: '3px',
                      backgroundColor: 'transparent'
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* 設定ダイアログ */}
      {isSettingsOpen && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', justifyContent: 'center', alignItems: 'center'
        }}>
          <div style={{
            backgroundColor: 'var(--bg-panel)',
            padding: '20px',
            borderRadius: '8px',
            width: '450px',
            maxWidth: '90%',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <h2 style={{ marginTop: 0, borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>解析設定</h2>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>ORB最小一致点数: {settings.minGoodMatches}</strong>
              </div>
              <input
                type="range" min="1" max="100"
                value={settings.minGoodMatches}
                onChange={(e) => setSettings(s => ({ ...s, minGoodMatches: Number(e.target.value) }))}
                style={{ width: '100%', margin: '10px 0' }}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0 }}>
                下げる: 認識漏れは減りますが、全く違うものを誤認識しやすくなります。<br />
                上げる: 認識漏れが増えますが、誤認識が減ります。
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>早期リターン閾値: {settings.earlyReturnThreshold}</strong>
              </div>
              <input
                type="range" min="1" max="100"
                value={settings.earlyReturnThreshold}
                onChange={(e) => setSettings(s => ({ ...s, earlyReturnThreshold: Number(e.target.value) }))}
                style={{ width: '100%', margin: '10px 0' }}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0 }}>
                下げる: 処理時間が短くなりますが、似ているアイテムを誤認識しやすくなります。<br />
                上げる: 似ているアイテムを判別しやすくなりますが、処理時間が長くなります。
              </p>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>色許容誤差: {settings.colorThreshold}</strong>
              </div>
              <input
                type="range" min="1" max="100"
                value={settings.colorThreshold}
                onChange={(e) => setSettings(s => ({ ...s, colorThreshold: Number(e.target.value) }))}
                style={{ width: '100%', margin: '10px 0' }}
              />
              <p style={{ fontSize: '0.8rem', color: 'var(--text-dim)', margin: 0 }}>
                下げる: 処理時間が短くなり、色違いの誤認識が減りますが、認識漏れが増えます。<br />
                上げる: 認識漏れは減りますが、処理時間が長くなり、色違いを誤認識しやすくなります。
              </p>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
              <button
                onClick={() => setSettings(DEFAULT_SETTINGS)}
                style={{ padding: '8px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: '4px', cursor: 'pointer', color: 'var(--text-main)' }}
              >
                デフォルトに戻す
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{ padding: '8px 16px', backgroundColor: '#4a69bd', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
