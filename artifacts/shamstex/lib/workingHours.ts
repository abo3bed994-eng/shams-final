import type { WorkingDay } from "@/context/AppContext";

const DAY_NAMES_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function parseHM(hm: string): { h: number; m: number } | null {
  if (!hm || typeof hm !== "string") return null;
  const parts = hm.split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return { h, m };
}

function dayMinutes(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function findDayConfig(workingHours: WorkingDay[], dayName: string): WorkingDay | undefined {
  return workingHours.find((w) => w.day === dayName);
}

/**
 * Returns true if the current moment is inside the configured working hours
 * for the device's local day. A day with enabled=false is treated as closed.
 */
export function isWithinWorkingHours(workingHours: WorkingDay[] | undefined, now: Date = new Date()): boolean {
  if (!workingHours || workingHours.length === 0) return true;
  const dayName = DAY_NAMES_AR[now.getDay()];
  const cfg = findDayConfig(workingHours, dayName);
  if (!cfg || !cfg.enabled) return false;
  const from = parseHM(cfg.from);
  const to = parseHM(cfg.to);
  if (!from || !to) return false;
  const cur = dayMinutes(now);
  const fromM = from.h * 60 + from.m;
  const toM = to.h * 60 + to.m;
  if (toM <= fromM) return false;
  return cur >= fromM && cur < toM;
}

/**
 * Returns the next Date when the shop opens (>= now). Returns null if no day is enabled.
 */
export function nextWorkingTime(workingHours: WorkingDay[] | undefined, now: Date = new Date()): Date | null {
  if (!workingHours || workingHours.length === 0) return null;
  for (let offset = 0; offset < 14; offset++) {
    const candidate = new Date(now);
    candidate.setDate(candidate.getDate() + offset);
    const dayName = DAY_NAMES_AR[candidate.getDay()];
    const cfg = findDayConfig(workingHours, dayName);
    if (!cfg || !cfg.enabled) continue;
    const from = parseHM(cfg.from);
    const to = parseHM(cfg.to);
    if (!from || !to) continue;
    const fromM = from.h * 60 + from.m;
    const toM = to.h * 60 + to.m;
    if (toM <= fromM) continue;
    candidate.setHours(from.h, from.m, 0, 0);
    if (offset === 0 && candidate.getTime() <= now.getTime()) {
      // already past today's opening — check if still inside; if past closing, skip to next day
      const cur = dayMinutes(now);
      if (cur < toM) {
        // We're inside hours now — return current moment-ish; caller treats this as "open"
        return now;
      }
      continue;
    }
    return candidate;
  }
  return null;
}

/**
 * Friendly Arabic text describing the next opening time.
 */
export function formatNextOpenTime(next: Date | null, now: Date = new Date()): string {
  if (!next) return "—";
  const sameDay = next.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const isTomorrow = next.toDateString() === tomorrow.toDateString();
  const time = next.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
  if (sameDay) return `اليوم الساعة ${time}`;
  if (isTomorrow) return `غداً الساعة ${time}`;
  const dayLabel = DAY_NAMES_AR[next.getDay()];
  return `يوم ${dayLabel} الساعة ${time}`;
}
