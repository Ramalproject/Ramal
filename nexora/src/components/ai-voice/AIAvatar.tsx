import { motion } from 'framer-motion'
import { Avatar } from '@mantine/core'
import type { AvatarPhase } from '../../hooks/useAvatarState'
import AnimatedRings from './AnimatedRings'

interface Props {
  phase: AvatarPhase
  avatarUrl?: string | null
  volume?: number
}

const PHASE_GLOW: Record<AvatarPhase, string> = {
  idle: '0 0 30px rgba(124,58,237,0.2)',
  listening: '0 0 50px rgba(124,58,237,0.6), 0 0 100px rgba(124,58,237,0.2)',
  thinking: '0 0 50px rgba(6,182,212,0.6), 0 0 100px rgba(6,182,212,0.2)',
  speaking: '0 0 50px rgba(6,182,212,0.7), 0 0 120px rgba(6,182,212,0.3)',
  ended: '0 0 20px rgba(124,58,237,0.1)',
}

const PHASE_BORDER: Record<AvatarPhase, string> = {
  idle: '3px solid rgba(124,58,237,0.4)',
  listening: '3px solid #7c3aed',
  thinking: '3px solid #06b6d4',
  speaking: '3px solid #06b6d4',
  ended: '3px solid rgba(124,58,237,0.2)',
}

export default function AIAvatar({ phase, avatarUrl, volume = 0 }: Props) {
  return (
    <div style={{ position: 'relative', width: 130, height: 130, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <AnimatedRings phase={phase} volume={volume} />

      <motion.div
        animate={{
          scale: phase === 'speaking' ? [1, 1.04 + volume * 0.06, 1] : phase === 'listening' ? [1, 1.02, 1] : 1,
          boxShadow: PHASE_GLOW[phase],
        }}
        transition={{
          scale: { duration: 0.6, repeat: phase === 'speaking' || phase === 'listening' ? Infinity : 0, ease: 'easeInOut' },
          boxShadow: { duration: 0.4 },
        }}
        style={{
          width: 120,
          height: 120,
          borderRadius: '50%',
          overflow: 'hidden',
          border: PHASE_BORDER[phase],
          position: 'relative',
          zIndex: 1,
          transition: 'border 0.3s',
          flexShrink: 0,
        }}
      >
        <Avatar
          src={avatarUrl}
          size={120}
          radius="xl"
          style={{ width: '100%', height: '100%' }}
        >
          <span style={{ fontSize: 42 }}>🤖</span>
        </Avatar>

        {/* Thinking shimmer overlay */}
        {phase === 'thinking' && (
          <motion.div
            style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'linear-gradient(135deg, transparent 30%, rgba(6,182,212,0.25) 60%, transparent 90%)',
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
          />
        )}
      </motion.div>
    </div>
  )
}
