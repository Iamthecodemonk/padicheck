import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { RotateCcwIcon } from 'lucide-react';
import { Switch } from '../../components/Switch';
import { AdminPageHeader } from '../../components/admin/AdminPageHeader';
import { LockedNotice } from '../../components/admin/LockedNotice';
import { ReasonSheet } from '../../components/admin/trust/ReasonSheet';
import { useAdminSession } from '../../contexts/AdminSessionContext';
import { useTrust } from '../../contexts/TrustContext';
import { factorDescriptions, factorLabels } from '../../data/entityTypes';
import { formatWhen } from '../../utils/checks';
import { primaryButton, secondaryButton } from '../../utils/formStyles';
import type { FactorKey, ScoreConfig } from '../../types/trust';

const nextVersion = (v: string) => {
  const [major, minor] = v.split('.').map(Number);
  return `${major}.${(minor || 0) + 1}`;
};

/** Changes to scoring are versioned and require a reason; users only ever see plain-language explanations. */
export function AdminTrustScores() {
  const { scoreConfig, saveScoreConfig, entities } = useTrust();
  const { permissions, log, session } = useAdminSession();
  const canEdit = permissions.manageScoring;
  const [draft, setDraft] = useState<ScoreConfig>(scoreConfig);
  const [confirming, setConfirming] = useState(false);
  useEffect(() => setDraft(scoreConfig), [scoreConfig]);

  const total = Object.values(draft.weights).reduce((a, b) => a + b, 0);
  const sortedBands = [...draft.bands].sort((a, b) => b.min - a.min);
  const bandsValid = sortedBands.every((b, i) => i === 0 || b.min < sortedBands[i - 1].min) && sortedBands[sortedBands.length - 1]?.min === 0;
  const dirty = JSON.stringify(draft) !== JSON.stringify(scoreConfig);
  const valid = total === 100 && bandsValid;

  const distribution = sortedBands.map((b, i) => {
    const upper = i === 0 ? 101 : sortedBands[i - 1].min;
    return { label: b.label, count: entities.filter((e) => e.score >= b.min && e.score < upper).length };
  });
  const maxCount = Math.max(1, ...distribution.map((d) => d.count));

  const summary = () => {
    const changes: string[] = [];
    (Object.keys(draft.weights) as FactorKey[]).forEach((k) => {
      if (draft.weights[k] !== scoreConfig.weights[k]) changes.push(`${factorLabels[k]} ${scoreConfig.weights[k]} → ${draft.weights[k]}`);
    });
    draft.bands.forEach((b, i) => {
      if (b.min !== scoreConfig.bands[i]?.min) changes.push(`${b.label} from ${scoreConfig.bands[i]?.min} → ${b.min}`);
    });
    draft.rules.forEach((r, i) => {
      if (r.enabled !== scoreConfig.rules[i]?.enabled) changes.push(`${r.enabled ? 'Enabled' : 'Disabled'} “${r.text}”`);
    });
    if (draft.minConfidenceEvidence !== scoreConfig.minConfidenceEvidence) changes.push(`High-confidence evidence ${scoreConfig.minConfidenceEvidence} → ${draft.minConfidenceEvidence}`);
    return changes.join(', ') || 'No changes';
  };

  return (
    <>
      <AdminPageHeader
        title="Trust Scores"
        subtitle={`Scoring version ${scoreConfig.version}`}
        actions={
        canEdit && dirty ?
        <>
              <button type="button" onClick={() => setDraft(scoreConfig)} className={`${secondaryButton} h-11 px-4`}>
                <RotateCcwIcon className="h-4 w-4" aria-hidden="true" /> Discard
              </button>
              <button type="button" disabled={!valid} onClick={() => setConfirming(true)} className={`${primaryButton} h-11 px-4`}>
                Publish v{nextVersion(scoreConfig.version)}
              </button>
            </> :
        undefined
        } />
      
      <div className="grid gap-5 px-4 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          {!canEdit && <LockedNotice text="Only admins with “Manage Trust Score” can change scoring." />}

          <section aria-labelledby="weights-h" className="rounded-3xl bg-surface p-5 md:p-6">
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="weights-h" className="text-lg font-semibold text-ink">
                Category weights
              </h2>
              <span className={`text-sm font-semibold ${total === 100 ? 'text-brand-dark' : 'text-danger'}`} aria-live="polite">
                Total {total} / 100
              </span>
            </div>
            <ul className="mt-4 space-y-4">
              {(Object.keys(draft.weights) as FactorKey[]).map((k) =>
              <li key={k} className="grid gap-2 sm:grid-cols-[180px_minmax(0,1fr)_48px] sm:items-center">
                  <label htmlFor={`w-${k}`} className="min-w-0">
                    <span className="block font-medium text-ink">{factorLabels[k]}</span>
                    <span className="block text-xs text-muted">{factorDescriptions[k]}</span>
                  </label>
                  <input
                  id={`w-${k}`}
                  type="range"
                  min={0}
                  max={40}
                  value={draft.weights[k]}
                  disabled={!canEdit}
                  onChange={(e) => setDraft((d) => ({ ...d, weights: { ...d.weights, [k]: Number(e.target.value) } }))}
                  className="w-full accent-[rgb(var(--brand))]" />
                
                  <span className="text-right font-semibold tabular-nums text-ink">{draft.weights[k]}</span>
                </li>
              )}
            </ul>
            {total !== 100 && <p className="mt-4 text-sm text-danger">Weights must add up to exactly 100 before you can publish.</p>}
          </section>

          <section aria-labelledby="bands-h" className="rounded-3xl bg-surface p-5 md:p-6">
            <h2 id="bands-h" className="text-lg font-semibold text-ink">
              Score bands
            </h2>
            <p className="text-sm text-muted">The lowest score in each band. The bottom band must start at 0.</p>
            <ul className="mt-4 divide-y divide-line">
              {draft.bands.map((b, i) =>
              <li key={b.label} className="flex items-center gap-3 py-3">
                  <span className="flex-1 font-medium text-ink">{b.label}</span>
                  <label className="flex items-center gap-2 text-sm text-muted">
                    From
                    <input
                    type="number"
                    min={0}
                    max={99}
                    value={b.min}
                    disabled={!canEdit}
                    onChange={(e) => setDraft((d) => ({ ...d, bands: d.bands.map((x, j) => j === i ? { ...x, min: Math.max(0, Math.min(99, Number(e.target.value))) } : x) }))}
                    className="h-11 w-20 rounded-xl bg-canvas px-3 text-right text-ink ring-1 ring-line focus:ring-2 focus:ring-brand"
                    aria-label={`${b.label} minimum score`} />
                  
                  </label>
                </li>
              )}
            </ul>
            {!bandsValid && <p className="text-sm text-danger">Bands must not overlap and the lowest must start at 0.</p>}
          </section>

          <section aria-labelledby="rules-h" className="rounded-3xl bg-surface p-5 md:p-6">
            <h2 id="rules-h" className="text-lg font-semibold text-ink">
              Risk rules
            </h2>
            <ul className="mt-3 divide-y divide-line">
              {draft.rules.map((r, i) =>
              <li key={r.id} className="flex items-center gap-3 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-ink">{r.text}</span>
                    <span className="block text-sm text-muted">{r.effect}</span>
                  </span>
                  <Switch checked={r.enabled} disabled={!canEdit} onChange={(on) => setDraft((d) => ({ ...d, rules: d.rules.map((x, j) => j === i ? { ...x, enabled: on } : x) }))} label={r.text} />
                </li>
              )}
            </ul>
            <label className="mt-3 flex items-center gap-3 border-t border-line pt-4">
              <span className="flex-1">
                <span className="block font-medium text-ink">High confidence needs</span>
                <span className="block text-sm text-muted">Independent pieces of evidence before a score is shown as “High confidence”</span>
              </span>
              <input
                type="number"
                min={1}
                max={10}
                value={draft.minConfidenceEvidence}
                disabled={!canEdit}
                onChange={(e) => setDraft((d) => ({ ...d, minConfidenceEvidence: Math.max(1, Math.min(10, Number(e.target.value))) }))}
                className="h-11 w-20 rounded-xl bg-canvas px-3 text-right text-ink ring-1 ring-line" />
              
            </label>
          </section>
        </div>

        <aside className="space-y-5">
          <section aria-labelledby="dist-h" className="rounded-3xl bg-surface p-5">
            <h2 id="dist-h" className="text-sm font-medium text-muted">
              Score distribution · {entities.length} entities
            </h2>
            <ul className="mt-3 space-y-2.5">
              {distribution.map((d) =>
              <li key={d.label}>
                  <div className="flex justify-between text-sm">
                    <span className="text-ink">{d.label}</span>
                    <span className="font-semibold tabular-nums text-ink">{d.count}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-canvas">
                    <div className="h-full rounded-full bg-brand" style={{ width: `${d.count / maxCount * 100}%` }} />
                  </div>
                </li>
              )}
            </ul>
          </section>
          <section aria-labelledby="ver-h" className="rounded-3xl bg-surface p-5">
            <h2 id="ver-h" className="text-sm font-medium text-muted">
              Version history
            </h2>
            <ol className="mt-3 space-y-4">
              {scoreConfig.history.map((h) =>
              <li key={h.version + h.at}>
                  <p className="font-semibold text-ink">
                    v{h.version} <span className="font-normal text-muted">· {h.by} · {formatWhen(h.at)}</span>
                  </p>
                  <p className="text-sm text-ink-soft">{h.summary}</p>
                  <p className="text-sm text-muted">Reason: {h.reason}</p>
                </li>
              )}
            </ol>
          </section>
          <p className="text-xs text-muted">Users see only plain-language explanations. Exact weights and rules are never shown publicly so scores can’t be gamed.</p>
        </aside>
      </div>

      <ReasonSheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={`Publish scoring v${nextVersion(scoreConfig.version)}`}
        description={summary()}
        confirmLabel="Publish new version"
        label="Why are you making this change?"
        minLength={15}
        onConfirm={(reason) => {
          const version = nextVersion(scoreConfig.version);
          const s = summary();
          saveScoreConfig({ ...draft, version, history: [{ version, by: session?.name ?? 'Admin', at: new Date().toISOString(), reason, summary: s }, ...scoreConfig.history] });
          log('trust', `Published scoring v${version}`, `${s} — ${reason}`);
          setConfirming(false);
          toast.success(`Scoring v${version} is live`);
        }} />
      
    </>);

}