import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/Button'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'

import slide1 from '@assets/generated_images/filipino_nurse_american_dream.png'
import slide2 from '@assets/generated_images/filipino_nurses_team_usa.png'
import slide3 from '@assets/generated_images/nclex_study_success.png'
import slide4 from '@assets/generated_images/filipino_family_ead_success.png'

interface SlideData {
  id: number
  image: string
  title: string
  highlight: string
  description: string
  ctaText: string
  ctaLink: string
  secondaryCta?: {
    text: string
    link: string
  }
}

const slides: SlideData[] = [
  {
    id: 1,
    image: slide1,
    title: 'Achieve Your',
    highlight: 'American Dream',
    description: 'Helping Filipino nurses navigate the path to becoming licensed healthcare professionals in the United States. Your journey to success starts here.',
    ctaText: 'Start Your NCLEX Journey',
    ctaLink: '/quote',
    secondaryCta: {
      text: 'Learn More',
      link: '/about-us'
    }
  },
  {
    id: 2,
    image: slide2,
    title: 'Join Thousands of',
    highlight: 'Successful Nurses',
    description: 'Be part of a growing community of Filipino healthcare heroes who have successfully obtained their US nursing licenses with GritSync.',
    ctaText: 'Get Your Free Quote',
    ctaLink: '/quote',
    secondaryCta: {
      text: 'View Success Stories',
      link: '/about-us'
    }
  },
  {
    id: 3,
    image: slide3,
    title: 'Expert NCLEX',
    highlight: 'Application Processing',
    description: 'From application submission to license approval, we handle the complex paperwork so you can focus on preparing for your bright future.',
    ctaText: 'Apply Now',
    ctaLink: '/register',
    secondaryCta: {
      text: 'Track Application',
      link: '/tracking'
    }
  },
  {
    id: 4,
    image: slide4,
    title: 'EAD Processing for',
    highlight: 'Your Family',
    description: 'Help your dependents work legally in the USA with our streamlined EAD application service. Keep your family together on your American journey.',
    ctaText: 'EAD Application',
    ctaLink: '/ead-application',
    secondaryCta: {
      text: 'Get a Quote',
      link: '/quote'
    }
  }
]

export function HeroSlider() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const nextSlide = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrentSlide((prev) => (prev + 1) % slides.length)
    setTimeout(() => setIsTransitioning(false), 700)
  }, [isTransitioning])

  const prevSlide = useCallback(() => {
    if (isTransitioning) return
    setIsTransitioning(true)
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
    setTimeout(() => setIsTransitioning(false), 700)
  }, [isTransitioning])

  const goToSlide = (index: number) => {
    if (isTransitioning || index === currentSlide) return
    setIsTransitioning(true)
    setCurrentSlide(index)
    setTimeout(() => setIsTransitioning(false), 700)
  }

  useEffect(() => {
    if (isPaused) return
    const interval = setInterval(nextSlide, 6000)
    return () => clearInterval(interval)
  }, [isPaused, nextSlide])

  const slide = slides[currentSlide]

  return (
    <section 
      className="relative h-[600px] md:h-[700px] overflow-hidden"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      {slides.map((s, index) => (
        <div
          key={s.id}
          className={`absolute inset-0 transition-opacity duration-700 ease-in-out ${
            index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/50 to-transparent z-10" />
          <img
            src={s.image}
            alt={s.title}
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
        </div>
      ))}

      <div className="relative z-20 h-full flex items-center">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl">
            <div 
              className={`transform transition-all duration-700 ${
                isTransitioning ? 'translate-y-8 opacity-0' : 'translate-y-0 opacity-100'
              }`}
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
                {slide.title}{' '}
                <span className="text-primary-400">{slide.highlight}</span>
              </h1>
              <p className="text-lg md:text-xl text-gray-200 mb-8 max-w-xl">
                {slide.description}
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to={slide.ctaLink}>
                  <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 bg-primary-600 hover:bg-primary-700">
                    {slide.ctaText}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                {slide.secondaryCta && (
                  <Link to={slide.secondaryCta.link}>
                    <Button 
                      variant="outline" 
                      size="lg" 
                      className="w-full sm:w-auto text-lg px-8 py-6 border-white text-white hover:bg-white/10"
                    >
                      {slide.secondaryCta.text}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={prevSlide}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all text-white"
        aria-label="Previous slide"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        onClick={nextSlide}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-30 p-3 rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-all text-white"
        aria-label="Next slide"
      >
        <ChevronRight className="h-6 w-6" />
      </button>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3">
        {slides.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-3 h-3 rounded-full transition-all ${
              index === currentSlide
                ? 'bg-primary-500 w-8'
                : 'bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20 z-30">
        <div 
          className="h-full bg-primary-500 transition-all duration-100"
          style={{ 
            width: isPaused ? `${((currentSlide + 1) / slides.length) * 100}%` : '100%',
            animation: isPaused ? 'none' : 'progress 6s linear infinite'
          }}
        />
      </div>

      <style>{`
        @keyframes progress {
          0% { width: 0%; }
          100% { width: 100%; }
        }
      `}</style>
    </section>
  )
}
