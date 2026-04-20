
import {
  compute as computeFeatures,
  compare as compareDescriptors,
} from "../utils/feature";
import { MatManager } from "../utils/mat";
import { toBase64 } from "../utils/mat";

declare const cv: any;

/**
 * アイコンの特徴量を計算し、比較するサービス
 * FeatureMatcher をラップして、アイコンに特化した機能を提供する
 */
export class IconFeatureService {

  private static _instance: IconFeatureService | null = null;

  private constructor() { }

  public static getInstance(): IconFeatureService {
    if (!this._instance) {
      this._instance = new IconFeatureService();
    }
    return this._instance;
  }

  /**
   * アイコンの特徴量を計算する
   */
  public computeFeatures(mat: any): string | null {
    // アイコンの中心部分のみを特徴量計算に使う
    using matManager = new MatManager();

    // アスペクト比を維持して100x100に正規化
    const scale = Math.min(100 / mat.cols, 100 / mat.rows);
    const newWidth = Math.round(mat.cols * scale);
    const newHeight = Math.round(mat.rows * scale);

    const resizedMat = matManager.add(new cv.Mat());
    // 縮小時はINTER_AREA、拡大時はINTER_LINEARが推奨
    cv.resize(mat, resizedMat, new cv.Size(newWidth, newHeight), 0, 0, scale < 1.0 ? cv.INTER_AREA : cv.INTER_LINEAR);

    const mask = matManager.add(new cv.Mat.zeros(newHeight, newWidth, cv.CV_8UC1));
    const rect = new cv.Rect(newWidth * 0.25, newHeight * 0.25, newWidth * 0.5, newHeight * 0.5);
    const roi = matManager.add(mask.roi(rect));
    roi.setTo(new cv.Scalar(255));

    try {
      using result = computeFeatures(resizedMat, mask);
      return result ? toBase64(result.descriptors) : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  /**
   * アイコンから色情報を計算する(中央部分の3x3 HSV配列)
   */
  public computeColorHash(mat: any): number[] {
    using matManager = new MatManager();
    const rect = new cv.Rect(mat.cols * 0.25, mat.rows * 0.25, mat.cols * 0.5, mat.rows * 0.5);
    const cropped = matManager.add(mat.roi(rect));
    const resized = matManager.add(new cv.Mat());
    cv.resize(cropped, resized, new cv.Size(3, 3));

    const hsvMat = matManager.add(new cv.Mat());
    if (resized.channels() === 4) {
      const rgbMat = matManager.add(new cv.Mat());
      cv.cvtColor(resized, rgbMat, cv.COLOR_RGBA2RGB);
      cv.cvtColor(rgbMat, hsvMat, cv.COLOR_RGB2HSV);
    } else if (resized.channels() === 3) {
      cv.cvtColor(resized, hsvMat, cv.COLOR_RGB2HSV);
    } else {
      // 万が一チャンネル数が合わない場合はそのままコピー
      resized.copyTo(hsvMat);
    }

    const data = Array.from(new Uint8Array(hsvMat.data));
    return data;
  }

  /**
   * 2つのアイコンの特徴量を比較し、一致するかどうかを返す
   */
  public compareFeatures(descriptors1: any, descriptors2: any): boolean {
    const score = compareDescriptors(descriptors1, descriptors2);
    return score >= 20;
  }

  /**
   * 色情報のハッシュを比較し、ある程度の誤差(遊び)を持たせて一致判定を行う
   * 互換性チェックは行わず、確実にデータが存在する前提
   */
  public compareColor(hash1: number[], hash2: number[], threshold: number = 30): boolean {
    if (hash1.length !== hash2.length) return false;

    const channels = hash1.length / 9; // 3x3 = 9ピクセル

    if (channels === 3) {
      // HSV空間での比較とみなす
      let diffH = 0;
      let diffS = 0;
      let diffV = 0;

      for (let i = 0; i < hash1.length; i += 3) {
        const h1 = hash1[i];
        const s1 = hash1[i + 1];
        const v1 = hash1[i + 2];
        const h2 = hash2[i];
        const s2 = hash2[i + 1];
        const v2 = hash2[i + 2];

        // Hueは0-179の円環なので最短距離を求める
        const dH = Math.abs(h1 - h2);
        diffH += Math.min(dH, 180 - dH);
        diffS += Math.abs(s1 - s2);
        diffV += Math.abs(v1 - v2);
      }

      const avgDiffH = diffH / 9;
      const avgDiffS = diffS / 9;
      const avgDiffV = diffV / 9;

      // H(色相)の差はよりクリティカルなため重みをつけ、V(明度)の違いにはある程度寛容にする
      // H:1.5, S:1.0, V:0.5 など重み付けした平均差分を計算
      const avgDiff = (avgDiffH * 1.5 + avgDiffS * 1.0 + avgDiffV * 0.5) / 3;
      return avgDiff <= threshold;
    } else {
      // 予期せぬチャンネル数の場合は単純な差分計算フォールバック
      let diff = 0;
      for (let i = 0; i < hash1.length; i += channels) {
        for (let j = 0; j < channels; j++) {
          diff += Math.abs(hash1[i + j] - hash2[i + j]);
        }
      }
      const avgDiff = diff / (9 * channels);
      return avgDiff <= threshold;
    }
  }
}