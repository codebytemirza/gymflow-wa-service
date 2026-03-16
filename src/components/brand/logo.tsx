/**
 * GymFlow SVG logo — follows emerald/white/zinc color theme.
 * Use inside any React component.
 */
export function GymFlowLogo({
  size = 32,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="GymFlow logo"
    >
      {/* Background circle */}
      <rect width="64" height="64" rx="14" fill="#059669" />

      {/* Left dumbbell plate */}
      <rect x="7" y="20" width="8" height="24" rx="3" fill="white" opacity="0.95" />

      {/* Left collar */}
      <rect x="15" y="25" width="5" height="14" rx="2" fill="white" opacity="0.7" />

      {/* Barbell bar */}
      <rect x="20" y="29" width="24" height="6" rx="3" fill="white" />

      {/* Right collar */}
      <rect x="44" y="25" width="5" height="14" rx="2" fill="white" opacity="0.7" />

      {/* Right dumbbell plate */}
      <rect x="49" y="20" width="8" height="24" rx="3" fill="white" opacity="0.95" />

      {/* Center accent — subtle emerald shine */}
      <rect x="28" y="29" width="8" height="6" rx="2" fill="#34d399" opacity="0.6" />
    </svg>
  );
}

/**
 * Just the wordmark text "GymFlow" for use alongside the icon.
 */
export function GymFlowWordmark({
  className,
}: {
  className?: string;
}) {
  return (
    <span className={className}>
      Gym<span style={{ color: "#10b981" }}>Flow</span>
    </span>
  );
}
