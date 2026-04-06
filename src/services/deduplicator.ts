import type { AnalyzedItem } from '../types';
import { PHash } from '../utils/phash';

/**
 * 複数枚のスクリーンショットから抽出されたアイテムの重複を排除するサービス
 */
export class Deduplicator {
  /**
   * 重複を排除して統合されたアイテムリストを返す
   * ハミング距離が 5 以内を同一アイテムとみなす
   */
  static async deduplicate(items: AnalyzedItem[]): Promise<AnalyzedItem[]> {
    const uniqueItems: AnalyzedItem[] = [];
    const THRESHOLD = 5;

    for (const item of items) {
      let isDuplicate = false;
      for (const unique of uniqueItems) {
        const distance = PHash.compare(item.phash, unique.phash);
        if (distance <= THRESHOLD) {
          // 同一アイテムと判定
          // 基本的に所持数は同じはずだが、必要に応じて最新や最大値を選択するロジックも検討可能
          isDuplicate = true;
          break;
        }
      }

      if (!isDuplicate) {
        uniqueItems.push(item);
      }
    }

    return uniqueItems;
  }
}
