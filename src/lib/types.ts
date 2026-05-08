export interface UserConfig {
  country: string;
  lang: 'en' | 'bn' | 'hi' | 'mr' | 'ru' | 'tt' | 'ba' | 'es' | 'zh' | 'fr' | 'de' | 'ar' | 'ur' | 'pa' | 'sd' | 'ne' | 'mai' | 'bho' | 'si' | 'ta' | 'te' | 'kn' | 'as' | 'brx' | 'doi' | 'gu' | 'ks' | 'kok' | 'ml' | 'mni' | 'or' | 'sa' | 'sat' | 'wuu' | 'yue';
  userName: string;
  phone: string;
  isLoggedIn: boolean;
  currency: string;
  dialCode: string;
  timeFormat: '12h' | '24h';
  createdAt?: string; // YYYY-MM-DD
  photoURL?: string;
}

export type Unit = 'kg' | 'gm' | 'pc' | 'ltr' | 'quintal' | 'unit' | 'none';

export interface MarketItem {
  id: string;
  name: string;
  rate: number;
  rateQty: number;
  rateUnit: Unit;
  qty: number;
  unit: Unit;
  price: number;
  bought: boolean;
}

export interface MarketList {
  id: string;
  name: string;
  date: string; // YYYY-MM-DD. Deprecated, use datetime.
  datetime: string; // ISO 8601 format
  items: MarketItem[];
  status?: 'draft' | 'active';
}

export type Dictionary = {
  [lang: string]: {
    [key: string]: string | { [key: string]: string };
  };
};


