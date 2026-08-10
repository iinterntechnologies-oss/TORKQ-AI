import React from 'react';
import { motion } from 'framer-motion';
import {
  EyeOff,
  ShieldCheck,
  Cloud,
  Server,
  KeyRound,
  Users,
  FileX2,
  FileCheck2,
  Lock,
  Network,
  type LucideIcon,
} from 'lucide-react';
import { Reveal } from '../ui/reveal';
import { SectionBackdrop } from '../ui/section-backdrop';
import { TorkQLogo } from '../ui/torkq-logo';

/**
 * Two panels, one seam.
 *
 * The left panel is deliberately light and the right deliberately dark: the
 * ungoverned path is clinical and exposed, the governed path is the branded
 * surface the rest of the page lives on. Converting the left side to dark would
 * collapse the whole point of the comparison into a colour-swapped duplicate.
 *
 * Greens are the fixed brand #6DBE30 rather than the theme-state accent — this
 * panel is a claim about the product, so it must not turn amber or red while a
 * scan is running further up the page.
 */

interface ComparisonSide {
  title: string;
  desc: string;
  icon: LucideIcon;
}

interface ComparisonRow {
  label: string;
  left: ComparisonSide;
  right: ComparisonSide;
}

const COMPARISON_ROWS: ComparisonRow[] = [
  {
    label: 'DATA PRIVACY',
    left: {
      icon: EyeOff,
      title: 'Exposed PII and Secrets',
      desc: 'Confidential values leave your network in plain text',
    },
    right: {
      icon: ShieldCheck,
      title: 'Masked Before It Leaves',
      desc: 'Sensitive values swapped for tokens on egress, restored on reply',
    },
  },
  {
    label: 'DEPLOYMENT',
    left: {
      icon: Cloud,
      title: "Someone Else's Infrastructure",
      desc: "Your prompts are retained under the provider's policy, not yours",
    },
    right: {
      icon: Server,
      title: 'Runs On Your Own Server',
      desc: 'Single-node on-premise or private cloud, your hardware, your keys',
    },
  },
  {
    label: 'ACCESS CONTROL',
    left: {
      icon: KeyRound,
      title: 'Keys Scattered Across Devices',
      desc: 'Every developer holds a provider key you cannot revoke centrally',
    },
    right: {
      icon: Users,
      title: 'One Control Plane',
      desc: 'Keys held centrally, model access granted per user or group',
    },
  },
  {
    label: 'AUDITABILITY',
    left: {
      icon: FileX2,
      title: 'No Verifiable Record',
      desc: 'Provider logs are theirs, partial, and not evidence',
    },
    right: {
      icon: FileCheck2,
      title: 'Tamper-Evident Chain',
      desc: 'Hash-chained records where any alteration breaks the chain',
    },
  },
  {
    label: 'MODEL CHOICE',
    left: {
      icon: Lock,
      title: 'Locked To One Provider',
      desc: 'Switching means changing code in every application',
    },
    right: {
      icon: Network,
      title: 'Multi-Provider Routing',
      desc: 'Cloud APIs and your own model servers behind one endpoint',
    },
  },
];

