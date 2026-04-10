import { FeatureMatcher } from '../utils/featureMatcher';
import { IconFeatureService } from './iconFeatureService';
import { ImageUtils } from '../utils/imageUtils';

declare const cv: any;

const MASTER_DICT_URL = `${import.meta.env.BASE_URL}master-dictionary.json`;

export interface ItemMasterDataJson {
  id: number;
  features: string;
  colorHash: number[];
  name: string;
  iconDataUrl: string;
}

export class ItemMasterData {
  /** インデックス (Dicter用) */
  public id: number;
  /** 特徴量データ (Base64化した記述子 Mat) */
  public features: string;
  /** 色情報 (3x3グリッドRGB) */
  public colorHash: number[];
  /** アイテム名 */
  public name: string;
  /** アイコン画像（Base64 Data URL） */
  public iconDataUrl: string;
  /** 特徴量データ (Base64化した記述子 Mat) */
  private _featuresMat: any | null;

  constructor(public param: {
    id: number,
    features: string,
    colorHash: number[],
    name: string,
    iconDataUrl: string
  }) {
    this.id = param.id;
    this.features = param.features;
    this.colorHash = param.colorHash;
    this.name = param.name;
    this.iconDataUrl = param.iconDataUrl;
    this._featuresMat = null;
  }

  public featuresMat(): any {
    if (this._featuresMat === null) {
      this._featuresMat = ImageUtils.base64ToMat(this.features);
    }
    return this._featuresMat;
  }

  public static fromJson(json: ItemMasterDataJson): ItemMasterData {
    return new ItemMasterData(json);
  }

  public toJson(): ItemMasterDataJson {
    return {
      id: this.id,
      features: this.features,
      colorHash: this.colorHash,
      name: this.name,
      iconDataUrl: this.iconDataUrl
    }
  }

  public dispose(): void {
    if (this._featuresMat !== null) {
      this._featuresMat.delete();
      this._featuresMat = null;
    }
  }
}

/**
 * マスター辞書データを管理するサービス
 */
export class ItemMasterService {
  private static instance: ItemMasterService | null = null;
  private master: ItemMasterData[] = [];

  private constructor() { }

  /**
   * シングルトンインスタンスを取得し、未初期化ならマスターデータを読み込む
   */
  public static async getInstanceAsync(): Promise<ItemMasterService> {
    if (!this.instance) {
      this.instance = new ItemMasterService();
      await this.instance.loadMasterDataAsync();
    }
    return this.instance;
  }

  public dispose(): void {
    // メモリ解放のため、キャッシュしている特徴量データを破棄する
    // (instance は破棄しない)
    this.master.forEach(entry => entry.dispose());
    this.master = [];
  }

  /**
   * マスターデータの非同期ロード
   */
  private async loadMasterDataAsync(): Promise<void> {
    try {
      const response = await fetch(MASTER_DICT_URL);
      if (response.ok) {
        // 既存のデータを破棄
        this.dispose();
        const items = await response.json();
        items.forEach((item: ItemMasterDataJson) => {
          this.master.push(ItemMasterData.fromJson(item));
        });
      }
    } catch (e) {
      console.warn('マスターデータの読み込みに失敗しました。', e);
    }
  }

  /**
   * ORB 特徴量と色情報に一致するアイテムを検索する
   * @param features ベース64形式の特徴量文字
   * @param colorHash 色情報の数値配列
   * @param minGoodMatches 識別を確定させるための最小一致数 (デフォルト 5)
   * @param earlyReturnThreshold この点数以上一致したら即座に返す (デフォルト 10)
   * @param colorThreshold 色の許容誤差 (デフォルト 30)
   */
  public findItem(features: string, colorHash: number[], minGoodMatches: number = 5, earlyReturnThreshold: number = 10, colorThreshold: number = 30): DictionaryEntry | null {
    // OpenCV が読み込まれていない、または特徴量データがない場合はスキップ
    if (!features || typeof cv === 'undefined') return null;

    const targetMat = ImageUtils.base64ToMat(features);
    if (targetMat.empty()) {
      targetMat.delete();
      return null;
    }

    let bestMatch: ItemMasterData | null = null;
    let maxScore = 0;

    for (const item of this.master) {
      const itemMat = item.featuresMat();
      if (!itemMat || itemMat.empty()) continue;

      // 色の比較
      // TODO: 色が異なるだけでスキップすると認識漏れが多発する
      if (!IconFeatureService.compareColor(colorHash, item.colorHash, colorThreshold)) {
        console.log(item.name, 'skip: not match color');

        continue;
      }

      const score = FeatureMatcher.compare(targetMat, itemMat);
      console.log(item.name, 'score: ', score);

      if (score > maxScore) {
        maxScore = score;
        bestMatch = item;

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
