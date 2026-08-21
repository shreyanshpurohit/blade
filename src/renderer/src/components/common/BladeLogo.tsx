import logoWhite from '../../assets/logo-white.svg';
import logoBlack from '../../assets/logo-black.svg';

interface BladeLogoProps {
  className?: string;
  size?: number;
  alt?: string;
}

export function BladeLogo({ className = 'w-6 h-6', size, alt = 'Blade' }: BladeLogoProps) {
  const style = size ? { width: `${size}px`, height: `${size}px` } : undefined;

  return (
    <span
      className={`inline-flex items-center justify-center relative shrink-0 select-none ${className}`}
      style={style}
    >
      {/* In light mode (dark logo on light background) */}
      <img
        src={logoBlack}
        alt={alt}
        className="w-full h-full object-contain pointer-events-none hidden [html[data-appearance='light']_&]:block"
      />
      {/* In dark / default mode (white logo on dark background) */}
      <img
        src={logoWhite}
        alt={alt}
        className="w-full h-full object-contain pointer-events-none block [html[data-appearance='light']_&]:hidden"
      />
    </span>
  );
}
