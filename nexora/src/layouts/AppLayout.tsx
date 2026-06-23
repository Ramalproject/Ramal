import { AppShell, ScrollArea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'

export default function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure()
  const { pathname } = useLocation()
  // Messages page manages its own internal scroll
  const selfScrolling = pathname.startsWith('/messages')

  return (
    <AppShell
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
      padding={0}
    >
      <AppShell.Navbar style={{ background: 'var(--nex-surface)', borderRight: '1px solid var(--nex-border)' }}>
        <Sidebar onMobileClose={() => toggleMobile()} />
      </AppShell.Navbar>
      <AppShell.Main style={{ background: 'var(--nex-bg)', height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {selfScrolling ? (
          <Outlet />
        ) : (
          <ScrollArea style={{ flex: 1 }} scrollbarSize={6} type="scroll">
            <Outlet />
          </ScrollArea>
        )}
      </AppShell.Main>
    </AppShell>
  )
}
