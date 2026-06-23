import { useEffect, useRef } from 'react'

interface Props {
  src: string
  speaking: boolean
  audioLevel: number   // 0–1
  style?: React.CSSProperties
}

// Mouth sits at ~63 % from the top of a portrait headshot
const MOUTH_Y = 0.63

export default function TalkingFaceCanvas({ src, speaking, audioLevel, style }: Props) {
  const headRef  = useRef<HTMLDivElement>(null)
  const jawRef   = useRef<HTMLImageElement>(null)
  const rafRef   = useRef(0)
  const speakRef = useRef(speaking)
  const levelRef = useRef(audioLevel)
  const t0Ref    = useRef(0)

  useEffect(() => { speakRef.current = speaking },  [speaking])
  useEffect(() => { levelRef.current = audioLevel }, [audioLevel])

  // Animation loop — directly sets CSS transforms (GPU-accelerated, no canvas math)
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
        // Speaking: energetic head bob + jaw drop — clearly visible
        const lv = Math.max(al, 0.44)   // floor so it works without TTS audio
        ty      = (Math.sin(t * 9.2)  * 14 + Math.sin(t * 14.6) * 7) * lv
        tx      =  Math.sin(t * 4.1)  * 5  * lv
        rot     =  Math.sin(t * 6.0)  * 1.8 * lv
        sc      = 1 + Math.abs(Math.sin(t * 8)) * 0.02 * lv
        const rhythm = Math.sin(t * 12) * 0.5 + Math.sin(t * 8.4) * 0.3 + Math.sin(t * 4.6) * 0.2
        jawDrop = lv * Math.max(0, rhythm) * 60  // up to 60 px jaw drop
      } else {
        // Idle: slow realistic living stillness — always visible
        ty  = Math.sin(t * 0.52) * 22 + Math.sin(t * 0.18) * 12
        tx  = Math.sin(t * 0.28) * 6
        rot = Math.sin(t * 0.37) * 1.4
        sc  = 1 + Math.sin(t * 0.71) * 0.009
      }

      if (head) head.style.transform = `translateY(${ty}px) translateX(${tx}px) rotate(${rot}deg) scale(${sc})`
      if (jaw)  jaw.style.transform  = `translateY(${jawDrop}px)`

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  const upperClip = `${MOUTH_Y * 100}%`              // lower face starts here
  const lowerClip = `${(1 - MOUTH_Y) * 100}%`        // upper face ends here

  return (
    <div
      style={{
        position: 'absolute', inset: 0,
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #0d0518, #020108)',
        ...style,
      }}
    >
      {/* Blurred fill — gives cinematic depth, covers letterbox bars */}
      <img
        src={src}
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          objectFit: 'cover',
          filter: 'blur(28px) brightness(0.35) saturate(1.7)',
          transform: 'scale(1.13)',
          pointerEvents: 'none',
          userSelect: 'none',
        }}
      />

      {/* Head wrapper — all head motion lives here (bob, sway, tilt) */}
      <div
        ref={headRef}
        style={{
          position: 'absolute', inset: 0,
          transformOrigin: 'center 32%',   // rotate around forehead, not nose
          willChange: 'transform',
        }}
      >
        {/* Upper face: forehead → mouth line (stays fixed during jaw drop) */}
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

        {/* Lower face: mouth line → chin (drops down when speaking) */}
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
      </div>
    </div>
  )
}
