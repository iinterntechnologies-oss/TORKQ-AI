import React from 'react';
import { motion } from 'framer-motion';
import { useThemeState } from '../../lib/theme-state';
import { Reveal } from '../ui/reveal';

export const DetailsSection: React.FC = () => {
  const { accent } = useThemeState();

  const steps = [
    {
      num: '01',
      title: 'Route',
      desc: "Your team's AI traffic goes through your TorkQ gateway.",
    },
    {
      num: '02',
      title: 'Detect and mask',
      desc: 'Sensitive values are replaced with tokens before egress.',
    },
    {
      num: '03',
      title: 'Rehydrate',
      desc: "The model's reply comes back with real values restored.",
    },
  ];

  const differences = [
    {
      title: 'On-Premise Infrastructure',
      desc: 'Zero external cloud dependency for inspection. Runs on your own virtual machines or bare-metal servers.',
    },
    {
      title: 'Tamper-Evident Evidence Chains',
      desc: 'Cryptographic evidence chains rather than standard logs, providing auditable verification of every prompt transform.',
    },
    {
      title: 'Gulf & India PII Specialization',
      desc: 'Dedicated detection models built specifically for regional identifiers: Aadhaar, PAN, Emirates ID, Iqama, Saudi NID, and QID.',
    },
  ];

  return (
    <section id="details" className="w-full max-w-[1100px] mx-auto px-4 py-24 scroll-mt-24 space-y-20">
      {/* SECTION HEADER */}
      <Reveal className="text-center space-y-3">
        <span
          className="text-xs font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full border border-white/10 bg-white/5"
          style={{ color: accent }}
        >
          ARCHITECTURE & CAPABILITIES
        </span>
        <h2 className="text-2xl sm:text-4xl font-sans font-bold text-white tracking-heading leading-heading">
          How TorkQ Operates
        </h2>
      </Reveal>

      {/* THREE STEPS (HOW IT WORKS) */}
      <Reveal className="space-y-6">
        <h3 className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase">
          // How It Works
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((s) => (
            <motion.div
              key={s.num}
              data-material="panel"
              whileHover={{ y: -6 }}
              /* Transition is scoped to colour only. `transition-all` would also
                 ease `transform`, low-pass filtering the hover spring above it. */
              className="p-6 rounded-3xl bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl border border-white/10 hover:border-[#6DBE30]/30 shadow-sm shadow-black/40 transition-[background-color,border-color] duration-300 relative overflow-hidden group"
            >
              <div
                /* No nested backdrop-blur: blurring an already-blurred surface
                   costs a second backdrop pass and returns nothing. */
                className="w-12 h-12 mb-4 rounded-2xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-xl font-mono font-bold"
                style={{ color: accent }}
              >
                {s.num}
              </div>
              <h4 className="text-lg font-sans font-semibold text-white mb-2">{s.title}</h4>
              <p className="text-sm font-sans text-neutral-400 leading-body">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </Reveal>

      {/* DEPLOYMENT & DIFFERENCES GRID */}
      <Reveal className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* DEPLOYMENT PANEL */}
        <motion.div
          data-material="panel"
          whileHover={{ y: -6 }}
          className="lg:col-span-1 p-8 rounded-3xl bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl border border-white/10 hover:border-[#6DBE30]/30 shadow-sm shadow-black/40 transition-[background-color,border-color] duration-300 flex flex-col justify-between"
        >
          <div className="space-y-4">
            <span
              className="text-xs font-mono font-bold tracking-wider uppercase px-2.5 py-1 rounded-full bg-white/5 border border-white/10 inline-block"
              style={{ color: accent }}
            >
              Deployment
            </span>
            <h3 className="text-xl font-sans font-bold text-white">
              Single-Node Engine
            </h3>
            <p className="text-sm font-sans text-neutral-400 leading-body">
              Runs directly on your own infrastructure with your own provider API keys. Standardized for both Windows and Linux OS environments.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 space-y-2 font-mono text-xs text-neutral-400">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
              <span>Windows Server 2019+ & Linux (Ubuntu/RHEL)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent }} />
              <span>Direct LLM Provider API Key Passthrough</span>
            </div>
          </div>
        </motion.div>

        {/* WHAT MAKES IT DIFFERENT */}
        <motion.div
          data-material="panel"
          whileHover={{ y: -6 }}
          className="lg:col-span-2 p-8 rounded-3xl bg-white/[0.03] hover:bg-white/[0.06] backdrop-blur-xl border border-white/10 hover:border-[#6DBE30]/30 shadow-sm shadow-black/40 transition-[background-color,border-color] duration-300 space-y-6"
        >
          <div className="space-y-1">
            <h3 className="text-xs font-mono font-bold tracking-widest text-neutral-400 uppercase">
              // What Makes It Different
            </h3>
            <p className="text-xl font-sans font-bold text-white">
              Engineered for Sovereignty & Regional Compliance
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            {differences.map((diff) => (
              <div
                key={diff.title}
                className="p-4 rounded-2xl bg-white/[0.06] border border-white/10 space-y-2"
              >
                <div className="font-sans font-semibold text-sm text-white">{diff.title}</div>
                <div className="font-sans text-xs text-neutral-400 leading-body">
                  {diff.desc}
                </div>
              </div>
            ))}
          </div>

          {/* REGIONAL PII BADGES */}
          <div className="pt-4 border-t border-white/10">
            <div className="text-[11px] font-mono text-neutral-400 uppercase tracking-wider mb-2 font-semibold">
              Supported Regional Identifier Formats
            </div>
            <div className="flex flex-wrap gap-2 font-mono text-xs">
              {['Aadhaar', 'PAN', 'Emirates ID', 'Iqama', 'Saudi NID', 'QID'].map((idFormat) => (
                <span
                  key={idFormat}
                  className="px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-neutral-300"
                >
                  {idFormat}
                </span>
              ))}
            </div>
          </div>
        </motion.div>
      </Reveal>
    </section>
  );
};
