
import { FeatureMatcher } from "../utils/featureMatcher";

declare const cv: any;

/**
 * アイコンの特徴量を計算し、比較するサービス
 * FeatureMatcher をラップして、アイコンに特化した機能を提供する
 */
export class IconFeatureService {

  private constructor() { }

  /**
   * アイコンの特徴量を計算する
   */
  public static computeFeatures(mat: any): string {
    // アイコンの中心部分のみを特徴量計算に使う
    const mask = new cv.Mat.zeros(mat.rows, mat.cols, cv.CV_8UC1);
    const rect = new cv.Rect(mat.cols * 0.25, mat.rows * 0.25, mat.cols * 0.5, mat.rows * 0.5);
    const roi = mask.roi(rect);
    roi.setTo(new cv.Scalar(255));

    try {
      return FeatureMatcher.computeFeatures(mat, mask);
    } catch (e) {
      console.error(e);
      return '';
    } finally {
      mask.delete();
      roi.delete();
    }
  }

  /**
   * アイコンから色情報を計算する(中央部分の3x3 RGB配列)
   */
  public static computeColorHash(mat: any): number[] {
    const rect = new cv.Rect(mat.cols * 0.25, mat.rows * 0.25, mat.cols * 0.5, mat.rows * 0.5);
    const cropped = mat.roi(rect);
    const resized = new cv.Mat();
    cv.resize(cropped, resized, new cv.Size(3, 3));
    const data = Array.from(new Uint8Array(resized.data));

    cropped.delete();
    resized.delete();

    return data;
  }

  /**
   * 2つのアイコンの特徴量を比較し、一致するかどうかを返す
   */
  public static compare(descriptors1: any, descriptors2: any): boolean {
    const score = FeatureMatcher.compare(descriptors1, descriptors2);
    return score >= 20;
  }

  /**
   * 色情報のハッシュを比較し、ある程度の誤差(遊び)を持たせて一致判定を行う
   * 互換性チェックは行わず、確実にデータが存在する前提
   */
  public static compareColor(hash1: number[], hash2: number[], threshold: number = 30): boolean {
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