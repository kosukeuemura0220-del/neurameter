'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

interface NavSection {
  title?: string;
  items: { href: string; label: string; icon: string }[];
}

const navSections: NavSection[] = [
  {
    items: [
      { href: '/dashboard', label: 'Overview', icon: '📊' },
      { href: '/dashboard/agents', label: 'Agents', icon: '🤖' },
      { href: '/dashboard/traces', label: 'Traces', icon: '🔗' },
      { href: '/dashboard/customers', label: 'Customers', icon: '👥' },
      { href: '/dashboard/models', label: 'Models', icon: '🧠' },
    ],
  },
  {
    title: 'Governance',
    items: [
      { href: '/dashboard/context', label: 'Context', icon: '📐' },
      { href: '/dashboard/guards', label: 'Guards', icon: '🛡️' },
      { href: '/dashboard/guards/log', label: 'Guard Log', icon: '📋' },
      { href: '/dashboard/optimize', label: 'Optimize', icon: '⚡' },
      { href: '/dashboard/budgets', label: 'Budgets', icon: '💰' },
      { href: '/dashboard/alerts', label: 'Alerts', icon: '🔔' },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/settings', label: 'General', icon: '⚙️' },
      { href: '/settings/api-keys', label: 'API Keys', icon: '🔑' },
      { href: '/settings/team', label: 'Team', icon: '👤' },
      { href: '/settings/billing', label: 'Billing', icon: '💳' },
      { href: '/settings/mcp', label: 'MCP Server', icon: '🔌' },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="text-lg font-bold">
          NeuraMeter
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto p-2">
        {navSections.map((section, sIdx) => (
          <div key={sIdx} className={sIdx > 0 ? 'mt-4' : ''}>
            {section.title && (
              <p className="mb-1 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {section.title}
              </p>
            )}
            <div className="space-y-1">
              {section.items.map((item) => {
                const isActive =
                  item.href === '/dashboard'
                    ? pathname === '/dashboard'
                    : item.href === '/settings'
                      ? pathname === '/settings'
                      : pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                    )}
                  >
                    <span>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
