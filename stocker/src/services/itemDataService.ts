import type { Dictionary, DictionaryEntry } from '../types';
import { FeatureMatcher } from '../utils/featureMatcher';

declare const cv: any;

const MASTER_DICT_URL = `${import.meta.env.BASE_URL}master-dictionary.json`;

/**
 * マスター辞書データを管理するサービス
 */
export class ItemDataService {
  private static instance: ItemDataService | null = null;
  private readonly master: Dictionary = { version: 1, entries: [] };

  private constructor() { }

  /**
   * シングルトンインスタンスを取得し、未初期化ならマスターデータを読み込む
   */
  public static async getInstanceAsync(): Promise<ItemDataService> {
    if (!this.instance) {
      this.instance = new ItemDataService();
      await this.instance.loadMasterDataAsync();
    }
    return this.instance;
  }

  /**
   * マスターデータの非同期ロード
   */
  private async loadMasterDataAsync(): Promise<void> {
    try {
      const response = await fetch(MASTER_DICT_URL);
      if (response.ok) {
        // master プロパティは private ですが、内部のロード時には上書きが可能です
        // readonly の制約を避けるため、any キャストまたは代入可能なプロパティとして定義しておくべきでした
        // ここでは安全のため as any か再代入可能な readonly 外しが必要です
        Object.assign(this.master, await response.json());
      }
    } catch (e) {
      console.warn('マスターデータの読み込みに失敗しました。', e);
    }
  }

  /**
   * 辞書エントリの Base64 特徴量を cv.Mat にパースしてキャッシュする内部ヘルパー
   */
  private getDescriptorMat(entry: DictionaryEntry): any {
    const anyEntry = entry as any;
    if (!anyEntry._cachedMat) {
      if (!entry.features) return null;
      anyEntry._cachedMat = FeatureMatcher.base64ToMat(entry.features);
    }
    return anyEntry._cachedMat;
  }

  /**
   * ORB 特徴量に一致するアイテムを検索する
   * @param features ベース64形式の特徴量文字
   * @param minGoodMatches 識別を確定させるための最小一致数 (デフォルト 5)
   * @param earlyReturnThreshold この点数以上一致したら即座に返す (デフォルト 10)
   */
  public findItem(features: string, minGoodMatches: number = 5, earlyReturnThreshold: number = 10): DictionaryEntry | null {
    // OpenCV が読み込まれていない、または特徴量データがない場合はスキップ
    if (!features || typeof cv === 'undefined') return null;

    const targetMat = FeatureMatcher.base64ToMat(features);
    if (targetMat.empty()) {
      targetMat.delete();
      return null;
    }

    let bestMatch: DictionaryEntry | null = null;
    let maxScore = 0;

    for (const entry of this.master.entries) {
      const entryMat = this.getDescriptorMat(entry);
      if (!entryMat || entryMat.empty()) continue;

      const score = FeatureMatcher.compare(targetMat, entryMat);

      if (score > maxScore) {
        maxScore = score;
        bestMatch = entry;

        // 早期リターンの閾値を超えれば即確定
        if (maxScore >= earlyReturnThreshold) {
          break;
        }
      }
    }

    targetMat.delete();

    // 一定以上のスコア（一致点数）があれば採用
    if (maxScore >= minGoodMatches) {
      return bestMatch;
    }

    return null;
  }
}
