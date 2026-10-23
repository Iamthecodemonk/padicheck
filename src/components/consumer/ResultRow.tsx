import React from 'react';
import { Link } from 'react-router-dom';
import { CloudOffIcon } from 'lucide-react';
import { VerdictBadge } from './VerdictBadge';
import { usePwa } from '../../contexts/PwaContext';
import { formatWhen, getCheckType } from '../../utils/checks';
import type { AnalysisResult } from '../../types/check';

export function ResultRow({ result }: {result: AnalysisResult;}) {
  const { online } = usePwa();
  const type = getCheckType(result.type);
  const unavailable = !online && !result.availableOffline;

  return (
    <li>
      <Link
        to={`/result/${result.id}`}
        className={`flex min-h-[76px] items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas/70 active:bg-canvas ${unavailable ? 'opacity-60' : ''}`}>
        
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${type.tile}`}>
          <type.icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-semibold text-ink">{result.title}</span>
          <span className="mt-0.5 flex items-center gap-1.5 truncate text-sm text-muted">
            {unavailable ?
            <>
                <CloudOffIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> Needs connection
              </> :

            <>
                {type.label} · {formatWhen(result.createdAt)}
              </>
            }
          </span>
        </span>
        <VerdictBadge verdict={result.verdict} />
      </Link>
    </li>);

}