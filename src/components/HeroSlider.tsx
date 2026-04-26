import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'

const slides = [
  {
    id: 1,
    nurse: '/assets/nurses/nurse-female-1.png',
    nurseName: 'Maria Santos',
    nurseTitle: 'BSN, RN — California Licensed',
    badge: '⚡ NCLEX Made Simple',
    headline: 'Your Trusted Partner for',
    highlight: 'NCLEX Processing',
    sub: 'Simplify your journey to becoming a licensed nurse in the USA. Fast, secure, and reliable application processing with real-time tracking.',
    stat1: { value: '500+', label: 'Applications Processed' },
    stat2: { value: '98%', label: 'Success Rate' },
    quote: 'GritSync made the whole process stress-free. I got my ATT in record time!',
  },
  {
    id: 2,
    nurse: '/assets/nurses/nurse-female-2.png',
    nurseName: 'Ana Reyes',
    nurseTitle: 'BSN, RN — New York Licensed',
    badge: '🌟 Free Business Email Included',
    headline: 'Your Dedicated',
    highlight: '@gritsync.com Email',
    sub: 'Every account gets a professional business email for NCLEX correspondence — at no extra cost. Stand out and stay organized.',
    stat1: { value: 'Free', label: 'Business Email' },
    stat2: { value: '24/7', label: 'Support Available' },
    quote: 'Having a gritsync.com email made my applications look so professional!',
  },
  {
    id: 3,
    nurse: '/assets/nurses/nurse-male.png',
    nurseName: 'Carlo Mendoza',
    nurseTitle: 'BSN, RN — Texas Licensed',
    badge: '🚀 Start Today, Pass Tomorrow',
    headline: 'Real-Time Tracking for',
    highlight: 'Every Step Forward',
    sub: 'Monitor your application status live. Get instant notifications, document reminders, and expert guidance — all in one dashboard.',
    stat1: { value: '50%', label: 'Faster Processing' },
    stat2: { value: '5-Star', label: 'Client Experience' },
    quote: 'The tracking dashboard kept me informed every single day. Incredible!',
  },
]

function useCountUp(target: number, duration = 1800, started = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!started) return
    let startTime: number | null = null
    const step = (ts: number) => {
      if (!startTime) startTime = ts
      const p = Math.min((ts - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - p, 3)
      setCount(Math.floor(eased * target))
      if (p < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, target, duration])
  return count
}

