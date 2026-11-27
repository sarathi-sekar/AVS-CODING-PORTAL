interface Props {
  variant?: 'mark' | 'full';
  className?: string;
}

/** AVSEC-Salem logo. The artwork is navy on white, so it always sits on a white tile (also in dark mode). */
export function Logo({ variant = 'mark', className = '' }: Props) {
  const src = variant === 'mark' ? '/logo-mark.png' : '/logo.png';
  return (
    <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white ${className}`}>
      <img src={src} alt="AVSEC Salem logo" className="h-full w-full object-contain" draggable={false} />
    </span>
  );
}
