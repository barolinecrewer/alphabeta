'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  getExperiments,
  checkBackupReminder,
  isDatabaseEmpty,
  importData,
  type Experiment,
  type ExportData,
} from '@/lib/db';
import { useSettingsStore } from '@/lib/store/settingsStore';

const STATUS_BADGES: Record<Experiment['status'], string> = {
  draft: 'bg-secondary',
  running: 'bg-primary',
  stopped: 'bg-warning text-dark',
  archived: 'bg-dark',
};

export default function DashboardPage() {
  const [experiments, setExperiments] = useState<Experiment[]>([]);
  const [statusFilter, setStatusFilter] = useState<Experiment['status'] | 'all'>('all');
  const [tagFilter, setTagFilter] = useState<string>('all');
  const [showBackupBanner, setShowBackupBanner] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [loading, setLoading] = useState(true);
  const importFileRef = useRef<HTMLInputElement>(null);
  const loadSettings = useSettingsStore((s) => s.loadFromDB);

  useEffect(() => {
    async function load() {
      await loadSettings();
      const [exps, needsBackup, isEmpty] = await Promise.all([
        getExperiments(
          statusFilter !== 'all' ? { status: statusFilter } : undefined,
        ),
        checkBackupReminder(),
        isDatabaseEmpty(),
      ]);
      setExperiments(exps);
      setShowBackupBanner(needsBackup);
      setEmpty(isEmpty);
      setLoading(false);
    }
    load();
  }, [statusFilter, loadSettings]);

  // Collect unique tags from loaded experiments (respects status filter)
  const allTags = useMemo(
    () => Array.from(new Set(experiments.flatMap((e) => e.tags))).sort(),
    [experiments],
  );

  // Reset tag filter when the selected tag no longer exists in the list
  useEffect(() => {
    if (tagFilter !== 'all' && !allTags.includes(tagFilter)) {
      setTagFilter('all');
    }
  }, [allTags, tagFilter]);

  // Apply tag filter client-side so the dropdown stays populated
  const filteredExperiments = useMemo(
    () =>
      tagFilter === 'all'
        ? experiments
        : experiments.filter((e) => e.tags.includes(tagFilter)),
    [experiments, tagFilter],
  );

  async function handleImportExperiment(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text) as ExportData;
      if (data.version !== 1 || !Array.isArray(data.experiments)) {
        alert('Invalid experiment file. Expected a version 1 export with an experiments array.');
        return;
      }
      const expNames = data.experiments.map((exp) => exp.name).join(', ');
      const details = [
        `${data.experiments.length} experiment${data.experiments.length !== 1 ? 's' : ''}: ${expNames}`,
        `${data.metrics.length} metric${data.metrics.length !== 1 ? 's' : ''}`,
        `${data.results.length} result snapshot${data.results.length !== 1 ? 's' : ''}`,
      ];
      if (!confirm(`Import the following?\n\n${details.join('\n')}\n\nExisting items with matching IDs will be updated.`)) return;
      await importData(data, 'merge');
      window.location.reload();
    } catch {
      alert('Failed to read or parse the selected file.');
    } finally {
      if (importFileRef.current) importFileRef.current.value = '';
    }
  }

  if (loading) {
    return (
      <div className="py-4 text-center">
        <div className="spinner-border" role="status" />
      </div>
    );
  }

  return (
    <div className="py-4">
      {/* Backup reminder */}
      {showBackupBanner && !empty && (
        <div className="alert alert-warning d-flex justify-content-between align-items-center">
          <span>
            It&apos;s been a while since your last backup. Export your data to
            keep it safe.
          </span>
          <Link href="/settings" className="btn btn-sm btn-outline-warning">
            Go to Settings
          </Link>
        </div>
      )}

      {/* Header */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h1 className="mb-0">Experiments</h1>
        <div className="d-flex gap-2">
          <button
            className="btn btn-outline-secondary"
            onClick={() => importFileRef.current?.click()}
          >
            Import Experiment
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json"
            className="d-none"
            onChange={handleImportExperiment}
          />
          <Link href="/experiments/new" className="btn btn-primary">
            Create Experiment
          </Link>
        </div>
      </div>

      {/* Empty state / demo prompt */}
      {empty && <EmptyState />}

      {/* Filter + list */}
      {!empty && (
        <>
          <div className="mb-3 d-flex align-items-center gap-3">
            <div className="btn-group btn-group-sm">
              {(['all', 'draft', 'running', 'stopped', 'archived'] as const).map(
                (s) => (
                  <button
                    key={s}
                    className={`btn ${statusFilter === s ? 'btn-secondary' : 'btn-outline-secondary'}`}
                    onClick={() => setStatusFilter(s)}
                  >
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ),
              )}
            </div>

            {allTags.length > 0 && (
              <select
                className="form-select form-select-sm"
                style={{ width: 'auto' }}
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                aria-label="Filter by tag"
              >
                <option value="all">All tags</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="table-responsive">
            <table className="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Variations</th>
                  <th>Tags</th>
                  <th>Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredExperiments.map((exp) => (
                  <tr key={exp.id}>
                    <td>
                      <Link
                        href={`/experiments/view?id=${exp.id}`}
                        className="text-decoration-none fw-medium"
                      >
                        {exp.name}
                      </Link>
                    </td>
                    <td>
                      <span className={`badge ${STATUS_BADGES[exp.status]}`}>
                        {exp.status}
                      </span>
                    </td>
                    <td>{exp.variations.length}</td>
                    <td>
                      {exp.tags.map((t) => (
                        <span
                          key={t}
                          className="badge bg-body-secondary text-body border me-1"
                        >
                          {t}
                        </span>
                      ))}
                    </td>
                    <td className="text-muted">
                      {new Date(exp.createdAt).toLocaleDateString()}
                    </td>
                    <td>
                      <Link
                        href={`/experiments/view?id=${exp.id}&view=upload`}
                        className="btn btn-sm btn-outline-primary me-1"
                      >
                        Upload
                      </Link>
                    </td>
                  </tr>
                ))}
                {filteredExperiments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center text-muted py-4">
                      No experiments match this filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function EmptyState() {
  const [seeding, setSeeding] = useState(false);

  async function loadDemo() {
    setSeeding(true);
    try {
      const { seedDemoData } = await import('@/lib/db/demo');
      await seedDemoData();
      window.location.reload();
    } catch (err) {
      console.error('Failed to load demo data:', err);
      setSeeding(false);
    }
  }

  return (
    <div className="text-center py-5">
      <h3 className="text-muted mb-3">No experiments yet</h3>
      <p className="text-muted mb-4">
        Create your first experiment or load a demo to explore the tool.
      </p>
      <div className="d-flex justify-content-center gap-3">
        <Link href="/experiments/new" className="btn btn-primary">
          Create Experiment
        </Link>
        <button
          className="btn btn-outline-secondary"
          onClick={loadDemo}
          disabled={seeding}
        >
          {seeding ? 'Loading demo…' : 'Load Demo Experiment'}
        </button>
      </div>
    </div>
  );
}
