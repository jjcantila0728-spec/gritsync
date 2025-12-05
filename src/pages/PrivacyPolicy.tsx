import { Link } from 'react-router-dom'
import { Shield, ArrowLeft } from 'lucide-react'
import { Button } from '../components/ui/Button'

export function PrivacyPolicy() {
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
            <Shield className="h-8 w-8 text-primary-600 dark:text-primary-400" />
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white">
              Privacy Policy
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
                GritSync ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our NCLEX application processing services, website, and related services (collectively, the "Service").
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Please read this Privacy Policy carefully. By using our Service, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our Service.
              </p>
            </section>

            {/* Information We Collect */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">2.1 Personal Information</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We collect personal information that you provide directly to us, including:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li><strong>Account Information:</strong> Name, email address, password, phone number</li>
                <li><strong>Application Information:</strong> Personal details, educational background, professional credentials, identification documents</li>
                <li><strong>Payment Information:</strong> Billing address, payment method details (processed securely through third-party payment processors)</li>
                <li><strong>Communication Data:</strong> Messages, inquiries, and correspondence with us</li>
                <li><strong>Documentation:</strong> Passport copies, diplomas, photographs, and other required documents</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">2.2 Automatically Collected Information</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                When you use our Service, we automatically collect certain information, including:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li><strong>Usage Data:</strong> Pages visited, features used, time spent on pages</li>
                <li><strong>Device Information:</strong> IP address, browser type, device type, operating system</li>
                <li><strong>Cookies and Tracking Technologies:</strong> See our Cookie Policy section below</li>
                <li><strong>Log Data:</strong> Access times, error logs, and system performance data</li>
              </ul>
            </section>

            {/* How We Use Your Information */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">3. How We Use Your Information</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We use the information we collect for the following purposes:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li><strong>Service Provision:</strong> To process your NCLEX application, manage your account, and provide requested services</li>
                <li><strong>Communication:</strong> To send you updates, notifications, and respond to your inquiries</li>
                <li><strong>Payment Processing:</strong> To process payments and manage billing</li>
                <li><strong>Document Management:</strong> To store, organize, and submit your application documents</li>
                <li><strong>Service Improvement:</strong> To analyze usage patterns and improve our Service</li>
                <li><strong>Legal Compliance:</strong> To comply with legal obligations and regulatory requirements</li>
                <li><strong>Security:</strong> To protect against fraud, unauthorized access, and security threats</li>
                <li><strong>Customer Support:</strong> To provide technical support and customer service</li>
              </ul>
            </section>

            {/* Information Sharing and Disclosure */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">4. Information Sharing and Disclosure</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We do not sell your personal information. We may share your information in the following circumstances:
              </p>
              
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">4.1 Service Providers</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We may share information with third-party service providers who perform services on our behalf, including:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Payment processors (Stripe)</li>
                <li>Cloud storage providers (Supabase)</li>
                <li>Email service providers</li>
                <li>Analytics and monitoring services</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">4.2 Legal Requirements</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We may disclose your information if required by law or in response to:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Legal processes, court orders, or government requests</li>
                <li>Enforcement of our Terms of Service</li>
                <li>Protection of our rights, property, or safety</li>
                <li>Prevention of fraud or security threats</li>
              </ul>

              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3 mt-6">4.3 Business Transfers</h3>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity.
              </p>
            </section>

            {/* Data Security */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">5. Data Security</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We implement appropriate technical and organizational measures to protect your personal information, including:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication and access controls</li>
                <li>Regular security assessments and updates</li>
                <li>Employee training on data protection</li>
                <li>Secure data storage with reputable cloud providers</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                However, no method of transmission over the Internet or electronic storage is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            {/* Data Retention */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">6. Data Retention</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We retain your personal information for as long as necessary to:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Provide our services to you</li>
                <li>Comply with legal obligations</li>
                <li>Resolve disputes and enforce agreements</li>
                <li>Maintain business records as required by law</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                When we no longer need your information, we will securely delete or anonymize it in accordance with our data retention policies.
              </p>
            </section>

            {/* Your Rights */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">7. Your Rights</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Depending on your location, you may have the following rights regarding your personal information:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li><strong>Access:</strong> Request a copy of your personal information</li>
                <li><strong>Correction:</strong> Request correction of inaccurate or incomplete information</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information (subject to legal requirements)</li>
                <li><strong>Portability:</strong> Request transfer of your data to another service</li>
                <li><strong>Objection:</strong> Object to processing of your information for certain purposes</li>
                <li><strong>Restriction:</strong> Request restriction of processing in certain circumstances</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent where processing is based on consent</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                To exercise these rights, please contact us using the information provided in the Contact section below.
              </p>
            </section>

            {/* Cookies and Tracking Technologies */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">8. Cookies and Tracking Technologies</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We use cookies and similar tracking technologies to:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Maintain your session and authentication state</li>
                <li>Remember your preferences and settings</li>
                <li>Analyze Service usage and performance</li>
                <li>Improve user experience</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Types of cookies we use:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li><strong>Essential Cookies:</strong> Required for the Service to function properly</li>
                <li><strong>Functional Cookies:</strong> Remember your preferences and settings</li>
                <li><strong>Analytics Cookies:</strong> Help us understand how users interact with our Service</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                You can control cookies through your browser settings. However, disabling certain cookies may affect the functionality of our Service.
              </p>
            </section>

            {/* Third-Party Links */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">9. Third-Party Links</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Our Service may contain links to third-party websites or services. We are not responsible for the privacy practices of these third parties. We encourage you to review their privacy policies before providing any information.
              </p>
            </section>

            {/* Children's Privacy */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">10. Children's Privacy</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Our Service is not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete such information promptly.
              </p>
            </section>

            {/* International Data Transfers */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">11. International Data Transfers</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                Your information may be transferred to and processed in countries other than your country of residence. These countries may have data protection laws that differ from those in your country.
              </p>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                We take appropriate safeguards to ensure that your information receives an adequate level of protection in accordance with this Privacy Policy.
              </p>
            </section>

            {/* Changes to This Privacy Policy */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">12. Changes to This Privacy Policy</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                We may update this Privacy Policy from time to time. We will notify you of any material changes by:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Posting the updated Privacy Policy on our website</li>
                <li>Sending email notifications to registered users</li>
                <li>Displaying a notice within the Service</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                Your continued use of the Service after such changes constitutes acceptance of the updated Privacy Policy.
              </p>
            </section>

            {/* Contact Information */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">13. Contact Information</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                If you have any questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
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
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mt-4">
                For data protection inquiries, please include "Privacy Policy Inquiry" in your subject line.
              </p>
            </section>

            {/* GDPR Rights (for EU Users) */}
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">14. GDPR Rights (for EU Users)</h2>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-4">
                If you are located in the European Union, you have additional rights under the General Data Protection Regulation (GDPR), including:
              </p>
              <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 space-y-2 mb-4 ml-4">
                <li>Right to access your personal data</li>
                <li>Right to rectification of inaccurate data</li>
                <li>Right to erasure ("right to be forgotten")</li>
                <li>Right to restrict processing</li>
                <li>Right to data portability</li>
                <li>Right to object to processing</li>
                <li>Right to withdraw consent</li>
                <li>Right to lodge a complaint with a supervisory authority</li>
              </ul>
              <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                To exercise these rights, please contact us using the information provided above.
              </p>
            </section>
          </div>

          {/* Footer Actions */}
          <div className="mt-12 pt-8 border-t border-gray-200 dark:border-gray-700 flex flex-col sm:flex-row gap-4 justify-between items-center">
            <Link to="/terms" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">
              View Terms of Service
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
