import Dexie, { type Table } from 'dexie';
import type { AnalysisRequest } from '@/lib/stats/types';

// ----- Entity interfaces -----

export interface Variation {
  id: string;
  name: string;
  key: string;
  weight: number; // 0–1, all must sum to 1.0
  isControl: boolean;
}

export interface Experiment {
  id: string; // nanoid
  experimentId?: string; // optional platform/external experiment ID used for CSV filtering
  name: string;
  hypothesis: string;
  description?: string;
  status: 'draft' | 'running' | 'stopped' | 'archived';
  createdAt: number; // epoch ms
  updatedAt: number;
  variations: Variation[];
  primaryMetricIds: string[];
  guardrailMetricIds: string[];
  activationMetricId?: string;
  statsEngine: 'bayesian' | 'frequentist' | 'sequential';
  multipleComparisonCorrection: 'none' | 'holm-bonferroni' | 'benjamini-hochberg';
  cuped: boolean;
  tags: string[];
}

export interface Metric {
  id: string;
  name: string;
  description?: string;
  type: 'binomial' | 'count' | 'revenue' | 'continuous';
  /**
   * How to interpret the uploaded column value:
   * - 'raw_total': value is a sum; app divides by `units` to get rate/mean
   * - 'pre_normalized': value is already a rate or mean; used as-is
   */
  normalization: 'raw_total' | 'pre_normalized';
  higherIsBetter: boolean;
  capValue?: number;
  capType?: 'absolute' | 'percentile';
  minSampleSize?: number;
  isGuardrail: boolean;
  conservativeThreshold?: number; // μ − 1σ, set via GuardrailThresholdCalculator
  flexibleThreshold?: number;      // μ − 2σ, set via GuardrailThresholdCalculator
  tags: string[];
  createdAt: number;
}

export interface VariationResult {
  variationId: string;
  users: number;
  mean: number;
  stddev: number;
  // Bayesian fields
  chanceToBeatControl?: number;
  expectedLoss?: number;
  credibleIntervalLower?: number;
  credibleIntervalUpper?: number;
  // Frequentist / Sequential fields
  pValue?: number;
  rawPValue?: number; // pre-correction p-value
  confidenceIntervalLower?: number;
  confidenceIntervalUpper?: number;
  relativeUplift: number;
  absoluteUplift: number;
  scaledImpact?: number;
  significant: boolean;
  skippedSignificance?: boolean; // true when variance data unavailable (uplift-only)
  cupedApplied: boolean;
}

export interface MetricResult {
  metricId: string;
  variationResults: VariationResult[];
}

export interface ExperimentResult {
  id: string;
  experimentId: string;
  computedAt: number;
  srmPValue: number;
  srmFlagged: boolean;
  multipleExposureCount: number;
  multipleExposureFlagged: boolean;
  perMetricResults: MetricResult[];
  sliceResults?: Record<string, Record<string, MetricResult[]>>; // dimension → value → results
  rawRequest: AnalysisRequest; // archived for reproducibility
  status: 'pending' | 'complete' | 'error';
  errorMessage?: string;
}

export interface ColumnMapping {
  id: string; // experimentId + column fingerprint (sorted join)
  experimentId: string;
  columnFingerprint: string; // sorted, joined column names — used to detect schema changes
  savedAt: number;
  mapping: {
    [columnName: string]: {
      role: 'dimension' | 'metric' | 'ignore';
      metricId?: string; // set when role === 'metric'
    };
  };
}

export interface Annotation {
  id?: number; // auto-incremented
  experimentId: string;
  resultId?: string; // optional — pinned to a specific result snapshot
  metricId?: string; // optional — pinned to a specific metric row
  body: string; // free-text, markdown supported
  hidden?: boolean; // soft-delete for append-only audit trail
  createdAt: number;
  updatedAt: number;
}

export interface AppSettings {
  id: 'singleton'; // single row
  computeEngine: 'wasm' | 'lambda';
  lambdaUrl: string;
  srmThreshold: number;
  multipleExposureThreshold: number;
  defaultStatsEngine: 'bayesian' | 'frequentist' | 'sequential';
  defaultAlpha: number;
  defaultPower: number;
  dimensionWarningThreshold: number;
  backupReminderDays: number;
  lastExportedAt: number | null; // epoch ms
  currencySymbol: string; // e.g. '$', '€', '£'
  theme: 'light' | 'dark' | 'auto';
}

// ----- Database class -----

export class AppDB extends Dexie {
  experiments!: Table<Experiment>;
  metrics!: Table<Metric>;
  results!: Table<ExperimentResult>;
  columnMappings!: Table<ColumnMapping>;
  annotations!: Table<Annotation>;
  settings!: Table<AppSettings>;

  constructor() {
    super('ab-tool-db');
    this.version(1).stores({
      experiments: 'id, status, createdAt',
      metrics: 'id, type, createdAt',
      results: 'id, experimentId, computedAt',
      columnMappings: 'id, experimentId',
      annotations: '++id, experimentId, resultId, createdAt',
      settings: 'id',
    });
  }
}
