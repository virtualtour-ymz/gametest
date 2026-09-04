/* Pure, client-safe gamification helpers */
export function levelFromXp(xp: number) {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 50)) + 1;
}
export function xpForLevel(level: number) {
  return 50 * (level - 1) * (level - 1);
}
export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const start = xpForLevel(level);
  const end = xpForLevel(level + 1);
  return { level, start, end, current: xp - start, needed: end - start, percent: Math.round(((xp - start) / (end - start)) * 100) };
}

export const LEVEL_TITLES = [
  "دانشجوی تازه‌وارد",
  "کارآموز بخش",
  "پرستار جونیور",
  "پرستار بالینی",
  "پرستار ارشد",
  "سرپرستار",
  "سوپروایزر",
  "مربی بالینی",
  "متخصص پرستاری",
  "استاد پرستاری",
];
export function levelTitle(level: number) {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}
