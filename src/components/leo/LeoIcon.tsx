import { COLORS } from '@/lib/tokens'

interface LeoIconProps {
  size?: number
  /** 'leo' = leoAmber (AI content), 'signal' = cyan (platform use) */
  variant?: 'leo' | 'signal'
  className?: string
}

/**
 * Leo geometric lion mark.
 * Used in the briefing panel header, chat, and bubble.
 */
export function LeoIcon({ size = 24, variant = 'leo', className }: LeoIconProps) {
  const c = variant === 'leo' ? COLORS.leoAmber : COLORS.signal

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      className={className}
      aria-label="Leo"
    >
      {/* Mane — outer halo */}
      {[0, 30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330].map((deg) => {
        const r = (deg * Math.PI) / 180
        return (
          <circle
            key={deg}
            cx={(16 + Math.cos(r) * 10.5).toFixed(1)}
            cy={(16 + Math.sin(r) * 10.5).toFixed(1)}
            r="1.6"
            fill={c}
            opacity="0.65"
          />
        )
      })}
      {/* Face */}
      <circle cx="16" cy="16" r="7.5" fill={c} opacity="0.08" />
      <circle cx="16" cy="16" r="7.5" stroke={c} strokeWidth="1" fill="none" />
      {/* Eyes */}
      <circle cx="13.5" cy="15" r="1.2" fill={c} />
      <circle cx="18.5" cy="15" r="1.2" fill={c} />
      <circle cx="13.8" cy="14.7" r="0.45" fill={COLORS.void} />
      <circle cx="18.8" cy="14.7" r="0.45" fill={COLORS.void} />
      {/* Nose */}
      <path d="M15.2 17.5 L16 18.5 L16.8 17.5 Z" fill={c} opacity="0.8" />
      {/* Mouth */}
      <path d="M14.2 18.8 Q16 20 17.8 18.8" stroke={c} strokeWidth="0.7" fill="none" strokeLinecap="round" opacity="0.6" />
      {/* Ears */}
      <path d="M10.5 10.5 L12 13.5 L14 11.5 Z" fill={c} opacity="0.55" />
      <path d="M21.5 10.5 L20 13.5 L18 11.5 Z" fill={c} opacity="0.55" />
      {/* Circuit lines */}
      <line x1="7" y1="16" x2="9" y2="16" stroke={c} strokeWidth="0.5" opacity="0.4" />
      <line x1="23" y1="16" x2="25" y2="16" stroke={c} strokeWidth="0.5" opacity="0.4" />
      <line x1="7" y1="16" x2="7" y2="19" stroke={c} strokeWidth="0.5" opacity="0.4" />
      <line x1="25" y1="16" x2="25" y2="19" stroke={c} strokeWidth="0.5" opacity="0.4" />
    </svg>
  )
}
