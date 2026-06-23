import { Box, Text, ActionIcon, Group, Tooltip } from '@mantine/core'
import { IconMicrophone, IconMicrophoneOff, IconVideo, IconVideoOff, IconPhone, IconRobot } from '@tabler/icons-react'
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

interface Props {
  twin: AiTwin
  onEnd: () => void
}

function ThinkingDots() {
  return (
    <Box style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <Box key={i} style={{
          width: 8, height: 8, borderRadius: '50%',
          background: 'rgba(255,255,255,0.8)',
          animation: `dot-bounce 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
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
  const [, setMessages] = useState<{ role: 'user' | 'assistant'; text: string }[]>([])
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
    setLastSubtitle(text)
    setSubtitleRole(role)
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
    setMessages(prev => [...prev, { role: 'user', text: userText }])
    setIsThinking(true)

    try {
      const systemPrompt = `You are ${twin.name} on a live video call with a friend. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'warm, natural, friendly'}. Talk exactly like a real person on a video call — casual, short sentences, warm. React naturally to what they say, ask follow-up questions. Never say "As an AI". You ARE ${twin.name}, a real person on video.`

      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, ...historyRef.current],
          max_tokens: 80,
          temperature: 0.9,
        })
      })
      const chatData = await chatRes.json() as { choices: { message: { content: string } }[] }
      const reply = chatData.choices[0]?.message?.content?.trim() ?? 'I heard you!'

      historyRef.current.push({ role: 'assistant', content: reply })
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
      setIsThinking(false)
      setIsSpeaking(true)
      showSubtitle(reply, 'assistant')

      await speakText(reply, apiKey)
      setIsSpeaking(false)
    } catch {
      setIsThinking(false)
      setIsSpeaking(false)
    }
  }, [twin, speakText])

  // Greet on start
  useEffect(() => {
    if (greeted.current) return
    greeted.current = true
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return
    const greetings = [
      `Hey! So nice to see you — how are you doing?`,
      `Hey! You picked up! How's everything going?`,
      `Oh hey! Great to see you! What's up?`,
    ]
    const greeting = greetings[Math.floor(Math.random() * greetings.length)]
    setTimeout(async () => {
      historyRef.current.push({ role: 'assistant', content: greeting })
      setMessages([{ role: 'assistant', text: greeting }])
      setIsSpeaking(true)
      showSubtitle(greeting, 'assistant')
      await speakText(greeting, apiKey)
      setIsSpeaking(false)
    }, 1000)
  }, [speakText])

  // Speech recognition — only when not speaking/thinking
  useEffect(() => {
    if (isSpeaking || isThinking) { recognitionRef.current?.stop(); return }
    type SRCtor = new () => ISpeechRecognition
    const SR =
      (window as typeof window & { SpeechRecognition?: SRCtor }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: SRCtor }).webkitSpeechRecognition
    if (!SR) return
    const r = new SR()
    r.continuous = false
    r.interimResults = false
    r.lang = 'en-US'
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

  function toggleMute() {
    setIsMuted(m => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = m }); return !m })
  }
  function toggleCamera() {
    setIsCameraOn(c => { streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !c }); return !c })
  }
  function handleEnd() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    recognitionRef.current?.stop()
    audioRef.current?.pause()
    if (timerRef.current) clearInterval(timerRef.current)
    onEnd()
  }

  const mins = Math.floor(duration / 60).toString().padStart(2, '0')
  const secs = (duration % 60).toString().padStart(2, '0')

  return (
    <Box style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', overflow: 'hidden' }}>

      {/* ── FULL-SCREEN AI VIDEO ── */}
      <Box style={{ position: 'absolute', inset: 0 }}>
        {twin.avatar_url ? (
          <img
            src={twin.avatar_url}
            alt={twin.name}
            style={{
              width: '100%', height: '100%',
              objectFit: 'cover', objectPosition: 'center top',
              filter: isSpeaking ? 'brightness(1.05)' : 'brightness(0.92)',
              transition: 'filter 0.4s ease',
            }}
          />
        ) : (
          /* No photo — gradient with centred avatar */
          <Box style={{
            width: '100%', height: '100%',
            background: 'linear-gradient(160deg, #1a0a2e 0%, #0d0820 40%, #050510 100%)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 16,
          }}>
            <Box style={{
              width: 160, height: 160, borderRadius: '50%',
              background: 'rgba(124,58,237,0.18)',
              border: '3px solid rgba(124,58,237,0.35)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              animation: isSpeaking ? 'avatar-pulse 1s ease-in-out infinite' : 'none',
            }}>
              <IconRobot size={80} color="#7c3aed" />
            </Box>
            <Text c="dimmed" size="sm">Upload a photo to your AI Twin</Text>
          </Box>
        )}

        {/* Speaking green wash */}
        <Box style={{
          position: 'absolute', inset: 0,
          background: isSpeaking ? 'rgba(34,197,94,0.07)' : 'transparent',
          transition: 'background 0.5s ease', pointerEvents: 'none',
        }} />

        {/* Dark vignette at top & bottom */}
        <Box style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 22%, transparent 55%, rgba(0,0,0,0.7) 100%)',
        }} />

        {/* Speaking pulse border */}
        {isSpeaking && (
          <Box style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            boxShadow: 'inset 0 0 0 4px rgba(34,197,94,0.7)',
            animation: 'border-pulse 1s ease-in-out infinite',
            borderRadius: 0,
          }} />
        )}
      </Box>

      {/* ── TOP BAR ── */}
      <Box style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        padding: '20px 24px 0',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        zIndex: 10,
      }}>
        {/* Name + status */}
        <Box>
          <Group gap={8} align="center">
            <Box style={{
              width: 10, height: 10, borderRadius: '50%',
              background: isSpeaking ? '#22c55e' : isListening ? '#a78bfa' : '#64748b',
              boxShadow: isSpeaking ? '0 0 8px #22c55e' : 'none',
              transition: 'all 0.3s ease',
            }} />
            <Text fw={700} c="white" size="lg" style={{ textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
              {twin.name}
            </Text>
            <Text size="sm" style={{ color: isSpeaking ? '#22c55e' : isThinking ? '#a78bfa' : 'rgba(255,255,255,0.6)' }}>
              {isSpeaking ? 'Speaking' : isThinking ? 'Thinking...' : isListening ? 'Listening to you' : 'Connected'}
            </Text>
          </Group>
        </Box>

        {/* Timer */}
        <Text size="sm" fw={600} style={{
          color: 'rgba(255,255,255,0.8)',
          background: 'rgba(0,0,0,0.4)',
          padding: '4px 12px', borderRadius: 20,
          backdropFilter: 'blur(8px)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {mins}:{secs}
        </Text>
      </Box>

      {/* ── SUBTITLE / CAPTION BAR ── */}
      <Box style={{
        position: 'absolute', bottom: 110, left: 0, right: 0,
        display: 'flex', justifyContent: 'center',
        padding: '0 24px',
        zIndex: 10,
        minHeight: 56,
        transition: 'opacity 0.4s ease',
        opacity: lastSubtitle ? 1 : 0,
      }}>
        <Box style={{
          maxWidth: 580,
          background: subtitleRole === 'user'
            ? 'rgba(124,58,237,0.75)'
            : 'rgba(0,0,0,0.72)',
          backdropFilter: 'blur(12px)',
          borderRadius: 14,
          padding: '10px 18px',
          border: subtitleRole === 'user'
            ? '1px solid rgba(124,58,237,0.4)'
            : '1px solid rgba(255,255,255,0.12)',
          textAlign: 'center',
          transition: 'opacity 0.4s ease',
        }}>
          {isThinking && subtitleRole === 'user'
            ? <ThinkingDots />
            : <Text size="md" c="white" fw={500} style={{ lineHeight: 1.5, textShadow: '0 1px 3px rgba(0,0,0,0.5)' }}>
                {lastSubtitle}
              </Text>
          }
        </Box>
      </Box>

      {/* ── USER PiP ── */}
      <Box style={{
        position: 'absolute', bottom: 110, right: 18,
        width: 140, height: 196,
        borderRadius: 16, overflow: 'hidden',
        border: isListening ? '2px solid rgba(167,139,250,0.9)' : '2px solid rgba(255,255,255,0.18)',
        background: '#0d0d1a',
        boxShadow: isListening
          ? '0 0 20px rgba(167,139,250,0.4), 0 8px 28px rgba(0,0,0,0.6)'
          : '0 8px 28px rgba(0,0,0,0.6)',
        transition: 'border 0.3s, box-shadow 0.3s',
        zIndex: 20,
      }}>
        {isCameraOn
          ? <video ref={userVideoRef} autoPlay muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          : <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
              <IconVideoOff size={26} color="#4a4a6a" />
              <Text size="xs" c="dimmed">Camera off</Text>
            </Box>
        }
        {/* You label */}
        <Box style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
          padding: '14px 8px 5px',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {isListening && (
            <Box style={{
              width: 6, height: 6, borderRadius: '50%', background: '#a78bfa',
              animation: 'listen-pulse 0.9s ease-in-out infinite', flexShrink: 0,
            }} />
          )}
          <Text size="11px" c="white" fw={600}>{isListening ? 'Listening...' : 'You'}</Text>
        </Box>
      </Box>

      {/* ── CONTROLS ── */}
      <Box style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 24px 28px',
        background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        zIndex: 20,
      }}>
        <Group gap={16}>
          <Tooltip label={isMuted ? 'Unmute' : 'Mute'} withArrow>
            <ActionIcon size={56} radius="xl" onClick={toggleMute} style={{
              background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.15)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}>
              {isMuted ? <IconMicrophoneOff size={22} color="white" /> : <IconMicrophone size={22} color="white" />}
            </ActionIcon>
          </Tooltip>

          <Tooltip label={isCameraOn ? 'Turn off camera' : 'Turn on camera'} withArrow>
            <ActionIcon size={56} radius="xl" onClick={toggleCamera} style={{
              background: isCameraOn ? 'rgba(255,255,255,0.15)' : '#ef4444',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.18)',
            }}>
              {isCameraOn ? <IconVideo size={22} color="white" /> : <IconVideoOff size={22} color="white" />}
            </ActionIcon>
          </Tooltip>

          <Tooltip label="End call" withArrow>
            <ActionIcon size={68} radius="xl" onClick={handleEnd} style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: '0 4px 24px rgba(239,68,68,0.5)',
            }}>
              <IconPhone size={28} color="white" style={{ transform: 'rotate(135deg)' }} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      <style>{`
        @keyframes avatar-pulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.4); }
          50% { box-shadow: 0 0 0 18px rgba(124,58,237,0); }
        }
        @keyframes border-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes listen-pulse {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.25); }
        }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.65); opacity: 0.35; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </Box>
  )
}
