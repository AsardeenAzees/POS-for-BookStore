export const roles = ["ADMIN", "MANAGER", "CASHIER", "INVENTORY_STAFF", "DELIVERY_STAFF"] as const;
export type RoleName = (typeof roles)[number];

export const notificationEvents = ["invoice_created", "low_stock_alert", "desired_item_available"] as const;
export type NotificationEvent = (typeof notificationEvents)[number];

export const notificationPreferences = ["INVOICE_ONLY", "STOCK_ALERTS", "MARKETING", "UNSUBSCRIBED"] as const;
export type NotificationPreference = (typeof notificationPreferences)[number];

export type ApiResponse<T> = {
  data: T;
};
