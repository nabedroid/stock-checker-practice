import type { AnalyzedItem, ExtractionSettings } from '@common/types';
import { IconExtractService } from '@common/services/iconExtractService';
import { crop, MatManager, toDataUrl, invert, fromBase64, fromFile } from '@common/utils/mat';
import { IconFeatureService } from '@common/services/iconFeatureService';
import { ItemMasterService } from '@common/services/itemMasterService';
import { TesseractOcrService } from '@common/services/tesseractOcrService';
import { compare } from '@common/utils/feature';

declare const cv: any;

export class InventoryExtractionService {

  private readonly iconFeatureService: IconFeatureService;
  private readonly tesseractOcrService: TesseractOcrService;
  private readonly itemMasterService: ItemMasterService;

  private constructor(iconFeatureService: IconFeatureService, tesseractOcrService: TesseractOcrService, itemMasterService: ItemMasterService) {
    this.iconFeatureService = iconFeatureService;
    this.tesseractOcrService = tesseractOcrService;
    this.itemMasterService = itemMasterService;
  }

  public static async getInstanceAsync(): Promise<InventoryExtractionService> {
    const iconFeatureService = IconFeatureService.getInstance();
    const tesseractOcrService = await TesseractOcrService.getInstanceAsync({ lang: 'eng', whitelist: '0123456789x' });
    const itemMasterService = await ItemMasterService.getInstanceAsync();
    const instance = new InventoryExtractionService(iconFeatureService, tesseractOcrService, itemMasterService);
    return instance;
  }

  public dispose(): void {
    this.tesseractOcrService?.dispose();
  }

  public [Symbol.dispose](): void {
    this.dispose();
  }

