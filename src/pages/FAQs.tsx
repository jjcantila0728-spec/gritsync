import { useState, useRef, useEffect } from 'react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SEO, generateFAQSchema, generateBreadcrumbSchema } from '@/components/SEO'
import { ChevronDown, ChevronUp, Search, HelpCircle, FileText, CreditCard, Clock, Globe, User, Shield, MessageCircle, BookOpen, CheckCircle, AlertCircle } from 'lucide-react'
import { Link, useLocation } from 'react-router-dom'

interface FAQItem {
  question: string
  answer: string | React.ReactNode
}

interface FAQCategory {
  id: string
  icon: React.ComponentType<{ className?: string }>
  title: string
  color: string
  faqs: FAQItem[]
}

const faqCategories: FAQCategory[] = [
  {
    id: 'getting-started',
    icon: User,
    title: 'Getting Started & Registration',
    color: 'from-blue-500 to-blue-700',
    faqs: [
      {
        question: 'What is GritSync?',
        answer: 'GritSync is a professional NCLEX application processing platform built specifically for Filipino nurses aspiring to become US Registered Nurses (USRNs). We handle the paperwork, coordinate with the Board of Nursing, and guide you through every milestone — so you can focus on studying rather than administrative stress.',
      },
      {
        question: 'Who can use GritSync?',
        answer: 'GritSync is designed for Filipino nurses with a valid PRC Nursing License who want to apply for NCLEX licensure in the United States. Whether you are applying for the first time or retaking the NCLEX, our platform can support your journey.',
      },
      {
        question: 'How do I create an account?',
        answer: 'Click "Sign Up" on the top navigation bar. Fill in your name, personal email address, and mobile number, then set a password. After submitting, a verification link will be sent to your email — click it to activate your account. Once verified, you can log in and start your application.',
      },
      {
        question: 'What email should I use to register?',
        answer: 'Use your personal email address (e.g., Gmail, Yahoo, Outlook, etc.). This will be your primary address for GritSync notifications, updates, and important messages.',
      },
      {
        question: 'I did not receive a verification email. What should I do?',
        answer: 'First, check your spam or junk folder. If you still cannot find it, contact our support team at support@gritsync.com and we will assist you.',
      },
      {
        question: 'Can I use GritSync on my mobile phone?',
        answer: 'Yes. GritSync is a Progressive Web App (PWA) fully optimized for mobile. You can install it on your phone\'s home screen from your browser for an app-like experience without downloading from an app store.',
      },
    ],
  },
  {
    id: 'application-process',
    icon: FileText,
    title: 'The GritSync Application Process',
    color: 'from-primary-500 to-primary-700',
    faqs: [
      {
        question: 'Which US state does GritSync currently process applications for?',
        answer: 'GritSync currently processes NCLEX applications for the New York State Board of Nursing (NYSBON). New York is one of the most recognized and widely accepted RN licenses in the US, and its NCLEX pathway is well-established for internationally educated nurses.',
      },
      {
        question: 'What are the steps to submit my NCLEX application through GritSync?',
        answer: (
          <div className="space-y-2">
            <p>When you click "New Application" in your dashboard, you will be guided through 8 steps:</p>
            <ol className="list-decimal list-inside space-y-1.5 mt-2 text-sm">
              <li><strong>Personal Information</strong> — Your name (as per passport), gender, marital status, date of birth, and place of birth</li>
              <li><strong>Address</strong> — Your current residential address in the Philippines</li>
              <li><strong>Elementary School</strong> — Name, location, and years attended</li>
              <li><strong>High School</strong> — Name, location, and years attended</li>
              <li><strong>Nursing School</strong> — Name, location, years attended, major, and diploma date</li>
              <li><strong>Required Documents</strong> — Upload your 2x2 ID picture, Nursing Diploma, and valid Passport</li>
              <li><strong>Review & Signature</strong> — Review your application and provide your digital signature</li>
              <li><strong>Payment Selection</strong> — Select and pay for the service package</li>
            </ol>
            <p className="mt-2">Once submitted, our team takes over and tracks everything from there.</p>
          </div>
        ),
      },
      {
        question: 'Why do you need my elementary and high school information?',
        answer: 'The New York State Board of Nursing requires a complete educational history as part of the NCLEX application. This includes all educational institutions attended — from elementary through nursing school. Our application form mirrors the BON\'s requirements so your submission is complete and accurate from the start.',
      },
      {
        question: 'What happens after I submit my application through GritSync?',
        answer: (
          <div className="space-y-2">
            <p>After you submit, GritSync manages your application through the following processing stages — all trackable in real time on your dashboard:</p>
            <ol className="list-decimal list-inside space-y-1.5 mt-2 text-sm">
              <li><strong>Documents Collection</strong> — We gather and verify all required documents</li>
              <li><strong>Documents Review</strong> — Our team reviews and checks document completeness</li>
              <li><strong>NYSED Document Review</strong> — GritSync submits your documents directly to NYSED for review</li>
              <li><strong>BON Application</strong> — We submit your application to the New York Board of Nursing</li>
              <li><strong>BON Processing</strong> — NYSBON reviews your application</li>
              <li><strong>Pearson VUE Registration</strong> — We register you with Pearson VUE for the NCLEX exam</li>
              <li><strong>Mandatory Courses</strong> — Completion of required NY State online courses</li>
              <li><strong>ATT Issued</strong> — Your Authorization to Test is released</li>
              <li><strong>Exam Scheduled</strong> — You schedule your NCLEX exam using your ATT</li>
              <li><strong>Exam Taken</strong> — You sit for the NCLEX-RN</li>
              <li><strong>Results Pending</strong> — Awaiting official results</li>
              <li><strong>Results Received</strong> — Your NCLEX results are confirmed</li>
              <li><strong>License Issued</strong> — Your New York RN license is granted</li>
            </ol>
          </div>
        ),
      },
      {
        question: 'How does GritSync process my documents with NYSED?',
        answer: 'GritSync streamlines the document review process by submitting your credentials directly to the New York State Education Department (NYSED) for review — without routing through CGFNS. Our team prepares and coordinates the submission, monitors progress, and updates your dashboard at each stage. This direct pathway helps reduce delays and simplifies the overall process for Filipino nurses.',
      },
      {
        question: 'What are the Mandatory Courses required by New York?',
        answer: 'New York State requires NCLEX applicants to complete mandatory online courses as a condition of licensure. These currently include courses on infection control, child abuse identification, and/or other state-mandated topics. The cost of these courses ($54.99) is included in your Step 1 payment. GritSync tracks the completion of these courses as part of your processing timeline.',
      },
      {
        question: 'What is an Authorization to Test (ATT)?',
        answer: 'An ATT (Authorization to Test) is an official document issued by Pearson VUE after the Board of Nursing confirms your eligibility. It contains a unique registration number and expiration date that you need to schedule your NCLEX exam. Your ATT is valid for 90 days — you must take your exam within this window.',
      },
      {
        question: 'How do I schedule my NCLEX exam after receiving my ATT?',
        answer: 'Once GritSync notifies you that your ATT has been issued (shown on your dashboard), visit the Pearson VUE website at www.pearsonvue.com/nclex to schedule your exam. You can choose a test center in the Philippines or elsewhere. GritSync will provide step-by-step guidance at this stage.',
      },
    ],
  },
  {
    id: 'documents',
    icon: BookOpen,
    title: 'Required Documents',
    color: 'from-emerald-500 to-emerald-700',
    faqs: [
      {
        question: 'What documents do I need to upload to my GritSync application?',
        answer: (
          <div className="space-y-2">
            <p>When filling out your NCLEX application on GritSync, you are required to upload the following 3 documents:</p>
            <ul className="list-disc list-inside space-y-1.5 mt-2 text-sm">
              <li><strong>2x2 ID Picture</strong> — A recent, clear 2x2 photo with white background (image file)</li>
              <li><strong>Nursing Diploma</strong> — Your original nursing school diploma (PDF or image)</li>
              <li><strong>Valid Passport</strong> — A clear copy of your valid Philippine passport (PDF or image)</li>
            </ul>
            <p className="mt-2">All files must be clear, complete, and legible. Maximum file size is 5MB per document.</p>
          </div>
        ),
      },
      {
        question: 'Why does GritSync only require 3 documents in the application form?',
        answer: 'The 3 documents you upload at the time of application (2x2 picture, nursing diploma, and passport) are the core documents needed to initiate your processing. Additional documents that may be required by NYSED or the New York BON (such as official transcripts or letters of verification) are coordinated separately by our processing team as your application progresses through each stage. We will notify you if and when additional documents are needed.',
      },
      {
        question: 'What specifications should my 2x2 picture meet?',
        answer: 'Your 2x2 picture should be a recent photo (taken within the last 6 months), with a plain white or off-white background. The photo should show your face clearly, front-facing, with no heavy filters or edits. Upload it as a JPG or PNG image file.',
      },
      {
        question: 'What version of my Nursing Diploma do I need to provide?',
        answer: 'Upload a clear, complete scan or photo of your original nursing school diploma. The document must show the school name, your full name, the degree conferred, and the graduation date. A blurry, cropped, or incomplete copy will delay processing.',
      },
      {
        question: 'My passport is expired. Can I still apply?',
        answer: 'Your passport must be valid at the time of application. An expired passport may cause issues with your BON application and identity verification. We strongly recommend renewing your passport before starting your NCLEX application.',
      },
      {
        question: 'Can I upload documents I previously uploaded to GritSync?',
        answer: 'Yes. If you have previously uploaded documents to your GritSync account (from a prior application or your profile), the system will automatically detect them and let you use those existing files. You do not need to re-upload the same document each time.',
      },
      {
        question: 'What file formats are accepted for document uploads?',
        answer: 'GritSync accepts PDF, JPG, JPEG, PNG, DOC, and DOCX files for most documents. The 2x2 picture must be an image file (JPG or PNG). Each file must be 5MB or smaller.',
      },
      {
        question: 'What if a document I upload is rejected?',
        answer: 'If a document does not meet the requirements, our team will notify you through your dashboard and by email with specific instructions on what needs to be corrected. You can upload a replacement document directly from your application details page.',
      },
    ],
  },
  {
    id: 'timeline',
    icon: Clock,
    title: 'Timeline & Processing',
    color: 'from-amber-500 to-orange-600',
    faqs: [
      {
        question: 'How long does the entire NCLEX process take from application to license?',
        answer: 'The total timeline varies, but as a general estimate: NYSED document review typically takes 8–16 weeks, New York BON processing takes 4–12 weeks after NYSED review is complete, and ATT issuance follows 1–4 weeks after BON approval. In total, most clients receive their ATT within 6–9 months from the time their complete application is submitted. The actual exam and license issuance add additional time.',
      },
      {
        question: 'How can I track the status of my application?',
        answer: 'Your GritSync dashboard shows your real-time application status at every stage — from Documents Collection all the way to License Issued. Each of the 13 timeline milestones is clearly marked as pending, in progress, or completed. You also receive email notifications for major updates.',
      },
      {
        question: 'What can slow down my NCLEX application?',
        answer: 'Common causes of delays include: incomplete or unclear document uploads, delays in receiving official transcript verifications from your nursing school, high processing volumes at NYSED or the New York BON, and missing completion of mandatory NY courses. GritSync proactively monitors your application and alerts you as soon as action is needed on your end.',
      },
      {
        question: 'How long does NYSED document review take?',
        answer: 'NYSED document review for the New York NCLEX pathway typically takes 8–16 weeks from the time GritSync submits your documents. Delays can occur if your nursing school takes longer to provide official transcripts or if additional verification is needed. Our team monitors NYSED status and will update your dashboard when it is complete.',
      },
      {
        question: 'How long does the New York BON take to process my application after NYSED review?',
        answer: 'After NYSED document review is complete, the New York State Board of Nursing typically takes 4–12 weeks to review and process your application. Processing times can vary based on their current application volume. GritSync tracks your BON status and updates your dashboard accordingly.',
      },
      {
        question: 'What happens between receiving my ATT and taking the exam?',
        answer: 'Once your ATT is issued, GritSync will notify you. You then schedule your NCLEX exam directly on the Pearson VUE website using your ATT registration number. Your ATT is valid for 90 days — you must sit for the exam within that window. GritSync records your scheduled exam date and exam results on your dashboard.',
      },
      {
        question: 'How long after the exam will I receive my results?',
        answer: 'Unofficial Quick Results are typically available on the Pearson VUE website approximately 48 hours after your exam for a small fee ($8, included in your Step 2 payment). The official result from the New York BON is usually available within 4–6 weeks. GritSync tracks and records your results as reported.',
      },
    ],
  },
  {
    id: 'fees-payments',
    icon: CreditCard,
    title: 'Fees & Payments',
    color: 'from-violet-500 to-violet-700',
    faqs: [
      {
        question: 'How much does it cost to process my NCLEX application through GritSync (New York)?',
        answer: (
          <div className="space-y-3">
            <p>GritSync uses a <strong>staggered 2-step payment</strong> for the New York NCLEX processing package. Here is the full breakdown:</p>
            <div className="mt-2 space-y-3 text-sm">
              <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">Step 1 Payment — $267.99</p>
                <ul className="space-y-0.5 text-gray-600 dark:text-gray-400">
                  <li>• NCLEX NY BON Application Fee: $143.00</li>
                  <li>• NCLEX NY Mandatory Courses: $54.99</li>
                  <li>• NCLEX NY Bond Fee: $70.00</li>
                </ul>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Paid at the start to initiate your BON application</p>
              </div>
              <div className="p-3 rounded-lg bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                <p className="font-semibold text-primary-700 dark:text-primary-300 mb-1">Step 2 Payment — $508.00</p>
                <ul className="space-y-0.5 text-gray-600 dark:text-gray-400">
                  <li>• NCLEX Pearson VUE Application Fee: $200.00</li>
                  <li>• NCLEX Pearson VUE (NCSBN) Exam Fee: $150.00</li>
                  <li>• GritSync Service Fee: $150.00</li>
                  <li>• NCLEX NY Quick Results: $8.00</li>
                </ul>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Paid when you are ready to register with Pearson VUE</p>
              </div>
              <p className="font-semibold text-gray-700 dark:text-gray-300">Total: $775.99 USD</p>
            </div>
          </div>
        ),
      },
      {
        question: 'Why are payments split into two steps?',
        answer: 'The staggered payment structure reflects the actual two phases of the NCLEX process. Step 1 covers your BON application fees that are needed upfront to begin your application with New York. Step 2 covers the Pearson VUE registration and exam fees, which are only needed once your BON application has been approved and you are ready to take the exam.',
      },
      {
        question: 'When do I pay Step 1 and Step 2?',
        answer: 'Step 1 is paid when you submit your NCLEX application through GritSync. Step 2 is paid after your BON application is approved and your processing reaches the Pearson VUE Registration stage — when you are ready to be registered for the exam.',
      },
      {
        question: 'What does the GritSync Service Fee ($150) cover?',
        answer: 'The GritSync Service Fee covers our professional processing and coordination services throughout your entire NCLEX journey — from document review and NYSED coordination to BON filing, status monitoring, and support from start to license issuance.',
      },
      {
        question: 'Are there any fees not included in the GritSync package?',
        answer: 'All standard New York NCLEX processing fees are included in the two-step package totaling $775.99. There are no hidden fees. However, if any additional state-specific requirements arise or if you need a retake, additional fees would apply and will be communicated to you in advance.',
      },
      {
        question: 'What payment methods does GritSync accept?',
        answer: 'GritSync accepts credit and debit cards (Visa, Mastercard, American Express) through our secure Stripe payment gateway. All transactions are encrypted and PCI-compliant. We do not store your card details.',
      },
      {
        question: 'Can I pay in Philippine Pesos (PHP)?',
        answer: 'GritSync processes payments in US Dollars (USD). Your bank or card issuer will handle the currency conversion from PHP to USD at their prevailing exchange rate. Please check with your bank for any foreign transaction fees.',
      },
      {
        question: 'What is the refund policy?',
        answer: 'If you cancel before our team has begun work on your application, a partial or full refund may be available. Once your application has been submitted to NYSED or the BON and fees have been disbursed, those costs cannot be refunded as they are paid to third-party agencies. The GritSync Service Fee portion is reviewed on a case-by-case basis. Contact support@gritsync.com for your specific situation.',
      },
    ],
  },
  {
    id: 'nclex-exam',
    icon: BookOpen,
    title: 'The NCLEX Exam',
    color: 'from-cyan-500 to-cyan-700',
    faqs: [
      {
        question: 'What is the NCLEX-RN exam?',
        answer: 'The NCLEX-RN (National Council Licensure Examination for Registered Nurses) is the standardized exam all nursing graduates must pass to obtain a US RN license. It is administered by Pearson VUE at authorized testing centers worldwide. Passing the NCLEX is the final requirement before your US RN license is issued.',
      },
      {
        question: 'Can I take the NCLEX exam in the Philippines?',
        answer: 'Yes. Pearson VUE has authorized testing centers in the Philippines. You do not need to travel to the US to take the NCLEX. When your ATT is issued, you can schedule your exam at a Philippine Pearson VUE center via www.pearsonvue.com/nclex.',
      },
      {
        question: 'How is the NCLEX-RN structured?',
        answer: 'The NCLEX-RN uses Computer Adaptive Testing (CAT). The exam adapts in difficulty based on your responses. Under the current Next Generation NCLEX (NGN) format, the exam includes a minimum of 85 items and a maximum of 150 items. New question types include case studies, extended multiple response, and clinical judgment questions. The total time limit is 5 hours.',
      },
      {
        question: 'What is the Next Generation NCLEX (NGN)?',
        answer: 'The NGN is the updated NCLEX format launched in April 2023. It places strong emphasis on Clinical Judgment and includes new item types: extended multiple response, drag-and-drop, matrix grids, and unfolding case studies. These test higher-order thinking and clinical decision-making. Make sure your review materials are updated for the NGN format.',
      },
      {
        question: 'How many times can I retake the NCLEX if I fail?',
        answer: 'There is no limit on the number of attempts. However, you must wait 45 days between attempts and apply for a new ATT each time. The Pearson VUE exam fee applies for each attempt. GritSync can assist with retake applications.',
      },
      {
        question: 'When will I know if I passed the NCLEX?',
        answer: 'Unofficial Quick Results are available on the Pearson VUE website approximately 48 hours after your exam (the $8 Quick Results fee is included in your Step 2 payment). The official result and license from the New York BON typically becomes available within 4–6 weeks of passing.',
      },
    ],
  },
  {
    id: 'after-nclex',
    icon: CheckCircle,
    title: 'After Passing the NCLEX',
    color: 'from-green-500 to-green-700',
    faqs: [
      {
        question: 'What happens after I pass the NCLEX?',
        answer: 'After you pass, the New York Board of Nursing issues your US RN license. Your license number is posted in the state\'s online verification database. GritSync will update your dashboard to "License Issued" and notify you. You are now a licensed US Registered Nurse (USRN).',
      },
      {
        question: 'How do I verify my New York RN license?',
        answer: 'Your New York RN license can be verified through the New York State Education Department Office of the Professions online license verification system at www.op.nysed.gov, or through the national Nursys database at www.nursys.com.',
      },
      {
        question: 'Can I work in the US immediately after passing the NCLEX?',
        answer: 'Passing the NCLEX and holding a US RN license qualifies you to work as a Registered Nurse in the US — but you still need the appropriate US work visa (such as an EB-3 immigrant visa or H-1B). The USRN license is a key credential required by US employers and immigration petitions. GritSync focuses on the NCLEX processing; for immigration and visa matters, you will work with an immigration attorney or agency.',
      },
      {
        question: 'What if I want to transfer my NY RN license to another US state?',
        answer: 'Once you hold an active New York RN license, you can apply for a license by endorsement in other states. The process and requirements vary by state. GritSync can assist with endorsement applications in the future.',
      },
      {
        question: 'Does GritSync offer NCLEX Sponsorship?',
        answer: 'Yes. GritSync has an NCLEX Sponsorship program that connects qualified Filipino nurses with funding support to cover their processing fees. Sponsored nurses commit to a work arrangement with the sponsoring US employer after obtaining their USRN license. Visit the Sponsorship page for full details.',
      },
    ],
  },
  {
    id: 'account-dashboard',
    icon: Globe,
    title: 'Account & Dashboard',
    color: 'from-rose-500 to-rose-700',
    faqs: [
      {
        question: 'What can I do in my GritSync dashboard?',
        answer: 'Your dashboard is your central hub. You can: start and track applications, upload required documents, view payment history, follow your real-time timeline progress across all 15 stages, receive notifications from our team, and update your personal information and profile.',
      },
      {
        question: 'Can I have multiple NCLEX applications at the same time?',
        answer: 'Yes. You can have multiple applications — for example if you are applying to more than one state or if you are reapplying after a failed NCLEX attempt. Each application is tracked independently in your dashboard.',
      },
      {
        question: 'How do I update my personal information?',
        answer: 'Log in to your dashboard, then go to "My Details" or "Account Settings." You can update your name, contact number, address, and profile photo from there.',
      },
      {
        question: 'What if I forget my password?',
        answer: 'Click "Forgot Password" on the login page. Enter your registered email address and we will send you a reset link. If you do not receive it, check your spam folder or contact support@gritsync.com.',
      },
      {
        question: 'Is my personal data safe with GritSync?',
        answer: 'Yes. Your personal information and uploaded documents are stored securely with encryption. We do not sell or share your data with third parties without your consent. For full details, read our Privacy Policy.',
      },
    ],
  },
  {
    id: 'support',
    icon: MessageCircle,
    title: 'Support & Communication',
    color: 'from-indigo-500 to-indigo-700',
    faqs: [
      {
        question: 'How can I contact GritSync support?',
        answer: 'You can reach our support team by email at support@gritsync.com or by phone at +63 969 153 3239. All application-related updates are also communicated directly through your dashboard and email notifications.',
      },
      {
        question: 'What are GritSync\'s support hours?',
        answer: 'Our support team is available Monday through Friday. For urgent matters, send us an email and we will respond as soon as possible.',
      },
      {
        question: 'How will I be updated about my application status?',
        answer: 'You will receive email notifications for major milestones in your application (e.g., Documents Approved, NYSED Review Complete, ATT Issued, etc.). You can also check your real-time status at any time by logging in to your GritSync dashboard.',
      },
      {
        question: 'What if I have a question not covered in these FAQs?',
        answer: 'Send us an email at support@gritsync.com or call +63 969 153 3239. Our team is happy to answer any question about your specific situation. You can also request a free consultation through the Quote page.',
      },
      {
        question: 'Do you offer a free consultation before I commit to the service?',
        answer: 'Yes. Request a free, no-obligation quotation through our Quote page. Our team will review your situation and provide a personalized cost and timeline estimate. There is no commitment required.',
      },
    ],
  },
  {
    id: 'nclex-sponsorship',
    icon: Shield,
    title: 'NCLEX Sponsorship Program',
    color: 'from-teal-500 to-teal-700',
    faqs: [
      {
        question: 'What is the GritSync NCLEX Sponsorship program?',
        answer: 'The GritSync NCLEX Sponsorship program connects qualified Filipino nurses with financial sponsors (typically US healthcare employers) who cover all or part of the NCLEX processing fees. In exchange, sponsored nurses commit to a work arrangement with the sponsoring employer in the US after obtaining their USRN license.',
      },
      {
        question: 'Who qualifies for the sponsorship program?',
        answer: 'Eligibility criteria typically include: a valid PRC RN license, at least 1–2 years of clinical nursing experience, willingness to work in the US under a sponsorship agreement, and meeting basic eligibility requirements for the NCLEX application. Visit the Sponsorship page for full details.',
      },
      {
        question: 'What does the sponsorship cover?',
        answer: 'Sponsorship may cover the full $775.99 package or specific components (e.g., BON fees, GritSync Service Fee, NYSED-related costs). The exact coverage depends on the sponsoring employer. All terms are clearly disclosed before you sign any agreement.',
      },
      {
        question: 'How do I apply for the sponsorship program?',
        answer: 'Visit the Sponsorship page on our website and click "Apply for Sponsorship." Fill in your nursing background and experience. Our team will review your application and contact you within a few business days.',
      },
      {
        question: 'Is the sponsorship a loan I have to repay?',
        answer: 'No — it is not a traditional loan. The sponsorship is tied to a work commitment with the employer. If you fulfill the employment terms, you are not required to repay. All terms will be fully disclosed before you sign anything.',
      },
    ],
  },
]

