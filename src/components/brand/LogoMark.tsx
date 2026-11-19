/**
 * Parking Counter logo mark: a bold parking "P" locked inside four amber
 * corner brackets - the same detection-box marks the app draws around
 * every vehicle. "A parking spot, being detected."
 *
 * The same artwork is used for the favicon (src/app/icon.svg).
 */
export function LogoMark({ size = 30, className }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} aria-hidden>
      {/* detection brackets */}
      <path
        d="M6 20V6h14M44 6h14v14M58 44v14H44M20 58H6V44"
        fill="none"
        stroke="#f2b544"
        strokeWidth="6"
        strokeLinecap="square"
      />
      {/* the P */}
      <path
        fillRule="evenodd"
        fill="#f3f1ec"
        d="M21 15h15.5a12 12 0 0 1 0 24H30v10h-9zM30 23v8h6a4 4 0 0 0 0-8z"
      />
      {/* tracking point: where the counter "anchors" a vehicle */}
      <rect x="40" y="43" width="6" height="6" fill="#f2b544" />
    </svg>
  );
}
