import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { usePageMeta } from '../../hooks/usePageMeta';
import { apiEndpoints } from '../../data/developer';

const errors = [
['400', 'invalid_request', 'A required field is missing or malformed.'],
['401', 'unauthorized', 'The API key is missing, wrong or revoked.'],
['403', 'forbidden', 'Your plan or key environment can’t use this endpoint.'],
['404', 'not_found', 'No entity matched. This is not proof the entity is safe.'],
['422', 'unprocessable', 'The input was understood but couldn’t be checked (e.g. invalid phone).'],
['429', 'rate_limited', 'Too many requests. Respect the Retry-After header.'],
['503', 'unavailable', 'A data source is temporarily down. Retry with backoff.']];


/** Public API reference. */
export function DevDocs() {
  usePageMeta({ title: 'PadiCheck API documentation', description: 'Verify businesses, phones, URLs and listings and fetch risk scores via the PadiCheck API.' });
  const [active, setActive] = useState(apiEndpoints[0].id);
  const ep = apiEndpoints.find((e) => e.id === active)!;

  return (
    <div className="mx-auto max-w-6xl px-0 pt-2 lg:grid lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
      <nav aria-label="Endpoints" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-1 lg:px-0">
        {apiEndpoints.map((e) =>
        <button key={e.id} type="button" aria-current={active === e.id} onClick={() => setActive(e.id)} className={`flex h-11 shrink-0 items-center gap-2 rounded-xl px-3 text-left text-sm font-medium lg:w-full ${active === e.id ? 'bg-brand-soft text-brand-dark' : 'text-ink-soft hover:bg-surface'}`}>
            <span className="font-mono text-xs">{e.method}</span>
            <span className="whitespace-nowrap">{e.path.replace('/v1', '')}</span>
          </button>
        )}
      </nav>
      <article className="mt-4 min-w-0 lg:mt-0">
        <h1 className="text-3xl font-bold text-ink">{ep.title}</h1>
        <p className="mt-2 text-ink-soft">{ep.description}</p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-xl bg-surface px-3 py-2 font-mono text-sm text-ink">
          <span className="font-bold text-brand-dark">{ep.method}</span> https://api.padicheck.com{ep.path}
        </p>
        <h2 className="mt-8 font-semibold text-ink">Authentication</h2>
        <pre className="mt-2 overflow-x-auto rounded-2xl bg-navy p-4 text-sm text-white">
          <code>{`curl https://api.padicheck.com${ep.path} \\\n  -H "Authorization: Bearer pc_test_..." \\\n  -H "Content-Type: application/json"${ep.body ? ` \\\n  -d '${ep.body.replace(/\n\s*/g, ' ')}'` : ''}`}</code>
        </pre>
        {ep.body &&
        <>
            <h2 className="mt-8 font-semibold text-ink">Request body</h2>
            <pre className="mt-2 overflow-x-auto rounded-2xl bg-surface p-4 text-sm text-ink">
              <code>{ep.body}</code>
            </pre>
          </>
        }
        <h2 className="mt-8 font-semibold text-ink">Response · 200</h2>
        <pre className="mt-2 overflow-x-auto rounded-2xl bg-surface p-4 text-sm text-ink">
          <code>{ep.response}</code>
        </pre>
        <p className="mt-3 text-sm text-muted">Signals include a <code className="font-mono">type</code> of <code className="font-mono">verified</code>, <code className="font-mono">user_reports</code> or <code className="font-mono">ai_risk</code>. Never show AI signals to your users as confirmed facts.</p>

        <h2 className="mt-10 font-semibold text-ink">Errors</h2>
        <div className="mt-2 overflow-x-auto rounded-2xl bg-surface">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium">Code</th>
                <th scope="col" className="px-4 py-3 font-medium">Meaning</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {errors.map(([s, c, m]) =>
              <tr key={s}>
                  <td className="px-4 py-3 font-mono text-ink">{s}</td>
                  <td className="px-4 py-3 font-mono text-ink">{c}</td>
                  <td className="px-4 py-3 text-ink-soft">{m}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-sm text-muted">
          Rate limits are per key. Responses include <code className="font-mono">X-RateLimit-Remaining</code>. Ready to try?{' '}
          <Link to="/developers/sandbox" className="font-semibold text-brand-dark">
            Open the sandbox
          </Link>
        </p>
      </article>
    </div>);

}