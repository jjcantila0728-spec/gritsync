import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Header } from '@/components/Header'
import { HeroSlider } from '@/components/HeroSlider'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/components/ui/Toast'
import { sendEmail } from '@/lib/email-service'
import { generalSettings } from '@/lib/settings'
import { SEO, generateOrganizationSchema, generateWebSiteSchema, generateFAQSchema } from '@/components/SEO'
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
  Database,
  Cloud,
  Briefcase,
  Heart,
  Globe,
  Award
} from 'lucide-react'

export function Home() {
  const location = useLocation()
  const { showToast } = useToast()
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (location.hash) {
      const hash = location.hash.substring(1)
      setTimeout(() => {
        const element = document.getElementById(hash)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }, [location.hash])

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
      const adminEmail = await generalSettings.getAdminEmail()
      
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">New Contact Form Submission</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p><strong>Name:</strong> ${formData.name}</p>
            <p><strong>Email:</strong> ${formData.email}</p>
            <p><strong>Subject:</strong> ${formData.subject}</p>
          </div>
          <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #e5e7eb;">
            <h3 style="color: #111827; margin-bottom: 10px;">Message:</h3>
            <p style="color: #374151; white-space: pre-wrap; line-height: 1.6;">${formData.message}</p>
          </div>
        </div>
      `

      const success = await sendEmail({
        to: adminEmail,
        subject: `Contact Form: ${formData.subject}`,
        html: emailHtml,
        text: `Name: ${formData.name}\nEmail: ${formData.email}\nSubject: ${formData.subject}\n\nMessage:\n${formData.message}`
      })

      if (success) {
        showToast('Thank you! Your message has been sent successfully.', 'success')
        setFormData({
          name: '',
          email: '',
          subject: '',
          message: ''
        })
      } else {
        showToast('Failed to send message. Please try again or contact us directly.', 'error')
      }
    } catch (error) {
      console.error('Error sending contact form:', error)
      showToast('An error occurred. Please try again later.', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  const faqData = [
    {
      question: 'What is NCLEX and why do I need GritSync?',
      answer: 'NCLEX (National Council Licensure Examination) is the exam required to become a licensed nurse in the United States. GritSync simplifies the complex application process, helping you submit accurate applications, track progress, and manage documents efficiently.',
    },
    {
      question: 'How long does the NCLEX application process take?',
      answer: 'The processing time varies, but with GritSync\'s streamlined workflow, you can reduce processing time by up to 50%. Our platform ensures all documents are complete and accurate before submission, preventing delays.',
    },
    {
      question: 'Is my personal information secure?',
      answer: 'Yes, GritSync uses enterprise-grade security measures to protect your sensitive information. We are fully compliant with healthcare data regulations and employ encryption, secure storage, and regular security audits.',
    },
    {
      question: 'What services does GritSync provide?',
      answer: 'GritSync provides comprehensive NCLEX application processing services including application submission, document management, real-time tracking, quotation generation, payment processing, and 24/7 expert support.',
    },
    {
      question: 'Do I need a credit card to get started?',
      answer: 'No credit card is required to create an account. You can explore our platform, get quotes, and track applications without any upfront payment. Payment is only required when you\'re ready to process your application.',
    },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="GritSync - NCLEX Processing Agency | Filipino Nurses' Path to US Nursing Licensure"
        description="Expert NCLEX application processing for Filipino nurses pursuing the American Dream. Complete USRN licensing support, EAD applications, Visa Bulletin tracking, and dedicated document management. Fast, secure, and affordable."
        keywords="NCLEX processing Philippines, Filipino nurse USA, USRN application, NCLEX exam registration, Philippine nursing US license, EB3 visa bulletin Philippines, nursing abroad USA, CGFNS application, VisaScreen, NCLEX-RN exam, international nurse licensure, EAD work permit, green card nursing, immigration Filipino nurses"
        canonicalUrl={currentUrl}
        ogTitle="GritSync - NCLEX Processing Agency | Your Trusted Partner for US Nursing Licensure"
        ogDescription="Professional NCLEX application processing service. Helping Filipino nurses achieve their American Dream."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        twitterTitle="GritSync - NCLEX Processing Agency"
        twitterDescription="Professional NCLEX application processing service. Fast, secure, and reliable."
        twitterImage={`${baseUrl}/gritsync_logo.png`}
        structuredData={[
          generateOrganizationSchema(),
          generateWebSiteSchema(),
          generateFAQSchema(faqData),
          {
            '@context': 'https://schema.org',
            '@type': 'Service',
            serviceType: 'NCLEX Application Processing',
            description: 'Professional NCLEX application processing service helping Filipino nurses navigate the NCLEX process to become registered nurses in the United States.',
            provider: {
              '@type': 'Organization',
              name: 'GritSync',
            },
            areaServed: {
              '@type': 'Country',
              name: 'United States',
            },
            offers: {
              '@type': 'Offer',
              description: 'NCLEX application processing with real-time tracking and expert support',
            },
          },
        ]}
      />
      <Header />
      
      <HeroSlider />

      {/* Our Services - Main Focus Areas */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-4">
              <Globe className="h-4 w-4" />
              <span>Our Core Services</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Your Gateway to the <span className="text-primary-600">American Dream</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Comprehensive immigration and licensing services tailored for Filipino healthcare professionals and their families.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* NCLEX Processing - Primary */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-primary-500 to-primary-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative p-8 rounded-2xl border-2 border-primary-200 dark:border-primary-800 bg-white dark:bg-gray-800 hover:border-primary-400 dark:hover:border-primary-600 transition-all hover:shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
                    <Award className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-primary-600 dark:text-primary-400">Primary Service</span>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      NCLEX Processing
                    </h3>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">
                  Helping Filipino nurses achieve their dream of becoming licensed healthcare professionals in the United States. Our expert team handles every step of the complex application process.
                </p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="h-5 w-5 text-primary-500 flex-shrink-0" />
                    <span>Complete application submission & tracking</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="h-5 w-5 text-primary-500 flex-shrink-0" />
                    <span>Document verification & management</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="h-5 w-5 text-primary-500 flex-shrink-0" />
                    <span>State-by-state licensing guidance</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="h-5 w-5 text-primary-500 flex-shrink-0" />
                    <span>24/7 expert support in English & Filipino</span>
                  </li>
                </ul>
                <Link to="/quote">
                  <Button size="lg" className="w-full">
                    Get NCLEX Quote
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>

            {/* EAD Application - Secondary */}
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl blur-xl opacity-20 group-hover:opacity-30 transition-opacity" />
              <div className="relative p-8 rounded-2xl border-2 border-blue-200 dark:border-blue-800 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all hover:shadow-xl">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg">
                    <Briefcase className="h-8 w-8 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-medium text-blue-600 dark:text-blue-400">Family Service</span>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                      EAD Application
                    </h3>
                  </div>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-6 text-lg">
                  Help your dependents work legally in the USA with our streamlined Employment Authorization Document (EAD) application service. Keep your family together on your American journey.
                </p>
                <ul className="space-y-3 mb-6">
                  <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>I-765 form preparation & filing</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>Dependent visa work authorization</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>USCIS correspondence handling</span>
                  </li>
                  <li className="flex items-center gap-3 text-gray-700 dark:text-gray-300">
                    <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0" />
                    <span>Renewal & extension assistance</span>
                  </li>
                </ul>
                <Link to="/ead-application">
                  <Button size="lg" variant="outline" className="w-full border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20">
                    Start EAD Application
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* GritSync Perks Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium mb-4">
              <Heart className="h-4 w-4" />
              <span>Exclusive Benefits</span>
            </div>
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Perks of Being a <span className="text-primary-600">GritSync</span> Client
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              More than just application processing - we provide a complete ecosystem to support your professional journey.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Personalized Business Mail */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center flex-shrink-0">
                  <Mail className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                    Personalized Business Mail
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Get your own professional GritSync email address to communicate with agencies, employers, and institutions with credibility.
                  </p>
                  <div className="inline-block px-4 py-2 bg-purple-50 dark:bg-purple-900/30 rounded-lg">
                    <code className="text-purple-700 dark:text-purple-300 font-mono text-sm">
                      yourname@gritsync.com
                    </code>
                  </div>
                </div>
              </div>
            </div>

            {/* Full Client Database */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center flex-shrink-0">
                  <Database className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                    Full Client Database
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    All your application data, history, and progress in one secure dashboard. Access your complete profile anytime, anywhere.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">Real-time sync</span>
                    <span className="px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm">Multi-device</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Dedicated Document Storage */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl transition-shadow md:col-span-2">
              <div className="flex flex-col md:flex-row items-start gap-6">
                <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-500 flex items-center justify-center flex-shrink-0">
                  <Cloud className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">
                    Dedicated Document Cloud Storage
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Securely store all your important documents - passports, diplomas, certificates, and more. Upload once and use them across all your applications. Enterprise-grade encryption keeps your sensitive information safe.
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Shield className="h-6 w-6 text-green-500 mx-auto mb-1" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Encrypted</span>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <CheckCircle className="h-6 w-6 text-green-500 mx-auto mb-1" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Auto-backup</span>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Clock className="h-6 w-6 text-green-500 mx-auto mb-1" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">24/7 Access</span>
                    </div>
                    <div className="text-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <Globe className="h-6 w-6 text-green-500 mx-auto mb-1" />
                      <span className="text-sm text-gray-600 dark:text-gray-400">Anywhere</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white dark:bg-gray-900 scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Comprehensive tools and services designed to make your application process seamless
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="p-8 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg">
              <div className="w-14 h-14 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6">
                <FileText className="h-7 w-7 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Application Processing
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Submit and track your applications with our intuitive, step-by-step form. All required fields and documents in one place.
              </p>
            </div>

            <div className="p-8 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg">
              <div className="w-14 h-14 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
                <DollarSign className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Quotation Generator
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Get instant, transparent quotes for your processing needs. No hidden fees, clear pricing upfront.
              </p>
            </div>

            <div className="p-8 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg">
              <div className="w-14 h-14 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                <ClipboardList className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Real-Time Tracking
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Monitor your application status in real-time. Get instant notifications on updates and approvals.
              </p>
            </div>

            <div className="p-8 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg">
              <div className="w-14 h-14 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-6">
                <Shield className="h-7 w-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Secure & Compliant
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enterprise-grade security protecting your sensitive information. Fully compliant with healthcare data regulations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                Why Choose GritSync?
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                We understand the challenges of navigating the US immigration and licensing process. That's why we've built a platform that puts Filipino healthcare professionals first.
              </p>
              
              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                    <Clock className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                      Fast Processing
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Reduce processing time by up to 50% with our streamlined workflow and automated verification.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                      Expert Filipino Support
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Our team of specialists speaks your language and understands your journey. Available 24/7 in English and Filipino.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                      Error-Free Applications
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Built-in validation ensures your applications are complete and accurate before submission.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700">
                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary-600 dark:bg-primary-500 flex items-center justify-center text-white font-semibold">
                        MR
                      </div>
                      <div>
                        <p className="font-semibold text-gray-900 dark:text-gray-100">Maria Reyes</p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Filipino Nurse, California</p>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-700 dark:text-gray-300 italic">
                    "GritSync made my American Dream possible! The team guided me through every step of the NCLEX process. I'm now a licensed nurse in California, and I couldn't have done it without them. Maraming salamat!"
                  </p>
                </div>
              </div>
              
              <div className="absolute -bottom-6 -right-6 bg-primary-600 dark:bg-primary-500 text-white p-6 rounded-xl shadow-lg">
                <div className="text-3xl font-bold">500+</div>
                <div className="text-sm opacity-90">Filipino Nurses Licensed</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section id="pricing" className="py-20 bg-primary-600 dark:bg-primary-700 text-white scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">500+</div>
              <div className="text-primary-100">Applications Processed</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">98%</div>
              <div className="text-primary-100">Success Rate</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">24/7</div>
              <div className="text-primary-100">Support Available</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2">50%</div>
              <div className="text-primary-100">Faster Processing</div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 bg-white dark:bg-gray-900 scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Get in Touch
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Have questions? We're here to help. Send us a message and we'll get back to you as soon as possible.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-8">
              <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl p-8 border-2 border-primary-200 dark:border-primary-800">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-lg bg-primary-600 dark:bg-primary-500 flex items-center justify-center">
                    <Mail className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                    Send us a Message
                  </h3>
                </div>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    type="text"
                    name="name"
                    label="Your Name"
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                  />
                  
                  <Input
                    type="email"
                    name="email"
                    label="Your Email"
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                  />
                  
                  <Input
                    type="text"
                    name="subject"
                    label="Subject"
                    placeholder="What is this regarding?"
                    value={formData.subject}
                    onChange={handleInputChange}
                    required
                    disabled={isSubmitting}
                  />
                  
                  <div className="w-full">
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Message
                    </label>
                    <textarea
                      name="message"
                      rows={6}
                      placeholder="Tell us how we can help you..."
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      disabled={isSubmitting}
                      className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                    />
                  </div>
                  
                  <Button
                    type="submit"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <>Sending...</>
                    ) : (
                      <>
                        Send Message
                        <Send className="ml-2 h-5 w-5" />
                      </>
                    )}
                  </Button>
                </form>
              </div>

              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border-2 border-gray-200 dark:border-gray-700">
                  <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                    Ready to Get Started?
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                    Join hundreds of Filipino nursing professionals who trust GritSync for their application processing.
                  </p>
                  <div className="flex flex-col gap-4">
                    <Link to="/register">
                      <Button size="lg" className="w-full text-lg">
                        Create Free Account
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    </Link>
                    <Link to="/login">
                      <Button variant="outline" size="lg" className="w-full text-lg">
                        Sign In
                      </Button>
                    </Link>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border-2 border-gray-200 dark:border-gray-700">
                  <h4 className="text-xl font-semibold mb-6 text-gray-900 dark:text-gray-100">
                    Other Ways to Reach Us
                  </h4>
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Email Support</h5>
                      <a href="mailto:support@gritsync.com" className="text-primary-600 dark:text-primary-400 hover:underline flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        support@gritsync.com
                      </a>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Phone Support</h5>
                      <a href="tel:+1234567890" className="text-primary-600 dark:text-primary-400 hover:underline">
                        +1 (234) 567-890
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-black text-gray-400 py-12">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="logo-container">
                  <img 
                    src="/gritsync_logo.png" 
                    alt="GritSync Logo" 
                    className="rounded-lg"
                  />
                </div>
                <span className="text-xl font-bold text-white">GritSync</span>
              </div>
              <p className="text-sm">
                Your trusted partner for NCLEX and EAD application processing. Helping Filipino healthcare professionals achieve their American Dream.
              </p>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Services</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/quote" className="hover:text-primary-400 transition-colors">NCLEX Processing</Link></li>
                <li><Link to="/ead-application" className="hover:text-primary-400 transition-colors">EAD Application</Link></li>
                <li><Link to="/tracking" className="hover:text-primary-400 transition-colors">Track Applications</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/about-us" className="hover:text-primary-400 transition-colors">About Us</Link></li>
                <li><a href="#contact" className="hover:text-primary-400 transition-colors">Contact</a></li>
                <li><Link to="/privacy" className="hover:text-primary-400 transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-primary-400 transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-primary-400 transition-colors">Help Center</a></li>
                <li><a href="#" className="hover:text-primary-400 transition-colors">Documentation</a></li>
                <li><a href="#" className="hover:text-primary-400 transition-colors">FAQs</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>&copy; {new Date().getFullYear()} GritSync. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
