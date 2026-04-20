import type { PowerCalculatorState } from '@/components/PowerCalculator';

export const POWER_CALC_PREFILL_KEY = 'alphabeta-power-calculator-prefill';

export type PowerCalculatorSnapshot = PowerCalculatorState & {
  savedAt: number;
};

export function formatPowerCalculatorSummary(
  snapshot: PowerCalculatorSnapshot,
): string {
  const { input, result } = snapshot;
  if (!result) {
    return '';
  }

  const mdeLabel = input.mdeMode === 'relative' ? 'relative' : 'absolute';
  const days = result.estimatedDays == null
    ? 'not estimated'
    : `${result.estimatedDays.toLocaleString()} days`;

  return [
    'Power calculation',
    `Baseline rate: ${input.baselinePct}%`,
    `MDE: ${input.mdePct}% ${mdeLabel}`,
    `Alpha: ${input.alphaPct}%`,
    `Power: ${input.powerPct}%`,
    `Daily users: ${input.dailyUsers.toLocaleString()}`,
    `Split ratio: ${input.splitRatio.toFixed(2)}`,
    `Required sample: ${result.nControl.toLocaleString()} control, ${result.nTreatment.toLocaleString()} treatment, ${result.totalN.toLocaleString()} total`,
    `Estimated runtime: ${days}`,
    `Treatment rate: ${(result.pTreatment * 100).toFixed(2)}%`,
    `Cohen's h: ${result.h.toFixed(6)}`,
  ].join('\n');
}

export function appendPowerCalculatorSummary(
  existingDescription: string | undefined,
  snapshot: PowerCalculatorSnapshot,
): string {
  const summary = formatPowerCalculatorSummary(snapshot);
  if (!summary) {
    return existingDescription ?? '';
  }

  const existing = existingDescription?.trim();
  return existing ? `${existing}\n\n${summary}` : summary;
}
