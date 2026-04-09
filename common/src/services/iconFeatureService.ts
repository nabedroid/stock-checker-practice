
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
    } finally {
      mask.delete();
      roi.delete();
    }
  }

  /**
   * 2つのアイコンの特徴量を比較し、一致するかどうかを返す
   */
  public static compare(descriptors1: any, descriptors2: any): boolean {
    const score = FeatureMatcher.compare(descriptors1, descriptors2);
    // 20点以上で一致とみなす
    // TODO: 閾値は調整する
    return score >= 20;
  }
}