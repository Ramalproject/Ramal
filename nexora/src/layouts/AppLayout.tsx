import { AppShell } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Outlet } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'

export default function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure()

  return (
    <AppShell
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
      padding={0}
    >
      <AppShell.Navbar style={{ background: 'var(--nex-surface)', borderRight: '1px solid var(--nex-border)' }}>
        <Sidebar onMobileClose={() => toggleMobile()} />
      </AppShell.Navbar>
      <AppShell.Main style={{ background: 'var(--nex-bg)', minHeight: '100vh' }}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
