'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  AlertCircle,
  XCircle,
  TrendingDown,
  Search,
  Shield,
  Zap,
  DollarSign,
  GitBranch,
  Globe,
  Package,
  CheckCircle,
  Scale,
  Terminal,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { JellyfishIcon } from '@/components/jellyfish-icon';

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface Feature {
  icon: LucideIcon;
  title: string;
  description: string;
}

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const features: Feature[] = [
    {
      icon: Search,
      title: 'Context Analysis',
      description:
        "See exactly what's filling your context window — system prompts, conversation history, tool results.",
    },
    {
      icon: Shield,
      title: '3-Mode Guardrails',
      description:
        'Notify, block, or auto-optimize. You choose how aggressive to be.',
    },
    {
      icon: Zap,
      title: 'Agent Self-Optimization',
      description:
        'MCP server lets agents check their own cost and compress context autonomously.',
    },
    {
      icon: DollarSign,
      title: 'Cost Attribution',
      description:
        'Track costs per agent, per task, per customer. Know exactly who spent what.',
    },
    {
      icon: GitBranch,
      title: 'Trace Trees',
      description:
        'Visualize cost flow through multi-agent hierarchies with full span traces.',
    },
    {
      icon: Globe,
      title: 'Multi-Provider',
      description:
        'Works with OpenAI, Anthropic, LangChain, CrewAI, Vercel AI SDK.',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    try {
      const supabase = createClient();
      const { error: insertError } = await supabase
        .from('waitlist')
        .insert({ email: email.trim(), source: 'website' });

      if (insertError) {
        if (insertError.code === '23505') {
          setSubmitted(true);
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setSubmitted(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <header className="border-b border-zinc-800/50 backdrop-blur-sm bg-zinc-950/80 sticky top-0 z-50">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="flex items-center gap-2 text-xl font-bold">
            <JellyfishIcon size={24} />
            NeuraMeter
          </span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/neuria-dev/neurameter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              <GithubIcon className="h-5 w-5" />
            </a>
            <Link
              href="/dashboard"
              className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              Dashboard &rarr;
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-emerald-950/20 via-zinc-950 to-zinc-950" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/10 via-transparent to-transparent" />
        <div className="relative mx-auto max-w-4xl px-6 py-28 text-center">
          {/* Badge */}
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-zinc-700/50 bg-zinc-900/50 px-4 py-1.5 text-sm text-zinc-400">
            <Scale className="h-3.5 w-3.5 text-emerald-400" />
            Open Source
            <span className="text-zinc-600">·</span>
            MIT License
            <span className="text-zinc-600">·</span>
            <Package className="h-3.5 w-3.5 text-emerald-400" />
            npm
          </div>

          <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl lg:text-7xl">
            Stop wasting tokens on context your agents{' '}
            <span className="bg-gradient-to-r from-emerald-400 to-emerald-300 bg-clip-text text-transparent">
              don&apos;t need.
            </span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-zinc-400 md:text-xl">
            Analyze context efficiency. Set guardrails. Let agents self-optimize.
          </p>

          {/* Stats */}
          <div className="mt-10 flex items-center justify-center gap-8 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">$47/day</p>
              <p className="mt-1 text-zinc-500">avg. savings</p>
            </div>
            <div className="h-8 w-px bg-zinc-800" />
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">62%</p>
              <p className="mt-1 text-zinc-500">context reduced</p>
            </div>
            <div className="h-8 w-px bg-zinc-800" />
            <div className="text-center">
              <p className="text-2xl font-bold text-emerald-400">2 lines</p>
              <p className="mt-1 text-zinc-500">to integrate</p>
            </div>
          </div>

          {/* Waitlist Form */}
          <div className="mx-auto mt-10 max-w-md">
            {submitted ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
                <p className="text-emerald-400 font-medium">
                  Thanks! We&apos;ll be in touch.
                </p>
                <p className="mt-1 text-sm text-zinc-400">
                  We&apos;ll email you when early access is ready.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(''); }}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900/50 px-4 py-3 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 backdrop-blur-sm"
                  required
                />
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-8 py-3 font-semibold text-zinc-950 hover:bg-emerald-400 transition-all hover:shadow-lg hover:shadow-emerald-500/20 whitespace-nowrap"
                >
                  Get Early Access
                </button>
              </form>
            )}
            {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="border-t border-zinc-800/50">
        <div className="mx-auto max-w-4xl px-6 py-16">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-8">
            <div className="flex items-center gap-3 text-sm text-zinc-500">
              <Terminal className="h-4 w-4" />
              <span>Terminal</span>
            </div>
            <pre className="mt-4 text-sm md:text-base">
              <code>
                <span className="text-zinc-500">$</span>{' '}
                <span className="text-emerald-400">npm install</span>{' '}
                <span className="text-zinc-300">@neurameter/core @neurameter/openai</span>
              </code>
            </pre>
            <p className="mt-4 text-sm text-zinc-500">
              2 lines of code to start tracking costs across all your agents.
            </p>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2 rounded-full bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400">
                <Package className="h-3.5 w-3.5 text-emerald-400" />
                8 packages
              </div>
              <div className="flex items-center gap-2 rounded-full bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                54 tests passing
              </div>
              <div className="flex items-center gap-2 rounded-full bg-zinc-800/50 px-3 py-1.5 text-xs text-zinc-400">
                <Scale className="h-3.5 w-3.5 text-emerald-400" />
                MIT License
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-zinc-800/50 bg-zinc-900/30">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">
            Your AI agent was using{' '}
            <span className="text-red-400">95%</span> of its context window.
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <div className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900">
              <div className="inline-flex rounded-lg bg-red-500/10 p-3">
                <AlertCircle className="h-6 w-6 text-red-400" />
              </div>
              <p className="mt-4 font-medium text-zinc-300">
                82% was old conversation history
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Agents re-read everything they already knew. Paying to forget
                nothing.
              </p>
            </div>
            <div className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900">
              <div className="inline-flex rounded-lg bg-red-500/10 p-3">
                <XCircle className="h-6 w-6 text-red-400" />
              </div>
              <p className="mt-4 font-medium text-zinc-300">
                No guardrails to stop it
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Nothing warned you. Nothing stopped it. The bill just kept
                growing.
              </p>
            </div>
            <div className="group rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-zinc-700 hover:bg-zinc-900">
              <div className="inline-flex rounded-lg bg-red-500/10 p-3">
                <TrendingDown className="h-6 w-6 text-red-400" />
              </div>
              <p className="mt-4 font-medium text-zinc-300">
                No way to fix it automatically
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                Existing tools show what happened. None fix it.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="border-t border-zinc-800/50">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold md:text-4xl">
            2 lines of code. Real-time cost attribution.
          </h2>
          <div className="mt-10 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
            <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
              <div className="h-3 w-3 rounded-full bg-zinc-700" />
              <div className="h-3 w-3 rounded-full bg-zinc-700" />
              <div className="h-3 w-3 rounded-full bg-zinc-700" />
              <span className="ml-2 text-xs text-zinc-500">app.ts</span>
            </div>
            <pre className="overflow-x-auto p-6 text-sm leading-relaxed">
              <code className="text-zinc-300">
{`import { NeuraMeter } from '@neurameter/core';
import { withMeter } from '@neurameter/openai';

const meter = new NeuraMeter({ apiKey: 'nm_xxx', projectId: 'proj_xxx' });
const openai = withMeter(new OpenAI(), meter);

// That's it. Costs are now tracked per agent, per task, per customer.
const response = await openai.chat.completions.create({
  model: 'gpt-4o',
  messages: [{ role: 'user', content: 'Hello' }],
}, {
  agentName: 'SupportAgent',
  taskName: 'classify-ticket',
  customerId: 'cust_123',
});`}
              </code>
            </pre>
          </div>

          {/* Trace Tree Example */}
          <div className="mt-10 overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-4 text-sm text-zinc-500">
              Dashboard Trace View
            </p>
            <pre className="text-sm leading-relaxed text-zinc-300">
{`[OrchestratorAgent] ─── $0.082 ─── 3,200ms
  ├── [ClassifierAgent] ─── $0.003 ─── gpt-4o-mini (450 tokens)
  ├── [ResearchAgent]  ─── $0.031 ─── claude-sonnet (2,100 tokens)
  └── [DraftAgent]     ─── $0.048 ─── gpt-4o (3,200 tokens)`}
            </pre>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-zinc-800/50 bg-zinc-900/30">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold md:text-4xl">
            3 layers of context control
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-center text-zinc-400">
            From passive monitoring to active optimization — choose your level of control.
          </p>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="group relative rounded-xl border border-zinc-800 bg-zinc-900/50 p-6 transition-all hover:border-emerald-500/30 hover:bg-zinc-900"
                >
                  <div className="inline-flex rounded-lg bg-emerald-500/10 p-3">
                    <Icon className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm text-zinc-400">{feature.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800/50">
        <div className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-t from-emerald-950/10 via-transparent to-transparent" />
          <div className="relative mx-auto max-w-4xl px-6 py-24 text-center">
            <h2 className="text-3xl font-bold md:text-4xl">
              Stop paying for context your agents don&apos;t need.
            </h2>
            <p className="mt-4 text-zinc-400">
              Free tier includes 10K tracked calls/month. No credit card required.
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/login"
                className="rounded-lg bg-emerald-500 px-10 py-4 text-lg font-semibold text-zinc-950 hover:bg-emerald-400 transition-all hover:shadow-lg hover:shadow-emerald-500/20"
              >
                Get Started Free
              </Link>
              <a
                href="https://github.com/neuria-dev/neurameter"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 rounded-lg border border-zinc-700 px-10 py-4 text-lg font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
              >
                <GithubIcon className="h-5 w-5" />
                View on GitHub
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <JellyfishIcon size={20} />
              <span className="font-bold">NeuraMeter</span>
              <span className="text-zinc-600">by</span>
              <a href="https://neuria.tech" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300 transition-colors">
                NEURIA
              </a>
            </div>
            <div className="flex items-center gap-5">
              <a href="https://github.com/neuria-dev/neurameter" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <GithubIcon className="h-5 w-5" />
              </a>
              <a href="https://x.com/neurameter" target="_blank" rel="noopener noreferrer" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                <TwitterIcon className="h-5 w-5" />
              </a>
              <span className="text-sm text-zinc-600">MIT License</span>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-zinc-700 md:text-left">
            &copy; {new Date().getFullYear()} NEURIA Inc. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
