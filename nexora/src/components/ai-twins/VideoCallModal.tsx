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

interface Message { role: 'user' | 'assistant'; text: string }

interface Props {
  twin: AiTwin
  onEnd: () => void
}

function Waveform({ active, color = '#7c3aed' }: { active: boolean; color?: string }) {
  const heights = [3, 5, 8, 5, 10, 7, 4, 9, 6, 8, 4, 6, 10, 5, 7, 3, 8, 6, 4, 7]
  return (
    <Box style={{ display: 'flex', alignItems: 'center', gap: 3, height: 36 }}>
      {heights.map((h, i) => (
        <Box key={i} style={{
          width: 3,
          height: active ? h * 3 : 4,
          borderRadius: 2,
          background: active ? `${color}${Math.round(0.5 + (h / 10) * 0.5 * 255).toString(16).padStart(2, '0')}` : 'rgba(255,255,255,0.12)',
          transition: `height ${0.15 + (i % 5) * 0.05}s ease`,
          animation: active ? `wave-${i % 4} ${0.5 + (i % 3) * 0.2}s ease-in-out infinite alternate` : 'none',
        }} />
      ))}
    </Box>
  )
}

function ThinkingDots() {
  return (
    <Box style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
      {[0, 1, 2].map(i => (
        <Box key={i} style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'rgba(167,139,250,0.7)',
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
  const [messages, setMessages] = useState<Message[]>([])
  const [bgPhase, setBgPhase] = useState(0)

  const userVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const bgTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const greeted = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    bgTimerRef.current = setInterval(() => setBgPhase(p => (p + 1) % 4), 4000)
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
  }, [twin])

  const sendToAI = useCallback(async (userText: string) => {
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return

    historyRef.current.push({ role: 'user', content: userText })
    setMessages(prev => [...prev, { role: 'user', text: userText }])
    setIsThinking(true)

    try {
      const systemPrompt = `You are ${twin.name} on a live video call. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'warm, engaging and natural'}. Speak naturally like a real person in a video call — casual, friendly, brief (1-2 sentences). React to what the person just said. Be genuinely interested, ask a follow-up occasionally. Never say "As an AI" — you ARE ${twin.name}.`

      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            ...historyRef.current,
          ],
          max_tokens: 90,
          temperature: 0.85,
        })
      })
      const chatData = await chatRes.json() as { choices: { message: { content: string } }[] }
      const reply = chatData.choices[0]?.message?.content?.trim() ?? 'I heard you!'

      historyRef.current.push({ role: 'assistant', content: reply })
      setMessages(prev => [...prev, { role: 'assistant', text: reply }])
      setIsThinking(false)
      setIsSpeaking(true)

      await speakText(reply, apiKey)
      setIsSpeaking(false)
    } catch {
      setIsThinking(false)
      setIsSpeaking(false)
    }
  }, [twin, speakText])

  // Greet the user on call start
  useEffect(() => {
    if (greeted.current) return
    greeted.current = true
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return

    const greetings = [
      `Hey! So great to finally connect on video! How's your day going?`,
      `Oh hey! You picked up — awesome! How are you doing?`,
      `Hey there! Nice to see you! What's been going on with you?`,
    ]
    const greeting = greetings[Math.floor(Math.random() * greetings.length)]

    setTimeout(async () => {
      historyRef.current.push({ role: 'assistant', content: greeting })
      setMessages([{ role: 'assistant', text: greeting }])
      setIsSpeaking(true)
      await speakText(greeting, apiKey)
      setIsSpeaking(false)
    }, 1200)
  }, [speakText])

  // Speech recognition — only restart when not speaking
  useEffect(() => {
    if (isSpeaking || isThinking) {
      recognitionRef.current?.stop()
      return
    }
    type SRConstructor = new () => ISpeechRecognition
    const SR: SRConstructor | undefined =
      (window as typeof window & { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }).SpeechRecognition
      ?? (window as typeof window & { webkitSpeechRecognition?: SRConstructor }).webkitSpeechRecognition
    if (!SR) return

    const recognition = new SR()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-US'
    recognition.onstart = () => setIsListening(true)
    recognition.onend = () => { setIsListening(false) }
    recognition.onresult = (e: SpeechRecognitionEvent) => {
      const text = e.results[e.results.length - 1][0].transcript.trim()
      if (text) sendToAI(text)
    }
    recognitionRef.current = recognition
    try { recognition.start() } catch { /* already started */ }
    return () => { try { recognition.stop() } catch { /* already stopped */ } }
  }, [isSpeaking, isThinking, sendToAI])

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
    'radial-gradient(ellipse at 50% 65%, #0e0a2e 0%, #050510 60%)',
    'radial-gradient(ellipse at 20% 70%, #0a0e2e 0%, #050510 60%)',
  ]

  // Show only the last 4 messages
  const visibleMessages = messages.slice(-4)

  return (
    <Box style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: bgGradients[bgPhase],
      transition: 'background 4s ease',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Ambient glow */}
      <Box style={{
        position: 'absolute',
        top: '10%', left: '50%', transform: 'translateX(-50%)',
        width: 420, height: 420, borderRadius: '50%',
        background: isSpeaking
          ? 'radial-gradient(circle, rgba(34,197,94,0.13) 0%, transparent 70%)'
          : 'radial-gradient(circle, rgba(124,58,237,0.09) 0%, transparent 70%)',
        transition: 'background 0.6s ease',
        pointerEvents: 'none',
      }} />

      {/* Duration */}
      <Box style={{ position: 'absolute', top: 20, left: 24, zIndex: 10 }}>
        <Text size="sm" fw={600} style={{
          color: 'rgba(255,255,255,0.75)',
          background: 'rgba(0,0,0,0.35)',
          padding: '4px 12px', borderRadius: 20,
          backdropFilter: 'blur(10px)',
          fontVariantNumeric: 'tabular-nums',
        }}>
          {mins}:{secs}
        </Text>
      </Box>

      {/* Signal bars */}
      <Box style={{ position: 'absolute', top: 22, right: 24, display: 'flex', gap: 2, alignItems: 'flex-end', zIndex: 10 }}>
        {[4, 7, 10, 13].map((h, i) => (
          <Box key={i} style={{ width: 3, height: h, background: 'rgba(34,197,94,0.85)', borderRadius: 1 }} />
        ))}
      </Box>

      {/* Two-person layout */}
      <Box style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 56,
        paddingBottom: 150,
        gap: 0,
      }}>
        {/* AI video frame */}
        <Box style={{ position: 'relative', marginBottom: 16 }}>
          {isSpeaking && (
            <Box style={{
              position: 'absolute', inset: -14, borderRadius: 30,
              background: 'radial-gradient(circle, rgba(34,197,94,0.18) 0%, transparent 70%)',
              animation: 'ring-pulse 1s ease-in-out infinite',
              pointerEvents: 'none',
            }} />
          )}

          <Box style={{
            width: 240, height: 310, borderRadius: 22, overflow: 'hidden', position: 'relative',
            border: isSpeaking
              ? '3px solid rgba(34,197,94,0.9)'
              : '3px solid rgba(124,58,237,0.6)',
            boxShadow: isSpeaking
              ? '0 0 36px rgba(34,197,94,0.3), 0 8px 40px rgba(0,0,0,0.7)'
              : '0 0 28px rgba(124,58,237,0.2), 0 8px 40px rgba(0,0,0,0.7)',
            transition: 'border 0.3s ease, box-shadow 0.3s ease',
          }}>
            {twin.avatar_url ? (
              <img src={twin.avatar_url} alt={twin.name}
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top center' }} />
            ) : (
              <Box style={{
                width: '100%', height: '100%',
                background: 'linear-gradient(160deg, #1a0a2e 0%, #0d0d2e 50%, #050510 100%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <Box style={{
                  width: 80, height: 80, borderRadius: '50%',
                  background: 'rgba(124,58,237,0.2)', border: '3px solid rgba(124,58,237,0.4)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconRobot size={40} color="#7c3aed" />
                </Box>
              </Box>
            )}

            {/* Speaking wash */}
            <Box style={{
              position: 'absolute', inset: 0,
              background: isSpeaking ? 'rgba(34,197,94,0.05)' : 'transparent',
              transition: 'background 0.4s ease', pointerEvents: 'none',
            }} />

            {/* Name bar */}
            <Box style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, transparent 100%)',
              padding: '28px 12px 10px',
            }}>
              <Group gap={6} align="center">
                <Box style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: isSpeaking ? '#22c55e' : isListening ? '#7c3aed' : '#64748b',
                  boxShadow: isSpeaking ? '0 0 6px #22c55e' : 'none',
                  transition: 'all 0.3s ease', flexShrink: 0,
                }} />
                <Text fw={700} c="white" size="xs">{twin.name}</Text>
                <Text size="10px" style={{ color: isSpeaking ? '#22c55e' : '#a78bfa', marginLeft: 'auto' }}>
                  {isSpeaking ? 'Speaking' : isThinking ? 'Thinking...' : 'Connected'}
                </Text>
              </Group>
            </Box>
          </Box>
        </Box>

        {/* Waveform — AI speaking or user speaking */}
        <Box style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isThinking
            ? <ThinkingDots />
            : <Waveform active={isSpeaking} color={isSpeaking ? '#22c55e' : '#7c3aed'} />
          }
        </Box>

        {/* Conversation bubbles */}
        <Box style={{
          maxWidth: 480, width: '100%', padding: '0 20px',
          display: 'flex', flexDirection: 'column', gap: 6,
          marginTop: 12,
        }}>
          {visibleMessages.map((msg, i) => (
            <Box key={i} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <Box style={{
                maxWidth: '82%',
                background: msg.role === 'user'
                  ? 'rgba(124,58,237,0.22)'
                  : 'rgba(255,255,255,0.07)',
                backdropFilter: 'blur(10px)',
                borderRadius: msg.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                padding: '8px 13px',
                border: msg.role === 'user'
                  ? '1px solid rgba(124,58,237,0.25)'
                  : '1px solid rgba(255,255,255,0.09)',
                opacity: i < visibleMessages.length - 2 ? 0.55 : 1,
                transition: 'opacity 0.3s ease',
              }}>
                <Text size="sm" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.5 }}>
                  {msg.text}
                </Text>
              </Box>
            </Box>
          ))}
          {isThinking && (
            <Box style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Box style={{
                background: 'rgba(255,255,255,0.07)', backdropFilter: 'blur(10px)',
                borderRadius: '16px 16px 16px 4px', padding: '8px 16px',
                border: '1px solid rgba(255,255,255,0.09)',
              }}>
                <ThinkingDots />
              </Box>
            </Box>
          )}
          <div ref={messagesEndRef} />
        </Box>
      </Box>

      {/* User PiP — bottom left so it doesn't overlap controls */}
      <Box style={{
        position: 'absolute', bottom: 104, right: 16,
        width: 160, height: 116, borderRadius: 14,
        overflow: 'hidden',
        border: isListening ? '2px solid rgba(124,58,237,0.8)' : '2px solid rgba(255,255,255,0.12)',
        background: '#0d0d1a',
        boxShadow: isListening ? '0 0 16px rgba(124,58,237,0.3)' : '0 8px 28px rgba(0,0,0,0.5)',
        transition: 'border 0.3s ease, box-shadow 0.3s ease',
      }}>
        {isCameraOn
          ? <video ref={userVideoRef} autoPlay muted playsInline
              style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          : <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 4 }}>
              <IconVideoOff size={24} color="#4a4a6a" />
              <Text size="xs" c="dimmed">Camera off</Text>
            </Box>
        }
        <Box style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.7), transparent)',
          padding: '12px 8px 5px',
          display: 'flex', alignItems: 'center', gap: 5,
        }}>
          {isListening && (
            <Box style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#a78bfa', animation: 'listen-pulse 1s ease-in-out infinite',
            }} />
          )}
          <Text size="10px" c="white" fw={600}>{isListening ? 'Listening...' : 'You'}</Text>
        </Box>
      </Box>

      {/* Controls */}
      <Box style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '18px 24px 26px',
        background: 'linear-gradient(to top, rgba(5,5,16,0.97), transparent)',
        display: 'flex', justifyContent: 'center', alignItems: 'center',
      }}>
        <Group gap={14}>
          <Tooltip label={isMuted ? 'Unmute' : 'Mute'} withArrow>
            <ActionIcon size={52} radius="xl" onClick={toggleMute} style={{
              background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.13)',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.14)',
            }}>
              {isMuted ? <IconMicrophoneOff size={20} color="white" /> : <IconMicrophone size={20} color="white" />}
            </ActionIcon>
          </Tooltip>

          <Tooltip label={isCameraOn ? 'Turn off camera' : 'Turn on camera'} withArrow>
            <ActionIcon size={52} radius="xl" onClick={toggleCamera} style={{
              background: isCameraOn ? 'rgba(255,255,255,0.13)' : '#ef4444',
              backdropFilter: 'blur(10px)',
              border: '1px solid rgba(255,255,255,0.14)',
            }}>
              {isCameraOn ? <IconVideo size={20} color="white" /> : <IconVideoOff size={20} color="white" />}
            </ActionIcon>
          </Tooltip>

          <Tooltip label="End call" withArrow>
            <ActionIcon size={64} radius="xl" onClick={handleEnd} style={{
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              boxShadow: '0 4px 22px rgba(239,68,68,0.45)',
            }}>
              <IconPhone size={26} color="white" style={{ transform: 'rotate(135deg)' }} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Box>

      <style>{`
        @keyframes ring-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.07); opacity: 0.35; }
        }
        @keyframes listen-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.15); }
        }
        @keyframes wave-0 { from { height: 5px; } to { height: 22px; } }
        @keyframes wave-1 { from { height: 8px; } to { height: 28px; } }
        @keyframes wave-2 { from { height: 6px; } to { height: 18px; } }
        @keyframes wave-3 { from { height: 10px; } to { height: 26px; } }
        @keyframes dot-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1.1); opacity: 1; }
        }
      `}</style>
    </Box>
  )
}
