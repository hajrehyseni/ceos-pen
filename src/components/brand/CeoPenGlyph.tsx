interface Props {
  size?: number;
  className?: string;
}

/**
 * CP monogram tile — clean editorial serif on indigo. Used for favicon,
 * app icon, splash, and empty-state markers.
 */
export function CeoPenGlyph({ size = 32, className }: Props) {
  return (
    <span
      className={`relative inline-flex items-center justify-center rounded-[26%] ${className || ""}`}
      style={{
        width: size,
        height: size,
        background: "hsl(var(--primary))",
        boxShadow: "inset 0 1px 0 hsl(0 0% 100% / 0.12)",
      }}
      aria-hidden
    >
      <span
        className="font-serif font-semibold tracking-tight text-primary-foreground leading-none"
        style={{ fontSize: size * 0.5 }}
      >
        CP<span className="opacity-90">.</span>
      </span>
    </span>
  );
}