function FAQItem({ question, answer }: FAQItem) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
      <button
        className="w-full flex items-start justify-between gap-4 px-6 py-5 text-left bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="font-semibold text-gray-900 dark:text-gray-100 leading-snug">{question}</span>
        {open ? (
          <ChevronUp className="h-5 w-5 text-primary-500 flex-shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400 flex-shrink-0 mt-0.5" />
        )}
      </button>
      {open && (
        <div className="px-6 pb-6 pt-2 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700 text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
          {answer}
        </div>
      )}
    </div>
  )
}

export function FAQs() {
  const [search, setSearch] = useState('')
  const [activeSection, setActiveSection] = useState('')
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({})

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        })
      },
      { rootMargin: '-20% 0px -60% 0px' }
    )
    Object.values(sectionRefs.current).forEach((el) => el && observer.observe(el))
    return () => observer.disconnect()
  }, [])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const filtered = search.trim()
    ? faqCategories.map((cat) => ({
        ...cat,
        faqs: cat.faqs.filter(
          (f) =>
            f.question.toLowerCase().includes(search.toLowerCase()) ||
            (typeof f.answer === 'string' && f.answer.toLowerCase().includes(search.toLowerCase()))
        ),
      })).filter((cat) => cat.faqs.length > 0)
    : faqCategories

  const totalFAQs = faqCategories.reduce((sum, cat) => sum + cat.faqs.length, 0)

  const location = useLocation()
  const currentUrl = `https://gritsync.com${location.pathname}`

  const schemaFAQs = faqCategories.flatMap((cat) =>
    cat.faqs
      .filter((f) => typeof f.answer === 'string')
      .map((f) => ({ question: f.question, answer: f.answer as string }))
  )

  const breadcrumbs = [
    { name: 'Home', url: 'https://gritsync.com/' },
    { name: 'FAQs', url: 'https://gritsync.com/faqs' },
  ]

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="NCLEX FAQs for Filipino Nurses | GritSync — All Your Questions Answered"
        description={`${totalFAQs} frequently asked questions about NCLEX application processing for Filipino nurses — documents, timeline, fees, the exam, sponsorship, tracking, and more. Get clear answers from GritSync.`}
        keywords="NCLEX FAQ Philippines, NCLEX questions Filipino nurses, NCLEX application questions, NCLEX processing questions, NCLEX documents required Philippines, NCLEX timeline Philippines, NCLEX sponsorship questions, USRN FAQ, PRC to USRN questions"
        canonicalUrl={currentUrl}
        ogTitle="NCLEX FAQs for Filipino Nurses | GritSync"
        ogDescription={`${totalFAQs} FAQs about NCLEX application processing for Filipino nurses — documents, timeline, fees, sponsorship, and more.`}
        ogUrl={currentUrl}
        structuredData={[
          generateFAQSchema(schemaFAQs),
          generateBreadcrumbSchema(breadcrumbs),
        ]}
      />
      <Header />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gray-950 text-white py-24 md:py-32">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary-900/40 via-gray-950 to-gray-950" />
        <div className="absolute inset-0 opacity-5" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23ffffff\' fill-opacity=\'1\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")' }} />
        <div className="relative container mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary-900/50 border border-primary-700 text-primary-300 text-sm font-medium mb-6">
            <HelpCircle className="h-4 w-4" />
            <span>{totalFAQs} Questions Answered</span>
          </div>
          <h1 className="text-4xl md:text-6xl font-black mb-6 leading-tight">
            Frequently Asked
            <br />
            <span className="text-primary-400">Questions</span>
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
            Everything you need to know about NCLEX application processing for Filipino nurses — from documents to the exam and beyond.
          </p>
          {/* Search */}
          <div className="relative max-w-lg mx-auto">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-4 rounded-2xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>
        </div>
      </section>

      <div className="container mx-auto px-4 py-16">
        <div className="flex gap-12 max-w-7xl mx-auto">
          {/* Sticky Sidebar TOC */}
          {!search && (
            <aside className="hidden lg:block w-64 flex-shrink-0">
              <div className="sticky top-24">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-4">Categories</p>
                <nav className="space-y-1">
                  {faqCategories.map((cat) => {
                    const Icon = cat.icon
                    const isActive = activeSection === cat.id
                    return (
                      <button
                        key={cat.id}
                        onClick={() => scrollTo(cat.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${
                          isActive
                            ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-semibold'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-900 dark:hover:text-gray-100'
                        }`}
                      >
                        <Icon className="h-4 w-4 flex-shrink-0" />
                        <span className="leading-snug">{cat.title}</span>
                      </button>
                    )
                  })}
                </nav>

                <div className="mt-8 p-4 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800">
                  <p className="text-sm font-semibold text-primary-700 dark:text-primary-300 mb-1">Still have questions?</p>
                  <p className="text-xs text-primary-600 dark:text-primary-400 mb-3">Our team is ready to help you.</p>
                  <a
                    href="mailto:support@gritsync.com"
                    className="block text-center text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    Email Us
                  </a>
                </div>
              </div>
            </aside>
          )}

          {/* FAQ Content */}
          <main className="flex-1 min-w-0">
            {search && filtered.length === 0 && (
              <div className="text-center py-16">
                <AlertCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">No results found for "{search}"</p>
                <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">Try different keywords or browse the categories below.</p>
                <button onClick={() => setSearch('')} className="mt-4 text-primary-600 dark:text-primary-400 text-sm font-semibold hover:underline">Clear search</button>
              </div>
            )}

            <div className="space-y-16">
              {filtered.map((cat) => {
                const Icon = cat.icon
                return (
                  <section
                    key={cat.id}
                    id={cat.id}
                    ref={(el) => { sectionRefs.current[cat.id] = el }}
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.color} flex items-center justify-center flex-shrink-0`}>
                        <Icon className="h-5 w-5 text-white" />
                      </div>
                      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">{cat.title}</h2>
                      <span className="ml-auto text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-full">
                        {cat.faqs.length} questions
                      </span>
                    </div>
                    <div className="space-y-3">
                      {cat.faqs.map((faq, i) => (
                        <FAQItem key={i} question={faq.question} answer={faq.answer} />
                      ))}
                    </div>
                  </section>
                )
              })}
            </div>

            {/* CTA */}
            {!search && (
              <div className="mt-20 rounded-3xl bg-gradient-to-br from-gray-900 to-primary-950 border border-gray-800 p-10 text-center">
                <HelpCircle className="h-10 w-10 text-primary-400 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-white mb-3">Didn't find your answer?</h3>
                <p className="text-gray-400 mb-6 max-w-md mx-auto">Our team of NCLEX processing specialists is here to help. Send us your question and we'll get back to you promptly.</p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a
                    href="mailto:support@gritsync.com"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold transition-colors"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Email Support
                  </a>
                  <Link
                    to="/quote"
                    className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-gray-700 hover:border-gray-500 text-gray-300 hover:text-white font-semibold transition-colors"
                  >
                    Get a Free Quote
                  </Link>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>

      <Footer />
    </div>
  )
}
