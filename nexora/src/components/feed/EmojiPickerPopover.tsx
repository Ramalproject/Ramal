import Picker from '@emoji-mart/react'
import emojiData from '@emoji-mart/data'
import { Popover, ActionIcon, Tabs, SimpleGrid, Box, ScrollArea } from '@mantine/core'
import { IconMoodSmile } from '@tabler/icons-react'
import { useState } from 'react'
import { useComputedColorScheme } from '@mantine/core'

const STICKER_ROWS = [
  { label: '🔥 Reactions', emojis: ['😂','😍','🥺','😎','🤩','🔥','💯','🙏','👏','🎉','💪','✨'] },
  { label: '❤️ Love',      emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💖','💗','💘','💝'] },
  { label: '🎊 Celebrate', emojis: ['🎊','🎈','🥳','🎂','🎁','🏆','🥇','🌟','⭐','🌈','🎶','🍾'] },
  { label: '😆 Faces',     emojis: ['😁','😜','🤪','🥸','😏','🤗','🤭','😌','🤤','🥴','😤','😡'] },
]

interface Props {
  onSelect: (emoji: string) => void
}

export default function EmojiPickerPopover({ onSelect }: Props) {
  const [open, setOpen] = useState(false)
  const scheme = useComputedColorScheme('dark')

  const pick = (emoji: string) => { onSelect(emoji); setOpen(false) }

  return (
    <Popover
      opened={open}
      onClose={() => setOpen(false)}
      position="top-end"
      withArrow
      shadow="xl"
      width={352}
      zIndex={400}
    >
      <Popover.Target>
        <ActionIcon
          onClick={() => setOpen(o => !o)}
          variant="subtle"
          c="dimmed"
          size="sm"
          radius="xl"
          style={{ transition: 'color 0.15s' }}
        >
          <IconMoodSmile size={17} />
        </ActionIcon>
      </Popover.Target>

      <Popover.Dropdown p={0} style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--nex-border)' }}>
        <Tabs defaultValue="emoji" keepMounted={false}
          styles={{ tab: { fontSize: 13, padding: '8px 14px' }, list: { background: 'var(--nex-surface)', borderBottom: '1px solid var(--nex-border)' } }}
        >
          <Tabs.List>
            <Tabs.Tab value="emoji">😊 Emoji</Tabs.Tab>
            <Tabs.Tab value="stickers">🎭 Stickers</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="emoji">
            <Picker
              data={emojiData}
              onEmojiSelect={(e: any) => pick(e.native)}
              theme={scheme === 'dark' ? 'dark' : 'light'}
              previewPosition="none"
              skinTonePosition="none"
              maxFrequentRows={1}
            />
          </Tabs.Panel>

          <Tabs.Panel value="stickers">
            <ScrollArea h={280} p="sm" style={{ background: 'var(--nex-surface)' }}>
              {STICKER_ROWS.map(row => (
                <Box key={row.label} mb="xs">
                  <Box mb={4} style={{ fontSize: 11, color: 'var(--nex-text-muted)', fontWeight: 600, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {row.label}
                  </Box>
                  <SimpleGrid cols={6} spacing={2}>
                    {row.emojis.map(s => (
                      <ActionIcon
                        key={s}
                        variant="subtle"
                        size={40}
                        radius="md"
                        onClick={() => pick(s)}
                        style={{ fontSize: 22, lineHeight: 1, transition: 'background 0.1s' }}
                      >
                        {s}
                      </ActionIcon>
                    ))}
                  </SimpleGrid>
                </Box>
              ))}
            </ScrollArea>
          </Tabs.Panel>
        </Tabs>
      </Popover.Dropdown>
    </Popover>
  )
}
