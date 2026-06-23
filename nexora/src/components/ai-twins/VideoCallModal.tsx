import { Box, Text, ActionIcon, Group, Button } from '@mantine/core'
import { IconMicrophone, IconMicrophoneOff, IconVideo, IconVideoOff, IconPhone, IconCamera } from '@tabler/icons-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../lib/supabase'
import type { AiTwin } from '../../types'
import TalkingFaceCanvas from './TalkingFaceCanvas'

const OPENAI_KEY_STORAGE = 'nexora_openai_api_key'

interface ISpeechRecognition {
  continuous: boolean; interimResults: boolean; lang: string
  onstart: (() => void) | null; onend: (() => void) | null
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  start: () => void; stop: () => void
}

interface Props { twin: AiTwin; onEnd: () => void }

function ThinkingDots() {
  return (
    <Box style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <Box key={i} style={{ width: 9, height: 9, borderRadius: '50%', background: 'rgba(167,139,250,0.8)', animation: `dot-bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
      ))}
    </Box>
  )
}

export default function VideoCallModal({ twin, onEnd }: Props) {
  const [isMuted,     setIsMuted]     = useState(false)
  const [isCameraOn,  setIsCameraOn]  = useState(true)
  const [isSpeaking,  setIsSpeaking]  = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isThinking,  setIsThinking]  = useState(false)
  const [duration,    setDuration]    = useState(0)
  const [lastSubtitle,   setLastSubtitle]   = useState('')
  const [subtitleRole,   setSubtitleRole]   = useState<'user' | 'assistant'>('assistant')
  const [audioLevel,     setAudioLevel]     = useState(0)
  const [photoInputKey,  setPhotoInputKey]  = useState(0)
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(twin.avatar_url ?? null)

  const userVideoRef  = useRef<HTMLVideoElement>(null)
  const streamRef     = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const timerRef      = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef      = useRef<HTMLAudioElement | null>(null)
  const historyRef    = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const greeted       = useRef(false)
  const subtitleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioCtxRef   = useRef<AudioContext | null>(null)
  const analyserRef   = useRef<AnalyserNode | null>(null)
  const rafRef        = useRef<number | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const cancelledRef  = useRef(false)

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // User camera
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) { setIsCameraOn(false); return }
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => { streamRef.current = stream; if (userVideoRef.current) userVideoRef.current.srcObject = stream })
      .catch(() => { setIsCameraOn(false) })
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  // Audio analyser → drives TalkingFaceCanvas in real-time
  function startAnalyser(audio: HTMLAudioElement) {
    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 32
      const src = ctx.createMediaElementSource(audio)
      src.connect(analyser); analyser.connect(ctx.destination)
      audioCtxRef.current = ctx; analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      function tick() {
        analyser.getByteFrequencyData(data)
        const avg = data.reduce((a, b) => a + b, 0) / data.length / 255
        setAudioLevel(avg)
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch { /* no AudioContext */ }
  }

  function stopAnalyser() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setAudioLevel(0)
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null; analyserRef.current = null
  }

  function showSubtitle(text: string, role: 'user' | 'assistant') {
    setLastSubtitle(text); setSubtitleRole(role)
    if (subtitleTimer.current) clearTimeout(subtitleTimer.current)
    subtitleTimer.current = setTimeout(() => setLastSubtitle(''), 7000)
  }

  const speakText = useCallback(async (text: string, apiKey: string) => {
    if (cancelledRef.current) return
    const res = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova' }),
    })
    if (cancelledRef.current || !res.ok) return
    const blob = await res.blob()
    if (cancelledRef.current) return
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioRef.current = audio
    startAnalyser(audio)
    await new Promise<void>(resolve => {
      audio.onended = () => { URL.revokeObjectURL(url); stopAnalyser(); resolve() }
      audio.onerror = () => { stopAnalyser(); resolve() }
      audio.play().catch(() => { stopAnalyser(); resolve() })
    })
  }, [])

  const sendToAI = useCallback(async (userText: string) => {
    if (cancelledRef.current) return
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return
    showSubtitle(userText, 'user')
    historyRef.current.push({ role: 'user', content: userText })
    setIsThinking(true)
    try {
      const systemPrompt = `You are ${twin.name} on a live video call. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'warm and friendly'}. Talk like a real person — casual, short (1-2 sentences). Never say "As an AI".`
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, ...historyRef.current], max_tokens: 80, temperature: 0.9 }),
      })
      if (cancelledRef.current) { setIsThinking(false); return }
      const data = await res.json() as { choices: { message: { content: string } }[] }
      const reply = data.choices[0]?.message?.content?.trim() ?? 'I heard you!'
      historyRef.current.push({ role: 'assistant', content: reply })
      setIsThinking(false); setIsSpeaking(true)
      showSubtitle(reply, 'assistant')
      await speakText(reply, apiKey)
      if (!cancelledRef.current) setIsSpeaking(false)
    } catch {
      if (!cancelledRef.current) { setIsThinking(false); setIsSpeaking(false) }
    }
  }, [twin, speakText])

  // Demo animation: show face moving even when no API key is set
  useEffect(() => {
    if (localStorage.getItem(OPENAI_KEY_STORAGE)) return
    const pulses = [1200, 5000, 10000, 16000]
    const timers = pulses.map(delay => setTimeout(() => {
      setIsSpeaking(true)
      setTimeout(() => setIsSpeaking(false), 2200)
    }, delay))
    return () => timers.forEach(clearTimeout)
  }, [])

  // Auto-greet
  useEffect(() => {
    if (greeted.current) return; greeted.current = true
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return
    const greets = ['Hey! So nice to see you — how are you doing?', 'Hey! You picked up! How\'s everything going?', 'Oh hey! Great to see you! What\'s up?']
    const greeting = greets[Math.floor(Math.random() * greets.length)]
    setTimeout(async () => {
      if (cancelledRef.current) return
      historyRef.current.push({ role: 'assistant', content: greeting })
      setIsSpeaking(true); showSubtitle(greeting, 'assistant')
      await speakText(greeting, apiKey)
      if (!cancelledRef.current) setIsSpeaking(false)
    }, 900)
  }, [speakText])

  // Speech recognition
  useEffect(() => {
    if (isSpeaking || isThinking) { recognitionRef.current?.stop(); return }
    type SRCtor = new () => ISpeechRecognition
    const SR = (window as typeof window & { SpeechRecognition?: SRCtor }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = false; r.interimResults = false; r.lang = 'en-US'
    r.onstart = () => setIsListening(true)
    r.onend   = () => setIsListening(false)
    r.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[e.results.length - 1][0].transcript.trim()
      if (text) sendToAI(text)
    }
    recognitionRef.current = r
    try { r.start() } catch { /* already started */ }
    return () => { try { r.stop() } catch { /* */ } }
  }, [isSpeaking, isThinking, sendToAI])

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return
    try {
      const ext = file.name.split('.').pop()
      const path = `twin-${twin.id}.${ext}`
      await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('ai_twins').update({ avatar_url: data.publicUrl }).eq('id', twin.id)
      setAvatarUrl(data.publicUrl)
      notifications.show({ title: 'Photo uploaded!', message: 'Now showing your photo in the call', color: 'green' })
    } catch { notifications.show({ title: 'Upload failed', message: 'Try again', color: 'red' }) }
    setPhotoInputKey(k => k + 1)
  }

  function toggleMute()   { setIsMuted(m   => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = m });   return !m }) }
  function toggleCamera() { setIsCameraOn(c => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !c }); return !c }) }
  function handleEnd() {
    cancelledRef.current = true
    streamRef.current?.getTracks().forEach(t => t.stop())
    recognitionRef.current?.stop()
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (timerRef.current) clearInterval(timerRef.current)
    stopAnalyser(); onEnd()
  }

  const mins = Math.floor(duration / 60).toString().padStart(2, '0')
  const secs = (duration % 60).toString().padStart(2, '0')

  return (
    <Box style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', overflow: 'hidden' }}>

      {/* ── MAIN: AI FACE ── */}
      <Box style={{ position: 'absolute', inset: 0 }}>
        {avatarUrl ? (
          <>
            {/* TalkingFaceCanvas: animates mouth/eyes in sync with audio */}
            <TalkingFaceCanvas
              src={avatarUrl}
              speaking={isSpeaking}
              audioLevel={audioLevel}
              style={{ position: 'absolute', inset: 0, objectPosition: 'center 20%' }}
            />
            {/* Green speaking border */}
            {isSpeaking && (
              <Box style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, boxShadow: 'inset 0 0 0 5px rgba(34,197,94,0.7)', animation: 'border-pulse 0.7s ease-in-out infinite' }} />
            )}
            {/* Thinking indicator */}
            {isThinking && (
              <Box style={{ position: 'absolute', bottom: 130, left: '50%', transform: 'translateX(-50%)', zIndex: 5, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '8px 18px' }}>
                <ThinkingDots />
              </Box>
            )}
          </>
        ) : (
          /* No photo yet */
          <Box style={{ width: '100%', height: '100%', background: 'radial-gradient(ellipse at 50% 40%, #1a0838 0%, #020108 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <Box style={{ width: 180, height: 180, borderRadius: '50%', background: 'linear-gradient(135deg, #2a1050, #1a0840)', border: '3px solid rgba(124,58,237,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
              <Text fw={900} style={{ color: 'rgba(167,139,250,0.9)', fontSize: 48 }}>{twin.name.slice(0, 2).toUpperCase()}</Text>
            </Box>
            <Text fw={700} size="lg" style={{ color: 'white', marginBottom: 20 }}>{twin.name}</Text>
            <Button size="sm" leftSection={<IconCamera size={14} />} onClick={() => photoInputRef.current?.click()} style={{ background: 'rgba(124,58,237,0.3)', border: '1px solid rgba(124,58,237,0.5)', color: '#c4b5fd' }}>
              Upload photo for animated face
            </Button>
            <input key={photoInputKey} ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </Box>
        )}
        {/* Vignette overlay — light top/bottom, keeps lower face visible */}
        <Box style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 14%, transparent 70%, rgba(0,0,0,0.32) 100%)' }} />
      </Box>

      {/* ── TOP BAR ── */}
      <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
        <Group gap={8} align="center">
          <Box style={{ width: 10, height: 10, borderRadius: '50%', background: isSpeaking ? '#22c55e' : isListening ? '#a78bfa' : '#64748b', boxShadow: isSpeaking ? '0 0 8px #22c55e' : isListening ? '0 0 8px #a78bfa' : 'none', transition: 'all 0.3s' }} />
          <Text fw={700} size="lg" style={{ color: 'white', textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>{twin.name}</Text>
          <Text size="sm" style={{ color: isSpeaking ? '#22c55e' : isThinking ? '#c4b5fd' : isListening ? '#c4b5fd' : 'rgba(255,255,255,0.5)' }}>
            {isSpeaking ? 'Speaking' : isThinking ? 'Thinking…' : isListening ? 'Listening to you' : 'Connected'}
          </Text>
        </Group>
        <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: 20, backdropFilter: 'blur(8px)', fontVariantNumeric: 'tabular-nums' }}>
          {mins}:{secs}
        </Text>
      </Box>

      {/* ── SUBTITLE ── */}
      <Box style={{ position: 'absolute', bottom: 116, left: 0, right: 160, display: 'flex', justifyContent: 'center', padding: '0 20px', zIndex: 10, opacity: lastSubtitle ? 1 : 0, transition: 'opacity 0.4s' }}>
        <Box style={{ maxWidth: 520, background: subtitleRole === 'user' ? 'rgba(124,58,237,0.8)' : 'rgba(0,0,0,0.75)', backdropFilter: 'blur(14px)', borderRadius: 14, padding: '10px 18px', textAlign: 'center' }}>
          <Text size="md" fw={500} style={{ lineHeight: 1.5, color: 'white' }}>{lastSubtitle}</Text>
        </Box>
      </Box>

      {/* ── USER PiP (top-right, FaceTime style) ── */}
      <Box style={{
        position: 'absolute', top: 70, right: 18,
        width: 120, height: 168, borderRadius: 16, overflow: 'hidden',
        border: isListening ? '2px solid rgba(167,139,250,0.9)' : '2px solid rgba(255,255,255,0.2)',
        background: '#111',
        boxShadow: '0 8px 32px rgba(0,0,0,0.8)',
        transition: 'border 0.3s', zIndex: 20,
      }}>
        {isCameraOn
          ? <video ref={userVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          : <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
              <IconVideoOff size={22} color="#4a4a6a" />
              <Text size="xs" c="dimmed">Off</Text>
            </Box>
        }
        <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', padding: '10px 8px 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
          {isListening && <Box style={{ width: 5, height: 5, borderRadius: '50%', background: '#a78bfa', animation: 'listen-pulse 0.9s ease-in-out infinite', flexShrink: 0 }} />}
          <Text size="10px" fw={600} style={{ color: 'white' }}>{isListening ? 'Speaking…' : 'You'}</Text>
        </Box>
      </Box>

      {/* ── CONTROLS (bottom center, FaceTime style) ── */}
      <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '14px 24px 32px', background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <Group gap={20}>
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <ActionIcon size={56} radius="xl" onClick={toggleCamera} style={{ background: isCameraOn ? 'rgba(255,255,255,0.15)' : '#ef4444', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)' }}>
              {isCameraOn ? <IconVideo size={22} color="white" /> : <IconVideoOff size={22} color="white" />}
            </ActionIcon>
            <Text size="10px" style={{ color: 'rgba(255,255,255,0.6)' }}>Camera</Text>
          </Box>
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <ActionIcon size={68} radius="xl" onClick={handleEnd} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}>
              <IconPhone size={28} color="white" style={{ transform: 'rotate(135deg)' }} />
            </ActionIcon>
            <Text size="10px" style={{ color: 'rgba(255,255,255,0.6)' }}>End Call</Text>
          </Box>
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
            <ActionIcon size={56} radius="xl" onClick={toggleMute} style={{ background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.15)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.15)' }}>
              {isMuted ? <IconMicrophoneOff size={22} color="white" /> : <IconMicrophone size={22} color="white" />}
            </ActionIcon>
            <Text size="10px" style={{ color: 'rgba(255,255,255,0.6)' }}>Mute</Text>
          </Box>
        </Group>
      </Box>

      <style>{`
        @keyframes border-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes listen-pulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.35); } }
        @keyframes dot-bounce { 0%,80%,100% { transform: scale(0.65); opacity: 0.35; } 40% { transform: scale(1.1); opacity: 1; } }
      `}</style>
    </Box>
  )
}
