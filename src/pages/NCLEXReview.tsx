import { Header } from '@/components/Header'
import { Footer } from '@/components/Footer'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Link } from 'react-router-dom'
import {
  BookOpen, Brain, Clock, Target, CheckCircle, AlertCircle,
  BarChart2, Users, Star, Award, ChevronRight, HelpCircle,
  Lightbulb, TrendingUp, FileText,
} from 'lucide-react'

const NCLEX_CATEGORIES = [
  {
    name: 'Safe and Effective Care Environment',
    percent: '17–23%',
    color: 'blue',
    subtopics: ['Management of Care', 'Safety and Infection Control'],
  },
  {
    name: 'Health Promotion and Maintenance',
    percent: '6–12%',
    color: 'green',
    subtopics: ['Developmental Stages', 'Prevention and Early Detection'],
  },
  {
    name: 'Psychosocial Integrity',
    percent: '6–12%',
    color: 'purple',
    subtopics: ['Coping and Adaptation', 'Mental Health Concepts'],
  },
  {
    name: 'Physiological Integrity',
    percent: '53–67%',
    color: 'red',
    subtopics: [
      'Basic Care and Comfort',
      'Pharmacological and Parenteral Therapies',
      'Reduction of Risk Potential',
      'Physiological Adaptation',
    ],
  },
]

const STUDY_TIPS = [
  {
    icon: Clock,
    title: 'Study Consistently',
    description: 'Aim for 3–4 hours of focused study per day. Consistency over cramming yields better retention.',
  },
  {
    icon: Brain,
    title: 'Think Like a Nurse',
    description: 'NCLEX tests clinical judgment, not memorization. Always ask: "What is the safest action for this patient?"',
  },
  {
    icon: Target,
    title: 'Master Priority Questions',
    description: 'Use ABC (Airway, Breathing, Circulation) and Maslow\'s hierarchy to prioritize patient care in questions.',
  },
  {
    icon: BarChart2,
    title: 'Practice Questions Daily',
    description: 'Complete at least 100–150 practice questions per day. Focus on rationales, not just correct answers.',
  },
  {
    icon: Lightbulb,
    title: 'Use the SATA Strategy',
    description: 'For Select All That Apply, treat each option as True/False independently. Do not overthink the combinations.',
  },
  {
    icon: TrendingUp,
    title: 'Track Your Progress',
    description: 'Review your weak areas weekly. Focus additional study time on categories where your score is below 60%.',
  },
]

const EXAM_FACTS = [
  { label: 'Minimum Questions', value: '85' },
  { label: 'Maximum Questions', value: '150' },
  { label: 'Testing Time', value: '5 hours' },
  { label: 'Passing Standard', value: 'NCSBN Logit Scale' },
  { label: 'Next Generation Format', value: 'NGN NCLEX' },
  { label: 'Clinical Judgment', value: 'Primary Focus' },
]

const RESOURCES = [
  {
    name: 'UWorld NCLEX',
    description: 'Industry-leading question bank with detailed rationales and performance analytics.',
    type: 'Question Bank',
    icon: '📊',
  },
  {
    name: 'Saunders Comprehensive Review',
    description: 'The gold standard NCLEX review book covering all content areas with practice tests.',
    type: 'Review Book',
    icon: '📚',
  },
  {
    name: 'Archer Review',
    description: 'Highly rated for its focus on high-yield content and adaptive learning system.',
    type: 'Online Course',
    icon: '🎯',
  },
  {
    name: 'Kaplan NCLEX Prep',
    description: 'Structured review program with decision tree methodology for answering questions.',
    type: 'Course + Qbank',
    icon: '🏛️',
  },
  {
    name: 'Mark Klimek Audio Lectures',
    description: 'Free audio lectures covering pharmacology and priority setting in a memorable way.',
    type: 'Free Resource',
    icon: '🎧',
  },
  {
    name: 'NCSBN Learning Extension',
    description: 'Official NCLEX review from the test makers. Includes 3-week and 5-week review plans.',
    type: 'Official',
    icon: '🏆',
  },
]

