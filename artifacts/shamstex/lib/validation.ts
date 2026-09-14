// Egyptian phone validation: 11 digits starting with 010, 011, 012, or 015
// Also accepts demo accounts (10 digits starting with 0).
const EG_PHONE_REGEX = /^01[0125]\d{8}$/;
const DEMO_PHONE_REGEX = /^0{9}[1-9]$/; // e.g. 0000000001..0000000009

export function isValidPhone(phone: string): boolean {
  if (!phone) return false;
  const cleaned = phone.replace(/\D/g, "");
  return EG_PHONE_REGEX.test(cleaned) || DEMO_PHONE_REGEX.test(cleaned);
}

export function normalizePhone(phone: string): string {
  return (phone || "").replace(/\D/g, "");
}

export function isValidAmount(value: string | number): boolean {
  const n = typeof value === "number" ? value : parseFloat(value);
  return !isNaN(n) && isFinite(n) && n >= 0 && n < 1_000_000_000;
}

export function isValidName(name: string): boolean {
  const trimmed = (name || "").trim();
  return trimmed.length >= 2 && trimmed.length <= 100;
}
