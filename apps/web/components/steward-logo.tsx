interface StewardLogoProps {
  className?: string | undefined;
  markClassName?: string | undefined;
  showName?: boolean;
}

export function StewardLogo({ className, markClassName, showName = true }: StewardLogoProps) {
  return (
    <span className={className}>
      <svg
        className={markClassName}
        viewBox="0 0 36 36"
        fill="none"
        aria-hidden="true"
      >
        <path d="M5.5 16.2 18 5.8l12.5 10.4" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M9.2 14.2v15.6h17.6V14.2" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M15.2 29.8V19.1h7.6v10.7" fill="currentColor" />
        <circle cx="20.4" cy="24.2" r="1.05" fill="var(--logo-knob, #d98254)" />
      </svg>
      {showName ? <span>Steward</span> : null}
    </span>
  );
}
