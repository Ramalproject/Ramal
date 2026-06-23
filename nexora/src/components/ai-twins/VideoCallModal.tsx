import { Box, Text, Avatar, ActionIcon, Group, Stack, Tooltip } from '@mantine/core'
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

export default function VideoCallModal({ twin, onEnd }: Props) {
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [duration, setDuration] = useState(0)
  const [transcript, setTranscript] = useState<{ role: 'user' | 'ai'; text: string }[]>([])

  const userVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Start call timer
  useEffect(() => {
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  // Start camera
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
        notifications.show({ title: 'Camera unavailable', message: 'Camera/mic requires HTTPS. Voice chat still works via text.', color: 'orange' })
      })
    return () => {
      streamRef.current?.getTracks().forEach(t => t.stop())
    }
  }, [])

  const sendToAI = useCallback(async (text: string) => {
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return

    setTranscript(prev => [...prev, { role: 'user', text }])
    setIsSpeaking(true)

    try {
      const systemPrompt = `You are ${twin.name}, an AI Twin. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'helpful and friendly'}. Keep responses SHORT — 1-2 sentences max since this is a voice call.`

      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text }
          ],
          max_tokens: 100,
        })
      })
      const chatData = await chatRes.json() as { choices: { message: { content: string } }[] }
      const reply = chatData.choices[0]?.message?.content ?? 'I heard you!'

      setTranscript(prev => [...prev, { role: 'ai', text: reply }])

      // TTS
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

  // Speech recognition
  useEffect(() => {
    type SRConstructor = new () => ISpeechRecognition
    const SR: SRConstructor | undefined = (window as typeof window & { SpeechRecognition?: SRConstructor; webkitSpeechRecognition?: SRConstructor }).SpeechRecognition
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
    onEnd()
  }

  const mins = Math.floor(duration / 60).toString().padStart(2, '0')
  const secs = (duration % 60).toString().padStart(2, '0')

  return (
    <Box style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: '#050510',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Duration */}
      <Text c="dimmed" size="sm" style={{ position: 'absolute', top: 24 }}>
        {mins}:{secs}
      </Text>

      {/* AI Avatar */}
      <Box style={{ position: 'relative', marginBottom: 32 }}>
        {/* Pulsing rings when speaking */}
        {isSpeaking && [1, 2, 3].map(i => (
          <Box key={i} style={{
            position: 'absolute', inset: -(i * 20),
            borderRadius: '50%',
            border: `2px solid rgba(124,58,237,${0.4 / i})`,
            animation: `pulse ${0.8 + i * 0.3}s ease-in-out infinite`,
          }} />
        ))}
        <Avatar src={twin.avatar_url} radius="xl" size={140} style={{ border: '4px solid #7c3aed' }}>
          <IconRobot size={64} color="#7c3aed" />
        </Avatar>
        {/* Speaking indicator */}
        <Box style={{
          position: 'absolute', bottom: 4, right: 4,
          width: 20, height: 20, borderRadius: '50%',
          background: isSpeaking ? '#22c55e' : '#2d2d4e',
          border: '2px solid #050510',
          transition: 'background 0.3s',
        }} />
      </Box>

      <Text fw={700} c="white" size="xl" mb={4}>{twin.name}</Text>
      <Text c="dimmed" size="sm" mb={8}>
        {isSpeaking ? '🔊 Speaking...' : isListening ? '🎤 Listening...' : 'AI Twin'}
      </Text>

      {/* Last transcript lines */}
      <Stack gap={4} mb={32} style={{ maxWidth: 480, width: '100%', padding: '0 24px' }}>
        {transcript.slice(-3).map((t, i) => (
          <Box key={i} style={{
            background: t.role === 'user' ? 'rgba(124,58,237,0.2)' : 'rgba(255,255,255,0.06)',
            borderRadius: 8, padding: '6px 12px',
            textAlign: t.role === 'user' ? 'right' : 'left',
          }}>
            <Text size="xs" c={t.role === 'user' ? 'violet' : 'gray.4'}>{t.text}</Text>
          </Box>
        ))}
      </Stack>

      {/* User camera PiP */}
      <Box style={{
        position: 'absolute', bottom: 100, right: 24,
        width: 160, height: 120, borderRadius: 12,
        overflow: 'hidden', border: '2px solid #2d2d4e',
        background: '#0d0d1a',
      }}>
        {isCameraOn
          ? <video ref={userVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          : <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <IconVideoOff size={32} color="#2d2d4e" />
            </Box>
        }
      </Box>

      {/* Controls */}
      <Group gap={16} style={{ position: 'absolute', bottom: 32 }}>
        <Tooltip label={isMuted ? 'Unmute' : 'Mute'}>
          <ActionIcon
            size={56} radius="xl"
            style={{ background: isMuted ? '#ef4444' : '#1e1e3a' }}
            onClick={toggleMute}
          >
            {isMuted ? <IconMicrophoneOff size={22} /> : <IconMicrophone size={22} />}
          </ActionIcon>
        </Tooltip>

        <Tooltip label={isCameraOn ? 'Turn off camera' : 'Turn on camera'}>
          <ActionIcon
            size={56} radius="xl"
            style={{ background: isCameraOn ? '#1e1e3a' : '#ef4444' }}
            onClick={toggleCamera}
          >
            {isCameraOn ? <IconVideo size={22} /> : <IconVideoOff size={22} />}
          </ActionIcon>
        </Tooltip>

        <Tooltip label="End call">
          <ActionIcon
            size={64} radius="xl"
            style={{ background: '#ef4444' }}
            onClick={handleEnd}
          >
            <IconPhone size={26} style={{ transform: 'rotate(135deg)' }} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.5; }
        }
      `}</style>
    </Box>
  )
}
