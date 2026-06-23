import { Box, Title, Tabs, TextInput, Textarea, Button, Stack, Group, Text, PasswordInput, Switch, Paper, Badge, Alert } from '@mantine/core'
import { IconUser, IconKey, IconBell, IconShield, IconSettings } from '@tabler/icons-react'
import { useState } from 'react'
import { notifications } from '@mantine/notifications'
import { useAuthStore } from '../../store/useAuthStore'
import { profileService } from '../../services/profile.service'
import { useQueryClient } from '@tanstack/react-query'

const OPENAI_KEY_STORAGE = 'nexora_openai_api_key'

const inputStyle = { background: '#1a1a2e', border: '1px solid #2d2d4e', color: 'white' as const }
const labelStyle = { color: '#8892b0' as const }

export default function SettingsPage() {
  const { profile, user, setProfile } = useAuthStore()
  const qc = useQueryClient()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [website, setWebsite] = useState(profile?.website ?? '')
  const [location, setLocation] = useState(profile?.location ?? '')
  const [saving, setSaving] = useState(false)
  const [isPrivate, setIsPrivate] = useState((profile as { is_private?: boolean } | null)?.is_private ?? false)
  const [savingPrivacy, setSavingPrivacy] = useState(false)
  const [openaiKey, setOpenaiKey] = useState(() => localStorage.getItem(OPENAI_KEY_STORAGE) ?? '')

  async function saveProfile() {
    if (!user) return
    setSaving(true)
    try {
      const updated = await profileService.update(user.id, { full_name: fullName, bio: bio || null, website: website || null, location: location || null })
      setProfile(updated)
      qc.invalidateQueries({ queryKey: ['profile'] })
      notifications.show({ title: 'Saved!', message: 'Profile updated successfully', color: 'green' })
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save profile', color: 'red' })
    } finally {
      setSaving(false)
    }
  }

  async function savePrivacy() {
    if (!user) return
    setSavingPrivacy(true)
    try {
      const updated = await profileService.update(user.id, { is_private: isPrivate } as Parameters<typeof profileService.update>[1])
      setProfile(updated)
      notifications.show({ title: 'Privacy updated', message: isPrivate ? 'Your account is now Private' : 'Your account is now Public', color: 'violet' })
    } catch {
      notifications.show({ title: 'Error', message: 'Failed to save privacy setting', color: 'red' })
    } finally {
      setSavingPrivacy(false)
    }
  }

  function saveApiKey() {
    localStorage.setItem(OPENAI_KEY_STORAGE, openaiKey.trim())
    notifications.show({ title: 'API Key Saved!', message: 'Your OpenAI API key has been saved locally', color: 'green' })
  }

  return (
    <Box p="xl" maw={700} mx="auto">
      <Title order={2} c="white" mb="xl">
        <Group gap={8}><IconSettings color="#7c3aed" size={28} /> Settings</Group>
      </Title>

      <Tabs defaultValue="profile">
        <Tabs.List mb="xl">
          <Tabs.Tab value="profile" leftSection={<IconUser size={14} />}>Profile</Tabs.Tab>
          <Tabs.Tab value="account" leftSection={<IconShield size={14} />}>Account</Tabs.Tab>
          <Tabs.Tab value="apikeys" leftSection={<IconKey size={14} />}>API Keys</Tabs.Tab>
          <Tabs.Tab value="notifications" leftSection={<IconBell size={14} />}>Notifications</Tabs.Tab>
        </Tabs.List>

        <Tabs.Panel value="profile">
          <Paper p="xl" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
            <Stack>
              <TextInput label="Full Name" value={fullName} onChange={e => setFullName(e.target.value)}
                styles={{ label: labelStyle, input: inputStyle }} />
              <Textarea label="Bio" value={bio} onChange={e => setBio(e.target.value)} minRows={3}
                styles={{ label: labelStyle, input: inputStyle }} />
              <TextInput label="Website" value={website} onChange={e => setWebsite(e.target.value)}
                placeholder="https://yoursite.com" styles={{ label: labelStyle, input: inputStyle }} />
              <TextInput label="Location" value={location} onChange={e => setLocation(e.target.value)}
                placeholder="New York, USA" styles={{ label: labelStyle, input: inputStyle }} />
              <Group justify="flex-end">
                <Button onClick={saveProfile} loading={saving}
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
                  Save Changes
                </Button>
              </Group>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="account">
          <Paper p="xl" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
            <Stack>
              <TextInput label="Email" value={user?.email ?? ''} disabled
                styles={{ label: labelStyle, input: { ...inputStyle, color: '#555' } }} />
              <Text c="dimmed" size="sm">To change your email, contact support.</Text>
              <PasswordInput label="New Password" placeholder="Enter new password"
                styles={{ label: labelStyle, input: inputStyle }} />
              <PasswordInput label="Confirm Password" placeholder="Confirm new password"
                styles={{ label: labelStyle, input: inputStyle }} />
              <Button variant="outline" color="violet">Update Password</Button>
              {/* Privacy */}
              <Paper p="md" style={{ background: '#0a0a1e', border: '1px solid #2d2d4e', borderRadius: 8 }}>
                <Text c="white" fw={600} mb={4}>Account Privacy</Text>
                <Text c="dimmed" size="xs" mb="md">Control who can see your posts and profile</Text>
                <Group justify="space-between" align="center" mb="sm">
                  <Box>
                    <Text size="sm" c="white" fw={500}>{isPrivate ? '🔒 Private Account' : '🌐 Public Account'}</Text>
                    <Text size="xs" c="dimmed">
                      {isPrivate ? 'Only approved followers can see your posts' : 'Anyone can see your posts and profile'}
                    </Text>
                  </Box>
                  <Switch checked={isPrivate} onChange={e => setIsPrivate(e.currentTarget.checked)} color="violet" size="md" />
                </Group>
                <Button size="xs" onClick={savePrivacy} loading={savingPrivacy}
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
                  Save Privacy
                </Button>
              </Paper>

              <Paper p="md" mt="md" style={{ background: '#1a0a0a', border: '1px solid #3a1a1a', borderRadius: 8 }}>
                <Text c="red" fw={600} mb="sm">Danger Zone</Text>
                <Text c="dimmed" size="sm" mb="sm">
                  Permanently delete your account and all data. This cannot be undone.
                </Text>
                <Button color="red" variant="outline" size="sm">Delete Account</Button>
              </Paper>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="apikeys">
          <Paper p="xl" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
            <Stack>
              <Text c="white" fw={600}>OpenAI API Key</Text>
              <Text c="dimmed" size="sm">
                Used for AI Twin chat and voice features. Your key is stored locally in your browser only — never sent to our servers.
              </Text>
              <TextInput
                placeholder="sk-..."
                value={openaiKey}
                onChange={e => setOpenaiKey(e.target.value)}
                type="password"
                styles={{ input: { ...inputStyle, fontFamily: 'monospace' } }}
              />
              {openaiKey && (
                <Group gap={4}>
                  <Badge color="green" size="sm">Key saved locally</Badge>
                  <Text c="dimmed" size="xs">{openaiKey.slice(0, 8)}...{openaiKey.slice(-4)}</Text>
                </Group>
              )}
              <Button onClick={saveApiKey} style={{ background: 'linear-gradient(135deg, #7c3aed, #5b21b6)' }}>
                Save API Key
              </Button>
              <Alert color="blue" title="How to get an API Key" radius="md">
                Visit platform.openai.com → API Keys → Create new secret key. Paste it above and click Save.
              </Alert>
            </Stack>
          </Paper>
        </Tabs.Panel>

        <Tabs.Panel value="notifications">
          <Paper p="xl" style={{ background: '#0d0d1a', border: '1px solid #1e1e3a', borderRadius: 12 }}>
            <Stack gap="lg">
              {[
                { label: 'New followers', desc: 'Get notified when someone follows you', defaultChecked: true },
                { label: 'Post likes', desc: 'Get notified when someone likes your post', defaultChecked: true },
                { label: 'Comments', desc: 'Get notified when someone comments on your post', defaultChecked: true },
                { label: 'Messages', desc: 'Get notified for new messages', defaultChecked: true },
                { label: 'AI Twin activity', desc: 'Get notified when someone chats with your AI Twin', defaultChecked: false },
              ].map(({ label, desc, defaultChecked }) => (
                <Switch
                  key={label}
                  label={label}
                  description={desc}
                  defaultChecked={defaultChecked}
                  labelPosition="left"
                  styles={{
                    body: { justifyContent: 'space-between' },
                    label: { color: 'white', fontWeight: 500 },
                    description: { color: '#8892b0' }
                  }}
                />
              ))}
            </Stack>
          </Paper>
        </Tabs.Panel>
      </Tabs>
    </Box>
  )
}
