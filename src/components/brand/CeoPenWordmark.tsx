interface Props {
  size?: number;
  className?: string;
}

/**
 * Premium editorial wordmark for CEO Pen.
 * Fraunces semibold with a tinted full-stop accent.
 */
export function CeoPenWordmark({ size = 20, className }: Props) {
  return (
    <span
      className={`font-serif font-semibold tracking-[-0.01em] leading-none ${className || ""}`}
      style={{ fontSize: size, color: "currentColor" }}
      aria-label="CEO Pen"
    >
      CEO Pen<span className="text-primary">.</span>
    </span>
  );
}
