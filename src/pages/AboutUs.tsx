import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { SEO, generateOrganizationSchema, generateBreadcrumbSchema, generateLocalBusinessSchema } from '@/components/SEO'
import { Users, Heart, Target, Award, Globe, Shield, CheckCircle, ArrowRight, Star, Zap, GraduationCap, TrendingUp } from 'lucide-react'

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

const values = [
  { icon: Heart, color: 'from-primary-500 to-red-600', title: 'Empathy First', desc: 'We understand the emotional journey of leaving home to pursue a nursing career in the US. Our team has been there.' },
  { icon: Shield, color: 'from-blue-500 to-blue-700', title: 'Integrity Always', desc: 'Transparent pricing, honest timelines, and no hidden fees. We treat every client with the respect they deserve.' },
  { icon: Zap, color: 'from-yellow-500 to-orange-600', title: 'Excellence Driven', desc: 'We continuously improve our processes so clients get the fastest, most accurate application results possible.' },
  { icon: Globe, color: 'from-green-500 to-emerald-700', title: 'Community Minded', desc: 'Beyond processing — we build a community of nurses supporting each other toward achieving the USRN dream.' },
]


const advisors = [
  {
    name: 'JJ Cantila',
    title: 'RM, RN, SGRN, USRN, PN (RES)',
    board: 'Texas Board of Nursing',
    initials: 'JJ',
    color: 'from-primary-600 to-primary-400',
    photo: '/gritsyncfounder.png',
  },
  {
    name: 'John Matthew Jalla',
    title: 'BSN, PHRN, USRN',
    board: 'Illinois Board of Nursing',
    initials: 'JJ',
    color: 'from-indigo-600 to-indigo-400',
    photo: null,
  },
  {
    name: 'Reynaldo Santos III',
    title: 'PHRN, DHA-RN, DOH-RN, USRN, MAN',
    board: 'New York Board of Nursing',
    initials: 'RS',
    color: 'from-emerald-600 to-emerald-400',
    photo: null,
  },
  {
    name: 'Dylan Rodriguez',
    title: 'BSN, PHRN, USRN',
    board: 'New York Board of Nursing',
    initials: 'DR',
    color: 'from-violet-600 to-violet-400',
    photo: null,
  },
]

