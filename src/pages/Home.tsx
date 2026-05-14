import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { SEO, generateOrganizationSchema, generateWebSiteSchema, generateFAQSchema, generateHowToSchema, generateLocalBusinessSchema } from '@/components/SEO'
import { HeroSlider } from '@/components/HeroSlider'
import { 
  FileText, 
  DollarSign, 
  ClipboardList, 
  Shield, 
  CheckCircle, 
  Clock, 
  Users,
  ArrowRight,
  Star,
  Mail,
  Send,
  AtSign,
  Zap,
  BarChart3,
  Bell,
  Upload,
  TrendingUp,
  Globe,
  HeartHandshake,
  ChevronRight,
  Play
} from 'lucide-react'

function useCountUp(target: number, duration: number = 1800, started: boolean = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!started) return
    let startTime: number | null = null
    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      setCount(Math.floor(eased * target))
      if (progress < 1) requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  }, [started, target, duration])
  return count
}

function useInView(ref: React.RefObject<Element>, threshold = 0.2) {
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect() } }, { threshold })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])
  return inView
}

const timelineSteps = [
  { step: 1, title: 'Application Submission', desc: 'Upload documents & pay initial fee', icon: '📋', color: '#ef4444' },
  { step: 2, title: 'Credentialing', desc: 'Foreign education evaluation', icon: '🎓', color: '#f97316' },
  { step: 3, title: 'BON Application', desc: 'Board of Nursing review', icon: '🏛️', color: '#eab308' },
  { step: 4, title: 'NCLEX Eligibility', desc: 'Approval to test granted', icon: '✅', color: '#22c55e' },
  { step: 5, title: 'Pearson Vue', desc: 'Register & schedule exam', icon: '📅', color: '#06b6d4' },
  { step: 6, title: 'ATT Received', desc: 'Authorization to Test issued', icon: '🎫', color: '#3b82f6' },
  { step: 7, title: 'NCLEX Exam', desc: 'Take the licensure exam', icon: '📝', color: '#6366f1' },
  { step: 8, title: 'Results', desc: 'Quick results in 72 hours', icon: '🏆', color: '#8b5cf6' },
]

const testimonials = [
  {
    name: 'Cheryl Piseo',
    title: 'USRN — California',
    quote: 'GritSync made my NCLEX journey stress-free. The real-time tracking kept me informed every step. I passed first try!',
    stars: 5,
    initials: 'CP'
  },
  {
    name: 'Maria Santos',
    title: 'BSN, RN — New York',
    quote: 'From document submission to getting my ATT, GritSync handled everything. Their support team is incredibly responsive.',
    stars: 5,
    initials: 'MS'
  },
  {
    name: 'Carlo Mendoza',
    title: 'USRN — Texas',
    quote: 'The platform is intuitive and the timeline feature helped me understand exactly where I was in the process.',
    stars: 5,
    initials: 'CM'
  },
]

