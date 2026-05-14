import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { SEO, generateBreadcrumbSchema, generateServiceSchema } from '@/components/SEO'
import { 
  Award, 
  DollarSign, 
  CheckCircle, 
  FileText, 
  Users, 
  Heart,
  ArrowRight,
  GraduationCap,
  Briefcase,
  Target,
  Star,
  ShieldCheck,
  Clock,
  Zap
} from 'lucide-react'

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

export function SponsorshipLanding() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'NCLEX Sponsorship', url: currentUrl },
  ]
  const benefitsRef = useRef<HTMLDivElement>(null)
  const processRef = useRef<HTMLDivElement>(null)
  const benefitsInView = useInView(benefitsRef)
  const processInView = useInView(processRef)

  const benefits = [
    {
      icon: DollarSign,
      color: 'from-blue-500 to-blue-700',
      title: 'Financial Coverage',
      desc: 'Receive financial assistance covering NCLEX exam fees, BON application costs, and related processing expenses — reducing your financial burden.',
    },
    {
      icon: Target,
      color: 'from-green-500 to-emerald-700',
      title: 'Clear Path Forward',
      desc: 'Remove financial obstacles and focus entirely on what matters most — preparing for and passing your NCLEX exam to become a USRN.',
    },
    {
      icon: Users,
      color: 'from-purple-500 to-purple-700',
      title: 'Community Support',
      desc: 'Join a growing community of nurses supporting each other in achieving professional goals, sharing resources and encouragement.',
    },
    {
      icon: GraduationCap,
      color: 'from-primary-500 to-primary-700',
      title: 'Mentorship Access',
      desc: 'Connect with experienced USRNs who can guide your preparation, share study strategies, and provide career advice.',
    },
    {
      icon: ShieldCheck,
      color: 'from-cyan-500 to-cyan-700',
      title: 'Guaranteed Processing',
      desc: 'Sponsored applicants receive priority processing through the GritSync platform with dedicated case management.',
    },
    {
      icon: Clock,
      color: 'from-orange-500 to-orange-700',
      title: 'Flexible Timeline',
      desc: 'Work at your own pace. Our program accommodates nurses at different stages of their NCLEX preparation journey.',
    },
  ]

  const eligibility = [
    { icon: GraduationCap, title: 'Nursing Education', desc: 'Completed or currently completing nursing education from an accredited school.' },
    { icon: DollarSign, title: 'Financial Need', desc: 'Genuine financial need preventing you from covering NCLEX fees independently.' },
    { icon: Target, title: 'USRN Goal', desc: 'Clear commitment to pursue a career as a USRN in the United States.' },
    { icon: Briefcase, title: 'Professional Readiness', desc: 'Prepared to take the NCLEX and meet all eligibility requirements.' },
  ]

  const steps = [
    { num: '01', title: 'Complete Application', desc: 'Fill out the sponsorship form with your personal information, educational background, and professional details.', icon: FileText },
    { num: '02', title: 'Share Your Story', desc: 'Provide a detailed description of your financial situation and a motivation statement about your USRN journey.', icon: Heart },
    { num: '03', title: 'Submit Documents', desc: 'Upload your resume, transcripts, and recommendation letters to strengthen your application (optional but recommended).', icon: GraduationCap },
    { num: '04', title: 'Review & Notification', desc: 'Our committee reviews all applications carefully and notifies you of the decision within 7-14 business days.', icon: CheckCircle },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="NCLEX Sponsorship Program for Filipino Nurses — Financial Support | GritSync"
        description="Apply for GritSync's NCLEX sponsorship program. Qualified Filipino nurses receive financial assistance covering NCLEX processing fees in exchange for a service commitment. Limited slots available."
        keywords="NCLEX sponsorship Philippines, NCLEX financial aid Filipino nurses, USRN sponsorship program, nursing exam sponsorship Philippines, NCLEX funding Filipino, NCLEX scholarship Philippines, sponsored USRN program"
        canonicalUrl={currentUrl}
        ogTitle="NCLEX Sponsorship Program - Financial Support for Aspiring USRNs | GritSync"
        ogDescription="Apply for NCLEX sponsorship to receive financial support for your NCLEX exam fees."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateBreadcrumbSchema(breadcrumbs),
          generateServiceSchema('NCLEX Sponsorship Program', 'Financial support program for nurses seeking to take the NCLEX exam and become USRNs'),
        ]}
      />
      <Header />
      <main>
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center overflow-hidden bg-gray-950">
          {/* Background image */}
          <div className="absolute inset-0">
            <img
              src="/assets/pages/sponsorship-hero.png"
              alt="NCLEX Sponsorship"
              className="w-full h-full object-cover opacity-40"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-gray-950 via-gray-950/80 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-950/30" />
          </div>

          {/* Glow orbs */}
          <div className="absolute top-1/3 left-1/3 w-96 h-96 bg-primary-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="container mx-auto px-4 relative py-20">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900/60 border border-primary-800 text-primary-300 text-sm font-medium mb-6">
                <Award className="h-4 w-4" />
                <span>GritSync Sponsorship Program</span>
              </div>
              <h1 className="text-5xl md:text-7xl font-black mb-6 text-white leading-tight">
                Your Dream<br />
                <span className="text-primary-400">Deserves Support</span>
              </h1>
              <p className="text-xl text-gray-300 mb-8 max-w-xl leading-relaxed">
                Financial barriers should never stand between a dedicated nurse and their USRN license. Our sponsorship program is designed to bridge that gap.
              </p>

              <div className="flex flex-wrap gap-4 mb-10">
                {[
                  { icon: DollarSign, text: 'Exam fees covered' },
                  { icon: ShieldCheck, text: 'Priority processing' },
                  { icon: Users, text: 'Mentor community' },
                ].map(({ icon: Icon, text }) => (
                  <div key={text} className="flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-white text-sm backdrop-blur-sm">
                    <Icon className="h-4 w-4 text-primary-400" />
                    {text}
                  </div>
                ))}
              </div>

              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/sponsorship/apply">
                  <Button size="lg" className="text-lg px-8 py-6 bg-primary-600 hover:bg-primary-500 shadow-xl shadow-primary-900/50">
                    Apply for Sponsorship
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/donate">
                  <Button variant="outline" size="lg" className="text-lg px-8 py-6 border-gray-600 text-gray-200 hover:bg-gray-800">
                    <Heart className="mr-2 h-5 w-5 text-primary-400" />
                    Support the Program
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Strip */}
        <div className="bg-primary-600 py-6">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center text-white">
              {[
                { val: '100+', label: 'Nurses Sponsored' },
                { val: '$50K+', label: 'In Funding Granted' },
                { val: '95%', label: 'Exam Pass Rate' },
                { val: '4.9★', label: 'Program Rating' },
              ].map(({ val, label }) => (
                <div key={label}>
                  <div className="text-3xl font-black">{val}</div>
                  <div className="text-primary-100 text-sm mt-1">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Benefits Section */}
        <section className="py-24 bg-white dark:bg-gray-900">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
                <Star className="h-4 w-4" />
                <span>Program Benefits</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                What You'll Receive
              </h2>
              <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                Our comprehensive sponsorship goes beyond just financial support
              </p>
            </div>

            <div ref={benefitsRef} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {benefits.map((b, i) => (
                <div
                  key={b.title}
                  className={`group p-8 rounded-2xl border-2 border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-800/50 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-xl transition-all duration-500 hover:-translate-y-1 ${benefitsInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={{ transitionDelay: `${i * 80}ms` }}
                >
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${b.color} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform`}>
                    <b.icon className="h-7 w-7 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-gray-900 dark:text-gray-100">{b.title}</h3>
                  <p className="text-gray-500 dark:text-gray-400 leading-relaxed">{b.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Eligibility Section */}
        <section className="py-24 bg-gray-950">
          <div className="container mx-auto px-4">
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900/50 border border-primary-800 text-primary-300 text-sm font-medium mb-6">
                  <CheckCircle className="h-4 w-4" />
                  <span>Eligibility Requirements</span>
                </div>
                <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white leading-tight">
                  Who Can<br />
                  <span className="text-primary-400">Apply?</span>
                </h2>
                <p className="text-gray-400 text-lg mb-8 leading-relaxed">
                  Our program is open to nurses who demonstrate both financial need and a strong commitment to their USRN journey. We evaluate each application holistically.
                </p>
                <Link to="/sponsorship/apply">
                  <Button size="lg" className="bg-primary-600 hover:bg-primary-500 text-white">
                    Check My Eligibility
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>

              <div className="space-y-4">
                {eligibility.map((e) => (
                  <div key={e.title} className="flex items-start gap-4 p-5 rounded-2xl bg-gray-900 border border-gray-800 hover:border-primary-800 transition-colors group">
                    <div className="flex-shrink-0 w-11 h-11 rounded-xl bg-primary-900/50 border border-primary-800 flex items-center justify-center group-hover:bg-primary-900 transition-colors">
                      <e.icon className="h-5 w-5 text-primary-400" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white mb-1">{e.title}</h3>
                      <p className="text-gray-400 text-sm leading-relaxed">{e.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Application Process */}
        <section className="py-24 bg-white dark:bg-gray-900">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
                <Zap className="h-4 w-4" />
                <span>Simple Process</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                How to Apply
              </h2>
              <p className="text-xl text-gray-500 dark:text-gray-400 max-w-2xl mx-auto">
                Applying for sponsorship takes less than 15 minutes
              </p>
            </div>

            <div ref={processRef} className="grid md:grid-cols-2 lg:grid-cols-4 gap-8 max-w-6xl mx-auto">
              {steps.map((s, i) => (
                <div
                  key={s.num}
                  className={`relative text-center group transition-all duration-700 ${processInView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}
                  style={{ transitionDelay: `${i * 100}ms` }}
                >
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-8 left-full w-full h-0.5 bg-gradient-to-r from-primary-300 to-gray-200 dark:from-primary-800 dark:to-gray-700 z-0" style={{ width: 'calc(100% - 4rem)', left: 'calc(50% + 2rem)' }} />
                  )}
                  <div className="relative z-10">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-600 to-primary-400 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary-900/30 group-hover:scale-110 transition-transform">
                      <s.icon className="h-7 w-7 text-white" />
                    </div>
                    <div className="text-xs font-black text-primary-600 dark:text-primary-400 mb-2 tracking-widest">{s.num}</div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">{s.title}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="relative py-24 bg-gradient-to-br from-primary-600 to-primary-800 overflow-hidden">
          <div className="absolute inset-0">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary-900/50 rounded-full blur-3xl" />
          </div>
          <div className="container mx-auto px-4 text-center relative">
            <div className="max-w-3xl mx-auto">
              <div className="w-20 h-20 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center mx-auto mb-6">
                <Award className="h-10 w-10 text-white" />
              </div>
              <h2 className="text-4xl md:text-6xl font-black mb-6 text-white leading-tight">
                Ready to Apply?
              </h2>
              <p className="text-xl text-primary-100 mb-10 max-w-xl mx-auto">
                Take the first step toward achieving your USRN dream. Applications are reviewed on a rolling basis.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/sponsorship/apply">
                  <Button size="lg" className="text-lg px-10 py-6 bg-white text-primary-700 hover:bg-primary-50 shadow-xl font-bold">
                    Start Your Application
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/donate">
                  <Button variant="outline" size="lg" className="text-lg px-10 py-6 border-white/40 text-white hover:bg-white/10">
                    <Heart className="mr-2 h-5 w-5" />
                    Donate to the Fund
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-primary-200 text-sm">
                Questions? <Link to="/#contact" className="underline hover:text-white">Contact us</Link> — we're happy to help.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}
