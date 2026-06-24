import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ActionIcon, Text, Box, Avatar } from '@mantine/core'
import {
  IconX, IconSend, IconRefresh, IconTypography,
  IconPhoto, IconSparkles, IconMoodSmile,
} from '@tabler/icons-react'
import { useAuthStore } from '../../store/useAuthStore'
import { getInitials } from '../../utils'

interface Props {
  opened: boolean
  onClose: () => void
}

const FILTERS = [
  { id: 'normal',    label: 'Normal',    css: 'none',                                                                           emoji: '✨', overlay: null as string | null },
  { id: 'daymode',   label: 'Day Mode',  css: 'brightness(140%) saturate(120%) contrast(108%)',                                emoji: '☀️', overlay: 'rgba(255,220,120,0.10)' },
  { id: 'night',     label: 'Night',     css: 'brightness(52%) saturate(65%) hue-rotate(215deg) contrast(128%)',              emoji: '🌙', overlay: 'rgba(5,20,90,0.32)' },
  { id: 'golden',    label: 'Golden Hr', css: 'sepia(48%) saturate(200%) brightness(115%) hue-rotate(-20deg)',                emoji: '🌅', overlay: 'rgba(255,130,0,0.14)' },
  { id: 'cyberpunk', label: 'Cyberpunk', css: 'saturate(290%) contrast(138%) hue-rotate(158deg) brightness(86%)',            emoji: '🤖', overlay: 'rgba(0,255,190,0.08)' },
  { id: 'drama',     label: 'Drama',     css: 'contrast(170%) saturate(72%) brightness(80%)',                                 emoji: '🎭', overlay: null },
  { id: 'vintage',   label: 'Vintage',   css: 'sepia(65%) contrast(88%) brightness(85%) saturate(75%)',                      emoji: '📷', overlay: 'rgba(180,100,20,0.10)' },
  { id: 'vivid',     label: 'Vivid',     css: 'saturate(245%) contrast(120%) brightness(110%)',                              emoji: '🌈', overlay: null },
  { id: 'sunset',    label: 'Sunset',    css: 'sepia(28%) saturate(215%) hue-rotate(-24deg) brightness(108%) contrast(108%)', emoji: '🌇', overlay: 'rgba(255,60,0,0.13)' },
  { id: 'aqua',      label: 'Aqua',      css: 'hue-rotate(168deg) saturate(148%) brightness(112%) contrast(110%)',           emoji: '🌊', overlay: 'rgba(0,190,255,0.10)' },
  { id: 'bw',        label: 'B&W',       css: 'grayscale(100%) contrast(120%) brightness(108%)',                             emoji: '🖤', overlay: null },
  { id: 'matrix',    label: 'Matrix',    css: 'hue-rotate(88deg) saturate(265%) contrast(128%) brightness(80%)',            emoji: '💚', overlay: 'rgba(0,255,0,0.09)' },
  { id: 'fade',      label: 'Fade',      css: 'contrast(80%) brightness(118%) saturate(60%)',                                emoji: '🌫️', overlay: 'rgba(255,255,255,0.16)' },
  { id: 'rose',      label: 'Rose',      css: 'hue-rotate(-30deg) saturate(180%) brightness(108%) contrast(108%)',          emoji: '🌸', overlay: 'rgba(255,60,120,0.10)' },
]

const STICKERS = ['😂', '🔥', '💜', '⭐', '🚀', '👑', '💫', '🎉', '🌊', '🦋', '🎵', '💎']

type Mode = 'camera' | 'photo'

