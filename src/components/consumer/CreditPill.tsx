import React from 'react';
import { Link } from 'react-router-dom';
import { CoinsIcon } from 'lucide-react';
import { useUser } from '../../contexts/UserContext';

export function CreditPill() {
  const { credits } = useUser();
  return (
    <Link
      to="/credits"
      aria-label={`${credits} credits`}
      className={`inline-flex h-11 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition-colors lg:hidden ${
      credits < 5 ? 'bg-caution-soft text-caution' : 'bg-amber-soft text-amber hover:opacity-90'}`
      }>
      
      <CoinsIcon className="h-4 w-4" aria-hidden="true" />
      {credits}
    </Link>);

}