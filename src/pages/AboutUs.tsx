import { Link } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SEO, generateOrganizationSchema, generateBreadcrumbSchema } from '@/components/SEO'
import { Users, Heart, Target, Award, Globe, Shield, Clock, CheckCircle } from 'lucide-react'

export function AboutUs() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''

  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'About Us', url: currentUrl },
  ]

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
          generateBreadcrumbSchema(breadcrumbs),
          {
            '@context': 'https://schema.org',
            '@type': 'AboutPage',
            name: 'About GritSync',
            description: 'GritSync is a dedicated consultancy service committed to assisting nurses in navigating the NCLEX process to become registered nurses in the United States.',
            mainEntity: {
              '@type': 'Organization',
              name: 'GritSync',
              founder: {
                '@type': 'Person',
                name: 'JJ Cantila',
                jobTitle: 'RM, RN, SGRN, CADRN, USRN',
              },
            },
          },
        ]}
      />
      <Header />
      
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-900 dark:to-primary-900/20">
        {/* Background Image */}
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: 'url(/about-us-banner.png)'
          }}
        />
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary-50/40 via-white/40 to-primary-50/40 dark:from-gray-900/50 dark:via-gray-900/50 dark:to-primary-900/30" />
        
        <div className="container mx-auto px-4 py-20 md:py-32 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xl md:text-2xl text-gray-700 dark:text-gray-200 mb-8 max-w-2xl mx-auto px-4 py-2 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm rounded-lg border-2 border-primary-200 dark:border-primary-700 shadow-lg inline-block">
              Your trusted partner in navigating the NCLEX journey to becoming a licensed nurse in the United States.
            </p>
          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                <Target className="h-4 w-4" />
                <span>Our Mission</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                Empowering Nurses in the USA
              </h2>
            </div>
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl p-8 md:p-12 border-2 border-primary-200 dark:border-primary-800">
              <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
                GritSync is a dedicated consultancy service committed to assisting nurses, particularly from the Philippines, 
                in navigating the NCLEX (National Council Licensure Examination) process to become registered nurses in the 
                United States.
              </p>
              <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 leading-relaxed">
                Our mission is to provide <strong className="text-primary-600 dark:text-primary-400">reliable, time-efficient, 
                and affordable support</strong> throughout your entire NCLEX journey. We understand the challenges and complexities 
                of the application process, and we're here to make it as smooth and stress-free as possible.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Our Story Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                <Heart className="h-4 w-4" />
                <span>Our Story</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                Founded by Nurses, for Nurses
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-8 items-center">
              <div className="space-y-6">
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  GritSync was founded by <strong className="text-primary-600 dark:text-primary-400">JJ Cantila, RM, RN, SGRN, CADRN, USRN</strong> and four other USRNs (United States Registered Nurses) who experienced firsthand the challenges and complexities 
                  of the NCLEX application process.
                </p>
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  Having navigated the journey themselves, our founders recognized the need for a reliable, efficient, and 
                  affordable service that could guide aspiring nurses through every step of the process. They understood that 
                  the path to becoming a licensed nurse shouldn't be hindered by confusing paperwork, unclear requirements, 
                  or lack of support.
                </p>
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  Today, GritSync stands as a testament to their vision: a platform that combines expertise, technology, 
                  and genuine care to help nurses achieve their dreams of practicing in the United States.
                </p>
              </div>
              <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
                      <Users className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Expert Team</h3>
                      <p className="text-gray-600 dark:text-gray-400">Founded by experienced USRNs</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Globe className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">USA Focus</h3>
                      <p className="text-gray-600 dark:text-gray-400">Serving nurses across the United States</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <Award className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Proven Track Record</h3>
                      <p className="text-gray-600 dark:text-gray-400">Hundreds of successful applications</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Founder Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                <Award className="h-4 w-4" />
                <span>Meet Our Founder</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                The Vision Behind GritSync
              </h2>
            </div>
            
            <div className="grid md:grid-cols-2 gap-12 items-center">
              {/* Founder Image */}
              <div className="relative">
                <div className="relative rounded-2xl overflow-hidden shadow-2xl">
                  <img 
                    src="/gritsyncfounder.png" 
                    alt="JJ Cantila, RM, RN, SGRN, CADRN, USRN - Founder of GritSync"
                    className="w-full h-auto object-cover"
                    onError={(e) => {
                      // Fallback if image doesn't exist - show placeholder
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const placeholder = target.nextElementSibling as HTMLElement;
                      if (placeholder) placeholder.style.display = 'flex';
                    }}
                  />
                  <div 
                    className="hidden w-full aspect-[4/5] bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900/30 dark:to-primary-800/30 items-center justify-center"
                    style={{ display: 'none' }}
                  >
                    <div className="text-center p-8">
                      <Users className="h-24 w-24 text-primary-600 dark:text-primary-400 mx-auto mb-4" />
                      <p className="text-primary-600 dark:text-primary-400 font-semibold">Founder Photo</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-6 bg-primary-600 dark:bg-primary-500 text-white p-6 rounded-xl shadow-lg">
                  <div className="text-sm font-medium mb-1">Founder & CEO</div>
                  <div className="text-lg font-bold">JJ Cantila</div>
                  <div className="text-xs mt-1 opacity-90">RM, RN, SGRN, CADRN, USRN</div>
                </div>
              </div>

              {/* Founder Story */}
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    A Journey of Perseverance and Purpose
                  </h3>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong className="text-primary-600 dark:text-primary-400">JJ Cantila, RM, RN, SGRN, CADRN, USRN</strong> knows firsthand 
                    the challenges that come with the NCLEX application process. As a nurse who successfully navigated the complex journey 
                    from the Philippines to becoming a licensed nurse in the United States, he experienced every obstacle, every confusing 
                    requirement, and every moment of uncertainty that aspiring nurses face today.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    The Inspiration
                  </h4>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                    After successfully completing his own NCLEX journey and becoming a USRN, JJ recognized a critical gap in the market. 
                    Too many talented nurses were struggling with the application process—not because they lacked the skills or determination, 
                    but because they lacked the guidance and support needed to navigate the complex system. He saw friends and colleagues 
                    face delays, rejections, and frustration simply because they didn't have access to the right information or support.
                  </p>
                </div>

                <div>
                  <h4 className="text-xl font-semibold mb-3 text-gray-900 dark:text-gray-100">
                    The Vision
                  </h4>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                    In 2023, JJ founded GritSync with a clear vision: to create a platform that combines the expertise of experienced USRNs 
                    with modern technology to make the NCLEX application process accessible, efficient, and stress-free. He assembled a team 
                    of four other USRNs who shared his passion for helping fellow nurses, and together they built a service that truly 
                    understands the journey because they've walked it themselves.
                  </p>
                </div>

                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-6 border-2 border-primary-200 dark:border-primary-800">
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed italic">
                    "Every nurse deserves a smooth path to their dreams. We've been where you are, and we're here to make sure your journey 
                    is as seamless as possible. That's not just our mission—it's our promise."
                  </p>
                  <p className="text-sm text-primary-600 dark:text-primary-400 font-semibold mt-4">
                    — JJ Cantila, Founder & CEO
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Name Story Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                <Heart className="h-4 w-4" />
                <span>The Story Behind Our Name</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-6 text-gray-900 dark:text-gray-100">
                Why <span className="text-primary-600 dark:text-primary-400">Grit</span> and <span className="text-primary-600 dark:text-primary-400">Sync</span>?
              </h2>
            </div>
            <div className="bg-gradient-to-br from-primary-50 to-primary-100 dark:from-primary-900/20 dark:to-primary-800/20 rounded-2xl p-8 md:p-12 border-2 border-primary-200 dark:border-primary-800">
              <div className="space-y-6">
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    <span className="text-primary-600 dark:text-primary-400">Grit</span> - The Foundation of Perseverance
                  </h3>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong className="text-primary-600 dark:text-primary-400">Grit</strong> represents the unwavering determination, 
                    resilience, and passion that every nurse must possess to succeed in the NCLEX journey. It's the courage to face 
                    challenges head-on, the persistence to overcome obstacles, and the strength to keep moving forward even when the 
                    path seems difficult. We chose "Grit" because we believe that every nurse who embarks on this journey has an 
                    incredible amount of inner strength and determination—we're here to help channel that grit into success.
                  </p>
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    <span className="text-primary-600 dark:text-primary-400">Sync</span> - The Power of Coordination
                  </h3>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                    <strong className="text-primary-600 dark:text-primary-400">Sync</strong> symbolizes the seamless coordination, 
                    synchronization, and harmony we bring to your NCLEX application process. Just as multiple systems work together 
                    in perfect sync to ensure optimal performance, we synchronize all aspects of your application—from document 
                    preparation to submission timelines, from state requirements to board communications. We ensure everything is 
                    perfectly aligned and working in harmony, so you can focus on what matters most: your preparation and success.
                  </p>
                </div>
                <div className="pt-6 border-t-2 border-primary-200 dark:border-primary-800">
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                    Together, <strong className="text-primary-600 dark:text-primary-400">GritSync</strong> embodies our commitment 
                    to combining your determination and perseverance with our expertise in synchronizing every detail of your NCLEX 
                    journey. We don't just process applications—we partner with your grit to create a synchronized path to success.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Our NCLEX Processing Services
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                Comprehensive, end-to-end support for your NCLEX application journey
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl p-8 md:p-12 shadow-lg border-2 border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-6 mb-8">
                <div className="w-16 h-16 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <CheckCircle className="h-8 w-8 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                    Complete NCLEX Application Processing
                  </h3>
                  <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed mb-6">
                    Our comprehensive NCLEX processing service covers every aspect of your application journey, from initial 
                    preparation to final approval. We understand that the NCLEX application process can be overwhelming, with 
                    numerous requirements, deadlines, and state-specific regulations. That's why we're here to handle 
                    everything for you.
                  </p>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6 mb-8">
                <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Document Preparation</h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    We guide you through gathering and preparing all required documents, ensuring everything meets the specific 
                    requirements of your target state.
                  </p>
                </div>
                <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Application Submission</h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    We handle the complete submission process, ensuring all forms are filled correctly, all fees are paid 
                    on time, and all requirements are met before submission.
                  </p>
                </div>
                <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Timeline Management</h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    We keep track of all deadlines and milestones, ensuring your application progresses smoothly and stays 
                    on schedule throughout the entire process.
                  </p>
                </div>
                <div className="p-6 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                  <h4 className="text-lg font-semibold mb-3 text-gray-900 dark:text-gray-100">Status Tracking</h4>
                  <p className="text-gray-600 dark:text-gray-400">
                    Our real-time tracking system keeps you informed about every step of your application, from submission 
                    to approval, with instant notifications on any updates.
                  </p>
                </div>
              </div>

              <div className="p-6 rounded-xl bg-primary-50 dark:bg-primary-900/20 border-2 border-primary-200 dark:border-primary-800">
                <p className="text-lg text-gray-700 dark:text-gray-300 leading-relaxed">
                  <strong className="text-primary-600 dark:text-primary-400">Our goal is simple:</strong> to make your NCLEX 
                  application process as smooth, efficient, and stress-free as possible. We handle the complexity so you can 
                  focus on what truly matters—preparing for your exam and achieving your dream of becoming a licensed nurse.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Our Core Values
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                The principles that guide everything we do
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
                <div className="w-12 h-12 rounded-lg bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mx-auto mb-4">
                  <Shield className="h-6 w-6 text-primary-600 dark:text-primary-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Reliability</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  You can count on us to deliver consistent, dependable service every step of the way.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
                <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Efficiency</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  We streamline processes to save you time and reduce unnecessary delays.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
                <div className="w-12 h-12 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <Heart className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Affordability</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Transparent pricing with no hidden fees, making professional support accessible to all.
                </p>
              </div>

              <div className="bg-white dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700 text-center">
                <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mx-auto mb-4">
                  <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">Support</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Dedicated assistance from experienced professionals who understand your journey.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary-600 dark:bg-primary-700 text-white">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Start Your NCLEX Journey?
            </h2>
            <p className="text-xl text-primary-100 mb-8">
              Join hundreds of nurses who have successfully navigated the NCLEX process with GritSync. 
              Let us help you achieve your dream of becoming a licensed nurse.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/register"
                className="inline-flex items-center justify-center px-8 py-4 bg-white text-primary-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Get Started Today
              </Link>
              <Link
                to="/quote"
                className="inline-flex items-center justify-center px-8 py-4 bg-primary-700 dark:bg-primary-800 text-white rounded-lg font-semibold hover:bg-primary-800 dark:hover:bg-primary-900 transition-colors border-2 border-white/20"
              >
                Request a Quote
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
