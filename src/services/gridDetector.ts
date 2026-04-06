import { IconRegion } from '../types';

/**
 * OpenCV (cv) の型定義（簡易版）
 */
declare const cv: any;

/**
 * グリッド検出のオプション
 */
export interface DetectOptions {
  threshold?: number;     // 2値化の閾値 (デフォルト: 200)
  minAspectRatio?: number; // 最小アスペクト比 (デフォルト: 0.85)
  maxAspectRatio?: number; // 最大アスペクト比 (デフォルト: 1.15)
  minIconSizeRatio?: number; // 横幅に対する最小アイコンサイズ比 (デフォルト: 0.05)
  maxIconSizeRatio?: number; // 横幅に対する最大アイコンサイズ比 (デフォルト: 0.08)
}

/**
 * グリッド領域検出とアイコン切り出しを行うサービス
 */
export class GridDetector {
  /**
   * 画像からアイテムグリッド領域を検出し、各アイコンの座標を算出する
   */
  static async detectIcons(imageElement: HTMLImageElement, options: DetectOptions = {}): Promise<IconRegion[]> {
    const {
      threshold = 200,
      minAspectRatio = 0.85,
      maxAspectRatio = 1.15,
      minIconSizeRatio = 0.05,
      maxIconSizeRatio = 0.08,
    } = options;

    if (typeof cv === 'undefined' || !cv.Mat) {
      throw new Error('OpenCV.js がロードされていません。');
    }

    const src = cv.imread(imageElement);
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);

    // 1. アイコンの白い枠線を検出するための 2 値化
    const binary = new cv.Mat();
    cv.threshold(gray, binary, threshold, 255, cv.THRESH_BINARY);

    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    const candidates: IconRegion[] = [];

    // 画面サイズに基づいたアイコンサイズの想定値
    const minIconSize = src.cols * minIconSizeRatio;
    const maxIconSize = src.cols * maxIconSizeRatio;

    for (let i = 0; i < contours.size(); ++i) {
      const cnt = contours.get(i);
      const rect = cv.boundingRect(cnt);
      const aspectRatio = rect.width / rect.height;

      // 基本的なサイズとアスペクト比のフィルタ
      if (rect.width > minIconSize && rect.width < maxIconSize &&
        rect.height > minIconSize && rect.height < maxIconSize) {

        candidates.push({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
          isClipped: aspectRatio < minAspectRatio || aspectRatio > maxAspectRatio
        });
      }
      cnt.delete();
    }

    // 2. 座標順にソート（上から下、左から右）
    candidates.sort((a, b) => (a.y - b.y) || (a.x - b.x));

    // Cleanup OpenCV mats
    src.delete(); gray.delete(); binary.delete(); contours.delete(); hierarchy.delete();

    // 近接すぎる矩形（二重検出など）を除去
    const icons: IconRegion[] = [];
    for (const cand of candidates) {
      const isTooClose = icons.some(icon =>
        Math.abs(icon.x - cand.x) < 20 && Math.abs(icon.y - cand.y) < 20
      );
      if (!isTooClose) {
        icons.push(cand);
      }
    }

    return icons;
  }

  /**
   * 指定された領域を切り出して Data URL として返す
   */
  static extractIcon(imageElement: HTMLImageElement, region: IconRegion): string {
    const canvas = document.createElement('canvas');
    canvas.width = region.width;
    canvas.height = region.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';

    ctx.drawImage(
      imageElement,
      region.x, region.y, region.width, region.height,
      0, 0, region.width, region.height
    );

    return canvas.toDataURL('image/png');
  }
}
