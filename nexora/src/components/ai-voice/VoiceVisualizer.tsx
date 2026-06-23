import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { AvatarPhase } from '../../hooks/useAvatarState'

interface Props {
  phase: AvatarPhase
  volume?: number
}

const BAR_COUNT = 28

export default function VoiceVisualizer({ phase, volume = 0 }: Props) {
  const barsRef = useRef<number[]>(Array.from({ length: BAR_COUNT }, () => Math.random()))

  useEffect(() => {
    if (phase === 'speaking' || phase === 'listening') {
      const id = setInterval(() => {
        barsRef.current = Array.from({ length: BAR_COUNT }, (_, i) => {
          const center = Math.abs(i - BAR_COUNT / 2) / (BAR_COUNT / 2)
          return Math.random() * (0.3 + volume * 0.7) * (1 - center * 0.4)
        })
      }, 80)
      return () => clearInterval(id)
    }
  }, [phase, volume])

  const isActive = phase === 'listening' || phase === 'speaking'
  const color = phase === 'listening' ? '#7c3aed' : phase === 'speaking' ? '#06b6d4' : '#4a5568'

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 48 }}>
      {Array.from({ length: BAR_COUNT }, (_, i) => {
        const isMid = Math.abs(i - BAR_COUNT / 2) < BAR_COUNT * 0.3
        const baseHeight = isActive ? (isMid ? 28 : 14) : 6

        return (
          <motion.div
            key={i}
            style={{ width: 3, borderRadius: 4, background: color, transformOrigin: 'center' }}
            animate={{
              height: isActive
                ? [baseHeight, baseHeight + Math.random() * 20, baseHeight]
                : [4, 7, 4],
              opacity: isActive ? [0.7, 1, 0.7] : [0.3, 0.5, 0.3],
            }}
            transition={{
              duration: isActive ? 0.4 + Math.random() * 0.3 : 1.5,
              repeat: Infinity,
              delay: i * 0.03,
              ease: 'easeInOut',
            }}
          />
        )
      })}
    </div>
  )
}
