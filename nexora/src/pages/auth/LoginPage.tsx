import { Box, Button, Center, Divider, PasswordInput, Stack, Text, TextInput, Anchor, Alert } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconBrandGoogle, IconAlertCircle } from '@tabler/icons-react'
import { authService } from '../../services/auth.service'
import { supabase } from '../../lib/supabase'

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

type FormData = z.infer<typeof schema>

export default function LoginPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [googleLoading, setGoogleLoading] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const onSubmit = async (data: FormData) => {
    setError(null)
    try {
      await authService.signIn(data.email, data.password)
      navigate('/')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
    }
  }

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true)
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to sign in with Google')
    } finally {
      setGoogleLoading(false)
    }
  }

  return (
    <Box
      style={{
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #0a0a14 0%, #0f0f1a 50%, #0a0a14 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <Box
        style={{
          width: '100%',
          maxWidth: 420,
          background: 'rgba(13, 13, 26, 0.8)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(124, 58, 237, 0.2)',
          borderRadius: 20,
          padding: '2.5rem',
        }}
      >
        <Stack gap="lg">
          {/* Logo */}
          <Center>
            <Stack gap={4} align="center">
              <Text
                fw={900}
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #06b6d4)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  fontSize: '2.5rem',
                  letterSpacing: '-1px',
                }}
              >
                NEXORA
              </Text>
              <Text size="sm" c="dimmed">The AI Twin Network</Text>
            </Stack>
          </Center>

          <Text size="lg" fw={600} c="white" ta="center">Welcome back</Text>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Email"
                placeholder="you@example.com"
                type="email"
                {...register('email')}
                error={errors.email?.message}
                styles={{
                  label: { color: '#8892b0', marginBottom: 4 },
                  input: { background: '#1a1a2e', border: '1px solid #2d2d4e', color: '#e2e8f0' },
                }}
              />
              <PasswordInput
                label="Password"
                placeholder="••••••••"
                {...register('password')}
                error={errors.password?.message}
                styles={{
                  label: { color: '#8892b0', marginBottom: 4 },
                  input: { background: '#1a1a2e', border: '1px solid #2d2d4e', color: '#e2e8f0' },
                  innerInput: { color: '#e2e8f0' },
                }}
              />

              <Box ta="right">
                <Anchor
                  component={Link}
                  to="/auth/forgot-password"
                  size="xs"
                  style={{ color: '#7c3aed' }}
                >
                  Forgot password?
                </Anchor>
              </Box>

              <Button
                type="submit"
                loading={isSubmitting}
                fullWidth
                size="md"
                style={{
                  background: 'linear-gradient(135deg, #7c3aed, #5b21b6)',
                  border: 'none',
                  fontWeight: 600,
                }}
                radius="xl"
              >
                Sign In
              </Button>
            </Stack>
          </form>

          <Divider label="or continue with" labelPosition="center" color="#2d2d4e" />

          <Button
            leftSection={<IconBrandGoogle size={18} />}
            variant="outline"
            fullWidth
            size="md"
            loading={googleLoading}
            onClick={handleGoogleSignIn}
            style={{
              borderColor: '#2d2d4e',
              color: '#e2e8f0',
              background: 'rgba(255,255,255,0.03)',
            }}
            radius="xl"
          >
            Continue with Google
          </Button>

          <Text size="sm" c="dimmed" ta="center">
            Don&apos;t have an account?{' '}
            <Anchor component={Link} to="/auth/register" style={{ color: '#7c3aed' }}>
              Sign Up
            </Anchor>
          </Text>
        </Stack>
      </Box>
    </Box>
  )
}
