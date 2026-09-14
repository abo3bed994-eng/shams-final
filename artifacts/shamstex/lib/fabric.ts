// Fabric specification helpers.

export interface CompositionEntry {
  yarn: string;
  percent: number;
}

// "المدّ": how many linear meters you get from one kilogram of fabric.
// Derivation: one square meter weighs `gsm` grams. A linear meter of fabric is
// `widthCm/100` square meters, so it weighs `gsm * widthCm/100` grams. Therefore
// meters per kg = 1000 / (gsm * widthCm/100) = 100000 / (gsm * widthCm).
export function metersPerKg(gsm?: number, widthCm?: number): number | null {
  if (!gsm || !widthCm || gsm <= 0 || widthCm <= 0) return null;
  return 100000 / (gsm * widthCm);
}

// Normalize a composition list before saving: drop entries without a yarn, and
// when only a single yarn remains force it to 100%.
export function normalizeComposition(entries: CompositionEntry[]): CompositionEntry[] {
  const cleaned = entries
    .filter((e) => e.yarn.trim() !== "")
    .map((e) => ({ yarn: e.yarn.trim(), percent: Number(e.percent) || 0 }));
  if (cleaned.length === 1) cleaned[0].percent = 100;
  return cleaned;
}

export function compositionPercentTotal(entries: CompositionEntry[]): number {
  return entries.reduce((sum, e) => sum + (Number(e.percent) || 0), 0);
}

// Parse an optional numeric spec field (width/gsm) from a text input. Returns a
// finite positive number, or undefined when blank/invalid — so invalid input is
// omitted rather than persisted as NaN/0/negative.
export function parseOptionalPositiveNumber(text: string): number | undefined {
  if (!text.trim()) return undefined;
  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
