import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, ArrowLeft, Shield, ChevronRight, BookOpen, DollarSign, Users, AlertCircle, Globe, Phone, Mail } from 'lucide-react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SEO, generateBreadcrumbSchema } from '@/components/SEO'
import { generalSettings } from '@/lib/settings'

const sections = [
  { id: 'introduction', label: '1. Introduction' },
  { id: 'acceptance', label: '2. Acceptance' },
  { id: 'description', label: '3. Description of Service' },
  { id: 'accounts', label: '4. User Accounts' },
  { id: 'responsibilities', label: '5. User Responsibilities' },
  { id: 'fees', label: '6. Fees & Payment' },
  { id: 'ip', label: '7. Intellectual Property' },
  { id: 'privacy', label: '8. Privacy & Data' },
  { id: 'liability', label: '9. Limitation of Liability' },
  { id: 'indemnification', label: '10. Indemnification' },
  { id: 'termination', label: '11. Termination' },
  { id: 'disputes', label: '12. Dispute Resolution' },
  { id: 'governing', label: '13. Governing Law' },
  { id: 'changes', label: '14. Changes to Terms' },
  { id: 'contact', label: '15. Contact' },
]

export function TermsOfService() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'Terms of Service', url: currentUrl },
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
        title="Terms of Service - GritSync | NCLEX Processing Agency"
        description="Read GritSync's Terms of Service. Understand the terms and conditions for using our NCLEX application processing services, website, and related services."
        keywords="terms of service, terms and conditions, legal, NCLEX agency terms, service agreement"
        canonicalUrl={currentUrl}
        ogTitle="Terms of Service - GritSync"
        ogDescription="Read GritSync's Terms of Service. Understand the terms and conditions for using our NCLEX application processing services."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateBreadcrumbSchema(breadcrumbs),
          { '@context': 'https://schema.org', '@type': 'WebPage', name: 'Terms of Service', description: 'Terms of Service for GritSync NCLEX application processing services' },
        ]}
      />
      <Header />

      {/* Hero */}
      <section className="relative bg-gray-950 py-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-950 to-primary-950/30" />
        <div className="absolute top-0 right-1/3 w-64 h-64 bg-primary-600/10 rounded-full blur-3xl" />
        <div className="container mx-auto px-4 relative">
          <Link to="/" className="inline-flex items-center gap-2 text-gray-400 hover:text-white text-sm mb-8 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900/50 border border-primary-800 text-primary-300 text-sm font-medium mb-6">
              <FileText className="h-4 w-4" />
              Legal Document
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-white mb-4">Terms of Service</h1>
            <p className="text-gray-400 text-lg mb-6">Please read these terms carefully before using GritSync's NCLEX application processing services.</p>
            <div className="flex flex-wrap gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-1.5"><BookOpen className="h-4 w-4 text-primary-400" /> Last updated: {lastUpdated}</span>
              <span className="flex items-center gap-1.5"><Shield className="h-4 w-4 text-primary-400" /> Applies to all GritSync services</span>
              <span className="flex items-center gap-1.5"><Globe className="h-4 w-4 text-primary-400" /> All users worldwide</span>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Summary Banner */}
      <div className="bg-primary-50 dark:bg-primary-900/20 border-y border-primary-200 dark:border-primary-800 py-4">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap gap-6 justify-center text-sm">
            {[
              { icon: Users, text: 'Create an account to access all services' },
              { icon: DollarSign, text: 'Fees are transparent and agreed upfront' },
              { icon: Shield, text: 'Your data is protected and never sold' },
              { icon: AlertCircle, text: 'We process — BON approval is independent' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-2 text-primary-700 dark:text-primary-300">
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
                        ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold'
                        : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {label}
                  </a>
                ))}
              </nav>
              <div className="mt-8 p-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Questions about these terms?</p>
                <a href="mailto:office@gritsync.com" className="text-sm text-primary-600 dark:text-primary-400 font-medium hover:underline flex items-center gap-1">
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
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">1</span>
                  Introduction
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>Welcome to GritSync ("we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of our NCLEX application processing services, website, and related services (collectively, the "Service"). By accessing or using our Service, you agree to be bound by these Terms.</p>
                  <p>If you do not agree to these Terms, please do not use our Service. We reserve the right to modify these Terms at any time, and such modifications will be effective immediately upon posting.</p>
                </div>
              </section>

              <section id="acceptance" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">2</span>
                  Acceptance of Terms
                </h2>
                <div className="pl-11 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>By creating an account, accessing, or using our Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are using the Service on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.</p>
                </div>
              </section>

              <section id="description" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">3</span>
                  Description of Service
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>GritSync provides NCLEX application processing services, including:</p>
                  <ul className="space-y-2">
                    {['NCLEX application form preparation and submission assistance', 'Document management and verification', 'Application tracking and real-time status updates', 'Quotation generation for processing services', 'Payment processing for application fees', 'Communication and notification services'].map(item => (
                      <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />{item}</li>
                    ))}
                  </ul>
                  <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-sm flex gap-3">
                    <AlertCircle className="h-5 w-5 flex-shrink-0 mt-0.5" />
                    <span>We act as a processing intermediary and do not guarantee approval or acceptance of your NCLEX application by any regulatory body or testing organization.</span>
                  </div>
                </div>
              </section>

              <section id="accounts" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">4</span>
                  User Accounts
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>To use our Service, you must create an account. You agree to:</p>
                  <ul className="space-y-2">
                    {['Provide accurate, current, and complete information during registration', 'Maintain and promptly update your account information', 'Maintain the security of your account credentials', 'Accept responsibility for all activities that occur under your account', 'Notify us immediately of any unauthorized use of your account'].map(item => (
                      <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />{item}</li>
                    ))}
                  </ul>
                  <p>We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent, abusive, or illegal activities.</p>
                </div>
              </section>

              <section id="responsibilities" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">5</span>
                  User Responsibilities
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>You are responsible for:</p>
                  <ul className="space-y-2">
                    {['Providing accurate and truthful information in your application', 'Ensuring all documents submitted are authentic and valid', 'Complying with all applicable laws and regulations', 'Paying all fees associated with your application processing', 'Maintaining the confidentiality of your account information', 'Not using the Service for any unlawful purpose'].map(item => (
                      <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />{item}</li>
                    ))}
                  </ul>
                </div>
              </section>

              <section id="fees" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">6</span>
                  Fees and Payment
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>Our Service requires payment of fees for processing services. You agree to:</p>
                  <ul className="space-y-2">
                    {['Pay all fees as specified in your quotation or service agreement', 'Provide accurate payment information', 'Authorize us to charge your payment method for applicable fees', 'Understand that fees are non-refundable unless otherwise stated or required by law'].map(item => (
                      <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />{item}</li>
                    ))}
                  </ul>
                  <p>All fees are displayed in USD or PHP as indicated. We reserve the right to change our fees at any time, but changes will not affect services already in progress.</p>
                </div>
              </section>

              <section id="ip" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">7</span>
                  Intellectual Property
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>The Service, including its original content, features, and functionality, is owned by GritSync and is protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.</p>
                  <p>You may not reproduce, distribute, modify, create derivative works of, publicly display, or otherwise exploit any part of the Service without our prior written permission.</p>
                </div>
              </section>

              <section id="privacy" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">8</span>
                  Privacy and Data Protection
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>Your use of our Service is governed by our Privacy Policy. Please review it to understand how we collect, use, and protect your personal information.</p>
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300 text-sm flex items-center gap-3">
                    <Shield className="h-5 w-5 flex-shrink-0" />
                    <span>We never sell your personal data. <Link to="/privacy" className="font-semibold underline">Read our Privacy Policy →</Link></span>
                  </div>
                </div>
              </section>

              <section id="liability" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">9</span>
                  Limitation of Liability
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <div className="p-4 rounded-xl bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm font-mono text-gray-700 dark:text-gray-300">
                    TO THE MAXIMUM EXTENT PERMITTED BY LAW, GRITSYNC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY.
                  </div>
                  <p>We do not guarantee:</p>
                  <ul className="space-y-2">
                    {['Approval or acceptance of your NCLEX application by any regulatory body', 'Specific processing times or deadlines', 'Error-free operation of the Service', 'Uninterrupted or secure access to the Service'].map(item => (
                      <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />{item}</li>
                    ))}
                  </ul>
                </div>
              </section>

              <section id="indemnification" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">10</span>
                  Indemnification
                </h2>
                <div className="pl-11 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>You agree to indemnify, defend, and hold harmless GritSync, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising out of or relating to your use of the Service, violation of these Terms, or infringement of any rights of another party.</p>
                </div>
              </section>

              <section id="termination" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">11</span>
                  Termination
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>We may terminate or suspend your account immediately, without prior notice, for reasons including:</p>
                  <ul className="space-y-2">
                    {['Violation of these Terms', 'Fraudulent or illegal activity', 'Non-payment of fees', 'Request by law enforcement or regulatory authorities'].map(item => (
                      <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />{item}</li>
                    ))}
                  </ul>
                  <p>Upon termination, your right to use the Service will immediately cease. We may delete your account and data, subject to our data retention policies and legal obligations.</p>
                </div>
              </section>

              <section id="disputes" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">12</span>
                  Dispute Resolution
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>Any disputes arising from these Terms or the Service shall be resolved through:</p>
                  <ol className="space-y-2 list-none">
                    {['Good faith negotiation between the parties', 'If negotiation fails, binding arbitration in accordance with applicable arbitration rules', 'Any legal action must be brought within one year of the cause of action arising'].map((item, i) => (
                      <li key={item} className="flex items-start gap-3">
                        <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              </section>

              <section id="governing" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">13</span>
                  Governing Law
                </h2>
                <div className="pl-11 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which GritSync operates, without regard to its conflict of law provisions.</p>
                </div>
              </section>

              <section id="changes" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">14</span>
                  Changes to Terms
                </h2>
                <div className="pl-11 space-y-4 text-gray-600 dark:text-gray-300 leading-relaxed">
                  <p>We reserve the right to modify these Terms at any time. We will notify users of material changes by:</p>
                  <ul className="space-y-2">
                    {['Posting the updated Terms on our website', 'Sending email notifications to registered users', 'Displaying a notice within the Service'].map(item => (
                      <li key={item} className="flex items-start gap-2"><ChevronRight className="h-4 w-4 text-primary-500 mt-0.5 flex-shrink-0" />{item}</li>
                    ))}
                  </ul>
                  <p>Your continued use of the Service after modifications constitutes acceptance of the updated Terms.</p>
                </div>
              </section>

              <section id="contact" className="scroll-mt-24">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/50 text-primary-700 dark:text-primary-300 text-sm font-bold flex items-center justify-center">15</span>
                  Contact Information
                </h2>
                <div className="pl-11 space-y-4">
                  <p className="text-gray-600 dark:text-gray-300 leading-relaxed">If you have any questions about these Terms, please contact us:</p>
                  <div className="grid sm:grid-cols-3 gap-4">
                    <a href="mailto:office@gritsync.com" className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:border-primary-400 dark:hover:border-primary-600 transition-colors">
                      <Mail className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Email</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">office@gritsync.com</p>
                      </div>
                    </a>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <Phone className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Phone</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{phoneNumber}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                      <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Service</p>
                        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">NCLEX Processing</p>
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              {/* Footer nav */}
              <div className="pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
                <Link to="/privacy" className="text-primary-600 dark:text-primary-400 hover:underline text-sm font-medium flex items-center gap-1">
                  <Shield className="h-4 w-4" /> View Privacy Policy
                </Link>
                <Link to="/" className="px-6 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-sm font-semibold transition-colors">
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
