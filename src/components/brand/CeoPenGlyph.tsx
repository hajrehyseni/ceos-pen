interface Props {
  size?: number;
  className?: string;
}

/**
 * Compact glyph: monogram "cp" in signature script, inside a softly rounded
 * indigo tile. Used as app icon and header lockup.
 */
export function CeoPenGlyph({ size = 32, className }: Props) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-[28%] ${className || ""}`}
      style={{
        width: size,
        height: size,
        background:
          "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-glow)) 100%)",
        boxShadow:
          "inset 0 1px 0 hsl(0 0% 100% / 0.18), 0 6px 18px -6px hsl(var(--primary) / 0.55)",
      }}
      aria-hidden
    >
      <span
        className="font-signature text-white leading-none"
        style={{ fontSize: size * 0.7, transform: "translateY(-2%)" }}
      >
        cp
      </span>
      <svg
        viewBox="0 0 40 6"
        preserveAspectRatio="none"
        className="absolute left-[18%] right-[18%]"
        style={{ bottom: size * 0.18, height: size * 0.08 }}
      >
        <path
          d="M1 3 C 12 1, 28 1, 38 3 L 39 4 L 36 4.5 C 24 5.5, 14 5.5, 2 4.5 Z"
          fill="white"
          opacity="0.9"
        />
      </svg>
    </span>
  );
}
