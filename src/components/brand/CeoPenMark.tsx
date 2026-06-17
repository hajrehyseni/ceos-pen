interface Props {
  className?: string;
  /** font-size in px (height auto via SVG aspect). */
  size?: number;
}

/**
 * CEO Pen signature wordmark — hand-set Caveat script with a tapering nib underline.
 * Uses currentColor so it inherits theme.
 */
export function CeoPenMark({ className, size = 32 }: Props) {
  return (
    <span
      className={`inline-flex items-center font-signature leading-none ${className || ""}`}
      style={{ fontSize: size, color: "currentColor" }}
      aria-label="CEO Pen"
    >
      <span className="relative inline-block">
        <span className="relative z-10">
          CEO <span className="italic">Pen</span>
        </span>
        {/* nib underline */}
        <svg
          viewBox="0 0 120 12"
          preserveAspectRatio="none"
          className="absolute left-0 right-0 -bottom-1 w-full"
          style={{ height: size * 0.28 }}
          aria-hidden
        >
          <path
            d="M2 6 C 30 2, 70 2, 110 5 L 118 8 L 112 9 C 80 11, 35 11, 4 9 Z"
            fill="currentColor"
            opacity="0.85"
          />
        </svg>
      </span>
    </span>
  );
}
