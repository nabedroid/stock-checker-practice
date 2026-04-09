/**
 * アイテム解析結果
 */
export interface AnalyzedItem {
  /** マスターデータのID（ソート用） */
  id?: number;
  /** アイコン画像（Base64 Data URL） */
  iconDataUrl: string;
  /** 特徴量データ (Base64) */
  features: string;
  /** アイテム名（辞書から取得、未知の場合は空） */
  name: string;
  /** 所持数 */
  quantity: number | null;
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
}

/**
 * OCR結果
 */
export interface OcrResult {
  /** 認識テキスト（"×287" 等） */
  text: string;
  /** 信頼度 (0-1) */
  confidence: number;
}

export interface DictionaryEntry {
  /** インデックス (Dicter用) */
  id?: number;
  /** 特徴量データ (Base64化した記述子 Mat) */
  features: string;
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
