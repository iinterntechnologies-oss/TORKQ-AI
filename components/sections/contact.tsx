import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useThemeState } from '../../lib/theme-state';
import { Reveal } from '../ui/reveal';

export const ContactSection: React.FC = () => {
  const { accent } = useThemeState();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="contact" className="w-full max-w-[1100px] mx-auto px-4 py-20 scroll-mt-24 space-y-10">
      <Reveal className="text-center space-y-3">
        <span
          className="text-xs font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full border border-white/10 bg-white/5"
          style={{ color: accent }}
        >
          GET IN TOUCH
        </span>
        <h2 className="text-2xl sm:text-4xl font-sans font-bold text-white tracking-heading leading-heading">
          Request a Deployment Demo
        </h2>
        <p className="text-sm text-neutral-400 max-w-xl mx-auto font-sans leading-body">
          Speak with our gateway team about on-premise installation and regional PII capabilities.
        </p>
      </Reveal>

      <motion.div
        data-material="panel"
        whileHover={{ y: -4 }}
        className="max-w-xl mx-auto rounded-3xl p-8 bg-white/[0.03] backdrop-blur-xl border border-white/10 shadow-2xl transition-[background-color,border-color] duration-300"
      >
        {submitted ? (
          <div data-reveal className="text-center py-8 space-y-4 font-sans animate-fade-in">
            <div
              className="w-12 h-12 rounded-full mx-auto flex items-center justify-center font-bold text-xl text-black"
              style={{ backgroundColor: accent }}
            >
              ✓
            </div>
            <h3 className="text-xl font-bold text-white">Thank You</h3>
            <p className="text-sm text-neutral-400">
              Your inquiry has been received. Our gateway engineering team will follow up within 24 hours.
            </p>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-4 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-mono text-neutral-300 hover:text-white"
            >
              Send Another Message
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 font-sans">
            <div>
              <label htmlFor="name" className="block text-xs font-mono font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                id="name"
                type="text"
                required
                placeholder="Jane Doe"
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#6DBE30] text-sm font-sans transition-colors"
              />
            </div>

            <div>
              <label htmlFor="email" className="block text-xs font-mono font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Work Email <span className="text-red-400">*</span>
              </label>
              <input
                id="email"
                type="email"
                required
                placeholder="jane@company.com"
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#6DBE30] text-sm font-sans transition-colors"
              />
            </div>

            <div>
              <label htmlFor="company" className="block text-xs font-mono font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Company
              </label>
              <input
                id="company"
                type="text"
                placeholder="Acme Enterprise"
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#6DBE30] text-sm font-sans transition-colors"
              />
            </div>

            <div>
              <label htmlFor="message" className="block text-xs font-mono font-semibold text-neutral-300 uppercase tracking-wider mb-2">
                Message <span className="text-red-400">*</span>
              </label>
              <textarea
                id="message"
                required
                rows={4}
                placeholder="Tell us about your infrastructure or AI model traffic..."
                className="w-full px-4 py-3 rounded-2xl bg-white/5 border border-white/10 text-white placeholder-neutral-500 focus:outline-none focus:border-[#6DBE30] text-sm font-sans resize-none transition-colors"
              />
            </div>

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl font-mono font-bold text-xs uppercase tracking-wider text-black transition-[filter,transform] duration-150 ease-out hover:brightness-110 active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-[#6DBE30] shadow-lg cursor-pointer"
              style={{ backgroundColor: accent }}
            >
              Submit Inquiry
            </button>
          </form>
        )}
      </motion.div>
    </section>
  );
};
