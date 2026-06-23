import { useEffect, useRef } from 'react'

interface Props {
  src: string
  speaking: boolean
  audioLevel: number   // 0–1
  style?: React.CSSProperties
}


export default function TalkingFaceCanvas({ src, speaking, audioLevel, style }: Props) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const imgRef      = useRef<HTMLImageElement | null>(null)
  const loadedRef   = useRef(false)
  const speakRef    = useRef(speaking)
  const levelRef    = useRef(audioLevel)
  const rafRef      = useRef(0)

  // Keep refs current — no RAF restarts needed
  useEffect(() => { speakRef.current = speaking },  [speaking])
  useEffect(() => { levelRef.current = audioLevel }, [audioLevel])

  // Load image without crossOrigin (canvas becomes tainted for reads, but draws fine)
  useEffect(() => {
    loadedRef.current = false
    imgRef.current    = null
    const img = new Image()
    img.onload  = () => { imgRef.current = img; loadedRef.current = true }
    img.onerror = () => {
      // Server rejected CORS — retry without header
      const img2 = new Image()
      img2.onload = () => { imgRef.current = img2; loadedRef.current = true }
      img2.src = src
    }
    img.crossOrigin = 'anonymous'
    img.src = src
    return () => { img.onload = null; img.onerror = null }
  }, [src])

  // Single animation loop — runs for lifetime of component
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height

    function draw(ts: number) {
      if (!ctx || !canvas) return
      const img = imgRef.current

      ctx.clearRect(0, 0, W, H)

      if (!img || !loadedRef.current) {
        // Placeholder while loading
        ctx.fillStyle = '#1a0838'
        ctx.fillRect(0, 0, W, H)
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const t       = ts / 1000
      const sp      = speakRef.current
      const al      = levelRef.current

      const iW = img.naturalWidth  || img.width  || 1
      const iH = img.naturalHeight || img.height || 1
      const scale  = Math.max(W / iW, H / iH)
      const drawW  = iW * scale
      const drawH  = iH * scale
      const baseX  = (W - drawW) / 2
      const excess = drawH - H
      const baseY  = -(excess * 0.15)

      // ── JAW DROP ─────────────────────────────────────────────────────────────
      if (sp && al > 0.02) {
        // Natural talking rhythm: multiple sine waves
        const rhythm   = (Math.sin(t * 14) * 0.5 + Math.sin(t * 9.1) * 0.3 + Math.sin(t * 5.3) * 0.2)
        const openAmt  = al * Math.max(0, rhythm) * H * 0.10   // max 10% of canvas height

        // Mouth position: 64% down the DRAWN image area (portrait headshot)
        const mouthDrawY = baseY + drawH * 0.64   // absolute canvas Y of mouth split
        const clampedMY  = Math.max(H * 0.40, Math.min(H * 0.85, mouthDrawY))

        // Source coordinates for the split
        const mouthImgY  = ((clampedMY - baseY) / drawH) * iH

        // Upper face: image top → mouth line
        ctx.drawImage(
          img,
          0,         0,       iW, mouthImgY,               // src
          baseX, baseY, drawW, clampedMY - baseY,           // dst
        )

        // Lower face: mouth line → bottom, shifted down by openAmt
        ctx.drawImage(
          img,
          0,         mouthImgY, iW, iH - mouthImgY,                    // src
          baseX, clampedMY + openAmt, drawW, drawH - (clampedMY - baseY), // dst
        )

        // Fill gap with stretched mouth-edge strip
        if (openAmt > 1) {
          const gapSrcH = Math.max(2, iH * 0.04)
          const gapSrcY = Math.max(0, mouthImgY - iH * 0.02)
          ctx.drawImage(img, 0, gapSrcY, iW, gapSrcH, baseX, clampedMY, drawW, openAmt + 1)
        }

      } else {
        // Idle: very subtle breathing scale
        const breathe = 1 + Math.sin(t * 0.75) * 0.0035
        const bx = baseX - (drawW * (breathe - 1)) / 2
        const by = baseY - (drawH * (breathe - 1)) / 2
        ctx.drawImage(img, bx, by, drawW * breathe, drawH * breathe)
      }

      // ── EYE BLINK every ~4 s ─────────────────────────────────────────────────
      const blinkCycle = t % 4.3
      if (blinkCycle < 0.14) {
        const blink   = Math.sin((blinkCycle / 0.14) * Math.PI)
        // Eyes are at roughly 30–38% of drawn height
        const eyeTopY = baseY + drawH * 0.30
        const eyeH    = drawH * 0.08 * blink
        if (eyeH > 0) {
          ctx.fillStyle = `rgba(0,0,0,${blink * 0.82})`
          // Left eye
          ctx.beginPath()
          ctx.ellipse(W * 0.34, eyeTopY + eyeH * 0.3, drawW * 0.14, eyeH * 0.5, 0, 0, Math.PI * 2)
          ctx.fill()
          // Right eye
          ctx.beginPath()
          ctx.ellipse(W * 0.66, eyeTopY + eyeH * 0.3, drawW * 0.14, eyeH * 0.5, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // single loop, reads refs each frame

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={900}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        objectFit: 'cover',
        objectPosition: 'center top',
        display: 'block',
        ...style,
      }}
    />
  )
}
