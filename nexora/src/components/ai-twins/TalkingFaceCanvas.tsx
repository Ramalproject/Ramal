import { useEffect, useRef } from 'react'

interface Props {
  src: string
  speaking: boolean
  audioLevel: number   // 0–1
  style?: React.CSSProperties
}

// Mouth at ~65 % from top — safer default across portrait headshots
const MOUTH_Y = 0.65

export default function TalkingFaceCanvas({ src, speaking, audioLevel, style }: Props) {
  const headRef  = useRef<HTMLDivElement>(null)
  const jawRef   = useRef<HTMLImageElement>(null)
  const rafRef   = useRef(0)
  const speakRef = useRef(speaking)
  const levelRef = useRef(audioLevel)
  const t0Ref    = useRef(0)

  useEffect(() => { speakRef.current = speaking },  [speaking])
  useEffect(() => { levelRef.current = audioLevel }, [audioLevel])

  useEffect(() => {
    const head = headRef.current
    const jaw  = jawRef.current
    if (!head || !jaw) return

    function loop(ts: number) {
      if (!t0Ref.current) t0Ref.current = ts
      const t  = (ts - t0Ref.current) / 1000
      const sp = speakRef.current
      const al = levelRef.current

      let ty = 0, tx = 0, rot = 0, sc = 1, jawDrop = 0

      if (sp) {
        // Speaking: fast energetic bob — very visible
        const lv = Math.max(al, 0.44)
        ty      = (Math.sin(t * 9.4)  * 14 + Math.sin(t * 15) * 7) * lv
        tx      =  Math.sin(t * 4.2)  * 5  * lv
        rot     =  Math.sin(t * 6.1)  * 1.8 * lv
        sc      = 1 + Math.abs(Math.sin(t * 8)) * 0.018 * lv
        const rhythm = Math.sin(t * 12) * 0.5 + Math.sin(t * 8) * 0.3 + Math.sin(t * 5) * 0.2
        jawDrop = lv * Math.max(0, rhythm) * 42  // 42 px max jaw drop
      } else {
        // Idle: realistic living motion — FAST enough to be visible within 0.3 s
        // Period ~3.5 s for main nod, ~9 s for drift, ~5.7 s for tilt
        ty  = Math.sin(t * 1.8) * 22 + Math.sin(t * 0.7) * 11
        tx  = Math.sin(t * 0.85) * 6
        rot = Math.sin(t * 1.1) * 1.4
        sc  = 1 + Math.sin(t * 0.9) * 0.01
      }

      if (head) head.style.transform =
        `translateY(${ty}px) translateX(${tx}px) rotate(${rot}deg) scale(${sc})`
      if (jaw)  jaw.style.transform  = `translateY(${jawDrop}px)`

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const lowerClip = `${(1 - MOUTH_Y) * 100}%`
  const upperClip = `${MOUTH_Y * 100}%`

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #0d0518, #020108)',
        ...style,
      }}
    >
      {/* Blurred fill — covers letterbox bars with cinematic depth */}
      <img
        src={src}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          filter: 'blur(26px) brightness(0.55) saturate(1.5)',
          transform: 'scale(1.12)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      {/* Head wrapper — all head motion: bob, sway, tilt */}
      <div
        ref={headRef}
        style={{
          position: 'absolute', inset: 0,
          transformOrigin: 'center 32%',
          willChange: 'transform',
        }}
      >
        {/* Upper face: forehead → mouth */}
        <img
          src={src}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain',
            objectPosition: 'center center',
            clipPath: `inset(0 0 ${lowerClip} 0)`,
            userSelect: 'none',
            pointerEvents: 'none',
            display: 'block',
          }}
        />

        {/* Lower face: mouth → chin (slides down when speaking) */}
        <img
          ref={jawRef}
          src={src}
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            objectFit: 'contain',
            objectPosition: 'center center',
            clipPath: `inset(${upperClip} 0 0 0)`,
            transformOrigin: 'center top',
            willChange: 'transform',
            userSelect: 'none',
            pointerEvents: 'none',
            display: 'block',
          }}
        />

        {/* Eye blink overlay — two ellipses at ~30 % height, CSS animated */}
        <div style={{
          position: 'absolute',
          top: '28%', left: '18%', right: '18%',
          height: '9%',
          display: 'flex',
          gap: '6%',
          pointerEvents: 'none',
        }}>
          <div style={{
            flex: 1, borderRadius: '50%',
            background: 'rgba(0,0,0,0.82)',
            transformOrigin: 'center top',
            animation: 'nex-blink 4.5s 0s ease-in-out infinite',
          }} />
          <div style={{
            flex: 1, borderRadius: '50%',
            background: 'rgba(0,0,0,0.82)',
            transformOrigin: 'center top',
            animation: 'nex-blink 4.5s 0.07s ease-in-out infinite',
          }} />
        </div>
      </div>

      <style>{`
        @keyframes nex-blink {
          0%, 87%, 100% { transform: scaleY(0); }
          91%            { transform: scaleY(1); }
          95%            { transform: scaleY(0); }
        }
      `}</style>
    </div>
  )
}
