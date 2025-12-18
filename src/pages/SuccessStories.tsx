import { useState, useRef } from 'react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { useToast } from '@/components/ui/Toast'
import { SEO } from '@/components/SEO'
import { supabase } from '@/lib/supabase'
import {
  Star,
  Quote,
  Send,
  Upload,
  User,
  MapPin,
  Calendar,
  Heart,
  ArrowRight,
  CheckCircle,
  Sparkles,
  Camera
} from 'lucide-react'

import testimonial1 from '@assets/generated_images/filipino_woman_nurse_headshot.png'
import testimonial2 from '@assets/generated_images/filipino_man_nurse_headshot.png'
import testimonial3 from '@assets/generated_images/filipino_woman_nurse_40s_headshot.png'
import testimonial4 from '@assets/generated_images/young_filipino_woman_professional.png'
import testimonial5 from '@assets/generated_images/filipino_man_doctor_headshot.png'
import testimonial6 from '@assets/generated_images/filipino_woman_nurse_navy_scrubs.png'
import testimonial7 from '@assets/generated_images/filipino_man_green_scrubs.png'
import testimonial8 from '@assets/generated_images/filipino_woman_burgundy_scrubs.png'
import testimonial9 from '@assets/generated_images/filipino_woman_purple_scrubs.png'
import testimonial10 from '@assets/generated_images/filipino_man_dark_blue_scrubs.png'
import testimonial11 from '@assets/generated_images/filipino_woman_coral_scrubs.png'
import testimonial12 from '@assets/generated_images/filipino_man_maroon_scrubs.png'
import testimonial13 from '@assets/generated_images/filipino_woman_seafoam_scrubs.png'
import testimonial14 from '@assets/generated_images/filipino_woman_olive_scrubs.png'
import testimonial15 from '@assets/generated_images/filipino_man_gray_scrubs.png'
import testimonial16 from '@assets/generated_images/filipino_woman_royal_blue.png'
import testimonial17 from '@assets/generated_images/filipino_man_white_coat.png'
import testimonial18 from '@assets/generated_images/filipino_woman_lavender_scrubs.png'
import testimonial19 from '@assets/generated_images/filipino_man_hunter_green.png'
import testimonial20 from '@assets/generated_images/filipino_woman_charcoal_scrubs.png'

