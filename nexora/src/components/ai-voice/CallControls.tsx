import { motion } from 'framer-motion'
import { ActionIcon, Tooltip } from '@mantine/core'
import {
  IconMicrophone, IconMicrophoneOff, IconVideo, IconVideoOff,
  IconPhoneOff, IconKeyboard,
} from '@tabler/icons-react'
import type { AvatarPhase } from '../../hooks/useAvatarState'

interface Props {
  phase: AvatarPhase
  isMuted: boolean
  isCameraOn: boolean
  onMicToggle: () => void
  onCameraToggle: () => void
  onEndCall: () => void
  onPrimaryAction: () => void
  textMode?: boolean
}

export default function CallControls({
  phase, isMuted, isCameraOn,
  onMicToggle, onCameraToggle, onEndCall, onPrimaryAction, textMode,
}: Props) {
  const isActive = phase !== 'idle' && phase !== 'ended'

  const primaryLabel = phase === 'idle'
    ? 'Start Talking'
    : phase === 'listening'
      ? (textMode ? 'Send Message' : 'Stop')
      : phase === 'thinking' ? 'Thinking…' : 'Interrupt'
  const primaryColor = phase === 'listening' ? '#7c3aed' : phase === 'speaking' ? '#06b6d4' : '#7c3aed'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Secondary controls */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <Tooltip label={isMuted ? 'Unmute' : 'Mute'} position="top" withArrow>
          <motion.div whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}>
            <ActionIcon
              onClick={onMicToggle}
              size={48}
              radius="xl"
              variant="filled"
              style={{
                background: isMuted ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${isMuted ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.15)'}`,
                color: isMuted ? '#ef4444' : 'rgba(255,255,255,0.7)',
              }}
            >
              {isMuted ? <IconMicrophoneOff size={20} /> : <IconMicrophone size={20} />}
            </ActionIcon>
          </motion.div>
        </Tooltip>

        <Tooltip label={isCameraOn ? 'Camera off' : 'Camera on'} position="top" withArrow>
          <motion.div whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}>
            <ActionIcon
              onClick={onCameraToggle}
              size={48}
              radius="xl"
              variant="filled"
              style={{
                background: isCameraOn ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${isCameraOn ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.15)'}`,
                color: isCameraOn ? '#06b6d4' : 'rgba(255,255,255,0.7)',
              }}
            >
              {isCameraOn ? <IconVideo size={20} /> : <IconVideoOff size={20} />}
            </ActionIcon>
          </motion.div>
        </Tooltip>

        <Tooltip label="Keyboard" position="top" withArrow>
          <motion.div whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }}>
            <ActionIcon
              size={48}
              radius="xl"
              variant="filled"
              style={{
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)',
              }}
            >
              <IconKeyboard size={20} />
            </ActionIcon>
          </motion.div>
        </Tooltip>
      </div>

      {/* Primary row: talk + end */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
        {/* Main talk button */}
        <motion.button
          onClick={onPrimaryAction}
          disabled={phase === 'thinking'}
          whileHover={{ scale: phase === 'thinking' ? 1 : 1.04 }}
          whileTap={{ scale: phase === 'thinking' ? 1 : 0.95 }}
          style={{
            padding: '14px 32px',
            borderRadius: 50,
            border: 'none',
            cursor: phase === 'thinking' ? 'not-allowed' : 'pointer',
            fontWeight: 700,
            fontSize: 15,
            letterSpacing: '0.02em',
            color: 'white',
            background: phase === 'thinking'
              ? 'rgba(6,182,212,0.3)'
              : `linear-gradient(135deg, ${primaryColor}, ${phase === 'listening' ? '#5b21b6' : '#0891b2'})`,
            boxShadow: phase === 'thinking' ? 'none' : `0 4px 24px ${primaryColor}55`,
            transition: 'background 0.3s, box-shadow 0.3s',
            minWidth: 160,
          }}
        >
          {phase === 'listening' && (
            <motion.span
              animate={{ opacity: [1, 0.5, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ marginRight: 8, fontSize: 12 }}
            >
              ●
            </motion.span>
          )}
          {primaryLabel}
        </motion.button>

        {/* End call */}
        {isActive && (
          <Tooltip label="End call" position="top" withArrow>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileTap={{ scale: 0.9 }}
              whileHover={{ scale: 1.05 }}
            >
              <ActionIcon
                onClick={onEndCall}
                size={52}
                radius="xl"
                style={{
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
                  border: 'none',
                }}
              >
                <IconPhoneOff size={22} color="white" />
              </ActionIcon>
            </motion.div>
          </Tooltip>
        )}
      </div>
    </div>
  )
}
