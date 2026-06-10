import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Zap, Star, Rocket, ChevronLeft, ChevronRight, Play, Pause, ArrowRight } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useReducedMotion } from '@/hooks/useReducedMotion'

const slides = [
  {
    id: 1,
    nurse: '/assets/nurses/nurse-female-1.png',
    nurseName: 'Maria Santos',
    nurseTitle: 'BSN, RN — California Licensed',
    badgeIcon: Zap,
    badge: 'NCLEX Made Simple',
    headline: 'Your Trusted Partner for',
    highlight: 'NCLEX Processing',
    sub: 'Simplify your journey to becoming a licensed nurse in the USA. Fast, secure, and reliable application processing with real-time tracking.',
    quote: 'GritSync made the whole process stress-free. I got my ATT in record time!',
  },
  {
    id: 2,
    nurse: '/assets/nurses/nurse-female-2.png',
    nurseName: 'Ana Reyes',
    nurseTitle: 'BSN, RN — New York Licensed',
    badgeIcon: Star,
    badge: 'Free Business Email Included',
    headline: 'Your Dedicated',
    highlight: '@gritsync.com Email',
    sub: 'Every account gets a professional business email for NCLEX correspondence — at no extra cost. Stand out and stay organized.',
    quote: 'Having a gritsync.com email made my applications look so professional!',
  },
  {
    id: 3,
    nurse: '/assets/nurses/nurse-male.png',
    nurseName: 'Carlo Mendoza',
    nurseTitle: 'BSN, RN — Texas Licensed',
    badgeIcon: Rocket,
    badge: 'Start Today, Pass Tomorrow',
    headline: 'Real-Time Tracking for',
    highlight: 'Every Step Forward',
    sub: 'Monitor your application status live. Get instant notifications, document reminders, and expert guidance — all in one dashboard.',
    quote: 'The tracking dashboard kept me informed every single day. Incredible!',
  },
]

const AUTOPLAY_MS = 5500
const SWAP_MS = 600

