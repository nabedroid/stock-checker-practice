declare const cv: any;

/**
 * pHash (Perceptual Hash) 計算ユーティリティ
 * 8x8 DCT ベースの実装
 */
export class PHash {
  /**
   * OpenCV の Mat から形状 (pHash) と色情報を組み合わせた複合ハッシュを生成する
   */
  static async compute(mat: any): Promise<string> {
    // 1. 形状ハッシュ (pHash) の計算
    const shapeHash = await this.computeShapeHash(mat);

    // 2. 色情報の抽出 (3x3 グリッドの平均色)
    const colorHash = this.computeColorHash(mat);

    return `${shapeHash}-${colorHash}`;
  }

  /**
   * ハッシュの差異（距離）を計算する
   * 形状の差異と色の差異を組み合わせて判断
   */
  static compare(hash1: string, hash2: string): number {
    const [shape1, color1] = hash1.split('-');
    const [shape2, color2] = hash2.split('-');

    if (!shape1 || !shape2) return 999;

    // 形状のハミング距離 (0-64)
    let shapeDist = 0;
    const bin1 = this.hexToBin(shape1);
    const bin2 = this.hexToBin(shape2);
    for (let i = 0; i < 64; i++) {
      if (bin1[i] !== bin2[i]) shapeDist++;
    }

    // 色の差異
    let colorDist = 0;
    if (color1 !== color2) {
      colorDist = 20;
    }

    return shapeDist + colorDist;
  }

  private static async computeShapeHash(mat: any): Promise<string> {
    // 中心 50x50 領域
    const centerX = mat.cols / 2;
    const centerY = mat.rows / 2;
    const cropSize = 50;
    const x = Math.max(0, Math.round(centerX - cropSize / 2));
    const y = Math.max(0, Math.round(centerY - cropSize / 2));
    const w = Math.min(mat.cols - x, cropSize);
    const h = Math.min(mat.rows - y, cropSize);

    // ROI を作成 (一時的)
    const rect = new cv.Rect(x, y, w, h);
    const roi = mat.roi(rect);

    // 32x32 グレースケールにリサイズ
    const resized = new cv.Mat();
    const targetSize = new cv.Size(32, 32);
    cv.resize(roi, resized, targetSize, 0, 0, cv.INTER_AREA);

    const gray = new cv.Mat();
    cv.cvtColor(resized, gray, cv.COLOR_RGBA2GRAY);

    const grayData = new Float64Array(32 * 32);
    for (let i = 0; i < 32 * 32; i++) {
      grayData[i] = gray.data[i];
    }

    const dct = this.applyDCT(grayData, 32);
    const dct8x8 = new Float64Array(64);
    let total = 0;
    for (let dy = 0; dy < 8; dy++) {
      for (let dx = 0; dx < 8; dx++) {
        const val = dct[dy * 32 + dx];
        dct8x8[dy * 8 + dx] = val;
        if (dx !== 0 || dy !== 0) total += val;
      }
    }
    const avg = total / 63;

    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += dct8x8[i] > avg ? '1' : '0';
    }

    // Cleanup
    roi.delete(); resized.delete(); gray.delete();

    return this.binToHex(hash);
  }

  /**
   * Mat から 3x3 グリッドの平均色を 4段階に量子化してハッシュ化
   */
  private static computeColorHash(mat: any): string {
    const grid = 3;
    const cellW = Math.floor(mat.cols / grid);
    const cellH = Math.floor(mat.rows / grid);
    let colorHash = '';

    for (let gy = 0; gy < grid; gy++) {
      for (let gx = 0; gx < grid; gx++) {
        const rect = new cv.Rect(gx * cellW, gy * cellH, cellW, cellH);
        const cell = mat.roi(rect);
        const avg = cv.mean(cell); // [R, G, B, A]

        // 平均色を 4段階 (2bit) に量子化
        const avgR = Math.floor(avg[0] / 64);
        const avgG = Math.floor(avg[1] / 64);
        const avgB = Math.floor(avg[2] / 64);

        colorHash += `${avgR}${avgG}${avgB}`;
        cell.delete();
      }
    }
    return colorHash;
  }

  private static applyDCT(data: Float64Array, size: number): Float64Array {
    const dct = new Float64Array(size * size);
    const PI = Math.PI;

    for (let u = 0; u < size; u++) {
      for (let v = 0; v < size; v++) {
        let sum = 0;
        for (let x = 0; x < size; x++) {
          for (let y = 0; y < size; y++) {
            sum += data[y * size + x] *
              Math.cos(((2 * x + 1) * u * PI) / (2 * size)) *
              Math.cos(((2 * y + 1) * v * PI) / (2 * size));
          }
        }
        const cu = u === 0 ? 1 / Math.sqrt(2) : 1;
        const cv = v === 0 ? 1 / Math.sqrt(2) : 1;
        dct[v * size + u] = 0.25 * cu * cv * sum;
      }
    }
    return dct;
  }

  private static binToHex(bin: string): string {
    let hex = '';
    for (let i = 0; i < bin.length; i += 4) {
      hex += parseInt(bin.substring(i, i + 4), 2).toString(16);
    }
    return hex;
  }

  private static hexToBin(hex: string): string {
    let bin = '';
    for (let i = 0; i < hex.length; i++) {
      const parsed = parseInt(hex[i], 16);
      if (isNaN(parsed)) continue;
      bin += parsed.toString(2).padStart(4, '0');
    }
    return bin;
  }
}
