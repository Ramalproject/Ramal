import { Box, Text, ActionIcon, Group, Stack } from '@mantine/core'
import { IconMicrophone, IconMicrophoneOff, IconVideo, IconVideoOff, IconPhone } from '@tabler/icons-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { AiTwin } from '../../types'
import { getInitials } from '../../utils'

const OPENAI_KEY_STORAGE = 'nexora_openai_api_key'

interface ISpeechRecognition {
  continuous: boolean; interimResults: boolean; lang: string
  onstart: (() => void) | null; onend: (() => void) | null
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  start: () => void; stop: () => void
}

interface Props { twin: AiTwin; onEnd: () => void }

// ── Audio visualizer ────────────────────────────────────────────────────────
function AudioBars({
  analyserRef, speaking, listening,
}: {
  analyserRef: React.MutableRefObject<AnalyserNode | null>
  speaking: boolean
  listening: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height
    const N = 52

    function draw() {
      ctx.clearRect(0, 0, W, H)
      const t = Date.now() / 1000
      let heights: number[]

      const analyser = analyserRef.current
      if (analyser && speaking) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        heights = Array.from({ length: N }, (_, i) => {
          const idx = Math.floor((i / N) * data.length * 0.55)
          return Math.max(0.06, data[idx] / 255)
        })
      } else if (listening) {
        heights = Array.from({ length: N }, (_, i) =>
          Math.max(0.04, Math.sin(t * 4 + i * 0.35) * 0.14 + 0.16))
      } else {
        heights = Array.from({ length: N }, (_, i) =>
          Math.max(0.02, Math.sin(t * 0.9 + i * 0.28) * 0.05 + 0.07))
      }

      const bw = W / N
      heights.forEach((h, i) => {
        const barH = Math.min(h * H * 0.85, H * 0.9)
        const x = i * bw + 1.5
        const y = (H - barH) / 2
        const alpha = speaking ? 0.45 + h * 0.55 : listening ? 0.35 + h * 0.45 : 0.2 + h * 0.25

        const grad = ctx.createLinearGradient(0, y, 0, y + barH)
        if (speaking) {
          grad.addColorStop(0, `rgba(167,139,250,${alpha})`)
          grad.addColorStop(0.5, `rgba(124,58,237,${alpha * 0.9})`)
          grad.addColorStop(1, `rgba(167,139,250,${alpha * 0.5})`)
        } else if (listening) {
          grad.addColorStop(0, `rgba(96,165,250,${alpha})`)
          grad.addColorStop(1, `rgba(59,130,246,${alpha * 0.4})`)
        } else {
          grad.addColorStop(0, `rgba(120,113,172,${alpha})`)
          grad.addColorStop(1, `rgba(80,70,120,${alpha * 0.3})`)
        }

        ctx.fillStyle = grad
        ctx.beginPath()
        ctx.rect(x, y, bw - 3, barH)
        ctx.fill()
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [speaking, listening, analyserRef])

  return (
    <canvas
      ref={canvasRef}
      width={520}
      height={96}
      style={{ width: '100%', maxWidth: 520, height: 96, display: 'block' }}
    />
  )
}

// ── SVG ring around avatar ──────────────────────────────────────────────────
function AvatarRing({ speaking, listening, audioLevel, size = 224 }: {
  speaking: boolean; listening: boolean; audioLevel: number; size?: number
}) {
  const cx = size / 2, cy = size / 2
  const rOuter = cx - 4
  const rInner = cx - 12

  const color = speaking ? '#22c55e' : listening ? '#a78bfa' : '#4c1d95'
  const glow   = speaking ? `0 0 ${20 + audioLevel * 28}px rgba(34,197,94,0.6)` : listening ? '0 0 16px rgba(167,139,250,0.4)' : 'none'

  return (
    <svg
      width={size} height={size}
      style={{ position: 'absolute', inset: 0, overflow: 'visible', filter: speaking || listening ? `drop-shadow(${glow})` : 'none' }}
    >
      <defs>
        <linearGradient id="rg1" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor={speaking ? '#22c55e' : '#7c3aed'} />
          <stop offset="100%" stopColor={speaking ? '#86efac' : '#c4b5fd'} />
        </linearGradient>
      </defs>
      {/* Outer pulse ring */}
      <circle cx={cx} cy={cy} r={rOuter} fill="none"
        stroke={color} strokeWidth={speaking ? 2.5 : 1.5}
        opacity={speaking ? 0.35 + audioLevel * 0.45 : 0.15}
        style={{ animation: speaking ? 'nex-ring-pulse 0.6s ease-in-out infinite' : 'nex-ring-idle 3.5s ease-in-out infinite' }}
      />
      {/* Spinning arc */}
      <circle cx={cx} cy={cy} r={rInner} fill="none"
        stroke="url(#rg1)" strokeWidth={3.5}
        strokeLinecap="round"
        strokeDasharray={speaking ? `${rInner * 1.8} ${rInner * 3}` : `${rInner * 0.9} ${rInner * 3}`}
        style={{ animation: speaking ? 'nex-arc-spin 1.2s linear infinite' : 'nex-arc-drift 8s linear infinite', transformOrigin: `${cx}px ${cy}px` }}
      />
    </svg>
  )
}

// ── Thinking dots ───────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <Group gap={6} align="center">
      {[0, 1, 2].map(i => (
        <Box key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(167,139,250,0.85)', animation: `nex-dot 1.2s ${i * 0.2}s ease-in-out infinite` }} />
      ))}
    </Group>
  )
}

