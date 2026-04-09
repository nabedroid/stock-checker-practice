import { IconRegion } from '../types';

/**
 * OpenCV (cv) の型定義（簡易版）
 */
declare const cv: any;

/**
 * グリッド検出のオプション
 */
export interface DetectOptions {
  /** 二値化の閾値 */
  threshold?: number;
  /** アイコン枠の横縦比の最小値、1.0 だと完全な正方形 */
  minIconAspectRatio?: number;
  /** アイコン枠の横縦比の最大値、1.0 だと完全な正方形 */
  maxIconAspectRatio?: number;
  /** アイコン枠の横幅の最小値 */
  minIconWidth?: number;
  /** アイコン枠の横幅の最大値 */
  maxIconWidth?: number;
}

/**
 * グリッド領域検出とアイコン切り出しを行うサービス
 */
export class GridDetector {

  /**
   * 画像からアイテムグリッド領域を検出し、各アイコンの座標を算出する
   */
  static async detectIcons(src: any, options: DetectOptions = {}): Promise<IconRegion[]> {
    const {
      threshold = 200,
      minIconAspectRatio = 0.95,
      maxIconAspectRatio = 1.05,
      minIconWidth = 0,
      maxIconWidth = Number.MAX_SAFE_INTEGER,
    } = options;

    if (typeof cv === 'undefined' || !cv.Mat) {
      throw new Error('OpenCV.js がロードされていません。');
    }

    // 輪郭検出のための前処理
    // グレースケール
    const gray = new cv.Mat();
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    // 二値化
    const binary = new cv.Mat();
    cv.threshold(gray, binary, threshold, 255, cv.THRESH_BINARY);
    // 輪郭検出
    const contours = new cv.MatVector();
    const hierarchy = new cv.Mat();
    cv.findContours(binary, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);

    // 検出した輪郭からアイコン領域を抽出
    const candidates: IconRegion[] = [];
    for (let i = 0; i < contours.size(); ++i) {
      const cnt = contours.get(i);
      const rect = cv.boundingRect(cnt);
      const aspectRatio = rect.width / rect.height;

      // 検出した輪郭がアイコンの条件を満たすかチェック
      // アイコンの縦横比
      if (minIconAspectRatio <= aspectRatio && aspectRatio <= maxIconAspectRatio) {
        // アイコンのサイズ
        if (minIconWidth <= rect.width && rect.width <= maxIconWidth) {
          candidates.push({
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
          });
        }
      }
      cnt.delete();
    }

    // 座標順にソート（上から下、左から右）
    candidates.sort((a, b) => {
      const rowThreshold = a.height / 2;
      if (Math.abs(a.y - b.y) < rowThreshold) {
        return a.x - b.x;
      }
      return a.y - b.y;
    });

    // メモリ解放
    gray.delete();
    binary.delete();
    contours.delete();
    hierarchy.delete();

    // 近接すぎる矩形（二重検出など）を除去
    const iconRegions: IconRegion[] = [];
    for (const cand of candidates) {
      const minDistanceX = cand.width * 0.8;
      const minDistanceY = cand.height * 0.8;
      const isTooClose = iconRegions.some(icon =>
        Math.abs(icon.x - cand.x) < minDistanceX && Math.abs(icon.y - cand.y) < minDistanceY
      );
      if (!isTooClose) {
        iconRegions.push(cand);
      }
    }

    return iconRegions;
  }
}