const colorMap: Record<string, string> = {
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
  purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-800',
  red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
}

const barColorMap: Record<string, string> = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  purple: 'bg-purple-500',
  red: 'bg-red-500',
}

export function NCLEXReview() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <Header />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-primary-600 to-primary-800 text-white py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm font-medium mb-6">
            <Award className="h-4 w-4" />
            NCLEX-RN Exam Guide
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Pass Your NCLEX on the First Try
          </h1>
          <p className="text-xl text-primary-100 max-w-2xl mx-auto mb-8">
            Everything you need to know about the NCLEX-RN exam — content areas, study strategies, resources, and expert tips to help Filipino nurses succeed.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/application/new">
              <Button size="lg" className="bg-white text-primary-700 hover:bg-primary-50 font-semibold">
                Start Your NCLEX Application
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <Link to="/quote">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                Get a Free Quote
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Exam Facts */}
      <section className="py-12 px-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {EXAM_FACTS.map((fact) => (
              <div key={fact.label} className="text-center p-4 rounded-xl bg-gray-50 dark:bg-gray-700">
                <div className="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-1">{fact.value}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 font-medium">{fact.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-4 py-16 space-y-16">

        {/* What is NCLEX */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
              <HelpCircle className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">What is the NCLEX?</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-0 shadow-md">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary-600" />
                About the Exam
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                The National Council Licensure Examination (NCLEX-RN) is the standardized exam that nurses must pass to obtain licensure to practice in the United States and Canada. It is developed by the National Council of State Boards of Nursing (NCSBN).
              </p>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed mt-3">
                The exam uses Computer Adaptive Testing (CAT), meaning the difficulty of questions adapts based on your performance. The exam ends when the computer is 95% confident in your ability level.
              </p>
            </Card>
            <Card className="border-0 shadow-md">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
                <Star className="h-4 w-4 text-primary-600" />
                Next Generation NCLEX (NGN)
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                As of April 2023, the NCLEX uses the Next Generation NCLEX (NGN) format which emphasizes Clinical Judgment. The NGN includes new question types designed to test how you think and make decisions as a nurse, not just what you know.
              </p>
              <div className="mt-3 space-y-2">
                {['Extended Multiple Response', 'Extended Drag and Drop', 'Cloze (Drop-Down)', 'Enhanced Hot Spot', 'Matrix/Grid', 'Trend Item'].map(type => (
                  <div key={type} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />
                    {type}
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </section>

        {/* Content Areas */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
              <BarChart2 className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">NCLEX Test Plan Categories</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            {NCLEX_CATEGORIES.map((cat) => (
              <Card key={cat.name} className={`border-0 shadow-md border-l-4 ${colorMap[cat.color]}`}>
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-tight flex-1 mr-3">
                    {cat.name}
                  </h3>
                  <span className={`text-xs font-bold px-2 py-1 rounded-full border ${colorMap[cat.color]} flex-shrink-0`}>
                    {cat.percent}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mb-3">
                  <div
                    className={`h-1.5 rounded-full ${barColorMap[cat.color]}`}
                    style={{ width: cat.percent.split('–')[1] }}
                  />
                </div>
                <ul className="space-y-1">
                  {cat.subtopics.map(sub => (
                    <li key={sub} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <ChevronRight className="h-3 w-3 flex-shrink-0 text-gray-400" />
                      {sub}
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
            * Percentages are approximate based on NCSBN 2023 NCLEX-RN Test Plan
          </p>
        </section>

        {/* Study Tips */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
              <Lightbulb className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Top Study Strategies</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {STUDY_TIPS.map((tip) => {
              const Icon = tip.icon
              return (
                <Card key={tip.title} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Icon className="h-4 w-4 text-primary-600 dark:text-primary-400" />
                    </div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{tip.title}</h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{tip.description}</p>
                </Card>
              )
            })}
          </div>
        </section>

        {/* Recommended Resources */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Recommended Review Resources</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {RESOURCES.map((res) => (
              <Card key={res.name} className="border-0 shadow-md hover:shadow-lg transition-shadow">
                <div className="flex items-start gap-3 mb-3">
                  <span className="text-2xl flex-shrink-0">{res.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{res.name}</h3>
                    <span className="text-xs text-primary-600 dark:text-primary-400 font-medium">{res.type}</span>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{res.description}</p>
              </Card>
            ))}
          </div>
        </section>

        {/* Filipino Nurse Tips */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
              <Users className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tips for Filipino Nurses</h2>
          </div>
          <Card className="border-0 shadow-md">
            <div className="grid sm:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-sm">Language & Culture</h3>
                <ul className="space-y-2">
                  {[
                    'Practice reading medical English at full speed — NCLEX questions are long.',
                    'Watch out for double negatives in questions: "Which of the following is NOT..."',
                    'Familiarize yourself with American nursing procedures which may differ from Philippine practice.',
                    'Focus on therapeutic communication — Filipino culture may lean more directive vs. patient-centered.',
                  ].map(tip => (
                    <li key={tip} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <AlertCircle className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 text-sm">Application Process</h3>
                <ul className="space-y-2">
                  {[
                    'Apply for credentials evaluation early (CGFNS, ERES, or State Board equivalency).',
                    'Some states require a Social Security Number before authorization to test.',
                    'Your ATT (Authorization to Test) is valid for 90 days — schedule promptly.',
                    'GritSync handles your full application — from documents to your testing date.',
                  ].map(tip => (
                    <li key={tip} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                      <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                      {tip}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </Card>
        </section>

        {/* Study Plan */}
        <section>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-lg flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary-600 dark:text-primary-400" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sample 8-Week Study Plan</h2>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { weeks: 'Weeks 1–2', focus: 'Foundation Review', tasks: ['Anatomy & Physiology', 'Med-Surg Fundamentals', '100 practice Qs/day'] },
              { weeks: 'Weeks 3–4', focus: 'Pharmacology', tasks: ['Drug classifications', 'Priority medications', '100 practice Qs/day'] },
              { weeks: 'Weeks 5–6', focus: 'Specialty Areas', tasks: ['Maternal & Peds', 'Psych & Community', '100–150 Qs/day'] },
              { weeks: 'Weeks 7–8', focus: 'Final Prep', tasks: ['Full mock exams', 'Weak area review', '150+ Qs/day with review'] },
            ].map((phase) => (
              <Card key={phase.weeks} className="border-0 shadow-md text-center">
                <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/40 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Clock className="h-5 w-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="text-xs text-primary-600 dark:text-primary-400 font-semibold mb-1">{phase.weeks}</div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-3">{phase.focus}</h3>
                <ul className="space-y-1">
                  {phase.tasks.map(task => (
                    <li key={task} className="text-xs text-gray-600 dark:text-gray-400">{task}</li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-2xl bg-gradient-to-br from-primary-600 to-primary-800 text-white p-10 text-center">
          <Award className="h-10 w-10 mx-auto mb-4 text-primary-200" />
          <h2 className="text-3xl font-bold mb-3">Ready to Get Licensed?</h2>
          <p className="text-primary-100 max-w-lg mx-auto mb-8">
            GritSync guides you through every step of the NCLEX application process — from document collection to your Authorization to Test.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link to="/application/new">
              <Button size="lg" className="bg-white text-primary-700 hover:bg-primary-50 font-semibold">
                Apply Now
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </Link>
            <Link to="/quote">
              <Button size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                View Pricing
              </Button>
            </Link>
          </div>
        </section>

      </div>

      <Footer />
    </div>
  )
}