interface Testimonial {
  id: number
  name: string
  location: string
  image: string
  rating: number
  testimony: string
  date: string
  service: string
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: 'Maria Santos',
    location: 'Manila to California',
    image: testimonial1,
    rating: 5,
    testimony: 'Sobrang thankful ako sa GritSync! Akala ko imposible na ma-process ang NCLEX application ko, pero they made it so easy. Grabe ang support nila - from start to finish, nandyan sila. Now I\'m working as an RN in Los Angeles! Salamat po talaga!',
    date: 'November 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 2,
    name: 'Juan dela Cruz',
    location: 'Cebu to Texas',
    image: testimonial2,
    rating: 5,
    testimony: 'Ang bilis ng process! Hindi ko inexpect na ganito ka-smooth. Yung team ng GritSync, very responsive at patient sa lahat ng tanong ko. Now I\'m living my American Dream sa Houston. Highly recommended talaga!',
    date: 'October 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 3,
    name: 'Gloria Reyes',
    location: 'Davao to New York',
    image: testimonial3,
    rating: 5,
    testimony: 'After 15 years of being a nurse sa Pilipinas, finally natupad din ang pangarap ko! GritSync helped me and my family. Kasama ko na ngayon ang mga anak ko dito sa US. Thank you for making dreams come true!',
    date: 'September 2025',
    service: 'NCLEX + EAD for Dependents'
  },
  {
    id: 4,
    name: 'Ana Marie Gonzales',
    location: 'Quezon City to Florida',
    image: testimonial4,
    rating: 5,
    testimony: 'Fresh grad pa lang ako nung nag-apply, nervous talaga ako. Pero yung GritSync team, they guided me every step of the way! Super clear ang instructions, walang hidden fees. Now I\'m an RN in Miami! Salamat!',
    date: 'November 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 5,
    name: 'Roberto Villanueva',
    location: 'Baguio to Washington',
    image: testimonial5,
    rating: 5,
    testimony: 'Professional ang approach ng GritSync. As a medical professional myself, I appreciate yung attention to detail nila. Lahat ng documents ko, maayos na maayos. Now I\'m practicing in Seattle. Maraming salamat!',
    date: 'August 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 6,
    name: 'Cristina Aquino',
    location: 'Iloilo to New Jersey',
    image: testimonial6,
    rating: 5,
    testimony: 'Sobrang dami kong questions at concerns, pero ang patient ng GritSync team. They answered everything, kahit paulit-ulit ako magtanong. Now I\'m here sa US with my husband! The EAD processing for him was smooth too!',
    date: 'October 2025',
    service: 'NCLEX + EAD Processing'
  },
  {
    id: 7,
    name: 'Michael Fernandez',
    location: 'Pampanga to Illinois',
    image: testimonial7,
    rating: 5,
    testimony: 'Akala ko scam yung mga ganito, pero legit talaga ang GritSync! Yung tracking system nila, real-time updates. Walang kalokohan. Now I\'m working in Chicago - malaking tulong sa family ko. Salamat GritSync!',
    date: 'September 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 8,
    name: 'Patricia Lim',
    location: 'Bacolod to Nevada',
    image: testimonial8,
    rating: 5,
    testimony: 'Grabe ang efficiency! Hindi pa tapos yung expected timeline, processed na agad ang application ko. Yung visa bulletin tracker nila super helpful din para ma-monitor ang case ko. Now I\'m in Las Vegas!',
    date: 'November 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 9,
    name: 'Jennifer Cruz',
    location: 'Laguna to Arizona',
    image: testimonial9,
    rating: 5,
    testimony: 'GritSync made the impossible possible! Dami kong nawala sa mga agencies dati, pero sila talaga yung totoo. Transparent lahat - pricing, timeline, requirements. No regrets! Now I\'m an RN in Phoenix!',
    date: 'October 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 10,
    name: 'Antonio Garcia',
    location: 'Batangas to Georgia',
    image: testimonial10,
    rating: 5,
    testimony: 'Ang galing ng customer service! May concern ako one time, within the hour na-resolve agad. Yung dedication nila sa clients, nakikita mo talaga. Now I\'m working in Atlanta - blessed talaga!',
    date: 'August 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 11,
    name: 'Rosa Martinez',
    location: 'Zambales to Michigan',
    image: testimonial11,
    rating: 5,
    testimony: 'Hesitant ako at first kasi maraming horror stories about processing agencies. Pero GritSync is different! Lahat ng sinabi nila, natupad. Now I\'m here sa Detroit with my family. Maraming salamat po!',
    date: 'September 2025',
    service: 'NCLEX + EAD Processing'
  },
  {
    id: 12,
    name: 'Carlos Mendoza',
    location: 'Pangasinan to Oregon',
    image: testimonial12,
    rating: 5,
    testimony: 'Yung professionalism ng GritSync, top-tier talaga. Hindi ka nila iiwan hanggang makarating ka sa US. Even after I arrived, nag-follow up pa sila. Now I\'m working as an RN in Portland!',
    date: 'October 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 13,
    name: 'Isabella Tan',
    location: 'Tarlac to Colorado',
    image: testimonial13,
    rating: 5,
    testimony: 'Super smooth ng experience ko with GritSync! Yung mga documents, hindi na ako nag-worry kasi sila na bahala. The quote system nila very transparent - alam mo exactly kung magkano. Now I\'m in Denver!',
    date: 'November 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 14,
    name: 'Lorna Bautista',
    location: 'Nueva Ecija to Ohio',
    image: testimonial14,
    rating: 5,
    testimony: 'After 10 years of trying with different agencies, finally nagawa din! GritSync is the real deal. Yung patience nila sa mga senior nurses like me, appreciated talaga. Now I\'m in Cleveland!',
    date: 'August 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 15,
    name: 'Joseph Santos',
    location: 'Bulacan to Pennsylvania',
    image: testimonial15,
    rating: 5,
    testimony: 'Ang convenient ng online system nila! Hindi na kailangan pumila or mag-commute. Lahat pwede gawin online. Yung USCIS tracker nila super useful para sa case status. Now I\'m in Philadelphia!',
    date: 'September 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 16,
    name: 'Michelle Ramos',
    location: 'Cavite to Massachusetts',
    image: testimonial16,
    rating: 5,
    testimony: 'GritSync is a blessing! Akala ko di na ako makakaalis ng Pilipinas, pero they made it happen. Yung EAD processing for my husband was quick too. Now we\'re in Boston together! Salamat talaga!',
    date: 'October 2025',
    service: 'NCLEX + EAD Processing'
  },
  {
    id: 17,
    name: 'Dr. Ricardo Lopez',
    location: 'Rizal to North Carolina',
    image: testimonial17,
    rating: 5,
    testimony: 'As a physician transitioning to nursing in the US, I needed reliable support. GritSync delivered beyond expectations. Very professional ang team. Now I\'m practicing in Charlotte. Highly recommended!',
    date: 'November 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 18,
    name: 'Angelica Diaz',
    location: 'Leyte to Virginia',
    image: testimonial18,
    rating: 5,
    testimony: 'Kahit after ng Typhoon Yolanda, hindi kami sumuko. GritSync helped rebuild our dreams. Fast forward to today, I\'m an RN in Richmond! Yung journey, mahirap pero worth it. Salamat GritSync!',
    date: 'September 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 19,
    name: 'Emmanuel Reyes',
    location: 'Mindoro to Tennessee',
    image: testimonial19,
    rating: 5,
    testimony: 'Yung communication ng GritSync, excellent! Always updated ka sa kung ano na yung status ng application mo. Walang left in the dark. Now I\'m working in Nashville - living the dream!',
    date: 'October 2025',
    service: 'NCLEX Processing'
  },
  {
    id: 20,
    name: 'Catherine Villanueva',
    location: 'Quezon Province to Maryland',
    image: testimonial20,
    rating: 5,
    testimony: 'From province ako, walang connections sa Manila. Pero dahil sa GritSync, nakarating din ako ng US! Lahat online na, walang hassle. Now I\'m in Baltimore with my kids! Dreams do come true!',
    date: 'November 2025',
    service: 'NCLEX + EAD Processing'
  }
]

