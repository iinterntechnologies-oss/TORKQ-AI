import React from 'react';
import { useThemeState } from '../../lib/theme-state';
import { TorkQLogo } from '../ui/torkq-logo';

export const FooterSection: React.FC = () => {
  const { accent } = useThemeState();

  return (
    <footer className="w-full border-t border-white/10 bg-black/90 py-12 px-4 relative z-20">
      <div className="max-w-[1100px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 font-mono text-xs text-neutral-400">
        <div className="flex items-center gap-3">
          <TorkQLogo size={28} accentColor={accent} />
        </div>

        <div className="text-center md:text-left">
          © {new Date().getFullYear()} TorkQ Inc. All rights reserved. Zero-Trust Data Protection Gateway.
        </div>

        <div>
          <a
            href="#"
            className="text-neutral-400 hover:text-white transition-colors underline decoration-dotted"
            onClick={(e) => e.preventDefault()}
          >
            &#123;&#123;DOMAIN_TBD&#125;&#125;
          </a>
        </div>
      </div>
    </footer>
  );
};
