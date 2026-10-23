import React, { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BadgeCheckIcon, TrendingDownIcon, TrendingUpIcon } from 'lucide-react';
import { ScoreChip } from './ScoreGauge';
import { entityTypeById } from '../../data/entityTypes';
import { formatWhen } from '../../utils/checks';
import { scoreBand } from '../../utils/trustScore';
import type { TrustEntity } from '../../types/trust';

interface EntityRowProps {
  entity: TrustEntity;
  actions?: ReactNode;
  showChange?: boolean;
}

export function EntityRow({ entity, actions, showChange }: EntityRowProps) {
  const meta = entityTypeById(entity.type);
  const band = scoreBand(entity.score);
  const delta = entity.previousScore !== undefined ? entity.score - entity.previousScore : 0;
  const Icon = meta?.icon;

  return (
    <li className="flex items-center gap-1 pr-2">
      <Link to={`/report/${entity.id}`} className="flex min-h-[76px] min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-canvas/60">
        {Icon &&
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${meta.tile}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        }
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate font-semibold text-ink">{entity.name}</span>
            {entity.verification === 'verified' && <BadgeCheckIcon className="h-4 w-4 shrink-0 text-brand" aria-label="Verified" />}
          </span>
          <span className="block truncate text-sm text-muted">
            {meta?.label} · <span className={band.text}>{band.risk}</span> · {formatWhen(entity.lastChecked)}
          </span>
        </span>
        {showChange && delta !== 0 &&
        <span className={`hidden items-center gap-1 text-sm font-semibold sm:inline-flex ${delta > 0 ? 'text-brand-dark' : 'text-danger'}`}>
            {delta > 0 ? <TrendingUpIcon className="h-4 w-4" aria-hidden="true" /> : <TrendingDownIcon className="h-4 w-4" aria-hidden="true" />}
            {delta > 0 ? `+${delta}` : delta}
          </span>
        }
        <ScoreChip score={entity.score} />
      </Link>
      {actions}
    </li>);

}