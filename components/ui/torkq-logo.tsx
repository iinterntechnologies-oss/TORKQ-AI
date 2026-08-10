import React from 'react';

interface TorkQLogoProps {
  className?: string;
  size?: number;
  mono?: boolean;
  accentColor?: string;
  showWordmark?: boolean;
}

export const TorkQLogo: React.FC<TorkQLogoProps> = ({
  className = '',
  size = 32,
  mono = false,
  accentColor = '#6DBE30',
  showWordmark = true,
}) => {
  const primaryColor = mono ? 'currentColor' : accentColor;

  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      {/* TorkQ Logo Icon */}
      <img
        src="/logo.svg"
        alt="TorkQ"
        className="h-8 w-8 shrink-0 object-contain"
        style={size !== 32 ? { width: `${size}px`, height: `${size}px` } : undefined}
      />

      {showWordmark && (
        <span className="font-mono font-black tracking-wider text-white uppercase text-base select-none">
          TORK<span style={{ color: primaryColor }}>Q</span>
        </span>
      )}
    </div>
  );
};
