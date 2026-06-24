import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Box, Text, Avatar, ActionIcon } from '@mantine/core'
import { useNavigate } from 'react-router-dom'
import {
  IconHeart, IconMessageCircle, IconShare, IconBookmark,
  IconMusic, IconArrowLeft, IconVolume, IconVolumeOff,
  IconDotsVertical,
} from '@tabler/icons-react'

const MOCK_REELS = [
  {
    id: '1', user: 'Alex Johnson', username: 'alexj', likes: 12400, comments: 384, shares: 210,
    caption: 'Ocean vibes all day 🌊 Nothing beats this view at sunset. Pure bliss.',
    song: 'Waves - Mr Probz', gradient: 'linear-gradient(160deg,#1a1040 0%,#7c3aed 50%,#06b6d4 100%)',
    emoji: '🌊', color: '#06b6d4',
  },
  {
    id: '2', user: 'Sara Chen', username: 'sarachen', likes: 8900, comments: 217, shares: 98,
    caption: 'Day in my life ☀️ Coffee, code, and good vibes. This is my routine.',
    song: 'Golden Hour - JVKE', gradient: 'linear-gradient(160deg,#1a0a05 0%,#f59e0b 50%,#ef4444 100%)',
    emoji: '🔥', color: '#f59e0b',
  },
  {
    id: '3', user: 'Mike Davis', username: 'mikedavis', likes: 5200, comments: 143, shares: 67,
    caption: 'New track dropping Friday 🎵 Been working on this for months. Stay tuned!',
    song: 'Blinding Lights - The Weeknd', gradient: 'linear-gradient(160deg,#052020 0%,#10b981 50%,#06b6d4 100%)',
    emoji: '🎵', color: '#10b981',
  },
  {
    id: '4', user: 'Anna Park', username: 'annapark', likes: 21000, comments: 892, shares: 445,
    caption: 'Fashion week was insane 👑 So many amazing designers this year. Loved every moment.',
    song: 'Vogue - Madonna', gradient: 'linear-gradient(160deg,#1a0520 0%,#ec4899 50%,#8b5cf6 100%)',
    emoji: '👑', color: '#ec4899',
  },
  {
    id: '5', user: 'Priya Mehta', username: 'priyam', likes: 3700, comments: 96, shares: 34,
    caption: 'Tech talk: AI is changing everything 🚀 Here is what you need to know in 2025.',
    song: 'Future - Metro Boomin', gradient: 'linear-gradient(160deg,#0a0a20 0%,#f97316 50%,#eab308 100%)',
    emoji: '🚀', color: '#f97316',
  },
  {
    id: '6', user: 'Tom Lee', username: 'tomlee', likes: 9100, comments: 310, shares: 178,
    caption: 'This prank got me 💀 Could not stop laughing for 10 minutes straight.',
    song: 'Laugh Now Cry Later - Drake', gradient: 'linear-gradient(160deg,#051515 0%,#06b6d4 50%,#10b981 100%)',
    emoji: '🎭', color: '#06b6d4',
  },
]

function formatNum(n: number) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace('.0', '') + 'k'
  return n.toString()
}

interface ReelCardProps {
  reel: typeof MOCK_REELS[0]
  isActive: boolean
  isMuted: boolean
}

