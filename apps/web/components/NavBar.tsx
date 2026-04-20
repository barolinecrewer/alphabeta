'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEngineStatusStore } from '@/lib/store/engineStatusStore';
import { useSettingsStore } from '@/lib/store/settingsStore';

export function NavBar() {
  const pathname = usePathname();
  const engineStatus = useEngineStatusStore((s) => s.status);
  const theme = useSettingsStore((s) => s.theme);
  const updateSetting = useSettingsStore((s) => s.updateSetting);

  const links = [
    { href: '/', label: 'Experiments' },
    { href: '/metrics', label: 'Metrics' },
    { href: '/tools', label: 'Tools' },
    { href: '/settings', label: 'Settings' },
  ];

  function isActive(href: string) {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  }

  const statusBadge: Record<string, { className: string; label: string }> = {
    uninitialised: { className: 'bg-secondary', label: 'Stats Engine: Idle' },
    loading: { className: 'bg-warning text-dark', label: 'Stats Engine: Loading…' },
    ready: { className: 'bg-success', label: 'Stats Engine: Ready' },
    error: { className: 'bg-danger', label: 'Stats Engine: Error' },
  };

  const badge = statusBadge[engineStatus];

  function toggleTheme() {
    const themeOrder = ['light', 'dark', 'auto'] as const;
    const currentIndex = themeOrder.indexOf(theme as 'light' | 'dark' | 'auto');
    const nextIndex = (currentIndex + 1) % themeOrder.length;
    updateSetting('theme', themeOrder[nextIndex]);
  }

  const themeIcon: Record<string, string> = {
    light: '☀️',
    dark: '🌙',
    auto: 'Auto',
  };

  const themeDisplay = themeIcon[theme] || 'Auto';

  return (
    <nav className="navbar navbar-expand navbar-dark bg-dark">
      <div className="container" style={{ maxWidth: '80rem' }}>
        <Link href="/" className="navbar-brand fw-bold">
          {process.env.NEXT_PUBLIC_APP_TITLE || '⍺lphaβeta'}
        </Link>
        <ul className="navbar-nav me-auto">
          {links.map((link) => (
            <li key={link.href} className="nav-item">
              <Link
                href={link.href}
                className={`nav-link ${isActive(link.href) ? 'active' : ''}`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="d-flex align-items-center gap-2">
          {badge && (
            <span className={`badge ${badge.className}`}>{badge.label}</span>
          )}
          <button
            className="btn btn-outline-light btn-sm"
            onClick={toggleTheme}
            title="Toggle theme"
            style={{ whiteSpace: 'nowrap' }}
          >
            {themeDisplay}
          </button>
        </div>
      </div>
    </nav>
  );
}
