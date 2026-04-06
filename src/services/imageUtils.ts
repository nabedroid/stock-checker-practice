declare const cv: any;

/**
 * OpenCV (Mat) を中心とした画像処理ユーティリティ
 */
export class ImageUtils {
  /**
   * 画像を指定された矩形で切り出す (Mat を返す。呼び出し元で delete する必要あり)
   */
  static crop(src: any, x: number, y: number, width: number, height: number): any {
    const rect = new cv.Rect(
      Math.max(0, Math.round(x)),
      Math.max(0, Math.round(y)),
      Math.min(src.cols - Math.round(x), Math.round(width)),
      Math.min(src.rows - Math.round(y), Math.round(height))
    );
    return src.roi(rect);
  }

  /**
   * 特定の色域を抽出する (Mat を返す)
   */
  static extractColor(src: any, lowerRgba: number[], upperRgba: number[]): any {
    const lower = new cv.Mat(src.rows, src.cols, src.type(), lowerRgba);
    const upper = new cv.Mat(src.rows, src.cols, src.type(), upperRgba);
    const mask = new cv.Mat();
    cv.inRange(src, lower, upper, mask);
    lower.delete(); upper.delete();
    return mask;
  }

  /**
   * 画像を反転する (Mat を返す)
   */
  static invert(src: any): any {
    const dst = new cv.Mat();
    cv.bitwise_not(src, dst);
    return dst;
  }

  /**
   * Mat を ImageData に変換する
   */
  static matToImageData(mat: any): ImageData {
    const canvas = document.createElement('canvas');
    canvas.width = mat.cols;
    canvas.height = mat.rows;
    cv.imshow(canvas, mat);
    return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  }

  /**
   * 所持数 OCR 用の前処理 (合成メソッド)
   */
  static preprocessForOcr(roi: any): ImageData {
    // 1. 数字の色 (#264278) を抽出
    const mask = this.extractColor(roi, [0, 20, 80, 0], [80, 110, 170, 255]);

    // 2. 反転 (白背景に黒文字)
    const inverted = this.invert(mask);

    // 3. 変換
    const imageData = this.matToImageData(inverted);

    // Cleanup
    mask.delete(); inverted.delete();

    return imageData;
  }

  /**
   * Mat から Data URL を生成する
   */
  static matToDataUrl(mat: any): string {
    const canvas = document.createElement('canvas');
    cv.imshow(canvas, mat);
    return canvas.toDataURL('image/png');
  }
}
