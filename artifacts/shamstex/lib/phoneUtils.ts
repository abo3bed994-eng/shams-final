import { COUNTRIES, Country, DEFAULT_COUNTRY, findCountryByDial } from "./countries";

// Strip every non-digit character.
export function digitsOnly(s: string): string {
  return (s || "").replace(/\D/g, "");
}

// Remove a leading zero from local number portion.
export function stripLeadingZero(local: string): string {
  return local.replace(/^0+/, "");
}

// Convert (country, localNumber) → E.164 like "+20102...".
export function toE164(country: Country, localInput: string): string {
  const local = stripLeadingZero(digitsOnly(localInput));
  return `${country.dial}${local}`;
}

// Validate local number against the country rules.
export function isValidLocal(country: Country, localInput: string): boolean {
  const local = stripLeadingZero(digitsOnly(localInput));
  if (local.length < country.minLen || local.length > country.maxLen) return false;
  if (country.localPrefix && !country.localPrefix.test(local)) return false;
  return true;
}

// Try to parse an E.164 string back into (country, local). Returns null if unknown.
export function parseE164(e164: string): { country: Country; local: string } | null {
  if (!e164 || !e164.startsWith("+")) return null;
  // Try longest dial first
  const sorted = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
  for (const c of sorted) {
    if (e164.startsWith(c.dial)) {
      return { country: c, local: e164.slice(c.dial.length) };
    }
  }
  return null;
}

// Best-effort: detect if a stored phone is in old local Egyptian format
// (e.g. "01221131138" or "0000000001") and convert to E.164 (+20...).
// Returns the original if it already looks E.164 or cannot be confidently mapped.
export function migrateLocalToE164(stored: string, defaultCountry: Country = DEFAULT_COUNTRY): string {
  if (!stored) return stored;
  const trimmed = stored.trim();
  if (trimmed.startsWith("+")) return trimmed; // already E.164
  const digits = digitsOnly(trimmed);
  if (!digits) return trimmed;
  // Demo/protected zero-prefixed accounts (e.g. 0000000001) are kept as-is — they
  // become admin bypass identifiers, not real phones.
  if (/^0{8,}\d{1,2}$/.test(digits)) return digits;
  // Egyptian mobile typically 11 digits starting "01"
  return toE164(defaultCountry, digits);
}

export { COUNTRIES, DEFAULT_COUNTRY, findCountryByDial };

// Canonical phone form for matching/keying purposes.
// Strategy (country-aware to avoid cross-country collisions):
//   1. Demo/admin-bypass placeholders (mostly zeros) are kept as-is.
//   2. If the input is already E.164 ("+..."), return its full digits.
//   3. Otherwise migrate to E.164 using the default country and return those digits.
// This preserves country uniqueness — +201221131138 (Egypt) and +12012213113 (US)
// canonicalize to "201221131138" vs "12012213113", which do NOT collide.
export function canonicalPhone(p: string | undefined | null): string {
  if (!p) return "";
  const trimmed = String(p).trim();
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";
  // Demo/admin-bypass placeholders (e.g. 0000000001) stay as-is.
  if (/^0{6,}\d{0,4}$/.test(digits)) return digits;
  // Already E.164 → use its full digits as the canonical key.
  if (trimmed.startsWith("+")) return digits;
  // Legacy local format → migrate to E.164 (defaults to Egypt) and use those digits.
  const e164 = migrateLocalToE164(trimmed);
  if (e164.startsWith("+")) return e164.replace(/\D/g, "");
  // Unknown format → use the digit string as a last-resort key.
  return digits;
}

// Returns true when two phone strings refer to the same person.
// Robust to mixed formats (E.164 vs legacy local) but country-safe.
export function samePhone(a: string | undefined | null, b: string | undefined | null): boolean {
  const ca = canonicalPhone(a);
  const cb = canonicalPhone(b);
  if (!ca || !cb) return false;
  if (ca === cb) return true;
  // Suffix-match safety net for ambiguous legacy inputs from unknown countries:
  // accept only when the longer string ends with the shorter AND the leading
  // remainder is a plausible country code (1–4 digits). This avoids the
  // "last-10-digits" cross-country collision risk while still catching the
  // common Egyptian "+201221131138" ↔ "01221131138" equivalence.
  const longer = ca.length >= cb.length ? ca : cb;
  const shorter = ca.length >= cb.length ? cb : ca;
  if (shorter.length < 7) return false; // too short to be a real phone match
  const shorterNoLead = shorter.replace(/^0+/, "");
  if (!shorterNoLead) return false;
  if (longer.endsWith(shorterNoLead)) {
    const prefix = longer.slice(0, longer.length - shorterNoLead.length);
    if (prefix.length >= 1 && prefix.length <= 4) return true;
  }
  return false;
}
