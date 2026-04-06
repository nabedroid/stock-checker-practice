/**
 * アイテム解析結果
 */
export interface AnalyzedItem {
  /** アイコン画像（Base64 Data URL） */
  iconDataUrl: string;
  /** pHash値 */
  phash: string;
  /** アイテム名（辞書から取得、未知の場合は空） */
  name: string;
  /** 所持数 */
  quantity: number;
  /** OCR信頼度 (0-1) */
  confidence: number;
  /** 元画像のインデックス */
  sourceImageIndex: number;
}

/**
 * グリッド検出結果のアイコン領域
 */
export interface IconRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  /** 見切れているか */
  isClipped: boolean;
}

/**
 * OCR結果
 */
export interface OcrResult {
  /** 認識テキスト（"×287" 等） */
  text: string;
  /** 所持数 */
  quantity: number;
  /** 信頼度 (0-1) */
  confidence: number;
}

/**
 * OCRエンジンの共通インターフェース
 */
export interface IOcrEngine {
  /** エンジン名 */
  readonly name: string;
  /** 初期化 */
  initialize(): Promise<void>;
  /** 画像から数値を認識 */
  recognize(imageData: ImageData): Promise<OcrResult>;
  /** リソース解放 */
  dispose(): void;
}

/**
 * 辞書エントリ
 */
export interface DictionaryEntry {
  /** pHash値 */
  phash: string;
  /** アイテム名 */
  name: string;
  /** アイコン画像（Base64 Data URL） */
  iconDataUrl: string;
}

/**
 * 辞書データ
 */
export interface Dictionary {
  version: number;
  entries: DictionaryEntry[];
}

/**
 * 解析進捗
 */
export interface AnalysisProgress {
  /** 現在のステップ */
  step: 'loading' | 'grid-detection' | 'icon-extraction' | 'ocr' | 'identification' | 'dedup' | 'done';
  /** 進捗率 (0-100) */
  percent: number;
  /** メッセージ */
  message: string;
}
