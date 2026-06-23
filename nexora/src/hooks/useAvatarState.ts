import { useState, useRef, useCallback, useEffect } from 'react'

export type AvatarPhase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'ended'

export interface AvatarState {
  phase: AvatarPhase
  isMuted: boolean
  isCameraOn: boolean
  volume: number
  transcript: string
  duration: number
}

export interface AvatarActions {
  startListening: () => void
  stopListening: () => void
  setThinking: () => void
  startSpeaking: () => void
  stopSpeaking: () => void
  toggleMute: () => void
  toggleCamera: () => void
  setVolume: (v: number) => void
  endCall: () => void
  reset: () => void
}

export function useAvatarState(): AvatarState & AvatarActions {
  const [phase, setPhase] = useState<AvatarPhase>('idle')
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [volume, setVolumeState] = useState(0)
  const [transcript, setTranscript] = useState('')
  const [duration, setDuration] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (phase !== 'idle' && phase !== 'ended') {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  const startListening = useCallback(() => setPhase('listening'), [])
  const stopListening = useCallback(() => setPhase('thinking'), [])
  const setThinking = useCallback(() => setPhase('thinking'), [])
  const startSpeaking = useCallback(() => setPhase('speaking'), [])
  const stopSpeaking = useCallback(() => setPhase('idle'), [])
  const toggleMute = useCallback(() => setIsMuted(m => !m), [])
  const toggleCamera = useCallback(() => setIsCameraOn(c => !c), [])
  const setVolume = useCallback((v: number) => setVolumeState(v), [])
  const endCall = useCallback(() => {
    setPhase('ended')
    setTranscript('')
  }, [])
  const reset = useCallback(() => {
    setPhase('idle')
    setIsMuted(false)
    setIsCameraOn(false)
    setVolumeState(0)
    setTranscript('')
    setDuration(0)
  }, [])

  return {
    phase, isMuted, isCameraOn, volume, transcript, duration,
    startListening, stopListening, setThinking, startSpeaking,
    stopSpeaking, toggleMute, toggleCamera, setVolume, endCall, reset,
  }
}