export function SuccessStories() {
  const { showToast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    location: '',
    service: 'NCLEX Processing',
    testimony: ''
  })

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        showToast('Image must be less than 5MB', 'error')
        return
      }
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.name || !formData.email || !formData.testimony) {
      showToast('Please fill in all required fields', 'error')
      return
    }

    setSubmitting(true)

    try {
      let imageUrl = null

      if (selectedImage) {
        const fileExt = selectedImage.name.split('.').pop()
        const fileName = `testimonial_${Date.now()}.${fileExt}`
        const filePath = `testimonials/${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('public-assets')
          .upload(filePath, selectedImage)

        if (uploadError) {
          console.error('Error uploading image:', uploadError)
          showToast('Failed to upload your photo. Please try again.', 'error')
          setSubmitting(false)
          return
        }

        const { data: { publicUrl } } = supabase.storage
          .from('public-assets')
          .getPublicUrl(filePath)
        imageUrl = publicUrl
      }

      const { error } = await supabase
        .from('testimonials')
        .insert({
          name: formData.name,
          email: formData.email,
          location: formData.location,
          service: formData.service,
          testimony: formData.testimony,
          image_url: imageUrl,
          status: 'pending',
          rating: 5
        })

      if (error) {
        console.error('Error submitting testimonial:', error)
        showToast('Sorry, we could not submit your story. Please try again later.', 'error')
        return
      }

      showToast('Salamat! Your success story has been submitted for review.', 'success')
      setFormData({
        name: '',
        email: '',
        location: '',
        service: 'NCLEX Processing',
        testimony: ''
      })
      setSelectedImage(null)
      setImagePreview(null)
    } catch (error) {
      console.error('Submission error:', error)
      showToast('Something went wrong. Please try again later.', 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <SEO
        title="Success Stories - Filipino Nurses in the USA | GritSync"
        description="Read inspiring testimonials from Filipino nurses who achieved their American Dream with GritSync. Real stories from NCLEX applicants now working in the USA."
        keywords="NCLEX success stories, Filipino nurses USA, USRN testimonials, nurse immigration stories, GritSync reviews"
      />
      <Header />

      {/* Hero Section */}
      <section 
        className="relative py-20 overflow-hidden"
        style={{
          backgroundImage: `linear-gradient(to bottom right, rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.5)), url('/success_stories_page_banner.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }}
      >
        
        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full mb-6">
              <Heart className="h-5 w-5 text-white" />
              <span className="text-white font-medium">Real Stories, Real Dreams</span>
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Success Stories
            </h1>
            <p className="text-xl text-white/90 mb-8">
              Mga kwento ng tagumpay mula sa ating mga kababayan na natupad ang kanilang American Dream. 
              Be inspired by their journeys!
            </p>
            <div className="flex flex-wrap justify-center gap-6 text-white/80">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-400" />
                <span>500+ Successful Applicants</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
                <span>4.9/5 Average Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-blue-400" />
                <span>Across 45+ US States</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials Grid */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {testimonials.map((testimonial, index) => (
              <Card 
                key={testimonial.id} 
                className={`p-6 hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 ${
                  index % 5 === 0 ? 'md:col-span-2 lg:col-span-1' : ''
                }`}
              >
                <div className="flex items-start gap-4 mb-4">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-16 h-16 rounded-full object-cover border-2 border-red-200"
                  />
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 dark:text-gray-100">
                      {testimonial.name}
                    </h3>
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <MapPin className="h-3 w-3" />
                      <span>{testimonial.location}</span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      {[...Array(testimonial.rating)].map((_, i) => (
                        <Star key={i} className="h-4 w-4 text-yellow-400 fill-yellow-400" />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="relative mb-4">
                  <Quote className="absolute -top-2 -left-2 h-8 w-8 text-red-200 dark:text-red-800" />
                  <p className="text-gray-700 dark:text-gray-300 italic pl-6 leading-relaxed">
                    "{testimonial.testimony}"
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-3 py-1 rounded-full">
                    {testimonial.service}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {testimonial.date}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Submit Your Story Section */}
      <section className="py-16 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 bg-red-100 dark:bg-red-900/30 px-4 py-2 rounded-full mb-4">
                <Sparkles className="h-5 w-5 text-red-600 dark:text-red-400" />
                <span className="text-red-700 dark:text-red-300 font-medium">Share Your Journey</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                Ikwento Mo Ang Success Story Mo!
              </h2>
              <p className="text-lg text-gray-600 dark:text-gray-400">
                Inspire others by sharing your journey. Your story could be the motivation someone needs today.
              </p>
            </div>

            <Card className="p-8 shadow-xl border-t-4 border-t-red-500">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="flex flex-col items-center mb-8">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="relative w-32 h-32 rounded-full bg-gray-100 dark:bg-gray-700 border-4 border-dashed border-gray-300 dark:border-gray-600 hover:border-red-400 cursor-pointer transition-colors flex items-center justify-center overflow-hidden group"
                  >
                    {imagePreview ? (
                      <>
                        <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Camera className="h-8 w-8 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="text-center">
                        <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                        <span className="text-xs text-gray-500">Add Photo</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                  />
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                    Upload your profile photo (optional)
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Your Name *
                    </label>
                    <Input
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      placeholder="e.g., Maria Santos"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email Address *
                    </label>
                    <Input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Your Journey
                    </label>
                    <Input
                      name="location"
                      value={formData.location}
                      onChange={handleInputChange}
                      placeholder="e.g., Manila to California"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Service Used
                    </label>
                    <select
                      name="service"
                      value={formData.service}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    >
                      <option value="NCLEX Processing">NCLEX Processing</option>
                      <option value="EAD Processing">EAD Processing</option>
                      <option value="NCLEX + EAD Processing">NCLEX + EAD Processing</option>
                      <option value="Other Services">Other Services</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Story * (Tagalog or English)
                  </label>
                  <textarea
                    name="testimony"
                    value={formData.testimony}
                    onChange={handleInputChange}
                    rows={5}
                    placeholder="Share your experience with GritSync. Pwede po Tagalog or English! How did we help you achieve your American Dream?"
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                    required
                  />
                </div>

                <div className="flex justify-center">
                  <Button
                    type="submit"
                    disabled={submitting}
                    size="lg"
                    className="bg-red-600 hover:bg-red-700 px-12"
                  >
                    {submitting ? (
                      <>
                        <span className="animate-spin mr-2">...</span>
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-5 w-5 mr-2" />
                        Submit Your Story
                      </>
                    )}
                  </Button>
                </div>

                <p className="text-center text-sm text-gray-500 dark:text-gray-400">
                  By submitting, you agree that your story may be featured on our website after review.
                </p>
              </form>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 bg-gradient-to-r from-red-600 to-red-700">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Write Your Own Success Story?
          </h2>
          <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
            Join hundreds of Filipino nurses who have achieved their American Dream with GritSync.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              size="lg"
              variant="outline"
              className="bg-white text-red-600 hover:bg-gray-100 border-white"
              onClick={() => window.location.href = '/quote'}
            >
              Get Your Free Quote
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white text-white hover:bg-white/10"
              onClick={() => window.location.href = '/register'}
            >
              Create Account
            </Button>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
