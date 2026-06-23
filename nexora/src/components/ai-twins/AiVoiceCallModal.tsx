import { useEffect, useRef, useState } from 'react'
import { Box, Text, Avatar, ActionIcon, Group } from '@mantine/core'
import { IconMicrophone, IconMicrophoneOff, IconPhone, IconRobot, IconSend } from '@tabler/icons-react'
import type { AiTwin } from '../../types'

const OPENAI_KEY = 'nexora_openai_api_key'

type Phase = 'connecting' | 'listening' | 'processing' | 'speaking' | 'muted'

function fmt(s: number) {
  return `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`
}

function buildSystem(twin: AiTwin) {
  return `You are ${twin.name}, an AI Twin on Nexora. ${twin.bio ?? ''}
Personality: ${twin.personality ?? 'warm, friendly, engaging'}.
Expertise: ${twin.expertise?.join(', ') ?? 'general conversation'}.
CRITICAL: This is a LIVE VOICE CALL. Keep every reply under 2 sentences. Be natural and conversational — no bullet points, no markdown, no lists. Sound like a real person talking on the phone.`
}

const STATUS: Record<Phase, string> = {
  connecting: 'Connecting...',
  listening: 'Listening...',
  processing: 'Thinking...',
  speaking: 'Speaking...',
  muted: 'Muted',
}

const RING_COLOR: Record<Phase, string> = {
  connecting: 'rgba(124,58,237,0.25)',
  listening: 'rgba(6,182,212,0.35)',
  processing: 'rgba(124,58,237,0.15)',
  speaking: 'rgba(124,58,237,0.5)',
  muted: 'rgba(100,100,100,0.2)',
}

