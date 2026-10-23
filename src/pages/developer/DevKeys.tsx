import React, { useState } from 'react';
import { toast } from 'sonner';
import { CopyIcon, KeyRoundIcon, PlusIcon, TriangleAlertIcon } from 'lucide-react';
import { BottomSheet } from '../../components/BottomSheet';
import { ConfirmSheet } from '../../components/ConfirmSheet';
import { Field } from '../../components/admin/Field';
import { StateView } from '../../components/trust/StateView';
import { useTrust } from '../../contexts/TrustContext';
import { formatWhen } from '../../utils/checks';
import { chipClass, inputClass, primaryButton } from '../../utils/formStyles';
import type { ApiKey } from '../../types/trust';

const randomPart = (n: number) => Array.from({ length: n }, () => 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 56)]).join('');

export function DevKeys() {
  const { apiKeys, saveApiKey, myBusiness } = useTrust();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [env, setEnv] = useState<ApiKey['env']>('sandbox');
  const [secret, setSecret] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApiKey | null>(null);
  const liveAllowed = myBusiness.verification === 'verified';

  const create = () => {
    if (name.trim().length < 2) return;
    if (env === 'live' && !liveAllowed) return;
    const prefix = `pc_${env === 'live' ? 'live' : 'test'}_${randomPart(4)}`;
    saveApiKey({ id: `key-${Date.now()}`, name: name.trim(), prefix, env, createdAt: new Date().toISOString() });
    setSecret(`${prefix}${randomPart(28)}`);
    setName('');
  };

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted">Keys are shown once. Store them in your server’s secrets, never in an app or website.</p>
        <button type="button" onClick={() => setCreateOpen(true)} className={`${primaryButton} h-11 shrink-0 px-4`}>
          <PlusIcon className="h-4 w-4" aria-hidden="true" /> New key
        </button>
      </div>
      {apiKeys.length === 0 ?
      <StateView kind="empty" className="mt-4" title="No API keys yet" /> :

      <ul className="mt-4 divide-y divide-line overflow-hidden rounded-3xl bg-surface">
          {apiKeys.map((k) =>
        <li key={k.id} className={`flex flex-wrap items-center gap-3 px-5 py-4 ${k.revoked ? 'opacity-60' : ''}`}>
              <KeyRoundIcon className="h-5 w-5 text-muted" aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className="block font-medium text-ink">{k.name}</span>
                <span className="block font-mono text-sm text-muted">{k.prefix}••••••••</span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${k.env === 'live' ? 'bg-brand-soft text-brand-dark' : 'bg-amber-soft text-amber'}`}>{k.env === 'live' ? 'Live' : 'Sandbox'}</span>
              <span className="w-full text-sm text-muted sm:w-40">{k.revoked ? 'Revoked' : k.lastUsed ? `Used ${formatWhen(k.lastUsed)}` : 'Never used'}</span>
              {!k.revoked &&
          <button type="button" onClick={() => setRevoking(k)} className="h-11 rounded-xl px-3 text-sm font-semibold text-danger hover:bg-danger-soft">
                  Revoke
                </button>
          }
            </li>
        )}
        </ul>
      }

      <BottomSheet
        open={createOpen}
        onClose={() => {
          setCreateOpen(false);
          setSecret(null);
        }}
        title={secret ? 'Copy your key now' : 'Create an API key'}
        description={secret ? 'For your security we won’t show this again.' : undefined}
        footer={
        secret ?
        <button
          type="button"
          onClick={() => {
            setCreateOpen(false);
            setSecret(null);
          }}
          className={`${primaryButton} w-full`}>
          
              I’ve stored it safely
            </button> :

        <button type="button" onClick={create} disabled={name.trim().length < 2 || env === 'live' && !liveAllowed} className={`${primaryButton} w-full`}>
              Create key
            </button>

        }>
        
        {secret ?
        <div>
            <code className="block break-all rounded-2xl bg-canvas p-4 font-mono text-sm text-ink">{secret}</code>
            <button
            type="button"
            onClick={async () => {
              await navigator.clipboard?.writeText(secret);
              toast.success('Key copied');
            }}
            className="mt-3 inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-brand-dark ring-1 ring-line">
            
              <CopyIcon className="h-4 w-4" aria-hidden="true" /> Copy
            </button>
          </div> :

        <div className="space-y-4">
            <Field label="Name" hint="So you know where it’s used, e.g. “Checkout server”">
              <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
            </Field>
            <fieldset>
              <legend className="text-sm font-medium text-ink">Environment</legend>
              <div className="mt-2 flex gap-2">
                <button type="button" aria-pressed={env === 'sandbox'} onClick={() => setEnv('sandbox')} className={chipClass(env === 'sandbox')}>
                  Sandbox
                </button>
                <button type="button" aria-pressed={env === 'live'} onClick={() => setEnv('live')} className={chipClass(env === 'live')}>
                  Live
                </button>
              </div>
            </fieldset>
            {env === 'live' && !liveAllowed &&
          <p className="flex gap-2 rounded-2xl bg-caution-soft p-3 text-sm text-caution">
                <TriangleAlertIcon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> Live keys need a verified business. Use sandbox keys until verification is approved.
              </p>
          }
          </div>
        }
      </BottomSheet>
      <ConfirmSheet
        open={revoking !== null}
        onClose={() => setRevoking(null)}
        onConfirm={() => {
          if (revoking) saveApiKey({ ...revoking, revoked: true });
          toast(`${revoking?.name} revoked`);
          setRevoking(null);
        }}
        title={`Revoke “${revoking?.name}”?`}
        description="Requests using this key will fail immediately with 401 Unauthorized. This can’t be undone."
        confirmLabel="Revoke key"
        tone="danger" />
      
    </div>);

}