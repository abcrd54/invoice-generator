export type FieldType = 'text' | 'textarea' | 'number' | 'money' | 'date' | 'phone' | 'select';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  required?: boolean;
  options?: string[];
  help?: string;
}

export interface StatusDef {
  value: string;
  label: string;
}

export interface DocumentType {
  slug: string;
  name: string;
  description: string;
  number_prefix: string;
  layout: 'invoice' | 'generic' | 'payment_request';
  fields: FieldDef[];
  has_items: boolean;
  statuses: StatusDef[];
  example: string;
  defaults: Record<string, unknown>;
}

export interface LineItem {
  description: string;
  qty: number;
  rate: number;
  amount: number;
}

export interface Party {
  name: string;
  phone: string;
  address: string;
}

export interface InvoiceData {
  date: string;
  dueDate: string;
  billTo: Party;
  sendTo: Party;
  items: LineItem[];
  ppnEnabled: boolean;
  taxRate: number;
  diskon: number;
  ongkir: number;
  notes: string;
  payment: {
    method: string;
    bankName: string;
    bankAccount: string;
    bankHolder: string;
  };
  terms: string[];
  // dihitung server
  subtotal: number;
  taxAmount: number;
  total: number;
}

export interface GenericData {
  date: string;
  values: Record<string, string | number>;
  items: LineItem[];
  notes: string;
  subtotal: number;
  total: number;
}

/** Form Request Payment (req ongkir, req ads, ...). */
/** Rekening tujuan transfer pada Form Request Payment. */
export interface BankAccount {
  bank: string;
  number: string;
  name: string;
}

export interface PaymentRequestData {
  date: string;
  items: LineItem[];
  refInvoice: string;
  rekening: BankAccount;
  taxEnabled: boolean;
  taxRate: number;
  diskon: number;
  biayaLain: number;
  notes: string;
  subtotal: number;
  taxAmount: number;
  total: number;
}

export type DocumentData = InvoiceData | GenericData | PaymentRequestData;

export interface DocumentRow {
  id: string;
  type: string;
  number: string;
  status: string;
  title: string;
  data: DocumentData;
  total: number;
  proof_path: string | null;
  share_token: string;
  source: 'web' | 'agent';
  created_at: string;
  updated_at: string;
}

export interface BusinessProfile {
  name: string;
  email: string;
  address: string;
  phone: string;
  logo_url: string;
  tax_rate: number;
  bank_name: string;
  bank_account: string;
  bank_holder: string;
  default_terms: string[];
}
