
import {
  compute as computeFeatures,
  compare as compareDescriptors,
  ComputeResult,
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
    const mask = matManager.add(new cv.Mat.zeros(mat.rows, mat.cols, cv.CV_8UC1));
    const rect = new cv.Rect(mat.cols * 0.25, mat.rows * 0.25, mat.cols * 0.5, mat.rows * 0.5);
    const roi = matManager.add(mask.roi(rect));
    roi.setTo(new cv.Scalar(255));

    try {
      using result = computeFeatures(mat, mask);
      return result ? toBase64(result.descriptors) : null;
    } catch (e) {
      console.error(e);
      return null;
    }
  }

  /**
   * アイコンから色情報を計算する(中央部分の3x3 RGB配列)
   */
  public computeColorHash(mat: any): number[] {
    using matManager = new MatManager();
    const rect = new cv.Rect(mat.cols * 0.25, mat.rows * 0.25, mat.cols * 0.5, mat.rows * 0.5);
    const cropped = matManager.add(mat.roi(rect));
    const resized = matManager.add(new cv.Mat());
    cv.resize(cropped, resized, new cv.Size(3, 3));
    const data = Array.from(new Uint8Array(resized.data));

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

    let diff = 0;
    const channels = hash1.length / 9; // 3x3 = 9ピクセル

    for (let i = 0; i < hash1.length; i += channels) {
      diff += Math.abs(hash1[i] - hash2[i]);       // R
      diff += Math.abs(hash1[i + 1] - hash2[i + 1]);   // G
      diff += Math.abs(hash1[i + 2] - hash2[i + 2]);   // B
    }

    const avgDiff = diff / (9 * 3);
    return avgDiff <= threshold;
  }
}