export interface SKU {
  id: number;
  name: string;
  fase: string;
}

export interface Entry {
  id: number;
  sku_id: number;
  sku_name: string;
  date: string;
  shift: string;
  car_number: string;
  quantity: number;
  timestamp: string;
}

export type Tab = 'apontar' | 'consulta' | 'historico' | 'ajustes' | 'skus' | 'relatorios';