export function Home() {
  const location = useLocation()
  const { showToast } = useToast()
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [statsStarted, setStatsStarted] = useState(false)
  const statsRef = useRef<HTMLDivElement>(null)
  const timelineRef = useRef<HTMLDivElement>(null)
  const dashboardRef = useRef<HTMLDivElement>(null)
  const timelineInView = useInView(timelineRef)
  const dashboardInView = useInView(dashboardRef)
  const count500 = useCountUp(500, 1800, statsStarted)
  const count98 = useCountUp(98, 1600, statsStarted)
  const count50 = useCountUp(50, 1500, statsStarted)

  useEffect(() => {
    if (location.hash) {
      const hash = location.hash.substring(1)
      setTimeout(() => {
        const element = document.getElementById(hash)
        if (element) element.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [location.hash])

  useEffect(() => {
    const el = statsRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setStatsStarted(true); observer.disconnect() } },
      { threshold: 0.3 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      showToast('Please fill in all fields', 'error')
      return
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      showToast('Please enter a valid email address', 'error')
      return
    }
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        showToast('Thank you! Your message has been sent successfully.', 'success')
        setFormData({ name: '', email: '', subject: '', message: '' })
      } else {
        showToast(data.error || 'Failed to send message. Please try again or contact us directly.', 'error')
      }
    } catch {
      showToast('An error occurred. Please try again later.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  const faqData = [
    { question: 'What is NCLEX and why do I need GritSync?', answer: 'NCLEX (National Council Licensure Examination) is the exam required to become a licensed nurse in the United States. GritSync simplifies the complex application process, helping you submit accurate applications, track progress, and manage documents efficiently.' },
    { question: 'How long does the NCLEX application process take?', answer: 'The processing time varies, but with GritSync\'s streamlined workflow, you can reduce processing time by up to 50%. Our platform ensures all documents are complete and accurate before submission, preventing delays.' },
    { question: 'Is my personal information secure?', answer: 'Yes, GritSync uses enterprise-grade security measures to protect your sensitive information. We are fully compliant with healthcare data regulations and employ encryption, secure storage, and regular security audits.' },
    { question: 'What services does GritSync provide?', answer: 'GritSync provides comprehensive NCLEX application processing services including application submission, document management, real-time tracking, quotation generation, payment processing, and 24/7 expert support.' },
    { question: 'Do I need a credit card to get started?', answer: 'No credit card is required to create an account. You can explore our platform, get quotes, and track applications without any upfront payment. Payment is only required when you\'re ready to process your application.' },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="GritSync | NCLEX Processing for Filipino Nurses — US Nursing Licensure Made Simple"
        description="GritSync is the trusted NCLEX application processing agency for Filipino nurses. We handle NYSED submissions, BON applications, Pearson VUE registration, and ATT acquisition — so you can focus on passing the exam."
        keywords="NCLEX processing Philippines, Filipino nurse USA, NCLEX application Philippines, NCLEX processing agency, Filipino nurses US nursing license, NCLEX Philippines to USA, nursing licensure USA, PRC to US nursing license, NCLEX ATT Philippines, NYSED nursing application, BON application nurses, Pearson VUE registration nurses, USRN processing, Philippine nurses NCLEX, NCLEX sponsorship Philippines"
        canonicalUrl={currentUrl}
        ogTitle="GritSync | NCLEX Processing for Filipino Nurses — US Nursing Licensure Made Simple"
        ogDescription="GritSync is the trusted NCLEX application processing agency for Filipino nurses. We handle NYSED submissions, BON applications, Pearson VUE registration, and ATT acquisition — so you can focus on passing the exam."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        twitterTitle="GritSync | NCLEX Processing for Filipino Nurses"
        twitterDescription="Trusted NCLEX application processing agency for Filipino nurses. NYSED, BON, Pearson VUE, and ATT — fully handled for you."
        twitterImage={`${baseUrl}/gritsync_logo.png`}
        structuredData={[
          generateOrganizationSchema(),
          generateWebSiteSchema(),
          generateLocalBusinessSchema(),
          generateHowToSchema(),
          generateFAQSchema(faqData),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            '@id': 'https://gritsync.com/#nclex-processing-service',
            name: 'NCLEX Application Processing for Filipino Nurses',
            serviceType: 'NCLEX Application Processing',
            description: 'End-to-end NCLEX application processing for Filipino nurses — document collection, NYSED submission, BON application, Pearson VUE registration, and ATT acquisition.',
            provider: { '@id': 'https://gritsync.com/#organization' },
            areaServed: [
              { '@type': 'Country', name: 'United States' },
              { '@type': 'Country', name: 'Philippines' },
            ],
            audience: {
              '@type': 'Audience',
              audienceType: 'Filipino nurses and internationally educated nurses seeking US nursing licensure',
            },
            offers: {
              '@type': 'Offer',
              description: 'NCLEX application processing with real-time tracking, expert support, and NCLEX sponsorship available',
              url: 'https://gritsync.com/quote',
            },
          },
        ]}
      />
      <Header />
      
      {/* Hero Slider */}
      <HeroSlider />

      {/* Quick Stats Bar */}
      <div ref={statsRef} className="bg-gray-900 dark:bg-black border-b border-gray-800">
        <div className="container mx-auto px-4 py-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            {[
              { val: `${count500}+`, label: 'Applications Processed', icon: FileText },
              { val: `${count98}%`, label: 'Success Rate', icon: TrendingUp },
              { val: '24/7', label: 'Expert Support', icon: HeartHandshake },
              { val: `${count50}%`, label: 'Faster Processing', icon: Zap },
            ].map(({ val, label, icon: Icon }) => (
              <div key={label} className="flex items-center justify-center gap-3">
                <div className="hidden md:flex w-10 h-10 rounded-lg bg-primary-600/20 items-center justify-center flex-shrink-0">
                  <Icon className="h-5 w-5 text-primary-400" />
                </div>
                <div className="text-left">
                  <div className="text-2xl font-bold text-white tabular-nums">{val}</div>
                  <div className="text-xs text-gray-400">{label}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white dark:bg-gray-900 scroll-mt-16 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
              <Zap className="h-4 w-4" />
              <span>Platform Features</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              Comprehensive tools built specifically for Filipino nurses navigating the NCLEX journey
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6 mb-6">
            {[
              {
                icon: FileText, color: 'from-primary-500 to-red-600',
                title: 'Application Processing',
                desc: 'Step-by-step guided application flow with automated validation. All required documents collected and verified in one place.',
                badge: null
              },
              {
                icon: DollarSign, color: 'from-blue-500 to-blue-700',
                title: 'Instant Quotations',
                desc: 'Get transparent, itemized quotes instantly. No hidden fees — clear pricing for staggered or full payment options.',
                badge: null
              },
              {
                icon: ClipboardList, color: 'from-green-500 to-emerald-700',
                title: 'Real-Time Tracking',
                desc: 'Monitor every step of your application. Get notifications when your status changes — from submission to ATT.',
                badge: null
              },
            ].map(({ icon: Icon, color, title, desc, badge }) => (
              <div key={title} className="group relative p-8 rounded-2xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>
                {badge && <span className="absolute top-6 right-6 px-2.5 py-1 rounded-full text-xs font-bold bg-primary-600 text-white uppercase">{badge}</span>}
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                icon: Shield, color: 'from-purple-500 to-purple-700',
                title: 'Secure & Compliant',
                desc: 'Enterprise-grade security protecting your sensitive documents and personal information. Fully compliant with healthcare data regulations.',
                badge: null
              },
              {
                icon: AtSign, color: 'from-primary-500 to-primary-700',
                title: 'Free Business Email',
                desc: 'Every account includes a dedicated @gritsync.com email address — keeping your NCLEX correspondence professional and organized.',
                badge: 'Free'
              },
            ].map(({ icon: Icon, color, title, desc, badge }) => (
              <div key={title} className="group relative p-8 rounded-2xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 hover:border-primary-300 dark:hover:border-primary-700 transition-all duration-300 hover:shadow-xl hover:-translate-y-1">
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  <Icon className="h-7 w-7 text-white" />
                </div>
                {badge && <span className="absolute top-6 right-6 px-2.5 py-1 rounded-full text-xs font-bold bg-primary-600 text-white uppercase">{badge}</span>}
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">{title}</h3>
                <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dashboard Preview Section */}
      <section ref={dashboardRef} className="py-24 bg-gray-950 overflow-hidden relative">
        {/* Background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-primary-600/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="container mx-auto px-4 relative">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className={`transition-all duration-1000 ${dashboardInView ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-12'}`}>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900/50 border border-primary-800 text-primary-400 text-sm font-medium mb-6">
                <BarChart3 className="h-4 w-4" />
                <span>Live Dashboard Preview</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white leading-tight">
                See Everything in<br />
                <span className="text-primary-400">One Place</span>
              </h2>
              <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                Your personal dashboard gives you a real-time view of your application status, documents, payments, and upcoming steps — all at a glance.
              </p>
              <div className="space-y-4 mb-8">
                {[
                  { icon: BarChart3, text: 'Progress tracker with step-by-step status' },
                  { icon: Bell, text: 'Instant notifications on every update' },
                  { icon: Upload, text: 'Document upload & management hub' },
                  { icon: DollarSign, text: 'Payment history and upcoming dues' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-3 text-gray-300">
                    <div className="w-8 h-8 rounded-lg bg-primary-900/50 border border-primary-800 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-primary-400" />
                    </div>
                    <span>{text}</span>
                  </div>
                ))}
              </div>
              <div className="flex gap-4">
                <Link to="/register">
                  <Button size="lg" className="bg-primary-600 hover:bg-primary-700 text-white">
                    Get Access
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/login">
                  <Button variant="outline" size="lg" className="border-gray-600 text-gray-300 hover:bg-gray-800">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>

            <div className={`transition-all duration-1000 delay-200 ${dashboardInView ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-12'}`}>
              <div className="relative">
                {/* Browser chrome mockup */}
                <div className="bg-gray-800 rounded-2xl overflow-hidden shadow-2xl border border-gray-700">
                  <div className="bg-gray-900 px-4 py-3 flex items-center gap-2 border-b border-gray-700">
                    <div className="flex gap-1.5">
                      <div className="w-3 h-3 rounded-full bg-red-500" />
                      <div className="w-3 h-3 rounded-full bg-yellow-500" />
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                    </div>
                    <div className="flex-1 mx-4">
                      <div className="bg-gray-800 rounded-md px-3 py-1 text-xs text-gray-400 text-center">app.gritsync.com/dashboard</div>
                    </div>
                  </div>
                  <img
                    src="/assets/pages/dashboard-preview.png"
                    alt="GritSync Dashboard Preview"
                    className="w-full block"
                    loading="lazy"
                  />
                </div>
                {/* Floating badge */}
                <div className="absolute -bottom-4 -left-4 bg-primary-600 text-white px-4 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4" />
                  Live status updates
                </div>
                <div className="absolute -top-4 -right-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold flex items-center gap-2">
                  <Bell className="h-4 w-4 text-primary-600" />
                  Real-time notifications
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* NCLEX Timeline Section */}
      <section className="py-24 bg-white dark:bg-gray-900 overflow-hidden">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
              <Clock className="h-4 w-4" />
              <span>Application Journey</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Your NCLEX Roadmap
            </h2>
            <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
              8 structured steps from application to passing — GritSync guides you through every milestone
            </p>
          </div>

          <div ref={timelineRef} className="relative">
            {/* Connection line */}
            <div className="hidden lg:block absolute top-10 left-[6.25%] right-[6.25%] h-0.5 bg-gradient-to-r from-primary-200 via-primary-400 to-purple-400 dark:from-primary-900 dark:via-primary-700 dark:to-purple-800" />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
              {timelineSteps.slice(0, 4).map((s, i) => (
                <div
                  key={s.step}
                  className={`relative text-center transition-all duration-700 ${timelineInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  <div className="relative inline-flex mb-4">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-2 border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center shadow-md hover:shadow-lg hover:-translate-y-1 transition-all cursor-default">
                      <span className="text-2xl mb-1">{s.icon}</span>
                      <span className="text-xs font-bold text-gray-400">Step {s.step}</span>
                    </div>
                  </div>
                  <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 text-sm">{s.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{s.desc}</p>
                </div>
              ))}
            </div>

            <div className="relative mt-10">
              <div className="hidden lg:block absolute top-10 left-[6.25%] right-[6.25%] h-0.5 bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 dark:from-cyan-800 dark:via-blue-800 dark:to-purple-800" />
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                {timelineSteps.slice(4).map((s, i) => (
                  <div
                    key={s.step}
                    className={`relative text-center transition-all duration-700 ${timelineInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                    style={{ transitionDelay: `${(i + 4) * 100}ms` }}
                  >
                    <div className="relative inline-flex mb-4">
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-700 border-2 border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center shadow-md hover:shadow-lg hover:-translate-y-1 transition-all cursor-default">
                        <span className="text-2xl mb-1">{s.icon}</span>
                        <span className="text-xs font-bold text-gray-400">Step {s.step}</span>
                      </div>
                    </div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1 text-sm">{s.title}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-12 text-center">
              <Link to="/tracking">
                <Button variant="outline" size="lg" className="border-2">
                  Track Your Application
                  <ChevronRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Why GritSync */}
      <section className="py-24 bg-gradient-to-br from-gray-50 to-white dark:from-gray-800/50 dark:to-gray-900">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                <HeartHandshake className="h-4 w-4" />
                <span>Why Choose Us</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-gray-100 leading-tight">
                Built by Nurses,<br />
                <span className="text-primary-600 dark:text-primary-400">For Nurses</span>
              </h2>
              <p className="text-lg text-gray-500 dark:text-gray-400 mb-10">
                GritSync was founded by licensed USRNs who went through the same journey. We built the platform we wished we had.
              </p>
              <div className="space-y-6">
                {[
                  { icon: Clock, title: 'Fast Processing', desc: 'Reduce processing time by up to 50% with our streamlined, automated workflow.', color: 'bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400' },
                  { icon: Users, title: 'Expert Support', desc: 'NCLEX specialists available 24/7 to guide you through every step of the process.', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' },
                  { icon: CheckCircle, title: 'Error-Free Applications', desc: 'Built-in validation ensures complete and accurate applications before submission.', color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' },
                  { icon: Globe, title: 'All 50 States', desc: 'We process NCLEX applications for all US states with state-specific pricing and requirements.', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400' },
                ].map(({ icon: Icon, title, desc, color }) => (
                  <div key={title} className="flex items-start gap-4 group">
                    <div className={`flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold mb-1 text-gray-900 dark:text-gray-100">{title}</h3>
                      <p className="text-gray-500 dark:text-gray-400">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-5">
              {testimonials.map((t, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 shadow-sm hover:shadow-lg transition-shadow">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {t.initials}
                      </div>
                      <div>
                        <p className="font-bold text-gray-900 dark:text-gray-100">{t.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{t.title}</p>
                      </div>
                    </div>
                    <div className="flex gap-0.5">
                      {[...Array(t.stars)].map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 italic leading-relaxed">"{t.quote}"</p>
                </div>
              ))}

              <div className="flex gap-4 mt-6">
                <Link to="/register" className="flex-1">
                  <Button size="lg" className="w-full">
                    Start Free
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/quote" className="flex-1">
                  <Button variant="outline" size="lg" className="w-full">
                    Get a Quote
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Full-width CTA Banner */}
      <section className="relative py-20 bg-gradient-to-br from-gray-900 via-primary-950 to-gray-900 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary-600/20 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        </div>
        <div className="container mx-auto px-4 text-center relative">
          <div className="max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900/60 border border-primary-800 text-primary-300 text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              <span>Join 500+ Successful Nurses</span>
            </div>
            <h2 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
              Your USRN Journey<br />Starts Today
            </h2>
            <p className="text-xl text-gray-400 mb-10 max-w-xl mx-auto">
              Create your free account and get started with your NCLEX application in minutes. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="text-lg px-10 py-6 bg-primary-600 hover:bg-primary-500 shadow-xl shadow-primary-900/50">
                  Create Free Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/quote">
                <Button variant="outline" size="lg" className="text-lg px-10 py-6 border-gray-600 text-gray-200 hover:bg-gray-800">
                  <Play className="mr-2 h-5 w-5" />
                  Get Instant Quote
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-gray-500">
              ✓ No hidden fees &nbsp;•&nbsp; ✓ Free @gritsync.com email &nbsp;•&nbsp; ✓ Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-24 bg-white dark:bg-gray-900 scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-14">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
                <Mail className="h-4 w-4" />
                <span>Get in Touch</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Have Questions?
              </h2>
              <p className="text-xl text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
                We're here to help. Send us a message and we'll get back to you as soon as possible.
              </p>
            </div>
            
            <div className="grid md:grid-cols-5 gap-8">
              <div className="md:col-span-3 bg-gradient-to-br from-primary-50 to-white dark:from-gray-800 dark:to-gray-800/50 rounded-2xl p-8 border border-primary-100 dark:border-gray-700 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-primary-600 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Send us a Message</h3>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <Input type="text" name="name" label="Your Name" placeholder="Enter your name" value={formData.name} onChange={handleInputChange} required disabled={isSubmitting} />
                    <Input type="email" name="email" label="Your Email" placeholder="Enter your email" value={formData.email} onChange={handleInputChange} required disabled={isSubmitting} />
                  </div>
                  <Input type="text" name="subject" label="Subject" placeholder="What is this regarding?" value={formData.subject} onChange={handleInputChange} required disabled={isSubmitting} />
                  <div className="w-full">
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">Message</label>
                    <textarea name="message" rows={5} placeholder="Tell us how we can help you..." value={formData.message} onChange={handleInputChange} required disabled={isSubmitting} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none" />
                  </div>
                  <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? 'Sending...' : (<>Send Message <Send className="ml-2 h-5 w-5" /></>)}
                  </Button>
                </form>
              </div>

              <div className="md:col-span-2 space-y-5">
                <div className="bg-gray-900 dark:bg-gray-800 rounded-2xl p-6 text-white">
                  <h3 className="text-xl font-bold mb-4">Ready to Get Started?</h3>
                  <p className="text-gray-400 text-sm mb-5 leading-relaxed">Join hundreds of nurses who trust GritSync for their NCLEX application processing.</p>
                  <div className="space-y-3">
                    <Link to="/register">
                      <Button size="lg" className="w-full bg-primary-600 hover:bg-primary-500">
                        Create Free Account
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </Link>
                    <Link to="/login">
                      <Button variant="outline" size="lg" className="w-full border-gray-600 text-gray-300 hover:bg-gray-700">
                        Sign In
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700">
                  <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-4">Contact Info</h4>
                  <div className="space-y-3 text-sm">
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Email Support</p>
                      <a href="mailto:support@gritsync.com" className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-2">
                        <Mail className="h-4 w-4" />support@gritsync.com
                      </a>
                    </div>
                    <div>
                      <p className="font-medium text-gray-700 dark:text-gray-300 mb-1">Phone Support</p>
                      <a href="tel:+15092703437" className="text-primary-600 dark:text-primary-400 hover:underline">+1 (509) 270-3437</a>
                    </div>
                    <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                      <p className="text-gray-500 dark:text-gray-400 text-xs">Available 24/7 for urgent inquiries</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <Footer />
    </div>
  )
}
