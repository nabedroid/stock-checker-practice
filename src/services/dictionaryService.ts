import type { Dictionary, DictionaryEntry } from '../types';

const MASTER_DICT_URL = `${import.meta.env.BASE_URL}master-dictionary.json`;
const STORAGE_KEY = 'stella_sora_user_dictionary';

/**
 * マスター辞書とユーザー辞書を管理するサービス
 */
export class DictionaryService {
  private static master: Dictionary = { version: 1, entries: [] };
  private static user: Dictionary = { version: 1, entries: [] };

  /**
   * 辞書の初期化（マスター取得 + ユーザーロード）
   */
  static async initialize(): Promise<void> {
    try {
      const response = await fetch(MASTER_DICT_URL);
      if (response.ok) {
        this.master = await response.json();
      }
    } catch (e) {
      console.warn('マスター辞書の読み込みに失敗しました。', e);
    }

    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        this.user = JSON.parse(stored);
      } catch (e) {
        console.error('ユーザー辞書のパースに失敗しました。', e);
      }
    }
  }

  /**
   * pHash に一致するアイテム名を検索する
   */
  static findItem(phash: string): DictionaryEntry | null {
    // ユーザー辞書を優先
    const userEntry = this.user.entries.find(e => e.phash === phash);
    if (userEntry) return userEntry;

    // マスター辞書を検索
    return this.master.entries.find(e => e.phash === phash) || null;
  }

  /**
   * 新しいアイテムをユーザー辞書に登録、または既存を更新
   */
  static updateItem(entry: DictionaryEntry): void {
    const index = this.user.entries.findIndex(e => e.phash === entry.phash);
    if (index >= 0) {
      this.user.entries[index] = entry;
    } else {
      this.user.entries.push(entry);
    }
    this.saveUserDictionary();
  }

  static getEntries(): DictionaryEntry[] {
    // 重複を排除して全エントリを返す（ユーザー辞書優先）
    const all = [...this.user.entries];
    for (const m of this.master.entries) {
      if (!all.some(a => a.phash === m.phash)) {
        all.push(m);
      }
    }
    return all;
  }

  /**
   * 現在の辞書内容を master-dictionary.json 形式の文字列としてエクスポートする
   */
  static exportDictionary(): string {
    const entries = this.getEntries();
    const data: Dictionary = {
      version: 1,
      entries: entries.sort((a, b) => a.name.localeCompare(b.name))
    };
    return JSON.stringify(data, null, 2);
  }

  private static saveUserDictionary(): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.user));
  }
}
