'use client';

/**
 * Power Calculator — runs entirely in the browser.
 * Implements two-proportions power calculation equivalent to R's pwr.2p2n.test.
 * See requirements.md Section 6.8.
 */

import { useEffect, useMemo, useState } from 'react';
import { MDETip, AlphaTip, PowerTip, CohensHTip } from '@/components/StatTooltip';
import { computePowerCalc, type PowerCalcResult } from '@/lib/stats/powerCalculator';

export interface PowerCalculatorInputState {
  baselinePct: number;
  mdePct: number;
  mdeMode: 'relative' | 'absolute';
  alphaPct: number;
  powerPct: number;
  dailyUsers: number;
  splitRatio: number;
}

export type PowerCalculatorResultState = PowerCalcResult & {
  estimatedDays: number | null;
};

export interface PowerCalculatorState {
  input: PowerCalculatorInputState;
  result: PowerCalculatorResultState | null;
}

interface PowerCalculatorProps {
  defaultSplitRatio?: number;
  onChange?: (state: PowerCalculatorState) => void;
}

export function PowerCalculator({ defaultSplitRatio = 1.0, onChange }: PowerCalculatorProps) {
  const [baseline, setBaseline] = useState(5);       // percentage
  const [mdeValue, setMdeValue] = useState(15);       // percentage
  const [mdeMode, setMdeMode] = useState<'relative' | 'absolute'>('relative');
  const [alpha, setAlpha] = useState(5);               // percentage
  const [power, setPower] = useState(80);              // percentage
  const [dailyUsers, setDailyUsers] = useState(1000);
  const [showDetails, setShowDetails] = useState(false);

  const result = useMemo(() => {
    const calc = computePowerCalc({
      pBaseline: baseline / 100,
      mde: mdeValue / 100,
      mdeMode,
      alpha: alpha / 100,
      power: power / 100,
      ratio: defaultSplitRatio,
    });
    if (!calc) return null;
    const estimatedDays =
      dailyUsers > 0 ? Math.ceil(calc.totalN / dailyUsers) : null;
    return { ...calc, estimatedDays };
  }, [baseline, mdeValue, mdeMode, alpha, power, dailyUsers, defaultSplitRatio]);

  useEffect(() => {
    onChange?.({
      input: {
        baselinePct: baseline,
        mdePct: mdeValue,
        mdeMode,
        alphaPct: alpha,
        powerPct: power,
        dailyUsers,
        splitRatio: defaultSplitRatio,
      },
      result,
    });
  }, [alpha, baseline, dailyUsers, defaultSplitRatio, mdeMode, mdeValue, onChange, power, result]);

  return (
    <div className="card mt-3">
      <div className="card-body">
        <h5 className="card-title">Power Calculator</h5>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label small">Baseline rate (%)</label>
            <input
              type="number"
              step="0.1"
              className="form-control form-control-sm"
              value={baseline}
              onChange={(e) => setBaseline(Number(e.target.value))}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small">
              <MDETip /> (%)
              <button
                className="btn btn-link btn-sm p-0 ms-1"
                onClick={() =>
                  setMdeMode(mdeMode === 'relative' ? 'absolute' : 'relative')
                }
              >
                [{mdeMode}]
              </button>
            </label>
            <input
              type="number"
              step="0.1"
              className="form-control form-control-sm"
              value={mdeValue}
              onChange={(e) => setMdeValue(Number(e.target.value))}
            />
          </div>
          <div className="col-md-4">
            <label className="form-label small">Daily users</label>
            <input
              type="number"
              className="form-control form-control-sm"
              value={dailyUsers}
              onChange={(e) => setDailyUsers(Number(e.target.value))}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small"><AlphaTip label={'\u03B1 (%)'} /></label>
            <input
              type="number"
              step="0.5"
              className="form-control form-control-sm"
              value={alpha}
              onChange={(e) => setAlpha(Number(e.target.value))}
            />
          </div>
          <div className="col-md-3">
            <label className="form-label small"><PowerTip label="Power (%)" /></label>
            <input
              type="number"
              step="1"
              className="form-control form-control-sm"
              value={power}
              onChange={(e) => setPower(Number(e.target.value))}
            />
          </div>
        </div>

        {result && (
          <div className="mt-3">
            <div className="row text-center">
              <div className="col">
                <div className="fs-4 fw-bold">{result.nControl.toLocaleString()}</div>
                <small className="text-muted">per control</small>
              </div>
              <div className="col">
                <div className="fs-4 fw-bold">{result.nTreatment.toLocaleString()}</div>
                <small className="text-muted">per treatment</small>
              </div>
              <div className="col">
                <div className="fs-4 fw-bold">{result.totalN.toLocaleString()}</div>
                <small className="text-muted">total users</small>
              </div>
              {result.estimatedDays != null && (
                <div className="col">
                  <div className="fs-4 fw-bold">{result.estimatedDays}</div>
                  <small className="text-muted">days</small>
                </div>
              )}
            </div>

            {Math.abs(result.h) < 0.01 && (
              <div className="alert alert-warning mt-2 py-1 small mb-0">
                Effect size is very small — experiment will need a very long
                runtime to detect this difference.
              </div>
            )}

            <button
              className="btn btn-link btn-sm p-0 mt-2"
              onClick={() => setShowDetails(!showDetails)}
            >
              {showDetails ? 'Hide details' : 'Show details'}
            </button>
            {showDetails && (
              <div className="mt-1 small text-muted">
                <CohensHTip /> = {result.h.toFixed(6)} · Treatment rate ={' '}
                {(result.pTreatment * 100).toFixed(2)}% · Split ratio ={' '}
                {defaultSplitRatio.toFixed(2)}
              </div>
            )}
          </div>
        )}

        {!result && baseline > 0 && (
          <p className="text-muted mt-2 mb-0 small">
            Enter valid parameters to calculate sample size.
          </p>
        )}
      </div>
    </div>
  );
}