export function HeroSlider() {
  const reducedMotion = useReducedMotion()
  const [current, setCurrent] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [userPaused, setUserPaused] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focusWithin, setFocusWithin] = useState(false)
  const [docHidden, setDocHidden] = useState(() =>
    typeof document !== 'undefined' ? document.hidden : false
  )
  const containerRef = useRef<HTMLElement>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  const goTo = useCallback(
    (idx: number) => {
      if (idx === current) return
      if (reducedMotion) {
        // Instant swap: no prev overlay, the new slide fades in ≤0.1s via CSS.
        setPrev(null)
        setIsAnimating(false)
        setCurrent(idx)
        return
      }
      if (isAnimating) return
      setPrev(current)
      setCurrent(idx)
      setIsAnimating(true)
      setTimeout(() => {
        setPrev(null)
        setIsAnimating(false)
      }, SWAP_MS)
    },
    [current, isAnimating, reducedMotion]
  )

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, goTo])
  const prev_ = useCallback(() => goTo((current - 1 + slides.length) % slides.length), [current, goTo])

  // Autoplay — paused on hover, focus-within, hidden tab, user toggle, reduced motion.
  const autoplayActive = !reducedMotion && !userPaused && !hovered && !focusWithin && !docHidden
  useEffect(() => {
    if (!autoplayActive) return
    const t = setTimeout(next, AUTOPLAY_MS)
    return () => clearTimeout(t)
  }, [current, autoplayActive, next])

  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // Preload all nurse images so slide swaps never flash.
  useEffect(() => {
    const links = slides.map(s => {
      const l = document.createElement('link')
      l.rel = 'preload'
      l.as = 'image'
      l.href = s.nurse
      document.head.appendChild(l)
      return l
    })
    return () => links.forEach(l => l.remove())
  }, [])

  // Mouse parallax — desktop fine-pointer only, no React re-renders: the
  // mousemove handler batches into rAF and writes CSS variables on the
  // section; children consume them via calc() in their transforms.
  useEffect(() => {
    const el = containerRef.current
    if (!el || reducedMotion) return
    const mq = window.matchMedia('(min-width: 768px) and (pointer: fine)')
    let frame = 0
    let lastX = 0
    let lastY = 0
    const onMove = (e: MouseEvent) => {
      lastX = e.clientX
      lastY = e.clientY
      if (frame) return
      frame = requestAnimationFrame(() => {
        frame = 0
        const r = el.getBoundingClientRect()
        el.style.setProperty('--mx', String(((lastX - r.left) / r.width - 0.5) * 2))
        el.style.setProperty('--my', String(((lastY - r.top) / r.height - 0.5) * 2))
      })
    }
    const detach = () => {
      el.removeEventListener('mousemove', onMove)
      if (frame) cancelAnimationFrame(frame)
      frame = 0
      el.style.removeProperty('--mx')
      el.style.removeProperty('--my')
    }
    const sync = () => (mq.matches ? el.addEventListener('mousemove', onMove) : detach())
    sync()
    mq.addEventListener('change', sync)
    return () => {
      mq.removeEventListener('change', sync)
      detach()
    }
  }, [reducedMotion])

  // Touch swipe support.
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      if (dx < 0) next()
      else prev_()
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      prev_()
    } else if (e.key === 'ArrowRight') {
      e.preventDefault()
      next()
    }
  }

  const handleBlur = (e: React.FocusEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFocusWithin(false)
  }

  const slide = slides[current]
  const prevSlide = prev !== null ? slides[prev] : null

  return (
    <>
      {/* Slide-swap keyframes scoped to this component. Global
          prefers-reduced-motion CSS in index.css collapses these to ~0s;
          the reducedMotion branch additionally skips them entirely. */}
      <style>{`
        @keyframes gsHeroCharIn {
          from { opacity: 0; transform: translateY(48px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gsHeroCharOut {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(48px) scale(0.97); }
        }
        @keyframes gsHeroInstant {
          from { opacity: 0; }
          to   { opacity: 1; }
        }
      `}</style>

      <section
        ref={containerRef}
        aria-roledescription="carousel"
        aria-label="GritSync highlights"
        tabIndex={0}
        className="relative flex min-h-[100svh] select-none flex-col overflow-hidden bg-gray-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onKeyDown={handleKeyDown}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocusWithin(true)}
        onBlur={handleBlur}
      >
        {/* Background: image + brand-dark scrim + red glow, subtle parallax via CSS vars */}
        <div aria-hidden="true" className="absolute inset-0 z-0 overflow-hidden">
          <div
            className="absolute -inset-[3%] bg-cover bg-center transition-transform duration-300 ease-out"
            style={{
              backgroundImage: "url('/assets/nurses/hero-bg.png')",
              transform:
                'translate(calc(var(--mx, 0) * 4px), calc(var(--my, 0) * 3px)) scale(1.06)',
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-gray-950/95 via-gray-950/75 to-gray-950/95 md:bg-gradient-to-br md:from-gray-950/90 md:via-gray-950/65 md:to-gray-950/85" />
          <div className="absolute -left-[10%] top-[20%] h-3/5 w-2/5 rounded-full bg-primary-600/15 blur-3xl" />
        </div>

        {/* Single responsive slide layout */}
        <div
          role="group"
          aria-roledescription="slide"
          aria-label={`${current + 1} of ${slides.length}`}
          aria-live={autoplayActive ? 'off' : 'polite'}
          className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center gap-6 px-5 pb-24 pt-10 md:flex-row md:gap-12 md:px-8 md:py-24 lg:px-16"
        >
          {/* Text column — re-keyed per slide so the stagger replays */}
          <div
            className="w-full min-w-0 flex-1 transition-transform duration-200 ease-out"
            style={{
              transform: 'translate(calc(var(--mx, 0) * 8px), calc(var(--my, 0) * 5px))',
            }}
          >
            <div
              key={`text-${current}`}
              className="anim-stagger space-y-4 md:space-y-5"
              style={reducedMotion ? { animation: 'gsHeroInstant 0.1s ease-out both' } : undefined}
            >
              <div className="anim-fade-up inline-flex items-center gap-2 rounded-full border border-primary-600/35 bg-primary-600/15 px-3 py-1.5 text-xs font-semibold text-primary-300 md:px-4 md:py-2 md:text-sm">
                <slide.badgeIcon aria-hidden="true" className="h-3.5 w-3.5 md:h-4 md:w-4" />
                {slide.badge}
              </div>

              <h1 className="anim-fade-up text-3xl font-black leading-[1.12] text-white md:text-5xl lg:text-[3.5rem]">
                {slide.headline} <span className="text-primary-500">{slide.highlight}</span>
              </h1>

              <p className="anim-fade-up max-w-lg text-sm leading-relaxed text-white/70 md:text-base">
                {slide.sub}
              </p>

              {/* Quote bubble — human credibility, kept on purpose */}
              <figure className="anim-fade-up flex max-w-md items-start gap-3 rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
                <span aria-hidden="true" className="text-2xl leading-none text-primary-500">
                  &ldquo;
                </span>
                <blockquote className="text-sm italic text-white/75">{slide.quote}</blockquote>
              </figure>

              <div className="anim-fade-up flex flex-wrap gap-3 pt-1">
                <Link to="/register" className="flex-1 sm:flex-none">
                  <Button
                    size="lg"
                    className="w-full font-bold shadow-lg shadow-primary-600/40 sm:w-auto"
                  >
                    Apply Now
                    <ArrowRight aria-hidden="true" className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/quote" className="flex-1 sm:flex-none">
                  <Button
                    size="lg"
                    variant="ghost"
                    className="w-full border border-white/20 bg-white/10 font-semibold text-white hover:bg-white/20 dark:hover:bg-white/20 sm:w-auto"
                  >
                    Get a Quote
                  </Button>
                </Link>
              </div>

              <div className="anim-fade-up flex flex-wrap gap-x-4 gap-y-1">
                {['No hidden fees', 'Free @gritsync.com email', '24/7 support'].map(t => (
                  <span key={t} className="text-xs font-medium text-white/50">
                    <span aria-hidden="true" className="mr-1 text-primary-400">
                      ✓
                    </span>
                    {t}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Image column — fixed box reserves space (CLS-free) */}
          <div className="relative mx-auto h-[min(88vw,420px)] w-full max-w-[340px] shrink-0 md:mx-0 md:h-[clamp(400px,72vh,680px)] md:w-[clamp(260px,36vw,460px)] md:max-w-none">
            <div
              className="relative h-full w-full transition-transform duration-200 ease-out"
              style={{
                transform: 'translate(calc(var(--mx, 0) * -14px), calc(var(--my, 0) * -10px))',
              }}
            >
              {prevSlide && (
                <img
                  key={`prev-char-${prev}`}
                  src={prevSlide.nurse}
                  alt=""
                  aria-hidden="true"
                  className="absolute inset-0 h-full w-full object-contain object-bottom drop-shadow-2xl"
                  style={{ animation: `gsHeroCharOut 0.5s ease-in forwards` }}
                />
              )}
              <img
                key={`curr-char-${current}`}
                src={slide.nurse}
                alt={`${slide.nurseName}, ${slide.nurseTitle}`}
                width={460}
                height={680}
                className="absolute inset-0 h-full w-full object-contain object-bottom drop-shadow-2xl"
                style={
                  isAnimating
                    ? { animation: 'gsHeroCharIn 0.6s ease-out forwards' }
                    : reducedMotion
                      ? { animation: 'gsHeroInstant 0.1s ease-out both' }
                      : undefined
                }
              />
              {/* Glow under nurse */}
              <div
                aria-hidden="true"
                className="absolute bottom-0 left-1/2 h-12 w-3/4 -translate-x-1/2 rounded-full bg-primary-600/30 blur-xl"
              />
              {/* Name card — kept on purpose */}
              <div className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-xl border border-primary-600/40 bg-gray-950/90 px-5 py-2 text-center backdrop-blur-sm">
                <p className="text-xs font-bold text-white md:text-sm">{slide.nurseName}</p>
                <p className="text-xs font-medium text-primary-400 md:text-sm">{slide.nurseTitle}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Controls: dots + play/pause */}
        <div className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 md:bottom-8">
          <div role="tablist" aria-label="Choose slide" className="flex items-center gap-3">
            {slides.map((s, i) => (
              <button
                key={s.id}
                role="tab"
                aria-selected={i === current}
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}`}
                className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950 ${
                  i === current ? 'w-9 bg-primary-600' : 'w-2.5 bg-white/30 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
          {!reducedMotion && (
            <button
              onClick={() => setUserPaused(p => !p)}
              aria-label={userPaused ? 'Play slideshow' : 'Pause slideshow'}
              aria-pressed={userPaused}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-950"
            >
              {userPaused ? (
                <Play aria-hidden="true" className="ml-0.5 h-3.5 w-3.5" />
              ) : (
                <Pause aria-hidden="true" className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>

        {/* Arrows — md+ only */}
        <button
          onClick={prev_}
          aria-label="Previous slide"
          className="absolute left-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-primary-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 md:flex"
        >
          <ChevronLeft aria-hidden="true" className="h-5 w-5" />
        </button>
        <button
          onClick={next}
          aria-label="Next slide"
          className="absolute right-4 top-1/2 z-20 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-primary-600/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 md:flex"
        >
          <ChevronRight aria-hidden="true" className="h-5 w-5" />
        </button>
      </section>
    </>
  )
}
