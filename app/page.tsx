"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";

const ATS_LOGOS = [
  "Greenhouse", "Lever", "Workday", "iCIMS", "Ashby",
  "Jobvite", "SmartRecruiters", "BambooHR", "Taleo", "Workable",
  "Breezy HR", "JazzHR", "Recruitee", "LinkedIn", "Indeed",
];

const STEPS = [
  { num: "01", title: "Upload Your Resume", desc: "Our AI extracts your name, experience, education, skills — everything. Takes 10 seconds.", icon: "📄" },
  { num: "02", title: "Complete Your Profile", desc: "Fill in remaining details like work authorization, salary expectations, and common Q&A answers.", icon: "✏️" },
  { num: "03", title: "Install Extension", desc: "Add EazyApply to Chrome. One click install, zero configuration needed.", icon: "🧩" },
  { num: "04", title: "Apply in One Click", desc: "Visit any job application. Click the ⚡ button. Every field fills instantly. Submit and move on.", icon: "⚡" },
];

const FEATURES = [
  { title: "Resume Parsing", desc: "Upload PDF/DOCX and we extract 40+ data points automatically using AI.", tag: "AI-Powered" },
  { title: "100+ ATS Support", desc: "Works on Greenhouse, Lever, Workday, iCIMS, Ashby, and every major platform.", tag: "Universal" },
  { title: "Smart Field Matching", desc: "Reads field names, labels, placeholders, and aria attributes. Not screenshot-guessing.", tag: "Accurate" },
  { title: "React-Compatible", desc: "Uses native input setters that trigger React, Vue, and Angular change events properly.", tag: "Technical" },
  { title: "Work Auth & EEO", desc: "Auto-answers work authorization, sponsorship, and demographic questions.", tag: "Complete" },
  { title: "AI Custom Answers", desc: "Optional Claude AI integration for unique questions like 'Why this role?'", tag: "Optional" },
];

const PRICING = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    features: ["10 auto-fills per month", "Resume upload & parsing", "Basic profile fields", "Standard field matching"],
    cta: "Get Started Free",
    popular: false,
  },
  {
    name: "Pro",
    price: "$9",
    period: "/month",
    features: ["Unlimited auto-fills", "All profile fields", "AI custom question answers", "Resume file auto-upload", "Priority support", "Multi-page form support"],
    cta: "Start Pro Trial",
    popular: true,
  },
  {
    name: "Lifetime",
    price: "$49",
    period: "one-time",
    features: ["Everything in Pro", "Lifetime access", "All future updates", "Early access to new features"],
    cta: "Buy Lifetime",
    popular: false,
  },
];

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1 }
    );
    const el = ref.current;
    if (el) {
      el.querySelectorAll(".reveal").forEach((child) => observer.observe(child));
    }
    return () => observer.disconnect();
  }, []);
  return ref;
}

