import { motion } from 'framer-motion'
import type { AvatarPhase } from '../../hooks/useAvatarState'

interface Props {
  phase: AvatarPhase
  volume?: number
}

const RING_COUNT = 4

export default function AnimatedRings({ phase, volume = 0 }: Props) {
  const isActive = phase === 'listening' || phase === 'speaking'
  const isThinking = phase === 'thinking'

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
      {Array.from({ length: RING_COUNT }, (_, i) => {
        const baseSize = 140 + i * 52
        const delay = i * 0.18
        const volumeScale = isActive ? 1 + volume * 0.35 * (1 - i * 0.18) : 1

        return (
          <motion.div
            key={i}
            style={{
              position: 'absolute',
              width: baseSize,
              height: baseSize,
              borderRadius: '50%',
              border: `${2 - i * 0.3}px solid`,
              borderColor: isThinking
                ? `rgba(6,182,212,${0.5 - i * 0.1})`
                : isActive
                  ? `rgba(124,58,237,${0.6 - i * 0.12})`
                  : `rgba(124,58,237,${0.2 - i * 0.04})`,
            }}
            animate={
              isThinking
                ? { scale: [1, 1.08, 1], opacity: [0.6, 1, 0.6], rotate: [0, 360] }
                : isActive
                  ? { scale: [1 * volumeScale, 1.06 * volumeScale, 1 * volumeScale], opacity: [0.7, 1, 0.7] }
                  : { scale: [1, 1.03, 1], opacity: [0.2, 0.35, 0.2] }
            }
            transition={
              isThinking
                ? { duration: 2.5, repeat: Infinity, delay, ease: 'linear' }
                : isActive
                  ? { duration: 1.2 + i * 0.15, repeat: Infinity, delay, ease: 'easeInOut' }
                  : { duration: 3 + i * 0.4, repeat: Infinity, delay, ease: 'easeInOut' }
            }
          />
        )
      })}
    </div>
  )
}
