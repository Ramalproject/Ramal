import { Box, Text, ActionIcon, Group, Tooltip, Button } from '@mantine/core'
import { IconMicrophone, IconMicrophoneOff, IconVideo, IconVideoOff, IconPhone, IconCamera } from '@tabler/icons-react'
import { useState, useEffect, useRef, useCallback } from 'react'
import { notifications } from '@mantine/notifications'
import { supabase } from '../../lib/supabase'
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

// Real-time audio analyser bars — reacts to actual TTS audio frequencies
function AudioRing({ bars }: { bars: number[] }) {
  return (
    <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 48 }}>
      {bars.map((v, i) => (
        <Box key={i} style={{
          width: 3.5,
          height: Math.max(4, v * 44),
          borderRadius: 3,
          background: `rgba(167,139,250,${0.35 + v * 0.65})`,
          transition: 'height 0.06s ease',
          boxShadow: v > 0.5 ? `0 0 ${v * 8}px rgba(124,58,237,0.6)` : 'none',
        }} />
      ))}
    </Box>
  )
}

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
  const [isMuted, setIsMuted] = useState(false)
  const [isCameraOn, setIsCameraOn] = useState(true)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isListening, setIsListening] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [duration, setDuration] = useState(0)
  const [lastSubtitle, setLastSubtitle] = useState('')
  const [subtitleRole, setSubtitleRole] = useState<'user' | 'assistant'>('assistant')
  const [audioBars, setAudioBars] = useState<number[]>(new Array(28).fill(0))
  const [photoInputKey, setPhotoInputKey] = useState(0)
  // Track avatar URL in local state so upload reflects immediately without page reload
  const [avatarUrl, setAvatarUrl] = useState<string | null>(twin.avatar_url ?? null)

  const userVideoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognitionRef = useRef<ISpeechRecognition | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const historyRef = useRef<{ role: 'user' | 'assistant'; content: string }[]>([])
  const greeted = useRef(false)
  const subtitleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const photoInputRef = useRef<HTMLInputElement>(null)
  const cancelledRef = useRef(false)

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

  function startAnalyser(audio: HTMLAudioElement) {
    try {
      const ctx = new AudioContext()
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      const src = ctx.createMediaElementSource(audio)
      src.connect(analyser)
      analyser.connect(ctx.destination)
      audioCtxRef.current = ctx
      analyserRef.current = analyser
      const data = new Uint8Array(analyser.frequencyBinCount)
      function tick() {
        analyser.getByteFrequencyData(data)
        const bars = Array.from(data.slice(0, 28)).map(v => v / 255)
        setAudioBars(bars)
        rafRef.current = requestAnimationFrame(tick)
      }
      tick()
    } catch { /* AudioContext not available */ }
  }

  function stopAnalyser() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    setAudioBars(new Array(28).fill(0))
    audioCtxRef.current?.close().catch(() => {})
    audioCtxRef.current = null
    analyserRef.current = null
  }

  function showSubtitle(text: string, role: 'user' | 'assistant') {
    setLastSubtitle(text); setSubtitleRole(role)
    if (subtitleTimer.current) clearTimeout(subtitleTimer.current)
    subtitleTimer.current = setTimeout(() => setLastSubtitle(''), 7000)
  }

  const speakText = useCallback(async (text: string, apiKey: string) => {
    if (cancelledRef.current) return
    const ttsRes = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'tts-1', input: text, voice: 'nova' })
    })
    if (cancelledRef.current) return
    if (!ttsRes.ok) return
    const blob = await ttsRes.blob()
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
      const systemPrompt = `You are ${twin.name} on a live video call. ${twin.bio ?? ''} Personality: ${twin.personality ?? 'warm, natural, friendly'}. Talk like a real person — casual, warm, short (1-2 sentences). Never say "As an AI". React naturally. Be present.`
      const chatRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'system', content: systemPrompt }, ...historyRef.current],
          max_tokens: 80, temperature: 0.9,
        })
      })
      if (cancelledRef.current) { setIsThinking(false); return }
      const chatData = await chatRes.json() as { choices: { message: { content: string } }[] }
      if (cancelledRef.current) { setIsThinking(false); return }
      const reply = chatData.choices[0]?.message?.content?.trim() ?? 'I heard you!'
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
    if (greeted.current) return
    greeted.current = true
    const apiKey = localStorage.getItem(OPENAI_KEY_STORAGE)
    if (!apiKey) return
    const greets = [`Hey! So nice to see you — how are you doing?`, `Hey! You picked up! How's everything going?`, `Oh hey! Great to see you! What's up?`]
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

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const ext = file.name.split('.').pop()
      const path = `twin-${twin.id}.${ext}`
      await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      await supabase.from('ai_twins').update({ avatar_url: data.publicUrl }).eq('id', twin.id)
      // Update local state immediately — no page reload needed
      setAvatarUrl(data.publicUrl)
      notifications.show({ title: 'Photo uploaded!', message: 'Your photo is now showing in the call', color: 'green' })
    } catch {
      notifications.show({ title: 'Upload failed', message: 'Try again', color: 'red' })
    }
    setPhotoInputKey(k => k + 1)
  }

  function toggleMute() { setIsMuted(m => { streamRef.current?.getAudioTracks().forEach(t => { t.enabled = m }); return !m }) }
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

      {/* ── MAIN AI AREA ── */}
      <Box style={{ position: 'absolute', inset: 0 }}>
        {avatarUrl ? (
          /* Real photo — fills screen with visible motion */
          <>
            {/* Wrapper carries the animation so objectFit centre stays correct */}
            <Box style={{
              position: 'absolute', inset: 0,
              animation: isSpeaking
                ? 'photo-talk 0.85s ease-in-out infinite'
                : 'photo-idle 7s ease-in-out infinite',
              transformOrigin: 'center 30%',
              willChange: 'transform',
            }}>
              <img
                src={avatarUrl}
                alt={twin.name}
                style={{
                  width: '100%', height: '100%',
                  objectFit: 'cover',
                  objectPosition: 'center 25%',   /* show face, not just forehead */
                  filter: isSpeaking
                    ? 'brightness(1.08) contrast(1.04)'
                    : 'brightness(0.94)',
                  transition: 'filter 0.4s ease',
                  display: 'block',
                }}
              />
            </Box>

            {/* Green speaking border */}
            {isSpeaking && (
              <Box style={{
                position: 'absolute', inset: 0, pointerEvents: 'none',
                boxShadow: 'inset 0 0 0 5px rgba(34,197,94,0.75)',
                animation: 'border-pulse 0.7s ease-in-out infinite',
              }} />
            )}

            {/* Audio bars overlaid at bottom of photo when speaking */}
            {(isSpeaking || isThinking) && (
              <Box style={{
                position: 'absolute', bottom: 120, left: '50%', transform: 'translateX(-50%)',
                display: 'flex', alignItems: 'center', gap: 3, zIndex: 5,
                background: 'rgba(0,0,0,0.35)', borderRadius: 20, padding: '6px 14px',
                backdropFilter: 'blur(8px)',
              }}>
                {isThinking
                  ? <ThinkingDots />
                  : <AudioRing bars={audioBars} />
                }
              </Box>
            )}
          </>
        ) : (
          /* No photo — immersive audio-reactive presence */
          <Box style={{
            width: '100%', height: '100%',
            background: 'radial-gradient(ellipse at 50% 40%, #1a0838 0%, #0a041e 50%, #020108 100%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0,
          }}>
            {/* Outer glow ring */}
            <Box style={{
              position: 'absolute',
              width: isSpeaking ? 520 : 440, height: isSpeaking ? 520 : 440,
              borderRadius: '50%',
              background: isSpeaking
                ? 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 65%)'
                : 'radial-gradient(circle, rgba(124,58,237,0.08) 0%, transparent 65%)',
              transition: 'all 0.6s ease',
              pointerEvents: 'none',
            }} />

            {/* Avatar circle */}
            <Box style={{
              width: 200, height: 200, borderRadius: '50%', position: 'relative', marginBottom: 28,
              background: 'linear-gradient(135deg, #2a1050 0%, #1a0840 100%)',
              border: isSpeaking ? '3px solid rgba(34,197,94,0.7)' : '3px solid rgba(124,58,237,0.4)',
              boxShadow: isSpeaking
                ? '0 0 60px rgba(34,197,94,0.2), 0 0 120px rgba(34,197,94,0.08), inset 0 0 40px rgba(0,0,0,0.4)'
                : '0 0 40px rgba(124,58,237,0.15), inset 0 0 40px rgba(0,0,0,0.4)',
              transition: 'border 0.3s, box-shadow 0.4s',
              animation: isSpeaking ? 'avatar-talk 0.8s ease-in-out infinite alternate' : 'avatar-idle 4s ease-in-out infinite',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              overflow: 'hidden',
            }}>
              {/* Gradient face silhouette */}
              <Box style={{
                position: 'absolute', bottom: 0, left: '50%', transform: 'translateX(-50%)',
                width: 120, height: 160,
                background: 'linear-gradient(to top, rgba(80,40,160,0.6) 0%, rgba(40,20,80,0.3) 60%, transparent 100%)',
                borderRadius: '60px 60px 0 0',
              }} />
              {/* Initials */}
              <Text fw={900} size="xl" style={{
                color: 'rgba(167,139,250,0.9)',
                fontSize: 52,
                textShadow: '0 0 20px rgba(124,58,237,0.6)',
                zIndex: 1,
                letterSpacing: -1,
              }}>
                {twin.name.slice(0, 2).toUpperCase()}
              </Text>
            </Box>

            {/* Real-time audio visualiser */}
            <Box style={{ marginBottom: 20 }}>
              {isThinking ? <ThinkingDots /> : <AudioRing bars={audioBars} />}
            </Box>

            {/* Name */}
            <Text fw={700} c="white" size="lg" style={{ letterSpacing: 0.5, textShadow: '0 0 16px rgba(167,139,250,0.5)', marginBottom: 24 }}>
              {twin.name}
            </Text>

            {/* Upload photo CTA — prominent, right on the call */}
            <Button
              size="sm"
              leftSection={<IconCamera size={14} />}
              onClick={() => photoInputRef.current?.click()}
              style={{
                background: 'rgba(124,58,237,0.25)',
                border: '1px solid rgba(124,58,237,0.5)',
                backdropFilter: 'blur(8px)',
                color: '#c4b5fd',
              }}
            >
              Upload photo to show real face
            </Button>
            <Text size="xs" c="dimmed" mt={6}>Your photo fills the screen like a real video call</Text>
            <input key={photoInputKey} ref={photoInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhotoUpload} />
          </Box>
        )}

        {/* Vignette */}
        <Box style={{ position: 'absolute', inset: 0, pointerEvents: 'none', background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, transparent 16%, transparent 60%, rgba(0,0,0,0.6) 100%)' }} />
      </Box>

      {/* ── TOP BAR ── */}
      <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '18px 22px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 10 }}>
        <Group gap={8} align="center">
          <Box style={{
            width: 10, height: 10, borderRadius: '50%',
            background: isSpeaking ? '#22c55e' : isListening ? '#a78bfa' : '#64748b',
            boxShadow: isSpeaking ? '0 0 8px #22c55e' : isListening ? '0 0 8px #a78bfa' : 'none',
            transition: 'all 0.3s ease',
          }} />
          <Text fw={700} c="white" size="lg" style={{ textShadow: '0 1px 6px rgba(0,0,0,0.7)' }}>{twin.name}</Text>
          <Text size="sm" style={{ color: isSpeaking ? '#22c55e' : isThinking ? '#c4b5fd' : isListening ? '#c4b5fd' : 'rgba(255,255,255,0.55)' }}>
            {isSpeaking ? 'Speaking' : isThinking ? 'Thinking...' : isListening ? 'Listening to you' : 'Connected'}
          </Text>
        </Group>
        <Text size="sm" fw={600} style={{ color: 'rgba(255,255,255,0.8)', background: 'rgba(0,0,0,0.4)', padding: '4px 12px', borderRadius: 20, backdropFilter: 'blur(8px)', fontVariantNumeric: 'tabular-nums' }}>
          {mins}:{secs}
        </Text>
      </Box>

      {/* ── SUBTITLE ── */}
      <Box style={{ position: 'absolute', bottom: 116, left: 0, right: 0, display: 'flex', justifyContent: 'center', padding: '0 76px 0 20px', zIndex: 10, opacity: lastSubtitle ? 1 : 0, transition: 'opacity 0.4s ease' }}>
        <Box style={{
          maxWidth: 560,
          background: subtitleRole === 'user' ? 'rgba(124,58,237,0.78)' : 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(14px)', borderRadius: 14, padding: '10px 18px',
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
        border: isListening ? '2px solid rgba(167,139,250,0.9)' : '2px solid rgba(255,255,255,0.18)',
        background: '#0d0d1a',
        boxShadow: isListening ? '0 0 20px rgba(167,139,250,0.4), 0 8px 28px rgba(0,0,0,0.7)' : '0 8px 28px rgba(0,0,0,0.7)',
        transition: 'border 0.3s, box-shadow 0.3s', zIndex: 20,
      }}>
        {isCameraOn
          ? <video ref={userVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          : <Box style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 6 }}>
              <IconVideoOff size={24} color="#4a4a6a" />
              <Text size="xs" c="dimmed">Camera off</Text>
            </Box>
        }
        <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.72), transparent)', padding: '12px 8px 5px', display: 'flex', alignItems: 'center', gap: 5 }}>
          {isListening && <Box style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', animation: 'listen-pulse 0.9s ease-in-out infinite', flexShrink: 0 }} />}
          <Text size="11px" c="white" fw={600}>{isListening ? 'Listening...' : 'You'}</Text>
        </Box>
      </Box>

      {/* ── CONTROLS ── */}
      <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '12px 24px 26px', background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)', display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <Group gap={16}>
          <Tooltip label={isMuted ? 'Unmute' : 'Mute'} withArrow>
            <ActionIcon size={56} radius="xl" onClick={toggleMute} style={{ background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.14)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.16)' }}>
              {isMuted ? <IconMicrophoneOff size={22} color="white" /> : <IconMicrophone size={22} color="white" />}
            </ActionIcon>
          </Tooltip>
          <Tooltip label={isCameraOn ? 'Camera off' : 'Camera on'} withArrow>
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
        @keyframes avatar-idle { 0%,100% { transform: scale(1) translateY(0); } 50% { transform: scale(1.015) translateY(-6px); } }
        @keyframes avatar-talk { from { transform: scale(1) translateY(0) rotate(-0.4deg); } to { transform: scale(1.02) translateY(-5px) rotate(0.4deg); } }
        @keyframes photo-idle {
          0%   { transform: scale(1.000) translate( 0px,  0px) rotate( 0.00deg); }
          14%  { transform: scale(1.003) translate( 4px, -5px) rotate( 0.18deg); }
          28%  { transform: scale(1.005) translate(-3px, -9px) rotate(-0.22deg); }
          42%  { transform: scale(1.004) translate(-6px, -6px) rotate(-0.15deg); }
          57%  { transform: scale(1.003) translate( 1px, -8px) rotate( 0.10deg); }
          71%  { transform: scale(1.005) translate( 5px, -4px) rotate( 0.20deg); }
          85%  { transform: scale(1.002) translate( 2px, -2px) rotate( 0.08deg); }
          100% { transform: scale(1.000) translate( 0px,  0px) rotate( 0.00deg); }
        }
        @keyframes photo-talk {
          0%   { transform: scale(1.000) translate( 0px,  0px) rotate( 0.00deg); }
          11%  { transform: scale(1.012) translate( 3px,-10px) rotate( 0.35deg); }
          22%  { transform: scale(1.006) translate(-3px, -7px) rotate(-0.25deg); }
          33%  { transform: scale(1.016) translate( 5px,-13px) rotate( 0.48deg); }
          44%  { transform: scale(1.008) translate(-2px, -9px) rotate(-0.20deg); }
          55%  { transform: scale(1.014) translate( 4px,-12px) rotate( 0.38deg); }
          66%  { transform: scale(1.007) translate(-4px, -8px) rotate(-0.30deg); }
          77%  { transform: scale(1.013) translate( 6px,-11px) rotate( 0.42deg); }
          88%  { transform: scale(1.005) translate(-1px, -5px) rotate(-0.12deg); }
          100% { transform: scale(1.000) translate( 0px,  0px) rotate( 0.00deg); }
        }
        @keyframes border-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
        @keyframes listen-pulse { 0%,100% { opacity: 0.5; transform: scale(1); } 50% { opacity: 1; transform: scale(1.3); } }
        @keyframes dot-bounce { 0%,80%,100% { transform: scale(0.65); opacity: 0.35; } 40% { transform: scale(1.1); opacity: 1; } }
      `}</style>
    </Box>
  )
}
