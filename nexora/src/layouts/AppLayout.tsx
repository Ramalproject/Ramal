import { AppShell, ScrollArea } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '../components/layout/Sidebar'
import Header from '../components/layout/Header'

export default function AppLayout() {
  const [mobileOpened, { toggle: toggleMobile }] = useDisclosure()
  const { pathname } = useLocation()
  const selfScrolling = pathname.startsWith('/messages')

  return (
    <AppShell
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !mobileOpened } }}
      header={{ height: 56 }}
      padding={0}
    >
      <AppShell.Header style={{ background: 'var(--nex-surface)', borderBottom: '1px solid var(--nex-border)', zIndex: 200 }}>
        <Header />
      </AppShell.Header>
      <AppShell.Navbar style={{ background: 'var(--nex-surface)', borderRight: '1px solid var(--nex-border)', top: 56 }}>
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
