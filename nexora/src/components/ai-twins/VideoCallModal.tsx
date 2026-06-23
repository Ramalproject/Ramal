import { Box, Text, ActionIcon, Group, Tooltip } from '@mantine/core'
import { IconMicrophone, IconMicrophoneOff, IconVideo, IconVideoOff, IconPhone } from '@tabler/icons-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import type { AiTwin } from '../../types'

const OPENAI_KEY_STORAGE = 'nexora_openai_api_key'

interface ISpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onstart: (() => void) | null
  onend: (() => void) | null
  onresult: ((e: SpeechRecognitionEvent) => void) | null
  start: () => void
  stop: () => void
}

interface Props { twin: AiTwin; onEnd: () => void }

// ── Animated talking face (used when no photo is set) ─────────────────────────
function TalkingFace({ isSpeaking, isListening, name }: { isSpeaking: boolean; isListening: boolean; name: string }) {
  const [blinkL, setBlinkL] = useState(false)
  const [blinkR, setBlinkR] = useState(false)
  const [mouthOpen, setMouthOpen] = useState(0) // 0–1

  // Natural eye blink
  useEffect(() => {
    function doBlink() {
      setBlinkL(true); setBlinkR(true)
      setTimeout(() => { setBlinkL(false); setBlinkR(false) }, 140)
      setTimeout(doBlink, 2500 + Math.random() * 3000)
    }
    const t = setTimeout(doBlink, 1200 + Math.random() * 1500)
    return () => clearTimeout(t)
  }, [])

  // Mouth animation while speaking
  useEffect(() => {
    if (!isSpeaking) { setMouthOpen(0); return }
    let frame = 0
    const shapes = [0.7, 0.3, 0.9, 0.2, 0.8, 0.4, 0.6, 0.1, 0.85, 0.35]
    const iv = setInterval(() => {
      setMouthOpen(shapes[frame % shapes.length])
      frame++
    }, 120)
    return () => { clearInterval(iv); setMouthOpen(0) }
  }, [isSpeaking])

  const eyeH = 26
  return (
    <Box style={{
      width: '100%', height: '100%', position: 'relative',
      background: 'linear-gradient(160deg, #140828 0%, #0a0520 50%, #050510 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden',
    }}>
      {/* Background glow rings */}
      <Box style={{
        position: 'absolute', width: 340, height: 340, borderRadius: '50%',
        background: isSpeaking
          ? 'radial-gradient(circle, rgba(34,197,94,0.1) 0%, transparent 65%)'
          : 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 65%)',
        transition: 'background 0.5s ease',
      }} />

      {/* Face */}
      <Box style={{
        position: 'relative',
        width: 220, height: 260,
        borderRadius: '50% 50% 45% 45%',
        background: 'linear-gradient(170deg, #2a1050 0%, #1a0840 50%, #120630 100%)',
        border: isSpeaking
          ? '2.5px solid rgba(34,197,94,0.7)'
          : '2.5px solid rgba(124,58,237,0.5)',
        boxShadow: isSpeaking
          ? '0 0 32px rgba(34,197,94,0.25), inset 0 0 40px rgba(0,0,0,0.4)'
          : '0 0 24px rgba(124,58,237,0.2), inset 0 0 40px rgba(0,0,0,0.4)',
        transition: 'border 0.3s, box-shadow 0.3s',
        animation: isSpeaking ? 'face-talk 0.5s ease-in-out infinite alternate' : 'face-idle 3.5s ease-in-out infinite',
      }}>
        {/* Forehead highlight */}
        <Box style={{
          position: 'absolute', top: 20, left: '25%', width: '50%', height: 30,
          borderRadius: '50%',
          background: 'rgba(167,139,250,0.07)',
        }} />

        {/* Left eye */}
        <Box style={{
          position: 'absolute', top: 82, left: 44,
          width: 44, height: blinkL ? 3 : eyeH, borderRadius: blinkL ? 2 : '50%',
          background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
          boxShadow: '0 0 10px rgba(124,58,237,0.6)',
          transition: 'height 0.06s ease',
          overflow: 'hidden',
        }}>
          {/* Pupil */}
          {!blinkL && <Box style={{ position: 'absolute', top: 6, left: 12, width: 12, height: 12, borderRadius: '50%', background: '#1a0840' }} />}
          {/* Glint */}
          {!blinkL && <Box style={{ position: 'absolute', top: 4, left: 8, width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }} />}
        </Box>

        {/* Right eye */}
        <Box style={{
          position: 'absolute', top: 82, right: 44,
          width: 44, height: blinkR ? 3 : eyeH, borderRadius: blinkR ? 2 : '50%',
          background: 'linear-gradient(135deg, #a78bfa, #7c3aed)',
          boxShadow: '0 0 10px rgba(124,58,237,0.6)',
          transition: 'height 0.06s ease',
          overflow: 'hidden',
        }}>
          {!blinkR && <Box style={{ position: 'absolute', top: 6, left: 12, width: 12, height: 12, borderRadius: '50%', background: '#1a0840' }} />}
          {!blinkR && <Box style={{ position: 'absolute', top: 4, left: 8, width: 5, height: 5, borderRadius: '50%', background: 'rgba(255,255,255,0.7)' }} />}
        </Box>

        {/* Nose (subtle) */}
        <Box style={{
          position: 'absolute', top: 125, left: '50%', transform: 'translateX(-50%)',
          width: 18, height: 20,
          borderLeft: '2px solid rgba(124,58,237,0.3)',
          borderRight: '2px solid rgba(124,58,237,0.3)',
          borderBottom: '2px solid rgba(124,58,237,0.3)',
          borderRadius: '0 0 10px 10px',
        }} />

        {/* Mouth */}
        <Box style={{
          position: 'absolute', bottom: 52, left: '50%', transform: 'translateX(-50%)',
          width: 68,
          height: Math.max(6, mouthOpen * 32),
          borderRadius: mouthOpen > 0.2 ? '6px 6px 20px 20px' : '0 0 12px 12px',
          background: mouthOpen > 0.1
            ? 'linear-gradient(to bottom, rgba(80,20,140,0.9) 0%, rgba(20,5,40,1) 100%)'
            : 'rgba(124,58,237,0.5)',
          border: '1.5px solid rgba(124,58,237,0.4)',
          transition: 'height 0.1s ease, border-radius 0.1s ease',
          overflow: 'hidden',
        }}>
          {/* Teeth */}
          {mouthOpen > 0.4 && (
            <Box style={{ position: 'absolute', top: 0, left: 8, right: 8, height: 8, background: 'rgba(240,220,255,0.85)', borderRadius: '0 0 4px 4px' }} />
          )}
        </Box>

        {/* Listening indicator — subtle ear glow */}
        {isListening && (
          <>
            <Box style={{ position: 'absolute', top: 90, left: -6, width: 10, height: 30, borderRadius: '50%', background: 'rgba(124,58,237,0.5)', animation: 'ear-pulse 1s ease-in-out infinite' }} />
            <Box style={{ position: 'absolute', top: 90, right: -6, width: 10, height: 30, borderRadius: '50%', background: 'rgba(124,58,237,0.5)', animation: 'ear-pulse 1s 0.15s ease-in-out infinite' }} />
          </>
        )}
      </Box>

      {/* Name below face */}
      <Text fw={700} c="white" size="sm" style={{
        position: 'absolute', bottom: 60,
        textShadow: '0 1px 8px rgba(0,0,0,0.8)',
        letterSpacing: 1,
      }}>{name}</Text>
    </Box>
  )
}

