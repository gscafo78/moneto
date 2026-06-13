import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import TopBar from './TopBar'
import Sidebar from './Sidebar'

export default function Layout() {
  return (
    <div className="flex min-h-dvh bg-[#0f0f13]">
      <Sidebar />

      <div className="flex flex-col flex-1 min-w-0 md:h-dvh md:overflow-y-auto">
        <div className="flex flex-col max-w-2xl w-full mx-auto md:max-w-none md:px-8">
          <TopBar />
          <main className="flex-1 pb-24 md:pb-8">
            <Outlet />
          </main>
        </div>
      </div>

      <div className="fixed bottom-0 inset-x-0 max-w-2xl mx-auto safe-bottom z-50 md:hidden">
        <BottomNav />
      </div>
    </div>
  )
}
