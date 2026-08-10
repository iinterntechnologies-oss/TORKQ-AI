import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { LayoutDashboard, Server, ShieldCheck, Plug, ArrowRight, type LucideIcon } from 'lucide-react';
import { Reveal } from '../ui/reveal';
import { SectionBackdrop } from '../ui/section-backdrop';

interface CoreFeature {
  title: string;
  body: string;
  icon: LucideIcon;
}

const CORE_FEATURES: CoreFeature[] = [
  {
    icon: LayoutDashboard,
    title: 'Unified Governance',
    body: 'One dashboard for the whole organisation. Register your model providers once, then decide which teams reach which models. Change a policy in one place and it applies everywhere — no per-machine rollout, no shadow configurations to chase.',
  },
  {
    icon: Server,
    title: 'Runs Inside Your Infrastructure',
    body: 'TorkQ deploys on your own server as a single node. Your provider keys stay encrypted on your hardware and your prompts never transit a third-party service. Sensitive data does not leave your infrastructure, because there is nowhere else for it to go.',
  },
  {
    icon: ShieldCheck,
    title: 'Evidence, Not Just Logs',
    body: 'Every governed request writes a hash-chained record. Any change to an earlier entry breaks the chain and is detectable. When an auditor asks what happened to a specific piece of data, you produce a verifiable record instead of a filtered log export.',
  },
  {
    icon: Plug,
    title: 'Connects to What You Already Use',
    body: 'Your team gets a chat interface for everyday work and API keys for IDEs and internal tools. Point them at TorkQ instead of the provider and governance applies automatically — no browser extension, no agent on every laptop, no change to how people work.',
  },
];

export const DetailsSection: React.FC = () => {
  const prefersReducedMotion = useReducedMotion();

  const scrollToKeyFeatures = (e: React.MouseEvent) => {
    e.preventDefault();
    document
      .getElementById('key-features')
      ?.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <section
      id="details"
      className="relative w-full overflow-hidden py-24 sm:py-32 scroll-mt-24"
    >
      <SectionBackdrop />

      <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-start">
          {/* ── LEFT: the claim ─────────────────────────────────────────── */}
          <div className="lg:col-span-5 lg:sticky lg:top-28 space-y-6">
            <Reveal>
              <span className="inline-block text-xs font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-[#6DBE30]/10 border border-[#6DBE30]/20 text-[#6DBE30]">
                Core Capabilities
              </span>
            </Reveal>

            <Reveal delay={0.06}>
              {/* Display sizes take the tightened tracking token — at 48px+ the
                  default spacing reads as gaps between letters. */}
              <h2 className="text-4xl sm:text-5xl font-sans font-bold text-white tracking-display leading-display">
                Govern every prompt. Prove every decision.
              </h2>
            </Reveal>

            <Reveal delay={0.12}>
              <p className="text-base text-zinc-400 leading-body max-w-lg">
                Your teams already use AI. TorkQ puts a control point between them and the model
                — so sensitive data is masked before it leaves, access is decided by policy, and
                every action leaves proof you can hand to an auditor.
              </p>
            </Reveal>

            <Reveal delay={0.18}>
              <motion.a
                href="#key-features"
                onClick={scrollToKeyFeatures}
                whileHover={{ scale: 1.03, x: 2 }}
                whileTap={{ scale: 0.97 }}
                className="group inline-flex items-center gap-2 bg-[#6DBE30] hover:bg-[#8BE14A] text-black font-semibold text-sm rounded-full px-6 py-3 shadow-lg shadow-[#6DBE30]/20 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
              >
                <span>Explore Key Features</span>
                <ArrowRight
                  className="h-4 w-4 stroke-[2.5] transition-transform duration-300 group-hover:translate-x-0.5"
                  aria-hidden="true"
                />
              </motion.a>
            </Reveal>
          </div>

          {/* ── RIGHT: 2x2 capability cards ─────────────────────────────── */}
          <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6">
            {CORE_FEATURES.map((feature, i) => {
              const Icon = feature.icon;
              return (
                <Reveal key={feature.title} delay={i * 0.08} className="h-full">
                  <motion.div
                    data-material="panel"
                    whileHover={{ y: -6 }}
                    /* Transition is scoped to colour. `transition-all` would also
                       ease `transform`, low-pass filtering the hover spring. */
                    className="h-full bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-md border border-white/10 hover:border-[#6DBE30]/30 rounded-3xl p-7 transition-[background-color,border-color] duration-300"
                  >
                    {/* No nested backdrop-blur — blurring an already-blurred
                        surface costs a second pass and returns nothing. */}
                    <div className="w-14 h-14 mb-5 rounded-2xl bg-[#6DBE30]/10 border border-[#6DBE30]/20 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-[#6DBE30] stroke-[2]" aria-hidden="true" />
                    </div>
                    <h3 className="text-lg font-sans font-bold text-white mb-2.5 tracking-heading">
                      {feature.title}
                    </h3>
                    <p className="text-sm text-zinc-400 leading-body">{feature.body}</p>
                  </motion.div>
                </Reveal>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
