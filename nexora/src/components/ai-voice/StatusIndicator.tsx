import { motion, AnimatePresence } from 'framer-motion'
import type { AvatarPhase } from '../../hooks/useAvatarState'

interface Props {
  phase: AvatarPhase
  twinName: string
}

const PHASE_CONFIG: Record<AvatarPhase, { label: string; color: string; dot: string }> = {
  idle: { label: 'Ready to talk', color: 'rgba(124,58,237,0.7)', dot: '#7c3aed' },
  listening: { label: 'Listening...', color: 'rgba(124,58,237,1)', dot: '#7c3aed' },
  thinking: { label: 'Thinking...', color: 'rgba(6,182,212,0.9)', dot: '#06b6d4' },
  speaking: { label: 'Speaking...', color: 'rgba(6,182,212,1)', dot: '#06b6d4' },
  ended: { label: 'Call ended', color: 'rgba(239,68,68,0.7)', dot: '#ef4444' },
}

export default function StatusIndicator({ phase, twinName }: Props) {
  const cfg = PHASE_CONFIG[phase]

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 8, letterSpacing: '-0.3px' }}>
        {twinName}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.2 }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
        >
          <motion.div
            style={{ width: 8, height: 8, borderRadius: '50%', background: cfg.dot, flexShrink: 0 }}
            animate={{ scale: [1, 1.4, 1], opacity: [1, 0.6, 1] }}
            transition={{ duration: phase === 'thinking' ? 0.8 : 1.4, repeat: Infinity, ease: 'easeInOut' }}
          />
          <span style={{ fontSize: 13, fontWeight: 500, color: cfg.color, letterSpacing: '0.02em' }}>
            {cfg.label}
          </span>
        </motion.div>
      </AnimatePresence>

      {/* Thinking dots */}
      {phase === 'thinking' && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
          {[0, 1, 2].map(i => (
            <motion.div
              key={i}
              style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4' }}
              animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
              transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18, ease: 'easeInOut' }}
            />
          ))}
        </div>
      )}
    </div>
  )
}