export default function LandingPage() {
  const pageRef = useReveal();

  return (
    <div ref={pageRef} className="noise-bg">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-zinc-800/50 bg-surface-0/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xl">⚡</span>
            <span className="text-lg font-bold tracking-tight">EazyApply</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm text-zinc-400">
            <a href="#features" className="hover:text-white transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-white transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-sm text-zinc-400 hover:text-white transition-colors">Dashboard</Link>
            <Link
              href="/dashboard"
              className="text-sm font-semibold px-4 py-2 rounded-lg bg-brand-500 text-black hover:bg-brand-400 transition-all"
            >
              Get Started Free
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-20 px-6 overflow-hidden">
        {/* Background gradient orbs */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-40 right-1/4 w-80 h-80 bg-emerald-500/8 rounded-full blur-[100px] pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="reveal inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 text-sm font-medium mb-8">
            <span className="w-2 h-2 bg-brand-400 rounded-full animate-pulse" />
            Now in public beta
          </div>

          <h1 className="reveal text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.05] mb-6" style={{ animationDelay: "0.1s" }}>
            Stop typing the same
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-brand-400 to-emerald-300 glow-text">
              info 100 times
            </span>
          </h1>

          <p className="reveal text-lg md:text-xl text-zinc-400 max-w-2xl mx-auto mb-10 leading-relaxed" style={{ animationDelay: "0.2s" }}>
            Upload your resume. We extract everything.
            Fill your profile once. Auto-fill every job application
            on Greenhouse, Lever, Workday & 100+ platforms — instantly.
          </p>

          <div className="reveal flex flex-col sm:flex-row items-center justify-center gap-4" style={{ animationDelay: "0.3s" }}>
            <Link
              href="/dashboard"
              className="group flex items-center gap-2 px-8 py-4 rounded-xl bg-brand-500 text-black font-bold text-lg hover:bg-brand-400 transition-all glow-green"
            >
              <span>Get Started Free</span>
              <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
            </Link>
            <a
              href="#how-it-works"
              className="px-8 py-4 rounded-xl border border-zinc-700 text-zinc-300 font-medium hover:bg-zinc-800/50 transition-all"
            >
              See How It Works
            </a>
          </div>

          {/* Demo visual */}
          <div className="reveal mt-16 relative" style={{ animationDelay: "0.4s" }}>
            <div className="bg-surface-2 border border-zinc-800 rounded-2xl p-6 max-w-2xl mx-auto shadow-2xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500/80" />
                <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                <div className="w-3 h-3 rounded-full bg-green-500/80" />
                <span className="ml-3 text-xs text-zinc-500 font-mono">boards.greenhouse.io/company/jobs/apply</span>
              </div>
              <div className="space-y-3">
                {[
                  { label: "First Name", value: "Ajay", filled: true },
                  { label: "Last Name", value: "Kumar Reddy", filled: true },
                  { label: "Email", value: "ajay@example.com", filled: true },
                  { label: "LinkedIn URL", value: "linkedin.com/in/ajaykumar", filled: true },
                  { label: "Resume", value: "resume_2026.pdf ✓ uploaded", filled: true },
                ].map((field, i) => (
                  <div key={i} className="flex items-center gap-3 animate-slide-in" style={{ animationDelay: `${0.5 + i * 0.15}s` }}>
                    <span className="text-xs text-zinc-500 w-28 text-right">{field.label}</span>
                    <div className="flex-1 h-9 rounded-md bg-surface-3 border border-zinc-700 flex items-center px-3">
                      <span className="text-sm text-brand-400 font-mono">{field.value}</span>
                    </div>
                    <span className="text-brand-400 text-sm">✓</span>
                  </div>
                ))}
              </div>
              <div className="mt-4 text-center">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-brand-400 bg-brand-500/10 px-4 py-2 rounded-full">
                  ⚡ 5 fields filled in 0.3 seconds
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ATS Marquee */}
      <section className="py-12 border-y border-zinc-800/50 bg-surface-1/50 overflow-hidden">
        <p className="text-center text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">Works on every major ATS platform</p>
        <div className="relative">
          <div className="flex gap-8 animate-[scroll_30s_linear_infinite]" style={{ width: "max-content" }}>
            {[...ATS_LOGOS, ...ATS_LOGOS].map((name, i) => (
              <span key={i} className="text-sm text-zinc-500 font-medium whitespace-nowrap px-4 py-2 rounded-lg border border-zinc-800/50 bg-surface-2">
                {name}
              </span>
            ))}
          </div>
          <style jsx>{`
            @keyframes scroll {
              0% { transform: translateX(0); }
              100% { transform: translateX(-50%); }
            }
          `}</style>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="reveal text-sm font-semibold text-brand-400 uppercase tracking-widest mb-3">How It Works</p>
            <h2 className="reveal text-4xl md:text-5xl font-extrabold tracking-tight">Four steps. Five minutes.</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            {STEPS.map((step, i) => (
              <div key={i} className="reveal group relative p-8 rounded-2xl bg-surface-2 border border-zinc-800 hover:border-brand-500/30 transition-all duration-500" style={{ animationDelay: `${i * 0.1}s` }}>
                <div className="flex items-start gap-4">
                  <span className="text-4xl">{step.icon}</span>
                  <div>
                    <span className="text-xs font-mono text-brand-400/60 uppercase tracking-widest">Step {step.num}</span>
                    <h3 className="text-xl font-bold mt-1 mb-2">{step.title}</h3>
                    <p className="text-zinc-400 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-6 bg-surface-1/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <p className="reveal text-sm font-semibold text-brand-400 uppercase tracking-widest mb-3">Features</p>
            <h2 className="reveal text-4xl md:text-5xl font-extrabold tracking-tight">Built different.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-5">
            {FEATURES.map((f, i) => (
              <div key={i} className="reveal p-6 rounded-xl bg-surface-2 border border-zinc-800 hover:border-zinc-700 transition-all" style={{ animationDelay: `${i * 0.08}s` }}>
                <span className="inline-block text-[10px] font-bold uppercase tracking-widest text-brand-400 bg-brand-500/10 px-2.5 py-1 rounded-md mb-3">{f.tag}</span>
                <h3 className="text-lg font-bold mb-2">{f.title}</h3>
                <p className="text-sm text-zinc-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <p className="reveal text-sm font-semibold text-brand-400 uppercase tracking-widest mb-3">Pricing</p>
            <h2 className="reveal text-4xl md:text-5xl font-extrabold tracking-tight">Simple. No BS.</h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {PRICING.map((plan, i) => (
              <div
                key={i}
                className={`reveal relative p-8 rounded-2xl border transition-all ${
                  plan.popular
                    ? "bg-surface-2 border-brand-500/50 glow-green"
                    : "bg-surface-2 border-zinc-800 hover:border-zinc-700"
                }`}
                style={{ animationDelay: `${i * 0.1}s` }}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-xs font-bold uppercase tracking-widest bg-brand-500 text-black px-4 py-1 rounded-full">
                    Most Popular
                  </span>
                )}
                <h3 className="text-lg font-bold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-4xl font-extrabold">{plan.price}</span>
                  <span className="text-sm text-zinc-500">{plan.period}</span>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-center gap-2 text-sm text-zinc-300">
                      <span className="text-brand-400">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <Link
                  href="/dashboard"
                  className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all ${
                    plan.popular
                      ? "bg-brand-500 text-black hover:bg-brand-400"
                      : "bg-zinc-800 text-zinc-200 hover:bg-zinc-700"
                  }`}
                >
                  {plan.cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 px-6">
        <div className="reveal max-w-3xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mb-6">
            Ready to stop copy-pasting?
          </h2>
          <p className="text-lg text-zinc-400 mb-10">
            Join thousands of job seekers who fill applications in seconds, not minutes.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 px-10 py-5 rounded-xl bg-brand-500 text-black font-bold text-lg hover:bg-brand-400 transition-all glow-green"
          >
            <span>Get Started Free</span>
            <span>→</span>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-zinc-800/50 py-12 px-6">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span>⚡</span>
            <span className="font-bold">EazyApply</span>
            <span className="text-zinc-500 text-sm ml-2">© 2026</span>
          </div>
          <div className="flex gap-6 text-sm text-zinc-500">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="mailto:support@eazyapply.com" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