  /**
   * 画像ファイル配列を読み込み、解析から重複排除、ソートまですべて行う
   */
  public async extractAllAsync(
    images: File[],
    settings: ExtractionSettings,
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

      const src = await fromFile(file);

      const items = await this.analyzeAsync(src, i, settings, (percent, message) => {
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
   * 画像からアイコンを検出し、OCRおよび特徴量からアイテム情報を抽出する
   * @param src 解析対象の cv.Mat
   * @param sourceImageIndex 画像のインデックス番号
   * @param onProgress プログレス通知コールバック
   * @returns 解析抽出されたアイテム結果のリスト
   */
  public async analyzeAsync(
    src: any,
    sourceImageIndex: number,
    settings: ExtractionSettings,
    onProgress?: (percent: number, message: string) => void
  ): Promise<AnalyzedItem[]> {
    using matManager = new MatManager();
    // アイコン領域を検出
    const iconRegions = await IconExtractService.extractAsync(
      src,
      { minIconWidth: 50, maxIconWidth: 150 }
    );
    const results: AnalyzedItem[] = [];

    for (let j = 0; j < iconRegions.length; j++) {
      const region = iconRegions[j];
      // console.log('icon: ', region.x, region.y, region.width, region.height);

      if (onProgress) {
        onProgress((j / iconRegions.length) * 100, `アイテム ${j + 1}/${iconRegions.length}`);
      }

      // アイコン領域を切り出し
      const iconMat = matManager.add(crop(src, region.x, region.y, region.width, region.height));
      // DataUrlに変換
      const iconDataUrl = toDataUrl(iconMat);
      // OCR して所持数を抽出
      const quantity = await this.ocrNumberAsync(iconMat);
      if (quantity === null) {
        // 所持数が読み取れない場合はスキップ
        // console.log('skip: cannot read quantity');
        continue;
      }

      // アイコンの特徴量を計算
      const features = this.iconFeatureService.computeFeatures(iconMat);
      if (!features) {
        // 特徴量が計算できない場合はスキップ
        // console.log('skip: cannot compute features');
        continue;
      }

      // アイコンの色情報を計算
      const colorHash = this.iconFeatureService.computeColorHash(iconMat);
      // 特徴量をもとにアイテム名を検索
      const itemData = this.itemMasterService.findItem(
        features,
        colorHash,
        settings.minGoodMatches,
        settings.earlyReturnThreshold,
        settings.colorThreshold
      );

      results.push({
        id: itemData?.id,
        iconDataUrl,
        features,
        colorHash,
        name: itemData?.name || '',
        quantity: quantity,
        sourceImageIndex,
        // index: j,
      });
    }

    return results;
  }

  /**
   * アイコン画像から所持数を抽出する
   * @param iconMat アイコン画像
   * @returns 所持数
   */
  private async ocrNumberAsync(iconMat: any): Promise<number | null> {
    using matManager = new MatManager();
    // アイコン下部（数字が描かれている領域）を切り出す
    const iconLowerMat = matManager.add(crop(iconMat, 0, iconMat.rows * 0.8, iconMat.cols, iconMat.rows * 0.2));
    // 数字の領域を二値化
    const grayMat = matManager.add(new cv.Mat());
    cv.cvtColor(iconLowerMat, grayMat, cv.COLOR_RGBA2GRAY);
    const binaryMat = matManager.add(new cv.Mat());
    cv.threshold(grayMat, binaryMat, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);
    // 輪郭検出
    const contoursMat = matManager.add(new cv.MatVector());
    const hierarchyMat = matManager.add(new cv.Mat());
    cv.findContours(binaryMat, contoursMat, hierarchyMat, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    // 検出された輪郭からノイズを除去する
    const rects: any[] = [];
    for (let i = 0; i < contoursMat.size(); i++) {
      const cnt = matManager.add(contoursMat.get(i));
      const rect = cv.boundingRect(cnt);
      // 明らかに小さい、細い輪郭を除去
      if (rect.width > 2 && iconLowerMat.rows * 0.3 <= rect.height && rect.height <= iconLowerMat.rows * 0.8) {
        rects.push(rect);
      }
    }
    // 1桁目、2桁目の数字の底辺のy座標を算出
    const rightLimit = iconLowerMat.cols * 0.8;
    const numberBottomY = rects
      .filter(r => r.x > rightLimit)
      .reduce((max, r) => Math.max(max, r.y + r.height), 0);
    // 共通の底辺を持つ輪郭（＝数字の輪郭の可能性が高い）を抽出
    const yThreshold = iconLowerMat.rows * 0.1;
    const targetRects = rects
      .filter(r => Math.abs(r.y + r.height - numberBottomY) <= yThreshold);
    // 数字らしき輪郭がなければ null を返す
    if (targetRects.length === 0) {
      return null;
    }
    // 全ての数字を内包する矩形を算出
    const minX = Math.min(...targetRects.map(r => r.x));
    const minY = Math.min(...targetRects.map(r => r.y));
    const maxX = Math.max(...targetRects.map(r => r.x + r.width));
    const maxY = Math.max(...targetRects.map(r => r.y + r.height));
    // 少し余裕をもって切り出す
    const padding = 2;
    const x = minX - padding < 0 ? 0 : minX - padding;
    const y = minY - padding < 0 ? 0 : minY - padding;
    const width = x + maxX - minX + padding * 2 > binaryMat.cols ? binaryMat.cols - minX : maxX - minX + padding * 2;
    const height = y + maxY - minY + padding * 2 > binaryMat.rows ? binaryMat.rows - minY : maxY - minY + padding * 2;
    const numberMat = matManager.add(crop(binaryMat, x, y, width, height));
    // 反転
    const invertedMat = matManager.add(invert(numberMat));
    const recognizedText = await this.tesseractOcrService.recognizeAsync(invertedMat);
    // 数字のみを抽出
    const digits = recognizedText.replace(/\D/g, '');
    if (digits === null || digits === '') {
      return null;
    }

    return parseInt(digits);
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

        const m1 = fromBase64(item.features);
        if (m1.empty()) {
          m1.delete();
          uniqueItems.push(item);
          continue;
        }

        let isDuplicate = false;
        for (const m2 of uniqueMats) {
          const score = compare(m1, m2);
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

