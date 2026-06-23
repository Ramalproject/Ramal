import { useEffect, useRef } from 'react'

interface Props {
  src: string
  speaking: boolean
  audioLevel: number   // 0–1
  style?: React.CSSProperties
}

export default function TalkingFaceCanvas({ src, speaking, audioLevel, style }: Props) {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const imgRef     = useRef<HTMLImageElement | null>(null)
  const loadedRef  = useRef(false)
  const speakRef   = useRef(speaking)
  const levelRef   = useRef(audioLevel)
  const rafRef     = useRef(0)

  useEffect(() => { speakRef.current = speaking },  [speaking])
  useEffect(() => { levelRef.current = audioLevel }, [audioLevel])

  // Keep canvas buffer in sync with its CSS display size
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const sync = () => {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width  = w
        canvas.height = h
      }
    }
    sync()
    const ro = new ResizeObserver(sync)
    ro.observe(canvas)
    return () => ro.disconnect()
  }, [])

  // Image loading — try with crossOrigin first, fall back without
  useEffect(() => {
    loadedRef.current = false
    imgRef.current    = null
    const img = new Image()
    img.onload  = () => { imgRef.current = img; loadedRef.current = true }
    img.onerror = () => {
      const img2 = new Image()
      img2.onload = () => { imgRef.current = img2; loadedRef.current = true }
      img2.src = src
    }
    img.crossOrigin = 'anonymous'
    img.src = src
    return () => { img.onload = null; img.onerror = null }
  }, [src])

  // Single animation loop for the component lifetime
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function draw(ts: number) {
      if (!ctx || !canvas) return
      const W = canvas.width
      const H = canvas.height
      if (!W || !H) { rafRef.current = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, W, H)

      // Background gradient (fills letterbox areas and shows while loading)
      const bg = ctx.createLinearGradient(0, 0, 0, H)
      bg.addColorStop(0, '#0d0518')
      bg.addColorStop(1, '#020108')
      ctx.fillStyle = bg
      ctx.fillRect(0, 0, W, H)

      const img = imgRef.current
      if (!img || !loadedRef.current) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const t  = ts / 1000
      const sp = speakRef.current
      const al = levelRef.current
      const iW = img.naturalWidth  || 1
      const iH = img.naturalHeight || 1

      // ── CONTAIN math — face always fully visible regardless of viewport shape ──
      const scale  = Math.min(W / iW, H / iH) * 0.97  // 97% leaves a small margin
      const drawW  = iW * scale
      const drawH  = iH * scale
      const baseX  = (W - drawW) / 2
      const baseY  = (H - drawH) / 2

      // Head movement: energetic when speaking, subtle when idle
      const bobAmt = sp
        ? Math.sin(t * 7.3) * 6 + Math.sin(t * 3.1) * 3
        : Math.sin(t * 0.55) * 4 + Math.sin(t * 0.19) * 7

      if (sp) {
        // When speaking: use audioLevel OR synthetic floor (min 0.42)
        // This ensures visible jaw motion even when TTS audio is not available
        const level  = Math.max(al, 0.42)
        const rhythm = Math.sin(t * 13) * 0.5 + Math.sin(t * 8.5) * 0.3 + Math.sin(t * 4.7) * 0.2
        const openAmt = level * Math.max(0, rhythm) * drawH * 0.11  // up to 11% of face height

        // Mouth sits at 63% of the drawn face height
        const mouthFaceY = baseY + bobAmt + drawH * 0.63
        const clampedMY  = Math.max(baseY + drawH * 0.42, Math.min(baseY + drawH * 0.86, mouthFaceY))
        const mouthImgY  = ((clampedMY - (baseY + bobAmt)) / drawH) * iH

        // Upper face: forehead → mouth line
        ctx.drawImage(
          img, 0, 0, iW, mouthImgY,
          baseX, baseY + bobAmt, drawW, clampedMY - (baseY + bobAmt),
        )

        // Lower face: mouth line → chin, shifted down
        ctx.drawImage(
          img, 0, mouthImgY, iW, iH - mouthImgY,
          baseX, clampedMY + openAmt, drawW, drawH - (clampedMY - (baseY + bobAmt)),
        )

        // Stretch a thin strip to fill the gap (smooth skin texture in gap)
        if (openAmt > 1) {
          const gapSrcH = Math.max(2, iH * 0.038)
          const gapSrcY = Math.max(0, mouthImgY - iH * 0.018)
          ctx.drawImage(img, 0, gapSrcY, iW, gapSrcH, baseX, clampedMY, drawW, openAmt + 1)
          // Mouth interior shadow
          ctx.fillStyle = `rgba(8,0,18,${Math.min(0.75, openAmt / (drawH * 0.055))})`
          ctx.beginPath()
          ctx.ellipse(W / 2, clampedMY + openAmt * 0.35, drawW * 0.065, openAmt * 0.48, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      } else {
        // Idle: gentle breathe + slow head sway (clearly visible)
        const breathe = 1 + Math.sin(t * 0.75) * 0.007
        ctx.drawImage(
          img,
          baseX - (drawW * (breathe - 1)) / 2,
          baseY + bobAmt - (drawH * (breathe - 1)) / 2,
          drawW * breathe, drawH * breathe,
        )
      }

      // ── Eye blink every ~4.3 s ───────────────────────────────────────────────
      const blinkCycle = t % 4.3
      if (blinkCycle < 0.14) {
        const blink    = Math.sin((blinkCycle / 0.14) * Math.PI)
        const eyeTopY  = baseY + bobAmt + drawH * 0.29
        const eyeH     = drawH * 0.095 * blink
        if (eyeH > 0) {
          ctx.fillStyle = `rgba(0,0,0,${blink * 0.86})`
          // Left eye
          ctx.beginPath()
          ctx.ellipse(baseX + drawW * 0.30, eyeTopY + eyeH * 0.3, drawW * 0.135, eyeH * 0.52, 0, 0, Math.PI * 2)
          ctx.fill()
          // Right eye
          ctx.beginPath()
          ctx.ellipse(baseX + drawW * 0.70, eyeTopY + eyeH * 0.3, drawW * 0.135, eyeH * 0.52, 0, 0, Math.PI * 2)
          ctx.fill()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafRef.current)
  }, []) // single loop, reads refs every frame

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute', inset: 0,
        width: '100%', height: '100%',
        display: 'block',
        ...style,
      }}
    />
  )
}