export const ComparisonSection: React.FC = () => (
  <section
    id="comparison"
    className="relative w-full overflow-hidden py-24 sm:py-32 scroll-mt-24"
  >
    <SectionBackdrop />

    <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 flex flex-col items-center">
      <Reveal className="text-center max-w-3xl flex flex-col items-center space-y-4 mb-16 sm:mb-20">
        <h2 className="font-display text-4xl sm:text-5xl lg:text-6xl font-extrabold uppercase tracking-tight leading-heading text-white">
          Same AI prompts.
          <br />
          Two completely different outcomes.
        </h2>
        <p className="max-w-2xl text-sm sm:text-base md:text-lg text-zinc-400 font-sans leading-body">
          A side-by-side look at what sending prompts straight to a provider actually costs you — and
          what changes when every request passes through a control point you own.
        </p>
      </Reveal>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-100px' }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 rounded-[2.5rem] overflow-hidden border border-white/10 shadow-2xl shadow-black/40 bg-black"
      >
        {/* Seam badge. Hidden on mobile, where the panels stack and there is no
            seam for it to sit on. */}
        <div
          aria-hidden="true"
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-30 hidden md:flex items-center justify-center"
        >
          <div className="w-16 h-16 rounded-full flex items-center justify-center select-none bg-gradient-to-b from-zinc-900 to-black border border-white/15 shadow-2xl text-xs font-black tracking-widest text-[#6DBE30]">
            VS
          </div>
        </div>

        {/* ── LEFT: raw provider APIs ──────────────────────────────────────── */}
        <div className="relative bg-[#FAF9F6] text-zinc-950 p-8 sm:p-12 md:pr-14 flex flex-col justify-between border-b md:border-b-0 md:border-r border-zinc-200/50">
          <div className="flex items-center justify-between gap-3 mb-10 sm:mb-12">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-zinc-900 text-white flex items-center justify-center">
                <span className="text-sm font-black tracking-tight" aria-hidden="true">
                  R
                </span>
              </div>
              <h3 className="font-display text-2xl font-black tracking-tight text-zinc-950">
                Raw LLM APIs
              </h3>
            </div>
            <span className="shrink-0 px-3 py-1 rounded-full select-none bg-zinc-100 text-zinc-500 border border-zinc-200 text-[10px] sm:text-xs font-black tracking-wider uppercase">
              Unregulated
            </span>
          </div>

          <div className="flex-1 divide-y divide-zinc-200/60">
            {COMPARISON_ROWS.map((row) => {
              const Icon = row.left.icon;
              return (
                <div key={row.label} className="py-6 flex gap-4 items-start first:pt-0 last:pb-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-zinc-100 border border-zinc-200/60 flex items-center justify-center text-zinc-600 shadow-sm">
                    <Icon className="h-5 w-5 stroke-[2]" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[10px] font-black tracking-widest uppercase text-zinc-400 select-none">
                      {row.label}
                    </span>
                    <h4 className="text-lg font-black leading-tight text-zinc-900">
                      {row.left.title}
                    </h4>
                    <p className="flex items-start gap-1 text-xs font-medium leading-normal text-zinc-500">
                      <span className="shrink-0 font-bold text-amber-600" aria-hidden="true">
                        ×
                      </span>
                      <span>{row.left.desc}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 sm:mt-12 pt-6 border-t border-zinc-200/40 text-[10px] sm:text-xs font-medium text-zinc-400">
            Based on direct provider SDK integration
          </div>
        </div>

        {/* ── RIGHT: the governed path ─────────────────────────────────────── */}
        <div className="relative overflow-hidden bg-gradient-to-b from-[#0B2410]/90 to-black p-8 sm:p-12 md:pl-14 flex flex-col">
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,#6DBE301A_0%,transparent_50%)]"
          />
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px pointer-events-none bg-gradient-to-r from-transparent via-[#6DBE30]/30 to-transparent"
          />

          <div className="relative z-10 flex items-center justify-between gap-3 mb-10 sm:mb-12">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 shrink-0 rounded-lg bg-[#6DBE30]/10 border border-[#6DBE30]/20 flex items-center justify-center">
                <TorkQLogo size={18} showWordmark={false} />
              </div>
              <h3 className="font-display text-2xl font-black tracking-tight text-white">
                TorkQ Gateway
              </h3>
            </div>
            <span className="shrink-0 px-3 py-1 rounded-full select-none bg-[#6DBE30]/10 text-[#6DBE30] border border-[#6DBE30]/20 text-[10px] sm:text-xs font-black tracking-wider uppercase">
              Recommended
            </span>
          </div>

          <div className="relative z-10 flex-1 divide-y divide-[#6DBE30]/15">
            {COMPARISON_ROWS.map((row) => {
              const Icon = row.right.icon;
              return (
                <div key={row.label} className="py-6 flex gap-4 items-start first:pt-0 last:pb-0">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-[#041A0C] border border-[#6DBE30]/25 flex items-center justify-center shadow-sm shadow-black/20">
                    <Icon className="h-5 w-5 stroke-[2] text-[#6DBE30]" aria-hidden="true" />
                  </div>
                  <div className="space-y-1">
                    <span className="block text-[10px] font-black tracking-widest uppercase text-[#6DBE30]/80 select-none">
                      {row.label}
                    </span>
                    <h4 className="text-lg font-black leading-tight text-white">
                      {row.right.title}
                    </h4>
                    <p className="flex items-start gap-1 text-xs font-medium leading-normal text-zinc-400">
                      <span className="shrink-0 font-bold text-[#6DBE30]" aria-hidden="true">
                        ✓
                      </span>
                      <span>{row.right.desc}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);
