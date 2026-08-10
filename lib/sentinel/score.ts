import { Finding } from './types';

export type ExposureBand = 'MINIMAL' | 'NOTABLE' | 'SEVERE' | 'CRITICAL';

/**
 * Calculates exposure score (0..100) based on non-dismissed findings.
 * Uses a saturating log-exponential scale so multiple findings diminish gradually.
 */
export function exposureScore(findings: Finding[]): number {
  const activeFindings = findings.filter((f) => !f.dismissed);
  if (activeFindings.length === 0) return 0;

  let totalWeight = 0;
  for (const f of activeFindings) {
    let weight = 8;
    if (f.severity === 4) weight = 32;
    else if (f.severity === 3) weight = 18;
    else if (f.severity === 2) weight = 8;
    else if (f.severity === 1) weight = 3;

    // Apply tier modifier (Tier 1 heuristic slightly weighted down)
    if (f.tier === 1) weight *= 0.6;

    totalWeight += weight;
  }

  // Saturation formula: score = 100 * (1 - e^(-totalWeight / 35))
  const rawScore = 100 * (1 - Math.exp(-totalWeight / 35));
  return Math.min(100, Math.max(0, Math.round(rawScore)));
}

/**
 * Returns the exposure band classification for a given score.
 */
export function getExposureBand(score: number): ExposureBand {
  if (score <= 15) return 'MINIMAL';
  if (score <= 40) return 'NOTABLE';
  if (score <= 75) return 'SEVERE';
  return 'CRITICAL';
}

/**
 * Generates masked prompt text where each active finding is replaced
 * by [[TYPE_n]], numbered per type in order of appearance.
 */
export function maskedPrompt(text: string, findings: Finding[]): string {
  if (!text) return '';
  const activeFindings = findings
    .filter((f) => !f.dismissed)
    .sort((a, b) => a.start - b.start);

  if (activeFindings.length === 0) return text;

  // Track type counters for sequential numbering: [[EMAIL_1]], [[EMAIL_2]], etc.
  const typeCounters: Record<string, number> = {};

  let result = '';
  let lastIndex = 0;

  for (const f of activeFindings) {
    if (f.start < lastIndex) continue; // Skip overlapping edge cases

    const count = (typeCounters[f.type] || 0) + 1;
    typeCounters[f.type] = count;

    const token = `[[${f.type}_${count}]]`;

    result += text.slice(lastIndex, f.start);
    result += token;
    lastIndex = f.end;
  }

  result += text.slice(lastIndex);
  return result;
}
