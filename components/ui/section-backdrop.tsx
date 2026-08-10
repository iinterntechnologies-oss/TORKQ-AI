import React from 'react';

/**
 * Aurora blobs + a faint grid, both tinted #6DBE30, shared by the details and
 * key-features sections so the two read as one continuous surface.
 *
 * Sits at z-0 inside a `relative` section; the section's content wrapper takes
 * `relative z-10`. No negative z-index — that would escape the section and
 * paint behind the page background.
 *
 * The grid is masked with a radial gradient rather than clipped at a hard edge,
 * so it dissolves into the black instead of stopping on a visible line.
 */
export const SectionBackdrop: React.FC<{ className?: string }> = ({ className = '' }) => {
  const fade = 'radial-gradient(ellipse 75% 55% at 50% 40%, #000 35%, transparent 100%)';

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 z-0 overflow-hidden pointer-events-none ${className}`}
    >
      <div
        className="absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #6DBE30 1px, transparent 1px), linear-gradient(to bottom, #6DBE30 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: fade,
          WebkitMaskImage: fade,
        }}
      />

      <div className="absolute -top-40 -left-32 w-[520px] h-[520px] rounded-full bg-[#6DBE30]/10 blur-[140px]" />
      <div className="absolute -bottom-48 -right-32 w-[560px] h-[560px] rounded-full bg-[#6DBE30]/[0.07] blur-[160px]" />
    </div>
  );
};
