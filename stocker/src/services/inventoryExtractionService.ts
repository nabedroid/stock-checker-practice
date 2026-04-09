import type { AnalyzedItem } from '../types';
import { GridDetector } from './gridDetector';
import { ImageUtils } from './imageUtils';
import { IconFeatureService } from './iconFeatureService';
import { ItemDataService } from './itemDataService';
import { TesseractOcrEngine } from './ocr/tesseractEngine';
import { FeatureMatcher } from '../utils/featureMatcher';

declare const cv: any;

export class InventoryExtractionService {

  private readonly tesseractEngine: TesseractOcrEngine;
  private readonly itemDataService: ItemDataService;

  private constructor(engine: TesseractOcrEngine, itemDataService: ItemDataService) {
    this.tesseractEngine = engine;
    this.itemDataService = itemDataService;
  }

  public static async getInstanceAsync(): Promise<InventoryExtractionService> {
    const engine = await TesseractOcrEngine.getInstanceAsync('eng', 'x0123456789');
    const itemDataService = await ItemDataService.getInstanceAsync();
    const instance = new InventoryExtractionService(engine, itemDataService);
    return instance;
  }

  public dispose(): void {
    this.tesseractEngine?.dispose();
  }

  private readImage(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = e.target?.result as string;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * 画像ファイル配列を読み込み、解析から重複排除、ソートまですべて行う
   */
  public async extractAllAsync(
    images: File[],
    onProgress: (percent: number, message: string) => void
  ): Promise<AnalyzedItem[]> {
    const allExtractedItems: AnalyzedItem[] = [];

    for (let i = 0; i < images.length; i++) {
      const file = images[i];
      const imgIndex = i + 1;

      onProgress(
        (i / images.length) * 100,
        `画像読み込み中 (${imgIndex}/${images.length}): ${file.name}`
      );

      const img = await this.readImage(file);
      const src = cv.imread(img);

      const items = await this.analyzeAsync(src, i, (percent, message) => {
        onProgress(
          (i / images.length) * 100 + (percent * (1 / images.length)),
          `画面 ${imgIndex}/${images.length}: ${message}`
        );
      });

      allExtractedItems.push(...items);
      src.delete();
    }

    onProgress(95, '重複アイテムを統合中...');
    const uniqueItems = this.deduplicate(allExtractedItems);

    // マスターデータのID順にソート (IDが不明なものは末尾)
    uniqueItems.sort((a, b) => {
      const idA = a.id ?? Number.MAX_SAFE_INTEGER;
      const idB = b.id ?? Number.MAX_SAFE_INTEGER;
      return idA - idB;
    });

    onProgress(100, '解析完了！');
    return uniqueItems;
  }

  /**
   * cv.Mat 画像からアイコンを特化して検出し、OCRおよび特徴量からアイテム情報を抽出する
   * @param src 解析対象の cv.Mat
   * @param sourceImageIndex 画像のインデックス番号
   * @param onProgress プログレス通知コールバック
   * @returns 解析抽出されたアイテム結果のリスト
   */
  public async analyzeAsync(
    src: any,
    sourceImageIndex: number,
    onProgress?: (percent: number, message: string) => void
  ): Promise<AnalyzedItem[]> {
    const iconRegions = await GridDetector.detectIcons(src, { minIconWidth: 50, maxIconWidth: 150 });
    const results: AnalyzedItem[] = [];

    for (let j = 0; j < iconRegions.length; j++) {
      const region = iconRegions[j];

      if (onProgress) {
        onProgress((j / iconRegions.length) * 100, `アイテム ${j + 1}/${iconRegions.length}`);
      }

      // アイコン領域を切り出し
      const iconMat = ImageUtils.crop(src, region.x, region.y, region.width, region.height);
      const iconDataUrl = ImageUtils.matToDataUrl(iconMat);

      // 個数部分を切り出し（下部20%）
      const iconNumberMat = ImageUtils.crop(iconMat, 0, iconMat.rows * 0.8, iconMat.cols, iconMat.rows * 0.2);
      // OCR の前処理
      // 数字の色 (#264278) を抽出
      const maskMat = ImageUtils.extractColor(iconNumberMat, [0, 20, 80, 0], [80, 110, 170, 255]);
      // 反転 (白背景に黒文字)
      const invertedMat = ImageUtils.invert(maskMat);
      // OCR 実行
      const ocrResult = await this.tesseractEngine.recognizeAsync(invertedMat);
      // 数字のみを抽出
      const digits = ocrResult.text?.replace(/\D/g, '');
      // 数字が読み取れない場合はスキップ
      const quantity = digits ? parseInt(digits) : null;
      if (quantity === null) {
        iconMat.delete();
        iconNumberMat.delete();
        maskMat.delete();
        invertedMat.delete();
        continue;
      }

      const features = IconFeatureService.computeFeatures(iconMat);
      const itemData = this.itemDataService.findItem(features, 5, 15);

      results.push({
        id: itemData?.id,
        iconDataUrl,
        features,
        name: itemData?.name || '',
        quantity: quantity,
        confidence: ocrResult.confidence,
        sourceImageIndex,
        index: j,
      });

      iconMat.delete();
      iconNumberMat.delete();
      maskMat.delete();
      invertedMat.delete();
    }

    return results;
  }

  /**
   * 複数枚の解析結果を結合し、重複を排除する
   * - 名前のわかるアイテム: 名前で重複判定
   * - 不明なアイテム: ORB特徴量(orbThreshold)で判定
   */
  private deduplicate(items: AnalyzedItem[], orbThreshold: number = 30): AnalyzedItem[] {
    const uniqueItems: AnalyzedItem[] = [];
    const uniqueMats: any[] = [];
    const seenNames = new Set<string>();

    if (typeof cv === 'undefined') return items;

    for (const item of items) {
      if (item.name) {
        // アイテム名が取得できている場合は名前で比較する
        if (seenNames.has(item.name)) {
          continue; // 既に存在する場合は重複として無視
        }
        seenNames.add(item.name);
        uniqueItems.push(item);
      } else {
        // 不明なアイテムの場合のみ、特徴量の厳格なチェックを行う
        if (!item.features) {
          uniqueItems.push(item);
          continue;
        }

        const m1 = FeatureMatcher.base64ToMat(item.features);
        if (m1.empty()) {
          m1.delete();
          uniqueItems.push(item);
          continue;
        }

        let isDuplicate = false;
        for (const m2 of uniqueMats) {
          const score = FeatureMatcher.compare(m1, m2);
          if (score >= orbThreshold) {
            isDuplicate = true;
            break;
          }
        }

        if (!isDuplicate) {
          uniqueItems.push(item);
          uniqueMats.push(m1); // 重複チェック用に保持
        } else {
          m1.delete(); // 重複なら破棄
        }
      }
    }

    // 使い回したキャッシュをメモリ解放
    for (const m of uniqueMats) {
      m.delete();
    }

    return uniqueItems;
  }
}

