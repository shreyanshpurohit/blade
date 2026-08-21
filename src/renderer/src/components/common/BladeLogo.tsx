import logoForDark from '../../assets/logo-dark-theme.svg';
import logoForLight from '../../assets/logo-light-theme.svg';

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
      {/* Light appearance: dark logo paths (logoForLight) */}
      <img
        src={logoForLight}
        alt={alt}
        className="w-full h-full object-contain pointer-events-none hidden [html[data-appearance='light']_&]:block"
      />
      {/* Dark / Default appearance: white logo paths (logoForDark) */}
      <img
        src={logoForDark}
        alt={alt}
        className="w-full h-full object-contain pointer-events-none block [html[data-appearance='light']_&]:hidden"
      />
    </span>
  );
}
