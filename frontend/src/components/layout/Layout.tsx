import { Outlet } from 'react-router-dom'
import BottomNav from './BottomNav'
import TopBar from './TopBar'

export default function Layout() {
  return (
    <div className="flex flex-col h-dvh bg-[#0f0f13] max-w-2xl mx-auto relative">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <Outlet />
      </main>
      <div className="fixed bottom-0 inset-x-0 max-w-2xl mx-auto safe-bottom z-50">
        <BottomNav />
      </div>
    </div>
  )
}
