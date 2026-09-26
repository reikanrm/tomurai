export function progressValue(completed: number, total: number) {
  const safeTotal = Number.isFinite(total) ? Math.max(0, Math.floor(total)) : 0;
  const safeCompleted = Number.isFinite(completed)
    ? Math.min(safeTotal, Math.max(0, Math.floor(completed)))
    : 0;
  return { completed: safeCompleted, total: safeTotal, ratio: safeTotal ? safeCompleted / safeTotal : 0 };
}

/** Reveal a brush-shaped mark, not a geometrically perfect ring. */
export function revealSector(ratio: number): string {
  const p = Number.isFinite(ratio) ? Math.min(1, Math.max(0, ratio)) : 0;
  const start = 132 * Math.PI / 180;
  const end = start + p * 328 * Math.PI / 180;
  const point = (angle: number) => [100 + 150 * Math.cos(angle), 100 + 150 * Math.sin(angle)];
  const a = point(start);
  const b = point(end);
  return `M100 100 L${a[0]} ${a[1]} A150 150 0 ${p * 328 > 180 ? 1 : 0} 1 ${b[0]} ${b[1]} Z`;
}

export function isValidPastDate(value: string, today: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value && value <= today;
}
