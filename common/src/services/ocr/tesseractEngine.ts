import type { IOcrEngine, OcrResult } from '../../types';
import { createWorker } from 'tesseract.js';
import { ImageUtils } from '../imageUtils';

/**
 * Tesseract.js を用いた OCR エンジン実装
 */
export class TesseractOcrEngine {
  private worker: any = null;

  private constructor(worker: any) {
    this.worker = worker;
  }

  public static async getInstanceAsync(lang: string = 'eng', whitelist?: string): Promise<TesseractOcrEngine> {
    const worker = await createWorker(lang);

    if (whitelist) {
      await worker.setParameters({
        tessedit_char_whitelist: whitelist,
      });
    }

    return new TesseractOcrEngine(worker);
  }

  public async recognizeAsync(mat: any): Promise<OcrResult> {

    const imageData = ImageUtils.matToImageData(mat);
    const canvas = document.createElement('canvas');
    canvas.width = mat.cols;
    canvas.height = mat.rows;
    canvas.getContext('2d')?.putImageData(imageData, 0, 0);

    const { data: { text, confidence } } = await this.worker.recognize(canvas);

    return {
      text: text.trim(),
      confidence: confidence / 100,
    };
  }

  async dispose(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}
