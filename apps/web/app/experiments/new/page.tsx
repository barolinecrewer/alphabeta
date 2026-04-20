'use client';

/**
 * Experiment Creation Wizard — 5-step form.
 * See requirements.md Section 7.1.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { nanoid } from 'nanoid';
import {
  createExperiment,
  getMetrics,
  type Metric,
  type Variation,
} from '@/lib/db';
import { useSettingsStore } from '@/lib/store/settingsStore';
import { PowerCalculator } from '@/components/PowerCalculator';
import { VariationEditor, variationsValid } from '@/components/VariationEditor';
import { StatsConfigEditor } from '@/components/StatsConfigEditor';
import { MetricPicker } from '@/components/MetricPicker';
import {
  POWER_CALC_PREFILL_KEY,
  appendPowerCalculatorSummary,
  type PowerCalculatorSnapshot,
} from '@/lib/tools/powerCalculatorSummary';

type StatsEngine = 'bayesian' | 'frequentist' | 'sequential';
type Correction = 'none' | 'holm-bonferroni' | 'benjamini-hochberg';

interface WizardState {
  name: string;
  experimentId: string;
  hypothesis: string;
  description: string;
  tags: string;
  variations: Variation[];
  primaryMetricIds: string[];
  guardrailMetricIds: string[];
  activationMetricId: string;
  statsEngine: StatsEngine;
  correction: Correction;
  cuped: boolean;
}

const DEFAULT_VARIATIONS: Variation[] = [
  { id: nanoid(), name: 'Control', key: 'control', weight: 0.5, isControl: true },
  { id: nanoid(), name: 'Variant A', key: 'variant_a', weight: 0.5, isControl: false },
];

export default function NewExperimentPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const defaultEngine = useSettingsStore((s) => s.defaultStatsEngine);

  const [form, setForm] = useState<WizardState>({
    name: '',
    experimentId: '',
    hypothesis: '',
    description: '',
    tags: '',
    variations: DEFAULT_VARIATIONS,
    primaryMetricIds: [],
    guardrailMetricIds: [],
    activationMetricId: '',
    statsEngine: defaultEngine,
    correction: 'none',
    cuped: false,
  });

  useEffect(() => {
    getMetrics().then(setMetrics);
  }, []);

  useEffect(() => {
    const raw = sessionStorage.getItem(POWER_CALC_PREFILL_KEY);
    if (!raw) return;

    try {
      const snapshot = JSON.parse(raw) as PowerCalculatorSnapshot;
      setForm((prev) => {
        return {
          ...prev,
          description: appendPowerCalculatorSummary(prev.description, snapshot),
        };
      });
    } catch {
      // Ignore stale or malformed session data.
    } finally {
      sessionStorage.removeItem(POWER_CALC_PREFILL_KEY);
    }
  }, []);

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return form.name.trim().length > 0;
      case 2:
        return variationsValid(form.variations);
      case 3:
        return form.primaryMetricIds.length >= 1;
      case 4:
        return true;
      default:
        return true;
    }
  }

  async function handleSave(status: 'draft' | 'running') {
    await createExperiment({
      name: form.name,
      experimentId: form.experimentId || undefined,
      hypothesis: form.hypothesis,
      description: form.description || undefined,
      status,
      variations: form.variations,
      primaryMetricIds: form.primaryMetricIds,
      guardrailMetricIds: form.guardrailMetricIds,
      activationMetricId: form.activationMetricId || undefined,
      statsEngine: form.statsEngine,
      multipleComparisonCorrection: form.correction,
      cuped: form.cuped,
      tags: form.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
    });
    router.push('/');
  }

  return (
    <div className="py-4" style={{ maxWidth: '720px', margin: '0 auto' }}>
      <h1 className="mb-4">Create Experiment</h1>

      {/* Step indicator */}
      <div className="d-flex gap-1 mb-4">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`flex-fill text-center py-1 small rounded ${
              s === step
                ? 'bg-primary text-white'
                : s < step
                  ? 'bg-success text-white'
                  : 'bg-body-secondary text-body-secondary'
            }`}
          >
            {['Hypothesis', 'Variations', 'Metrics', 'Stats Config', 'Review'][
              s - 1
            ]}
          </div>
        ))}
      </div>

      {/* Step 1: Hypothesis */}
      {step === 1 && (
        <div>
          <div className="mb-3">
            <label className="form-label">
              Experiment Name <span className="text-danger">*</span>
            </label>
            <input
              className="form-control"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Experiment ID</label>
            <input
              className="form-control"
              value={form.experimentId}
              onChange={(e) => setForm({ ...form, experimentId: e.target.value })}
              placeholder="e.g. exp_001 — matches experiment_id in your CSV"
            />
            <div className="form-text">Optional. The identifier your platform uses for this experiment. Used to filter CSV rows and pre-fill templates.</div>
          </div>
          <div className="mb-3">
            <label className="form-label">Hypothesis</label>
            <textarea
              className="form-control"
              rows={3}
              value={form.hypothesis}
              onChange={(e) => setForm({ ...form, hypothesis: e.target.value })}
              placeholder="Changing X will cause Y because Z…"
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Description</label>
            <textarea
              className="form-control"
              rows={2}
              value={form.description}
              onChange={(e) =>
                setForm({ ...form, description: e.target.value })
              }
            />
          </div>
          <div className="mb-3">
            <label className="form-label">Tags (comma-separated)</label>
            <input
              className="form-control"
              value={form.tags}
              onChange={(e) => setForm({ ...form, tags: e.target.value })}
              placeholder="homepage, cta, q1"
            />
          </div>
        </div>
      )}

      {/* Step 2: Variations */}
      {step === 2 && (
        <VariationEditor
          variations={form.variations}
          onChange={(variations) => setForm({ ...form, variations })}
        />
      )}

      {/* Step 3: Metrics */}
      {step === 3 && (
        <MetricPicker
          metrics={metrics}
          primaryMetricIds={form.primaryMetricIds}
          guardrailMetricIds={form.guardrailMetricIds}
          onPrimaryChange={(ids) => setForm({ ...form, primaryMetricIds: ids })}
          onGuardrailChange={(ids) => setForm({ ...form, guardrailMetricIds: ids })}
          idPrefix="wizard"
        />
      )}

      {/* Step 4: Stats Config */}
      {step === 4 && (
        <StatsConfigEditor
          engine={form.statsEngine}
          correction={form.correction}
          onEngineChange={(statsEngine) => setForm({ ...form, statsEngine })}
          onCorrectionChange={(correction) => setForm({ ...form, correction })}
          verbose
        />
      )}

      {/* Step 5: Review & Launch */}
      {step === 5 && (
        <div>
          <div className="card mb-3">
            <div className="card-body">
              <h5>{form.name}</h5>
              {form.experimentId && (
                <p className="small text-muted mb-1"><strong>Experiment ID:</strong> <code>{form.experimentId}</code></p>
              )}
              {form.hypothesis && (
                <p className="text-muted">{form.hypothesis}</p>
              )}
              <div className="row">
                <div className="col-md-6">
                  <strong>Variations:</strong>
                  <ul className="mb-0">
                    {form.variations.map((v) => (
                      <li key={v.id}>
                        {v.name} ({Math.round(v.weight * 100)}%)
                        {v.isControl && (
                          <span className="badge bg-secondary ms-1">
                            control
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="col-md-6">
                  <strong>Metrics:</strong>
                  <ul className="mb-0">
                    {form.primaryMetricIds.map((id) => {
                      const m = metrics.find((m) => m.id === id);
                      return <li key={id}>{m?.name ?? id}</li>;
                    })}
                  </ul>
                  {form.guardrailMetricIds.length > 0 && (
                    <>
                      <strong>Guardrails:</strong>
                      <ul className="mb-0">
                        {form.guardrailMetricIds.map((id) => {
                          const m = metrics.find((m) => m.id === id);
                          return <li key={id}>{m?.name ?? id}</li>;
                        })}
                      </ul>
                    </>
                  )}
                </div>
              </div>
              <div className="mt-2">
                <span className="badge bg-body-secondary text-body border me-1">
                  {form.statsEngine}
                </span>
                <span className="badge bg-body-secondary text-body border me-1">
                  {form.correction === 'none' ? 'no correction' : form.correction}
                </span>
                {form.cuped && (
                  <span className="badge bg-info-subtle text-info-emphasis me-1">CUPED</span>
                )}
              </div>
            </div>
          </div>

          <PowerCalculator
            defaultSplitRatio={
              form.variations.find((v) => !v.isControl)?.weight ??
              0.5 /
                (form.variations.find((v) => v.isControl)?.weight ?? 0.5)
            }
          />
        </div>
      )}

      {/* Navigation */}
      <div className="d-flex justify-content-between mt-4">
        <button
          className="btn btn-outline-secondary"
          onClick={() => setStep(step - 1)}
          disabled={step === 1}
        >
          Back
        </button>
        <div className="d-flex gap-2">
          {step < 5 ? (
            <button
              className="btn btn-primary"
              onClick={() => setStep(step + 1)}
              disabled={!canProceed()}
            >
              Next
            </button>
          ) : (
            <>
              <button
                className="btn btn-outline-secondary"
                onClick={() => handleSave('draft')}
              >
                Save as Draft
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleSave('running')}
              >
                Launch
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
