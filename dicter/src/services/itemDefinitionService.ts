import { ImageUtils } from './imageUtils';
import type { IconRegion, DictionaryEntry } from '../types';
import { TesseractOcrEngine } from './ocr/tesseractEngine';
import { IconFeatureService } from './iconFeatureService';
import { GridDetector } from './gridDetector';

declare const cv: any;

/**
 * 辞書構築用のアイテムアイコン抽出サービス
 * 物資画面のスクショからアイコンとアイテム名を抽出する
 */
export class ItemDefinitionService {

  private readonly engine: TesseractOcrEngine;

  private constructor(engine: TesseractOcrEngine) {
    this.engine = engine;
  }

  public static async getInstanceAsync(): Promise<ItemDefinitionService> {
    const engine = await TesseractOcrEngine.getInstanceAsync('jpn');
    return new ItemDefinitionService(engine);
  }

  public dispose(): void {
    this.engine.dispose();
  }

  /**
   * 画像からアイテム情報を抽出する
   * @param src OpenCV Mat
   */
  public async extractAsync(
    src: any,
  ): Promise<DictionaryEntry> {

    // アイコン領域を大まかに切り出す
    const iconAreaRect = { x: src.cols * 0.68, y: src.rows * 0.11, w: src.cols * 0.1, h: src.rows * 0.18 };
    const iconAreaMat = ImageUtils.crop(src, iconAreaRect.x, iconAreaRect.y, iconAreaRect.w, iconAreaRect.h);
    // アイコン領域からアイコンを検出する
    const iconRegions = await GridDetector.detectIcons(iconAreaMat, { threshold: 200 });
    if (iconRegions.length === 0) {
      throw new Error('アイコンが見つかりませんでした。');
    }
    // 複数見つかった場合は一番大きいアイコンを選択
    const iconRegion = iconRegions.sort((a: IconRegion, b: IconRegion) => b.width - a.width)[0];
    // アイコンを切り出す
    const iconMat = ImageUtils.crop(iconAreaMat, iconRegion.x, iconRegion.y, iconRegion.width, iconRegion.height);
    const iconDataUrl = ImageUtils.matToDataUrl(iconMat);

    // 特徴量計算
    const features = IconFeatureService.computeFeatures(iconMat);

    // 名前の OCR
    // アイテムの名前欄のみを切り出し、OCRを実行
    const nameAreaRect = { x: src.cols * 0.785, y: src.rows * 0.12, w: src.cols * 0.19, h: src.rows * 0.048 };
    const nameAreaMat = ImageUtils.crop(src, nameAreaRect.x, nameAreaRect.y, nameAreaRect.w, nameAreaRect.h);
    const ocrResult = await this.engine.recognizeAsync(nameAreaMat);

    // OCR 結果を補正する
    const correctName = ItemDefinitionService.correctName(ocrResult.text);

    // 後始末
    iconAreaMat.delete();
    iconMat.delete();
    nameAreaMat.delete();

    return {
      id: null,
      iconDataUrl: iconDataUrl,
      name: correctName,
      features: features,
    };
  }

  private static correctName(name: string): string {
    // 空白を除去
    const trimName = name.replace(/\s/g, '');
    // 共通の誤認識の補正
    const correctName = trimName.replace(/糧金/g, '煌金')
      .replace(/関銀/g, '閃銀')
      .replace(/翠糧/g, '翠煌')
      .replace(/残津/g, '残滓')
      .replace(/残洲/g, '残滓')
      .replace(/\(大\)/g, '（大）')
      .replace(/\(小\)/g, '（小）')
      .replace(/かき水機/g, 'かき氷機')
      .replace(/永皆/g, '永昏');
    // 個別の補正
    const errorMap: Record<string, string> = {
      'テクニックの銘': 'テクニックの駒',
      '太5ロスレコセレクション': '★5ロスレコセレクション',
      '大4ロスレコセレクション有': '★4ロスレコセレクションⅡ',
      '太4ロスレコセレクション則|': '★4ロスレコセレクションⅢ',
      '上厳選ロスレコ昇格箱': '厳選ロスレコ昇格箱',
      'ドボの残党': 'ドボの残滓',
      '太4ロスレコセレクション有1': '★4ロスレコセレクションⅡ',
      '太4ロスレコセレクション山|': '★4ロスレコセレクションⅢ',
    };
    // 個別の補正を適用する
    return errorMap[correctName] || correctName;
  }
}
