'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

const features = [
  {
    icon: '🔍',
    title: 'Agent Attribution',
    description: 'Track costs per agent, not just per API call. Know exactly which agent burned the money.',
  },
  {
    icon: '🌲',
    title: 'Trace Trees',
    description: 'Visualize cost flow through parent-child agent hierarchies with full span traces.',
  },
  {
    icon: '💰',
    title: 'Customer Costs',
    description: 'Track per-customer AI cost for SaaS companies. Know your true AI cost-per-customer.',
  },
  {
    icon: '🚨',
    title: 'Budget Alerts',
    description: 'Set budget limits per org, agent, or customer. Get alerted before agents overspend.',
  },
  {
    icon: '🛡️',
    title: 'Guard Rails',
    description: 'Context window monitoring, input token limits, and cost-per-call guards with auto-optimization.',
  },
  {
    icon: '🔗',
    title: 'Multi-Provider',
    description: 'Works with OpenAI, Anthropic, and more. LangChain and CrewAI support coming soon.',
  },
];

export default function LandingPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

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
          setSubmitted(true); // Already on waitlist
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
      <header className="border-b border-zinc-800">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <span className="text-xl font-bold">NeuraMeter</span>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/neuria-dev/neurameter"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-zinc-400 hover:text-white transition-colors"
            >
              GitHub
            </a>
            <Link
              href="/login"
              className="rounded-md bg-emerald-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-4xl px-6 py-24 text-center">
        <h1 className="text-5xl font-bold leading-tight tracking-tight md:text-6xl">
          Know what your AI agents{' '}
          <span className="text-emerald-400">actually cost.</span>
        </h1>
        <p className="mt-6 text-xl text-zinc-400">
          Per-agent. Per-task. Per-customer. Open source.
        </p>

        {/* Waitlist Form */}
        <div className="mx-auto mt-10 max-w-md">
          {submitted ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-emerald-400 font-medium">
                You&apos;re on the list! We&apos;ll notify you at launch.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                className="flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-4 py-3 text-white placeholder-zinc-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
              <button
                type="submit"
                className="rounded-md bg-emerald-500 px-6 py-3 font-medium text-zinc-950 hover:bg-emerald-400 transition-colors"
              >
                Get Early Access
              </button>
            </form>
          )}
          {error && <p className="mt-2 text-sm text-red-400">{error}</p>}
        </div>
      </section>

      {/* Problem */}
      <section className="border-t border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold">
            Your AI bill says <span className="text-red-400">$4,800</span>.
            <br />
            But which agent spent it?
          </h2>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            <div className="rounded-lg border border-zinc-800 p-6">
              <p className="text-4xl">?</p>
              <p className="mt-3 font-medium text-zinc-300">No per-agent breakdown</p>
              <p className="mt-2 text-sm text-zinc-500">
                OpenAI dashboard shows total spend. Not which agent burned it.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-6">
              <p className="text-4xl">?</p>
              <p className="mt-3 font-medium text-zinc-300">No per-task attribution</p>
              <p className="mt-2 text-sm text-zinc-500">
                Was it classification? Drafting? Research? No way to tell.
              </p>
            </div>
            <div className="rounded-lg border border-zinc-800 p-6">
              <p className="text-4xl">?</p>
              <p className="mt-3 font-medium text-zinc-300">No per-customer costs</p>
              <p className="mt-2 text-sm text-zinc-500">
                SaaS companies can&apos;t track AI cost-per-customer.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Solution */}
      <section className="border-t border-zinc-800">
        <div className="mx-auto max-w-4xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold">
            2 lines of code. Real-time cost attribution.
          </h2>
          <div className="mt-10 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900">
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
          <div className="mt-10 overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900 p-6">
            <p className="mb-4 text-sm text-zinc-500">Dashboard Trace View</p>
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
      <section className="border-t border-zinc-800 bg-zinc-900/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold">Everything you need</h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {features.map((feature) => (
              <div key={feature.title} className="rounded-lg border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-3xl">{feature.icon}</p>
                <h3 className="mt-3 text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm text-zinc-400">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-zinc-800">
        <div className="mx-auto max-w-4xl px-6 py-20 text-center">
          <h2 className="text-3xl font-bold">Stop guessing. Start tracking.</h2>
          <p className="mt-4 text-zinc-400">
            Free tier includes 10K tracked calls/month. No credit card required.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/login"
              className="rounded-md bg-emerald-500 px-8 py-3 font-medium text-zinc-950 hover:bg-emerald-400 transition-colors"
            >
              Get Started Free
            </Link>
            <a
              href="https://github.com/neuria-dev/neurameter"
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-md border border-zinc-700 px-8 py-3 font-medium text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors"
            >
              View on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col items-center justify-between gap-4 md:flex-row">
            <div className="flex items-center gap-2">
              <span className="font-bold">NeuraMeter</span>
              <span className="text-zinc-500">by</span>
              <a href="https://neuria.tech" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:text-emerald-300">
                NEURIA
              </a>
            </div>
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <a href="https://github.com/neuria-dev/neurameter" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">
                GitHub
              </a>
              <a href="https://x.com/neurameter" target="_blank" rel="noopener noreferrer" className="hover:text-zinc-300">
                Twitter
              </a>
              <span>MIT License</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
