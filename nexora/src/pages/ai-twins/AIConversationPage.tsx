import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ActionIcon, Text } from '@mantine/core'
import { IconArrowLeft, IconSparkles, IconSend } from '@tabler/icons-react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuthStore } from '../../store/useAuthStore'
import AIAvatar from '../../components/ai-voice/AIAvatar'
import UserCameraPreview from '../../components/ai-voice/UserCameraPreview'
import { FEATURED_CHARACTERS } from '../../data/featuredCharacters'
import type { AiTwin } from '../../types'

const OPENAI_KEY = 'nexora_openai_api_key'

type Phase = 'idle' | 'listening' | 'thinking' | 'speaking' | 'ended'
interface Entry { role: 'user' | 'assistant'; text: string; id: string }

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
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

const PHASE_LABEL: Record<Phase, string> = {
  idle: 'Ready to talk', listening: 'Listening…', thinking: 'Thinking…',
  speaking: 'Speaking…', ended: 'Call ended',
}
const PHASE_COLOR: Record<Phase, string> = {
  idle: 'rgba(124,58,237,0.7)', listening: '#a78bfa', thinking: '#06b6d4',
  speaking: '#06b6d4', ended: '#ef4444',
}

export default function AIConversationPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { profile } = useAuthStore()
  const { data: twin } = useTwin(id ?? '')

  const [phase, setPhase] = useState<Phase>('idle')
  const [volume, setVolume] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [transcript, setTranscript] = useState<Entry[]>([])
  const [liveText, setLiveText] = useState('')
  const [textInput, setTextInput] = useState('')
  const [textMode, setTextMode] = useState(false)
  const [duration, setDuration] = useState(0)

  const scrollRef = useRef<HTMLDivElement>(null)
  const textInputRef = useRef<HTMLInputElement>(null)
  const recogRef = useRef<any>(null)
  const historyRef = useRef<Array<{ role: string; content: string }>>([])
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const micStreamRef = useRef<MediaStream | null>(null)
  const volRafRef = useRef(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const liveTextRef = useRef('')
  const phaseRef = useRef<Phase>('idle')

  const twinName = twin?.name ?? 'AI Twin'
  const avatarUrl = twin?.avatar_url ?? null

  // Keep refs in sync
  useEffect(() => { liveTextRef.current = liveText }, [liveText])
  useEffect(() => { phaseRef.current = phase }, [phase])

  // Duration timer
  useEffect(() => {
    if (phase !== 'idle' && phase !== 'ended') {
      timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    } else {
      if (timerRef.current) clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [phase])

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [transcript, liveText])

  // ── Mic / Volume ──────────────────────────────────────────────────────────
  function stopMic() {
    micStreamRef.current?.getTracks().forEach(t => t.stop())
    micStreamRef.current = null
    audioCtxRef.current?.close()
    audioCtxRef.current = null
    analyserRef.current = null
    cancelAnimationFrame(volRafRef.current)
    setVolume(0)
  }

  // ── Speech Recognition ────────────────────────────────────────────────────
  function switchToTextMode() {
    setTextMode(true)
    setTimeout(() => textInputRef.current?.focus(), 150)
  }

  function doStartListening() {
    if (textMode) {
      setTimeout(() => textInputRef.current?.focus(), 150)
      return
    }

    const SR = (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition
    if (!SR) {
      switchToTextMode()
      return
    }

    let recog: any
    try { recog = new SR() } catch {
      switchToTextMode()
      return
    }
    recogRef.current = recog
    recog.continuous = false
    recog.interimResults = true
    recog.lang = 'en-US'
    recog.onstart = () => setLiveText('')
    recog.onresult = (e: any) => {
      setLiveText(Array.from(e.results as any[]).map((r: any) => r[0].transcript).join(''))
    }
    recog.onerror = (ev: any) => {
      setLiveText('')
      const err = ev?.error ?? ''
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        switchToTextMode()
      } else if (phaseRef.current === 'listening') {
        setTimeout(doStartListening, 600)
      }
    }
    recog.onend = () => {
      const final = liveTextRef.current.trim()
      setLiveText('')
      if (final) {
        addEntry('user', final)
        doChat(final)
      } else if (phaseRef.current === 'listening' && !textMode) {
        setTimeout(doStartListening, 400)
      }
    }
    try { recog.start() } catch {
      switchToTextMode()
    }
  }

  // ── TTS ───────────────────────────────────────────────────────────────────
  async function doSpeak(text: string) {
    const apiKey = localStorage.getItem(OPENAI_KEY)
    setPhase('speaking')
    const resume = () => {
      setPhase('listening')
      if (textMode) setTimeout(() => textInputRef.current?.focus(), 150)
      else doStartListening()
    }
    if (!apiKey) { setTimeout(resume, 2500); return }
    try {
      const res = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova', speed: 1.0 }),
      })
      const url = URL.createObjectURL(await res.blob())
      const audio = new Audio(url)
      audio.onended = () => { URL.revokeObjectURL(url); resume() }
      audio.onerror = () => resume()
      audio.play()
    } catch { resume() }
  }

  // ── Chat ──────────────────────────────────────────────────────────────────
  async function doChat(userText: string) {
    setPhase('thinking')
    historyRef.current.push({ role: 'user', content: userText })
    const apiKey = localStorage.getItem(OPENAI_KEY)
    let reply = "I don't have an API key yet — go to Settings → API Keys to add your OpenAI key!"
    if (apiKey) {
      try {
        const sys = twin
          ? `You are ${twin.name}. ${twin.bio ?? ''} Personality: ${twin.personality}. Expertise: ${twin.expertise.join(', ')}. Keep replies under 3 sentences.`
          : `You are ${twinName}. Keep replies under 3 sentences.`
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: sys }, ...historyRef.current.slice(-10)], max_tokens: 150 }),
        })
        reply = (await res.json()).choices?.[0]?.message?.content ?? reply
        historyRef.current.push({ role: 'assistant', content: reply })
      } catch (_) {}
    }
    addEntry('assistant', reply)
    await doSpeak(reply)
  }

  function addEntry(role: 'user' | 'assistant', text: string) {
    setTranscript(prev => [...prev, { role, text, id: Date.now().toString() + Math.random() }])
  }

  // ── Button actions ────────────────────────────────────────────────────────
  function handleStart() {
    setPhase('listening')
    const hasSR = !!(window as any).SpeechRecognition || !!(window as any).webkitSpeechRecognition
    if (!hasSR) {
      // No speech recognition — go straight to text mode
      switchToTextMode()
      return
    }
    doStartListening()
  }

  function handleStop() {
    recogRef.current?.stop()
  }

  function handleInterrupt() {
    recogRef.current?.stop()
    setPhase('thinking')
  }

  function handleEnd() {
    recogRef.current?.stop()
    stopMic()
    setPhase('ended')
  }

  function handleReset() {
    stopMic()
    recogRef.current?.stop()
    setPhase('idle')
    setTranscript([])
    setLiveText('')
    setTextInput('')
    setTextMode(false)
    setDuration(0)
    historyRef.current = []
  }

  function handleTextSend() {
    const text = textInput.trim()
    if (!text || phase === 'thinking' || phase === 'speaking') return
    setTextInput('')
    addEntry('user', text)
    doChat(text)
  }

  // Cleanup on unmount
  useEffect(() => () => {
    recogRef.current?.stop()
    stopMic()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isActive = phase !== 'idle' && phase !== 'ended'

  const primaryLabel = phase === 'idle' ? 'Start Talking'
    : phase === 'listening' ? 'Listening…'
    : phase === 'thinking' ? 'Thinking…'
    : 'Interrupt'

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'linear-gradient(160deg, #0d0820 0%, #0f1729 40%, #070d1e 100%)',
      display: 'flex', flexDirection: 'column', overflow: 'hidden',
    }}>
      {/* Ambient orbs */}
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
          <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.8)', letterSpacing: '0.02em' }}>AI Voice Chat</Text>
        </div>
        <Text size="xs" style={{ color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>
          {isActive ? fmtTime(duration) : ''}
        </Text>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '24px 20px 0', overflow: 'hidden' }}>

        {/* Avatar + status */}
        <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.5 }}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
          <AIAvatar phase={phase} avatarUrl={avatarUrl} volume={volume} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ color: 'white', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>{twinName}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <motion.div style={{ width: 8, height: 8, borderRadius: '50%', background: PHASE_COLOR[phase] }}
                animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: PHASE_COLOR[phase] }}>
                {textMode && phase === 'listening' ? 'Type your message below' : PHASE_LABEL[phase]}
              </span>
            </div>
            {phase === 'thinking' && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 8 }}>
                {[0, 1, 2].map(i => (
                  <motion.div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4' }}
                    animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.18 }} />
                ))}
              </div>
            )}
          </div>
        </motion.div>

        {/* Transcript */}
        <div style={{ width: '100%', maxWidth: 480, flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div ref={scrollRef} style={{ height: '100%', overflowY: 'auto', padding: '0 4px', scrollbarWidth: 'none' }}>
            <AnimatePresence initial={false}>
              {transcript.map(e => (
                <motion.div key={e.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}
                  style={{ marginBottom: 10, display: 'flex', justifyContent: e.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  <div style={{
                    maxWidth: '80%', padding: '10px 14px', fontSize: 13, lineHeight: 1.5, color: 'rgba(255,255,255,0.85)',
                    borderRadius: e.role === 'user' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
                    background: e.role === 'user' ? 'linear-gradient(135deg, rgba(124,58,237,0.4), rgba(91,33,182,0.4))' : 'rgba(255,255,255,0.08)',
                    border: `1px solid ${e.role === 'user' ? 'rgba(124,58,237,0.35)' : 'rgba(255,255,255,0.1)'}`,
                  }}>{e.text}</div>
                </motion.div>
              ))}
              {liveText && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
                  <div style={{ maxWidth: '80%', padding: '10px 14px', borderRadius: '18px 18px 4px 18px', background: 'rgba(124,58,237,0.15)', border: '1px solid rgba(124,58,237,0.2)', fontSize: 13, color: 'rgba(255,255,255,0.5)', fontStyle: 'italic' }}>
                    {liveText}<motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>|</motion.span>
                  </div>
                </motion.div>
              )}
              {phase === 'ended' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '16px 0' }}>
                  <Text size="sm" c="dimmed">Call ended · {fmtTime(duration)}</Text>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Text input — auto-shown when voice unavailable or user opts in */}
      <AnimatePresence>
        {textMode && isActive && (
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
            style={{ position: 'relative', zIndex: 11, padding: '12px 20px 0', display: 'flex', gap: 8 }}>
            <input
              ref={textInputRef}
              type="text"
              placeholder={phase === 'thinking' || phase === 'speaking' ? 'AI is responding…' : 'Type your message…'}
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleTextSend() }}
              disabled={phase === 'thinking' || phase === 'speaking'}
              style={{
                flex: 1, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(124,58,237,0.5)',
                borderRadius: 24, padding: '11px 18px', color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box',
                opacity: (phase === 'thinking' || phase === 'speaking') ? 0.5 : 1,
              }}
            />
            <motion.button whileTap={{ scale: 0.92 }} onClick={handleTextSend}
              disabled={!textInput.trim() || phase === 'thinking' || phase === 'speaking'}
              style={{
                width: 46, height: 46, borderRadius: '50%', border: 'none', flexShrink: 0, cursor: 'pointer',
                background: textInput.trim() ? 'linear-gradient(135deg, #7c3aed, #5b21b6)' : 'rgba(255,255,255,0.1)',
                boxShadow: textInput.trim() ? '0 2px 12px rgba(124,58,237,0.5)' : 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              <IconSend size={16} color="white" />
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Controls */}
      <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
        style={{ position: 'relative', zIndex: 10, padding: '20px 20px 36px', borderTop: '1px solid rgba(255,255,255,0.05)' }}>

        {phase === 'ended' ? (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
            <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }} onClick={handleReset}
              style={{ padding: '12px 28px', borderRadius: 50, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: 'white', background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}>
              Call again
            </motion.button>
            <motion.button whileTap={{ scale: 0.95 }} whileHover={{ scale: 1.02 }} onClick={() => navigate(-1)}
              style={{ padding: '12px 28px', borderRadius: 50, border: '1px solid rgba(255,255,255,0.15)', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: 'rgba(255,255,255,0.7)', background: 'transparent' }}>
              Go back
            </motion.button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
            {/* Secondary controls */}
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { icon: isMuted ? '🔇' : '🎤', label: isMuted ? 'Unmute' : 'Mute', active: isMuted, danger: isMuted, onClick: () => setIsMuted(m => !m) },
                { icon: isCameraOn ? '📹' : '📷', label: isCameraOn ? 'Camera off' : 'Camera on', active: isCameraOn, danger: false, onClick: () => setIsCameraOn(c => !c) },
              ].map(btn => (
                <motion.button key={btn.label} whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }} onClick={btn.onClick}
                  title={btn.label}
                  style={{
                    width: 48, height: 48, borderRadius: '50%', border: `1px solid ${btn.danger ? 'rgba(239,68,68,0.5)' : btn.active ? 'rgba(6,182,212,0.5)' : 'rgba(255,255,255,0.15)'}`,
                    background: btn.danger ? 'rgba(239,68,68,0.2)' : btn.active ? 'rgba(6,182,212,0.15)' : 'rgba(255,255,255,0.08)',
                    cursor: 'pointer', fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                  {btn.icon}
                </motion.button>
              ))}
            </div>

            {/* Primary row */}
            <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
              <motion.button
                onClick={phase === 'idle' ? handleStart : phase === 'listening' ? handleStop : phase === 'speaking' ? handleInterrupt : undefined}
                disabled={phase === 'thinking'}
                whileHover={{ scale: phase === 'thinking' ? 1 : 1.04 }}
                whileTap={{ scale: phase === 'thinking' ? 1 : 0.95 }}
                style={{
                  padding: '14px 32px', borderRadius: 50, border: 'none', minWidth: 170,
                  cursor: phase === 'thinking' ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: 15, letterSpacing: '0.02em', color: 'white',
                  background: phase === 'thinking' ? 'rgba(6,182,212,0.25)'
                    : phase === 'listening' ? 'linear-gradient(135deg, #7c3aed, #5b21b6)'
                    : phase === 'speaking' ? 'linear-gradient(135deg, #06b6d4, #0891b2)'
                    : 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                  boxShadow: phase === 'thinking' ? 'none'
                    : phase === 'listening' ? '0 4px 24px rgba(124,58,237,0.5)'
                    : '0 4px 24px rgba(6,182,212,0.4)',
                  transition: 'background 0.3s, box-shadow 0.3s',
                }}
              >
                {phase === 'listening' && !textMode && (
                  <motion.span animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 1, repeat: Infinity }}
                    style={{ marginRight: 8, fontSize: 11 }}>●</motion.span>
                )}
                {primaryLabel}
              </motion.button>

              {isActive && (
                <motion.button initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  whileTap={{ scale: 0.9 }} whileHover={{ scale: 1.05 }} onClick={handleEnd}
                  title="End call"
                  style={{
                    width: 52, height: 52, borderRadius: '50%', border: 'none', cursor: 'pointer',
                    background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
                  }}>
                  📵
                </motion.button>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Camera PiP — only when camera is on */}
      <AnimatePresence>
        {isCameraOn && (
          <UserCameraPreview isCameraOn={isCameraOn} isMuted={isMuted}
            userAvatarUrl={profile?.avatar_url} userName={profile?.full_name ?? 'You'} />
        )}
      </AnimatePresence>
    </div>
  )
}
