import React from 'react';
import { motion } from 'framer-motion';

export const HeroSection: React.FC = () => {
  return (
    <section id="hero" className="relative pt-24 sm:pt-28 pb-4 px-4 text-center max-w-[900px] mx-auto z-10">
      {/* Hero Accent Glow Backdrop */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[200px] bg-[#6DBE30]/15 blur-[120px] rounded-full pointer-events-none -z-10" />

      <motion.div
        data-reveal
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
      >
        <span className="inline-block px-3 py-1 rounded-full text-[11px] font-mono font-bold tracking-widest uppercase bg-white/5 border border-white/10 text-[#6DBE30] mb-4 shadow-sm shadow-[#6DBE30]/10">
          AI GOVERNANCE GATEWAY
        </span>
        <h1
          className="font-sans font-bold tracking-display text-transparent bg-clip-text bg-gradient-to-b from-white via-neutral-100 to-neutral-400 leading-display mb-4 text-center"
          /* The rem term keeps the headline responsive to the user's text-size
             setting; a pure-vw middle term would lock it to the viewport. */
          style={{ fontSize: 'clamp(2rem, 1.5rem + 2.5vw, 3.5rem)' }}
        >
          Your team is pasting company data into someone else&apos;s model.
        </h1>
      </motion.div>

      <motion.p
        data-reveal
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.4, delay: 0.1 }}
        className="text-sm sm:text-base text-neutral-400 max-w-xl mx-auto font-sans font-normal leading-body"
      >
        Paste in a prompt and see exactly what you&apos;d have sent.
      </motion.p>
    </section>
  );
};
