import { Link } from 'react-router-dom'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Card } from '@/components/ui/Card'
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
  Target
} from 'lucide-react'

export function SponsorshipLanding() {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const currentUrl = typeof window !== 'undefined' ? window.location.href : ''
  const breadcrumbs = [
    { name: 'Home', url: baseUrl },
    { name: 'NCLEX Sponsorship', url: currentUrl },
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800">
      <SEO
        title="NCLEX Sponsorship Program - Financial Support for Aspiring USRNs | GritSync"
        description="Apply for NCLEX sponsorship to receive financial support for your NCLEX exam fees. Our program helps nurses overcome financial barriers and achieve their dream of becoming a USRN in the United States."
        keywords="NCLEX sponsorship, NCLEX financial aid, USRN sponsorship, nursing exam funding, NCLEX support, nursing sponsorship program"
        canonicalUrl={currentUrl}
        ogTitle="NCLEX Sponsorship Program - Financial Support for Aspiring USRNs | GritSync"
        ogDescription="Apply for NCLEX sponsorship to receive financial support for your NCLEX exam fees. Our program helps nurses overcome financial barriers."
        ogImage={`${baseUrl}/gritsync_logo.png`}
        ogUrl={currentUrl}
        structuredData={[
          generateBreadcrumbSchema(breadcrumbs),
          generateServiceSchema('NCLEX Sponsorship Program', 'Financial support program for nurses seeking to take the NCLEX exam and become USRNs'),
        ]}
      />
      <Header />
      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-900 dark:to-primary-900/20">
          <div className="container mx-auto px-4 py-12 md:py-16">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-6">
                <Award className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-sm font-medium mb-6">
                <Heart className="h-4 w-4" />
                <span>Financial Support Program</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                NCLEX Sponsorship Program
              </h1>
              <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                Get financial support for your NCLEX exam fees and take the next step toward becoming a USRN. 
                We're here to help you overcome financial barriers and achieve your nursing career goals.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/sponsorship/apply">
                  <Button
                    size="lg"
                    className="text-lg px-8 py-6"
                  >
                    Apply for Sponsorship
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
                <Link to="/donate">
                  <Button
                    variant="outline"
                    size="lg"
                    className="text-lg px-8 py-6"
                  >
                    Support the Program
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* Benefits Section */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-6xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                  Program Benefits
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
                  Our sponsorship program is designed to support nurses who demonstrate financial need and a strong commitment to their USRN journey.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                <Card className="p-6 hover:shadow-lg transition-shadow">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-4">
                    <DollarSign className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                    Financial Support
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Receive financial assistance to cover NCLEX exam fees and related processing costs, reducing the financial burden on your journey.
                  </p>
                </Card>

                <Card className="p-6 hover:shadow-lg transition-shadow">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-full mb-4">
                    <Target className="h-6 w-6 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                    Clear Path Forward
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Remove financial obstacles and focus on what matters most - preparing for and passing your NCLEX exam to become a USRN.
                  </p>
                </Card>

                <Card className="p-6 hover:shadow-lg transition-shadow">
                  <div className="inline-flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-full mb-4">
                    <Users className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2 text-gray-900 dark:text-gray-100">
                    Community Support
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    Join a community of nurses who are committed to supporting each other in achieving their professional goals.
                  </p>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Eligibility Section */}
        <section className="py-12 md:py-16 bg-gray-50 dark:bg-gray-800/50">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                  Who Can Apply?
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Our sponsorship program is open to nurses who meet the following criteria:
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="inline-flex items-center justify-center w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                        <GraduationCap className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                        Nursing Education
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Completed or currently completing nursing education from an accredited nursing school.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="inline-flex items-center justify-center w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                        <DollarSign className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                        Financial Need
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Demonstrate genuine financial need that prevents you from covering NCLEX exam fees independently.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="inline-flex items-center justify-center w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                        <Target className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                        USRN Goal
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Clear commitment and motivation to pursue a career as a USRN in the United States.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="inline-flex items-center justify-center w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-full">
                        <Briefcase className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                      </div>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                        Professional Readiness
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Prepared to take the NCLEX exam and meet all eligibility requirements for the exam.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Application Process Section */}
        <section className="py-12 md:py-16">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-12">
                <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                  Application Process
                </h2>
                <p className="text-lg text-gray-600 dark:text-gray-400">
                  Applying for sponsorship is simple and straightforward
                </p>
              </div>

              <div className="space-y-6">
                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-10 h-10 bg-primary-600 text-white rounded-full font-bold text-lg">
                        1
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                        Complete Application Form
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Fill out the sponsorship application with your personal information, educational background, and professional details.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-10 h-10 bg-primary-600 text-white rounded-full font-bold text-lg">
                        2
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                        Share Your Story
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Provide a detailed description of your financial need and a motivation statement explaining why you're pursuing the USRN path.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-10 h-10 bg-primary-600 text-white rounded-full font-bold text-lg">
                        3
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                        Submit Supporting Documents (Optional)
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Upload your resume, transcript, and recommendation letters to strengthen your application. These are optional but recommended.
                      </p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                      <div className="flex items-center justify-center w-10 h-10 bg-primary-600 text-white rounded-full font-bold text-lg">
                        4
                      </div>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-gray-100">
                        Review & Notification
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400">
                        Our team will review your application and notify you of the decision. We'll keep you updated throughout the process.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-12 md:py-16 bg-gradient-to-br from-primary-50 via-white to-primary-50 dark:from-gray-900 dark:via-gray-900 dark:to-primary-900/20">
          <div className="container mx-auto px-4">
            <div className="max-w-4xl mx-auto text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full mb-6">
                <CheckCircle className="h-8 w-8 text-primary-600 dark:text-primary-400" />
              </div>
              <h2 className="text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-gray-100">
                Ready to Apply?
              </h2>
              <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-2xl mx-auto">
                Take the first step toward achieving your USRN dream. Our sponsorship program is here to support you on your journey.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link to="/sponsorship/apply">
                  <Button
                    size="lg"
                    className="text-lg px-8 py-6"
                  >
                    Start Your Application
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
              <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">
                Have questions? <Link to="/" className="text-primary-600 dark:text-primary-400 hover:underline">Contact us</Link> for more information.
              </p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  )
}

