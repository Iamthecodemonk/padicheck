import React, { Suspense, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { MenuIcon } from 'lucide-react';
import { BottomSheet } from '../BottomSheet';
import { Logo } from '../Logo';
import { PageSkeleton } from '../Skeleton';
import { ThemeToggle } from '../ThemeToggle';
import { useUser } from '../../contexts/UserContext';

const nav = [
{ to: '/directory', label: 'Businesses' },
{ to: '/how-it-works', label: 'How it works' },
{ to: '/pricing', label: 'Pricing' },
{ to: '/for-business', label: 'For business' },
{ to: '/developers/docs', label: 'API' },
{ to: '/help', label: 'Help' }];


const footer = [
{ title: 'Product', links: [['Check Now', '/verify'], ['How it works', '/how-it-works'], ['Pricing', '/pricing'], ['Search', '/search']] },
{ title: 'Business', links: [['Explore businesses', '/directory'], ['List your business', '/directory/register'], ['Get verified', '/for-business'], ['Business portal', '/business'], ['Developers & API', '/developers/docs'], ['Verify a certificate', '/certificate/PC-VB-2026-004812']] },
{ title: 'Company', links: [['About', '/about'], ['Contact', '/contact'], ['Help Centre', '/help']] },
{ title: 'Legal', links: [['Terms', '/legal/terms'], ['Privacy', '/legal/privacy'], ['Cookies', '/legal/cookies'], ['Acceptable use', '/legal/acceptable-use'], ['Verification policy', '/legal/verification-policy'], ['AI disclaimer', '/legal/ai-disclaimer'], ['Report & dispute policy', '/legal/report-dispute-policy'], ['Data processing', '/legal/data-processing']] }];


/** Marketing shell for visitors. Signed-in users see the same pages with an "Open app" shortcut. */
export function PublicLayout() {
  const { session } = useUser();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-[100dvh] w-full bg-canvas">
      <header className="no-print sticky top-0 z-40 border-b border-line bg-canvas/95 pt-safe backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-4 lg:px-10">
          <Link to="/welcome" aria-label="PadiCheck home" className="mr-4">
            <Logo height={28} />
          </Link>
          <nav aria-label="Main" className="hidden flex-1 lg:block">
            <ul className="flex gap-1">
              {nav.map((n) =>
              <li key={n.to}>
                  <NavLink to={n.to} className={({ isActive }) => `inline-flex h-11 items-center rounded-xl px-3 text-[15px] font-medium transition-colors ${isActive ? 'text-brand-dark' : 'text-ink-soft hover:text-ink'}`}>
                    {n.label}
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            {session ?
            <Link to="/" className="hidden h-11 items-center rounded-xl px-3 text-[15px] font-semibold text-ink hover:bg-surface sm:inline-flex">
                Open app
              </Link> :

            <Link to="/signin" className="hidden h-11 items-center rounded-xl px-3 text-[15px] font-semibold text-ink hover:bg-surface sm:inline-flex">
                Log in
              </Link>
            }
            <Link to="/verify" className="inline-flex h-11 items-center rounded-xl bg-brand px-4 text-[15px] font-semibold text-white hover:bg-brand-dark">
              Check Now
            </Link>
            <button type="button" aria-label="Open menu" onClick={() => setMenuOpen(true)} className="grid h-11 w-11 place-items-center rounded-xl text-ink hover:bg-surface lg:hidden">
              <MenuIcon className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      <main>
        <Suspense fallback={<PageSkeleton />}>
          <Outlet />
        </Suspense>
      </main>

      <footer className="no-print mt-16 border-t border-line bg-surface pb-safe">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(4,1fr)] lg:px-10">
          <div>
            <Logo height={28} />
            <p className="mt-3 max-w-xs text-sm text-muted">Check before you trust. Verify people, businesses, websites and opportunities before you buy, pay or engage.</p>
          </div>
          {footer.map((col) =>
          <nav key={col.title} aria-label={col.title}>
              <h2 className="text-sm font-semibold text-ink">{col.title}</h2>
              <ul className="mt-2">
                {col.links.map(([label, to]) =>
              <li key={to}>
                    <Link to={to} className="inline-flex min-h-[40px] items-center text-sm text-muted hover:text-ink">
                      {label}
                    </Link>
                  </li>
              )}
              </ul>
            </nav>
          )}
        </div>
        <p className="mx-auto max-w-6xl px-4 pb-8 text-xs text-muted lg:px-10">© {new Date().getFullYear()} PadiCheck Technologies Ltd. Scores are guidance, not guarantees.</p>
      </footer>

      <BottomSheet open={menuOpen} onClose={() => setMenuOpen(false)} title="Menu">
        <ul className="divide-y divide-line overflow-hidden rounded-2xl ring-1 ring-line">
          {[...nav, { to: '/about', label: 'About' }, { to: '/contact', label: 'Contact' }, session ? { to: '/', label: 'Open app' } : { to: '/signin', label: 'Log in' }, ...(session ? [] : [{ to: '/signup', label: 'Create account' }])].map((n) =>
          <li key={n.to}>
              <Link to={n.to} onClick={() => setMenuOpen(false)} className="flex h-14 items-center px-4 font-medium text-ink hover:bg-canvas">
                {n.label}
              </Link>
            </li>
          )}
        </ul>
      </BottomSheet>
    </div>);

}