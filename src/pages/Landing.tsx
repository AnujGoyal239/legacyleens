// ============================================================
// LegacyLens — Landing Page
// ============================================================

import { Link } from 'react-router-dom';
import {
  Brain,
  MessageSquare,
  GitBranch,
  LayoutDashboard,
  ArrowRight,
  Github,
  Zap,
  Shield,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const features = [
  {
    icon: Brain,
    title: 'Instant Codebase Intelligence',
    description:
      'Our AI indexes your entire repository and builds a comprehensive understanding of architecture, dependencies, and patterns in minutes.',
  },
  {
    icon: MessageSquare,
    title: 'AI-Powered Q&A',
    description:
      'Ask questions in plain English and get accurate answers sourced from your code. No more digging through documentation.',
  },
  {
    icon: GitBranch,
    title: 'Visual Architecture Map',
    description:
      'Explore your codebase through an interactive dependency graph. Understand how components connect at a glance.',
  },
  {
    icon: LayoutDashboard,
    title: 'Task Board Integration',
    description:
      'Turn insights into action. Create and track tasks directly from code exploration with full context preserved.',
  },
];

const steps = [
  {
    step: '01',
    title: 'Connect your repo',
    description: 'Link your GitHub repository with a single click. We support public and private repos.',
  },
  {
    step: '02',
    title: 'AI analyzes',
    description: 'Our system indexes your codebase, extracts dependencies, and builds a semantic map.',
  },
  {
    step: '03',
    title: 'Start exploring',
    description: 'Navigate, search, and ask questions. Onboard in hours instead of weeks.',
  },
];

const plans = [
  {
    name: 'Free',
    price: '$0',
    period: 'forever',
    description: 'Perfect for trying LegacyLens',
    features: ['1 repository', '500 Q&A credits/month', 'Basic architecture view', 'Community support'],
    cta: 'Get Started Free',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$29',
    period: '/mo',
    description: 'For individual developers',
    features: ['5 repositories', '5,000 Q&A credits/month', 'Full architecture maps', 'Priority support', 'Task board integration'],
    cta: 'Start Pro Trial',
    highlighted: true,
  },
  {
    name: 'Team',
    price: '$99',
    period: '/mo',
    description: 'For engineering teams',
    features: ['Unlimited repositories', 'Unlimited Q&A', 'Team workspaces', 'Meeting transcription', 'Dedicated support'],
    cta: 'Contact Sales',
    highlighted: false,
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-white/10 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Github className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-white">LegacyLens</span>
          </Link>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-300 transition hover:text-white"
            >
              Sign In
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pt-24 pb-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,hsl(var(--primary)/0.3),transparent)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wMyI+PGNpcmNsZSBjeD0iMzAiIGN5PSIzMCIgcj0iMiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Onboard to any codebase in{' '}
              <span className="bg-gradient-to-r from-primary to-violet-400 bg-clip-text text-transparent">
                hours, not weeks
              </span>
            </h1>
            <p className="mt-6 text-lg text-slate-400 sm:text-xl">
              LegacyLens uses AI to map, index, and explain your legacy code. Ask questions,
              explore architecture, and ship confidently from day one.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                to="/login"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground shadow-lg shadow-primary/25 transition hover:bg-primary/90"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#demo"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-600 bg-slate-800/50 px-6 py-3 text-base font-medium text-white backdrop-blur transition hover:border-slate-500 hover:bg-slate-800"
              >
                Watch Demo
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="bg-white py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Everything you need to understand legacy code
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              From instant indexing to interactive exploration, LegacyLens accelerates your onboarding.
            </p>
          </div>
          <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
              <div
                key={feature.title}
                className={cn(
                  'rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md',
                  'animate-fade-in'
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-lg font-semibold text-slate-900">
                  {feature.title}
                </h3>
                <p className="mt-2 text-slate-600">{feature.description}</p>
              </div>
            );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              How it works
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Three simple steps from repo to full understanding.
            </p>
          </div>
          <div className="mt-16 grid gap-12 md:grid-cols-3">
            {steps.map((item) => (
              <div key={item.step} className="relative">
                <div className="text-5xl font-bold text-primary/20">{item.step}</div>
                <h3 className="mt-2 text-xl font-semibold text-slate-900">{item.title}</h3>
                <p className="mt-2 text-slate-600">{item.description}</p>
                {item.step !== '03' && (
                  <div className="absolute -right-6 top-8 hidden text-slate-300 md:block">
                    <ArrowRight className="h-8 w-8" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust indicators */}
      <section className="border-y border-slate-200 bg-white py-12">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-center gap-12 px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3 text-slate-600">
            <Zap className="h-6 w-6 text-primary" />
            <span className="font-medium">Instant indexing</span>
          </div>
          <div className="flex items-center gap-3 text-slate-600">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-medium">Enterprise-grade security</span>
          </div>
          <div className="flex items-center gap-3 text-slate-600">
            <Clock className="h-6 w-6 text-primary" />
            <span className="font-medium">Onboard in hours</span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              Simple, transparent pricing
            </h2>
            <p className="mt-4 text-lg text-slate-600">
              Start free. Upgrade when you need more.
            </p>
          </div>
          <div className="mt-16 grid gap-8 lg:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'rounded-2xl border bg-white p-8 shadow-sm',
                  plan.highlighted
                    ? 'border-primary shadow-primary/10 ring-2 ring-primary'
                    : 'border-slate-200'
                )}
              >
                {plan.highlighted && (
                  <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">
                    Most popular
                  </span>
                )}
                <h3 className="mt-4 text-xl font-semibold text-slate-900">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-4xl font-bold text-slate-900">{plan.price}</span>
                  <span className="text-slate-600">{plan.period}</span>
                </div>
                <p className="mt-2 text-slate-600">{plan.description}</p>
                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-slate-700">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Link
                  to={plan.name === 'Free' ? '/login' : '/login'}
                  className={cn(
                    'mt-8 block w-full rounded-lg py-3 text-center font-medium transition',
                    plan.highlighted
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                  )}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-slate-950 py-24">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Ready to understand your codebase?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-lg text-slate-400">
            Join developers who ship faster with LegacyLens. No credit card required.
          </p>
          <Link
            to="/login"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-medium text-primary-foreground transition hover:bg-primary/90"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Github className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold text-slate-900">LegacyLens</span>
            </Link>
            <div className="flex gap-8">
              <Link to="/" className="text-sm text-slate-600 hover:text-slate-900">
                Home
              </Link>
              <Link to="/login" className="text-sm text-slate-600 hover:text-slate-900">
                Sign In
              </Link>
              <a href="#" className="text-sm text-slate-600 hover:text-slate-900">
                Privacy
              </a>
              <a href="#" className="text-sm text-slate-600 hover:text-slate-900">
                Terms
              </a>
            </div>
          </div>
          <p className="mt-8 text-center text-sm text-slate-500">
            © {new Date().getFullYear()} LegacyLens. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
