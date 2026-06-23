import { useEffect, useRef } from 'react'

interface Props {
  src: string
  speaking: boolean
  audioLevel: number
  style?: React.CSSProperties
}

export default function TalkingFaceCanvas({ src, speaking, audioLevel, style }: Props) {
  const headRef  = useRef<HTMLDivElement>(null)
  const rafRef   = useRef(0)
  const speakRef = useRef(speaking)
  const levelRef = useRef(audioLevel)
  const t0Ref    = useRef(0)

  useEffect(() => { speakRef.current = speaking },  [speaking])
  useEffect(() => { levelRef.current = audioLevel }, [audioLevel])

  useEffect(() => {
    const head = headRef.current
    if (!head) return

    function loop(ts: number) {
      if (!t0Ref.current) t0Ref.current = ts
      const t  = (ts - t0Ref.current) / 1000
      const sp = speakRef.current
      const al = levelRef.current
      let ty = 0, tx = 0, rot = 0, sc = 1

      if (sp) {
        const lv = Math.max(al, 0.4)
        ty  = (Math.sin(t * 9) * 10 + Math.sin(t * 14) * 5) * lv
        tx  =  Math.sin(t * 4) * 4 * lv
        rot =  Math.sin(t * 6) * 1.5 * lv
        sc  = 1 + Math.abs(Math.sin(t * 8)) * 0.015 * lv
      } else {
        // Natural idle breathing + gentle head nod (~3.5 s period)
        ty  = Math.sin(t * 1.8) * 18 + Math.sin(t * 0.7) * 9
        tx  = Math.sin(t * 0.85) * 5
        rot = Math.sin(t * 1.1) * 1.3
        sc  = 1 + Math.sin(t * 0.9) * 0.008
      }

      if (head) head.style.transform =
        `translateY(${ty}px) translateX(${tx}px) rotate(${rot}deg) scale(${sc})`

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div style={{
      position: 'absolute', inset: 0,
      overflow: 'hidden',
      background: 'linear-gradient(160deg, #0d0518, #020108)',
      ...style,
    }}>
      {/* Blurred fill for letterbox areas */}
      <img
        src={src}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          filter: 'blur(28px) brightness(0.45) saturate(1.6)',
          transform: 'scale(1.15)',
          pointerEvents: 'none', userSelect: 'none',
        }}
      />

      {/* Head wrapper — natural motion only, no jaw split */}
      <div
        ref={headRef}
        style={{
          position: 'absolute', inset: 0,
          transformOrigin: 'center 30%',
          willChange: 'transform',
        }}
      >
        <img
          src={src}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain',
            objectPosition: 'center center',
            userSelect: 'none', pointerEvents: 'none', display: 'block',
          }}
        />

        {/* Eye blink overlay */}
        <div style={{
          position: 'absolute',
          top: '27%', left: '19%', right: '19%',
          height: '9%', display: 'flex', gap: '7%',
          pointerEvents: 'none',
        }}>
          <div style={{
            flex: 1, borderRadius: '50%',
            background: 'rgba(0,0,0,0.85)',
            transformOrigin: 'center top',
            animation: 'nex-blink 4.2s 0s ease-in-out infinite',
          }} />
          <div style={{
            flex: 1, borderRadius: '50%',
            background: 'rgba(0,0,0,0.85)',
            transformOrigin: 'center top',
            animation: 'nex-blink 4.2s 0.09s ease-in-out infinite',
          }} />
        </div>
      </div>

      {/* Subtle speaking glow */}
      {speaking && (
        <div style={{
          position: 'absolute', inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(ellipse at 50% 40%, rgba(124,58,237,0.18) 0%, transparent 60%)',
          animation: 'nex-speak-glow 0.55s ease-in-out infinite',
        }} />
      )}

      <style>{`
        @keyframes nex-blink {
          0%, 88%, 100% { transform: scaleY(0); }
          92%            { transform: scaleY(1); }
          96%            { transform: scaleY(0); }
        }
        @keyframes nex-speak-glow {
          0%, 100% { opacity: 0.4; }
          50%       { opacity: 0.9; }
        }
      `}</style>
    </div>
  )
}
