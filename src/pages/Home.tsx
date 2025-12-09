import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
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
  Zap,
  Mail,
  Send,
  ChevronDown,
  HelpCircle,
  ChevronLeft,
  ChevronRight,
  Award,
  TrendingUp,
  Globe
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
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const [phoneNumber, setPhoneNumber] = useState('+1 (509) 270-3437')
  const [currentSlide, setCurrentSlide] = useState(0)

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
    // Handle scroll to section when page loads with hash
    if (location.hash) {
      const hash = location.hash.substring(1) // Remove the #
      setTimeout(() => {
        const element = document.getElementById(hash)
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }
      }, 100)
    }
  }, [location.hash])

  // Auto-play slider
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3)
    }, 6000) // Change slide every 6 seconds

    return () => clearInterval(interval)
  }, [])

  const goToSlide = (index: number) => {
    setCurrentSlide(index)
  }

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % 3)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + 3) % 3)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validation
    if (!formData.name || !formData.email || !formData.subject || !formData.message) {
      showToast('Please fill in all fields', 'error')
      return
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.email)) {
      showToast('Please enter a valid email address', 'error')
      return
    }

    setIsSubmitting(true)

    try {
      // Get admin email
      const adminEmail = await generalSettings.getAdminEmail()
      
      // Create email HTML
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

      // Send email to admin
      const success = await sendEmail({
        to: adminEmail,
        subject: `Contact Form: ${formData.subject}`,
        html: emailHtml,
        text: `Name: ${formData.name}\nEmail: ${formData.email}\nSubject: ${formData.subject}\n\nMessage:\n${formData.message}`
      })

      if (success) {
        showToast('Thank you! Your message has been sent successfully.', 'success')
        // Reset form
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
      answer: 'NCLEX (National Council Licensure Examination) is the standardized exam required to become a licensed registered nurse (RN) or licensed practical/vocational nurse (LPN/LVN) in the United States. The application process involves multiple steps including credential evaluation, state board approval, and exam registration. GritSync simplifies this complex process by providing a centralized platform where you can submit accurate applications, track your progress in real-time, manage all required documents efficiently, and receive expert guidance throughout your journey. We help eliminate common errors that cause delays and ensure your application meets all state board requirements.',
    },
    {
      question: 'How long does the NCLEX application process take?',
      answer: 'The processing time varies depending on the state board and your individual circumstances, typically ranging from 2-6 months. However, with GritSync\'s streamlined workflow and expert review process, you can reduce processing time by up to 50%. Our platform ensures all documents are complete, properly formatted, and accurate before submission, preventing common delays caused by missing information or errors. We also provide real-time status updates so you always know where your application stands in the process.',
    },
    {
      question: 'Is my personal information secure?',
      answer: 'Yes, absolutely. GritSync uses enterprise-grade security measures to protect your sensitive information. We are fully compliant with healthcare data regulations including HIPAA (Health Insurance Portability and Accountability Act) and employ multiple layers of security including end-to-end encryption, secure cloud storage with regular backups, two-factor authentication, and regular security audits. Your documents and personal data are stored securely and only accessible to authorized personnel. We never share your information with third parties without your explicit consent.',
    },
    {
      question: 'What services does GritSync provide?',
      answer: 'GritSync provides comprehensive NCLEX application processing services including: application form preparation and submission, credential evaluation assistance, document management and verification, real-time application tracking with status updates, quotation generation with transparent pricing, secure payment processing, 24/7 expert support via email and phone, state board communication management, timeline guidance and deadline reminders, and post-application support. We handle the entire process from initial application to exam registration, making your journey to becoming a USRN as smooth as possible.',
    },
    {
      question: 'Do I need a credit card to get started?',
      answer: 'No credit card is required to create an account or get started. You can explore our platform, request quotes, track applications, and access most features without any upfront payment. Payment is only required when you\'re ready to process your application and have received a quotation. We offer multiple payment options including credit cards, bank transfers, and other secure payment methods. You can also choose to pay in installments for certain services.',
    },
    {
      question: 'Which states can GritSync help me apply to?',
      answer: 'GritSync can assist with NCLEX applications for all 50 states in the United States, as well as the District of Columbia. Each state has its own Board of Nursing with specific requirements and processes. Our team is familiar with the requirements for all major states including California, New York, Texas, Florida, and others. We stay updated on the latest changes in state board requirements and can guide you through the specific process for your chosen state. Some states have more complex requirements than others, and we can help you understand what\'s needed for your specific situation.',
    },
    {
      question: 'What documents do I need to prepare for my NCLEX application?',
      answer: 'The required documents vary by state, but typically include: nursing school transcripts, nursing license from your home country (if applicable), English proficiency test results (TOEFL or IELTS for international nurses), criminal background check, passport or identification documents, passport-sized photos, application forms, and any additional state-specific requirements. GritSync provides a comprehensive checklist based on your selected state and helps you gather, organize, and verify all necessary documents before submission. We also assist with document translation and notarization when required.',
    },
    {
      question: 'Can I track my application status in real-time?',
      answer: 'Yes! GritSync provides real-time application tracking through our user-friendly dashboard. Once you submit an application, you can log in anytime to see the current status, view timeline updates, check which documents have been received and verified, see any pending actions required, and receive instant notifications when there are status changes. Our tracking system shows you exactly where your application is in the process, from initial submission through state board review to exam registration approval. You\'ll never be left wondering about your application status.',
    },
    {
      question: 'What if I need to make changes to my application?',
      answer: 'If you need to make changes to your application, contact our support team immediately. We can help you update information, add missing documents, or correct errors depending on where your application is in the process. Changes made early in the process are typically easier to handle. If your application has already been submitted to the state board, we\'ll guide you through the official amendment process. Our team is experienced in handling various types of corrections and can minimize any potential delays. It\'s always better to catch and fix errors early, which is why our review process catches most issues before submission.',
    },
    {
      question: 'How much does NCLEX application processing cost?',
      answer: 'The cost varies depending on several factors including the state you\'re applying to, whether you\'re a first-time applicant or retaker, and which services you need. GritSync offers transparent, upfront pricing with no hidden fees. You can get an instant quote through our quotation generator by selecting your state and service type. Our pricing includes application preparation, document review, submission assistance, and ongoing support. We also offer package deals for multiple services. Payment plans are available for qualified applicants. Contact us for a personalized quote based on your specific needs.',
    },
    {
      question: 'Do you provide support after I pass the NCLEX exam?',
      answer: 'Yes, GritSync provides comprehensive support throughout your entire journey, including post-exam assistance. After you pass the NCLEX, we can help you with license activation, understanding your state\'s continuing education requirements, job search resources, and transitioning to practice in the United States. We also offer career guidance and can connect you with our network of healthcare employers. Our relationship with you doesn\'t end at exam completion - we\'re here to support your success as a USRN.',
    },
    {
      question: 'What makes GritSync different from other NCLEX processing services?',
      answer: 'GritSync stands out through several key advantages: we were founded by experienced USRNs who understand the challenges firsthand, our platform combines technology with personalized expert support, we offer real-time tracking and transparency throughout the process, our team provides 24/7 support, we have a 98% success rate with applications, we use secure, compliant systems for data protection, we offer flexible payment options, and we provide end-to-end support from application to licensure. Our mission is to make the NCLEX journey accessible, affordable, and stress-free for nurses worldwide.',
    },
    {
      question: 'Can I apply for NCLEX sponsorship through GritSync?',
      answer: 'Yes! GritSync offers NCLEX sponsorship programs to help eligible nurses who face financial barriers. Our sponsorship program provides financial assistance for exam fees and related costs. To apply, visit our sponsorship application page where you can submit your information, including your financial need statement, academic achievements, and motivation for becoming a USRN. Applications are reviewed by our team, and selected candidates receive funding support. We also accept donations from individuals and organizations who want to support nurses\' dreams of becoming USRNs. Check our sponsorship page for current availability and application deadlines.',
    },
    {
      question: 'What happens if my application is rejected?',
      answer: 'While we work hard to ensure applications are complete and accurate, sometimes state boards may request additional information or clarification. If this happens, GritSync will immediately notify you and help you address any issues. We\'ll review the rejection reason, gather any additional required documents, and resubmit your application. In most cases, rejections are due to missing information or documentation errors, which we can quickly resolve. Our team has experience handling various rejection scenarios and knows how to address them effectively. We also offer a review of your application before submission to catch potential issues early.',
    },
    {
      question: 'How do I get started with GritSync?',
      answer: 'Getting started is easy! First, create a free account on our platform - no credit card required. Then, you can request a quote by selecting your state and service type. Once you receive your quotation and are ready to proceed, you can submit your application through our secure platform. Our team will review your information, help you gather any missing documents, and guide you through each step. You can also track your application status in real-time through your dashboard. If you have questions at any point, our support team is available 24/7 to assist you. Start your journey today by creating an account or requesting a quote!',
    },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="GritSync - NCLEX Processing Agency | Your Trusted Partner for US Nursing Licensure"
        description="Professional NCLEX application processing service. Get expert assistance with NCLEX applications, document management, and payment processing. Fast, secure, and reliable. Trusted by nurses worldwide."
        keywords="NCLEX, NCLEX application, nursing license, US nursing, NCLEX processing, nursing exam, registered nurse, NCLEX assistance, NCLEX sponsorship, nursing career, healthcare jobs, NCLEX tracking, nursing application"
        canonicalUrl={currentUrl}
        ogTitle="GritSync - NCLEX Processing Agency | Your Trusted Partner for US Nursing Licensure"
        ogDescription="Professional NCLEX application processing service. Get expert assistance with NCLEX applications, document management, and payment processing. Trusted by nurses worldwide."
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
            description: 'Professional NCLEX application processing service helping nurses navigate the NCLEX process to become registered nurses in the United States.',
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
      
      {/* Enhanced Hero Banner with 3 Sliders - Christmas Theme */}
      <section className="relative overflow-hidden bg-gradient-to-br from-red-50 via-white to-green-50 dark:from-red-950/30 dark:via-gray-900 dark:to-green-950/30 min-h-[600px] md:min-h-[700px]">
        {/* Christmas Background Elements */}
        <div className="absolute inset-0 overflow-hidden z-0">
          {/* Christmas-themed gradient orbs */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-red-200 dark:bg-red-900/40 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-40 animate-blob"></div>
          <div className="absolute top-40 right-10 w-72 h-72 bg-green-200 dark:bg-green-900/40 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-40 animate-blob animation-delay-2000"></div>
          <div className="absolute -bottom-8 left-1/2 w-72 h-72 bg-red-300/30 dark:bg-red-800/30 rounded-full mix-blend-multiply dark:mix-blend-soft-light filter blur-3xl opacity-30 animate-blob animation-delay-4000"></div>
        </div>

        {/* Falling Snow Effect */}
        <div className="absolute inset-0 overflow-hidden z-[5] pointer-events-none">
          {Array.from({ length: 50 }).map((_, i) => {
            const left = Math.random() * 100;
            const delay = Math.random() * 5;
            const duration = 10 + Math.random() * 10;
            const size = Math.random() < 0.33 ? 'small' : Math.random() < 0.66 ? 'medium' : 'large';
            const isSlow = Math.random() < 0.3;
            const drift = (Math.random() - 0.5) * 100;
            
            return (
              <div
                key={i}
                className={`snowflake snowflake-${size} ${isSlow ? 'snowflake-slow' : ''}`}
                style={{
                  left: `${left}%`,
                  animationDelay: `${delay}s`,
                  animationDuration: `${duration}s`,
                  '--snow-drift': `${drift}px`,
                  '--snow-drift-slow': `${drift * 0.5}px`,
                } as React.CSSProperties & { '--snow-drift'?: string; '--snow-drift-slow'?: string }}
              />
            );
          })}
        </div>

        {/* Slider Container */}
        <div className="relative w-full min-h-[600px] md:min-h-[700px] z-10">
          {/* Slide 1 - Main Hero */}
          <div 
            className={`absolute inset-0 transition-all duration-1000 ease-in-out flex items-center ${
              currentSlide === 0 
                ? 'opacity-100 translate-x-0 scale-100 z-10' 
                : currentSlide === 1 
                ? 'opacity-0 -translate-x-full scale-95 z-0' 
                : 'opacity-0 translate-x-full scale-95 z-0'
            }`}
          >
            <div className="container mx-auto px-4 py-20 md:py-32 w-full">
              <div className="max-w-4xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6 animate-fade-in-up">
                  <Zap className="h-4 w-4 animate-pulse" />
                  <span>Streamline Your NCLEX Application Process</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-gray-100 leading-tight animate-fade-in-up animation-delay-200">
                  Your Trusted Partner for
                  <span className="text-primary-600 dark:text-primary-400 block mt-2 animate-gradient bg-gradient-to-r from-primary-600 via-blue-600 to-purple-600 bg-clip-text text-transparent">
                    NCLEX Processing
                  </span>
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto animate-fade-in-up animation-delay-400">
                  Simplify your journey to becoming a licensed nurse. Fast, secure, and reliable application processing with real-time tracking.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12 animate-fade-in-up animation-delay-600">
                  <Link to="/quote">
                    <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                      Get a quote
                      <ArrowRight className="ml-2 h-5 w-5 animate-bounce-x" />
                    </Button>
                  </Link>
                  <Link to="/register">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 py-6 transform hover:scale-105 transition-all duration-300">
                      Apply Now
                    </Button>
                  </Link>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-600 dark:text-gray-400 animate-fade-in-up animation-delay-800">
                  <Link to="/register" className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group">
                    <CheckCircle className="h-5 w-5 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform" />
                    <span>No Credit Card Required</span>
                  </Link>
                  <Link to="#contact" onClick={(e) => {
                    e.preventDefault()
                    const contactSection = document.getElementById('contact')
                    if (contactSection) {
                      contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  }} className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group">
                    <CheckCircle className="h-5 w-5 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform" />
                    <span>24/7 Support</span>
                  </Link>
                  <Link to="/about-us" className="flex items-center gap-2 hover:text-primary-600 dark:hover:text-primary-400 transition-colors group">
                    <CheckCircle className="h-5 w-5 text-primary-600 dark:text-primary-400 group-hover:scale-110 transition-transform" />
                    <span>Secure & Compliant</span>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Slide 2 - Success Stories */}
          <div 
            className={`absolute inset-0 transition-all duration-1000 ease-in-out flex items-center ${
              currentSlide === 1 
                ? 'opacity-100 translate-x-0 scale-100 z-10' 
                : currentSlide === 0 
                ? 'opacity-0 translate-x-full scale-95 z-0' 
                : 'opacity-0 -translate-x-full scale-95 z-0'
            }`}
          >
            <div className="container mx-auto px-4 py-20 md:py-32 w-full">
              <div className="max-w-4xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-medium mb-6 animate-fade-in-up">
                  <Award className="h-4 w-4 animate-spin-slow" />
                  <span>Trusted by 1,247+ Licensed Nurses</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-gray-100 leading-tight animate-fade-in-up animation-delay-200">
                  Join Thousands of
                  <span className="text-green-600 dark:text-green-400 block mt-2">
                    Successful USRNs
                  </span>
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto animate-fade-in-up animation-delay-400">
                  Experience the fastest, most reliable NCLEX processing. Our 98.2% success rate speaks for itself.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-fade-in-up animation-delay-600">
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border-2 border-green-200 dark:border-green-800 transform hover:scale-105 transition-all duration-300">
                    <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">98.2%</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Success Rate</div>
                  </div>
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border-2 border-blue-200 dark:border-blue-800 transform hover:scale-105 transition-all duration-300">
                    <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">45%</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Faster Processing</div>
                  </div>
                  <div className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-xl p-6 border-2 border-purple-200 dark:border-purple-800 transform hover:scale-105 transition-all duration-300">
                    <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">4.9/5</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">Average Rating</div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-800">
                  <Link to="/register">
                    <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                      Start Your Journey
                      <ArrowRight className="ml-2 h-5 w-5 animate-bounce-x" />
                    </Button>
                  </Link>
                  <Link to="/tracking">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 py-6 transform hover:scale-105 transition-all duration-300">
                      View Success Stories
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Slide 3 - Global Reach */}
          <div 
            className={`absolute inset-0 transition-all duration-1000 ease-in-out flex items-center ${
              currentSlide === 2 
                ? 'opacity-100 translate-x-0 scale-100 z-10' 
                : currentSlide === 0 
                ? 'opacity-0 -translate-x-full scale-95 z-0' 
                : 'opacity-0 translate-x-full scale-95 z-0'
            }`}
          >
            <div className="container mx-auto px-4 py-20 md:py-32 w-full">
              <div className="max-w-4xl mx-auto text-center">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-sm font-medium mb-6 animate-fade-in-up">
                  <Globe className="h-4 w-4 animate-spin-slow" />
                  <span>Serving Nurses Worldwide</span>
                </div>
                <h1 className="text-4xl md:text-6xl font-bold mb-6 text-gray-900 dark:text-gray-100 leading-tight animate-fade-in-up animation-delay-200">
                  Your Gateway to
                  <span className="text-blue-600 dark:text-blue-400 block mt-2">
                    US Nursing Licensure
                  </span>
                </h1>
                <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto animate-fade-in-up animation-delay-400">
                  From application to licensure, we guide nurses from around the world through every step of their NCLEX journey.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-6 mb-12 animate-fade-in-up animation-delay-600">
                  <div className="flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg px-6 py-4 border-2 border-blue-200 dark:border-blue-800 transform hover:scale-105 transition-all duration-300">
                    <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                    <div className="text-left">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">50 States</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Full Coverage</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg px-6 py-4 border-2 border-green-200 dark:border-green-800 transform hover:scale-105 transition-all duration-300">
                    <Users className="h-6 w-6 text-green-600 dark:text-green-400" />
                    <div className="text-left">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">2,856+</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Applications</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg px-6 py-4 border-2 border-purple-200 dark:border-purple-800 transform hover:scale-105 transition-all duration-300">
                    <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                    <div className="text-left">
                      <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">24/7</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">Support</div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in-up animation-delay-800">
                  <Link to="/quote">
                    <Button size="lg" className="w-full sm:w-auto text-lg px-8 py-6 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                      Get Started Today
                      <ArrowRight className="ml-2 h-5 w-5 animate-bounce-x" />
                    </Button>
                  </Link>
                  <Link to="/about-us">
                    <Button variant="outline" size="lg" className="w-full sm:w-auto text-lg px-8 py-6 transform hover:scale-105 transition-all duration-300">
                      Learn More
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Arrows */}
          <button
            onClick={prevSlide}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-30 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 group"
            aria-label="Previous slide"
          >
            <ChevronLeft className="h-6 w-6 text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
          </button>
          <button
            onClick={nextSlide}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-30 bg-white/90 dark:bg-gray-800/90 hover:bg-white dark:hover:bg-gray-800 rounded-full p-3 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-110 group"
            aria-label="Next slide"
          >
            <ChevronRight className="h-6 w-6 text-gray-700 dark:text-gray-300 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors" />
          </button>

          {/* Navigation Dots */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-30 flex gap-3">
            {[0, 1, 2].map((index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className={`transition-all duration-300 rounded-full ${
                  currentSlide === index
                    ? 'w-12 h-3 bg-primary-600 dark:bg-primary-400 shadow-lg'
                    : 'w-3 h-3 bg-gray-400 dark:bg-gray-600 hover:bg-gray-500 dark:hover:bg-gray-500'
                }`}
                aria-label={`Go to slide ${index + 1}`}
              />
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white dark:bg-gray-900 scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <Link to="#features" className="inline-block">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
              Everything You Need to Succeed
            </h2>
            </Link>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Comprehensive tools and services designed to make your NCLEX application process seamless
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <Link to="/application/new" className="block">
              <div className="p-8 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg cursor-pointer h-full">
              <div className="w-14 h-14 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-6">
                <FileText className="h-7 w-7 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Application Processing
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Submit and track your NCLEX applications with our intuitive, step-by-step form. All required fields and documents in one place.
              </p>
                <div className="mt-4 flex items-center text-primary-600 dark:text-primary-400 text-sm font-medium">
                  Get Started <ArrowRight className="ml-2 h-4 w-4" />
                </div>
            </div>
            </Link>

            <Link to="/quote" className="block">
              <div className="p-8 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg cursor-pointer h-full">
              <div className="w-14 h-14 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-6">
                <DollarSign className="h-7 w-7 text-blue-600 dark:text-blue-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Quotation Generator
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Get instant, transparent quotes for your processing needs. No hidden fees, clear pricing upfront.
              </p>
                <div className="mt-4 flex items-center text-blue-600 dark:text-blue-400 text-sm font-medium">
                  Get a Quote <ArrowRight className="ml-2 h-4 w-4" />
                </div>
            </div>
            </Link>

            <Link to="/tracking" className="block">
              <div className="p-8 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg cursor-pointer h-full">
              <div className="w-14 h-14 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-6">
                <ClipboardList className="h-7 w-7 text-green-600 dark:text-green-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Real-Time Tracking
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Monitor your application status in real-time. Get instant notifications on updates and approvals.
              </p>
                <div className="mt-4 flex items-center text-green-600 dark:text-green-400 text-sm font-medium">
                  Track Now <ArrowRight className="ml-2 h-4 w-4" />
                </div>
            </div>
            </Link>

            <Link to="/about-us" className="block">
              <div className="p-8 rounded-xl border-2 border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-800 hover:border-primary-300 dark:hover:border-primary-700 transition-all hover:shadow-lg cursor-pointer h-full">
              <div className="w-14 h-14 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-6">
                <Shield className="h-7 w-7 text-purple-600 dark:text-purple-400" />
              </div>
              <h3 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                Secure & Compliant
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Enterprise-grade security protecting your sensitive information. Fully compliant with healthcare data regulations.
              </p>
                <div className="mt-4 flex items-center text-purple-600 dark:text-purple-400 text-sm font-medium">
                  Learn More <ArrowRight className="ml-2 h-4 w-4" />
                </div>
            </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-gray-50 dark:bg-gray-800 scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <Link to="#benefits" className="inline-block">
                <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                Why Choose GritSync?
              </h2>
              </Link>
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
                We understand the challenges of the NCLEX application process. That's why we've built a platform that puts you first.
              </p>
              
              <div className="space-y-6">
                <Link to="/tracking" className="block">
                  <div className="flex items-start gap-4 hover:bg-white/50 dark:hover:bg-gray-700/50 p-4 rounded-lg transition-colors cursor-pointer">
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
                </Link>

                <Link to="/about-us" className="block">
                  <div className="flex items-start gap-4 hover:bg-white/50 dark:hover:bg-gray-700/50 p-4 rounded-lg transition-colors cursor-pointer">
                  <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                      Expert Support
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Our team of NCLEX specialists is available 24/7 to guide you through every step of the process.
                    </p>
                  </div>
                </div>
                </Link>

                <Link to="/application/new" className="block">
                  <div className="flex items-start gap-4 hover:bg-white/50 dark:hover:bg-gray-700/50 p-4 rounded-lg transition-colors cursor-pointer">
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
                </Link>
              </div>
            </div>

            <Link to="/tracking" className="block">
              <div className="relative">
                <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl p-8 border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer">
                  <div className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-600 dark:to-primary-800 flex items-center justify-center text-white font-semibold text-lg">
                          MC
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">Maria Cruz, RN</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">New York State Board • Licensed 2023</p>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                      "As a nurse from the Philippines, I was overwhelmed by the NCLEX application process. GritSync's team guided me through every step, from document preparation to state board submission. What would have taken me 6 months, they helped me complete in just 3 months. I'm now working as an RN in New York!"
                    </p>
                    <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                      <p className="text-xs text-gray-500 dark:text-gray-400">Verified USRN • Application #GRIT-2023-0847</p>
                    </div>
                  </div>
                </div>
                
                <Link to="/tracking" onClick={(e) => e.stopPropagation()} className="absolute -bottom-6 -right-6 bg-gradient-to-br from-primary-600 to-primary-700 dark:from-primary-500 dark:to-primary-600 text-white p-6 rounded-xl shadow-lg transform hover:scale-105 transition-transform cursor-pointer">
                  <div className="text-3xl font-bold">1,247+</div>
                  <div className="text-sm opacity-90">Nurses Licensed</div>
                </Link>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* Statistics Section */}
      <section id="statistics" className="py-20 bg-primary-600 dark:bg-primary-700 text-white scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <Link to="#statistics" className="inline-block">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 hover:text-primary-200 transition-colors">Trusted by Nurses Worldwide</h2>
            </Link>
            <p className="text-xl text-primary-100 max-w-2xl mx-auto">
              Real results from real nurses who achieved their USRN dreams
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div className="bg-white/10 dark:bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/20">
              <div className="text-4xl md:text-5xl font-bold mb-2">1,247+</div>
              <div className="text-primary-100 text-sm md:text-base">Nurses Licensed</div>
              <div className="text-primary-200 text-xs mt-2">Across 50 states</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/20">
              <div className="text-4xl md:text-5xl font-bold mb-2">98.2%</div>
              <div className="text-primary-100 text-sm md:text-base">Success Rate</div>
              <div className="text-primary-200 text-xs mt-2">First-time approvals</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/20">
              <div className="text-4xl md:text-5xl font-bold mb-2">24/7</div>
              <div className="text-primary-100 text-sm md:text-base">Expert Support</div>
              <div className="text-primary-200 text-xs mt-2">Always available</div>
            </div>
            <div className="bg-white/10 dark:bg-white/5 rounded-xl p-6 backdrop-blur-sm border border-white/20">
              <div className="text-4xl md:text-5xl font-bold mb-2">45%</div>
              <div className="text-primary-100 text-sm md:text-base">Faster Processing</div>
              <div className="text-primary-200 text-xs mt-2">Average time saved</div>
            </div>
          </div>
          <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
            <div>
              <div className="text-2xl md:text-3xl font-bold mb-1">2,856+</div>
              <div className="text-primary-200 text-sm">Applications Processed</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold mb-1">4.9/5</div>
              <div className="text-primary-200 text-sm">Average Rating</div>
            </div>
            <div>
              <div className="text-2xl md:text-3xl font-bold mb-1">15+</div>
              <div className="text-primary-200 text-sm">Years Combined Experience</div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-white dark:bg-gray-900 scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              <span>Simple Process</span>
            </div>
            <Link to="#how-it-works" className="inline-block">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                How It Works
              </h2>
            </Link>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Your journey to becoming a USRN in four simple steps
            </p>
          </div>

          <div className="max-w-5xl mx-auto">
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              <Link to="/register" className="block">
                <div className="relative">
                  <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl p-6 border-2 border-primary-200 dark:border-primary-800 hover:border-primary-400 dark:hover:border-primary-600 transition-all cursor-pointer">
                    <div className="w-16 h-16 rounded-full bg-primary-600 dark:bg-primary-500 text-white flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                      1
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-center text-gray-900 dark:text-gray-100">
                      Create Account
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
                      Sign up for free in minutes. No credit card required. Get instant access to our platform.
                    </p>
                  </div>
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-8 w-8 text-primary-400" />
                  </div>
                </div>
              </Link>

              <Link to="/quote" className="block">
                <div className="relative">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-2xl p-6 border-2 border-blue-200 dark:border-blue-800 hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer">
                    <div className="w-16 h-16 rounded-full bg-blue-600 dark:bg-blue-500 text-white flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                      2
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-center text-gray-900 dark:text-gray-100">
                      Get a Quote
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
                      Use our quotation generator to get instant, transparent pricing for your state and service type.
                    </p>
                  </div>
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-8 w-8 text-blue-400" />
                  </div>
                </div>
              </Link>

              <Link to="/application/new" className="block">
                <div className="relative">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-2xl p-6 border-2 border-green-200 dark:border-green-800 hover:border-green-400 dark:hover:border-green-600 transition-all cursor-pointer">
                    <div className="w-16 h-16 rounded-full bg-green-600 dark:bg-green-500 text-white flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                      3
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-center text-gray-900 dark:text-gray-100">
                      Submit Application
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
                      Our team reviews your documents, ensures accuracy, and submits to your state board.
                    </p>
                  </div>
                  <div className="hidden lg:block absolute top-1/2 -right-4 transform -translate-y-1/2 z-10">
                    <ArrowRight className="h-8 w-8 text-green-400" />
                  </div>
                </div>
              </Link>

              <Link to="/tracking" className="block">
                <div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-2xl p-6 border-2 border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600 transition-all cursor-pointer">
                    <div className="w-16 h-16 rounded-full bg-purple-600 dark:bg-purple-500 text-white flex items-center justify-center text-2xl font-bold mb-4 mx-auto">
                      4
                    </div>
                    <h3 className="text-xl font-semibold mb-3 text-center text-gray-900 dark:text-gray-100">
                      Track & Succeed
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 text-center text-sm">
                      Monitor your progress in real-time, receive updates, and get licensed as a USRN.
                    </p>
                  </div>
                </div>
              </Link>
            </div>

            <div className="mt-12 text-center">
              <Link to="/register">
                <Button size="lg" className="text-lg px-8 py-6">
                  Start Your Journey Today
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section id="testimonials" className="py-20 bg-gray-50 dark:bg-gray-800 scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
              <Star className="h-4 w-4" />
              <span>Success Stories</span>
            </div>
            <Link to="#testimonials" className="inline-block">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                What Our Nurses Say
              </h2>
            </Link>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Real testimonials from nurses who achieved their USRN dreams with GritSync
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            <Link to="/tracking" className="block">
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer h-full">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed italic">
                  "I was struggling with the California Board requirements. GritSync's team helped me understand exactly what I needed and got my application approved in record time. I'm now working in Los Angeles!"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white font-semibold">
                    JS
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Jennifer Santos, RN</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">California • Licensed 2024</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/about-us" className="block">
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer h-full">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed italic">
                  "The real-time tracking feature was a game-changer. I could see exactly where my application was at every step. The support team answered all my questions within hours. Highly recommend!"
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center text-white font-semibold">
                    RD
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Robert Dela Cruz, RN</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Texas • Licensed 2023</p>
                  </div>
                </div>
              </div>
            </Link>

            <Link to="/sponsorship/apply" className="block">
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-700 transition-all cursor-pointer h-full">
                <div className="flex items-center gap-1 mb-4">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-6 leading-relaxed italic">
                  "As a retaker, I needed extra help. GritSync not only processed my application but also provided guidance on exam preparation. Their comprehensive support made all the difference."
                </p>
                <div className="flex items-center gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-white font-semibold">
                    AL
            </div>
            <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">Anna Lopez, RN</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Florida • Licensed 2024</p>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section id="faq" className="py-20 bg-gray-50 dark:bg-gray-800 scroll-mt-16">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                <HelpCircle className="h-4 w-4" />
                <span>Frequently Asked Questions</span>
              </div>
              <Link to="#faq" className="inline-block">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100 hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                  Got Questions? We've Got Answers
                </h2>
              </Link>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Everything you need to know about NCLEX processing and our services
              </p>
            </div>

            <div className="space-y-4">
              {faqData.map((faq, index) => (
                <div
                  key={index}
                  className="bg-white dark:bg-gray-900 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden transition-all hover:border-primary-300 dark:hover:border-primary-700"
                >
                  <button
                    onClick={() => setOpenFaqIndex(openFaqIndex === index ? null : index)}
                    className="w-full px-6 py-5 flex items-center justify-between text-left focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-inset"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 pr-8">
                      {faq.question}
                    </h3>
                    <ChevronDown
                      className={`h-5 w-5 text-gray-500 dark:text-gray-400 flex-shrink-0 transition-transform ${
                        openFaqIndex === index ? 'transform rotate-180' : ''
                      }`}
                    />
                  </button>
                  <div
                    className={`overflow-hidden transition-all duration-300 ${
                      openFaqIndex === index ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                    }`}
                  >
                    <div className="px-6 pb-5">
                      <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Still have questions? We're here to help!
              </p>
              <Link to="#contact" onClick={(e) => {
                e.preventDefault()
                const contactSection = document.getElementById('contact')
                if (contactSection) {
                  contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }
              }}>
                <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                  Contact Us
                  <Mail className="ml-2 h-5 w-5" />
                </Button>
              </Link>
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
              {/* Contact Form */}
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

              {/* Contact Info & CTA */}
              <div className="space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 border-2 border-gray-200 dark:border-gray-700">
                  <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                    Ready to Get Started?
                  </h3>
                  <p className="text-lg text-gray-600 dark:text-gray-400 mb-6">
                    Join hundreds of nursing professionals who trust GritSync for their NCLEX application processing.
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
                      <a href={`tel:${phoneNumber.replace(/\D/g, '')}`} className="text-primary-600 dark:text-primary-400 hover:underline">
                        {phoneNumber}
                      </a>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
