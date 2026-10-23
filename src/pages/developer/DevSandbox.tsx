import React, { useState } from 'react';
import { LoaderCircleIcon, PlayIcon } from 'lucide-react';
import { useTrust } from '../../contexts/TrustContext';
import { apiEndpoints } from '../../data/developer';
import { track } from '../../utils/analytics';
import { chipClass } from '../../utils/formStyles';

export function DevSandbox() {
  const { apiKeys, logRequest } = useTrust();
  const sandboxKeys = apiKeys.filter((k) => k.env === 'sandbox' && !k.revoked);
  const [epId, setEpId] = useState(apiEndpoints[0].id);
  const ep = apiEndpoints.find((e) => e.id === epId)!;
  const [body, setBody] = useState(ep.body);
  const [keyId, setKeyId] = useState(sandboxKeys[0]?.id ?? '');
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<{status: number;ms: number;body: string;} | null>(null);

  const send = async () => {
    setBusy(true);
    setRes(null);
    const started = performance.now();
    await new Promise((r) => window.setTimeout(r, 450));
    let status = 200;
    let out = ep.response;
    if (!keyId) {
      status = 401;
      out = '{\n  "error": { "code": "unauthorized", "message": "Create a sandbox API key first." }\n}';
    } else if (ep.body) {
      try {
        const parsed = JSON.parse(body) as Record<string, unknown>;
        if (Object.keys(parsed).length === 0) throw new Error('empty');
      } catch {
        status = 400;
        out = '{\n  "error": { "code": "invalid_request", "message": "Body must be valid JSON with the required fields." }\n}';
      }
    }
    const ms = Math.round(performance.now() - started);
    setRes({ status, ms, body: out });
    logRequest({ method: ep.method, path: ep.path, status, ms });
    track('api_request', { endpoint: ep.id, status });
    setBusy(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section aria-label="Request" className="rounded-3xl bg-surface p-5">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5">
          {apiEndpoints.map((e) =>
          <button
            key={e.id}
            type="button"
            aria-pressed={epId === e.id}
            onClick={() => {
              setEpId(e.id);
              setBody(e.body);
              setRes(null);
            }}
            className={chipClass(epId === e.id)}>
            
              {e.path.replace('/v1/', '')}
            </button>
          )}
        </div>
        <p className="mt-4 font-mono text-sm text-ink">
          <span className="font-bold text-brand-dark">{ep.method}</span> {ep.path}
        </p>
        <label className="mt-4 block text-sm font-medium text-ink" htmlFor="sandbox-key">
          Sandbox key
        </label>
        <select id="sandbox-key" value={keyId} onChange={(e) => setKeyId(e.target.value)} className="mt-1.5 h-12 w-full rounded-2xl bg-canvas px-3 text-ink ring-1 ring-line">
          <option value="">No key (see a 401)</option>
          {sandboxKeys.map((k) =>
          <option key={k.id} value={k.id}>
              {k.name} · {k.prefix}
            </option>
          )}
        </select>
        {ep.body &&
        <>
            <label htmlFor="sandbox-body" className="mt-4 block text-sm font-medium text-ink">
              Body (JSON)
            </label>
            <textarea id="sandbox-body" rows={7} value={body} onChange={(e) => setBody(e.target.value)} spellCheck={false} className="mt-1.5 block w-full rounded-2xl bg-canvas p-4 font-mono text-sm text-ink outline-none ring-1 ring-line focus:ring-2 focus:ring-brand" />
          </>
        }
        <button type="button" onClick={send} disabled={busy} className="mt-4 inline-flex h-12 items-center gap-2 rounded-2xl bg-brand px-5 font-semibold text-white disabled:opacity-60">
          {busy ? <LoaderCircleIcon className="h-5 w-5 animate-spin" aria-hidden="true" /> : <PlayIcon className="h-5 w-5" aria-hidden="true" />} Send request
        </button>
      </section>
      <section aria-label="Response" aria-live="polite" className="rounded-3xl bg-navy p-5 text-white">
        {res ?
        <>
            <p className="text-sm">
              <span className={`rounded-full px-2.5 py-1 font-semibold ${res.status < 300 ? 'bg-brand text-white' : 'bg-danger text-white'}`}>{res.status}</span>
              <span className="ml-2 text-navy-text">{res.ms} ms · sandbox data</span>
            </p>
            <pre className="mt-4 overflow-x-auto text-sm">
              <code>{res.body}</code>
            </pre>
          </> :

        <p className="text-navy-text">Responses appear here. Sandbox requests use sample data and don’t count towards your quota.</p>
        }
      </section>
    </div>);

}