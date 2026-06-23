import { Box, Text, Avatar, ActionIcon, Group, Tooltip } from '@mantine/core'
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

function Waveform({ active }: { active: boolean }) {
  const bars = [3, 5, 8, 5, 10, 7, 4, 9, 6, 8, 4, 6, 10, 5, 7, 3, 8, 6, 4, 7]
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 3, height: 40 }}>
      {bars.map((h, i) => (
        <Box
          key={i}
          style={{
            width: 3,
            height: active ? h * 3 : 4,
            borderRadius: 2,
            background: active
              ? `rgba(124,58,237,${0.5 + (h / 10) * 0.5})`
              : 'rgba(255,255,255,0.15)',
            transition: `height ${0.15 + (i % 5) * 0.05}s ease`,
            animation: active ? `wave-${i % 4} ${0.6 + (i % 3) * 0.2}s ease-in-out infinite alternate` : 'none',
          }}
        />
      ))}
    </Box>
  )
}

export default function VideoCallModal({ twin, onEnd }: Props) {
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [duration, setDuration] = useState(0)
  const [lastUserText, setLastUserText] = useState('')
  const [lastAiText, setLastAiText] = useState('')
  const [bgPhase, setBgPhase] = useState(0)

  const userVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    bgTimerRef.current = setInterval(() => setBgPhase(p => (p + 1) % 4), 3000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
      if (bgTimerRef.current) clearInterval(bgTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setIsCameraOn(false)
      return
    }
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

  const sendToAI = useCallback(async (text: string) => {
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return

    setLastUserText(text)
    setIsSpeaking(true)

    try {
      const systemPrompt = `You are ${twin.name}, a friendly AI companion on a video call. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'warm, engaging and conversational'}. Keep responses SHORT and natural — 1-2 sentences max, like a real video call conversation. Be warm and personable.`

      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          max_tokens: 80,
        })
      })
      const chatData = await chatRes.json() as { choices: { message: { content: string } }[] }
      const reply = chatData.choices[0]?.message?.content ?? 'I heard you!'
      setLastAiText(reply)

      const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model: 'tts-1', input: reply, voice: 'nova' })
      })
      const blob = await ttsRes.blob()
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio
      audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url) }
      audio.play()
    } catch {
      setIsSpeaking(false)
    }
  }, [twin])

  useEffect(() => {
    type SRConstructor = new () => ISpeechRecognition
    const SR: SRConstructor | undefined =
      (window as typeof window & { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: SRConstructor }).webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => setIsListening(false)
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[e.results.length - 1][0].transcript.trim()
      if (text && !isSpeaking) sendToAI(text)
    }
    recognitionRef.current = recognition
    recognition.start()
    return () => recognition.stop()
  }, [isSpeaking, sendToAI])

  function toggleMute() {
    setIsMuted(m => {
      streamRef.current?.getAudioTracks().forEach(t => { t.enabled = m })
      return !m
    })
  }

  function toggleCamera() {
    setIsCameraOn(c => {
      streamRef.current?.getVideoTracks().forEach(t => { t.enabled = !c })
      return !c
    })
  }

  function handleEnd() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    recognitionRef.current?.stop()
    audioRef.current?.pause()
    if (timerRef.current) clearInterval(timerRef.current)
    if (bgTimerRef.current) clearInterval(bgTimerRef.current)
    onEnd()
  }

  const mins = Math.floor(duration / 60).toString().padStart(2, '0')
  const secs = (duration % 60).toString().padStart(2, '0')

  const bgGradients = [
    'radial-gradient(ellipse at 30% 40%, #1a0a2e 0%, #050510 60%)',
    'radial-gradient(ellipse at 70% 30%, #0a1a2e 0%, #050510 60%)',
    'radial-gradient(ellipse at 50% 60%, #0e0a2e 0%, #050510 60%)',
    'radial-gradient(ellipse at 20% 70%, #0a0e2e 0%, #050510 60%)',
  ]

  return (
    <Box style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: bgGradients[bgPhase],
      transition: 'background 3s ease',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Ambient glow behind AI */}
      <Box style={{
        position: 'absolute',
        top: '15%', left: '50%', transform: 'translateX(-50%)',
        width: 400, height: 400,
        borderRadius: '50%',
        background: isSpeaking
          ? 'radial-gradient(circle, rgba(34,197,94,0.12) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(124,58,237,0.1) 0%, transparent 70%)',
        transition: 'background 0.5s ease',
        pointerEvents: 'none',
      }} />

      {/* Duration top-left */}
      <Box style={{ position: 'absolute', top: 20, left: 24 }}>
        <Text size="sm" fw={600} style={{
          color: 'rgba(255,255,255,0.7)',
          background: 'rgba(0,0,0,0.3)',
          padding: '4px 12px',
          borderRadius: 20,
          backdropFilter: 'blur(8px)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {mins}:{secs}
        </Text>
      </Box>

      {/* Connection quality top-right */}
      <Box style={{ position: 'absolute', top: 20, right: 24, display: 'flex', gap: 2, alignItems: 'flex-end' }}>
        {[4, 7, 10, 13].map((h, i) => (
          <Box key={i} style={{ width: 3, height: h, background: 'rgba(34,197,94,0.8)', borderRadius: 1 }} />
        ))}
      </Box>

      {/* Main AI "video" area */}
      <Box style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        paddingBottom: 140,
      }}>
        {/* Avatar with glow rings */}
        <Box style={{ position: 'relative', marginBottom: 28 }}>
          {/* Outer glow ring */}
          <Box style={{
            position: 'absolute',
            inset: -24,
            borderRadius: '50%',
            background: isSpeaking
              ? 'radial-gradient(circle, rgba(34,197,94,0.2) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(124,58,237,0.15) 0%, transparent 70%)',
            transition: 'background 0.4s ease',
          }} />

          {/* Animated rings when speaking */}
          {isSpeaking && [1, 2, 3].map(i => (
            <Box key={i} style={{
              position: 'absolute',
              inset: -(i * 18),
              borderRadius: '50%',
              border: `1.5px solid rgba(34,197,94,${0.35 / i})`,
              animation: `ring-pulse ${0.9 + i * 0.35}s ease-in-out infinite`,
            }} />
          ))}

          {/* Listening ring */}
          {isListening && !isSpeaking && (
            <Box style={{
              position: 'absolute', inset: -10,
              borderRadius: '50%',
              border: '2px solid rgba(124,58,237,0.5)',
              animation: 'listen-pulse 1.5s ease-in-out infinite',
            }} />
          )}

          <Avatar
            src={twin.avatar_url}
            radius="xl"
            size={160}
            style={{
              border: isSpeaking
                ? '4px solid rgba(34,197,94,0.8)'
                : '4px solid rgba(124,58,237,0.8)',
              boxShadow: isSpeaking
                ? '0 0 40px rgba(34,197,94,0.3), 0 0 80px rgba(34,197,94,0.1)'
                : '0 0 40px rgba(124,58,237,0.2), 0 0 80px rgba(124,58,237,0.1)',
              transition: 'all 0.4s ease',
            }}
          >
            <IconRobot size={72} color="#7c3aed" />
          </Avatar>

          {/* Status dot */}
          <Box style={{
            position: 'absolute', bottom: 6, right: 6,
            width: 18, height: 18, borderRadius: '50%',
            background: isSpeaking ? '#22c55e' : isListening ? '#7c3aed' : '#64748b',
            border: '3px solid #050510',
            transition: 'background 0.3s ease',
            boxShadow: isSpeaking ? '0 0 8px rgba(34,197,94,0.6)' : 'none',
          }} />
        </Box>

        {/* Name */}
        <Text fw={800} size="xl" mb={4} style={{
          color: 'white',
          fontSize: '1.6rem',
          letterSpacing: '-0.3px',
          textShadow: '0 2px 20px rgba(0,0,0,0.5)',
        }}>
          {twin.name}
        </Text>

        {/* Status label */}
        <Box style={{
          background: isSpeaking ? 'rgba(34,197,94,0.15)' : 'rgba(124,58,237,0.15)',
          border: `1px solid ${isSpeaking ? 'rgba(34,197,94,0.3)' : 'rgba(124,58,237,0.3)'}`,
          borderRadius: 20, padding: '4px 14px', marginBottom: 28,
          transition: 'all 0.3s ease',
        }}>
          <Text size="xs" fw={600} style={{ color: isSpeaking ? '#22c55e' : '#a78bfa' }}>
            {isSpeaking ? '● Speaking' : isListening ? '● Listening' : 'AI Twin · Connected'}
          </Text>
        </Box>

        {/* Waveform */}
        <Waveform active={isSpeaking} />

        {/* Subtitles */}
        <Box style={{
          marginTop: 28,
          maxWidth: 520,
          width: '100%',
          padding: '0 24px',
          minHeight: 80,
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          {lastUserText && (
            <Box style={{
              background: 'rgba(124,58,237,0.18)',
              backdropFilter: 'blur(8px)',
              borderRadius: 12,
              padding: '8px 14px',
              textAlign: 'right',
              border: '1px solid rgba(124,58,237,0.2)',
            }}>
              <Text size="sm" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
                {lastUserText}
              </Text>
            </Box>
          )}
          {lastAiText && (
            <Box style={{
              background: 'rgba(255,255,255,0.06)',
              backdropFilter: 'blur(8px)',
              borderRadius: 12,
              padding: '8px 14px',
              border: '1px solid rgba(255,255,255,0.08)',
            }}>
              <Text size="sm" style={{ color: 'rgba(255,255,255,0.85)', lineHeight: 1.5 }}>
                {lastAiText}
              </Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* User camera PiP */}
      <Box style={{
        position: 'absolute', bottom: 100, right: 20,
        width: 180, height: 130, borderRadius: 16,
        overflow: 'hidden',
        border: '2px solid rgba(255,255,255,0.15)',
        background: '#0d0d1a',
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
      }}>
        {isCameraOn
          ? <video ref={userVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          : <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
              <IconVideoOff size={28} color="#4a4a6a" />
              <Text size="xs" c="dimmed">Camera off</Text>
            </Box>
        }
        {/* "You" label */}
        <Box style={{
          position: 'absolute', bottom: 6, left: 8,
          background: 'rgba(0,0,0,0.5)', borderRadius: 6,
          padding: '2px 6px', backdropFilter: 'blur(4px)',
        }}>
          <Text size="10px" c="white" fw={600}>You</Text>
        </Box>
      </Box>

      {/* Controls bar */}
      <Box style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '20px 24px 28px',
        background: 'linear-gradient(to top, rgba(5,5,16,0.95), transparent)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
      }}>
        <Group gap={16}>
          <Tooltip label={isMuted ? 'Unmute' : 'Mute'} withArrow>
            <ActionIcon
              size={56} radius="xl"
              onClick={toggleMute}
              style={{
                background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {isMuted ? <IconMicrophoneOff size={22} color="white" /> : <IconMicrophone size={22} color="white" />}
            </ActionIcon>
          </Tooltip>

          <Tooltip label={isCameraOn ? 'Turn off camera' : 'Turn on camera'} withArrow>
            <ActionIcon
              size={56} radius="xl"
              onClick={toggleCamera}
              style={{
                background: isCameraOn ? 'rgba(255,255,255,0.12)' : '#ef4444',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {isCameraOn ? <IconVideo size={22} color="white" /> : <IconVideoOff size={22} color="white" />}
            </ActionIcon>
          </Tooltip>

          <Tooltip label="End call" withArrow>
            <ActionIcon
              size={68} radius="xl"
              onClick={handleEnd}
              style={{
                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                boxShadow: '0 4px 20px rgba(239,68,68,0.4)',
              }}
            >
              <IconPhone size={28} color="white" style={{ transform: 'rotate(135deg)' }} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      <style>{`
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.08); opacity: 0.4; }
        }
        @keyframes listen-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.04); }
        }
        @keyframes wave-0 { from { height: 6px; } to { height: 24px; } }
        @keyframes wave-1 { from { height: 10px; } to { height: 30px; } }
        @keyframes wave-2 { from { height: 8px; } to { height: 20px; } }
        @keyframes wave-3 { from { height: 12px; } to { height: 28px; } }
      `}</style>
    </Box>
  )
}
