'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  getExperiments,
  updateExperiment,
  type Experiment,
} from '@/lib/db';
import {
  PowerCalculator,
  type PowerCalculatorState,
} from '@/components/PowerCalculator';
import {
  POWER_CALC_PREFILL_KEY,
  appendPowerCalculatorSummary,
  type PowerCalculatorSnapshot,
} from '@/lib/tools/powerCalculatorSummary';

export default function PowerCalculatorToolPage() {
  const router = useRouter();
  const [calculatorState, setCalculatorState] = useState<PowerCalculatorState | null>(null);
  const [drafts, setDrafts] = useState<Experiment[]>([]);
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const handleCalculatorChange = useCallback((state: PowerCalculatorState) => {
    setCalculatorState(state);
    setSaveMessage(null);
  }, []);

  useEffect(() => {
    getExperiments({ status: 'draft' }).then((experiments) => {
      setDrafts(experiments);
      setSelectedDraftId(experiments[0]?.id ?? '');
    });
  }, []);

  const snapshot = calculatorState?.result
    ? ({ ...calculatorState, savedAt: Date.now() } satisfies PowerCalculatorSnapshot)
    : null;

  function handleCreateExperiment() {
    if (!snapshot) return;
    sessionStorage.setItem(POWER_CALC_PREFILL_KEY, JSON.stringify(snapshot));
    router.push('/experiments/new');
  }

  async function handleAttachToDraft() {
    if (!snapshot || !selectedDraftId) return;
    const draft = drafts.find((experiment) => experiment.id === selectedDraftId);
    if (!draft) return;

    await updateExperiment(draft.id, {
      description: appendPowerCalculatorSummary(draft.description, snapshot),
    });

    setDrafts((prev) =>
      prev.map((experiment) =>
        experiment.id === draft.id
          ? {
              ...experiment,
              description: appendPowerCalculatorSummary(experiment.description, snapshot),
            }
          : experiment,
      ),
    );
    setSaveMessage(`Added power calculation to ${draft.name}.`);
  }

  return (
    <div className="py-4">
      <div className="mb-3">
        <Link href="/tools" className="text-decoration-none small">
          Tools
        </Link>
      </div>

      <div className="d-flex justify-content-between align-items-start mb-4">
        <div>
          <h1 className="mb-1">Power Calculator</h1>
          <p className="text-muted mb-0">Two-proportion sample size calculator</p>
        </div>
      </div>

      <PowerCalculator onChange={handleCalculatorChange} />

      <section className="card mt-4">
        <div className="card-body">
          <h5 className="card-title">Use This Calculation</h5>

          {!snapshot && (
            <p className="text-muted mb-0">
              Enter valid parameters to save this calculation with an experiment.
            </p>
          )}

          {snapshot && (
            <>
              {saveMessage && (
                <div className="alert alert-success py-2">{saveMessage}</div>
              )}

              <div className="d-flex flex-wrap gap-2 align-items-center mb-3">
                <button className="btn btn-primary" onClick={handleCreateExperiment}>
                  Create Experiment
                </button>
                <span className="text-muted small">
                  Adds the current sample-size estimate to the new experiment description.
                </span>
              </div>

              <div className="row g-2 align-items-end">
                <div className="col-md-6">
                  <label className="form-label">Existing draft experiment</label>
                  <select
                    className="form-select"
                    value={selectedDraftId}
                    onChange={(event) => setSelectedDraftId(event.target.value)}
                    disabled={drafts.length === 0}
                  >
                    {drafts.length === 0 && (
                      <option value="">No draft experiments available</option>
                    )}
                    {drafts.map((experiment) => (
                      <option key={experiment.id} value={experiment.id}>
                        {experiment.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-auto">
                  <button
                    className="btn btn-outline-primary"
                    onClick={handleAttachToDraft}
                    disabled={!selectedDraftId}
                  >
                    Add to Draft
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
