import { Box, Text, ActionIcon, Group } from '@mantine/core'
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

// ── Helpers ─────────────────────────────────────────────────────────────────
function roundedBar(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  r = Math.min(r, w / 2, Math.abs(h) / 2)
  if (h < 0) { y += h; h = -h }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

// ── Mirror waveform ──────────────────────────────────────────────────────────
function AudioBars({ analyserRef, speaking, listening }: {
  analyserRef: React.MutableRefObject<AnalyserNode | null>
  speaking: boolean; listening: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef    = useRef(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const W = canvas.width, H = canvas.height, N = 56, mid = H / 2

    function draw() {
      ctx.clearRect(0, 0, W, H)
      const t = Date.now() / 1000
      let heights: number[]

      const analyser = analyserRef.current
      if (analyser && speaking) {
        const data = new Uint8Array(analyser.frequencyBinCount)
        analyser.getByteFrequencyData(data)
        heights = Array.from({ length: N }, (_, i) => {
          const idx = Math.floor((i / N) * data.length * 0.6)
          return Math.max(0.06, data[idx] / 255)
        })
      } else if (listening) {
        heights = Array.from({ length: N }, (_, i) =>
          Math.max(0.05, Math.sin(t * 4.5 + i * 0.36) * 0.16 + 0.18))
      } else {
        heights = Array.from({ length: N }, (_, i) =>
          Math.max(0.025, Math.sin(t * 0.9 + i * 0.28) * 0.05 + 0.07))
      }

      const bw = W / N
      heights.forEach((h, i) => {
        const barH = h * mid * 0.88
        const x = i * bw + 2

        const alpha = speaking ? 0.5 + h * 0.5 : listening ? 0.4 + h * 0.4 : 0.18 + h * 0.22

        // Gradient per bar
        const gUp = ctx.createLinearGradient(0, mid - barH, 0, mid)
        const gDn = ctx.createLinearGradient(0, mid, 0, mid + barH)

        if (speaking) {
          gUp.addColorStop(0, `rgba(192,132,252,${alpha})`)
          gUp.addColorStop(1, `rgba(124,58,237,${alpha * 0.6})`)
          gDn.addColorStop(0, `rgba(124,58,237,${alpha * 0.6})`)
          gDn.addColorStop(1, `rgba(192,132,252,${alpha * 0.3})`)
        } else if (listening) {
          gUp.addColorStop(0, `rgba(96,165,250,${alpha})`)
          gUp.addColorStop(1, `rgba(59,130,246,${alpha * 0.5})`)
          gDn.addColorStop(0, `rgba(59,130,246,${alpha * 0.5})`)
          gDn.addColorStop(1, `rgba(96,165,250,${alpha * 0.25})`)
        } else {
          gUp.addColorStop(0, `rgba(139,92,246,${alpha})`)
          gUp.addColorStop(1, `rgba(91,33,182,${alpha * 0.4})`)
          gDn.addColorStop(0, `rgba(91,33,182,${alpha * 0.4})`)
          gDn.addColorStop(1, `rgba(139,92,246,${alpha * 0.15})`)
        }

        ctx.fillStyle = gUp
        roundedBar(ctx, x, mid - barH, bw - 4, barH, 3)
        ctx.fill()

        ctx.fillStyle = gDn
        roundedBar(ctx, x, mid, bw - 4, barH, 3)
        ctx.fill()
      })

      rafRef.current = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(rafRef.current)
  }, [speaking, listening, analyserRef])

  return (
    <canvas ref={canvasRef} width={560} height={110}
      style={{ width: '100%', maxWidth: 560, height: 110, display: 'block' }} />
  )
}

// ── Avatar with multi-ring SVG ───────────────────────────────────────────────
function AvatarFrame({ speaking, listening, audioLevel, twin, size = 230 }: {
  speaking: boolean; listening: boolean; audioLevel: number; twin: AiTwin; size?: number
}) {
  const c = size / 2
  const R1 = c - 3   // outermost pulse ring
  const R2 = c - 12  // spinning arc ring
  const R3 = c - 22  // inner steady ring
  const avatarR = c - 28
  const orbitR = c + 10  // orbital dots radius

  const ringColor  = speaking ? '#22c55e' : listening ? '#60a5fa' : '#7c3aed'
  const glowColor  = speaking ? 'rgba(34,197,94,0.5)' : listening ? 'rgba(96,165,250,0.4)' : 'rgba(124,58,237,0.25)'
  const arcColor1  = speaking ? '#86efac' : listening ? '#93c5fd' : '#a78bfa'
  const arcColor2  = speaking ? '#22c55e' : listening ? '#3b82f6' : '#7c3aed'

  const orbit = speaking
    ? [0, 90, 180, 270].map(deg => {
        const rad = (deg * Math.PI) / 180
        return { cx: c + Math.cos(rad) * orbitR, cy: c + Math.sin(rad) * orbitR, delay: deg / 360 * 2 }
      })
    : []

  return (
    <Box style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {/* SVG rings */}
      <svg width={size} height={size} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <linearGradient id="vg-arc1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={arcColor1} />
            <stop offset="100%" stopColor={arcColor2} />
          </linearGradient>
          <linearGradient id="vg-arc2" x1="1" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={arcColor2} />
            <stop offset="100%" stopColor={arcColor1} />
          </linearGradient>
          <filter id="vg-glow">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outermost pulse ring */}
        <circle cx={c} cy={c} r={R1} fill="none"
          stroke={ringColor} strokeWidth={1.5}
          opacity={speaking ? 0.25 + audioLevel * 0.5 : 0.12}
          style={{ animation: speaking ? 'vg-outer-pulse 0.55s ease-in-out infinite' : 'vg-idle-ring 3.5s ease-in-out infinite' }} />

        {/* Spinning arc (dashed) */}
        <circle cx={c} cy={c} r={R2} fill="none"
          stroke="url(#vg-arc1)" strokeWidth={3}
          strokeLinecap="round"
          strokeDasharray={speaking ? `${R2 * 2.2} ${R2 * 2}` : `${R2 * 1} ${R2 * 3}`}
          style={{
            animation: speaking ? 'vg-arc-fast 1s linear infinite' : 'vg-arc-slow 10s linear infinite',
            transformOrigin: `${c}px ${c}px`,
            filter: `drop-shadow(0 0 6px ${ringColor})`,
          }} />

        {/* Counter-spinning arc */}
        <circle cx={c} cy={c} r={R2 - 1} fill="none"
          stroke="url(#vg-arc2)" strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={speaking ? `${R2 * 1.2} ${R2 * 2.8}` : `${R2 * 0.6} ${R2 * 3.4}`}
          style={{
            animation: speaking ? 'vg-arc-rev-fast 1.4s linear infinite' : 'vg-arc-rev-slow 14s linear infinite',
            transformOrigin: `${c}px ${c}px`,
          }} />

        {/* Inner steady ring */}
        <circle cx={c} cy={c} r={R3} fill="none"
          stroke={ringColor} strokeWidth={1}
          opacity={speaking ? 0.4 + audioLevel * 0.3 : 0.1}
          style={{ transition: 'opacity 0.4s, stroke 0.4s' }} />

        {/* Orbital particles (speaking only) */}
        {orbit.map((p, i) => (
          <g key={i} style={{
            transformOrigin: `${c}px ${c}px`,
            animation: `vg-orbit 3s ${p.delay}s linear infinite`,
          }}>
            <circle cx={p.cx} cy={p.cy} r={4}
              fill={ringColor}
              opacity={0.9}
              style={{ filter: `drop-shadow(0 0 5px ${ringColor})` }} />
          </g>
        ))}
      </svg>

      {/* Glow behind avatar */}
      <Box style={{
        position: 'absolute', inset: 20, borderRadius: '50%',
        boxShadow: speaking
          ? `0 0 40px 12px ${glowColor}, 0 0 80px 20px rgba(34,197,94,0.15)`
          : listening
          ? `0 0 30px 8px ${glowColor}`
          : `0 0 20px 6px ${glowColor}`,
        transition: 'box-shadow 0.5s ease',
        pointerEvents: 'none',
      }} />

      {/* Avatar circle */}
      <Box style={{
        position: 'absolute', inset: 28, borderRadius: '50%', overflow: 'hidden',
        background: 'linear-gradient(145deg, #2e1065, #1a0840, #0f0520)',
        border: `2px solid ${ringColor}28`,
        transition: 'border-color 0.4s',
      }}>
        {twin.avatar_url
          ? <img src={twin.avatar_url} alt={twin.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%' }} />
          : <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'radial-gradient(circle at 40% 35%, #3b0764, #1e0040)' }}>
              <Text fw={900} style={{ fontSize: avatarR * 0.55, color: '#c4b5fd' }}>{getInitials(twin.name)}</Text>
            </Box>
        }
      </Box>
    </Box>
  )
}

