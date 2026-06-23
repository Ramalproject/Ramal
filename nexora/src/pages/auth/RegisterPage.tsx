import { Box, Button, Center, PasswordInput, Stack, Text, TextInput, Anchor, Alert } from '@mantine/core'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { IconAlertCircle } from '@tabler/icons-react'
import { authService } from '../../services/auth.service'

const schema = z.object({
  fullName: z.string().min(2, 'Full name must be at least 2 characters'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
})

type FormData = z.infer<typeof schema>

export default function RegisterPage() {
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
      await authService.signUp(data.email, data.password, data.username, data.fullName)
      setSuccess(true)
      setTimeout(() => navigate('/'), 2000)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
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

          <Text size="lg" fw={600} c="white" ta="center">Create your account</Text>

          {error && (
            <Alert icon={<IconAlertCircle size={16} />} color="red" variant="light">
              {error}
            </Alert>
          )}

          {success && (
            <Alert color="green" variant="light">
              Account created! Redirecting...
            </Alert>
          )}

          <form onSubmit={handleSubmit(onSubmit)}>
            <Stack gap="md">
              <TextInput
                label="Full Name"
                placeholder="Your name"
                {...register('fullName')}
                error={errors.fullName?.message}
                styles={{
                  label: { color: '#8892b0', marginBottom: 4 },
                  input: { background: '#1a1a2e', border: '1px solid #2d2d4e', color: '#e2e8f0' },
                }}
              />
              <TextInput
                label="Username"
                placeholder="yourusername"
                {...register('username')}
                error={errors.username?.message}
                styles={{
                  label: { color: '#8892b0', marginBottom: 4 },
                  input: { background: '#1a1a2e', border: '1px solid #2d2d4e', color: '#e2e8f0' },
                }}
              />
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
              <PasswordInput
                label="Confirm Password"
                placeholder="••••••••"
                {...register('confirmPassword')}
                error={errors.confirmPassword?.message}
                styles={{
                  label: { color: '#8892b0', marginBottom: 4 },
                  input: { background: '#1a1a2e', border: '1px solid #2d2d4e', color: '#e2e8f0' },
                  innerInput: { color: '#e2e8f0' },
                }}
              />

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
                Create Account
              </Button>
            </Stack>
          </form>

          <Text size="sm" c="dimmed" ta="center">
            Already have an account?{' '}
            <Anchor component={Link} to="/auth/login" style={{ color: '#7c3aed' }}>
              Sign In
            </Anchor>
          </Text>
        </Stack>
      </Box>
    </Box>
  )
}
