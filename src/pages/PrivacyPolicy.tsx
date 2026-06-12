import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Shield, ArrowLeft, FileText, ChevronRight, Eye, Lock, Database, Globe, Phone, Mail, AlertCircle, BookOpen } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SEO, generateBreadcrumbSchema } from '@/components/SEO'
import { generalSettings } from '@/lib/settings'

const sections = [
  { id: 'introduction', label: '1. Introduction' },
  { id: 'information-collected', label: '2. Information We Collect' },
  { id: 'how-we-use', label: '3. How We Use Your Info' },
  { id: 'sharing', label: '4. Information Sharing' },
  { id: 'security', label: '5. Data Security' },
  { id: 'retention', label: '6. Data Retention' },
  { id: 'rights', label: '7. Your Rights' },
  { id: 'cookies', label: '8. Cookies' },
  { id: 'third-party', label: '9. Third-Party Links' },
  { id: 'children', label: '10. Children\'s Privacy' },
  { id: 'international', label: '11. International Transfers' },
  { id: 'changes', label: '12. Policy Changes' },
  { id: 'contact', label: '13. Contact Us' },
  { id: 'gdpr', label: '14. GDPR Rights (EU)' },
]

export function PrivacyPolicy() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'Privacy Policy', url: currentUrl },
  ]
  const [phoneNumber, setPhoneNumber] = useState('+63 969 153 3239')
  const [activeSection, setActiveSection] = useState('introduction')

  useEffect(() => {
    const loadPhoneNumber = async () => {
      try {
        const phone = await generalSettings.getPhoneNumber()
        setPhoneNumber(phone)
      } catch (error) {
        console.error('Error loading phone number:', error)
      }
    }
    loadPhoneNumber()
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveSection(entry.target.id)
        })
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )
    sections.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })
    return () => observer.disconnect()
  }, [])

  const lastUpdated = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="Privacy Policy - GritSync | NCLEX Processing Agency"
        description="Read GritSync's Privacy Policy. Learn how we collect, use, disclose, and safeguard your information when using our NCLEX application processing services."
        keywords="privacy policy, data protection, privacy, NCLEX agency privacy, data security, GDPR"
        canonicalUrl={currentUrl}
        ogTitle="Privacy Policy - GritSync"
        ogDescription="Read GritSync's Privacy Policy. Learn how we collect, use, and safeguard your information."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateBreadcrumbSchema(breadcrumbs),
          { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Privacy Policy', description: 'Privacy Policy for GritSync NCLEX application processing services' },
        ]}
      />
      <Header />

      {/* Hero */}
      <section className="relative bg-gray-950 py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-blue-950/30" />
        <div className="absolute top-0 right-1/3 w-64 h-64 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 relative">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/50 border border-blue-800 text-blue-300 text-sm font-medium mb-6">
              <Shield className="h-4 w-4" />
              Legal Document
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">Privacy Policy</h1>
            <p className="text-gray-400 text-lg mb-6">We are committed to protecting your privacy. This policy explains how we handle your personal information with care and transparency.</p>
            <div className="flex flex-wrap gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-blue-400" /> Last updated: {lastUpdated}</span>
              <span className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-blue-400" /> GDPR Compliant</span>
              <span className="flex items-center gap-1.5"><Globe className="h-4 w-4 text-blue-400" /> Applies worldwide</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Commitment Banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border-y border-blue-200 dark:border-blue-800 py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-6 justify-center text-sm">
            {[
              { icon: Eye, text: 'We never sell your personal data' },
              { icon: Lock, text: 'All data encrypted in transit & at rest' },
              { icon: Database, text: 'Stored securely on certified infrastructure' },
              { icon: Shield, text: 'Your rights are always protected' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <Icon className="h-4 w-4 flex-shrink-0" />
                <span>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="lg:grid lg:grid-cols-4 lg:gap-12">

          {/* Sticky TOC */}
          <aside className="hidden lg:block lg:col-span-1">
            <div className="sticky top-24">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Table of Contents</p>
              <nav className="space-y-1">
                {sections.map(({ id, label }) => (
                  <a
                    key={id}
                    href={`#${id}`}
                    className={`block text-sm py-1.5 px-3 rounded-lg transition-all ${
                      activeSection === id
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 font-semibold'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {label}
                  </a>
                ))}
              </nav>
              <div className="mt-8 p-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Data protection questions?</p>
                <a href="mailto:office@gritsync.com" className="text-sm text-blue-600 dark:text-blue-400 font-medium hover:underline flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> office@gritsync.com
                </a>
              </div>
            </div>
          </aside>

          {/* Main Content */}
          <main className="lg:col-span-3">
            <div className="space-y-12">

              <section id="introduction" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">1</span>
                  Introduction
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>GritSync ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our NCLEX application processing services, website, and related services (collectively, the "Service").</p>
                  <p>Please read this Privacy Policy carefully. By using our Service, you agree to the collection and use of information in accordance with this policy. If you do not agree, please do not use our Service.</p>
                </div>
              </section>

              <section id="information-collected" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">2</span>
                  Information We Collect
                </h2>
                <div className="pl-11 space-y-6 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">2.1 Personal Information</h3>
                    <p className="mb-3">We collect personal information that you provide directly to us, including:</p>
                    <ul className="space-y-2">
                      {[
                        { label: 'Account Information', detail: 'Name, email address, password, phone number' },
                        { label: 'Application Information', detail: 'Personal details, educational background, professional credentials, identification documents' },
                        { label: 'Payment Information', detail: 'Billing address, payment method details (processed securely through third-party payment processors)' },
                        { label: 'Communication Data', detail: 'Messages, inquiries, and correspondence with us' },
                        { label: 'Documentation', detail: 'Passport copies, diplomas, photographs, and other required documents' },
                      ].map(({ label, detail }) => (
                        <li key={label} className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span><strong className="text-gray-700 dark:text-gray-200">{label}:</strong> {detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">2.2 Automatically Collected Information</h3>
                    <p className="mb-3">When you use our Service, we automatically collect:</p>
                    <ul className="space-y-2">
                      {[
                        { label: 'Usage Data', detail: 'Pages visited, features used, time spent on pages' },
                        { label: 'Device Information', detail: 'IP address, browser type, device type, operating system' },
                        { label: 'Cookies', detail: 'Session and preference cookies (see Section 8)' },
                        { label: 'Log Data', detail: 'Access times, error logs, and system performance data' },
                      ].map(({ label, detail }) => (
                        <li key={label} className="flex items-start gap-2">
                          <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                          <span><strong className="text-gray-700 dark:text-gray-200">{label}:</strong> {detail}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </section>

              <section id="how-we-use" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">3</span>
                  How We Use Your Information
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>We use the information we collect for the following purposes:</p>
                  <ul className="space-y-2">
                    {[
                      { label: 'Service Provision', detail: 'To process your NCLEX application, manage your account, and provide requested services' },
                      { label: 'Communication', detail: 'To send updates, notifications, and respond to your inquiries' },
                      { label: 'Payment Processing', detail: 'To process payments and manage billing' },
                      { label: 'Document Management', detail: 'To store, organize, and submit your application documents' },
                      { label: 'Service Improvement', detail: 'To analyze usage patterns and improve our Service' },
                      { label: 'Legal Compliance', detail: 'To comply with legal obligations and regulatory requirements' },
                      { label: 'Security', detail: 'To protect against fraud, unauthorized access, and security threats' },
                      { label: 'Customer Support', detail: 'To provide technical support and customer service' },
                    ].map(({ label, detail }) => (
                      <li key={label} className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span><strong className="text-gray-700 dark:text-gray-200">{label}:</strong> {detail}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section id="sharing" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">4</span>
                  Information Sharing and Disclosure
                </h2>
                <div className="pl-11 space-y-6 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-300 text-sm flex gap-3">
                    <Shield className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span className="font-semibold">We do not sell your personal information — ever.</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">4.1 Service Providers</h3>
                    <p className="mb-3">We may share information with trusted third-party service providers who perform services on our behalf:</p>
                    <ul className="space-y-2">
                      {['Payment processors (Stripe)', 'Secure cloud database infrastructure', 'Email service providers', 'Analytics and monitoring services'].map(item => (
                        <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">4.2 Legal Requirements</h3>
                    <p className="mb-3">We may disclose your information if required by law or in response to:</p>
                    <ul className="space-y-2">
                      {['Legal processes, court orders, or government requests', 'Enforcement of our Terms of Service', 'Protection of our rights, property, or safety', 'Prevention of fraud or security threats'].map(item => (
                        <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">4.3 Business Transfers</h3>
                    <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity, who will be bound by this Privacy Policy.</p>
                  </div>
                </div>
              </section>

              <section id="security" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">5</span>
                  Data Security
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>We implement appropriate technical and organizational measures to protect your personal information, including:</p>
                  <ul className="space-y-2">
                    {['Encryption of data in transit (TLS/HTTPS) and at rest', 'Secure authentication and access controls', 'Regular security assessments and updates', 'Employee training on data protection best practices', 'Secure data storage with certified cloud infrastructure'].map(item => (
                      <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />{item}</li>
                    ))}
                  </ul>
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm flex gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    No method of transmission over the Internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
                  </div>
                </div>
              </section>

              <section id="retention" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">6</span>
                  Data Retention
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>We retain your personal information for as long as necessary to:</p>
                  <ul className="space-y-2">
                    {['Provide our services to you', 'Comply with legal obligations', 'Resolve disputes and enforce agreements', 'Maintain business records as required by law'].map(item => (
                      <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />{item}</li>
                    ))}
                  </ul>
                  <p>When we no longer need your information, we will securely delete or anonymize it in accordance with our data retention policies.</p>
                </div>
              </section>

              <section id="rights" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">7</span>
                  Your Rights
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>Depending on your location, you have the following rights regarding your personal information:</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {[
                      { right: 'Access', desc: 'Request a copy of your personal information' },
                      { right: 'Correction', desc: 'Request correction of inaccurate or incomplete data' },
                      { right: 'Deletion', desc: 'Request deletion of your personal information' },
                      { right: 'Portability', desc: 'Request transfer of your data to another service' },
                      { right: 'Objection', desc: 'Object to processing for certain purposes' },
                      { right: 'Restriction', desc: 'Request restriction of processing in certain circumstances' },
                      { right: 'Withdraw Consent', desc: 'Withdraw consent where processing is based on consent' },
                    ].map(({ right, desc }) => (
                      <div key={right} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-0.5">{right}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">{desc}</p>
                      </div>
                    ))}
                  </div>
                  <p>To exercise these rights, contact us using the information in Section 13.</p>
                </div>
              </section>

              <section id="cookies" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">8</span>
                  Cookies and Tracking Technologies
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>We use cookies and similar tracking technologies to maintain your session, remember preferences, and analyze Service usage.</p>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {[
                      { type: 'Essential Cookies', desc: 'Required for the Service to function. Cannot be disabled.' },
                      { type: 'Functional Cookies', desc: 'Remember your preferences and settings across sessions.' },
                      { type: 'Analytics Cookies', desc: 'Help us understand how users interact with our Service.' },
                    ].map(({ type, desc }) => (
                      <div key={type} className="p-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">{type}</p>
                        <p className="text-gray-500 dark:text-gray-400 text-xs">{desc}</p>
                      </div>
                    ))}
                  </div>
                  <p>You can control cookies through your browser settings, though disabling certain cookies may affect Service functionality.</p>
                </div>
              </section>

              <section id="third-party" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">9</span>
                  Third-Party Links
                </h2>
                <div className="pl-11 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any information.</p>
                </div>
              </section>

              <section id="children" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">10</span>
                  Children's Privacy
                </h2>
                <div className="pl-11 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete such information promptly.</p>
                </div>
              </section>

              <section id="international" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">11</span>
                  International Data Transfers
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country.</p>
                  <p>We take appropriate safeguards to ensure that your information receives an adequate level of protection in accordance with this Privacy Policy and applicable law.</p>
                </div>
              </section>

              <section id="changes" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">12</span>
                  Changes to This Privacy Policy
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>We may update this Privacy Policy from time to time. We will notify you of material changes by:</p>
                  <ul className="space-y-2">
                    {['Posting the updated Privacy Policy on our website', 'Sending email notifications to registered users', 'Displaying a notice within the Service'].map(item => (
                      <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />{item}</li>
                    ))}
                  </ul>
                  <p>Your continued use of the Service after changes constitutes acceptance of the updated Privacy Policy.</p>
                </div>
              </section>

              <section id="contact" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">13</span>
                  Contact Information
                </h2>
                <div className="pl-11 space-y-4">
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">If you have questions, concerns, or requests regarding this Privacy Policy, please contact us. Include "Privacy Policy Inquiry" in your subject line for data protection requests.</p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <a href="mailto:office@gritsync.com" className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                      <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Email</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">office@gritsync.com</p>
                      </div>
                    </a>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <Phone className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Phone</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{phoneNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Compliance</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">GDPR / Data Rights</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section id="gdpr" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-sm font-bold flex items-center justify-center">14</span>
                  GDPR Rights (for EU Users)
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>If you are located in the European Union, you have additional rights under the General Data Protection Regulation (GDPR):</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {['Right to access your personal data', 'Right to rectification of inaccurate data', 'Right to erasure ("right to be forgotten")', 'Right to restrict processing', 'Right to data portability', 'Right to object to processing', 'Right to withdraw consent', 'Right to lodge a complaint with a supervisory authority'].map(right => (
                      <div key={right} className="flex items-start gap-2">
                        <ChevronRight className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <span>{right}</span>
                      </div>
                    ))}
                  </div>
                  <p>To exercise these rights, contact us using the information in Section 13 above.</p>
                </div>
              </section>

              {/* Footer nav */}
              <div className="pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <Link to="/terms" className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium flex items-center gap-1">
                  <FileText className="h-4 w-4" /> View Terms of Service
                </Link>
                <Link to="/" className="px-6 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors">
                  Return to Home
                </Link>
              </div>

            </div>
          </main>
        </div>
      </div>
      <Footer />
    </div>
  )
}