// ── Thinking dots ────────────────────────────────────────────────────────────
function ThinkingDots() {
  return (
    <Group gap={6} align="center">
      {[0, 1, 2].map(i => (
        <Box key={i} style={{ width: 7, height: 7, borderRadius: '50%',
          background: 'rgba(167,139,250,0.9)',
          animation: `vg-dot 1.3s ${i * 0.22}s ease-in-out infinite` }} />
      ))}
    </Group>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
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
  const levelRafRef    = useRef<number | null>(null)
  const cancelledRef   = useRef(false)

  useEffect(() => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) { setIsCameraOn(false); return }
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => { streamRef.current = stream; if (userVideoRef.current) userVideoRef.current.srcObject = stream })
      .catch(() => setIsCameraOn(false))
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

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
        levelRafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch { /* no AudioContext */ }
  }

  function stopAnalyser() {
    if (levelRafRef.current) cancelAnimationFrame(levelRafRef.current)
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
      const systemPrompt = `You are ${twin.name} on a live video call. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'warm and friendly'}. Respond like a real person — casual, short (1–2 sentences). Never say "As an AI".`
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'gpt-4o-mini', messages: [{ role: 'system', content: systemPrompt }, ...historyRef.current], max_tokens: 80, temperature: 0.9 }),
      })
      if (cancelledRef.current) { setIsThinking(false); return }
      const data = await res.json() as { choices: { message: { content: string } }[] }
      const reply = data.choices[0]?.message?.content?.trim() ?? 'Hey!'
      historyRef.current.push({ role: 'assistant', content: reply })
      setIsThinking(false); setIsSpeaking(true)
      showSubtitle(reply, 'assistant')
      await speakText(reply, apiKey)
      if (!cancelledRef.current) setIsSpeaking(false)
    } catch {
      if (!cancelledRef.current) { setIsThinking(false); setIsSpeaking(false) }
    }
  }, [twin, speakText])

  useEffect(() => {
    if (localStorage.getItem(OPENAI_KEY_STORAGE)) return
    const pulses = [1200, 5200, 10500, 17000]
    const timers = pulses.map(delay => setTimeout(() => {
      setIsSpeaking(true); setAudioLevel(0.65)
      setTimeout(() => { setIsSpeaking(false); setAudioLevel(0) }, 2600)
    }, delay))
    return () => timers.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    if (greeted.current) return; greeted.current = true
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return
    const greets = ['Hey! Great to see you — how are you doing?', "Hey! You picked up! What's up?", 'Oh hey! So glad you called!']
    const greeting = greets[Math.floor(Math.random() * greets.length)]
    setTimeout(async () => {
      if (cancelledRef.current) return
      historyRef.current.push({ role: 'assistant', content: greeting })
      setIsSpeaking(true); showSubtitle(greeting, 'assistant')
      await speakText(greeting, apiKey)
      if (!cancelledRef.current) setIsSpeaking(false)
    }, 900)
  }, [speakText])

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
    try { r.start() } catch { /* */ }
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

  const statusLabel = isSpeaking ? 'Speaking' : isThinking ? 'Thinking' : isListening ? 'Listening…' : 'Connected'
  const statusDot   = isSpeaking ? '#22c55e' : isThinking ? '#c4b5fd' : isListening ? '#60a5fa' : '#4c1d95'

  return (
    <Box style={{
      position: 'fixed', inset: 0, zIndex: 1000, overflow: 'hidden',
      background: 'radial-gradient(ellipse at 50% 30%, #1c0638 0%, #0c0220 50%, #020108 100%)',
    }}>
      {/* Slowly rotating ambient gradient overlay */}
      <Box style={{
        position: 'absolute', top: '-50%', left: '-50%',
        width: '200%', height: '200%', pointerEvents: 'none',
        background: 'conic-gradient(from 0deg, transparent 0%, rgba(124,58,237,0.055) 20%, transparent 40%, rgba(96,165,250,0.03) 60%, transparent 80%, rgba(124,58,237,0.055) 100%)',
        animation: 'vg-bg-spin 28s linear infinite',
      }} />

      {/* Speaking state color wash */}
      <Box style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: isSpeaking
          ? 'radial-gradient(ellipse at 50% 25%, rgba(34,197,94,0.07) 0%, transparent 55%)'
          : isListening
          ? 'radial-gradient(ellipse at 50% 25%, rgba(96,165,250,0.06) 0%, transparent 55%)'
          : 'none',
        transition: 'background 0.6s ease',
      }} />

      {/* ── TOP BAR ── */}
      <Box style={{
        position: 'absolute', top: 16, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 12, zIndex: 10,
        background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(16px)',
        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 40,
        padding: '8px 18px',
      }}>
        <Box style={{ width: 8, height: 8, borderRadius: '50%', background: statusDot,
          boxShadow: `0 0 8px ${statusDot}`, transition: 'all 0.3s', flexShrink: 0 }} />
        <Text fw={700} size="sm" style={{ color: 'white', letterSpacing: '0.2px' }}>{twin.name}</Text>
        <Box style={{ width: 1, height: 14, background: 'rgba(255,255,255,0.2)' }} />
        <Text size="xs" fw={500} style={{ color: 'rgba(255,255,255,0.55)', fontVariantNumeric: 'tabular-nums' }}>
          {mins}:{secs}
        </Text>
      </Box>

      {/* ── CENTER CONTENT ── */}
      <Box style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 0, paddingBottom: 100,
      }}>
        {/* Avatar */}
        <AvatarFrame speaking={isSpeaking} listening={isListening} audioLevel={audioLevel} twin={twin} />

        {/* Name */}
        <Box style={{ marginTop: 20, marginBottom: 6, textAlign: 'center' }}>
          <Text fw={800} size="xl" style={{
            color: 'white', letterSpacing: '-0.5px',
            textShadow: isSpeaking ? '0 0 20px rgba(167,139,250,0.6)' : 'none',
            transition: 'text-shadow 0.4s',
          }}>{twin.name}</Text>
        </Box>

        {/* Status */}
        <Box style={{
          height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 22,
        }}>
          {isThinking
            ? <ThinkingDots />
            : <Box style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(10px)',
                border: '1px solid rgba(255,255,255,0.1)', borderRadius: 20,
                padding: '4px 12px',
              }}>
                <Box style={{ width: 6, height: 6, borderRadius: '50%', background: statusDot,
                  boxShadow: `0 0 6px ${statusDot}`, animation: 'vg-status-blink 1.8s ease-in-out infinite' }} />
                <Text size="xs" fw={600} style={{ color: 'rgba(255,255,255,0.7)' }}>{statusLabel}</Text>
              </Box>
          }
        </Box>

        {/* Mirror waveform */}
        <Box style={{ width: '100%', maxWidth: 560, padding: '0 20px' }}>
          <AudioBars analyserRef={analyserRef} speaking={isSpeaking} listening={isListening} />
        </Box>

        {/* Subtitle */}
        <Box style={{
          minHeight: 56, marginTop: 18, padding: '0 24px', maxWidth: 580,
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
          opacity: lastSubtitle ? 1 : 0, transition: 'opacity 0.4s',
        }}>
          <Box style={{
            background: subtitleRole === 'user'
              ? 'linear-gradient(135deg, rgba(124,58,237,0.8), rgba(91,33,182,0.7))'
              : 'rgba(0,0,0,0.55)',
            backdropFilter: 'blur(18px)',
            borderRadius: 16,
            padding: '10px 20px',
            border: subtitleRole === 'user'
              ? '1px solid rgba(167,139,250,0.35)'
              : '1px solid rgba(255,255,255,0.1)',
            boxShadow: subtitleRole === 'user' ? '0 4px 24px rgba(124,58,237,0.3)' : 'none',
          }}>
            <Text size="sm" fw={500} style={{ color: 'white', lineHeight: 1.6, textAlign: 'center' }}>
              {lastSubtitle}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* ── USER PiP ── */}
      <Box style={{
        position: 'absolute', top: 68, right: 16,
        width: 112, height: 158, borderRadius: 18, overflow: 'hidden', zIndex: 20,
        border: isListening
          ? '2px solid rgba(96,165,250,0.85)'
          : '2px solid rgba(255,255,255,0.14)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.05)',
        background: '#06060e', transition: 'border 0.3s',
      }}>
        {isCameraOn
          ? <video ref={userVideoRef} autoPlay muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          : <Box style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <IconVideoOff size={20} color="#444466" />
              <Text size="xs" c="dimmed">Camera off</Text>
            </Box>
        }
        <Box style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)',
          padding: '12px 8px 5px', display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {isListening && (
            <Box style={{ width: 5, height: 5, borderRadius: '50%', background: '#60a5fa',
              animation: 'vg-pip-pulse 0.85s ease-in-out infinite', flexShrink: 0 }} />
          )}
          <Text size="10px" fw={600} style={{ color: 'rgba(255,255,255,0.8)' }}>
            {isListening ? "You're speaking" : 'You'}
          </Text>
        </Box>
      </Box>

      {/* ── CONTROLS ── */}
      <Box style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20,
        padding: '20px 24px 40px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 70%, transparent 100%)',
      }}>
        <Box style={{ display: 'flex', justifyContent: 'center' }}>
          {/* Frosted glass tray */}
          <Box style={{
            display: 'flex', alignItems: 'center', gap: 16,
            background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)', borderRadius: 40,
            padding: '10px 24px',
          }}>
            {[
              {
                icon: isCameraOn ? <IconVideo size={21} /> : <IconVideoOff size={21} />,
                label: 'Camera', active: !isCameraOn, onClick: toggleCamera, size: 50,
              },
              {
                icon: <IconPhone size={26} style={{ transform: 'rotate(135deg)' }} />,
                label: 'End Call', end: true, onClick: handleEnd, size: 62,
              },
              {
                icon: isMuted ? <IconMicrophoneOff size={21} /> : <IconMicrophone size={21} />,
                label: isMuted ? 'Unmute' : 'Mute', active: isMuted, onClick: toggleMute, size: 50,
              },
            ].map(({ icon, label, active, end, onClick, size }) => (
              <Box key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                <ActionIcon size={size} radius="xl" onClick={onClick} style={{
                  background: end
                    ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                    : active
                    ? 'rgba(239,68,68,0.85)'
                    : 'rgba(255,255,255,0.1)',
                  border: end ? 'none' : '1px solid rgba(255,255,255,0.15)',
                  boxShadow: end ? '0 4px 24px rgba(239,68,68,0.5)' : 'none',
                  transition: 'all 0.2s',
                }}>
                  {icon}
                </ActionIcon>
                <Text size="10px" style={{ color: 'rgba(255,255,255,0.45)' }}>{label}</Text>
              </Box>
            ))}
          </Box>
        </Box>
      </Box>

      <style>{`
        @keyframes vg-bg-spin      { to { transform: rotate(360deg); } }
        @keyframes vg-arc-fast     { to { transform: rotate(360deg); } }
        @keyframes vg-arc-slow     { to { transform: rotate(360deg); } }
        @keyframes vg-arc-rev-fast { to { transform: rotate(-360deg); } }
        @keyframes vg-arc-rev-slow { to { transform: rotate(-360deg); } }
        @keyframes vg-orbit        { to { transform: rotate(360deg); } }
        @keyframes vg-outer-pulse  { 0%,100% { opacity: 0.25; } 50% { opacity: 0.7; } }
        @keyframes vg-idle-ring    { 0%,100% { opacity: 0.1; } 50% { opacity: 0.22; } }
        @keyframes vg-dot          { 0%,80%,100% { transform: scale(0.6); opacity: 0.3; } 40% { transform: scale(1.15); opacity: 1; } }
        @keyframes vg-status-blink { 0%,100% { opacity: 0.5; } 50% { opacity: 1; } }
        @keyframes vg-pip-pulse    { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.4); } }
      `}</style>
    </Box>
  )
}
