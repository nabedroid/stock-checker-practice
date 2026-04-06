import type { IOcrEngine, OcrResult } from '../types';

/**
 * テンプレートマッチングによる軽量 OCR エンジン実装
 * 数字 (0-9) と '×' のテンプレートを比較して認識する
 */
export class TemplateMatchOcrEngine implements IOcrEngine {
  readonly name = 'テンプレートマッチング';
  private templates: Map<string, ImageData> = new Map();

  async initialize(): Promise<void> {
    // TODO: Phase 3 で実際のテンプレート画像をロードする仕組みを実装
    // public/templates/ フォルダから 0.png, 1.png ... x.png を読み込む想定
  }

  async recognize(imageData: ImageData): Promise<OcrResult> {
    // 1. 各文字を切り出し
    // 2. テンプレートとマッチング（SSD: Sum of Squared Differences 等）
    // 3. 最も近い文字を採用

    // 簡易的な実装（プレースホルダー）
    return {
      text: 'not implemented',
      quantity: 0,
      confidence: 0,
    };
  }

  async dispose(): Promise<void> {
    this.templates.clear();
  }
}
