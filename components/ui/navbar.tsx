import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { TorkQLogo } from './torkq-logo';

interface NavbarProps {
  activeSection?: string;
}

// Dead band around the shrink threshold. Without it, resting the page at the
// trigger point makes the bar flip-flop on one pixel of scroll jitter.
const SHRINK_AT = 48;
const GROW_AT = 24;

export const Navbar: React.FC<NavbarProps> = ({ activeSection = '' }) => {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setIsScrolled((prev) => (prev ? y > GROW_AT : y > SHRINK_AT));
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { href: '#details', label: 'DETAILS' },
    { href: '#demo', label: 'DEMO' },
    { href: '#comparison', label: 'COMPARISON' },
    { href: '#pricing', label: 'PRICING' },
    { href: '#contact', label: 'CONTACT' },
  ];

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    const targetEl = document.querySelector(href);
    if (targetEl) {
      // Smooth scroll is vestibular motion — hand it off to an instant jump
      // when the user has asked for less of it.
      targetEl.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
    }
  };

  return (
    <>
      <header className="fixed top-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
        <nav
          data-material="chrome"
          className={`pointer-events-auto w-full max-w-[1200px] flex items-center justify-between px-6 rounded-full border backdrop-blur-xl bg-black/40 border-white/10 shadow-lg shadow-[#6DBE30]/10 transition-[padding] duration-300 ease-out ${
            isScrolled ? 'py-2.5' : 'py-3.5'
          }`}
          aria-label="Main Navigation"
        >
          {/* Logo Left */}
          <a
            href="#"
            className="flex items-center gap-2 group focus:outline-none focus:ring-2 focus:ring-[#6DBE30] rounded-full px-1"
          >
            <TorkQLogo size={32} accentColor="#6DBE30" />
          </a>

          {/* Desktop Links Right with Tubelight Lamp Animation */}
          <div className="hidden md:flex items-center gap-2 font-mono text-xs font-semibold tracking-wider">
            {navLinks.map((link) => {
              const isActive = activeSection === link.href.substring(1);
              return (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className={`transition-colors duration-200 relative py-1.5 px-3.5 focus:outline-none focus:ring-2 focus:ring-[#6DBE30] rounded-full ${
                    isActive ? 'text-white' : 'text-neutral-400 hover:text-white'
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="lamp"
                      className="absolute inset-0 bg-[#6DBE30]/15 rounded-full -z-10 border border-[#6DBE30]/40 shadow-[0_0_12px_rgba(109,190,48,0.4)]"
                      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    />
                  )}
                </a>
              );
            })}

            <a
              href="#contact"
              onClick={(e) => handleNavClick(e, '#contact')}
              className="ml-2 px-5 py-2 rounded-full font-mono font-bold text-xs uppercase tracking-wider text-black transition-transform duration-150 ease-out hover:scale-105 active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[#6DBE30] shadow-md bg-[#6DBE30]"
            >
              GET TORKQ
            </a>
          </div>

          {/* Mobile Hamburger Button */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden text-neutral-300 hover:text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6DBE30]"
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {mobileMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
        </nav>
      </header>

      {/* Mobile Full-Screen Overlay.
          Enters and exits along the same path, anchored to the hamburger that
          opened it — so it reads as coming from the control, not from nowhere. */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            data-material="panel"
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-2xl flex flex-col justify-between p-8 md:hidden origin-top-right"
            initial={{ opacity: 0, scale: 0.94 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.94 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
          >
            <div className="flex items-center justify-between">
              <TorkQLogo size={36} accentColor="#6DBE30" />
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="text-neutral-400 hover:text-white p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#6DBE30]"
                aria-label="Close menu"
              >
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-6 font-mono text-lg font-bold tracking-widest text-center my-auto">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="text-neutral-300 hover:text-white py-2 transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="#contact"
                onClick={(e) => handleNavClick(e, '#contact')}
                className="mt-4 py-3 rounded-full font-mono font-bold text-sm uppercase tracking-wider text-black text-center bg-[#6DBE30]"
              >
                GET TORKQ
              </a>
            </div>

            <div className="text-center font-mono text-xs text-neutral-400">
              TorkQ Data Protection Gateway
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
