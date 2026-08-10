import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FileText, Play, Columns3, Tag, Mail, type LucideIcon } from 'lucide-react';
import { TorkQLogo } from './torkq-logo';

/**
 * TorkQ navigation.
 *
 * Deliberately does NOT read the theme-state accent. The bar stays green and
 * white through every site state (scanning / exposed / remediated) so the one
 * piece of persistent chrome never turns amber or red under the visitor. The
 * page-level dimming during a scan is applied by the <Dimmable> wrapper in
 * App.tsx, not from in here.
 */

interface NavItem {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'details', href: '#details', label: 'DETAILS', icon: FileText },
  { id: 'demo', href: '#demo', label: 'DEMO', icon: Play },
  { id: 'comparison', href: '#comparison', label: 'COMPARISON', icon: Columns3 },
  { id: 'pricing', href: '#pricing', label: 'PRICING', icon: Tag },
  { id: 'contact', href: '#contact', label: 'CONTACT', icon: Mail },
];

/** Past this scroll offset the pill thickens its material to stay legible. */
const SCROLL_THRESHOLD = 80;

/**
 * A programmatic smooth scroll sweeps the viewport across every section between
 * here and the target, and the observer would fire for each one — the lamp would
 * skitter through four links before landing. Suppress observer writes while our
 * own scroll is in flight, but release early the moment the user takes over, so
 * a hand on the wheel always beats the animation.
 */
const SCROLL_LOCK_MS = 800;

export const Navbar: React.FC = () => {
  const [activeId, setActiveId] = useState<string>('');
  const [isScrolled, setIsScrolled] = useState(false);
  const prefersReducedMotion = useReducedMotion();
  const lockUntilRef = useRef(0);

  const releaseLock = useCallback(() => {
    lockUntilRef.current = 0;
  }, []);

  // Material weight follows scroll depth.
  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > SCROLL_THRESHOLD);
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // The lamp tracks where the visitor actually is, not only where they clicked.
  // rootMargin collapses the observer root to a thin band across the middle of
  // the viewport, so "active" means "this section is what you're looking at".
  useEffect(() => {
    const sections = NAV_ITEMS.map((item) => document.getElementById(item.id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (Date.now() < lockUntilRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        }
      },
      { rootMargin: '-45% 0px -45% 0px', threshold: 0 },
    );

    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  // Any real input hands control straight back to the observer.
  useEffect(() => {
    const opts = { passive: true } as const;
    window.addEventListener('wheel', releaseLock, opts);
    window.addEventListener('touchstart', releaseLock, opts);
    window.addEventListener('keydown', releaseLock, opts);
    return () => {
      window.removeEventListener('wheel', releaseLock);
      window.removeEventListener('touchstart', releaseLock);
      window.removeEventListener('keydown', releaseLock);
    };
  }, [releaseLock]);

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const target = document.getElementById(id);
    if (!target) return;

    // Respond on the click, not when the scroll lands — the lamp leaves for the
    // new link immediately and the page catches up to it.
    setActiveId(id);
    lockUntilRef.current = prefersReducedMotion ? 0 : Date.now() + SCROLL_LOCK_MS;

    // Smooth scroll is vestibular motion — hand it off to an instant jump when
    // the user has asked for less of it.
    target.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth' });
  };

  return (
    <>
      {/* ── TOP ROW: logo left, CTA right ─────────────────────────────────── */}
      {/* pointer-events-none so this full-width transparent strip never eats
          clicks meant for the hero underneath; the two controls opt back in. */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-transparent py-6 pointer-events-none">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 flex items-center justify-between">
          <motion.a
            href="#"
            aria-label="TorkQ — back to top"
            className="group pointer-events-auto flex items-center gap-3 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6DBE30]"
            initial={{ opacity: 0, x: -15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#6DBE30]/10 border border-[#6DBE30]/20 group-hover:bg-[#6DBE30]/20 transition-all duration-300">
              <TorkQLogo size={22} showWordmark={false} />
            </div>
            <span className="text-xl sm:text-2xl font-extrabold tracking-widest uppercase text-white select-none">
              TORKQ
            </span>
          </motion.a>

          <motion.a
            href="#contact"
            onClick={(e) => handleNavClick(e, 'contact')}
            className="pointer-events-auto bg-[#6DBE30] hover:bg-[#8BE14A] text-black font-bold text-sm px-6 py-2.5 rounded-full shadow-lg shadow-[#6DBE30]/20 transition-colors duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
            initial={{ opacity: 0, x: 15 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            whileHover={{ scale: 1.04, y: -1 }}
            whileTap={{ scale: 0.96 }}
          >
            GET TORKQ
          </motion.a>
        </div>
      </header>

      {/* ── FLOATING PILL: bottom on phones, top from sm up ────────────────── */}
      <div className="fixed bottom-6 sm:top-6 sm:bottom-auto left-1/2 -translate-x-1/2 z-50 transition-all duration-300 ease-in-out">
        <nav
          aria-label="Main navigation"
          data-material="chrome"
          className={`flex items-center gap-2 border backdrop-blur-lg py-1.5 px-2 rounded-full shadow-2xl shadow-black/40 transition-all duration-300 ease-in-out ${
            isScrolled ? 'bg-black/70 border-white/20' : 'bg-black/40 border-white/10'
          }`}
        >
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeId === item.id;

            return (
              <a
                key={item.id}
                href={item.href}
                onClick={(e) => handleNavClick(e, item.id)}
                aria-label={item.label}
                aria-current={isActive ? 'true' : undefined}
                className={`relative cursor-pointer text-sm font-semibold px-4 py-2 sm:px-6 rounded-full transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6DBE30] ${
                  isActive ? 'text-white' : 'text-zinc-400 hover:text-white'
                }`}
              >
                <span className="hidden md:inline">{item.label}</span>
                <Icon className="md:hidden" size={18} strokeWidth={2.5} aria-hidden="true" />

                {isActive && (
                  // layoutId is what slides the lamp between links — framer-motion
                  // animates from wherever it currently is on screen, so clicking
                  // mid-flight redirects it instead of restarting.
                  <motion.div
                    layoutId="lamp"
                    initial={false}
                    transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                    className="absolute inset-0 w-full rounded-full -z-10 bg-white/5"
                  >
                    <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 rounded-t-full bg-[#6DBE30]">
                      <div className="absolute w-12 h-6 rounded-full blur-md -top-2 -left-2 bg-[#6DBE30]/25" />
                      <div className="absolute w-8 h-6 rounded-full blur-md -top-1 bg-[#6DBE30]/25" />
                      <div className="absolute w-4 h-4 rounded-full blur-sm top-0 left-2 bg-[#6DBE30]/20" />
                    </div>
                  </motion.div>
                )}
              </a>
            );
          })}
        </nav>
      </div>
    </>
  );
};
