import { Link } from 'react-router-dom'
import { FileText, ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/Button'

export function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Home</span>
            </Link>
            <Link to="/" className="text-2xl font-bold text-gray-900 dark:text-white">
              GritSync
            </Link>
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-8 md:p-12">
          {/* Title */}
          <div className="flex items-center gap-3 mb-8">
            <FileText className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Terms of Service
            </h1>
          </div>

          <div className="text-sm text-gray-500 dark:text-gray-400 mb-8">
            Last Updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </div>

          <div className="prose prose-gray dark:prose-invert max-w-none">
            {/* Introduction */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">1. Introduction</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Welcome to GritSync ("we," "our," or "us"). These Terms of Service ("Terms") govern your access to and use of our NCLEX application processing services, website, and related services (collectively, the "Service"). By accessing or using our Service, you agree to be bound by these Terms.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If you do not agree to these Terms, please do not use our Service. We reserve the right to modify these Terms at any time, and such modifications will be effective immediately upon posting on our website.
              </p>
            </section>

            {/* Acceptance of Terms */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Acceptance of Terms</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                By creating an account, accessing, or using our Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you are using the Service on behalf of an organization, you represent and warrant that you have the authority to bind that organization to these Terms.
              </p>
            </section>

            {/* Description of Service */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. Description of Service</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                GritSync provides NCLEX application processing services, including but not limited to:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>NCLEX application form preparation and submission assistance</li>
                <li>Document management and verification</li>
                <li>Application tracking and status updates</li>
                <li>Quotation generation for processing services</li>
                <li>Payment processing for application fees</li>
                <li>Communication and notification services</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We act as a processing intermediary and do not guarantee approval or acceptance of your NCLEX application by any regulatory body or testing organization.
              </p>
            </section>

            {/* User Accounts */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. User Accounts</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                To use our Service, you must create an account. You agree to:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Provide accurate, current, and complete information during registration</li>
                <li>Maintain and promptly update your account information</li>
                <li>Maintain the security of your account credentials</li>
                <li>Accept responsibility for all activities that occur under your account</li>
                <li>Notify us immediately of any unauthorized use of your account</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We reserve the right to suspend or terminate accounts that violate these Terms or engage in fraudulent, abusive, or illegal activities.
              </p>
            </section>

            {/* User Responsibilities */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. User Responsibilities</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                You are responsible for:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Providing accurate and truthful information in your application</li>
                <li>Ensuring all documents submitted are authentic and valid</li>
                <li>Complying with all applicable laws and regulations</li>
                <li>Paying all fees associated with your application processing</li>
                <li>Maintaining the confidentiality of your account information</li>
                <li>Not using the Service for any unlawful purpose</li>
              </ul>
            </section>

            {/* Fees and Payment */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. Fees and Payment</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Our Service may require payment of fees for processing services. You agree to:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Pay all fees as specified in your quotation or service agreement</li>
                <li>Provide accurate payment information</li>
                <li>Authorize us to charge your payment method for applicable fees</li>
                <li>Understand that fees are non-refundable unless otherwise stated or required by law</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                All fees are displayed in USD or PHP as indicated. We reserve the right to change our fees at any time, but such changes will not affect fees for services already in progress.
              </p>
            </section>

            {/* Intellectual Property */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Intellectual Property</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                The Service, including its original content, features, and functionality, is owned by GritSync and is protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You may not reproduce, distribute, modify, create derivative works of, publicly display, or otherwise exploit any part of the Service without our prior written permission.
              </p>
            </section>

            {/* Privacy and Data Protection */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Privacy and Data Protection</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Your use of our Service is also governed by our Privacy Policy. Please review our Privacy Policy to understand how we collect, use, and protect your personal information.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                By using our Service, you consent to the collection and use of your information as described in our Privacy Policy.
              </p>
            </section>

            {/* Limitation of Liability */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. Limitation of Liability</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                TO THE MAXIMUM EXTENT PERMITTED BY LAW, GRITSYNC SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY, OR ANY LOSS OF DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We do not guarantee:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Approval or acceptance of your NCLEX application by any regulatory body</li>
                <li>Specific processing times or deadlines</li>
                <li>Error-free operation of the Service</li>
                <li>Uninterrupted or secure access to the Service</li>
              </ul>
            </section>

            {/* Indemnification */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">10. Indemnification</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You agree to indemnify, defend, and hold harmless GritSync, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising out of or relating to your use of the Service, violation of these Terms, or infringement of any rights of another party.
              </p>
            </section>

            {/* Termination */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">11. Termination</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We may terminate or suspend your account and access to the Service immediately, without prior notice, for any reason, including but not limited to:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Violation of these Terms</li>
                <li>Fraudulent or illegal activity</li>
                <li>Non-payment of fees</li>
                <li>Request by law enforcement or regulatory authorities</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Upon termination, your right to use the Service will immediately cease. We may delete your account and data, subject to our data retention policies and legal obligations.
              </p>
            </section>

            {/* Dispute Resolution */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">12. Dispute Resolution</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Any disputes arising from or relating to these Terms or the Service shall be resolved through:
              </p>
              <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Good faith negotiation between the parties</li>
                <li>If negotiation fails, binding arbitration in accordance with applicable arbitration rules</li>
                <li>Any legal action must be brought within one year of the cause of action arising</li>
              </ol>
            </section>

            {/* Governing Law */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">13. Governing Law</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which GritSync operates, without regard to its conflict of law provisions.
              </p>
            </section>

            {/* Changes to Terms */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">14. Changes to Terms</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We reserve the right to modify these Terms at any time. We will notify users of material changes by:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Posting the updated Terms on our website</li>
                <li>Sending email notifications to registered users</li>
                <li>Displaying a notice within the Service</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Your continued use of the Service after such modifications constitutes acceptance of the updated Terms.
              </p>
            </section>

            {/* Contact Information */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">15. Contact Information</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                If you have any questions about these Terms, please contact us:
              </p>
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-6">
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  <strong>Email:</strong> office@gritsync.com
                </p>
                <p className="text-gray-700 dark:text-gray-300 mb-2">
                  <strong>Phone:</strong> +1 509 270 3437
                </p>
                <p className="text-gray-700 dark:text-gray-300">
                  <strong>Service:</strong> NCLEX Application Processing
                </p>
              </div>
            </section>

            {/* Severability */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">16. Severability</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary, and the remaining provisions shall remain in full force and effect.
              </p>
            </section>

            {/* Entire Agreement */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">17. Entire Agreement</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                These Terms, together with our Privacy Policy, constitute the entire agreement between you and GritSync regarding the use of the Service and supersede all prior agreements and understandings.
              </p>
            </section>
          </div>

          {/* Footer Actions */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Link to="/privacy" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
              View Privacy Policy
            </Link>
            <Link to="/">
              <Button variant="default">
                Return to Home
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
