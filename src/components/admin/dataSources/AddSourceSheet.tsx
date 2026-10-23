import React, { useEffect, useState } from 'react';
import { BottomSheet } from '../../BottomSheet';
import { Field } from '../Field';
import { chipClass, inputClass, primaryButton } from '../../../utils/formStyles';
import type { DataSource } from '../../../types/admin';

const kinds = ['Government register', 'Company registry', 'Price data', 'Employer data', 'Community reports'];
const frequencies: DataSource['frequency'][] = ['Hourly', 'Daily', 'Weekly'];

interface AddSourceSheetProps {
  open: boolean;
  onClose: () => void;
  onAdd: (data: Pick<DataSource, 'name' | 'kind' | 'coverage' | 'frequency'> & {endpoint: string;}) => void;
}

export function AddSourceSheet({ open, onClose, onAdd }: AddSourceSheetProps) {
  const [name, setName] = useState('');
  const [kind, setKind] = useState(kinds[0]);
  const [coverage, setCoverage] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [frequency, setFrequency] = useState<DataSource['frequency']>('Daily');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (open) {
      setName('');
      setKind(kinds[0]);
      setCoverage('');
      setEndpoint('');
      setFrequency('Daily');
      setTried(false);
    }
  }, [open]);

  const errors = {
    name: name.trim().length < 3 ? 'Enter a name' : '',
    endpoint: !/^https:\/\/\S+\.\S+/.test(endpoint.trim()) ? 'Use a secure https:// address' : ''
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title="Add a data source"
      description="We’ll test the connection and run a first sync before it’s used in checks."
      footer={
      <button
        type="button"
        onClick={() => {
          setTried(true);
          if (errors.name || errors.endpoint) return;
          onAdd({ name: name.trim(), kind, coverage: coverage.trim() || 'All regions', frequency, endpoint: endpoint.trim() });
        }}
        className={`${primaryButton} w-full`}>
        
          Connect source
        </button>
      }>
      
      <div className="space-y-4">
        <Field label="Name" error={tried ? errors.name : undefined}>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Ghana Lands Commission" />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium text-ink">Type</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {kinds.map((k) =>
            <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={chipClass(kind === k)}>
                {k}
              </button>
            )}
          </div>
        </fieldset>
        <Field label="Coverage">
          <input value={coverage} onChange={(e) => setCoverage(e.target.value)} className={inputClass} placeholder="e.g. Ghana" />
        </Field>
        <Field label="Feed address" error={tried ? errors.endpoint : undefined} hint="Credentials are stored in the secrets vault, never in the browser.">
          <input value={endpoint} onChange={(e) => setEndpoint(e.target.value)} inputMode="url" className={inputClass} placeholder="https://" />
        </Field>
        <fieldset>
          <legend className="text-sm font-medium text-ink">Sync</legend>
          <div className="mt-2 flex gap-2">
            {frequencies.map((f) =>
            <button key={f} type="button" aria-pressed={frequency === f} onClick={() => setFrequency(f)} className={chipClass(frequency === f)}>
                {f}
              </button>
            )}
          </div>
        </fieldset>
      </div>
    </BottomSheet>);

}