export default function StoryCreatorModal({ opened, onClose }: Props) {
  const { profile } = useAuthStore()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const thumbCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [mode, setMode] = useState<Mode>('camera')
  const [cameraReady, setCameraReady] = useState(false)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [previewFrame, setPreviewFrame] = useState<string | null>(null)
  const [selectedFilter, setSelectedFilter] = useState('normal')
  const [textOverlay, setTextOverlay] = useState('')
  const [showTextInput, setShowTextInput] = useState(false)
  const [stickers, setStickers] = useState<{ emoji: string; x: number; y: number; id: number }[]>([])
  const [showStickers, setShowStickers] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [published, setPublished] = useState(false)
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [filterLabel, setFilterLabel] = useState<string | null>(null)
  const filterLabelTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const activeFilter = FILTERS.find(f => f.id === selectedFilter)?.css ?? 'none'

  function changeFilter(id: string) {
    setSelectedFilter(id)
    const f = FILTERS.find(fl => fl.id === id)
    if (!f) return
    setFilterLabel(`${f.emoji} ${f.label}`)
    if (filterLabelTimer.current) clearTimeout(filterLabelTimer.current)
    filterLabelTimer.current = setTimeout(() => setFilterLabel(null), 1800)
  }

  // Reset state when modal opens/closes
  useEffect(() => {
    if (!opened) { stopCamera(); return }
    setCapturedImage(null)
    setPublished(false)
    setTextOverlay('')
    setStickers([])
    setSelectedFilter('normal')
    setShowTextInput(false)
    setShowStickers(false)

    if (!navigator.mediaDevices?.getUserMedia) {
      setMode('photo')
      return
    }
    setMode('camera')
    startCamera()
    return () => stopCamera()
  }, [opened]) // eslint-disable-line react-hooks/exhaustive-deps

  // Restart camera when facingMode changes (without resetting filter)
  useEffect(() => {
    if (!opened || mode !== 'camera') return
    setPreviewFrame(null)
    startCamera()
  }, [facingMode]) // eslint-disable-line react-hooks/exhaustive-deps

  // Capture a small thumbnail frame 1s after camera is ready (for filter previews)
  useEffect(() => {
    if (!cameraReady) return
    const timer = setTimeout(() => {
      const video = videoRef.current
      const canvas = thumbCanvasRef.current
      if (!video || !canvas) return
      canvas.width = 72; canvas.height = 72
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      if (facingMode === 'user') { ctx.translate(72, 0); ctx.scale(-1, 1) }
      ctx.drawImage(video, 0, 0, 72, 72)
      setPreviewFrame(canvas.toDataURL('image/jpeg', 0.6))
    }, 1000)
    return () => clearTimeout(timer)
  }, [cameraReady, facingMode])

  async function startCamera() {
    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 720 }, height: { ideal: 1280 } },
        audio: false,
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.onloadedmetadata = () => setCameraReady(true)
      }
    } catch {
      setMode('photo')
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(t => t.stop())
    streamRef.current = null
    setCameraReady(false)
  }

  function capturePhoto() {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return
    canvas.width = video.videoWidth || 720
    canvas.height = video.videoHeight || 1280
    const ctx = canvas.getContext('2d')!
    if (facingMode === 'user') {
      ctx.translate(canvas.width, 0)
      ctx.scale(-1, 1)
    }
    ctx.filter = activeFilter
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(dataUrl)
    stopCamera()
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const dataUrl = ev.target?.result as string
      setCapturedImage(dataUrl)
      // Also use as preview frame for filter thumbnails
      if (!previewFrame) setPreviewFrame(dataUrl)
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function retake() {
    setCapturedImage(null)
    setTextOverlay('')
    setStickers([])
    if (mode === 'camera') startCamera()
  }

  function addSticker(emoji: string) {
    setStickers(prev => [...prev, { emoji, x: 40 + Math.random() * 30, y: 30 + Math.random() * 30, id: Date.now() }])
    setShowStickers(false)
  }

  async function publishStory() {
    setPublishing(true)
    await new Promise(r => setTimeout(r, 1200))
    setPublishing(false)
    setPublished(true)
    setTimeout(onClose, 1500)
  }

  if (!opened) return null

  return (
    <AnimatePresence>
      {opened && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(0,0,0,0.95)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', damping: 22, stiffness: 300 }}
            style={{
              position: 'relative',
              width: '100%', maxWidth: 420,
              height: '90vh', maxHeight: 780,
              borderRadius: 24,
              overflow: 'hidden',
              background: '#0a0a0a',
              boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
            }}
          >
            {/* ── Camera / Photo View ── */}
            <Box style={{ position: 'relative', width: '100%', height: '100%' }}>

              {/* Video feed */}
              {!capturedImage && mode === 'camera' && (
                <Box style={{ position: 'relative', width: '100%', height: '100%', display: cameraReady ? 'block' : 'none' }}>
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    style={{
                      width: '100%', height: '100%', objectFit: 'cover',
                      filter: activeFilter,
                      transform: facingMode === 'user' ? 'scaleX(-1)' : 'none',
                    }}
                  />
                  {/* Color grade overlay */}
                  {FILTERS.find(f => f.id === selectedFilter)?.overlay && (
                    <Box style={{ position: 'absolute', inset: 0, background: FILTERS.find(f => f.id === selectedFilter)!.overlay!, pointerEvents: 'none', mixBlendMode: 'multiply' }} />
                  )}
                  {/* Cinematic vignette */}
                  <Box style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />
                </Box>
              )}

              {/* No camera — upload placeholder */}
              {!capturedImage && mode === 'photo' && (
                <Box style={{
                  width: '100%', height: '100%',
                  background: 'linear-gradient(160deg,#0d0820,#0f1729)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24,
                  padding: '0 32px',
                }}>
                  <Box style={{
                    width: 90, height: 90, borderRadius: '50%',
                    background: 'linear-gradient(135deg,rgba(124,58,237,0.25),rgba(6,182,212,0.15))',
                    border: '2px solid rgba(124,58,237,0.5)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 0 40px rgba(124,58,237,0.3)',
                  }}>
                    <IconPhoto size={40} color="#7c3aed" />
                  </Box>
                  <Box ta="center">
                    <Text fw={700} size="md" style={{ color: 'white' }} mb={4}>Create Your Story</Text>
                    <Text c="dimmed" size="sm" ta="center">Take a new photo or choose one<br />from your gallery</Text>
                  </Box>
                  {/* Take Photo button — uses native camera on mobile */}
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => cameraInputRef.current?.click()}
                    style={{
                      width: '100%', padding: '14px', borderRadius: 50, border: 'none', cursor: 'pointer',
                      background: 'linear-gradient(135deg,#7c3aed,#06b6d4)', color: '#fff', fontWeight: 700, fontSize: 15,
                      boxShadow: '0 4px 20px rgba(124,58,237,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                    📸 Take Photo
                  </motion.button>
                  {/* Gallery button */}
                  <motion.button whileTap={{ scale: 0.95 }} onClick={() => fileRef.current?.click()}
                    style={{
                      width: '100%', padding: '14px', borderRadius: 50, cursor: 'pointer',
                      background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)',
                      color: '#fff', fontWeight: 600, fontSize: 15, backdropFilter: 'blur(8px)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                    🖼 Choose from Gallery
                  </motion.button>
                </Box>
              )}

              {/* Captured image */}
              {capturedImage && (
                <Box style={{ width: '100%', height: '100%', position: 'relative' }}>
                  <img src={capturedImage} alt="story" style={{
                    width: '100%', height: '100%', objectFit: 'cover',
                    filter: activeFilter,
                  }} />
                  {/* Color grade overlay */}
                  {FILTERS.find(f => f.id === selectedFilter)?.overlay && (
                    <Box style={{ position: 'absolute', inset: 0, background: FILTERS.find(f => f.id === selectedFilter)!.overlay!, pointerEvents: 'none', mixBlendMode: 'multiply' }} />
                  )}
                  {/* Cinematic vignette */}
                  <Box style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 35%, rgba(0,0,0,0.55) 100%)', pointerEvents: 'none' }} />
                  {/* Text overlay */}
                  {textOverlay && (
                    <Box style={{
                      position: 'absolute', top: '35%', left: '50%', transform: 'translate(-50%,-50%)',
                      background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)',
                      borderRadius: 12, padding: '8px 16px', maxWidth: '80%',
                    }}>
                      <Text ta="center" fw={800} size="xl" style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                        {textOverlay}
                      </Text>
                    </Box>
                  )}
                  {/* Sticker overlays */}
                  {stickers.map(s => (
                    <Box key={s.id} style={{ position: 'absolute', left: `${s.x}%`, top: `${s.y}%`, fontSize: 40, cursor: 'move', userSelect: 'none' }}>
                      {s.emoji}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Loading indicator */}
              {mode === 'camera' && !cameraReady && !capturedImage && (
                <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid transparent', borderTopColor: '#7c3aed' }} />
                </Box>
              )}

              {/* ── Gradient overlays ── */}
              <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to bottom,rgba(0,0,0,0.6),transparent)', pointerEvents: 'none' }} />
              <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, background: 'linear-gradient(to top,rgba(0,0,0,0.8),transparent)', pointerEvents: 'none' }} />

              {/* ── Top controls ── */}
              <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '16px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                <ActionIcon onClick={onClose} size={40} radius="xl" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}>
                  <IconX size={18} />
                </ActionIcon>

                <Group style={{ display: 'flex', gap: 8 }}>
                  {/* Text button */}
                  {capturedImage && (
                    <ActionIcon onClick={() => setShowTextInput(t => !t)} size={40} radius="xl"
                      style={{ background: showTextInput ? 'rgba(124,58,237,0.6)' : 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}>
                      <IconTypography size={18} />
                    </ActionIcon>
                  )}
                  {/* Sticker button */}
                  {capturedImage && (
                    <ActionIcon onClick={() => setShowStickers(s => !s)} size={40} radius="xl"
                      style={{ background: showStickers ? 'rgba(124,58,237,0.6)' : 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}>
                      <IconMoodSmile size={18} />
                    </ActionIcon>
                  )}
                  {/* Flip camera */}
                  {mode === 'camera' && !capturedImage && (
                    <ActionIcon onClick={() => setFacingMode(f => f === 'user' ? 'environment' : 'user')} size={40} radius="xl"
                      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}>
                      <IconRefresh size={18} />
                    </ActionIcon>
                  )}
                  {/* Upload from gallery */}
                  {!capturedImage && (
                    <ActionIcon onClick={() => fileRef.current?.click()} size={40} radius="xl"
                      style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', border: '1px solid rgba(255,255,255,0.15)', color: 'white' }}>
                      <IconPhoto size={18} />
                    </ActionIcon>
                  )}
                </Group>
              </Box>

              {/* ── User bar ── */}
              <Box style={{ position: 'absolute', top: 68, left: 16, display: 'flex', alignItems: 'center', gap: 8, zIndex: 10 }}>
                <Avatar src={profile?.avatar_url} size={32} radius="xl" style={{ border: '2px solid rgba(124,58,237,0.7)' }}>
                  {profile?.full_name ? getInitials(profile.full_name) : '?'}
                </Avatar>
                <Text size="xs" fw={700} style={{ color: 'white', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>
                  {profile?.username ?? 'Your Story'}
                </Text>
                <Box style={{ background: 'rgba(124,58,237,0.7)', borderRadius: 6, padding: '1px 7px' }}>
                  <Text size="xs" fw={700} c="white">Public</Text>
                </Box>
              </Box>

              {/* ── Text input overlay ── */}
              <AnimatePresence>
                {showTextInput && (
                  <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                    style={{ position: 'absolute', top: '42%', left: '50%', transform: 'translateX(-50%)', width: '80%', zIndex: 20 }}>
                    <input
                      autoFocus
                      value={textOverlay}
                      onChange={e => setTextOverlay(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') setShowTextInput(false) }}
                      placeholder="Add text..."
                      style={{
                        width: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)',
                        border: '2px solid rgba(124,58,237,0.6)', borderRadius: 12,
                        padding: '12px 16px', color: '#fff', fontSize: 18, fontWeight: 700,
                        textAlign: 'center', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Sticker picker ── */}
              <AnimatePresence>
                {showStickers && (
                  <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }}
                    style={{ position: 'absolute', top: 110, right: 16, zIndex: 20, background: 'rgba(15,10,30,0.95)', backdropFilter: 'blur(12px)', borderRadius: 16, padding: 12, border: '1px solid rgba(124,58,237,0.4)' }}>
                    <Text size="xs" c="dimmed" mb={8} fw={600}>Stickers</Text>
                    <Box style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 6 }}>
                      {STICKERS.map(e => (
                        <motion.button key={e} whileTap={{ scale: 0.8 }} onClick={() => addSticker(e)}
                          style={{ background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, padding: '6px', fontSize: 22, cursor: 'pointer' }}>
                          {e}
                        </motion.button>
                      ))}
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ── Bottom area ── */}
              <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, padding: '0 16px 24px' }}>

                {/* Filter strip */}
                <Box style={{ overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: 12 }}>
                  <Box style={{ display: 'flex', gap: 8, width: 'max-content' }}>
                    {FILTERS.map(f => {
                      const thumbSrc = capturedImage || previewFrame
                      return (
                        <motion.button key={f.id} whileTap={{ scale: 0.9 }}
                          onClick={() => changeFilter(f.id)}
                          style={{
                            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                            background: 'none', border: 'none', cursor: 'pointer', padding: '4px',
                          }}>
                          {/* Filter thumbnail — shows real face/photo with filter applied */}
                          <Box style={{
                            width: 60, height: 60, borderRadius: 14, overflow: 'hidden',
                            border: `2.5px solid ${selectedFilter === f.id ? '#a78bfa' : 'rgba(255,255,255,0.18)'}`,
                            boxShadow: selectedFilter === f.id ? '0 0 18px rgba(124,58,237,0.8)' : 'none',
                            position: 'relative',
                            transition: 'border-color 0.15s, box-shadow 0.15s',
                          }}>
                            {thumbSrc ? (
                              <>
                                <img src={thumbSrc} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', filter: f.css }} />
                                {f.overlay && <Box style={{ position: 'absolute', inset: 0, background: f.overlay, mixBlendMode: 'multiply' }} />}
                                {/* Vignette on thumb */}
                                <Box style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse 80% 80% at 50% 50%, transparent 30%, rgba(0,0,0,0.45) 100%)' }} />
                              </>
                            ) : (
                              <>
                                <Box style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg,#7c3aed 0%,#06b6d4 50%,#10b981 100%)', filter: f.css }} />
                                <Box style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>{f.emoji}</Box>
                              </>
                            )}
                            {/* Selected checkmark */}
                            {selectedFilter === f.id && (
                              <Box style={{ position: 'absolute', top: 3, right: 3, width: 14, height: 14, borderRadius: '50%', background: '#7c3aed', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Text style={{ color: 'white', fontSize: 8, lineHeight: 1 }}>✓</Text>
                              </Box>
                            )}
                          </Box>
                          <Text size="xs" style={{ color: selectedFilter === f.id ? '#a78bfa' : 'rgba(255,255,255,0.6)', fontWeight: selectedFilter === f.id ? 700 : 400, fontSize: 10 }}>
                            {f.label}
                          </Text>
                        </motion.button>
                      )
                    })}
                  </Box>
                </Box>

                {/* Action row */}
                {!capturedImage ? (
                  <Box style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                    {/* Shutter — capture from camera in camera mode, take photo on HTTP */}
                    {mode === 'camera' ? (
                      <motion.button whileTap={{ scale: 0.9 }} onClick={capturePhoto}
                        style={{
                          width: 72, height: 72, borderRadius: '50%', border: '4px solid white',
                          background: 'white', cursor: 'pointer', padding: 4,
                          boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                        <Box style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'linear-gradient(135deg,#7c3aed,#06b6d4)' }} />
                      </motion.button>
                    ) : null}
                  </Box>
                ) : (
                  <Box style={{ display: 'flex', gap: 12 }}>
                    {/* Retake */}
                    <motion.button whileTap={{ scale: 0.95 }} onClick={retake}
                      style={{ flex: 1, padding: '13px', borderRadius: 50, border: '1px solid rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)', cursor: 'pointer', color: 'white', fontWeight: 600, fontSize: 14 }}>
                      ↩ Retake
                    </motion.button>
                    {/* Publish */}
                    <motion.button whileTap={{ scale: 0.95 }} onClick={publishStory}
                      style={{
                        flex: 2, padding: '13px', borderRadius: 50, border: 'none', cursor: 'pointer',
                        background: published ? 'linear-gradient(135deg,#10b981,#059669)' : 'linear-gradient(135deg,#7c3aed,#06b6d4)',
                        color: 'white', fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        boxShadow: '0 4px 20px rgba(124,58,237,0.5)',
                      }}>
                      {publishing ? (
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                          style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid transparent', borderTopColor: 'white' }} />
                      ) : published ? (
                        <><span>✓</span> Shared!</>
                      ) : (
                        <><IconSend size={16} /> Share Story</>
                      )}
                    </motion.button>
                  </Box>
                )}
              </Box>

              {/* ── Live filter label (Snapchat-style flash) ── */}
              <AnimatePresence>
                {filterLabel && (
                  <motion.div
                    key={filterLabel}
                    initial={{ opacity: 0, scale: 0.7, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.8, y: -10 }}
                    transition={{ type: 'spring', damping: 18, stiffness: 300 }}
                    style={{ position: 'absolute', top: '44%', left: '50%', transform: 'translateX(-50%)', pointerEvents: 'none', zIndex: 15 }}
                  >
                    <Box style={{
                      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(12px)',
                      borderRadius: 20, padding: '10px 22px',
                      border: '1px solid rgba(124,58,237,0.5)',
                      boxShadow: '0 4px 24px rgba(124,58,237,0.4)',
                    }}>
                      <Text fw={800} size="xl" ta="center" style={{ color: 'white', textShadow: '0 2px 8px rgba(0,0,0,0.6)' }}>
                        {filterLabel}
                      </Text>
                    </Box>
                  </motion.div>
                )}
              </AnimatePresence>
            </Box>

            {/* Hidden elements */}
            <canvas ref={canvasRef} style={{ display: 'none' }} />
            <canvas ref={thumbCanvasRef} style={{ display: 'none' }} />
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileUpload} />
            <input ref={cameraInputRef} type="file" accept="image/*" capture="user" style={{ display: 'none' }} onChange={handleFileUpload} />
          </motion.div>

          {/* ── Sparkle icon branding ── */}
          <Box style={{ position: 'absolute', bottom: 24, display: 'flex', alignItems: 'center', gap: 6 }}>
            <IconSparkles size={14} color="rgba(255,255,255,0.3)" />
            <Text size="xs" style={{ color: 'rgba(255,255,255,0.3)' }}>NEXORA Stories</Text>
          </Box>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Helper for top bar group layout
function Group({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ display: 'flex', alignItems: 'center', ...style }}>{children}</div>
}