function ThinkingDots() {
  return (
    <Box style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <Box key={i} style={{ width: 8, height: 8, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', animation: `dot-bounce 1.2s ${i * 0.2}s ease-in-out infinite` }} />
      ))}
    </Box>
  )
}

export default function VideoCallModal({ twin, onEnd }: Props) {
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [duration, setDuration] = useState(0)
  const [lastSubtitle, setLastSubtitle] = useState('')
  const [subtitleRole, setSubtitleRole] = useState<'user' | 'assistant'>('assistant')

  const userVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const greeted = useRef(false)
  const subtitleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) { setIsCameraOn(false); return }
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => {
        streamRef.current = stream
        if (userVideoRef.current) userVideoRef.current.srcObject = stream
      })
      .catch(() => {
        setIsCameraOn(false)
        notifications.show({ title: 'Camera unavailable', message: 'Mic-only mode active', color: 'orange' })
      })
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()) }
  }, [])

  function showSubtitle(text: string, role: 'user' | 'assistant') {
    setLastSubtitle(text); setSubtitleRole(role)
    if (subtitleTimer.current) clearTimeout(subtitleTimer.current)
    subtitleTimer.current = setTimeout(() => setLastSubtitle(''), 6000)
  }

  const speakText = useCallback(async (text: string, apiKey: string) => {
    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova' })
    })
    if (!ttsRes.ok) return
    const blob = await ttsRes.blob()
    const url = URL.createObjectURL(blob)
    const audio = new Audio(url)
    audioRef.current = audio
    await new Promise<void>(resolve => {
      audio.onended = () => { URL.revokeObjectURL(url); resolve() }
      audio.onerror = () => resolve()
      audio.play().catch(() => resolve())
    })
  }, [])

  const sendToAI = useCallback(async (userText: string) => {
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return
    showSubtitle(userText, 'user')
    historyRef.current.push({ role: 'user', content: userText })
    setIsThinking(true)
    try {
      const systemPrompt = `You are ${twin.name} on a live video call. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'warm, natural, friendly'}. Talk like a real person on a video call — casual, warm, 1-2 sentences. Never say "As an AI". React naturally. Be genuinely present.`
      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, ...historyRef.current],
          max_tokens: 80, temperature: 0.9,
        })
      })
      const chatData = await chatRes.json() as { choices: { message: { content: string } }[] }
      const reply = chatData.choices[0]?.message?.content?.trim() ?? 'I heard you!'
      historyRef.current.push({ role: 'assistant', content: reply })
      setIsThinking(false); setIsSpeaking(true)
      showSubtitle(reply, 'assistant')
      await speakText(reply, apiKey)
      setIsSpeaking(false)
    } catch {
      setIsThinking(false); setIsSpeaking(false)
    }
  }, [twin, speakText])

  useEffect(() => {
    if (greeted.current) return
    greeted.current = true
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return
    const greets = [`Hey! So nice to see you — how are you doing?`, `Hey! You picked up! How's everything going?`, `Oh hey! Great to see you! What's up?`]
    const greeting = greets[Math.floor(Math.random() * greets.length)]
    setTimeout(async () => {
      historyRef.current.push({ role: 'assistant', content: greeting })
      setIsSpeaking(true); showSubtitle(greeting, 'assistant')
      await speakText(greeting, apiKey)
      setIsSpeaking(false)
    }, 900)
  }, [speakText])

  useEffect(() => {
    if (isSpeaking || isThinking) { recognitionRef.current?.stop(); return }
    type SRCtor = new () => ISpeechRecognition
    const SR =
      (window as typeof window & { SpeechRecognition?: SRCtor }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = false; r.interimResults = false; r.lang = 'en-US'
    r.onstart = () => setIsListening(true)
    r.onend = () => setIsListening(false)
    r.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[e.results.length - 1][0].transcript.trim()
      if (text) sendToAI(text)
    }
    recognitionRef.current = r
    try { r.start() } catch { /* already started */ }
    return () => { try { r.stop() } catch { /* already stopped */ } }
  }, [isSpeaking, isThinking, sendToAI])

  function toggleMute() { setIsMuted(m => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = m }); return !m }) }
  function toggleCamera() { setIsCameraOn(c => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !c }); return !c }) }
  function handleEnd() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    recognitionRef.current?.stop(); audioRef.current?.pause()
    if (timerRef.current) clearInterval(timerRef.current)
    onEnd()
  }

  const mins = Math.floor(duration / 60).toString().padStart(2, '0')
  const secs = (duration % 60).toString().padStart(2, '0')

  return (
    <Box style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', overflow: 'hidden' }}>

      {/* ── FULL SCREEN AI VIDEO / FACE ── */}
      <Box style={{ position: 'absolute', inset: 0 }}>
        {twin.avatar_url ? (
          /* Photo fills screen with natural animation */
          <>
            <img
              src={twin.avatar_url}
              alt={twin.name}
              style={{
                width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center top',
                animation: isSpeaking
                  ? 'photo-talk 0.45s ease-in-out infinite alternate'
                  : 'photo-idle 4s ease-in-out infinite',
                filter: isSpeaking ? 'brightness(1.06)' : 'brightness(0.95)',
                transition: 'filter 0.3s ease',
              }}
            />
            {/* Subtle film-grain overlay for realism */}
            <Box style={{
              position: 'absolute', inset: 0, opacity: 0.03,
              backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'n\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23n)\'/%3E%3C/svg%3E")',
              backgroundSize: '200px 200px', pointerEvents: 'none',
            }} />
          </>
        ) : (
          /* Animated talking face when no photo */
          <TalkingFace isSpeaking={isSpeaking} isListening={isListening} name={twin.name} />
        )}

        {/* Speaking green pulse border */}
        {isSpeaking && (
          <Box style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 4px rgba(34,197,94,0.65)',
            animation: 'border-pulse 0.8s ease-in-out infinite',
          }} />
        )}

        {/* Vignette */}
        <Box style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 18%, transparent 60%, rgba(0,0,0,0.65) 100%)',
        }} />
      </Box>

      {/* ── TOP BAR ── */}
      <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
        <Group gap={8} align="center">
          <Box style={{
            width: 10, height: 10, borderRadius: '50%',
            background: isSpeaking ? '#22c55e' : isListening ? '#a78bfa' : '#94a3b8',
            boxShadow: isSpeaking ? '0 0 8px #22c55e' : 'none',
            transition: 'all 0.3s ease',
          }} />
          <Text fw={700} c="white" size="lg" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>{twin.name}</Text>
          <Text size="sm" style={{ color: isSpeaking ? '#22c55e' : isThinking ? '#c4b5fd' : isListening ? '#c4b5fd' : 'rgba(255,255,255,0.6)' }}>
            {isSpeaking ? 'Speaking' : isThinking ? 'Thinking...' : isListening ? 'Listening to you' : 'Connected'}
          </Text>
        </Group>
        <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: 20, backdropFilter: 'blur(8px)', fontVariantNumeric: 'tabular-nums' }}>
          {mins}:{secs}
        </Text>
      </Box>

      {/* ── SUBTITLE BAR ── */}
      <Box style={{ position: 'absolute', bottom: 116, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 80px 0 22px', zIndex: 10, minHeight: 52, opacity: lastSubtitle ? 1 : 0, transition: 'opacity 0.4s ease' }}>
        <Box style={{
          maxWidth: 560,
          background: subtitleRole === 'user' ? 'rgba(124,58,237,0.78)' : 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(14px)',
          borderRadius: 14, padding: '10px 18px',
          border: subtitleRole === 'user' ? '1px solid rgba(124,58,237,0.4)' : '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center',
        }}>
          {isThinking && subtitleRole === 'user' ? <ThinkingDots /> : (
            <Text size="md" c="white" fw={500} style={{ lineHeight: 1.5 }}>{lastSubtitle}</Text>
          )}
        </Box>
      </Box>

      {/* ── USER PiP ── */}
      <Box style={{
        position: 'absolute', bottom: 116, right: 18,
        width: 130, height: 182, borderRadius: 14, overflow: 'hidden',
        border: isListening ? '2px solid rgba(167,139,250,0.9)' : '2px solid rgba(255,255,255,0.2)',
        background: '#0d0d1a',
        boxShadow: isListening ? '0 0 18px rgba(167,139,250,0.4), 0 8px 28px rgba(0,0,0,0.7)' : '0 8px 28px rgba(0,0,0,0.7)',
        transition: 'border 0.3s, box-shadow 0.3s', zIndex: 20,
      }}>
        {isCameraOn
          ? <video ref={userVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          : <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
              <IconVideoOff size={24} color="#4a4a6a" />
              <Text size="xs" c="dimmed">Camera off</Text>
            </Box>
        }
        <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)', padding: '12px 8px 5px', display: 'flex', alignItems: 'center', gap: 5 }}>
          {isListening && <Box style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', animation: 'ear-pulse 0.9s ease-in-out infinite', flexShrink: 0 }} />}
          <Text size="11px" c="white" fw={600}>{isListening ? 'Listening...' : 'You'}</Text>
        </Box>
      </Box>

      {/* ── CONTROLS ── */}
      <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 24px 26px', background: 'linear-gradient(to top, rgba(0,0,0,0.88), transparent)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 20 }}>
        <Group gap={16}>
          <Tooltip label={isMuted ? 'Unmute' : 'Mute'} withArrow>
            <ActionIcon size={56} radius="xl" onClick={toggleMute} style={{ background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.16)' }}>
              {isMuted ? <IconMicrophoneOff size={22} color="white" /> : <IconMicrophone size={22} color="white" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={isCameraOn ? 'Turn off camera' : 'Turn on camera'} withArrow>
            <ActionIcon size={56} radius="xl" onClick={toggleCamera} style={{ background: isCameraOn ? 'rgba(255,255,255,0.14)' : '#ef4444', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.16)' }}>
              {isCameraOn ? <IconVideo size={22} color="white" /> : <IconVideoOff size={22} color="white" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label="End call" withArrow>
            <ActionIcon size={68} radius="xl" onClick={handleEnd} style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)', boxShadow: '0 4px 24px rgba(239,68,68,0.5)' }}>
              <IconPhone size={28} color="white" style={{ transform: 'rotate(135deg)' }} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      <style>{`
        @keyframes face-idle {
          0%, 100% { transform: scale(1) translateY(0px); }
          50% { transform: scale(1.008) translateY(-4px); }
        }
        @keyframes face-talk {
          from { transform: scale(1) translateY(0px) rotate(-0.3deg); }
          to   { transform: scale(1.01) translateY(-3px) rotate(0.3deg); }
        }
        @keyframes photo-idle {
          0%, 100% { transform: scale(1.0) translateY(0px); }
          50% { transform: scale(1.012) translateY(-5px); }
        }
        @keyframes photo-talk {
          from { transform: scale(1.0) translateY(0px) rotate(-0.2deg); }
          to   { transform: scale(1.015) translateY(-4px) rotate(0.2deg); }
        }
        @keyframes border-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }
        @keyframes ear-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.65); opacity: 0.35; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </Box>
  )
}
