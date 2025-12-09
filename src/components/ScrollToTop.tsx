import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * ScrollToTop component that scrolls to the top of the page
 * whenever the route changes
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation()

  useEffect(() => {
    // If there's a hash, scroll to the element after a short delay
    if (hash) {
      const element = document.getElementById(hash.replace('#', ''))
      if (element) {
        // Small delay to ensure the page has rendered
        setTimeout(() => {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 100)
        return
      }
    }

    // Otherwise, scroll to top immediately
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant' // Use 'instant' for immediate scroll, 'smooth' for animated
    })
  }, [pathname, hash])

  return null
}

