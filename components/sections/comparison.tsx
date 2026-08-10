import React from 'react';
import { motion } from 'framer-motion';
import { useThemeState } from '../../lib/theme-state';
import { Reveal } from '../ui/reveal';

export const ComparisonSection: React.FC = () => {
  const { accent } = useThemeState();

  const competitors = ['TorkQ', 'Protecto', 'Portkey', 'LiteLLM', 'Lakera'];

  const rows = [
    {
      feature: 'Self-hosted deployment',
      values: ['✓ Yes', '— Partial', '— Partial', '✓ Yes', '✕ No'],
    },
    {
      feature: 'Customer-held API keys',
      values: ['✓ Yes', '— Partial', '✓ Yes', '✓ Yes', '✕ No'],
    },
    {
      feature: 'Gulf/India PII detection',
      values: ['✓ Yes', '✕ No', '✕ No', '✕ No', '✕ No'],
    },
    {
      feature: 'Tamper-evident evidence chain',
      values: ['✓ Yes', '✕ No', '✕ No', '✕ No', '✕ No'],
    },
    {
      feature: 'Air-gap capable',
      values: ['✓ Yes', '✕ No', '✕ No', '— Partial', '✕ No'],
    },
  ];

  const renderCellContent = (val: string, isTorkq: boolean) => {
    if (val.startsWith('✓')) {
      return (
        <span
          className={`font-mono text-xs font-bold px-2.5 py-1 rounded-md inline-flex items-center gap-1 ${
            isTorkq ? 'bg-[#6DBE30]/15 text-[#6DBE30] border border-[#6DBE30]/30' : 'text-neutral-200'
          }`}
        >
          {val}
        </span>
      );
    }
    if (val.startsWith('—')) {
      return (
        <span className="font-mono text-xs text-amber-300/80 px-2.5 py-1 rounded-md bg-amber-500/10 inline-flex items-center gap-1">
          {val}
        </span>
      );
    }
    return (
      <span className="font-mono text-xs text-neutral-400 px-2.5 py-1 inline-flex items-center gap-1">
        {val}
      </span>
    );
  };

  return (
    <section id="comparison" className="w-full max-w-[1100px] mx-auto px-4 py-20 scroll-mt-24 space-y-10">
      <Reveal className="text-center space-y-3">
        <span
          className="text-xs font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full border border-white/10 bg-white/5"
          style={{ color: accent }}
        >
          COMPETITIVE ARCHITECTURE
        </span>
        <h2 className="text-2xl sm:text-4xl font-sans font-bold text-white tracking-heading leading-heading">
          Feature Comparison
        </h2>
        <p className="text-sm text-neutral-400 max-w-xl mx-auto font-sans leading-body">
          Comparing key architectural capabilities across enterprise AI proxy & privacy solutions.
        </p>
      </Reveal>

      <motion.div
        data-material="panel"
        whileHover={{ y: -4 }}
        className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl shadow-sm shadow-black/40 transition-[background-color,border-color] duration-300"
      >
        <table className="w-full text-left border-collapse min-w-[640px]">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02]">
              <th scope="col" className="p-4 sm:p-5 font-mono text-xs text-neutral-400 font-semibold uppercase">
                Capabilities
              </th>
              {competitors.map((comp) => {
                const isTorkq = comp === 'TorkQ';
                return (
                  <th
                    key={comp}
                    scope="col"
                    className={`p-4 sm:p-5 font-mono text-xs uppercase font-bold text-center ${
                      isTorkq ? 'text-white bg-white/5 border-x border-white/10' : 'text-neutral-400'
                    }`}
                  >
                    <span className="inline-block" style={{ color: isTorkq ? accent : undefined }}>
                      {comp}
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {rows.map((row) => (
              <tr key={row.feature} className="hover:bg-white/[0.03] transition-colors">
                <th
                  scope="row"
                  className="p-4 sm:p-5 font-sans text-sm text-neutral-200 font-medium"
                >
                  {row.feature}
                </th>
                {row.values.map((val, idx) => {
                  const isTorkq = idx === 0;
                  return (
                    <td
                      key={idx}
                      className={`p-4 sm:p-5 text-center ${
                        isTorkq ? 'bg-white/[0.03] border-x border-white/10' : ''
                      }`}
                    >
                      {renderCellContent(val, isTorkq)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </motion.div>
    </section>
  );
};
