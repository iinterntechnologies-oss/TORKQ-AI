import React from 'react';
import { motion } from 'framer-motion';
import { useThemeState } from '../../lib/theme-state';
import { Reveal } from '../ui/reveal';

export const PricingSection: React.FC = () => {
  const { accent } = useThemeState();

  const plans = [
    {
      name: 'Starter',
      price: '$13',
      period: 'per user / month',
      desc: 'Essential PII masking for small engineering teams.',
      highlighted: false,
      features: [
        'Single-node gateway deployment',
        'Standard PII detection (Email, SSN, Credit Cards)',
        'Up to 10 team seats',
        'Standard log export',
        'Community support',
      ],
      cta: 'Get Starter',
    },
    {
      name: 'Professional',
      price: '$15',
      period: 'per user / month',
      desc: 'Advanced proxy controls with custom regex & regional PII.',
      highlighted: false,
      features: [
        'Everything in Starter',
        'Gulf & India PII (Aadhaar, PAN, Emirates ID, Iqama, Saudi NID, QID)',
        'Up to 50 team seats',
        'Custom pattern masking',
        'Priority support',
      ],
      cta: 'Get Professional',
    },
    {
      name: 'Business',
      price: '$18',
      period: 'per user / month',
      desc: 'Full enterprise protection with tamper-evident evidence chains.',
      highlighted: true,
      badge: 'RECOMMENDED',
      features: [
        'Everything in Professional',
        'Cryptographic evidence chains',
        'Unlimited team seats',
        'Air-gap environment deployment',
        'Windows & Linux native binaries',
        '24/7 SLA dedicated support',
      ],
      cta: 'Get Business',
    },
    {
      name: 'Enterprise',
      price: 'Custom',
      period: 'tailored licensing',
      desc: 'Custom SLA, dedicated architecture engineering, and custom audit rules.',
      highlighted: false,
      features: [
        'Everything in Business',
        'Custom PII model training',
        'On-premise hardware appliances',
        'Dedicated security architect',
        'Custom procurement & invoicing',
        'Guaranteed uptime SLA',
      ],
      cta: 'Contact Sales',
    },
  ];

  return (
    <section id="pricing" className="w-full max-w-[1100px] mx-auto px-4 py-20 scroll-mt-24 space-y-12">
      <Reveal className="text-center space-y-3">
        <span
          className="text-xs font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full border border-white/10 bg-white/5"
          style={{ color: accent }}
        >
          PRICING PLANS
        </span>
        <h2 className="text-2xl sm:text-4xl font-sans font-bold text-white tracking-heading leading-heading">
          Transparent, Predictable Licensing
        </h2>
        <p className="text-sm text-neutral-400 max-w-xl mx-auto font-sans leading-body">
          Deploy TorkQ on your infrastructure with fixed per-user monthly rates.
        </p>
      </Reveal>

      <Reveal className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const isHighlighted = plan.highlighted;
          return (
            <motion.div
              key={plan.name}
              data-material="panel"
              /* The emphasis scale has to live in the motion props: framer-motion
                 writes `transform` inline on hover, which would drop a
                 `scale-[1.02]` utility class the moment the pointer arrives. */
              animate={{ scale: isHighlighted ? 1.02 : 1 }}
              whileHover={{ y: -6, scale: isHighlighted ? 1.02 : 1 }}
              transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
              className={`rounded-3xl p-6 flex flex-col justify-between backdrop-blur-xl transition-[background-color,border-color] duration-300 relative ${
                isHighlighted
                  ? 'bg-black/90 border-2 shadow-2xl z-10'
                  : 'bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 hover:border-[#6DBE30]/30 shadow-sm shadow-black/40'
              }`}
              style={{
                borderColor: isHighlighted ? accent : undefined,
              }}
            >
              {plan.badge && (
                <div
                  className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full font-mono text-[10px] font-bold tracking-wider text-black uppercase shadow-md"
                  style={{ backgroundColor: accent }}
                >
                  {plan.badge}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-sans font-bold text-white">{plan.name}</h3>
                  <p className="text-xs font-sans text-neutral-400 mt-1 min-h-[2.5em] leading-body">
                    {plan.desc}
                  </p>
                </div>

                <div className="pt-2 border-t border-white/10">
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-mono font-black text-white">{plan.price}</span>
                  </div>
                  <span className="text-[11px] font-mono text-neutral-400 block">{plan.period}</span>
                </div>

                <ul className="space-y-2.5 pt-4 text-xs font-sans text-neutral-300">
                  {plan.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2">
                      <span className="font-mono text-xs mt-0.5" style={{ color: accent }}>
                        ✓
                      </span>
                      <span className="leading-body">{feat}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-6 mt-6 border-t border-white/10">
                <a
                  href="#contact"
                  className={`block w-full py-2.5 rounded-2xl text-center font-mono text-xs font-bold uppercase tracking-wider transition-[background-color,filter,transform] duration-150 ease-out active:scale-[0.98] ${
                    isHighlighted
                      ? 'text-black shadow-lg hover:brightness-110'
                      : 'bg-white/5 border border-white/15 text-white hover:bg-white/10'
                  }`}
                  style={{
                    backgroundColor: isHighlighted ? accent : undefined,
                  }}
                >
                  {plan.cta}
                </a>
              </div>
            </motion.div>
          );
        })}
      </Reveal>
    </section>
  );
};
