'use client';

/**
 * Guardrail Threshold Calculator — uses Pyodide WASM for math.
 * Combines two historical periods via weighted distribution pooling to derive
 * pre-registered guardrail thresholds (μ − 1σ and μ − 2σ).
 *
 * Ported from the guardrail-estimator Shiny app. CSV upload auto-splits rows
 * by chronological midpoint into a recent period and a year-over-year period,
 * then auto-populates mean and SD for the selected metric column.
 */

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { runGuardrailThreshold } from '@/lib/stats/runAnalysis';
import type { GuardrailThresholdResult } from '@/lib/stats/types';

interface GuardrailThresholdCalculatorProps {
  onThresholdsCalculated: (conservative: number, flexible: number) => void;
}

export function GuardrailThresholdCalculator({
  onThresholdsCalculated,
}: GuardrailThresholdCalculatorProps) {
  const [mu1, setMu1] = useState('');
  const [sd1, setSd1] = useState('');
  const [weight1, setWeight1] = useState('6');
  const [mu2, setMu2] = useState('');
  const [sd2, setSd2] = useState('');
  const [weight2, setWeight2] = useState('4');

  const [csvColumns, setCsvColumns] = useState<string[]>([]);
  const [csvSelectedCol, setCsvSelectedCol] = useState('');
  const [csvPeriodInfo, setCsvPeriodInfo] = useState<{
    p1Range: string;
    p1N: number;
    p2Range: string;
    p2N: number;
  } | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);

  interface ParsedCsvRow { data: Record<string, string>; date: Date }
  const period1RowsRef = useRef<ParsedCsvRow[]>([]);
  const period2RowsRef = useRef<ParsedCsvRow[]>([]);

  const [result, setResult] = useState<GuardrailThresholdResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    setCsvPeriodInfo(null);
    setCsvColumns([]);
    setCsvSelectedCol('');

    file.text().then((text) => {
      Papa.parse<Record<string, string>>(text, {
        header: true,
        skipEmptyLines: true,
        complete: (parsed) => {
          const headers = parsed.meta.fields ?? [];
          const dateCol = headers[0];
          const metricCols = headers.slice(1);

          const rows: ParsedCsvRow[] = (parsed.data as Record<string, string>[])
            .map((row) => ({ data: row, date: new Date(row[dateCol]) }))
            .filter((r) => !isNaN(r.date.getTime()))
            .sort((a, b) => a.date.getTime() - b.date.getTime());

          if (rows.length < 2) {
            setCsvError('CSV must contain at least 2 valid date rows.');
            return;
          }

          const minMs = rows[0].date.getTime();
          const maxMs = rows[rows.length - 1].date.getTime();
          const midMs = (minMs + maxMs) / 2;

          const p1Rows = rows.filter((r) => r.date.getTime() > midMs);
          const p2Rows = rows.filter((r) => r.date.getTime() <= midMs);

          if (p1Rows.length === 0 || p2Rows.length === 0) {
            setCsvError(
              'Could not split CSV into two date periods. Ensure the file spans two distinct date ranges (e.g. recent + prior year).',
            );
            return;
          }

          const fmt = (d: Date) =>
            d.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            });

          period1RowsRef.current = p1Rows;
          period2RowsRef.current = p2Rows;

          setCsvColumns(metricCols);
          setCsvPeriodInfo({
            p1Range: `${fmt(p1Rows[0].date)} – ${fmt(p1Rows[p1Rows.length - 1].date)}`,
            p1N: p1Rows.length,
            p2Range: `${fmt(p2Rows[0].date)} – ${fmt(p2Rows[p2Rows.length - 1].date)}`,
            p2N: p2Rows.length,
          });
        },
      });
    });
  }

  function handleColumnSelect(col: string) {
    setCsvSelectedCol(col);
    if (!col) return;

    const extract = (rows: ParsedCsvRow[]) =>
      rows.map((r) => Number(r.data[col])).filter(isFinite);

    const p1 = extract(period1RowsRef.current);
    const p2 = extract(period2RowsRef.current);

    if (p1.length === 0 || p2.length === 0) {
      setCsvError('Selected column has no numeric values in one or both periods.');
      return;
    }
    setCsvError(null);

    const mean = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;
    const stddev = (arr: number[], m: number) =>
      Math.sqrt(arr.reduce((acc, v) => acc + (v - m) ** 2, 0) / Math.max(arr.length - 1, 1));

    const m1 = mean(p1);
    const m2 = mean(p2);
    setMu1(m1.toFixed(6));
    setSd1(stddev(p1, m1).toFixed(6));
    setMu2(m2.toFixed(6));
    setSd2(stddev(p2, m2).toFixed(6));
  }

  async function handleCalculate() {
    setError(null);
    const mu1n = Number(mu1);
    const sd1n = Number(sd1);
    const w1n = Number(weight1);
    const mu2n = Number(mu2);
    const sd2n = Number(sd2);
    const w2n = Number(weight2);

    if ([mu1n, sd1n, w1n, mu2n, sd2n, w2n].some((v) => !isFinite(v) || isNaN(v))) {
      setError('All six fields are required and must be valid numbers.');
      return;
    }
    if (sd1n < 0 || sd2n < 0) {
      setError('Standard deviation cannot be negative.');
      return;
    }
    if (w1n <= 0 || w2n <= 0) {
      setError('Weights must be greater than zero.');
      return;
    }

    setIsLoading(true);
    try {
      const res = await runGuardrailThreshold({
        type: 'guardrail-threshold',
        period1: { mu: mu1n, sd: sd1n, weight: w1n },
        period2: { mu: mu2n, sd: sd2n, weight: w2n },
      });
      setResult(res);
      onThresholdsCalculated(res.conservativeThreshold, res.flexibleThreshold);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Calculation failed.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="card mt-3">
      <div className="card-body">
        <h6 className="card-title mb-1">Guardrail Threshold Calculator</h6>
        <p className="text-muted small mb-3">
          Combines two historical periods via weighted distribution pooling.
          Outputs conservative (μ&nbsp;−&nbsp;1σ) and flexible (μ&nbsp;−&nbsp;2σ) thresholds.
        </p>

        {/* CSV upload */}
        <div className="mb-3">
          <label className="form-label small mb-1">
            Upload historical data <span className="text-muted">(optional — auto-populates fields)</span>
          </label>
          <input
            type="file"
            accept=".csv"
            className="form-control form-control-sm"
            onChange={handleCSVUpload}
          />
          {csvError && (
            <div className="text-danger small mt-1">{csvError}</div>
          )}
          {csvPeriodInfo && (
            <div className="mt-2 p-2 bg-body-secondary rounded small">
              <div className="row g-1">
                <div className="col-6">
                  <span className="fw-medium">120-Day Baseline: </span>
                  <span className="text-muted">
                    {csvPeriodInfo.p1Range} ({csvPeriodInfo.p1N} rows)
                  </span>
                </div>
                <div className="col-6">
                  <span className="fw-medium">Year-over-Year: </span>
                  <span className="text-muted">
                    {csvPeriodInfo.p2Range} ({csvPeriodInfo.p2N} rows)
                  </span>
                </div>
              </div>
              {csvColumns.length > 0 && (
                <div className="mt-2">
                  <label className="form-label small mb-1">Metric column</label>
                  <select
                    className="form-select form-select-sm"
                    value={csvSelectedCol}
                    onChange={(e) => handleColumnSelect(e.target.value)}
                  >
                    <option value="">Choose column…</option>
                    {csvColumns.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Period inputs */}
        <div className="row g-3">
          <div className="col-md-6">
            <div className="p-2 border rounded">
              <div className="small fw-semibold text-primary mb-2">
                120-Day Baseline
              </div>
              <div className="row g-2">
                <div className="col-4">
                  <label className="form-label small mb-1">Mean</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control form-control-sm"
                    value={mu1}
                    onChange={(e) => setMu1(e.target.value)}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small mb-1">Std Dev</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-control form-control-sm"
                    value={sd1}
                    onChange={(e) => setSd1(e.target.value)}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small mb-1">Weight</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="10"
                    className="form-control form-control-sm"
                    value={weight1}
                    onChange={(e) => setWeight1(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="col-md-6">
            <div className="p-2 border rounded">
              <div className="small fw-semibold text-secondary mb-2">
                Year-over-Year
              </div>
              <div className="row g-2">
                <div className="col-4">
                  <label className="form-label small mb-1">Mean</label>
                  <input
                    type="number"
                    step="any"
                    className="form-control form-control-sm"
                    value={mu2}
                    onChange={(e) => setMu2(e.target.value)}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small mb-1">Std Dev</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    className="form-control form-control-sm"
                    value={sd2}
                    onChange={(e) => setSd2(e.target.value)}
                  />
                </div>
                <div className="col-4">
                  <label className="form-label small mb-1">Weight</label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    max="10"
                    className="form-control form-control-sm"
                    value={weight2}
                    onChange={(e) => setWeight2(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-1 mt-3 small mb-0">{error}</div>
        )}

        <button
          className="btn btn-outline-primary btn-sm mt-3"
          onClick={handleCalculate}
          disabled={isLoading}
        >
          {isLoading ? 'Calculating…' : 'Calculate Thresholds'}
        </button>

        {/* Results */}
        {result && (
          <div className="mt-3">
            <div className="row text-center g-2">
              <div className="col">
                <div className="fs-5 fw-bold text-warning-emphasis">
                  {result.conservativeThreshold.toFixed(4)}
                </div>
                <small className="text-muted d-block">Conservative (μ − 1σ)</small>
                <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                  {result.conservativePct.toFixed(1)}% from mean
                </small>
              </div>
              <div className="col">
                <div className="fs-5 fw-bold text-danger">
                  {result.flexibleThreshold.toFixed(4)}
                </div>
                <small className="text-muted d-block">Flexible (μ − 2σ)</small>
                <small className="text-muted" style={{ fontSize: '0.7rem' }}>
                  {result.flexiblePct.toFixed(1)}% from mean
                </small>
              </div>
              <div className="col">
                <div className="fs-5 fw-bold">{result.combinedMu.toFixed(4)}</div>
                <small className="text-muted">Combined mean</small>
              </div>
              <div className="col">
                <div className="fs-5 fw-bold">{result.combinedSd.toFixed(4)}</div>
                <small className="text-muted">Combined SD</small>
              </div>
            </div>
            <div className="alert alert-info py-2 mt-3 small mb-0">
              Thresholds saved to this metric. Click <strong>Update</strong> to persist.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
