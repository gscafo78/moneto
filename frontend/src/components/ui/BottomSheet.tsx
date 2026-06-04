import { useEffect } from 'react'
import type { ReactNode } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  /** Max height as Tailwind class, e.g. 'max-h-[90dvh]' */
  maxHeight?: string
}

export default function BottomSheet({ open, onClose, children, maxHeight = 'max-h-[92dvh]' }: Props) {
  // Blocca lo scroll del body quando il sheet è aperto
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${open ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        className={`fixed bottom-0 inset-x-0 z-50 max-w-2xl mx-auto bg-[#1a1a24] rounded-t-2xl safe-bottom shadow-2xl flex flex-col transition-transform duration-300 ease-out ${maxHeight} ${open ? 'translate-y-0' : 'translate-y-full'}`}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-white/20 rounded-full" />
        </div>
        {children}
      </div>
    </>
  )
}
