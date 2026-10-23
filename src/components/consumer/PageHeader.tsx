import React, { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, WifiOffIcon } from 'lucide-react';
import { Logo } from '../Logo';
import { usePwa } from '../../contexts/PwaContext';
import { useUser } from '../../contexts/UserContext';

interface PageHeaderProps {
  title?: string;
  back?: boolean | string;
  actions?: ReactNode;
  brand?: boolean;
}

export function PageHeader({ title, back, actions, brand }: PageHeaderProps) {
  const navigate = useNavigate();
  const { online } = usePwa();
  const { queue } = useUser();
  const waiting = queue.filter((t) => t.status === 'waiting').length;

  const goBack = () => {
    if (typeof back === 'string') navigate(back);else
    if (window.history.state && window.history.state.idx > 0) navigate(-1);else
    navigate('/');
  };

  return (
    <header className="sticky top-0 z-30 bg-canvas/95 pt-safe backdrop-blur-md lg:static lg:bg-transparent lg:backdrop-blur-none">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-1 px-4 lg:h-20 lg:px-10">
        {back &&
        <button
          type="button"
          onClick={goBack}
          aria-label="Back"
          className="-ml-2 grid h-11 w-11 shrink-0 place-items-center rounded-full text-ink transition-colors hover:bg-ink/5 active:bg-ink/10">
          
            <ArrowLeftIcon className="h-5 w-5" />
          </button>
        }
        {brand ?
        <Logo height={26} className="lg:hidden" /> :
        title ?
        <h1 className="truncate text-lg font-semibold text-ink lg:text-2xl">{title}</h1> :
        null}
        <div className="ml-auto flex items-center gap-1">{actions}</div>
      </div>
      {!online &&
      <div className="mx-auto w-full max-w-6xl px-4 pb-2 lg:px-10">
          <p role="status" className="flex items-center gap-2 rounded-xl bg-caution-soft px-3 py-2 text-sm text-caution">
            <WifiOffIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>
              You’re offline. Saved results still work{waiting > 0 ? ` · ${waiting} check${waiting > 1 ? 's' : ''} waiting` : ''}.
            </span>
          </p>
        </div>
      }
    </header>);

}