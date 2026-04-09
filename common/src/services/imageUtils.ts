declare const cv: any;

/**
 * OpenCV (Mat) を中心とした画像処理ユーティリティ
 */
export class ImageUtils {
  /**
   * 画像を指定された矩形で切り出す (Mat を返す。呼び出し元で delete する必要あり)
   */
  static crop(src: any, x: number, y: number, width: number, height: number): any {

    const roundX = Math.round(x)
    const roundY = Math.round(y)
    const roundW = Math.round(width)
    const roundH = Math.round(height)

    if (roundX < 0 || roundY < 0 || roundW <= 0 || roundH <= 0 ||
      roundX + roundW > src.cols || roundY + roundH > src.rows) {
      console.error('Invalid crop region', roundX, roundY, roundW, roundH, src.cols, src.rows)
      console.error('original image size', src.cols, src.rows)
      throw new Error('Invalid crop region')
    }

    const rect = new cv.Rect(roundX, roundY, roundW, roundH);
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
   * Mat から Data URL を生成する
   */
  static matToDataUrl(mat: any): string {
    const canvas = document.createElement('canvas');
    cv.imshow(canvas, mat);
    return canvas.toDataURL('image/png');
  }
}
