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
  /** 色情報 (3x3グリッドRGB) */
  colorHash: number[];
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

/**
 * 解析の閾値設定
 */
export interface ExtractionSettings {
  /** ORB最小一致点数 (1-100, default: 5) */
  minGoodMatches: number;
  /** 早期リターン閾値 (1-100, default: 10) */
  earlyReturnThreshold: number;
  /** 色許容誤差 (1-100, default: 30) */
  colorThreshold: number;
}