function ReelCard({ reel, isActive, isMuted }: ReelCardProps) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [likeCount, setLikeCount] = useState(reel.likes)
  const [showHeart, setShowHeart] = useState(false)

  function handleDoubleTap() {
    if (!liked) {
      setLiked(true)
      setLikeCount(c => c + 1)
    }
    setShowHeart(true)
    setTimeout(() => setShowHeart(false), 800)
  }

  function handleLike() {
    setLiked(l => !l)
    setLikeCount(c => liked ? c - 1 : c + 1)
  }

  return (
    <Box
      style={{ position: 'relative', width: '100%', height: '100%', background: reel.gradient, overflow: 'hidden' }}
      onDoubleClick={handleDoubleTap}
    >
      {/* Animated background orbs */}
      <motion.div
        animate={isActive ? { scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] } : {}}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: reel.color, filter: 'blur(80px)', opacity: 0.3,
          top: '20%', left: '50%', transform: 'translateX(-50%)',
        }}
      />

      {/* Center emoji */}
      <motion.div
        animate={isActive ? { y: [0, -12, 0], rotate: [-5, 5, -5] } : {}}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: 96, userSelect: 'none',
          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.4))',
        }}
      >
        {reel.emoji}
      </motion.div>

      {/* Double-tap heart */}
      <AnimatePresence>
        {showHeart && (
          <motion.div
            initial={{ scale: 0, opacity: 1 }}
            animate={{ scale: 1.6, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.7 }}
            style={{
              position: 'absolute', top: '40%', left: '50%',
              transform: 'translate(-50%,-50%)',
              fontSize: 80, pointerEvents: 'none', zIndex: 20,
            }}
          >
            ❤️
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top gradient */}
      <Box style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 120, background: 'linear-gradient(to bottom,rgba(0,0,0,0.5),transparent)', pointerEvents: 'none' }} />

      {/* Bottom gradient */}
      <Box style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 300, background: 'linear-gradient(to top,rgba(0,0,0,0.85),transparent)', pointerEvents: 'none' }} />

      {/* Right side actions */}
      <Box style={{ position: 'absolute', right: 12, bottom: 120, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, zIndex: 10 }}>
        {/* Author avatar */}
        <Box style={{ position: 'relative' }}>
          <Avatar size={48} radius="xl" style={{ border: `3px solid ${reel.color}`, boxShadow: `0 0 16px ${reel.color}66` }}>
            {reel.user[0]}
          </Avatar>
          <Box style={{
            position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
            width: 20, height: 20, borderRadius: '50%',
            background: 'linear-gradient(135deg,#7c3aed,#06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #0a0a1a',
          }}>
            <Text size="xs" style={{ color: 'white', fontSize: 10 }}>+</Text>
          </Box>
        </Box>

        {/* Like */}
        <Box style={{ textAlign: 'center' }}>
          <motion.div whileTap={{ scale: 0.8 }}>
            <ActionIcon size={48} variant="transparent" onClick={handleLike}>
              <motion.div animate={liked ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 0.3 }}>
                <IconHeart size={30} color={liked ? '#ef4444' : 'white'} fill={liked ? '#ef4444' : 'none'} />
              </motion.div>
            </ActionIcon>
          </motion.div>
          <Text size="xs" fw={700} style={{ color: 'white' }}>{formatNum(likeCount)}</Text>
        </Box>

        {/* Comment */}
        <Box style={{ textAlign: 'center' }}>
          <ActionIcon size={48} variant="transparent">
            <IconMessageCircle size={28} color="white" />
          </ActionIcon>
          <Text size="xs" fw={700} style={{ color: 'white' }}>{formatNum(reel.comments)}</Text>
        </Box>

        {/* Share */}
        <Box style={{ textAlign: 'center' }}>
          <ActionIcon size={48} variant="transparent">
            <IconShare size={26} color="white" />
          </ActionIcon>
          <Text size="xs" fw={700} style={{ color: 'white' }}>{formatNum(reel.shares)}</Text>
        </Box>

        {/* Save */}
        <Box style={{ textAlign: 'center' }}>
          <ActionIcon size={48} variant="transparent" onClick={() => setSaved(s => !s)}>
            <IconBookmark size={26} color={saved ? reel.color : 'white'} fill={saved ? reel.color : 'none'} />
          </ActionIcon>
        </Box>

        {/* More */}
        <ActionIcon size={48} variant="transparent">
          <IconDotsVertical size={22} color="white" />
        </ActionIcon>
      </Box>

      {/* Bottom left: user + caption + song */}
      <Box style={{ position: 'absolute', bottom: 90, left: 16, right: 80, zIndex: 10 }}>
        <Text fw={800} size="sm" style={{ color: 'white', marginBottom: 4 }}>@{reel.username}</Text>
        <Text size="sm" style={{ color: 'rgba(255,255,255,0.9)', lineHeight: 1.4, marginBottom: 12 }} lineClamp={2}>
          {reel.caption}
        </Text>
        {/* Scrolling song name */}
        <Box style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.div animate={{ rotate: isActive ? 360 : 0 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
            <Box style={{
              width: 32, height: 32, borderRadius: '50%',
              background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <IconMusic size={14} color="white" />
            </Box>
          </motion.div>
          <Box style={{ overflow: 'hidden', flex: 1 }}>
            <motion.div
              animate={isActive ? { x: [0, -80, 0] } : {}}
              transition={{ duration: 4, repeat: Infinity, ease: 'linear', repeatDelay: 1 }}
            >
              <Text size="xs" fw={600} style={{ color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>
                🎵 {reel.song}
              </Text>
            </motion.div>
          </Box>
        </Box>
      </Box>

      {/* Muted indicator */}
      {isMuted && (
        <Box style={{ position: 'absolute', top: 80, right: 16, zIndex: 10 }}>
          <Box style={{ background: 'rgba(0,0,0,0.5)', borderRadius: 20, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 4 }}>
            <IconVolumeOff size={14} color="white" />
            <Text size="xs" style={{ color: 'white' }}>Muted</Text>
          </Box>
        </Box>
      )}
    </Box>
  )
}

export default function ReelsPage() {
  const navigate = useNavigate()
  const [activeIndex, setActiveIndex] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const idx = parseInt((entry.target as HTMLElement).dataset.index ?? '0')
            setActiveIndex(idx)
          }
        })
      },
      { threshold: 0.6, root: el }
    )
    const cards = el.querySelectorAll('[data-index]')
    cards.forEach(c => observer.observe(c))
    return () => observer.disconnect()
  }, [])

  return (
    <Box style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 100,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Header */}
      <Box style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 16px',
        background: 'linear-gradient(to bottom,rgba(0,0,0,0.6),transparent)',
      }}>
        <ActionIcon size={40} radius="xl" variant="transparent" onClick={() => navigate(-1)}>
          <IconArrowLeft size={22} color="white" />
        </ActionIcon>
        <Text fw={800} size="lg" style={{ color: 'white' }}>Reels</Text>
        <ActionIcon size={40} radius="xl" variant="transparent" onClick={() => setIsMuted(m => !m)}>
          {isMuted ? <IconVolumeOff size={22} color="white" /> : <IconVolume size={22} color="white" />}
        </ActionIcon>
      </Box>

      {/* Scrollable reel feed */}
      <Box
        ref={containerRef}
        style={{
          flex: 1, overflowY: 'scroll', scrollSnapType: 'y mandatory',
          scrollbarWidth: 'none',
        }}
      >
        {MOCK_REELS.map((reel, i) => (
          <Box
            key={reel.id}
            data-index={i}
            style={{ height: '100vh', scrollSnapAlign: 'start', position: 'relative' }}
          >
            <ReelCard reel={reel} isActive={i === activeIndex} isMuted={isMuted} />
          </Box>
        ))}
      </Box>

      {/* Scroll hint on first load */}
      <AnimatePresence>
        {activeIndex === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: [0, -8, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5, repeat: 3, repeatType: 'loop' }}
            style={{
              position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
              zIndex: 20, textAlign: 'center', pointerEvents: 'none',
            }}
          >
            <Text size="xs" style={{ color: 'rgba(255,255,255,0.5)' }}>Scroll for next reel ↑</Text>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}
