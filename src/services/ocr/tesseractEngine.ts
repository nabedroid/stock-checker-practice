import type { IOcrEngine, OcrResult } from '../types';
import { createWorker } from 'tesseract.js';

/**
 * Tesseract.js を用いた OCR エンジン実装
 */
export class TesseractOcrEngine implements IOcrEngine {
  readonly name = 'Tesseract.js';
  private worker: any = null;

  async initialize(whitelist: string = '0123456789x'): Promise<void> {
    if (this.worker) return;

    // 数字のみを認識するように設定
    this.worker = await createWorker('eng');
    await this.worker.setParameters({
      tessedit_char_whitelist: whitelist,
    });
  }

  async recognize(imageData: ImageData): Promise<OcrResult> {
    if (!this.worker) throw new Error('Tesseract worker is not initialized');

    // Canvas に描画して Tesseract に渡す
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    canvas.getContext('2d')?.putImageData(imageData, 0, 0);

    const { data: { text, confidence } } = await this.worker.recognize(canvas);

    // 数値を抽出
    const quantityMatch = text.match(/\d+/);
    const quantity = quantityMatch ? parseInt(quantityMatch[0], 10) : 0;

    return {
      text: text.trim(),
      quantity,
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
