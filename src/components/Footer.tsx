import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram, Heart, ArrowRight } from 'lucide-react'
import { Button } from './ui/Button'
import { useToast } from './ui/Toast'
import { sendEmail } from '@/lib/email-service'
import { generalSettings } from '@/lib/settings'
import { isValidEmail } from '@/lib/utils'

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

    if (!isValidEmail(newsletterEmail)) {
      showToast('Please enter a valid email address', 'error')
      return
    }

    setIsSubscribing(true)

    try {
      // Get admin email to notify about new subscription
      const adminEmail = await generalSettings.getAdminEmail()
      
      // Send notification email to admin
      const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb; margin-bottom: 20px;">New Newsletter Subscription</h2>
          <div style="background-color: #f9fafb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <p><strong>Email:</strong> ${newsletterEmail}</p>
            <p><strong>Subscribed at:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <p style="color: #374151;">A new user has subscribed to the GritSync newsletter.</p>
        </div>
      `

      const success = await sendEmail({
        to: adminEmail,
        subject: 'New Newsletter Subscription - GritSync',
        html: emailHtml,
        text: `New Newsletter Subscription\n\nEmail: ${newsletterEmail}\nSubscribed at: ${new Date().toLocaleString()}`
      })

      if (success) {
        showToast('Thank you for subscribing! You\'ll receive updates and tips from GritSync.', 'success')
        setNewsletterEmail('')
      } else {
        showToast('Subscription received! Thank you for joining our newsletter.', 'success')
        setNewsletterEmail('')
      }
    } catch (error) {
      console.error('Error subscribing to newsletter:', error)
      showToast('Thank you for subscribing!', 'success')
      setNewsletterEmail('')
    } finally {
      setIsSubscribing(false)
    }
  }

  return (
    <footer className="bg-gray-900 dark:bg-black text-gray-400 border-t border-gray-800">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12 mb-12">
          {/* Company Info */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <div className="logo-container">
                <img 
                  src="/gritsync_logo.png" 
                  alt="GritSync Logo" 
                  className="h-10 w-auto rounded-lg"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <span className="text-xl font-bold text-white">GritSync</span>
            </div>
            <p className="text-sm mb-6 leading-relaxed">
              Your trusted partner for NCLEX application processing. Fast, secure, and reliable service helping nurses achieve their USRN dreams.
            </p>
            <div className="flex flex-col gap-3 text-sm">
              <a 
                href="mailto:support@gritsync.com" 
                className="flex items-center gap-2 text-gray-400 hover:text-primary-400 transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span>support@gritsync.com</span>
              </a>
              <a 
                href={`tel:${phoneNumber.replace(/\D/g, '')}`}
                className="flex items-center gap-2 text-gray-400 hover:text-primary-400 transition-colors"
              >
                <Phone className="h-4 w-4" />
                <span>{phoneNumber}</span>
              </a>
              <div className="flex items-center gap-2 text-gray-400">
                <MapPin className="h-4 w-4" />
                <span>United States</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg">Quick Links</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Home</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/about-us" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>About Us</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/quote" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Get a Quote</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/tracking" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Track Application</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/sponsorship" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>NCLEX Sponsorship</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/career" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Career Opportunities</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Services */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg">Services</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/application/new" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>NCLEX Application</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/quote" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Quotation Generator</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/tracking" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Application Tracking</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/donate" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Donate & Support</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/register" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Create Account</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Support */}
          <div>
            <h4 className="text-white font-semibold mb-4 text-lg">Legal & Support</h4>
            <ul className="space-y-3 text-sm mb-6">
              <li>
                <Link to="/terms" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Terms of Service</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/privacy" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Privacy Policy</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <a 
                  href="#contact" 
                  onClick={(e) => {
                    e.preventDefault()
                    const contactSection = document.getElementById('contact')
                    if (contactSection) {
                      contactSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                  }}
                  className="hover:text-primary-400 transition-colors flex items-center gap-2 group"
                >
                  <span>Contact Us</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              </li>
              <li>
                <Link to="/#faq" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>FAQs</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
              <li>
                <Link to="/about-us" className="hover:text-primary-400 transition-colors flex items-center gap-2 group">
                  <span>Help Center</span>
                  <ArrowRight className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                </Link>
              </li>
            </ul>
            
            {/* Newsletter Signup */}
            <div className="mt-6">
              <h5 className="text-white font-semibold mb-3 text-sm">Stay Updated</h5>
              <p className="text-xs text-gray-500 mb-3">Get the latest updates and tips</p>
              <form onSubmit={handleNewsletterSubmit} className="flex gap-2">
                <input
                  type="email"
                  placeholder="Your email"
                  value={newsletterEmail}
                  onChange={(e) => setNewsletterEmail(e.target.value)}
                  disabled={isSubscribing}
                  required
                  className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <Button 
                  type="submit"
                  size="sm" 
                  className="px-4"
                  disabled={isSubscribing}
                >
                  {isSubscribing ? 'Subscribing...' : 'Subscribe'}
                </Button>
              </form>
            </div>
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
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-primary-600 flex items-center justify-center transition-colors group"
                >
                  <Facebook className="h-5 w-5 text-gray-400 group-hover:text-white" />
                </a>
                <a
                  href="https://twitter.com/gritsync"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Twitter"
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-primary-600 flex items-center justify-center transition-colors group"
                >
                  <Twitter className="h-5 w-5 text-gray-400 group-hover:text-white" />
                </a>
                <a
                  href="https://linkedin.com/company/gritsync"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="LinkedIn"
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-primary-600 flex items-center justify-center transition-colors group"
                >
                  <Linkedin className="h-5 w-5 text-gray-400 group-hover:text-white" />
                </a>
                <a
                  href="https://instagram.com/gritsync"
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  className="w-10 h-10 rounded-full bg-gray-800 hover:bg-primary-600 flex items-center justify-center transition-colors group"
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
                <span>for nurses</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

