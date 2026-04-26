import { useState, useRef, useEffect } from 'react'
import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { SEO } from '@/components/SEO'
import { ChevronDown, ChevronUp, Search, HelpCircle, FileText, CreditCard, Clock, Globe, User, Shield, MessageCircle, BookOpen, CheckCircle, AlertCircle } from 'lucide-react'
import { Link } from 'react-router-dom'

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
        answer: 'GritSync is a professional NCLEX application processing platform built specifically for Filipino nurses aspiring to become US Registered Nurses (USRNs). We guide you through every step — from document preparation and board of nursing application to NCLEX scheduling — so you can focus on studying rather than paperwork.',
      },
      {
        question: 'Who can use GritSync?',
        answer: 'GritSync is designed for Filipino nurses (RNs with PRC license) who want to apply for NCLEX licensure in the United States. Whether you are applying for the first time or retaking the NCLEX, our platform can support your journey.',
      },
      {
        question: 'How do I create an account?',
        answer: 'Click "Sign Up" on the top navigation bar. Fill in your personal details including your name, personal email address, and mobile number, then set a password. After submitting, a verification link will be sent to your email — click it to activate your account. Once verified, you can log in and start your application.',
      },
      {
        question: 'What email should I use to register?',
        answer: 'Use your personal email address (e.g., Gmail, Yahoo, Outlook, etc.). This will be your primary communication address for GritSync notifications, updates, and important messages.',
      },
      {
        question: 'I did not receive a verification email. What should I do?',
        answer: 'First, check your spam or junk folder. If it is not there, wait a few minutes and check again. If you still cannot find it, log in to your account and look for a "Resend Verification Email" option, or contact our support team at support@gritsync.com.',
      },
      {
        question: 'Can I use GritSync on my mobile phone?',
        answer: 'Yes! GritSync is a Progressive Web App (PWA) fully optimized for mobile devices. You can install it on your phone\'s home screen from your browser for an app-like experience without downloading from an app store.',
      },
    ],
  },
  {
    id: 'application-process',
    icon: FileText,
    title: 'The NCLEX Application Process',
    color: 'from-primary-500 to-primary-700',
    faqs: [
      {
        question: 'What is the overall NCLEX application process for Filipino nurses?',
        answer: (
          <div className="space-y-2">
            <p>The NCLEX process for Filipino nurses generally follows these steps:</p>
            <ol className="list-decimal list-inside space-y-1 mt-2 text-sm">
              <li><strong>Submit your application to your chosen US State Board of Nursing (BON)</strong></li>
              <li><strong>Credential evaluation</strong> — the BON reviews your PRC license and transcripts</li>
              <li><strong>Authorization to Test (ATT)</strong> — issued once your application is approved</li>
              <li><strong>Schedule your NCLEX exam</strong> with Pearson VUE using your ATT</li>
              <li><strong>Take and pass the NCLEX-RN</strong></li>
              <li><strong>Receive your US RN license</strong> from the state BON</li>
            </ol>
            <p className="mt-2">GritSync assists with Steps 1–3, helping you prepare documents, file the application correctly, and track your status at every stage.</p>
          </div>
        ),
      },
      {
        question: 'What services does GritSync provide?',
        answer: 'GritSync handles the application paperwork and submission process on your behalf. This includes: reviewing and organizing your required documents, completing the state BON application form accurately, submitting your application and coordinating with the BON, tracking your application status, and notifying you of updates and next steps.',
      },
      {
        question: 'Which US states does GritSync support?',
        answer: 'GritSync supports applications to all 50 US states and territories. However, we specialize in states with streamlined processes for internationally educated nurses such as California, Texas, New York, Illinois, and Florida. During your quotation, we will advise which state best fits your situation.',
      },
      {
        question: 'What is a Compact State (NLC) and should I apply there?',
        answer: 'The Nurse Licensure Compact (NLC) allows nurses to hold one multi-state license valid in all compact member states. If you intend to live and work in a compact state, applying there can give you greater flexibility. However, for internationally educated nurses, some compact states have stricter initial licensure requirements. Our team will help you evaluate the best option for your specific goals.',
      },
      {
        question: 'How do I start my NCLEX application with GritSync?',
        answer: 'Log in to your dashboard, then click "New Application." You will be guided through the service selection, document upload, and payment steps. Once your application is submitted, our team begins processing and you can track the status in real time from your dashboard.',
      },
      {
        question: 'What happens after I submit my application through GritSync?',
        answer: 'Our processing team reviews your documents for completeness and accuracy. We then prepare and submit your application to the chosen BON. You will receive status updates directly to your email and on your GritSync dashboard as your application progresses through each stage.',
      },
      {
        question: 'Can I apply to multiple states at the same time?',
        answer: 'Yes, you can submit separate applications for different states. Each application is processed independently and may have different fees and timelines. Our team can advise you on whether applying to multiple states makes sense for your situation.',
      },
      {
        question: 'What is an Authorization to Test (ATT)?',
        answer: 'An ATT (Authorization to Test) is an official document issued by Pearson VUE after the Board of Nursing approves your eligibility. It contains a unique registration number and expiration date that you use to schedule your NCLEX exam. Your ATT is typically valid for 90 days — you must schedule and take your exam within this window.',
      },
      {
        question: 'How do I schedule my NCLEX exam after receiving my ATT?',
        answer: 'Once you receive your ATT, visit the Pearson VUE website (www.pearsonvue.com/nclex) to schedule your exam at a test center near you. GritSync will notify you when your ATT is issued and provide step-by-step guidance for scheduling.',
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
        question: 'What documents are required to apply for NCLEX as a Filipino nurse?',
        answer: (
          <div className="space-y-2">
            <p>Requirements vary slightly by state, but generally include:</p>
            <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
              <li>Valid PRC Nursing License (Certificate of Registration)</li>
              <li>PRC Board Rating / License Verification</li>
              <li>Official Nursing School Transcript of Records (TOR)</li>
              <li>Certificate of Graduation / Diploma</li>
              <li>Valid government-issued ID (passport recommended)</li>
              <li>Completed BON application form</li>
              <li>Criminal Background Check (CGFNS or state-specific)</li>
              <li>CGFNS Certificate or VisaScreen (required by some states)</li>
              <li>English Proficiency Exam results (IELTS/TOEFL) — required by certain states</li>
            </ul>
            <p className="mt-2">Our team will provide you a personalized checklist for your target state after you request a quotation.</p>
          </div>
        ),
      },
      {
        question: 'Do my documents need to be authenticated or apostilled?',
        answer: 'Yes. Most US state Boards of Nursing require documents to be authenticated or apostilled. Philippine documents typically need to be authenticated by the Philippine Statistics Authority (PSA) and then apostilled by the Department of Foreign Affairs (DFA). GritSync will guide you through the exact authentication requirements for your target state.',
      },
      {
        question: 'What is CGFNS and do I need it?',
        answer: 'CGFNS (Commission on Graduates of Foreign Nursing Schools) is an organization that evaluates the credentials of internationally educated nurses. Some US states require a CGFNS Certificate before they process your NCLEX application. Others accept direct endorsement. During your quotation, we will tell you exactly what is required for your chosen state.',
      },
      {
        question: 'Is an English proficiency exam required?',
        answer: 'It depends on the state. Some states (e.g., California) require proof of English proficiency (IELTS Academic with a minimum score, or TOEFL) for internationally educated nurses. Others do not. GritSync will clarify this requirement upfront during the quotation process so you are not caught off guard.',
      },
      {
        question: 'How do I upload my documents to GritSync?',
        answer: 'After starting your application, go to the Documents section of your dashboard. You can upload files directly from your computer or mobile phone. Supported formats include PDF, JPG, and PNG. Make sure scans are clear, complete, and legible — blurry or cropped documents will be rejected by the BON.',
      },
      {
        question: 'What if a document is rejected or needs resubmission?',
        answer: 'If a document does not meet requirements, our team will notify you immediately through your dashboard and by email, with specific instructions on what needs to be corrected. You can upload a replacement document directly from your dashboard.',
      },
      {
        question: 'How long does document verification take?',
        answer: 'Our team typically reviews uploaded documents within 1–3 business days. Once all documents are verified and complete, we proceed to file your application with the BON.',
      },
    ],
  },
  {
    id: 'timeline',
    icon: Clock,
    title: 'Timeline & Processing Times',
    color: 'from-amber-500 to-orange-600',
    faqs: [
      {
        question: 'How long does the entire NCLEX process take?',
        answer: 'The total timeline varies by state and individual circumstances, but on average: BON application processing takes 4–12 weeks, credential evaluation (CGFNS, if required) takes 8–16 weeks, and ATT issuance typically follows 1–2 weeks after BON approval. In total, expect 3–6 months from submission to receiving your ATT, not including the time to prepare for and take the exam.',
      },
      {
        question: 'Which state has the fastest processing time?',
        answer: 'Processing times change frequently and depend on the current BON workload. States like Texas, Illinois, and New York are often cited as having relatively faster processing for internationally educated nurses. However, speed should not be the only factor — eligibility requirements and your long-term work goals also matter. Our team will help you find the best balance.',
      },
      {
        question: 'What can slow down my application?',
        answer: 'Common delays include: incomplete or incorrectly authenticated documents, delays in receiving official transcripts directly from your school to the BON, pending criminal background check results, and high application volumes at the BON. GritSync proactively monitors your application and alerts you to any issues that require attention.',
      },
      {
        question: 'How will I know the status of my application?',
        answer: 'You can check your real-time application status at any time from your GritSync dashboard. We update your status at every milestone — document review, BON submission, credential evaluation, ATT issuance, and beyond. You will also receive email notifications for major updates.',
      },
      {
        question: 'Can I track my application even after GritSync submits it to the BON?',
        answer: 'Yes. We continue monitoring your application status with the BON and update your dashboard accordingly. For some states, we can check directly with the BON on your behalf; for others, we will guide you to check using your BON applicant portal.',
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
        question: 'How much does it cost to process my NCLEX application through GritSync?',
        answer: 'GritSync service fees vary based on your target state and the specific services required (e.g., CGFNS assistance, state application filing, document review). You can get a personalized, no-obligation quote by visiting the Quote page on our website. All fees are clearly itemized — no hidden charges.',
      },
      {
        question: 'What payment methods does GritSync accept?',
        answer: 'GritSync accepts credit and debit cards (Visa, Mastercard, Amex) through our secure Stripe payment gateway. Payments are processed securely and encrypted. We do not store your card details.',
      },
      {
        question: 'Are the BON application fees included in the GritSync service fee?',
        answer: 'No. GritSync service fees cover our professional processing and support services. BON application fees (payable directly to the state Board of Nursing) and NCLEX exam fees (payable to Pearson VUE) are separate costs paid by you directly to those organizations. These amounts vary by state and will be clearly communicated in your quotation.',
      },
      {
        question: 'What are the typical BON and NCLEX fees I should budget for?',
        answer: 'BON application fees typically range from $100–$300 USD depending on the state. The NCLEX-RN exam fee charged by Pearson VUE is currently $200 USD. CGFNS fees (if required) range from $200–$400 USD. GritSync will provide you a full cost breakdown in your personalized quotation.',
      },
      {
        question: 'Is there a refund policy if I change my mind?',
        answer: 'Refund eligibility depends on how far your application has progressed. If you cancel before we have submitted any work on your behalf, a partial or full refund may be available. Once documents have been reviewed and your application has been submitted to the BON, fees are generally non-refundable. Please review our Terms of Service for full details or contact support@gritsync.com for your specific situation.',
      },
      {
        question: 'Can I pay in Philippine Pesos (PHP)?',
        answer: 'GritSync processes payments in US Dollars (USD). However, your card issuer or bank will handle the currency conversion from PHP to USD at their prevailing exchange rate. Check with your bank for any foreign transaction fees.',
      },
      {
        question: 'Is my payment information secure?',
        answer: 'Yes. All payments are processed through Stripe, a PCI DSS-compliant payment processor. Your card details are never stored on our servers. All data transmitted between your browser and our payment system is encrypted using TLS.',
      },
    ],
  },
  {
    id: 'nclex-exam',
    icon: BookOpen,
    title: 'The NCLEX Exam Itself',
    color: 'from-cyan-500 to-cyan-700',
    faqs: [
      {
        question: 'What is the NCLEX-RN exam?',
        answer: 'The NCLEX-RN (National Council Licensure Examination for Registered Nurses) is the standardized exam that all nursing graduates in the US must pass to obtain their RN license. It tests a candidate\'s knowledge and competence in nursing practice. The exam is administered by Pearson VUE at authorized test centers worldwide.',
      },
      {
        question: 'Can I take the NCLEX exam in the Philippines?',
        answer: 'Yes. Pearson VUE has authorized testing centers in the Philippines where Filipino nurses can take the NCLEX exam. This means you do not need to travel to the US just to sit for the exam. GritSync will guide you on how to select a Philippine testing center when scheduling your exam.',
      },
      {
        question: 'How is the NCLEX-RN structured?',
        answer: 'The NCLEX-RN uses a Computer Adaptive Testing (CAT) format. The exam adapts in difficulty based on your answers. Under the current Next Generation NCLEX (NGN) format, the exam includes a minimum of 85 items and a maximum of 150 items. New item types include case studies, extended multiple response, and clinical judgment questions. There is a 5-hour time limit.',
      },
      {
        question: 'What is the passing standard for the NCLEX?',
        answer: 'The NCLEX uses a pass/fail system based on a logistic model — there is no specific number you need to "get right." The exam stops when the computer has sufficient confidence (above a threshold) that you are either above or below the passing standard. The National Council of State Boards of Nursing (NCSBN) sets the passing standard.',
      },
      {
        question: 'What is the Next Generation NCLEX (NGN)?',
        answer: 'The NGN is the updated version of the NCLEX launched in April 2023. It focuses on Clinical Judgment and includes new item types such as extended multiple response, drag-and-drop, matrix questions, and unfolding case studies that test higher-order thinking. GritSync can point you to NGN-specific study resources.',
      },
      {
        question: 'How many times can I retake the NCLEX if I fail?',
        answer: 'There is no limit on the number of times you can attempt the NCLEX. However, you must wait 45 days between attempts and re-apply for a new ATT each time. Fees apply for each retake. GritSync can assist with retake applications.',
      },
      {
        question: 'When will I receive my NCLEX results?',
        answer: 'Quick Results are available on the Pearson VUE website approximately 48 hours after your exam for a small fee. Official results are sent by the BON, typically within 4–6 weeks of passing. Some states post license verification online within 1–2 weeks of passing.',
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
        answer: 'Congratulations! After passing, the BON will issue your US RN license. The license number will be posted in the state\'s online verification database. You can then begin working as a Registered Nurse in that state (and any compact states if applicable). GritSync will notify you when your license is posted and guide you through the next steps.',
      },
      {
        question: 'How do I verify my US RN license?',
        answer: 'All US state RN licenses can be verified through the Nursys database (www.nursys.com) or directly through the state BON\'s license verification portal. GritSync will provide you the direct link for your state.',
      },
      {
        question: 'Can I work in the US after passing the NCLEX in the Philippines?',
        answer: 'Passing the NCLEX makes you eligible to work as a USRN, but you still need the appropriate US work visa (typically EB-3 immigrant visa for permanent employment or TN/H-1B for temporary work). The NCLEX is a key credential required by US employers and immigration petitions. GritSync focuses on the NCLEX process; for visa processing, you will work with a separate immigration attorney or agency.',
      },
      {
        question: 'What if I want to transfer my license to another state?',
        answer: 'You can apply for a license by endorsement in another state once you hold an active US RN license. The process varies by state and is separate from the initial NCLEX application. GritSync can assist with endorsement applications.',
      },
      {
        question: 'Does GritSync offer any sponsorship or VisaScreen services?',
        answer: 'GritSync offers an NCLEX Sponsorship program that connects qualified nurses with funding support for their NCLEX processing fees. For VisaScreen (required for US work visas), we can guide you to the appropriate CGFNS services. Visit the Sponsorship page on our site for more details.',
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
        answer: 'Your dashboard is your central hub. You can: start and manage applications, upload and review required documents, view payment history and receipts, track your application status in real time, receive and read notifications from our team, and update your personal information.',
      },
      {
        question: 'Can I have multiple applications at the same time?',
        answer: 'Yes. You can have multiple active applications — for example, if you are applying to more than one state simultaneously or if you are reapplying after a failed NCLEX attempt. Each application is tracked independently in your dashboard.',
      },
      {
        question: 'How do I update my personal information?',
        answer: 'Log in to your dashboard, then navigate to "My Details" or "Account Settings." You can update your name, contact number, address, and profile photo from there.',
      },
      {
        question: 'What if I forget my password?',
        answer: 'Click "Forgot Password" on the login page. Enter your registered email address and we will send you a password reset link. The link is valid for 24 hours. If you do not receive it, check your spam folder or contact support@gritsync.com.',
      },
      {
        question: 'Is my personal data safe with GritSync?',
        answer: 'Yes. GritSync takes data security seriously. Your personal information and documents are stored securely with encryption. We do not sell or share your data with third parties without your consent. For full details, please read our Privacy Policy.',
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
        answer: 'You can reach our support team by email at support@gritsync.com or by phone at +1 (509) 270-3437. We also communicate through in-app notifications and email for all application-related updates.',
      },
      {
        question: 'What are GritSync\'s support hours?',
        answer: 'Our support team is available Monday through Friday, 9 AM – 6 PM (Philippine Standard Time / PST). For urgent matters, you can send an email and we will respond as quickly as possible.',
      },
      {
        question: 'Can I message my assigned processor directly?',
        answer: 'All communication goes through the GritSync platform to ensure proper documentation and continuity. Our team monitors all applications and will reach out to you proactively. You can also send messages or questions through the support channel in your dashboard.',
      },
      {
        question: 'What if I have a question not answered in these FAQs?',
        answer: 'Send us an email at support@gritsync.com or call us at +1 (509) 270-3437. Our team is happy to answer any questions about your specific situation. You can also request a free quotation and consultation through the Quote page.',
      },
      {
        question: 'Do you offer a free consultation before I commit to the service?',
        answer: 'Yes! You can request a free, no-obligation quotation through our Quote page. Our team will review your situation and provide a personalized cost and timeline estimate. There is no commitment required to receive a quotation.',
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
        answer: 'The GritSync NCLEX Sponsorship program connects qualified Filipino nurses with financial sponsors who cover all or part of their NCLEX processing and application fees. In exchange, sponsored nurses commit to a work arrangement with the sponsoring employer in the US after obtaining their USRN license.',
      },
      {
        question: 'Who qualifies for the sponsorship program?',
        answer: 'Eligibility criteria typically include: valid PRC RN license, at least 1–2 years of clinical nursing experience, willingness to work in the US under a sponsorship agreement, and meeting the basic English proficiency requirements of the target state. Visit the Sponsorship page for full eligibility details.',
      },
      {
        question: 'What does the sponsorship cover?',
        answer: 'Sponsorship packages vary, but may cover GritSync service fees, BON application fees, CGFNS fees, and NCLEX exam fees. The exact coverage depends on the sponsoring employer and the specific package. All terms are clearly stated in the sponsorship agreement.',
      },
      {
        question: 'How do I apply for the sponsorship program?',
        answer: 'Visit the Sponsorship page on our website and click "Apply for Sponsorship." Fill in the application form with your nursing background and experience. Our team will review your application and contact you within 3–5 business days.',
      },
      {
        question: 'Is the sponsorship a loan I need to repay?',
        answer: 'No — it is not a traditional loan. The sponsorship is tied to a work commitment with the employer sponsor. If you fulfill the employment terms, you are not required to repay the fees. Specific terms vary by sponsor and will be fully disclosed before you sign any agreement.',
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

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <SEO
        title="Frequently Asked Questions | GritSync"
        description="Everything you need to know about NCLEX application processing for Filipino nurses — documents, timelines, fees, the exam, and more."
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
