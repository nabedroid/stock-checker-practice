import { ImageUtils } from './imageUtils';
import type { IOcrEngine } from '../types';

declare const cv: any;

/**
 * 辞書構築用のアイテム抽出サービス
 * 1枚の画像から1つのアイコンとアイテム名を抽出する
 */
export class ItemExtractor {
  /**
   * 画像からアイテム情報を抽出する
   * @param src OpenCV Mat
   * @param ocrEngine OCRエンジン
   * @param iconRect アイコン領域 {x, y, w, h}
   * @param nameRect 名前領域 {x, y, w, h}
   */
  static async extract(
    src: any,
    ocrEngine: IOcrEngine,
    iconRect: { x: number, y: number, w: number, h: number } = { x: 50, y: 50, w: 200, h: 200 },
    nameRect: { x: number, y: number, w: number, h: number } = { x: 260, y: 50, w: 400, h: 60 }
  ): Promise<{ iconDataUrl: string, name: string }> {

    // アイコンの切り出し
    const iconMat = ImageUtils.crop(src, iconRect.x, iconRect.y, iconRect.w, iconRect.h);
    const iconDataUrl = ImageUtils.matToDataUrl(iconMat);

    // 名前の OCR
    const nameMat = ImageUtils.crop(src, nameRect.x, nameRect.y, nameRect.w, nameRect.h);
    const nameImageData = ImageUtils.matToImageData(nameMat);
    const ocrResult = await ocrEngine.recognize(nameImageData);

    iconMat.delete();
    nameMat.delete();

    return {
      iconDataUrl,
      name: ocrResult.text || ''
    };
  }
}