export default function AiVoiceCallModal({ twin, onEnd }: { twin: AiTwin; onEnd: () => void }) {
  const [phase, setPhase] = useState<Phase>('connecting')
  const [duration, setDuration] = useState(0)
  const [liveText, setLiveText] = useState('')
  const [log, setLog] = useState<{ who: 'you' | 'ai'; text: string }[]>([])
  const [typedInput, setTypedInput] = useState('')
  const [voiceAvailable, setVoiceAvailable] = useState(false)
  const [isMuted, setIsMuted] = useState(false)

  // Refs — avoid stale closures in callbacks
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const transcriptRef = useRef('')
  const processingRef = useRef(false)
  const mutedRef = useRef(false)
  const recRef = useRef<any>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const greeted = useRef(false)
  const sendRef = useRef<(text: string) => void>(() => {})
  const startRecRef = useRef<() => void>(() => {})

  // Detect voice support
  useEffect(() => {
    const VA = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    setVoiceAvailable(!!VA)
  }, [])

  // Timer
  useEffect(() => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Speak text via browser TTS, then call onDone
  function speakAI(text: string, onDone: () => void) {
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
    const voices = window.speechSynthesis.getVoices()
    const pick = voices.find(v => /Samantha|Google US English|Karen|Moira|Victoria/i.test(v.name))
    if (pick) utt.voice = pick
    utt.rate = 0.95
    utt.pitch = 1.05
    utt.onend = onDone
    utt.onerror = onDone
    window.speechSynthesis.speak(utt)
  }

  // Send user message → OpenAI → speak → listen again
  async function sendMessage(userText: string) {
    if (!userText.trim() || processingRef.current) return
    processingRef.current = true
    transcriptRef.current = ''
    setLiveText('')
    setPhase('processing')

    setLog(prev => [...prev, { who: 'you', text: userText }])
    historyRef.current = [...historyRef.current, { role: 'user', content: userText }]

    const apiKey = localStorage.getItem(OPENAI_KEY)
    let reply = `I need an OpenAI API key to respond. Please add it in Settings → API Keys.`

    if (apiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            messages: [{ role: 'system', content: buildSystem(twin) }, ...historyRef.current],
            max_tokens: 120,
            temperature: 0.85,
          }),
        })
        const data = await res.json()
        reply = data.choices?.[0]?.message?.content?.trim() ?? "I didn't quite catch that, can you say it again?"
      } catch {
        reply = "I'm having a little trouble right now, give me a second."
      }
    }

    historyRef.current = [...historyRef.current, { role: 'assistant', content: reply }]
    setLog(prev => [...prev, { who: 'ai', text: reply }])
    setPhase('speaking')

    speakAI(reply, () => {
      processingRef.current = false
      if (!mutedRef.current) {
        setPhase('listening')
        startRecRef.current()
      }
    })
  }

  // Always point to latest sendMessage
  sendRef.current = sendMessage

  // Start speech recognition (no-op if unavailable or muted)
  function startRecognition() {
    const VA = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!VA || mutedRef.current) return
    recRef.current?.abort()
    const rec = new VA()
    recRef.current = rec
    rec.continuous = false
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join('')
      transcriptRef.current = text
      setLiveText(text)
    }

    rec.onend = () => {
      const captured = transcriptRef.current.trim()
      if (captured && !processingRef.current) {
        sendRef.current(captured)
      } else if (!processingRef.current && !mutedRef.current) {
        setTimeout(() => startRecRef.current(), 400)
      }
    }

    rec.onerror = () => {
      if (!processingRef.current && !mutedRef.current) {
        setTimeout(() => startRecRef.current(), 1000)
      }
    }

    try { rec.start() } catch { /* already running */ }
  }

  startRecRef.current = startRecognition

  // Initial greeting
  useEffect(() => {
    if (greeted.current) return
    greeted.current = true
    const t = setTimeout(() => {
      const greeting = `Hey! It's ${twin.name}. So great to connect with you! How are you doing today?`
      historyRef.current = [{ role: 'assistant', content: greeting }]
      setLog([{ who: 'ai', text: greeting }])
      setPhase('speaking')
      speakAI(greeting, () => {
        processingRef.current = false
        setPhase('listening')
        startRecRef.current()
      })
    }, 1400)
    return () => clearTimeout(t)
  }, [twin.name]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      window.speechSynthesis.cancel()
      recRef.current?.abort()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function handleEnd() {
    window.speechSynthesis.cancel()
    recRef.current?.abort()
    if (timerRef.current) clearInterval(timerRef.current)
    onEnd()
  }

  function toggleMute() {
    const nowMuted = !mutedRef.current
    mutedRef.current = nowMuted
    setIsMuted(nowMuted)
    if (nowMuted) {
      recRef.current?.abort()
      window.speechSynthesis.cancel()
      setPhase('muted')
    } else {
      setPhase('listening')
      startRecRef.current()
    }
  }

  const recentLog = log.slice(-4)

  return (
    <Box
      className="nex-dark-surface"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'linear-gradient(160deg, #080014 0%, #0c0020 45%, #001018 100%)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'space-between',
        padding: '52px 24px 44px',
        userSelect: 'none',
      }}
    >
      <style>{`
        @keyframes nex-call-ring {
          0%   { transform: scale(1); opacity: 0.7; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes nex-call-spin {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes nex-call-bounce {
          0%,100% { opacity: 0.4; transform: scaleY(0.6); }
          50%      { opacity: 1;   transform: scaleY(1.4); }
        }
        @keyframes nex-scan {
          0%   { top: -4px; opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { top: 116px; opacity: 0; }
        }
      `}</style>

      {/* Top — label + timer */}
      <Box ta="center">
        <Text size="xs" c="violet.4" fw={700} style={{ letterSpacing: 4, textTransform: 'uppercase', opacity: 0.7 }}>
          AI Twin Call
        </Text>
        <Text size="md" c="gray.4" mt={6} fw={500}>{fmt(duration)}</Text>
      </Box>

      {/* Avatar + animated rings */}
      <Box style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '8px 0' }}>
        {/* Outer rings */}
        {[1, 2, 3].map(i => (
          <Box key={i} style={{
            position: 'absolute',
            width: 120 + i * 60,
            height: 120 + i * 60,
            borderRadius: '50%',
            border: `1.5px solid ${RING_COLOR[phase]}`,
            animation: phase === 'processing' ? 'none'
              : `nex-call-ring ${(phase === 'speaking' ? 0.85 : 1.3) + i * 0.32}s ease-out infinite`,
            animationDelay: `${i * 0.18}s`,
          }} />
        ))}

        {/* Rotating circuit ring */}
        <Box style={{
          position: 'absolute', width: 148, height: 148, borderRadius: '50%',
          border: '2px solid transparent',
          borderTopColor: phase === 'speaking' ? '#7c3aed' : phase === 'listening' ? '#06b6d4' : 'rgba(124,58,237,0.4)',
          borderRightColor: 'rgba(124,58,237,0.15)',
          animation: 'nex-call-spin 2.5s linear infinite',
        }} />
        <Box style={{
          position: 'absolute', width: 136, height: 136, borderRadius: '50%',
          border: '1px dashed rgba(6,182,212,0.25)',
          animation: 'nex-call-spin 6s linear infinite reverse',
        }} />

        {/* Processing spinner */}
        {phase === 'processing' && (
          <Box style={{
            position: 'absolute', width: 148, height: 148, borderRadius: '50%',
            border: '3px solid transparent',
            borderTopColor: '#7c3aed', borderRightColor: 'rgba(124,58,237,0.4)',
            animation: 'nex-call-spin 0.8s linear infinite',
          }} />
        )}

        {/* Avatar with holographic overlay */}
        <Box style={{ position: 'relative', zIndex: 1 }}>
          {twin.avatar_url ? (
            <Box style={{ position: 'relative', width: 112, height: 112 }}>
              <Avatar
                src={twin.avatar_url}
                size={112}
                radius="xl"
                style={{
                  border: `3px solid ${phase === 'speaking' ? '#7c3aed' : phase === 'listening' ? '#06b6d4' : '#3d1260'}`,
                  boxShadow: phase === 'speaking'
                    ? '0 0 40px rgba(124,58,237,0.8), 0 0 80px rgba(124,58,237,0.35)'
                    : phase === 'listening'
                      ? '0 0 30px rgba(6,182,212,0.5)'
                      : '0 0 20px rgba(0,0,0,0.6)',
                  transition: 'all 0.4s ease',
                  filter: 'saturate(0.8) contrast(1.1)',
                }}
              />
              {/* Holographic scan line */}
              <Box style={{
                position: 'absolute', inset: 0, borderRadius: 16, overflow: 'hidden',
                pointerEvents: 'none',
              }}>
                <Box style={{
                  position: 'absolute', left: 0, right: 0, height: 2,
                  background: 'linear-gradient(90deg, transparent, rgba(6,182,212,0.6), transparent)',
                  animation: 'nex-scan 2.4s ease-in-out infinite',
                }} />
                <Box style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(180deg, rgba(124,58,237,0.08) 0%, transparent 50%, rgba(6,182,212,0.08) 100%)',
                }} />
              </Box>
              {/* AI badge */}
              <Box style={{
                position: 'absolute', bottom: -4, right: -4,
                background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                borderRadius: '50%', width: 28, height: 28,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #080014',
                boxShadow: '0 0 12px rgba(124,58,237,0.8)',
              }}>
                <IconRobot size={14} color="white" />
              </Box>
            </Box>
          ) : (
            /* No photo — show animated robot character */
            <Box style={{
              width: 112, height: 112, borderRadius: 20,
              background: 'linear-gradient(135deg, #1a0040, #001a40)',
              border: `3px solid ${phase === 'speaking' ? '#7c3aed' : phase === 'listening' ? '#06b6d4' : '#3d1260'}`,
              boxShadow: phase === 'speaking'
                ? '0 0 40px rgba(124,58,237,0.8)'
                : '0 0 20px rgba(124,58,237,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexDirection: 'column', gap: 4,
              transition: 'all 0.4s ease',
            }}>
              <IconRobot size={52} color={phase === 'speaking' ? '#a78bfa' : '#7c3aed'}
                style={{ filter: phase === 'speaking' ? 'drop-shadow(0 0 8px #7c3aed)' : 'none', transition: 'all 0.3s' }} />
              <Text size="8px" c="violet.4" fw={700} style={{ letterSpacing: 2, textTransform: 'uppercase' }}>AI TWIN</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Name + status */}
      <Box ta="center" mb={4}>
        <Text size="xl" fw={800} c="white">{twin.name}</Text>
        <Group gap={6} justify="center" mt={6}>
          {/* Waveform bars (listening/speaking indicator) */}
          {(phase === 'listening' || phase === 'speaking') && [1, 2, 3, 4, 5].map(i => (
            <Box key={i} style={{
              width: 3, height: phase === 'speaking' ? 18 : 12,
              background: phase === 'speaking' ? '#7c3aed' : '#06b6d4',
              borderRadius: 2,
              animation: `nex-call-bounce ${0.5 + i * 0.12}s ease-in-out infinite`,
              animationDelay: `${i * 0.08}s`,
            }} />
          ))}
          <Text size="sm" c={phase === 'listening' ? 'cyan.4' : phase === 'speaking' ? 'violet.4' : 'gray.5'} fw={500}>
            {STATUS[phase]}
          </Text>
        </Group>
      </Box>

      {/* Conversation log (last 4 lines, subtitle-style) */}
      <Box style={{ width: '100%', maxWidth: 440, minHeight: 140, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', gap: 8 }}>
        {recentLog.map((item, i) => (
          <Box key={i} style={{ display: 'flex', justifyContent: item.who === 'you' ? 'flex-end' : 'flex-start' }}>
            <Box style={{
              maxWidth: '82%',
              background: item.who === 'you'
                ? 'rgba(124,58,237,0.25)'
                : 'rgba(255,255,255,0.07)',
              border: `1px solid ${item.who === 'you' ? 'rgba(124,58,237,0.4)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: item.who === 'you' ? '18px 18px 4px 18px' : '18px 18px 18px 4px',
              padding: '7px 12px',
            }}>
              <Text size="xs" c={item.who === 'you' ? 'violet.2' : 'gray.3'} style={{ lineHeight: 1.5 }}>
                {item.text}
              </Text>
            </Box>
          </Box>
        ))}

        {/* Live transcript (interim) */}
        {liveText && (
          <Box style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Box style={{
              maxWidth: '82%',
              background: 'rgba(6,182,212,0.12)',
              border: '1px dashed rgba(6,182,212,0.35)',
              borderRadius: '18px 18px 4px 18px',
              padding: '6px 12px',
            }}>
              <Text size="xs" c="cyan.4" style={{ fontStyle: 'italic', lineHeight: 1.5 }}>{liveText}</Text>
            </Box>
          </Box>
        )}
      </Box>

      {/* Text input — shown when voice not available or muted */}
      {(!voiceAvailable || isMuted) && phase !== 'speaking' && phase !== 'processing' && (
        <Box style={{ width: '100%', maxWidth: 440, display: 'flex', gap: 8 }}>
          <input
            value={typedInput}
            onChange={e => setTypedInput(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && typedInput.trim()) {
                sendRef.current(typedInput.trim())
                setTypedInput('')
              }
            }}
            placeholder={`Say something to ${twin.name}...`}
            style={{
              flex: 1, background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 14, padding: '11px 16px',
              color: 'white', fontSize: 14, outline: 'none',
            }}
          />
          <ActionIcon
            size={46} radius="xl"
            onClick={() => { if (typedInput.trim()) { sendRef.current(typedInput.trim()); setTypedInput('') } }}
            disabled={!typedInput.trim()}
            style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)', flexShrink: 0 }}
          >
            <IconSend size={18} color="white" />
          </ActionIcon>
        </Box>
      )}

      {/* Voice not available notice */}
      {!voiceAvailable && (
        <Text size="xs" c="gray.6" ta="center" style={{ maxWidth: 300 }}>
          Voice input requires HTTPS. Type your messages above — AI will still speak back to you.
        </Text>
      )}

      {/* Call controls */}
      <Group gap={40} mt={4}>
        <Box ta="center">
          <ActionIcon
            size={58} radius="xl"
            onClick={toggleMute}
            style={{
              background: isMuted ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)',
              border: `1.5px solid ${isMuted ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}`,
              backdropFilter: 'blur(12px)',
            }}
          >
            {isMuted
              ? <IconMicrophoneOff size={22} color="#ef4444" />
              : <IconMicrophone size={22} color="white" />
            }
          </ActionIcon>
          <Text size="xs" c="gray.6" mt={7}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </Box>

        <Box ta="center">
          <ActionIcon
            size={76} radius="xl"
            onClick={handleEnd}
            style={{
              background: 'linear-gradient(135deg, #dc2626, #b91c1c)',
              boxShadow: '0 6px 24px rgba(220,38,38,0.55)',
            }}
          >
            <IconPhone size={30} color="white" style={{ transform: 'rotate(135deg)' }} />
          </ActionIcon>
          <Text size="xs" c="gray.6" mt={7}>End Call</Text>
        </Box>

        {/* Spacer to balance layout */}
        <Box style={{ width: 58 }} />
      </Group>
    </Box>
  )
}
