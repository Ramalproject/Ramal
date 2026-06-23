import { useEffect, useRef } from 'react'

interface Props {
  src: string
  speaking: boolean
  audioLevel: number   // 0–1 from AudioAnalyser
  style?: React.CSSProperties
}

export default function TalkingFaceCanvas({ src, speaking, audioLevel, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const imgRef    = useRef<HTMLImageElement | null>(null)
  const rafRef    = useRef<number>(0)
  const loadedRef = useRef(false)

  // Load source image once
  useEffect(() => {
    loadedRef.current = false
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => { imgRef.current = img; loadedRef.current = true }
    img.onerror = () => {
      // CORS failed — try without crossOrigin (canvas becomes tainted but drawing still works)
      const img2 = new Image()
      img2.onload = () => { imgRef.current = img2; loadedRef.current = true }
      img2.src = src
    }
    img.src = src
  }, [src])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let blinkTimer = 0

    function draw(ts: number) {
      if (!ctx || !canvas) return
      const t = ts / 1000
      const W = canvas.width
      const H = canvas.height
      const img = imgRef.current

      ctx.clearRect(0, 0, W, H)

      if (!img || !loadedRef.current) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const iW = img.naturalWidth  || img.width
      const iH = img.naturalHeight || img.height

      if (!speaking || audioLevel < 0.03) {
        // ── IDLE: subtle breathing ──────────────────────────────────────────
        const s    = 1 + Math.sin(t * 0.7) * 0.004
        const offX = W * (1 - s) / 2
        const offY = H * (1 - s) / 2
        ctx.save()
        ctx.setTransform(s, 0, 0, s, offX, offY)
        ctx.drawImage(img, 0, 0, W, H)
        ctx.restore()
      } else {
        // ── SPEAKING: jaw-drop animation ────────────────────────────────────
        // The mouth centre is at ~62% of portrait height
        const mouthFrac = 0.62
        const mouthY    = H * mouthFrac
        const srcMouthY = iH * mouthFrac

        // How many px to drop the lower face (driven by audio + natural rhythm)
        const rhythm  = (Math.sin(t * 14) * 0.6 + Math.sin(t * 8.5) * 0.4) * 0.5 + 0.5
        const drop    = audioLevel * rhythm * H * 0.045  // max ≈ 4.5% of height
        const dropPx  = Math.max(0, drop)

        // Draw upper face (eyes, nose, upper lip) unchanged
        ctx.drawImage(
          img,
          0, 0, iW, srcMouthY,       // src slice
          0, 0, W,  mouthY,          // dst slice
        )

        // Draw lower face (chin, neck) shifted down by dropPx
        ctx.drawImage(
          img,
          0, srcMouthY, iW, iH - srcMouthY,            // src slice
          0, mouthY + dropPx, W, H - mouthY,           // dst slice
        )

        // Fill the gap with a stretched copy of the mouth-edge strip (~3% band)
        if (dropPx > 0.5) {
          const stripFrac = 0.028
          const stripSrcY = iH * (mouthFrac - stripFrac / 2)
          const stripSrcH = iH * stripFrac
          ctx.drawImage(
            img,
            0, stripSrcY, iW, stripSrcH,              // src: thin strip at mouth edge
            0, mouthY,     W,  dropPx + 1,            // dst: stretch it to fill gap
          )
        }
      }

      // ── EYE BLINK (every ~4 s) ─────────────────────────────────────────────
      blinkTimer += ts - (blinkTimer > 0 ? blinkTimer : ts)
      const blinkCycle = t % 4.5
      if (blinkCycle < 0.15) {
        const blink   = Math.sin((blinkCycle / 0.15) * Math.PI)
        const eyeTopY = H * 0.30
        const eyeH    = H * 0.07
        ctx.fillStyle = `rgba(0,0,0,${blink * 0.8})`
        ctx.beginPath()
        ctx.ellipse(W * 0.32, eyeTopY + eyeH * 0.5, W * 0.13, eyeH * blink * 0.55, 0, 0, Math.PI * 2)
        ctx.ellipse(W * 0.68, eyeTopY + eyeH * 0.5, W * 0.13, eyeH * blink * 0.55, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => { cancelAnimationFrame(rafRef.current) }
  }, [speaking, audioLevel])

  return (
    <canvas
      ref={canvasRef}
      width={720}
      height={1080}
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 20%', display: 'block', ...style }}
    />
  )
}
