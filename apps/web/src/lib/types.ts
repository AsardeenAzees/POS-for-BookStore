export type Branch = { id: string; name: string; code: string };
export type Category = { id: string; name: string };
export type Product = {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: Category;
  brand?: string;
  publisher?: string;
  author?: string;
  grade?: string;
  sellingPrice: string;
  costPrice: string;
  active: boolean;
  inventory?: Stock[];
};
export type Stock = {
  id: string;
  branch: Branch;
  product: Product;
  quantity: number;
  lowStockLevel: number;
};
export type Customer = {
  id: string;
  name: string;
  phone: string;
  whatsapp?: string;
  address?: string;
  notificationPreference: string;
};
export type Sale = {
  id: string;
  invoiceNumber: string;
  total: string;
  subtotal: string;
  discount: string;
  createdAt: string;
  branch: Branch;
  customer?: Customer;
  items: { id: string; quantity: number; unitPrice: string; discount: string; total: string; product: Product }[];
  payments: { method: string; amount: string; status: string }[];
  user?: { name: string };
  notifications?: NotificationLog[];
};

export type BusinessSettings = {
  id: string;
  businessName: string;
  address?: string;
  phone?: string;
  email?: string;
  taxRegistration?: string;
  receiptFooterText: string;
  defaultCurrency: string;
  smsEnabled: boolean;
  smsProvider: "mock" | "textlk";
  invoiceSmsAutoSend: boolean;
  desiredItemSmsAutoSend: boolean;
  lowStockSmsAutoSend: boolean;
  requireApprovalBeforeDesiredItemSms: boolean;
  lowStockThresholdDefault: number;
  smsSenderId?: string;
  textlkApiTokenStatus?: string;
};

export type NotificationLog = {
  id: string;
  event: string;
  channel: string;
  provider: string;
  recipient: string;
  message: string;
  status: string;
  attempts: number;
  errorMessage?: string;
  createdAt: string;
  sentAt?: string;
};

export type DesiredItemRequest = {
  id: string;
  customerName?: string;
  phone: string;
  requestedItemName: string;
  notes?: string;
  status: string;
  notifyBySms: boolean;
  notifyByWhatsapp: boolean;
  adminApproved: boolean;
  branch?: Branch;
  matchedProduct?: Product;
  notifications?: NotificationLog[];
  createdAt: string;
};