export function HeroSlider() {
  const [current, setCurrent] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)
  const [isAnimating, setIsAnimating] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [statsStarted, setStatsStarted] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const goTo = useCallback(
    (idx: number) => {
      if (isAnimating || idx === current) return
      setPrev(current)
      setCurrent(idx)
      setIsAnimating(true)
      setTimeout(() => {
        setPrev(null)
        setIsAnimating(false)
      }, 700)
    },
    [current, isAnimating]
  )

  const next = useCallback(() => goTo((current + 1) % slides.length), [current, goTo])
  const prev_ = useCallback(() => goTo((current - 1 + slides.length) % slides.length), [current, goTo])

  useEffect(() => {
    autoRef.current = setTimeout(next, 5500)
    return () => { if (autoRef.current) clearTimeout(autoRef.current) }
  }, [current, next])

  // Mouse parallax (desktop only)
  useEffect(() => {
    if (isMobile) return
    const el = containerRef.current
    if (!el) return
    const handleMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2
      const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2
      setMousePos({ x, y })
    }
    el.addEventListener('mousemove', handleMove)
    return () => el.removeEventListener('mousemove', handleMove)
  }, [isMobile])

  // Touch swipe support
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null || touchStartY.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    const dy = e.changedTouches[0].clientY - touchStartY.current
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 40) {
      dx < 0 ? next() : prev_()
    }
    touchStartX.current = null
    touchStartY.current = null
  }

  useEffect(() => {
    const timer = setTimeout(() => setStatsStarted(true), 600)
    return () => clearTimeout(timer)
  }, [])

  const count500 = useCountUp(500, 1800, statsStarted)
  const count98 = useCountUp(98, 1600, statsStarted)
  const count50 = useCountUp(50, 1500, statsStarted)

  const getSlideStats = (idx: number) => {
    if (idx === 0) return [{ value: `${count500}+`, label: 'Applications Processed' }, { value: `${count98}%`, label: 'Success Rate' }]
    if (idx === 1) return [{ value: 'Free', label: 'Business Email' }, { value: '24/7', label: 'Support Available' }]
    return [{ value: `${count50}%`, label: 'Faster Processing' }, { value: '5-Star', label: 'Client Experience' }]
  }

  const slide = slides[current]
  const prevSlide = prev !== null ? slides[prev] : null
  const slideStats = getSlideStats(current)

  const parallaxChar = isMobile ? {} : { transform: `translate(${mousePos.x * -18}px, ${mousePos.y * -12}px)`, transition: 'transform 0.15s ease-out' }
  const parallaxText = isMobile ? {} : { transform: `translate(${mousePos.x * 8}px, ${mousePos.y * 5}px)`, transition: 'transform 0.2s ease-out' }
  const parallaxBg = isMobile ? {} : { transform: `translate(${mousePos.x * 4}px, ${mousePos.y * 3}px) scale(1.06)`, transition: 'transform 0.3s ease-out' }

  return (
    <>
      <style>{`
        @keyframes gsSlideInRight {
          from { opacity: 0; transform: translateX(60px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes gsSlideOutLeft {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(-60px); }
        }
        @keyframes gsSlideInUp {
          from { opacity: 0; transform: translateY(40px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes gsSlideOutDown {
          from { opacity: 1; transform: translateY(0); }
          to   { opacity: 0; transform: translateY(40px); }
        }
        @keyframes gsCharEnterUp {
          from { opacity: 0; transform: translateY(60px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes gsCharExitDown {
          from { opacity: 1; transform: translateY(0) scale(1); }
          to   { opacity: 0; transform: translateY(60px) scale(0.96); }
        }
        @keyframes gsFadeInUp {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes gsShimmer {
          from { transform: translateX(-100%); }
          to   { transform: translateX(100%); }
        }
        @keyframes gsBadgePop {
          0%   { opacity: 0; transform: scale(0.7); }
          70%  { transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes gsFloat {
          0%, 100% { transform: translateY(0px); }
          50%       { transform: translateY(-6px); }
        }
      `}</style>

      <section
        ref={containerRef}
        className="relative overflow-hidden select-none"
        style={{ background: '#0a1628', minHeight: isMobile ? '100svh' : '100vh' }}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Parallax background */}
        <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 0 }}>
          <div
            className="absolute"
            style={{
              inset: '-3%',
              ...parallaxBg,
              backgroundImage: `url('/assets/nurses/hero-bg.png')`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background: isMobile
                ? 'linear-gradient(180deg, rgba(10,22,40,0.92) 0%, rgba(10,22,40,0.75) 55%, rgba(10,22,40,0.92) 100%)'
                : 'linear-gradient(135deg, rgba(10,22,40,0.85) 0%, rgba(10,22,40,0.65) 50%, rgba(10,22,40,0.80) 100%)',
            }}
          />
          <div
            className="absolute"
            style={{
              left: '-10%', top: '20%', width: '40%', height: '60%',
              background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.15) 0%, transparent 70%)',
            }}
          />
        </div>

        {/* ===== MOBILE LAYOUT ===== */}
        {isMobile ? (
          <div className="relative flex flex-col" style={{ zIndex: 1, minHeight: '100svh' }}>

            {/* TOP: Text content */}
            <div className="flex-shrink-0 px-5 pt-6 pb-4" style={{ position: 'relative', zIndex: 2 }}>
              {prevSlide && (
                <div
                  key={`mob-prev-text-${prev}`}
                  className="absolute inset-x-5 top-6"
                  style={{ animation: 'gsSlideOutLeft 0.5s ease-in forwards', zIndex: 1 }}
                >
                  <MobileSlideText slide={prevSlide} />
                </div>
              )}
              <div
                key={`mob-curr-text-${current}`}
                style={{ animation: isAnimating ? 'gsSlideInRight 0.5s ease-out forwards' : 'none', position: 'relative', zIndex: 2 }}
              >
                <MobileSlideText slide={slide} />
              </div>
            </div>

            {/* BOTTOM: Nurse image with overlays */}
            <div className="relative flex-1" style={{ minHeight: '52vw' }}>
              {/* Nurse image */}
              {prevSlide && (
                <img
                  key={`mob-prev-${prev}`}
                  src={prevSlide.nurse}
                  alt={prevSlide.nurseName}
                  className="absolute bottom-0 left-1/2 h-full w-auto object-contain object-bottom"
                  style={{
                    transform: 'translateX(-50%)',
                    animation: 'gsCharExitDown 0.5s ease-in forwards',
                    filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.6))',
                  }}
                />
              )}
              <img
                key={`mob-curr-${current}`}
                src={slide.nurse}
                alt={slide.nurseName}
                className="absolute bottom-0 left-1/2 h-full w-auto object-contain object-bottom"
                style={{
                  transform: 'translateX(-50%)',
                  animation: isAnimating ? 'gsCharEnterUp 0.55s ease-out forwards' : 'none',
                  filter: 'drop-shadow(0 12px 40px rgba(0,0,0,0.6))',
                }}
              />

              {/* Glow under nurse */}
              <div
                className="absolute bottom-0 left-1/2"
                style={{
                  transform: 'translateX(-50%)',
                  width: '70%', height: '50px',
                  background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.3) 0%, transparent 70%)',
                  filter: 'blur(12px)',
                }}
              />

              {/* Quote bubble — top-left of image area */}
              <div
                className="absolute"
                style={{
                  top: '10%',
                  left: '4%',
                  maxWidth: '48%',
                  background: 'rgba(10,22,40,0.88)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '12px',
                  padding: '8px 12px',
                  backdropFilter: 'blur(8px)',
                  zIndex: 5,
                  animation: isAnimating ? 'gsBadgePop 0.5s 0.3s ease-out both' : 'gsFloat 5s ease-in-out infinite',
                }}
              >
                <span style={{ color: '#DC2626', fontSize: '1rem', lineHeight: 1 }}>"</span>
                <p className="text-xs italic leading-snug" style={{ color: 'rgba(255,255,255,0.8)', marginTop: '2px' }}>
                  {slide.quote}
                </p>
              </div>

              {/* Stat badge — left */}
              <div
                className="absolute"
                style={{
                  bottom: '38%',
                  left: '4%',
                  background: 'rgba(10,22,40,0.90)',
                  border: '1px solid rgba(220,38,38,0.45)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
                  animation: isAnimating ? 'gsBadgePop 0.5s 0.2s ease-out both' : 'gsFloat 4s ease-in-out infinite',
                  zIndex: 5,
                  minWidth: '90px',
                }}
              >
                <p className="text-lg font-black leading-none" style={{ color: '#DC2626' }}>{slideStats[0].value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{slideStats[0].label}</p>
              </div>

              {/* Stat badge — right */}
              <div
                className="absolute"
                style={{
                  bottom: '48%',
                  right: '4%',
                  background: 'rgba(10,22,40,0.90)',
                  border: '1px solid rgba(29,78,216,0.45)',
                  borderRadius: '10px',
                  padding: '8px 12px',
                  backdropFilter: 'blur(10px)',
                  boxShadow: '0 6px 24px rgba(0,0,0,0.4)',
                  animation: isAnimating ? 'gsBadgePop 0.5s 0.4s ease-out both' : 'gsFloat 4.5s 0.5s ease-in-out infinite',
                  zIndex: 5,
                  minWidth: '90px',
                }}
              >
                <p className="text-lg font-black leading-none" style={{ color: '#60a5fa' }}>{slideStats[1].value}</p>
                <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{slideStats[1].label}</p>
              </div>

              {/* Name card — bottom center */}
              <div
                className="absolute bottom-4 left-1/2"
                style={{
                  transform: 'translateX(-50%)',
                  background: 'rgba(10,22,40,0.92)',
                  border: '1px solid rgba(220,38,38,0.4)',
                  borderRadius: '10px',
                  padding: '8px 18px',
                  whiteSpace: 'nowrap',
                  backdropFilter: 'blur(8px)',
                  zIndex: 5,
                  animation: isAnimating ? 'gsFadeInUp 0.5s 0.4s ease-out both' : 'none',
                }}
              >
                <p className="text-white font-bold text-xs">{slide.nurseName}</p>
                <p className="text-xs font-medium" style={{ color: '#DC2626' }}>{slide.nurseTitle}</p>
              </div>
            </div>
          </div>
        ) : (
          /* ===== DESKTOP LAYOUT ===== */
          <div className="relative h-full flex items-center" style={{ zIndex: 1, minHeight: '100vh' }}>
            <div className="w-full max-w-7xl mx-auto px-6 lg:px-16 pr-20 lg:pr-28 flex items-center gap-8 lg:gap-16">
              {/* Left: Text */}
              <div className="flex-1 min-w-0 relative" style={{ zIndex: 2 }}>
                <div style={parallaxText}>
                  {prevSlide && (
                    <div
                      key={`prev-text-${prev}`}
                      className="absolute top-0 left-0 w-full"
                      style={{ animation: 'gsSlideOutLeft 0.6s ease-in-out forwards' }}
                    >
                      <SlideText slide={prevSlide} />
                    </div>
                  )}
                  <div
                    key={`curr-text-${current}`}
                    style={{ animation: isAnimating ? 'gsSlideInRight 0.6s ease-in-out forwards' : 'none' }}
                  >
                    <SlideText slide={slide} />
                  </div>
                </div>
              </div>

              {/* Right: Character */}
              <div
                className="relative flex-shrink-0"
                style={{
                  width: 'clamp(260px, 36vw, 500px)',
                  height: 'clamp(400px, 72vh, 680px)',
                  zIndex: 3,
                }}
              >
                <div className="w-full h-full relative" style={parallaxChar}>
                  {prevSlide && (
                    <img
                      key={`prev-char-${prev}`}
                      src={prevSlide.nurse}
                      alt={prevSlide.nurseName}
                      className="absolute inset-0 w-full h-full object-contain object-bottom"
                      style={{
                        animation: 'gsCharExitDown 0.55s ease-in forwards',
                        filter: 'drop-shadow(0 20px 60px rgba(0,0,0,0.6))',
                      }}
                    />
                  )}
                  <img
                    key={`curr-char-${current}`}
                    src={slide.nurse}
                    alt={slide.nurseName}
                    className="absolute inset-0 w-full h-full object-contain object-bottom"
                    style={{
                      animation: isAnimating ? 'gsCharEnterUp 0.65s ease-out forwards' : 'none',
                      filter: 'drop-shadow(0 20px 60px rgba(0,0,0,0.6))',
                    }}
                  />
                  {/* Glow */}
                  <div
                    className="absolute bottom-0 left-1/2"
                    style={{
                      transform: 'translateX(-50%)',
                      width: '80%', height: '60px',
                      background: 'radial-gradient(ellipse at center, rgba(220,38,38,0.35) 0%, transparent 70%)',
                      filter: 'blur(12px)',
                    }}
                  />
                  {/* Stat badges */}
                  <StatBadge
                    value={slideStats[0].value}
                    label={slideStats[0].label}
                    style={{ top: '12%', left: '-20%', animationDelay: '0.3s' }}
                    accentColor="#DC2626"
                    isAnimating={isAnimating}
                  />
                  <StatBadge
                    value={slideStats[1].value}
                    label={slideStats[1].label}
                    style={{ top: '38%', right: '-18%', animationDelay: '0.5s' }}
                    accentColor="#1d4ed8"
                    isAnimating={isAnimating}
                  />
                  {/* Name card */}
                  <div
                    className="absolute bottom-4 left-1/2"
                    style={{
                      transform: 'translateX(-50%)',
                      background: 'rgba(10,22,40,0.90)',
                      border: '1px solid rgba(220,38,38,0.4)',
                      borderRadius: '12px',
                      padding: '10px 20px',
                      whiteSpace: 'nowrap',
                      backdropFilter: 'blur(8px)',
                      animation: isAnimating ? 'gsFadeInUp 0.5s 0.4s ease-out both' : 'none',
                    }}
                  >
                    <p className="text-white font-bold text-sm">{slide.nurseName}</p>
                    <p className="text-sm font-medium" style={{ color: '#DC2626' }}>{slide.nurseTitle}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Dots — always visible */}
        <div
          className="absolute flex gap-3"
          style={{
            bottom: isMobile ? '16px' : '32px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 10,
          }}
        >
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => goTo(i)}
              aria-label={`Go to slide ${i + 1}`}
              className="relative overflow-hidden"
              style={{
                width: i === current ? '36px' : '10px',
                height: '10px',
                borderRadius: '5px',
                background: i === current ? '#DC2626' : 'rgba(255,255,255,0.3)',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.4s ease',
                padding: 0,
              }}
            >
              {i === current && (
                <div
                  style={{
                    position: 'absolute', left: 0, top: 0,
                    height: '100%', width: '100%',
                    background: 'linear-gradient(90deg, rgba(255,255,255,0.4), transparent)',
                    animation: 'gsShimmer 5.5s linear',
                  }}
                />
              )}
            </button>
          ))}
        </div>

        {/* Arrows — hidden on small mobile, visible on md+ */}
        {!isMobile && (
          <>
            <NavArrow direction="left" onClick={prev_} />
            <NavArrow direction="right" onClick={next} />
          </>
        )}
      </section>
    </>
  )
}

