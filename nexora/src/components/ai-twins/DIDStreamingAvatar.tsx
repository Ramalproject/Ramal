import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react'
import TalkingFaceCanvas from './TalkingFaceCanvas'

const DID_API = 'https://api.d-id.com'

interface Props {
  apiKey: string
  photoUrl: string
  speaking: boolean
  audioLevel: number
  onSpeakEnd: () => void
  onReady?: () => void
  style?: React.CSSProperties
}

export interface DIDHandle {
  speak: (text: string) => void
  isReady: () => boolean
}

const DIDStreamingAvatar = forwardRef<DIDHandle, Props>(function DIDStreamingAvatar(
  { apiKey, photoUrl, speaking, audioLevel, onSpeakEnd, onReady, style },
  ref
) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const pcRef = useRef<RTCPeerConnection | null>(null)
  const streamIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  const readyRef = useRef(false)
  const [streamReady, setStreamReady] = useState(false)
  const onSpeakEndRef = useRef(onSpeakEnd)
  onSpeakEndRef.current = onSpeakEnd
  const onReadyRef = useRef(onReady)
  onReadyRef.current = onReady

  const makeHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Basic ${apiKey}`,
  })

  useImperativeHandle(ref, () => ({
    speak(text: string) {
      const streamId = streamIdRef.current
      const sessionId = sessionIdRef.current
      if (!streamId || !sessionId || !readyRef.current) {
        onSpeakEndRef.current()
        return
      }
      fetch(`${DID_API}/talks/streams/${streamId}`, {
        method: 'POST',
        headers: makeHeaders(),
        body: JSON.stringify({
          script: {
            type: 'text',
            input: text,
            provider: { type: 'microsoft', voice_id: 'en-US-JennyNeural' },
            ssml: false,
            subtitles: false,
          },
          config: { fluent: true, pad_audio: 0.5, align_driver: true },
          session_id: sessionId,
        })
      }).catch(() => onSpeakEndRef.current())
    },
    isReady() {
      return readyRef.current
    }
  }))

  useEffect(() => {
    let destroyed = false
    const headers = makeHeaders()

    async function init() {
      try {
        const res = await fetch(`${DID_API}/talks/streams`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ source_url: photoUrl })
        })
        if (destroyed || !res.ok) return

        const body = await res.json()
        const { id: streamId, offer, ice_servers: iceServers, session_id: sessionId } = body
        if (!streamId || !offer) return

        streamIdRef.current = streamId
        sessionIdRef.current = sessionId

        const pc = new RTCPeerConnection({ iceServers })
        pcRef.current = pc

        pc.addEventListener('track', (e) => {
          if (videoRef.current && e.track.kind === 'video') {
            videoRef.current.srcObject = e.streams[0]
            videoRef.current.play().catch(() => {})
          }
        })

        pc.addEventListener('icecandidate', ({ candidate }) => {
          if (!candidate || !streamId) return
          fetch(`${DID_API}/talks/streams/${streamId}/ice`, {
            method: 'POST',
            headers: makeHeaders(),
            body: JSON.stringify({
              candidate: candidate.candidate,
              sdpMid: candidate.sdpMid,
              sdpMLineIndex: candidate.sdpMLineIndex,
              session_id: sessionId,
            })
          }).catch(() => {})
        })

        pc.addEventListener('datachannel', ({ channel }) => {
          channel.addEventListener('message', ({ data }) => {
            try {
              const msg = JSON.parse(data as string)
              if (msg.event === 'stream/ready') {
                if (!destroyed) {
                  readyRef.current = true
                  setStreamReady(true)
                  onReadyRef.current?.()
                }
              } else if (msg.event === 'stream/done' || msg.event === 'stream/error') {
                onSpeakEndRef.current()
              }
            } catch {}
          })
        })

        await pc.setRemoteDescription(new RTCSessionDescription(offer))
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)

        if (destroyed) return

        await fetch(`${DID_API}/talks/streams/${streamId}/sdp`, {
          method: 'POST',
          headers: makeHeaders(),
          body: JSON.stringify({ answer, session_id: sessionId })
        })
      } catch (err) {
        console.warn('[D-ID] init failed:', err)
      }
    }

    init()

    return () => {
      destroyed = true
      readyRef.current = false
      pcRef.current?.close()
      const sid = streamIdRef.current
      const sesId = sessionIdRef.current
      streamIdRef.current = null
      sessionIdRef.current = null
      if (sid && sesId) {
        fetch(`${DID_API}/talks/streams/${sid}`, {
          method: 'DELETE',
          headers: makeHeaders(),
          body: JSON.stringify({ session_id: sesId })
        }).catch(() => {})
      }
    }
  }, [photoUrl, apiKey]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'absolute', inset: 0, ...style }}>
      {/* CSS fallback — visible while D-ID stream initializes */}
      <TalkingFaceCanvas
        src={photoUrl}
        speaking={speaking && !streamReady}
        audioLevel={audioLevel}
        style={{ position: 'absolute', inset: 0 }}
      />
      {/* D-ID WebRTC video — shown once stream is ready */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          opacity: streamReady ? 1 : 0,
          transition: 'opacity 0.6s ease',
        }}
      />
    </div>
  )
})

export default DIDStreamingAvatar
