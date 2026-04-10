import { ImageUtils } from './imageUtils';

declare const cv: any;

/**
 * ORB 特徴量を用いた画像マッチングユーティリティ
 */
export class FeatureMatcher {
  private static orb: any = null;
  private static matcher: any = null;

  private static init() {
    if (!this.orb) {
      this.orb = new cv.ORB(500); // 最大500個の特徴点を抽出
      this.matcher = new cv.BFMatcher(cv.NORM_HAMMING, true);
    }
  }

  /**
   * 画像から ORB 特徴量（記述子）を抽出し、Base64 文字列として返す
   */
  public static computeFeatures(mat: any, mask: any = null): string {
    this.init();
    const keypoints = new cv.KeyPointVector();
    const descriptors = new cv.Mat();

    try {
      this.orb.detectAndCompute(mat, mask, keypoints, descriptors);
      if (descriptors.empty()) return '';
      // Mat のデータを Base64 文字列に変換
      return ImageUtils.matToBase64(descriptors);
    } finally {
      keypoints.delete();
      descriptors.delete();
    }
  }

  /**
   * 2つの特徴量（記述子）を比較し、一致スコアを返す
   */
  public static compare(descriptors1: any, descriptors2: any, minDistance: number = 30): number {
    if (descriptors1.empty() || descriptors2.empty()) return 0;
    this.init();

    const matches = new cv.DMatchVector();
    try {
      this.matcher.match(descriptors1, descriptors2, matches);

      let goodMatches = 0;

      for (let i = 0; i < matches.size(); i++) {
        if (matches.get(i).distance < minDistance) {
          goodMatches++;
        }
      }

      return goodMatches;
    } finally {
      matches.delete();
    }
  }
}
