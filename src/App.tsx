/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef } from 'react';
import { MotionConfig } from 'framer-motion';
import { ThemeStateProvider, useThemeState } from './lib/theme-state';
import { ParticleField } from './components/ui/particle-field';
import { FlowDiagram, FlowDiagramHandle } from './components/ui/flow-diagram';
import { Navbar } from './components/ui/navbar';
import { ExposureInput } from './components/ui/exposure-input';
import { HeroSection } from './components/sections/hero';
import { DetailsSection } from './components/sections/details';
import { ComparisonSection } from './components/sections/comparison';
import { PricingSection } from './components/sections/pricing';
import { ContactSection } from './components/sections/contact';
import { FooterSection } from './components/sections/footer';

/**
 * Wrapper that recedes while the scan choreography owns the screen.
 * Opacity only — no transform — so it stays compositor-cheap and reads as
 * depth rather than movement.
 */
const Dimmable: React.FC<{ dimmed: boolean; children: React.ReactNode }> = ({
  dimmed,
  children,
}) => (
  <div
    className={`transition-opacity duration-500 ${
      dimmed ? 'opacity-[0.12] pointer-events-none' : 'opacity-100'
    }`}
  >
    {children}
  </div>
);

function MainApp() {
  const { state } = useThemeState();
  const flowDiagramRef = useRef<FlowDiagramHandle | null>(null);

  // Scroll-spy now lives inside <Navbar>, which tracks the active section with
  // an IntersectionObserver instead of offsetTop arithmetic.

  const isScanningState = state === 'scanning';

  return (
    <div className="relative min-h-screen bg-black text-white font-sans overflow-x-hidden selection:bg-[#6DBE30]/30 selection:text-[#6DBE30]">
      {/* Full-viewport Particle Field Background (z-index 0) */}
      <ParticleField />

      {/* Dark Variant Aurora Blobs Background */}
      <div className="fixed top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-[#6DBE30]/10 blur-[160px] rounded-full pointer-events-none -z-10" />

      {/* Floating Sticky Navigation Bar */}
      <Dimmable dimmed={isScanningState}>
        <Navbar />
      </Dimmable>

      {/* Main Content Area */}
      <main className="relative z-10 space-y-8 sm:space-y-12">
        {/* HERO SECTION */}
        <Dimmable dimmed={isScanningState}>
          <HeroSection />
        </Dimmable>

        {/* HERO DATA-FLOW DIAGRAM SECTION */}
        <section
          id="flow"
          className={`relative w-full max-w-[1000px] mx-auto px-4 min-h-[220px] sm:min-h-[260px] flex items-center justify-center transition-opacity duration-500 ${
            isScanningState ? 'z-[45] opacity-100' : 'z-10'
          }`}
        >
          <FlowDiagram ref={flowDiagramRef} />
        </section>

        {/* INTERACTIVE DEMO SECTION */}
        <section
          id="demo"
          className="w-full max-w-[1100px] mx-auto min-h-[380px] my-12 px-4 scroll-mt-28"
        >
          <Dimmable dimmed={isScanningState}>
            <ExposureInput flowDiagramRef={flowDiagramRef} />
          </Dimmable>
        </section>

        {/* DETAILS SECTION */}
        <Dimmable dimmed={isScanningState}>
          <DetailsSection />
        </Dimmable>

        {/* COMPARISON SECTION */}
        <Dimmable dimmed={isScanningState}>
          <ComparisonSection />
        </Dimmable>

        {/* PRICING SECTION */}
        <Dimmable dimmed={isScanningState}>
          <PricingSection />
        </Dimmable>

        {/* CONTACT SECTION */}
        <Dimmable dimmed={isScanningState}>
          <ContactSection />
        </Dimmable>
      </main>

      {/* FOOTER */}
      <Dimmable dimmed={isScanningState}>
        <FooterSection />
      </Dimmable>
    </div>
  );
}

export default function App() {
  return (
    // reducedMotion="user" makes every framer-motion transform animation on the
    // page respect the OS setting. Without it, Framer Motion ignores it entirely.
    <MotionConfig reducedMotion="user">
      <ThemeStateProvider>
        <MainApp />
      </ThemeStateProvider>
    </MotionConfig>
  );
}