// ── Main component ──────────────────────────────────────────────────────────
export default function VideoCallModal({ twin, onEnd }: Props) {
  const [isMuted,      setIsMuted]      = useState(false)
  const [isCameraOn,   setIsCameraOn]   = useState(true)
  const [isSpeaking,   setIsSpeaking]   = useState(false)
  const [isListening,  setIsListening]  = useState(false)
  const [isThinking,   setIsThinking]   = useState(false)
  const [duration,     setDuration]     = useState(0)
  const [lastSubtitle, setLastSubtitle] = useState('')
  const [subtitleRole, setSubtitleRole] = useState<'user' | 'assistant'>('assistant')
  const [audioLevel,   setAudioLevel]   = useState(0)

  const userVideoRef   = useRef<HTMLVideoElement>(null)
  const streamRef      = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef       = useRef<HTMLAudioElement | null>(null)
  const historyRef     = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const greeted        = useRef(false)
  const subtitleTimer  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioCtxRef    = useRef<AudioContext | null>(null)
  const analyserRef    = useRef<AnalyserNode | null>(null)
  const rafRef         = useRef<number | null>(null)
  const cancelledRef   = useRef(false)

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
      .catch(() => setIsCameraOn(false))
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  // Audio analyser → drives waveform in real-time
  function startAnalyser(audio: HTMLAudioElement) {
    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 128
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
    subtitleTimer.current = setTimeout(() => setLastSubtitle(''), 8000)
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
      const systemPrompt = `You are ${twin.name} on a live video call. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'warm and friendly'}. Respond like a real person — casual, short (1-2 sentences max). Never say "As an AI".`
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, ...historyRef.current], max_tokens: 80, temperature: 0.9 }),
      })
      if (cancelledRef.current) { setIsThinking(false); return }
      const data = await res.json() as { choices: { message: { content: string } }[] }
      const reply = data.choices[0]?.message?.content?.trim() ?? 'Hey, I heard you!'
      historyRef.current.push({ role: 'assistant', content: reply })
      setIsThinking(false); setIsSpeaking(true)
      showSubtitle(reply, 'assistant')
      await speakText(reply, apiKey)
      if (!cancelledRef.current) setIsSpeaking(false)
    } catch {
      if (!cancelledRef.current) { setIsThinking(false); setIsSpeaking(false) }
    }
  }, [twin, speakText])

  // Demo animation when no API key
  useEffect(() => {
    if (localStorage.getItem(OPENAI_KEY_STORAGE)) return
    const pulses = [1200, 5000, 10000, 16000]
    const timers = pulses.map(delay => setTimeout(() => {
      setIsSpeaking(true); setAudioLevel(0.6)
      setTimeout(() => { setIsSpeaking(false); setAudioLevel(0) }, 2400)
    }, delay))
    return () => timers.forEach(clearTimeout)
  }, [])

  // Auto-greet
  useEffect(() => {
    if (greeted.current) return; greeted.current = true
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return
    const greets = ['Hey! Great to see you — how are you doing?', "Hey! You picked up! What's up?", 'Oh hey! So nice to see you!']
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

  function toggleMute()   { setIsMuted(m => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = m }); return !m }) }
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

  const statusText = isSpeaking ? 'Speaking' : isThinking ? 'Thinking…' : isListening ? 'Listening to you…' : 'Connected'
  const statusColor = isSpeaking ? '#22c55e' : isThinking ? '#c4b5fd' : isListening ? '#93c5fd' : 'rgba(255,255,255,0.45)'

  return (
    <Box style={{ position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 28%, #180830 0%, #0c0120 45%, #020108 100%)' }}>

      {/* Ambient glow behind avatar */}
      <Box style={{
        position: 'absolute', top: '15%', left: '50%',
        transform: 'translateX(-50%)',
        width: 320, height: 320, borderRadius: '50%',
        background: isSpeaking
          ? 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)'
          : isListening
          ? 'radial-gradient(circle, rgba(96,165,250,0.1) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 70%)',
        transition: 'background 0.4s ease',
        pointerEvents: 'none',
      }} />

      {/* ── TOP BAR ── */}
      <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 22px',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <Group gap={8}>
          <Box style={{ width: 9, height: 9, borderRadius: '50%',
            background: isSpeaking ? '#22c55e' : isListening ? '#93c5fd' : '#4c1d95',
            boxShadow: isSpeaking ? '0 0 8px #22c55e' : isListening ? '0 0 8px #93c5fd' : 'none',
            transition: 'all 0.3s' }} />
          <Text fw={700} style={{ color: 'white', textShadow: '0 1px 6px rgba(0,0,0,0.8)' }}>{twin.name}</Text>
        </Group>
        <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.7)', background: 'rgba(0,0,0,0.35)',
          padding: '4px 12px', borderRadius: 20, backdropFilter: 'blur(8px)', fontVariantNumeric: 'tabular-nums' }}>
          {mins}:{secs}
        </Text>
      </Box>

      {/* ── CENTER: AVATAR + WAVEFORM ── */}
      <Box style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 28, paddingBottom: 100 }}>

        {/* Avatar with animated SVG ring */}
        <Box style={{ position: 'relative', width: 224, height: 224, flexShrink: 0 }}>
          <AvatarRing speaking={isSpeaking} listening={isListening} audioLevel={audioLevel} />
          {/* Avatar image / initials */}
          <Box style={{ position: 'absolute', inset: 14, borderRadius: '50%', overflow: 'hidden',
            background: 'linear-gradient(135deg, #2a1050, #1a0840)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(167,139,250,0.15)' }}>
            {twin.avatar_url
              ? <img src={twin.avatar_url} alt={twin.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
              : <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Text fw={900} style={{ fontSize: 56, color: '#a78bfa' }}>{getInitials(twin.name)}</Text>
                </Box>
            }
          </Box>
        </Box>

        {/* Name + status */}
        <Stack gap={4} align="center">
          <Text fw={700} size="xl" style={{ color: 'white', letterSpacing: '-0.3px' }}>{twin.name}</Text>
          <Group gap={6} align="center">
            {isThinking && <ThinkingDots />}
            {!isThinking && (
              <Text size="sm" fw={500} style={{ color: statusColor, transition: 'color 0.3s' }}>
                {statusText}
              </Text>
            )}
          </Group>
        </Stack>

        {/* Audio waveform visualizer */}
        <Box style={{ width: '100%', maxWidth: 520, padding: '0 24px' }}>
          <AudioBars analyserRef={analyserRef} speaking={isSpeaking} listening={isListening} />
        </Box>

        {/* Subtitle */}
        <Box style={{ minHeight: 52, display: 'flex', alignItems: 'center', padding: '0 32px',
          maxWidth: 560, textAlign: 'center',
          opacity: lastSubtitle ? 1 : 0, transition: 'opacity 0.4s' }}>
          <Box style={{
            background: subtitleRole === 'user' ? 'rgba(124,58,237,0.75)' : 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(14px)',
            borderRadius: 14, padding: '10px 18px',
            border: subtitleRole === 'user' ? '1px solid rgba(167,139,250,0.3)' : '1px solid rgba(255,255,255,0.08)',
          }}>
            <Text size="sm" fw={500} style={{ color: 'white', lineHeight: 1.55 }}>{lastSubtitle}</Text>
          </Box>
        </Box>
      </Box>

      {/* ── USER PiP (top-right) ── */}
      <Box style={{ position: 'absolute', top: 64, right: 18, width: 116, height: 164,
        borderRadius: 14, overflow: 'hidden', zIndex: 20,
        border: isListening ? '2px solid rgba(96,165,250,0.9)' : '2px solid rgba(255,255,255,0.15)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.85)', background: '#0a0a14',
        transition: 'border 0.3s' }}>
        {isCameraOn
          ? <video ref={userVideoRef} autoPlay muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          : <Box style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <IconVideoOff size={20} color="#4a4a6a" />
              <Text size="xs" c="dimmed">Off</Text>
            </Box>
        }
        <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
          padding: '10px 8px 4px', display: 'flex', alignItems: 'center', gap: 4 }}>
          {isListening && <Box style={{ width: 5, height: 5, borderRadius: '50%', background: '#93c5fd',
            animation: 'nex-mic-pulse 0.9s ease-in-out infinite', flexShrink: 0 }} />}
          <Text size="10px" fw={600} style={{ color: 'white' }}>{isListening ? 'Speaking…' : 'You'}</Text>
        </Box>
      </Box>

      {/* ── CONTROLS ── */}
      <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 24px 36px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 100%)',
        display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <Group gap={22}>
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <ActionIcon size={56} radius="xl" onClick={toggleCamera}
              style={{ background: isCameraOn ? 'rgba(255,255,255,0.12)' : '#ef4444',
                backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {isCameraOn ? <IconVideo size={22} color="white" /> : <IconVideoOff size={22} color="white" />}
            </ActionIcon>
            <Text size="10px" style={{ color: 'rgba(255,255,255,0.5)' }}>Camera</Text>
          </Box>
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <ActionIcon size={68} radius="xl" onClick={handleEnd}
              style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 4px 28px rgba(239,68,68,0.55)' }}>
              <IconPhone size={28} color="white" style={{ transform: 'rotate(135deg)' }} />
            </ActionIcon>
            <Text size="10px" style={{ color: 'rgba(255,255,255,0.5)' }}>End Call</Text>
          </Box>
          <Box style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
            <ActionIcon size={56} radius="xl" onClick={toggleMute}
              style={{ background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.12)' }}>
              {isMuted ? <IconMicrophoneOff size={22} color="white" /> : <IconMicrophone size={22} color="white" />}
            </ActionIcon>
            <Text size="10px" style={{ color: 'rgba(255,255,255,0.5)' }}>Mute</Text>
          </Box>
        </Group>
      </Box>

      <style>{`
        @keyframes nex-ring-pulse {
          0%, 100% { opacity: 0.15; r: attr(r); }
          50%       { opacity: 0.4; }
        }
        @keyframes nex-ring-idle {
          0%, 100% { opacity: 0.12; }
          50%       { opacity: 0.3; }
        }
        @keyframes nex-arc-spin {
          to { transform: rotate(360deg); }
        }
        @keyframes nex-arc-drift {
          to { transform: rotate(360deg); }
        }
        @keyframes nex-dot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.3; }
          40%            { transform: scale(1.1); opacity: 1; }
        }
        @keyframes nex-mic-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50%       { opacity: 1; transform: scale(1.35); }
        }
      `}</style>
    </Box>
  )
}
