/**
 * A place setting seen from above: fork, plate (rim and well) and knife,
 * drawn in fine lines. Stands in for a dish photo.
 */
export function PlateGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 36 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx={18} cy={12} r={10.5} vectorEffect="non-scaling-stroke" />
      <circle cx={18} cy={12} r={7} vectorEffect="non-scaling-stroke" />
      <path d="M2 4.5v3.5M3.5 4.5v3.5M5 4.5v3.5M2 8c0 1.2 0.7 1.8 1.5 1.8S5 9.2 5 8M3.5 9.8V19.5" vectorEffect="non-scaling-stroke" />
      <path d="M32.6 4.5c1.6 1.4 1.8 5.4 0 7.2v7.8" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
