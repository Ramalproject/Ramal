import { useEffect, useRef, useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ActionIcon, Text } from '@mantine/core'
import { IconArrowLeft, IconSparkles } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import { useAvatarState } from '../../hooks/useAvatarState'
import AIAvatar from '../../components/ai-voice/AIAvatar'
import StatusIndicator from '../../components/ai-voice/StatusIndicator'
import VoiceVisualizer from '../../components/ai-voice/VoiceVisualizer'
import UserCameraPreview from '../../components/ai-voice/UserCameraPreview'
import CallControls from '../../components/ai-voice/CallControls'
import { FEATURED_CHARACTERS } from '../../data/featuredCharacters'
import type { AiTwin } from '../../types'

const OPENAI_KEY_STORAGE = 'nexora_openai_api_key'

interface TranscriptEntry { role: 'user' | 'assistant'; text: string; id: string }

function formatDuration(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${m}:${sec.toString().padStart(2, '0')}`
}

function useTwin(id: string) {
  return useQuery({
    queryKey: ['ai-twin', id],
    queryFn: async () => {
      if (id.startsWith('featured-')) return FEATURED_CHARACTERS.find(c => c.id === id) ?? null
      const { data } = await supabase.from('ai_twins').select('*, owner:profiles!owner_id(*)').eq('id', id).single()
      return data as AiTwin
    },
    enabled: !!id,
  })
}

export default function AIConversationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { data: twin } = useTwin(id ?? '')
  const state = useAvatarState()

  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [liveText, setLiveText] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Web Audio for volume
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const volumeRafRef = useRef<number>(0)

  // Speech recognition
  const recogRef = useRef<any>(null)
  const historyRef = useRef<Array<{ role: string; content: string }>>([])

  const twinName = twin?.name ?? 'AI Twin'
  const avatarUrl = twin?.avatar_url ?? null

  // Scroll transcript to bottom
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [transcript, liveText])

  // Volume loop
  const startVolumeLoop = useCallback(() => {
    const loop = () => {
      if (analyserRef.current) {
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount)
        analyserRef.current.getByteFrequencyData(buf)
        const avg = buf.reduce((a, b) => a + b, 0) / buf.length
        state.setVolume(avg / 128)
      }
      volumeRafRef.current = requestAnimationFrame(loop)
    }
    loop()
  }, [state])

  const stopVolumeLoop = useCallback(() => {
    cancelAnimationFrame(volumeRafRef.current)
    state.setVolume(0)
  }, [state])

  // Start mic + volume tracking
  const startMic = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      micStreamRef.current = stream
      audioCtxRef.current = new AudioContext()
      analyserRef.current = audioCtxRef.current.createAnalyser()
      analyserRef.current.fftSize = 256
      const src = audioCtxRef.current.createMediaStreamSource(stream)
      src.connect(analyserRef.current)
      startVolumeLoop()
    } catch (_) {}
  }, [startVolumeLoop])

  const stopMic = useCallback(() => {
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    stopVolumeLoop()
  }, [stopVolumeLoop])

  // TTS via OpenAI
  const speak = useCallback(async (text: string) => {
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) {
      state.startSpeaking()
      setTimeout(() => {
        state.stopSpeaking()
        state.startListening()
        startListeningRef.current()
      }, 2200)
      return
    }

    state.startSpeaking()
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova', speed: 1.0 }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audio.onended = () => {
        state.stopSpeaking()
        state.startListening()
        startListeningRef.current()
        URL.revokeObjectURL(url)
      }
      audio.play()
    } catch (_) {
      state.stopSpeaking()
      state.startListening()
      startListeningRef.current()
    }
  }, [state])

  // Chat with OpenAI
  const chat = useCallback(async (userText: string) => {
    state.setThinking()
    historyRef.current.push({ role: 'user', content: userText })
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)

    let replyText = "I don't have an API key set up yet. Go to Settings and add your OpenAI key to enable real AI conversations!"

    if (apiKey) {
      try {
        const systemPrompt = twin
          ? `You are ${twin.name}, an AI character. ${twin.bio ?? ''} Personality: ${twin.personality}. Expertise: ${twin.expertise.join(', ')}. Keep responses conversational and under 3 sentences.`
          : `You are ${twinName}, a helpful AI twin. Keep responses conversational and under 3 sentences.`

        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: systemPrompt }, ...historyRef.current.slice(-10)],
            max_tokens: 150,
          }),
        })
        const json = await res.json()
        replyText = json.choices?.[0]?.message?.content ?? replyText
        historyRef.current.push({ role: 'assistant', content: replyText })
      } catch (_) {}
    }

    setTranscript(prev => [...prev, { role: 'assistant', text: replyText, id: Date.now().toString() }])
    await speak(replyText)
  }, [twin, twinName, state, speak])

  const liveTextRef = useRef('')
  useEffect(() => { liveTextRef.current = liveText }, [liveText])

  // Speech recognition — use ref to always have latest version in speak()
  const startListeningRef = useRef<() => void>(() => {})

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) {
      // Fallback: no SpeechRecognition — just stay in listening state briefly then go back to idle
      setTimeout(() => state.stopSpeaking(), 800)
      return
    }

    const recog = new SR()
    recogRef.current = recog
    recog.continuous = false
    recog.interimResults = true
    recog.lang = 'en-US'

    recog.onstart = () => { setLiveText('') }
    recog.onresult = (e: any) => {
      const t = Array.from(e.results as any[]).map((r: any) => r[0].transcript).join('')
      setLiveText(t)
    }
    recog.onerror = () => {
      setLiveText('')
      state.stopSpeaking()
    }
    recog.onend = () => {
      const final = liveTextRef.current.trim()
      setLiveText('')
      if (final) {
        setTranscript(prev => [...prev, { role: 'user', text: final, id: Date.now().toString() }])
        chat(final)
      } else {
        state.stopSpeaking()
      }
    }
    recog.start()
  }, [state, chat])

  // Keep ref current so speak() always calls latest startListening
  useEffect(() => { startListeningRef.current = startListening }, [startListening])

  const handlePrimary = useCallback(() => {
    if (state.phase === 'idle') {
      state.startListening()  // Immediate visual feedback — don't wait for onstart
      startMic()
      startListening()
    } else if (state.phase === 'listening') {
      recogRef.current?.stop()
    } else if (state.phase === 'speaking') {
      recogRef.current?.stop()
      state.setThinking()
    }
  }, [state, startMic, startListening])

  const handleEndCall = useCallback(() => {
    recogRef.current?.stop()
    stopMic()
    state.endCall()
  }, [state, stopMic])

  // Cleanup on unmount
  useEffect(() => () => {
    recogRef.current?.stop()
    stopMic()
    cancelAnimationFrame(volumeRafRef.current)
  }, [stopMic])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'linear-gradient(160deg, #0d0820 0%, #0f1729 40%, #070d1e 100%)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Ambient background orbs */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        <motion.div animate={{ scale: [1, 1.15, 1], opacity: [0.15, 0.25, 0.15] }} transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
          style={{ position: 'absolute', top: '10%', left: '15%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.3) 0%, transparent 70%)', filter: 'blur(40px)' }} />
        <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
          style={{ position: 'absolute', bottom: '15%', right: '10%', width: 350, height: 350, borderRadius: '50%', background: 'radial-gradient(circle, rgba(6,182,212,0.25) 0%, transparent 70%)', filter: 'blur(40px)' }} />
      </div>

      {/* Top bar */}
      <div style={{ position: 'relative', zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <ActionIcon variant="subtle" size="lg" onClick={() => navigate(-1)} style={{ color: 'rgba(255,255,255,0.6)' }}>
          <IconArrowLeft size={20} />
        </ActionIcon>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <IconSparkles size={14} color="#7c3aed" />
          <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.8)', letterSpacing: '0.02em' }}>
            AI Voice Chat
          </Text>
        </div>
        <div style={{ minWidth: 36, textAlign: 'right' }}>
          {state.phase !== 'idle' && state.phase !== 'ended' && (
            <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
              {formatDuration(state.duration)}
            </Text>
          )}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 28, padding: '24px 20px 0' }}>

        {/* Avatar area */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}
        >
          <AIAvatar phase={state.phase} avatarUrl={avatarUrl} volume={state.volume} />
          <StatusIndicator phase={state.phase} twinName={twinName} />
        </motion.div>

        {/* Voice visualizer */}
        <AnimatePresence>
          {(state.phase === 'listening' || state.phase === 'speaking') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ duration: 0.25 }}
            >
              <VoiceVisualizer phase={state.phase} volume={state.volume} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Transcript scroll area */}
        <div style={{ width: '100%', maxWidth: 480, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div
            ref={scrollRef}
            style={{ height: '100%', overflowY: 'auto', padding: '0 4px', scrollbarWidth: 'none' }}
          >
            <AnimatePresence initial={false}>
              {transcript.map(entry => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, y: 12, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  style={{
                    marginBottom: 10,
                    display: 'flex',
                    justifyContent: entry.role === 'user' ? 'flex-end' : 'flex-start',
                  }}
                >
                  <div style={{
                    maxWidth: '80%',
                    padding: '10px 14px',
                    borderRadius: entry.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: entry.role === 'user'
                      ? 'linear-gradient(135deg, rgba(124,58,237,0.35), rgba(91,33,182,0.35))'
                      : 'rgba(255,255,255,0.07)',
                    border: `1px solid ${entry.role === 'user' ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.08)'}`,
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.85)',
                    lineHeight: 1.5,
                  }}>
                    {entry.text}
                  </div>
                </motion.div>
              ))}

              {/* Live transcription */}
              {liveText && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}
                >
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px',
                    borderRadius: '18px 18px 4px 18px',
                    background: 'rgba(124,58,237,0.15)',
                    border: '1px solid rgba(124,58,237,0.2)',
                    fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5, fontStyle: 'italic',
                  }}>
                    {liveText}
                    <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>|</motion.span>
                  </div>
                </motion.div>
              )}

              {/* End state */}
              {state.phase === 'ended' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Text size="sm" c="dimmed">Call ended · {formatDuration(state.duration)}</Text>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{ position: 'relative', zIndex: 10, padding: '20px 20px 32px', borderTop: '1px solid rgba(255,255,255,0.05)' }}
      >
        {state.phase === 'ended' ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <motion.button
              whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
              onClick={state.reset}
              style={{ padding: '12px 28px', borderRadius: 50, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: 'white', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}
            >
              Call again
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }}
              onClick={() => navigate(-1)}
              style={{ padding: '12px 28px', borderRadius: 50, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: 'rgba(255,255,255,0.7)', background: 'transparent' }}
            >
              Go back
            </motion.button>
          </div>
        ) : (
          <CallControls
            phase={state.phase}
            isMuted={state.isMuted}
            isCameraOn={state.isCameraOn}
            onMicToggle={state.toggleMute}
            onCameraToggle={state.toggleCamera}
            onEndCall={handleEndCall}
            onPrimaryAction={handlePrimary}
          />
        )}
      </motion.div>

      {/* User camera PiP */}
      <AnimatePresence>
        {state.isCameraOn && (
          <UserCameraPreview
            isCameraOn={state.isCameraOn}
            isMuted={state.isMuted}
            userAvatarUrl={profile?.avatar_url}
            userName={profile?.full_name ?? 'You'}
          />
        )}
      </AnimatePresence>

      {/* Always show camera PiP container */}
      {!state.isCameraOn && state.phase !== 'idle' && state.phase !== 'ended' && (
        <UserCameraPreview
          isCameraOn={false}
          isMuted={state.isMuted}
          userAvatarUrl={profile?.avatar_url}
          userName={profile?.full_name ?? 'You'}
        />
      )}
    </div>
  )
}
