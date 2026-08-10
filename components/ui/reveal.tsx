import React from 'react';
import { motion } from 'framer-motion';

interface RevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}

/**
 * Scroll-triggered entrance shared by every section, so the whole page uses one
 * arrival behaviour instead of the hero animating and nothing else following.
 *
 * Critically damped (bounce: 0) — nothing carried momentum into this, so
 * overshoot would read as decoration rather than physics.
 * Reduced motion is handled globally by <MotionConfig reducedMotion="user">.
 */
export const Reveal: React.FC<RevealProps> = ({ children, delay = 0, className = '' }) => (
  <motion.div
    data-reveal
    className={className}
    initial={{ opacity: 0, y: 16 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, amount: 0.15 }}
    transition={{ type: 'spring', bounce: 0, duration: 0.4, delay }}
  >
    {children}
  </motion.div>
);
