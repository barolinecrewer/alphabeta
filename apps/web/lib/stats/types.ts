// Shared TypeScript types for both compute paths (Pyodide WASM and Lambda).
// See requirements.md Section 9.3.

export interface AnalysisRequest {
  engine: 'bayesian' | 'frequentist' | 'sequential';
  correction: 'none' | 'holm-bonferroni' | 'benjamini-hochberg';
  alpha: number; // default 0.05
  srmThreshold: number; // default 0.001

  variations: {
    id: string;
    key: string;
    weight: number; // expected proportion 0–1
    isControl: boolean;
  }[];

  metrics: {
    id: string;
    name: string;
    isGuardrail: boolean;
    metricType?: 'proportion' | 'continuous'; // default: 'proportion' for backward compat
  }[];

  // Pre-aggregated totals — no row-level data
  data: {
    overall: Record<string, VariationData>;
    slices: Record<
      string, // dimension name
      Record<
        string, // dimension value
        Record<string, VariationData> // variation key → data
      >
    >;
  };

  multipleExposureCount: number; // detected client-side during CSV validation
}

export interface VariationData {
  units: number;
  metrics: Record<string, number>; // metric id → raw total (proportion metrics)
  // Continuous metric aggregates (populated by v2 CSV parser)
  continuousMetrics?: Record<string, { mean: number; variance: number; n: number }>;
}

export interface AnalysisResponse {
  srmPValue: number;
  srmFlagged: boolean;
  multipleExposureFlagged: boolean;

  overall: MetricVariationResult[];
  slices: Record<
    string, // dimension name
    Record<
      string, // dimension value
      MetricVariationResult[]
    >
  >;

  warnings: string[];
}

export interface MetricVariationResult {
  metricId: string;
  variationId: string;
  units: number;
  rate: number;
  mean?: number; // populated for continuous metrics (instead of rate)
  relativeUplift: number;
  absoluteUplift: number;
  significant: boolean;
  skippedSignificance?: boolean; // true when variance data unavailable (uplift-only result)
  // Bayesian
  chanceToBeatControl?: number;
  expectedLoss?: number;
  credibleIntervalLower?: number;
  credibleIntervalUpper?: number;
  // Frequentist / Sequential
  pValue?: number;
  rawPValue?: number; // pre-correction p-value (populated when multiple comparison correction applied)
  confidenceIntervalLower?: number;
  confidenceIntervalUpper?: number;
}

// Worker message types for Path A (Pyodide Web Worker)
export type WorkerMessage =
  | { type: 'result'; data: AnalysisResponse }
  | { type: 'guardrail-threshold-result'; data: GuardrailThresholdResult }
  | { type: 'error'; message: string }
  | { type: 'status'; message: string };

// ---- Guardrail Threshold Calculator ----

export interface GuardrailThresholdRequest {
  type: 'guardrail-threshold';
  period1: { mu: number; sd: number; weight: number };
  period2: { mu: number; sd: number; weight: number };
}

export interface GuardrailThresholdResult {
  combinedMu: number;
  combinedSd: number;
  conservativeThreshold: number; // combinedMu - 1 * combinedSd
  flexibleThreshold: number;      // combinedMu - 2 * combinedSd
  conservativePct: number;
  flexiblePct: number;
}
