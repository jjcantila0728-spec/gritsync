import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { 
  Mail, 
  Phone, 
  MapPin, 
  Facebook, 
  Twitter, 
  Linkedin, 
  Instagram, 
  Heart, 
  ArrowRight,
  FileText,
  TrendingUp,
  Globe,
  Users,
  Shield,
  Clock,
  CheckCircle
} from 'lucide-react'
import { Button } from './ui/Button'
import { useToast } from './ui/Toast'
import { generalSettings } from '@/lib/settings'
import { subscribeToNewsletter } from '@/lib/newsletter-api'

export function Footer() {
  const currentYear = new Date().getFullYear()
  const { showToast } = useToast()
  const [newsletterEmail, setNewsletterEmail] = useState('')
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [phoneNumber, setPhoneNumber] = useState('+1 (509) 270-3437')

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

  const handleNewsletterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newsletterEmail.trim()) {
      showToast('Please enter your email address', 'error')
      return
    }

    setIsSubscribing(true)

    try {
      const result = await subscribeToNewsletter(newsletterEmail, 'all')
      
      if (result.success) {
        showToast(result.message, 'success')
        setNewsletterEmail('')
      } else {
        showToast(result.message, 'error')
      }
    } catch (error) {
      console.error('Error subscribing to newsletter:', error)
      showToast('Something went wrong. Please try again.', 'error')
    } finally {
      setIsSubscribing(false)
    }
  }

  return (
    <footer className="bg-gray-900 dark:bg-black text-gray-400 border-t border-gray-800">
      {/* Features Highlight Bar */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 py-4">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-white text-center">
            <div className="flex items-center justify-center gap-2">
              <Shield className="h-5 w-5" />
              <span className="text-sm font-medium">Secure Processing</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Clock className="h-5 w-5" />
              <span className="text-sm font-medium">Fast Turnaround</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <Users className="h-5 w-5" />
              <span className="text-sm font-medium">Expert Support</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <CheckCircle className="h-5 w-5" />
              <span className="text-sm font-medium">Trusted by Nurses</span>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-10 mb-12">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-3 mb-4">
              <div className="logo-container">
                <img 
                  src="/gritsync_logo.png" 
                  alt="GritSync Logo" 
                  className="h-12 w-auto rounded-lg"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div>
                <span className="text-2xl font-bold text-white">GritSync</span>
                <p className="text-xs text-red-400">Your American Dream Partner</p>
              </div>
            </div>
            <p className="text-sm mb-6 leading-relaxed">
              Helping Filipino nurses achieve their USRN dreams. We provide comprehensive NCLEX application processing, 
              real-time visa bulletin tracking, and dedicated support throughout your journey.
            </p>
            <div className="flex flex-col gap-3 text-sm mb-6">
              <a 
                href="mailto:support@gritsync.com" 
                className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span>support@gritsync.com</span>
              </a>
              <a 
                href={`tel:${phoneNumber.replace(/\D/g, '')}`}
                className="flex items-center gap-2 text-gray-400 hover:text-red-400 transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span>{phoneNumber}</span>
              </a>
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="h-4 w-4" />
                <span>United States</span>
              </div>
            </div>
            
            {/* Newsletter Signup */}
            <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
              <h5 className="text-white font-semibold mb-2 text-sm flex items-center gap-2">
                <Mail className="h-4 w-4 text-red-400" />
                Stay Updated
              </h5>
              <p className="text-xs text-gray-500 mb-3">Get visa bulletin updates & NCLEX tips</p>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  disabled={isSubscribing}
                  required
                  className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button 
                  type="submit"
                  size="sm" 
                  className="px-4 bg-red-600 hover:bg-red-700"
                  disabled={isSubscribing}
                >
                  {isSubscribing ? '...' : 'Subscribe'}
                </Button>
              </form>
            </div>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg flex items-center gap-2">
              <FileText className="h-4 w-4 text-red-400" />
              Our Services
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/quote" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>NCLEX Processing</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/tracking" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>Application Tracking</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/uscis-tracker" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>USCIS Case Tracker</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/sponsorship" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>NCLEX Sponsorship</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/donate" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>Support a Nurse</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Immigration Tools */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-red-400" />
              Immigration Tools
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/uscis-tracker" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>Visa Bulletin Tracker</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/uscis-tracker" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>EB3 Philippines Dates</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/uscis-tracker" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>Case Status Check</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <a 
                  href="https://travel.state.gov/content/travel/en/legal/visa-law0/visa-bulletin.html"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-red-400 transition-colors flex items-center gap-2 group"
                >
                  <span>Official DOS Bulletin</span>
                  <Globe className="h-3 w-3 opacity-50" />
                </a>
              </li>
              <li>
                <a 
                  href="https://egov.uscis.gov/casestatus/landing.do"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-red-400 transition-colors flex items-center gap-2 group"
                >
                  <span>USCIS Official Site</span>
                  <Globe className="h-3 w-3 opacity-50" />
                </a>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg flex items-center gap-2">
              <Users className="h-4 w-4 text-red-400" />
              Company
            </h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>Home</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/about-us" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>About Us</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/career" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>Careers</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/terms" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>Terms of Service</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>Privacy Policy</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/#faq" className="hover:text-red-400 transition-colors flex items-center gap-2 group">
                  <span>FAQs</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Social Media & Bottom Bar */}
        <div className="border-t border-gray-800 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            {/* Social Media Links */}
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-500">Follow us:</span>
              <div className="flex items-center gap-3">
                <a
                  href="https://facebook.com/gritsync"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-red-600 flex items-center justify-center transition-colors group"
                >
                  <Facebook className="h-5 w-5 text-gray-400 group-hover:text-white" />
                </a>
                <a
                  href="https://twitter.com/gritsync"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter"
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-red-600 flex items-center justify-center transition-colors group"
                >
                  <Twitter className="h-5 w-5 text-gray-400 group-hover:text-white" />
                </a>
                <a
                  href="https://linkedin.com/company/gritsync"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-red-600 flex items-center justify-center transition-colors group"
                >
                  <Linkedin className="h-5 w-5 text-gray-400 group-hover:text-white" />
                </a>
                <a
                  href="https://instagram.com/gritsync"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-red-600 flex items-center justify-center transition-colors group"
                >
                  <Instagram className="h-5 w-5 text-gray-400 group-hover:text-white" />
                </a>
              </div>
            </div>

            {/* Copyright */}
            <div className="flex flex-col md:flex-row items-center gap-2 text-sm">
              <p className="text-gray-500">
                &copy; {currentYear} GritSync. All rights reserved.
              </p>
              <div className="flex items-center gap-1 text-gray-500">
                <span>Made with</span>
                <Heart className="h-4 w-4 text-red-500 fill-red-500" />
                <span>for Filipino nurses</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
