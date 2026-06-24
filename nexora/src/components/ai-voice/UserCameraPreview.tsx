import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@mantine/core'
import { IconVideoOff } from '@tabler/icons-react'

interface Props {
  isCameraOn: boolean
  isMuted: boolean
  userAvatarUrl?: string | null
  userName: string
}

export default function UserCameraPreview({ isCameraOn, isMuted, userAvatarUrl, userName }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    if (isCameraOn) {
      if (!navigator.mediaDevices?.getUserMedia) return   // HTTP / unsupported browser
      navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
        .then(stream => {
          streamRef.current = stream
          if (videoRef.current) {
            videoRef.current.srcObject = stream
          }
        })
        .catch(() => {})
    } else {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop())
        streamRef.current = null
      }
      if (videoRef.current) videoRef.current.srcObject = null
    }
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
    }
  }, [isCameraOn])

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      style={{
        position: 'absolute', bottom: 100, right: 16,
        width: 110, height: 150, borderRadius: 16,
        overflow: 'hidden', border: '2px solid rgba(124,58,237,0.5)',
        background: '#0f0a1e', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        zIndex: 10,
      }}
    >
      <AnimatePresence>
        {isCameraOn ? (
          <motion.video
            key="video"
            ref={videoRef}
            autoPlay
            playsInline
            muted
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }}
          />
        ) : (
          <motion.div
            key="avatar"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              width: '100%', height: '100%',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
              background: 'linear-gradient(135deg, rgba(124,58,237,0.15), rgba(6,182,212,0.1))',
            }}
          >
            <Avatar src={userAvatarUrl} size={52} radius="xl" style={{ border: '2px solid rgba(124,58,237,0.5)' }}>
              {userName?.[0]?.toUpperCase()}
            </Avatar>
            <IconVideoOff size={14} color="rgba(255,255,255,0.4)" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Muted indicator */}
      {isMuted && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          background: 'rgba(239,68,68,0.9)', borderRadius: 8,
          padding: '2px 6px', fontSize: 10, color: 'white', fontWeight: 600,
        }}>
          MUTED
        </div>
      )}

      {/* Name tag */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
        padding: '16px 8px 6px',
        fontSize: 11, color: 'white', fontWeight: 600, textAlign: 'center',
      }}>
        You
      </div>
    </motion.div>
  )
}
