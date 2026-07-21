export function normalizeSriLankanPhone(phone: string) {
  const digits = phone.replace(/[^\d+]/g, "").replace(/^\+/, "");
  if (/^07\d{8}$/.test(digits)) return `94${digits.slice(1)}`;
  if (/^947\d{8}$/.test(digits)) return digits;
  return null;
}

export function maskPhone(phone: string) {
  const normalized = normalizeSriLankanPhone(phone) ?? phone;
  return normalized.length > 4 ? `${normalized.slice(0, 4)}xxxxx${normalized.slice(-2)}` : "invalid";
}

export function maskSecret(secret: string) {
  if (!secret) return "not_configured";
  return "configured";
}
