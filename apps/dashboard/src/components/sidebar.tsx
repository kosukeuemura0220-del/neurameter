'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { JellyfishIcon } from '@/components/jellyfish-icon';
import {
  BarChart2,
  Bot,
  GitBranch,
  Users,
  Cpu,
  Layers,
  Shield,
  FileText,
  Zap,
  DollarSign,
  Bell,
  Settings,
  Key,
  Users2,
  Server,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';

interface NavSection {
  title?: string;
  items: { href: string; label: string; icon: LucideIcon }[];
}

const navSections: NavSection[] = [
  {
    items: [
      { href: '/dashboard', label: 'Overview', icon: BarChart2 },
      { href: '/dashboard/agents', label: 'Agents', icon: Bot },
      { href: '/dashboard/traces', label: 'Traces', icon: GitBranch },
      { href: '/dashboard/customers', label: 'Customers', icon: Users },
      { href: '/dashboard/models', label: 'Models', icon: Cpu },
    ],
  },
  {
    title: 'Governance',
    items: [
      { href: '/dashboard/context', label: 'Context', icon: Layers },
      { href: '/dashboard/guards', label: 'Guards', icon: Shield },
      { href: '/dashboard/guards/log', label: 'Guard Log', icon: FileText },
      { href: '/dashboard/optimize', label: 'Optimize', icon: Zap },
      { href: '/dashboard/budgets', label: 'Budgets', icon: DollarSign },
      { href: '/dashboard/alerts', label: 'Alerts', icon: Bell },
    ],
  },
  {
    title: 'Settings',
    items: [
      { href: '/settings', label: 'General', icon: Settings },
      { href: '/settings/api-keys', label: 'API Keys', icon: Key },
      { href: '/settings/team', label: 'Team', icon: Users2 },
      { href: '/settings/billing', label: 'Billing', icon: CreditCard },
      { href: '/settings/mcp', label: 'MCP Server', icon: Server },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r bg-card">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-lg font-bold">
          <JellyfishIcon size={24} />
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

                const Icon = item.icon;

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
                    <Icon className="h-4 w-4" />
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