// Desktop slide text
function SlideText({ slide }: { slide: (typeof slides)[0] }) {
  return (
    <div className="space-y-5">
      <div
        className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold"
        style={{
          background: 'rgba(220,38,38,0.15)',
          border: '1px solid rgba(220,38,38,0.35)',
          color: '#fca5a5',
        }}
      >
        {slide.badge}
      </div>

      <h1
        className="font-black leading-tight"
        style={{ fontSize: 'clamp(2rem, 4.5vw, 3.5rem)', color: 'white', lineHeight: 1.1 }}
      >
        {slide.headline}{' '}
        <span style={{ color: '#DC2626' }}>{slide.highlight}</span>
      </h1>

      <p className="max-w-lg leading-relaxed" style={{ color: 'rgba(255,255,255,0.7)', fontSize: '1rem' }}>
        {slide.sub}
      </p>

      <div
        className="flex items-start gap-3 p-4 rounded-xl max-w-md"
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.10)',
          backdropFilter: 'blur(4px)',
        }}
      >
        <span style={{ color: '#DC2626', fontSize: '1.5rem', lineHeight: 1 }}>"</span>
        <p className="text-sm italic" style={{ color: 'rgba(255,255,255,0.75)' }}>{slide.quote}</p>
      </div>

      <div className="flex flex-wrap gap-3 pt-1">
        <Link to="/register">
          <button
            className="px-7 py-3 rounded-lg font-bold text-white transition-all"
            style={{ background: '#DC2626', boxShadow: '0 4px 24px rgba(220,38,38,0.4)' }}
            onMouseEnter={e => ((e.target as HTMLButtonElement).style.background = '#b91c1c')}
            onMouseLeave={e => ((e.target as HTMLButtonElement).style.background = '#DC2626')}
          >
            Apply Now →
          </button>
        </Link>
        <Link to="/quote">
          <button
            className="px-7 py-3 rounded-lg font-semibold transition-all"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
            onMouseEnter={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.15)' }}
            onMouseLeave={e => { (e.target as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)' }}
          >
            Get a Quote
          </button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-4">
        {['✓ No hidden fees', '✓ Free @gritsync.com email', '✓ 24/7 support'].map(t => (
          <span key={t} className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.5)' }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

// Mobile-optimised slide text (compact)
function MobileSlideText({ slide }: { slide: (typeof slides)[0] }) {
  return (
    <div className="space-y-3">
      <div
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold"
        style={{
          background: 'rgba(220,38,38,0.15)',
          border: '1px solid rgba(220,38,38,0.35)',
          color: '#fca5a5',
        }}
      >
        {slide.badge}
      </div>

      <h1
        className="font-black leading-tight"
        style={{ fontSize: 'clamp(1.6rem, 7vw, 2.4rem)', color: 'white', lineHeight: 1.15 }}
      >
        {slide.headline}{' '}
        <span style={{ color: '#DC2626' }}>{slide.highlight}</span>
      </h1>

      <p className="leading-relaxed text-sm" style={{ color: 'rgba(255,255,255,0.7)' }}>
        {slide.sub}
      </p>

      <div className="flex gap-3 pt-1">
        <Link to="/register" className="flex-1">
          <button
            className="w-full py-3 rounded-lg font-bold text-white text-sm"
            style={{ background: '#DC2626', boxShadow: '0 4px 16px rgba(220,38,38,0.35)' }}
          >
            Apply Now →
          </button>
        </Link>
        <Link to="/quote" className="flex-1">
          <button
            className="w-full py-3 rounded-lg font-semibold text-sm"
            style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.2)', color: 'white' }}
          >
            Get a Quote
          </button>
        </Link>
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {['✓ No hidden fees', '✓ Free @gritsync.com email', '✓ 24/7 support'].map(t => (
          <span key={t} className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.45)' }}>{t}</span>
        ))}
      </div>
    </div>
  )
}

function StatBadge({
  value, label, style, accentColor, isAnimating,
}: {
  value: string; label: string; style: React.CSSProperties; accentColor: string; isAnimating: boolean
}) {
  return (
    <div
      className="absolute"
      style={{
        ...style,
        background: 'rgba(10,22,40,0.88)',
        border: `1px solid ${accentColor}44`,
        borderRadius: '12px',
        padding: '10px 16px',
        backdropFilter: 'blur(10px)',
        boxShadow: `0 8px 30px rgba(0,0,0,0.4), 0 0 0 1px ${accentColor}22`,
        animation: isAnimating ? 'gsBadgePop 0.5s ease-out forwards' : 'gsFloat 4s ease-in-out infinite',
        minWidth: '110px',
        zIndex: 5,
      }}
    >
      <p className="text-xl font-black" style={{ color: accentColor, lineHeight: 1 }}>{value}</p>
      <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</p>
    </div>
  )
}

function NavArrow({ direction, onClick }: { direction: 'left' | 'right'; onClick: () => void }) {
  const isLeft = direction === 'left'
  return (
    <button
      onClick={onClick}
      aria-label={isLeft ? 'Previous slide' : 'Next slide'}
      className="absolute top-1/2"
      style={{
        transform: 'translateY(-50%)',
        [isLeft ? 'left' : 'right']: '16px',
        zIndex: 10,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        borderRadius: '50%',
        width: '44px',
        height: '44px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: 'white',
        fontSize: '20px',
        backdropFilter: 'blur(8px)',
        transition: 'background 0.2s',
      }}
      onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(220,38,38,0.35)')}
      onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.08)')}
    >
      {isLeft ? '‹' : '›'}
    </button>
  )
}