export function AboutUs() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'About Us', url: currentUrl },
  ]

  const statsRef = useRef<HTMLDivElement>(null)
  const valuesRef = useRef<HTMLDivElement>(null)
  const statsInView = useInView(statsRef)
  const valuesInView = useInView(valuesRef)
  const count500 = useCountUp(500, 1800, statsInView)
  const count98 = useCountUp(98, 1600, statsInView)
  const count5 = useCountUp(5, 1200, statsInView)
  const count50 = useCountUp(50, 1500, statsInView)

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="About Us - GritSync | NCLEX Processing Agency"
        description="Learn about GritSync, founded by experienced USRNs including JJ Cantila, RM, RN, SGRN, CADRN, USRN. We help nurses navigate the NCLEX process to become licensed nurses in the United States."
        keywords="about GritSync, NCLEX agency, USRN founders, nursing consultancy, NCLEX support, nursing career, healthcare professionals"
        canonicalUrl={currentUrl}
        ogTitle="About Us - GritSync | NCLEX Processing Agency"
        ogDescription="Learn about GritSync, founded by experienced USRNs. We help nurses navigate the NCLEX process to become licensed nurses in the United States."
        ogImage={`${baseUrl}/about-us-banner.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateOrganizationSchema(),
          generateLocalBusinessSchema(),
          generateBreadcrumbSchema(breadcrumbs),
          {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: 'About GritSync — NCLEX Processing Agency for Filipino Nurses',
            description: 'GritSync is a professional NCLEX application processing agency founded by experienced USRNs. We are committed to helping Filipino nurses and internationally educated nurses navigate the NCLEX process to become Registered Nurses in the United States.',
            mainEntity: {
              '@id': 'https://gritsync.com/#organization',
            },
          },
        ]}
      />
      <Header />

      {/* Hero Section */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-gray-950">
        <div className="absolute inset-0">
          <img src="/assets/pages/about-hero.png" alt="About GritSync" className="w-full h-full object-cover opacity-35" />
          <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/70 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-950/30" />
        </div>
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-primary-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative py-20">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900/60 border border-primary-800 text-primary-300 text-sm font-medium mb-6">
              <Users className="h-4 w-4" />
              <span>Our Story</span>
            </div>
            <h1 className="text-5xl md:text-7xl font-black mb-6 text-white leading-tight">
              We Are
              <br />
              <span className="text-primary-400">GritSync</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl leading-relaxed">
              Born from the personal struggles of Filipino nurses navigating the NCLEX journey — GritSync exists to make that path clear, fast, and accessible for every nurse who dares to dream of becoming a USRN.
            </p>
            <div className="flex flex-col sm:flex-row gap-4">
              <Link to="/register">
                <Button size="lg" className="text-lg px-8 py-6 bg-primary-600 hover:bg-primary-500">
                  Start Your Journey
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/#contact">
                <Button variant="outline" size="lg" className="text-lg px-8 py-6 border-gray-600 text-gray-200 hover:bg-gray-800">
                  Contact Us
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <div ref={statsRef} className="bg-primary-600 py-8">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
            {[
              { val: `${count500}+`, label: 'Applications Processed', icon: CheckCircle },
              { val: `${count98}%`, label: 'Success Rate', icon: TrendingUp },
              { val: `${count5}+ Years`, label: 'In Operation', icon: Award },
              { val: `${count50}%`, label: 'Faster Processing', icon: Zap },
            ].map(({ val, label, icon: Icon }) => (
              <div key={label} className="flex flex-col items-center">
                <Icon className="h-5 w-5 text-primary-200 mb-2" />
                <div className="text-3xl font-black tabular-nums">{val}</div>
                <div className="text-primary-100 text-sm mt-1">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mission Section */}
      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-5xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                  <Target className="h-4 w-4" />
                  <span>Our Mission</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900 dark:text-gray-100 leading-tight">
                  Empowering Every<br />
                  <span className="text-primary-600 dark:text-primary-400">Nurse's Journey</span>
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 mb-6 leading-relaxed">
                  GritSync was created with a singular purpose: to be the bridge between Filipino nurses and their American nursing license. We believe that talent and dedication should never be stopped by bureaucratic complexity or financial barriers.
                </p>
                <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                  We've processed hundreds of applications, witnessed hundreds of nurses achieve their USRN dreams, and we are relentless in our commitment to making this process faster, clearer, and more accessible.
                </p>
              </div>

              <div className="relative">
                <div className="bg-gray-950 rounded-3xl overflow-hidden">
                  <img src="/assets/pages/about-hero.png" alt="GritSync Mission" className="w-full h-64 object-cover opacity-80" />
                  <div className="p-8">
                    <blockquote className="text-gray-300 text-lg italic leading-relaxed mb-4">
                      "Every nurse who walks through this journey deserves someone in their corner. That's what GritSync is — your corner."
                    </blockquote>
                    <div className="flex items-center gap-3">
                      <img src="/gritsyncfounder.png" alt="JJ Cantila" className="w-10 h-10 rounded-full object-cover object-top border border-primary-700 flex-shrink-0" />
                      <div>
                        <p className="text-white font-bold text-sm">JJ Cantila</p>
                        <p className="text-gray-400 text-xs">Founder, GritSync</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* The Name: Grit + Sync */}
      <section className="py-24 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
              The Name Behind the Mission
            </h2>
            <p className="text-gray-400 text-xl">Why we chose <span className="text-primary-400 font-bold">Grit</span> + <span className="text-blue-400 font-bold">Sync</span></p>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="p-10 rounded-3xl bg-gradient-to-br from-primary-900/60 to-primary-950 border border-primary-800">
              <div className="text-6xl font-black text-primary-400 mb-4">Grit</div>
              <p className="text-gray-300 text-lg leading-relaxed">
                The relentless determination of Filipino nurses. The courage to leave home, face a new language, navigate foreign systems, and sit for one of the hardest exams in the world. <span className="text-primary-300 font-medium">That's grit — and every nurse who reaches USRN status embodies it.</span>
              </p>
            </div>
            <div className="p-10 rounded-3xl bg-gradient-to-br from-blue-900/60 to-blue-950 border border-blue-800">
              <div className="text-6xl font-black text-blue-400 mb-4">Sync</div>
              <p className="text-gray-300 text-lg leading-relaxed">
                The seamless coordination of every step in your application — documents, payments, timelines, and communications, all synchronized into one intelligent platform. <span className="text-blue-300 font-medium">We handle the complexity so you can focus on the exam.</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-24 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
              <Star className="h-4 w-4" />
              <span>Core Values</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">What We Stand For</h2>
          </div>
          <div ref={valuesRef} className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {values.map((v, i) => (
              <div
                key={v.title}
                className={`group p-8 rounded-2xl border-2 border-gray-100 dark:border-gray-800 text-center hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-xl transition-all duration-500 hover:-translate-y-1 ${valuesInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                style={{ transitionDelay: `${i * 100}ms` }}
              >
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${v.color} flex items-center justify-center mx-auto mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                  <v.icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">{v.title}</h3>
                <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed">{v.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Program Advisors */}
      <section className="py-24 bg-gray-950">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900/50 border border-primary-800 text-primary-300 text-sm font-medium mb-4">
              <GraduationCap className="h-4 w-4" />
              <span>Our Advisors</span>
            </div>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">Meet the Program Advisors</h2>
            <p className="text-xl text-gray-400 max-w-xl mx-auto">Licensed USRNs across multiple states guiding our program and clients</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-5xl mx-auto">
            {advisors.map((advisor) => (
              <div
                key={advisor.name + advisor.board}
                className="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-primary-700 hover:shadow-xl hover:shadow-primary-900/20 transition-all duration-300"
              >
                {/* Photo / Avatar */}
                <div className="relative h-56 bg-gray-800 overflow-hidden">
                  {advisor.photo ? (
                    <img
                      src={advisor.photo}
                      alt={advisor.name}
                      className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className={`w-full h-full bg-gradient-to-br ${advisor.color} flex items-center justify-center`}>
                      <span className="text-6xl font-black text-white/30">{advisor.initials}</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-gray-900 via-transparent to-transparent" />
                </div>

                {/* Info */}
                <div className="p-5">
                  <h3 className="text-white font-bold text-lg leading-tight mb-1">{advisor.name}</h3>
                  <p className="text-primary-400 text-xs font-semibold mb-2 leading-relaxed">{advisor.title}</p>
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <Globe className="h-3.5 w-3.5 flex-shrink-0" />
                    <span>{advisor.board}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications & Trust */}
      <section className="py-16 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-800">
        <div className="container mx-auto px-4">
          <div className="text-center mb-10">
            <p className="text-gray-500 dark:text-gray-400 text-sm uppercase tracking-widest font-medium">Trusted Standards</p>
          </div>
          <div className="flex flex-wrap justify-center gap-8 items-center">
            {[
              { icon: Shield, label: 'HIPAA Compliant' },
              { icon: GraduationCap, label: 'NCLEX Certified Specialists' },
              { icon: CheckCircle, label: 'BON Approved Process' },
              { icon: Award, label: '5-Star Rated Agency' },
              { icon: Globe, label: 'All 50 States' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-2 px-5 py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 text-sm">
                <Icon className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                {label}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative py-20 bg-gradient-to-br from-gray-900 via-primary-950 to-gray-900 overflow-hidden">
        <div className="absolute top-0 left-1/4 w-72 h-72 bg-primary-600/20 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 text-center relative">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to Start?</h2>
            <p className="text-xl text-gray-400 mb-8">Join the GritSync family and let us guide your USRN journey from start to finish.</p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/register">
                <Button size="lg" className="text-lg px-10 py-6 bg-primary-600 hover:bg-primary-500">
                  Create Free Account
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link to="/quote">
                <Button variant="outline" size="lg" className="text-lg px-10 py-6 border-gray-600 text-gray-200 hover:bg-gray-800">
                  Get Instant Quote
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
