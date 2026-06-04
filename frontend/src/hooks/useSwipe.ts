import { useRef } from 'react'

interface SwipeOptions {
  onSwipeLeft?:  () => void
  onSwipeRight?: () => void
  threshold?: number   // min horizontal px to trigger
}

/**
 * Returns touch handlers to attach to a container element.
 * Triggers only for predominantly horizontal swipes.
 */
export function useSwipe({ onSwipeLeft, onSwipeRight, threshold = 60 }: SwipeOptions) {
  const startX = useRef(0)
  const startY = useRef(0)

  return {
    onTouchStart(e: React.TouchEvent) {
      startX.current = e.touches[0].clientX
      startY.current = e.touches[0].clientY
    },
    onTouchEnd(e: React.TouchEvent) {
      const dx = e.changedTouches[0].clientX - startX.current
      const dy = Math.abs(e.changedTouches[0].clientY - startY.current)
      if (Math.abs(dx) < threshold || dy > Math.abs(dx)) return
      if (dx < 0) onSwipeLeft?.()
      else         onSwipeRight?.()
    },
  }
}
