import { useEffect, useState } from 'react'

/**
 * Tracks the user's `prefers-reduced-motion` setting. Components driving
 * JS-based animation (parallax, count-ups, autoplay) must check this and
 * render the final state directly when it returns true. CSS animations are
 * already neutralised globally via the media query in index.css.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  return reduced
}
