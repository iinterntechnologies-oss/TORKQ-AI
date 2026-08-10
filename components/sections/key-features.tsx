import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldAlert,
  KeyRound,
  Users,
  FileCheck2,
  SlidersHorizontal,
  Network,
  Terminal,
  Cloud,
  type LucideIcon,
} from 'lucide-react';
import { Reveal } from '../ui/reveal';
import { SectionBackdrop } from '../ui/section-backdrop';

interface KeyFeature {
  title: string;
  body: string;
  icon: LucideIcon;
}

const KEY_FEATURES: KeyFeature[] = [
  {
    icon: ShieldAlert,
    title: 'Sensitive Data Detection',
    body: 'Detects PII and confidential values in prompts before they reach a model, using pattern signatures backed by named-entity recognition.',
  },
  {
    icon: KeyRound,
    title: 'Tokenization and Rehydration',
    body: 'Sensitive values are swapped for opaque tokens on the way out and restored in the reply on the way back. The model gets a usable prompt; it never gets the real values.',
  },
  {
    icon: Users,
    title: 'Per-User Model Access',
    body: 'Grant or revoke access to specific providers and models per user or group from the admin dashboard. Provider keys are held centrally and never touch an employee device.',
  },
  {
    icon: FileCheck2,
    title: 'Tamper-Evident Audit Trail',
    body: 'A hash-chained record of every governed request, visible per user in the admin dashboard, with chain continuity verifiable on demand.',
  },
  {
    icon: SlidersHorizontal,
    title: 'Policy-Driven Control',
    body: 'Standard identifier types are detected automatically. Anything specific to your organisation is defined once as policy and enforced from then on.',
  },
  {
    icon: Network,
    title: 'Multi-Provider Routing',
    body: 'Register cloud provider APIs and your own model servers side by side, and route requests across them. TorkQ runs no inference of its own.',
  },
  {
    icon: Terminal,
    title: 'Chat and API Access',
    body: 'A chat interface for everyday use and issued API keys for IDEs, scripts, and internal tools — the same governance applies to both paths.',
  },
  {
    icon: Cloud,
    title: 'Flexible Deployment',
    body: 'Run on-premise on ordinary server hardware, or in your own private cloud. Low storage, low compute, single node — it does not need a datacenter.',
  },
];

export const KeyFeaturesSection: React.FC = () => (
  <section
    id="key-features"
    className="relative w-full overflow-hidden py-24 sm:py-32 scroll-mt-24"
  >
    <SectionBackdrop />

    <div className="relative z-10 max-w-7xl mx-auto px-6 sm:px-8 space-y-12 sm:space-y-16">
      <Reveal className="text-center space-y-4">
        <span className="inline-block text-xs font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-[#6DBE30]/10 border border-[#6DBE30]/20 text-[#6DBE30]">
          Key Features
        </span>
        <h2 className="text-3xl sm:text-4xl font-sans font-bold text-white tracking-heading leading-heading">
          Everything the control point does.
        </h2>
      </Reveal>

      {/* One enclosure, hairlines between cells rather than gaps.
          Every cell draws its own right + bottom border; the grid is pulled 1px
          past the container so the trailing column and row have theirs clipped
          by overflow-hidden. That keeps a single clean edge at every breakpoint,
          which `divide-x`/`divide-y` cannot do on a wrapping grid — they would
          strand a border down the left of each new row. */}
      <Reveal>
        <div
          data-material="panel"
          className="bg-white/[0.02] backdrop-blur-sm border border-white/10 rounded-3xl overflow-hidden"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 -mr-px -mb-px">
            {KEY_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <motion.div
                  key={feature.title}
                  whileHover={{ y: -4 }}
                  className="border-r border-b border-white/10 p-8 hover:bg-white/[0.04] transition-[background-color] duration-300"
                >
                  <div className="w-12 h-12 mb-5 rounded-2xl bg-[#6DBE30]/10 border border-[#6DBE30]/20 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-[#6DBE30] stroke-[2]" aria-hidden="true" />
                  </div>
                  <h3 className="text-base font-sans font-bold text-white mb-2.5 tracking-heading">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-zinc-400 leading-body">{feature.body}</p>
                </motion.div>
              );
            })}
          </div>
        </div>
      </Reveal>
    </div>
  </section>
);
