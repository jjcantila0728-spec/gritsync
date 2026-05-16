import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import {
  BookOpen, Brain, Target, Trophy, Lock, Play, CheckCircle,
  BarChart3, ArrowLeft, Calendar, Users, Star,
  CreditCard, FileText, Video, Mic, GraduationCap, Clock, Timer, Printer, X, Send, ExternalLink, Zap,
  AlertCircle, Award, Menu, ChevronRight, Flame,
  Sparkles, Lightbulb, PenLine,
  ChevronLeft, Edit3, MapPin, ThumbsUp, PlayCircle,
} from 'lucide-react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { nclexApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { appUrl, pearsonVueUrl, getSubdomainContext } from '../../lib/routing';
import { homePathForRole } from '../../lib/permissions';
import toast from 'react-hot-toast';
import { loadStripe, Stripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';

// ── Types ─────────────────────────────────────────────────────────────────────

interface NclexProfile {
  examDate: string | null;
  tier: 'FREE' | 'PREMIUM';
  tierExpiresAt: string | null;
  specialAccess: string[];
  upgradeRequested: boolean;
}

interface PlanFeature { name: string; included: boolean }

interface SubscriptionPlan {
  id: string; name: string; price: number; durationDays: number | null;
  currency: string; description: string;
  features: string[] | PlanFeature[]; excludedFeatures: string[];
  isPopular: boolean; isActive: boolean;
}

interface PlanConfig {
  plans: SubscriptionPlan[];
  paymentInstructions?: string;
  gcashNumber?: string;
  gcashName?: string;
  bdoNumber?: string;
  bdoName?: string;
  stripePublishableKey?: string;
}

type PaymentMethod = 'gcash' | 'bdo' | 'stripe';

interface Session {
  id: string; examType: string; status: string;
  result: Record<string, unknown> | null;
  startedAt: string; completedAt: string | null;
  correctCount: number; currentIndex: number;
}

interface NclexVideo {
  id: string;
  title: string;
  description: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
  order: number;
  isPublished: boolean;
  topic: string;
}

interface VideoConfig {
  videos: NclexVideo[];
}

interface ApprovedTestimonial {
  id: string;
  clientName: string;
  content: string;
  rating: number;
  designation?: string;
  location?: string;
  createdAt: string;
  isFeatured?: boolean;
}

interface HomeData {
  sessions: Session[];
  exitAccess: unknown | null;
  profile: NclexProfile | null;
  questionsToday: number;
  peerStats: { avgRA: number | null; countRA: number; avgCAT: number | null; countCAT: number } | null;
  stats: {
    totalSessions: number;
    completedSessions: number;
    questionBanks: Array<{ bank: string; _count: number }>;
    usedByBank: Record<string, number>;
    usedByTopic: Record<string, number>;
    byTopic: Array<{ topic: string; count: number }>;
    byFormat: Array<{ format: string; count: number }>;
  };
}

// ── Study Calendar Data ───────────────────────────────────────────────────────

const NCLEX_TOPICS = [
  { name: 'NCLEX Strategies & Test-Taking', color: 'bg-blue-100 text-blue-800', icon: '🎯' },
  { name: 'Safety & Infection Control', color: 'bg-red-100 text-red-800', icon: '🛡️' },
  { name: 'Pharmacology Fundamentals', color: 'bg-purple-100 text-purple-800', icon: '💊' },
  { name: 'Cardiovascular Nursing', color: 'bg-rose-100 text-rose-800', icon: '❤️' },
  { name: 'Respiratory Nursing', color: 'bg-sky-100 text-sky-800', icon: '🫁' },
  { name: 'Neurological Nursing', color: 'bg-indigo-100 text-indigo-800', icon: '🧠' },
  { name: 'Gastrointestinal Nursing', color: 'bg-amber-100 text-amber-800', icon: '🫀' },
  { name: 'Genitourinary/Renal Nursing', color: 'bg-teal-100 text-teal-800', icon: '💧' },
  { name: 'Endocrine Nursing', color: 'bg-orange-100 text-orange-800', icon: '⚗️' },
  { name: 'Musculoskeletal & Integumentary', color: 'bg-lime-100 text-lime-800', icon: '🦴' },
  { name: 'Mental Health Nursing', color: 'bg-fuchsia-100 text-fuchsia-800', icon: '🧘' },
  { name: 'Maternal-Newborn Nursing', color: 'bg-pink-100 text-pink-800', icon: '👶' },
  { name: 'Pediatric Nursing', color: 'bg-green-100 text-green-800', icon: '🌱' },
  { name: 'Critical Care & Emergency', color: 'bg-red-100 text-red-900', icon: '🚨' },
  { name: 'Leadership & Management', color: 'bg-slate-100 text-slate-800', icon: '📋' },
  { name: 'Community & Transcultural', color: 'bg-cyan-100 text-cyan-800', icon: '🌍' },
  { name: 'Hematological & Immunological', color: 'bg-violet-100 text-violet-800', icon: '🩸' },
  { name: 'Oncology & Palliative Care', color: 'bg-gray-100 text-gray-800', icon: '🎗️' },
  { name: 'Nutrition & Metabolism', color: 'bg-yellow-100 text-yellow-800', icon: '🥗' },
  { name: 'Comprehensive Review & Mock Exams', color: 'bg-emerald-100 text-emerald-800', icon: '📝' },
];

const TEST_PLAN_CATEGORIES = [
  { id: 'mgmt',    label: 'Management of Care',          pct: '15–21%', weight: 18, icon: '📋', accent: '#1e3a8a', topics: ['Leadership & Management', 'NCLEX Strategies & Test-Taking'] },
  { id: 'safety',  label: 'Safety & Infection Control',  pct: '9–15%',  weight: 12, icon: '🛡️', accent: '#991b1b', topics: ['Safety & Infection Control'] },
  { id: 'health',  label: 'Health Promotion',            pct: '6–12%',  weight: 9,  icon: '🌱', accent: '#14532d', topics: ['Maternal-Newborn Nursing', 'Pediatric Nursing', 'Community & Transcultural'] },
  { id: 'psycho',  label: 'Psychosocial Integrity',      pct: '6–12%',  weight: 9,  icon: '🧘', accent: '#5b21b6', topics: ['Mental Health Nursing'] },
  { id: 'basic',   label: 'Basic Care & Comfort',        pct: '6–12%',  weight: 9,  icon: '💆', accent: '#0f766e', topics: ['Nutrition & Metabolism', 'Musculoskeletal & Integumentary'] },
  { id: 'pharma',  label: 'Pharmacological Therapies',   pct: '12–18%', weight: 15, icon: '💊', accent: '#581c87', topics: ['Pharmacology Fundamentals'] },
  { id: 'risk',    label: 'Reduction of Risk Potential', pct: '9–15%',  weight: 12, icon: '🔬', accent: '#134e4a', topics: ['Critical Care & Emergency', 'Hematological & Immunological'] },
  { id: 'physio',  label: 'Physiological Adaptation',    pct: '11–17%', weight: 14, icon: '❤️', accent: '#92400e', topics: ['Cardiovascular Nursing', 'Respiratory Nursing', 'Neurological Nursing', 'Gastrointestinal Nursing', 'Genitourinary/Renal Nursing', 'Endocrine Nursing'] },
];

const WEEK_PLANS: Record<string, { label: string; weeks: Array<{ week: number; theme: string; topics: number[]; daily: string[]; qGoal: number }> }> = {
  '12': {
    label: '12-Week Comprehensive',
    weeks: [
      { week: 1, theme: 'Foundation & Strategies', topics: [0, 1], daily: ['Read strategy notes', 'Do 15 practice Qs', 'Review rationales'], qGoal: 75 },
      { week: 2, theme: 'Fundamentals & Safety', topics: [1, 18], daily: ['Study assigned topics', 'Do 20 practice Qs', 'Review notes before bed'], qGoal: 100 },
      { week: 3, theme: 'Pharmacology Part 1', topics: [2], daily: ['Drug cards x10', 'Drug calculations', 'Do 25 practice Qs'], qGoal: 125 },
      { week: 4, theme: 'Cardiovascular & Respiratory', topics: [3, 4], daily: ['Read textbook section', 'Do 25 practice Qs', 'Create concept maps'], qGoal: 125 },
      { week: 5, theme: 'Neurological & GI', topics: [5, 6], daily: ['Study pathophysiology', 'Do 25 practice Qs', 'Review labs & meds'], qGoal: 125 },
      { week: 6, theme: 'GU/Renal & Endocrine', topics: [7, 8], daily: ['Review lab values', 'Do 25 practice Qs', 'Medication review'], qGoal: 125 },
      { week: 7, theme: 'Musculoskeletal & Integumentary', topics: [9, 16], daily: ['Study disorders', 'Do 20 practice Qs', 'Review interventions'], qGoal: 100 },
      { week: 8, theme: 'Mental Health Nursing', topics: [10], daily: ['Therapeutic communication', 'Do 25 practice Qs', 'Review psych meds'], qGoal: 125 },
      { week: 9, theme: 'Maternal-Newborn Nursing', topics: [11], daily: ['OB content review', 'Do 25 practice Qs', 'Normal vs abnormal findings'], qGoal: 125 },
      { week: 10, theme: 'Pediatric Nursing', topics: [12], daily: ['Growth & development', 'Do 25 practice Qs', 'Peds medications & dosing'], qGoal: 125 },
      { week: 11, theme: 'Critical Care & Leadership', topics: [13, 14, 15], daily: ['Priority & delegation', 'Do 30 practice Qs', 'Leadership scenarios'], qGoal: 150 },
      { week: 12, theme: 'Comprehensive Review', topics: [19], daily: ['Full mock exam', 'Review all weak areas', 'Confidence building'], qGoal: 150 },
    ],
  },
  '9': {
    label: '9-Week Focused',
    weeks: [
      { week: 1, theme: 'Strategies + Safety + Fundamentals', topics: [0, 1, 18], daily: ['Strategy review', 'Do 20 Qs', 'Review rationales'], qGoal: 100 },
      { week: 2, theme: 'Pharmacology (Comprehensive)', topics: [2], daily: ['Drug cards x15', 'Calculations practice', 'Do 30 Qs'], qGoal: 150 },
      { week: 3, theme: 'Cardiovascular & Respiratory', topics: [3, 4], daily: ['Pathophysiology', 'Do 30 Qs', 'Review meds & labs'], qGoal: 150 },
      { week: 4, theme: 'Neurological + GI + GU', topics: [5, 6, 7], daily: ['Study each system', 'Do 30 Qs', 'Create summary notes'], qGoal: 150 },
      { week: 5, theme: 'Endocrine + Musculoskeletal + Integumentary', topics: [8, 9, 16], daily: ['Disorders & management', 'Do 25 Qs', 'Lab values review'], qGoal: 125 },
      { week: 6, theme: 'Mental Health + Oncology', topics: [10, 17], daily: ['Therapeutic techniques', 'Do 25 Qs', 'Psych medications'], qGoal: 125 },
      { week: 7, theme: 'Maternal-Newborn + Pediatrics', topics: [11, 12], daily: ['OB & peds content', 'Do 30 Qs', 'Developmental stages'], qGoal: 150 },
      { week: 8, theme: 'Critical Care + Leadership + Community', topics: [13, 14, 15], daily: ['Priority & delegation', 'Do 35 Qs', 'NCLEX scenarios'], qGoal: 175 },
      { week: 9, theme: 'Comprehensive Review', topics: [19], daily: ['Full mock exams', 'Target weak areas', 'Final preparation'], qGoal: 175 },
    ],
  },
  '6': {
    label: '6-Week Accelerated',
    weeks: [
      { week: 1, theme: 'Strategies + Pharmacology', topics: [0, 2], daily: ['Intensive strategy review', 'Do 30 Qs', 'Drug priority list'], qGoal: 150 },
      { week: 2, theme: 'Cardiovascular + Respiratory + Neuro', topics: [3, 4, 5], daily: ['3 systems per day rotation', 'Do 35 Qs', 'Critical thinking practice'], qGoal: 175 },
      { week: 3, theme: 'GI + GU + Endocrine + Musculoskeletal', topics: [6, 7, 8, 9], daily: ['Rapid content review', 'Do 35 Qs', 'Labs & diagnostics'], qGoal: 175 },
      { week: 4, theme: 'Mental Health + Maternal-Newborn', topics: [10, 11], daily: ['Focused content study', 'Do 35 Qs', 'Special populations'], qGoal: 175 },
      { week: 5, theme: 'Pediatrics + Critical Care + Leadership', topics: [12, 13, 14], daily: ['Priority questions', 'Do 40 Qs', 'Delegation scenarios'], qGoal: 200 },
      { week: 6, theme: 'Comprehensive Review', topics: [19], daily: ['2 mock exams/week', 'Review ALL weak areas', 'NCLEX strategy refresher'], qGoal: 200 },
    ],
  },
  '4': {
    label: '4-Week Intensive',
    weeks: [
      { week: 1, theme: 'Strategies + Pharmacology + Cardio/Resp', topics: [0, 2, 3, 4], daily: ['Intensive study 6+ hrs', 'Do 40 Qs', 'Drug cards x20'], qGoal: 200 },
      { week: 2, theme: 'Neuro + GI + GU + Endocrine + Musculo', topics: [5, 6, 7, 8, 9], daily: ['Rapid system reviews', 'Do 45 Qs', 'Summary notes only'], qGoal: 225 },
      { week: 3, theme: 'Mental Health + OB + Peds + Critical Care', topics: [10, 11, 12, 13], daily: ['High-yield content', 'Do 45 Qs', 'NCLEX-style scenarios'], qGoal: 225 },
      { week: 4, theme: 'Leadership + Mock Exams + Review', topics: [14, 15, 19], daily: ['Full mock exam daily', 'Target ALL weak areas', 'Final preparation'], qGoal: 250 },
    ],
  },
  '3': {
    label: '3-Week Rapid',
    weeks: [
      { week: 1, theme: 'Strategies + Pharm + Body Systems I', topics: [0, 2, 3, 4, 5], daily: ['8+ hrs study', 'Do 50 Qs', 'Drug flash cards daily'], qGoal: 250 },
      { week: 2, theme: 'Body Systems II + Mental Health + OB/Peds', topics: [6, 7, 8, 9, 10, 11, 12], daily: ['High-yield review only', 'Do 50 Qs', 'No new material after Day 5'], qGoal: 250 },
      { week: 3, theme: 'Critical Care + Leadership + Final Review', topics: [13, 14, 15, 19], daily: ['Mock exam + review', 'Do 50 Qs', 'NCLEX strategy daily'], qGoal: 250 },
    ],
  },
  '2': {
    label: '2-Week Emergency',
    weeks: [
      { week: 1, theme: 'All Body Systems + Pharmacology', topics: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], daily: ['10+ hrs study', 'Do 60 Qs', 'High-yield only — no details'], qGoal: 300 },
      { week: 2, theme: 'Mental Health + OB/Peds + Leadership + Review', topics: [10, 11, 12, 13, 14, 15, 19], daily: ['Mock exam each morning', 'Do 60 Qs', 'Review rationales only'], qGoal: 300 },
    ],
  },
};

const WEEK_OF_EXAM = [
  { day: 'Day 7', label: 'Full Mock Exam Day', color: 'bg-blue-50 border-blue-200', tasks: ['Take a full 85-question mock exam', 'Review every rationale carefully', 'Identify your top 3 weak areas', 'Create a brief review list'], tip: 'Simulate real exam conditions — sit at a desk, no distractions, time yourself.' },
  { day: 'Day 6', label: 'Leadership & Pharmacology', color: 'bg-purple-50 border-purple-200', tasks: ['Review priority-setting & delegation', 'Review top 50 NCLEX drugs', 'Do 20 pharmacology practice Qs', 'Review SATA strategies'], tip: 'Leadership is heavily tested. Focus on delegation principles and chain of command.' },
  { day: 'Day 5', label: 'OB/Peds + Mental Health', color: 'bg-pink-50 border-pink-200', tasks: ['Review maternal-newborn priority findings', 'Review pediatric developmental milestones', 'Review therapeutic communication', 'Do 20 practice Qs (mixed)'], tip: 'Know your "call the doctor" findings for OB — they appear frequently on NCLEX.' },
  { day: 'Day 4', label: 'Cardio + Respiratory + Neuro', color: 'bg-red-50 border-red-200', tasks: ['Review high-yield cardiac rhythms', 'Review respiratory priority care', 'Neuro assessment: Glasgow, pupils', 'Do 15 practice Qs — no new topics'], tip: 'Focus on what to assess first and when to call the provider. No new material!' },
  { day: 'Day 3', label: 'Targeted Weak Area Review', color: 'bg-amber-50 border-amber-200', tasks: ['Review your identified weak areas ONLY', 'Do 10 targeted practice Qs per area', 'Re-read rationales from Day 7 mock', 'Pack your exam bag tonight'], tip: 'Keep it light. Reinforce what you know — don\'t panic-read new material.' },
  { day: 'Day 2', label: 'Light Review + Rest', color: 'bg-green-50 border-green-200', tasks: ['Read your personal summary notes only', 'Do 10 confidence-boosting practice Qs', 'Prepare: valid ID, confirmation, snacks', 'Sleep by 10 PM'], tip: 'Rest is preparation. Your brain needs sleep to consolidate everything you\'ve learned.' },
  { day: 'Day 1', label: 'Exam Eve — NO Studying', color: 'bg-teal-50 border-teal-200', tasks: ['Verify your test center location', 'Prepare your outfit and bag', 'Eat a nourishing dinner', 'Relax, watch something enjoyable', 'Sleep 7–8 hours'], tip: 'Do NOT open any review materials. Trust your preparation. You are ready.' },
  { day: 'Exam Day', label: '🎯 NCLEX Exam Day', color: 'bg-emerald-50 border-emerald-300', tasks: ['Eat a protein-rich breakfast', 'Arrive 30 minutes early', 'Use ADPIE to approach every question', 'Eliminate wrong answers first', 'Trust your first instinct', 'Breathe — you\'ve prepared for this!'], tip: 'Read every question twice. Select the most correct answer, not the most detailed. Think like a safe nurse.' },
];

// ── Constants ─────────────────────────────────────────────────────────────────

const FORMAT_META: Record<string, { label: string; tag: string; tagColor: string }> = {
  MCQ:              { label: 'Multiple Choice',        tag: 'Classic', tagColor: 'bg-blue-100 text-blue-700' },
  SATA:             { label: 'Select All That Apply',  tag: 'Classic', tagColor: 'bg-blue-100 text-blue-700' },
  FILL_IN_BLANK:    { label: 'Fill-in-the-Blank',      tag: 'Both',    tagColor: 'bg-gray-100 text-gray-600' },
  ORDERED_RESPONSE: { label: 'Ordered Response',       tag: 'Both',    tagColor: 'bg-gray-100 text-gray-600' },
  BOW_TIE:          { label: 'Bow-Tie',                tag: 'NGN',     tagColor: 'bg-purple-100 text-purple-700' },
  MATRIX_MCQ:       { label: 'Matrix MCQ',             tag: 'NGN',     tagColor: 'bg-purple-100 text-purple-700' },
  MATRIX_SATA:      { label: 'Matrix SATA',            tag: 'NGN',     tagColor: 'bg-purple-100 text-purple-700' },
  DROP_DOWN:        { label: 'Drop-Down Cloze',        tag: 'NGN',     tagColor: 'bg-purple-100 text-purple-700' },
  HIGHLIGHT_TEXT:   { label: 'Highlight Text',         tag: 'NGN',     tagColor: 'bg-purple-100 text-purple-700' },
  DRAG_DROP:        { label: 'Drag & Drop',            tag: 'NGN',     tagColor: 'bg-purple-100 text-purple-700' },
};

const EXAM_TYPE_LABELS: Record<string, string> = {
  READINESS_ASSESSMENT: 'Readiness Assessment',
  CAT: 'CAT Adaptive',
  TUTORIAL: 'Tutorial',
  EXIT_EXAM: 'Exit Exam',
};

// ── QBanks sub-tab type ───────────────────────────────────────────────────────

export type QbanksTab = 'statistics' | 'previous-tests' | 'remediation';
export const VALID_QBANKS_TABS: QbanksTab[] = ['statistics', 'previous-tests', 'remediation'];

// ── Speedometer Gauge ─────────────────────────────────────────────────────────

const SpeedometerGauge = ({ value }: { value: number | null }) => {
  const [animVal, setAnimVal] = useState(0);
  const [displayVal, setDisplayVal] = useState(0);
  const rafRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    cancelAnimationFrame(rafRef.current);

    if (value === null) {
      setAnimVal(0);
      setDisplayVal(0);
      return;
    }

    const target = value;
    // Phase 1: 0 → 100 (bicycle throttle, cubic ease-in = accelerating)
    // Phase 2: 100 → target (ease-out = braking to final value)
    const phase1 = 1000;
    const phase2 = 1300;
    const easeIn  = (t: number) => t * t * t;
    const easeOut = (t: number) => 1 - Math.pow(1 - t, 2.5);

    timerRef.current = setTimeout(() => {
      const t0 = performance.now();
      const tick = (now: number) => {
        const el = now - t0;
        let v: number;
        if (el < phase1) {
          v = easeIn(el / phase1) * 100;
        } else if (el < phase1 + phase2) {
          v = 100 - (100 - target) * easeOut((el - phase1) / phase2);
        } else {
          setAnimVal(target);
          setDisplayVal(target);
          return;
        }
        setAnimVal(v);
        setDisplayVal(Math.round(v));
        rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, 350);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      cancelAnimationFrame(rafRef.current);
    };
  }, [value]);

  // Geometry — original large gauge, CY shifted down so top-tick labels have room
  const CX = 160, CY = 162, R = 112, STROKE = 20;
  const arcLen = Math.PI * R;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const pt = (r: number, deg: number) => ({
    x: CX + r * Math.cos(toRad(deg)),
    y: CY + r * Math.sin(toRad(deg)),
  });

  const s = pt(R, 180);
  const e = pt(R, 0);
  const bgArc = `M ${s.x} ${s.y} A ${R} ${R} 0 0 1 ${e.x} ${e.y}`;

  const ZONES = [
    { from: 180, to: 144, fill: '#fca5a5' },
    { from: 144, to: 108, fill: '#fdba74' },
    { from: 108, to:  72, fill: '#fde047' },
    { from:  72, to:  36, fill: '#a3e635' },
    { from:  36, to:   0, fill: '#4ade80' },
  ];

  const fillColor = animVal >= 80 ? '#16a34a' : animVal >= 60 ? '#65a30d' : animVal >= 40 ? '#ca8a04' : animVal >= 20 ? '#ea580c' : '#dc2626';
  const needleAngle = -180 + (animVal / 100) * 180;

  // Ticks outside the arc — start just beyond outer edge (R + STROKE/2 = 122)
  const outerEdge = R + STROKE / 2;
  const allTicks = Array.from({ length: 21 }, (_, i) => i * 5); // 0,5,10…100
  const needleLen = R - STROKE / 2 - 6;
  const tailLen = 24;

  const statusText = displayVal >= 80 ? 'Excellent Readiness'
    : displayVal >= 60 ? 'Good Readiness'
    : displayVal >= 40 ? 'Developing'
    : displayVal > 0 ? 'Needs More Practice'
    : 'No exam data yet';

  return (
    <div className="w-full max-w-[280px] mx-auto select-none">
      {/* Percentage + status — above the gauge, outside the SVG */}
      <div className="text-center mb-1">
        <span className="text-3xl font-black tabular-nums" style={{ color: fillColor }}>
          {displayVal}%
        </span>
        <p className="text-[11px] text-gray-500 mt-0.5">{statusText}</p>
      </div>

      <svg viewBox="0 0 320 185" className="w-full">
        <defs>
          <radialGradient id="hubGrad" cx="35%" cy="30%">
            <stop offset="0%" stopColor="#6b7280" />
            <stop offset="100%" stopColor="#111827" />
          </radialGradient>
          <linearGradient id="needleGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#e5e7eb" />
            <stop offset="50%" stopColor="#374151" />
            <stop offset="100%" stopColor="#111827" />
          </linearGradient>
        </defs>

        {/* Zone outer glow */}
        {ZONES.map((z, i) => {
          const zs = pt(R, z.from), ze = pt(R, z.to);
          const la = z.from - z.to > 180 ? 1 : 0;
          return (
            <path key={i} d={`M ${zs.x} ${zs.y} A ${R} ${R} 0 ${la} 1 ${ze.x} ${ze.y}`}
              fill="none" stroke={z.fill} strokeWidth={STROKE + 14} opacity={0.10} />
          );
        })}

        {/* Track background */}
        <path d={bgArc} fill="none" stroke="#e5e7eb" strokeWidth={STROKE} strokeLinecap="butt" />

        {/* Zone color bands */}
        {ZONES.map((z, i) => {
          const zs = pt(R, z.from), ze = pt(R, z.to);
          const la = z.from - z.to > 180 ? 1 : 0;
          return (
            <path key={i} d={`M ${zs.x} ${zs.y} A ${R} ${R} 0 ${la} 1 ${ze.x} ${ze.y}`}
              fill="none" stroke={z.fill} strokeWidth={STROKE} opacity={0.30} />
          );
        })}

        {/* Animated fill arc */}
        <path d={bgArc} fill="none" stroke={fillColor} strokeWidth={STROKE} strokeLinecap="butt"
          strokeDasharray={`${arcLen}`}
          strokeDashoffset={`${arcLen - (animVal / 100) * arcLen}`}
        />

        {/* Calibration ticks — every 5%, all outside the arc band */}
        {allTicks.map(pct => {
          const isMajor  = pct % 25 === 0;
          const isMedium = pct % 10 === 0 && !isMajor;
          const len = isMajor ? 14 : isMedium ? 9 : 5;
          const a = 180 - (pct / 100) * 180;
          const tickStart = pt(outerEdge + 2, a);
          const tickEnd   = pt(outerEdge + 2 + len, a);
          const lbl       = pt(outerEdge + 22, a);
          return (
            <g key={pct}>
              <line
                x1={tickStart.x} y1={tickStart.y}
                x2={tickEnd.x}   y2={tickEnd.y}
                stroke={isMajor ? '#374151' : isMedium ? '#6b7280' : '#9ca3af'}
                strokeWidth={isMajor ? 2.5 : isMedium ? 1.5 : 1}
                strokeLinecap="round"
              />
              {isMajor && (
                <text x={lbl.x} y={lbl.y + 3.5} textAnchor="middle"
                  fontSize="8.5" fontWeight="700" fill="#4b5563">
                  {pct}
                </text>
              )}
            </g>
          );
        })}

        {/* Meter hand */}
        <g style={{ transformOrigin: `${CX}px ${CY}px`, transform: `rotate(${needleAngle}deg)` }}>
          <polygon
            points={`${CX - tailLen},${CY - 4} ${CX},${CY - 2.5} ${CX},${CY + 2.5} ${CX - tailLen},${CY + 4}`}
            fill="#4b5563"
          />
          <polygon
            points={`${CX - 3},${CY - 2.5} ${CX + needleLen},${CY} ${CX - 3},${CY + 2.5}`}
            fill="url(#needleGrad)"
          />
          <line
            x1={CX + 8} y1={CY - 0.8}
            x2={CX + needleLen - 12} y2={CY - 0.4}
            stroke="rgba(255,255,255,0.3)" strokeWidth={0.8}
          />
        </g>

        {/* Hub */}
        <circle cx={CX} cy={CY} r={16} fill="url(#hubGrad)" />
        <circle cx={CX} cy={CY} r={10} fill="#1f2937" />
        <circle cx={CX} cy={CY} r={5}  fill="#374151" />
        <circle cx={CX - 3} cy={CY - 3} r={2} fill="rgba(255,255,255,0.22)" />

        {/* LOW / HIGH corner labels */}
        <text x={pt(outerEdge + 5, 170).x} y={pt(outerEdge + 5, 170).y + 3}
          textAnchor="middle" fontSize="7" fill="#ef4444" fontWeight="700">LOW</text>
        <text x={pt(outerEdge + 5, 10).x} y={pt(outerEdge + 5, 10).y + 3}
          textAnchor="middle" fontSize="7" fill="#22c55e" fontWeight="700">HIGH</text>
      </svg>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────

type NavSection = 'qbanks' | 'videos' | 'live' | 'cheatsheets' | 'calendar' | 'testimonial' | 'subscription';

const planIncluded = (f: string | PlanFeature): { name: string; included: boolean } =>
  typeof f === 'string' ? { name: f, included: true } : f;

const NAV_ITEMS: Array<{ id: NavSection; label: string; icon: React.ElementType; requiresPremium?: boolean; requiresSpecial?: string }> = [
  { id: 'qbanks', label: 'Q-Banks', icon: BookOpen },
  { id: 'videos', label: 'Videos', icon: Video, requiresPremium: true },
  { id: 'live', label: 'Live Lectures', icon: Mic, requiresSpecial: 'live_lectures' },
  { id: 'cheatsheets', label: 'Cheat Sheets', icon: FileText, requiresSpecial: 'cheat_sheets' },
  { id: 'calendar', label: 'Study Calendar', icon: Calendar, requiresPremium: true },
];

const BOTTOM_NAV_ITEMS: Array<{ id: NavSection; label: string; icon: React.ElementType; requiresPremium?: boolean; requiresSpecial?: string }> = [
  { id: 'testimonial', label: 'Testimonial', icon: Star },
  { id: 'subscription', label: 'Subscription', icon: CreditCard },
];

export const NclexHome = () => {
  const navigate = useNavigate();
  const { section: sectionParam, qbanksTab: qbanksTabParam } = useParams<{ section?: string; qbanksTab?: string }>();
  const { user } = useAuth();
  const [data, setData] = useState<HomeData | null>(null);
  const [loading, setLoading] = useState(true);
  const VALID_SECTIONS: NavSection[] = ['qbanks', 'videos', 'live', 'cheatsheets', 'calendar', 'testimonial', 'subscription'];
  // When on /nclex/qbanks/:qbanksTab route, sectionParam is undefined → section is 'qbanks'
  const activeSection: NavSection = sectionParam
    ? (VALID_SECTIONS.includes(sectionParam as NavSection) ? (sectionParam as NavSection) : 'qbanks')
    : 'qbanks';
  const activeQbanksTab: QbanksTab = VALID_QBANKS_TABS.includes(qbanksTabParam as QbanksTab)
    ? (qbanksTabParam as QbanksTab)
    : 'statistics';
  const setActiveSection = (s: NavSection) => {
    if (s === 'qbanks') navigate('/nclex/qbanks/statistics');
    else navigate(`/nclex/${s}`);
  };
  const setQbanksTab = (tab: QbanksTab) => navigate(`/nclex/qbanks/${tab}`);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [bankPick, setBankPick] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState<string>('');

  // Exam date
  const [examDate, setExamDate] = useState('');
  const [savingDate, setSavingDate] = useState(false);

  // Calendar
  const [calWeeks, setCalWeeks] = useState<string>('6');
  const [showWeekOfExam, setShowWeekOfExam] = useState(false);

  // Testimonial form
  const [testForm, setTestForm] = useState({ content: '', rating: 5, designation: '', location: '' });
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);

  // Upgrade modal
  const [upgradeModal, setUpgradeModal] = useState(false);
  const [upgradeRef, setUpgradeRef] = useState('');
  const [upgradeMethod, setUpgradeMethod] = useState<PaymentMethod>('stripe');
  const [upgradeReceipt, setUpgradeReceipt] = useState<File | null>(null);
  const [upgradeSending, setUpgradeSending] = useState(false);

  // Stripe payment state — only populated when upgradeMethod === 'stripe' and a
  // PaymentIntent has been created via /api/nclex/create-upgrade-intent.
  const [stripeClientSecret, setStripeClientSecret] = useState<string | null>(null);
  const [stripePaymentIntentId, setStripePaymentIntentId] = useState<string | null>(null);
  const [stripeError, setStripeError] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const stripePromiseRef = useRef<Promise<Stripe | null> | null>(null);

  // Live sessions, site settings, and order history — all admin-managed via
  // /admin/nclex. Cached once on mount.
  interface LiveSessionRow {
    id: string; title: string; description?: string | null;
    scheduledAt: string; durationMin: number;
    zoomJoinUrl?: string | null; zoomMeetingId?: string | null;
    zoomPasscode?: string | null; recordingUrl?: string | null;
    instructor?: string | null; topic?: string | null; status: string;
  }
  const [liveSessions, setLiveSessions] = useState<LiveSessionRow[]>([]);
  // Group support URL is read from /api/nclex/site-settings (admin-managed),
  // with a sane FB-group default if the request fails. Still consumed by the
  // Live Lectures footer CTA below.
  const [groupSupportUrl, setGroupSupportUrl] = useState<string>('https://www.facebook.com/share/g/1EfkpWjCvf/?mibextid=wwXIfr');

  // Plan config
  const [planConfig, setPlanConfig] = useState<PlanConfig | null>(null);

  // Video config
  const [videoConfig, setVideoConfig] = useState<VideoConfig | null>(null);
  const [playingVideoId, setPlayingVideoId] = useState<string | null>(null);

  // Cheat sheets
  const [activeSheet, setActiveSheet] = useState<string | null>(null);
  const logoDataUrlRef = useRef<string | null>(null);

  // Approved testimonials
  const [approvedTestimonials, setApprovedTestimonials] = useState<ApprovedTestimonial[]>([]);

  // Calendar: selected plan (persisted in localStorage)
  const [selectedCalPlan, setSelectedCalPlan] = useState<string | null>(() => localStorage.getItem('nclex_cal_plan'));

  // Exam date edit mode
  const [examDateEditMode, setExamDateEditMode] = useState(false);

  // Downgrade modal
  const [downgradeModal, setDowngradeModal] = useState(false);

  // Upgrade target plan
  const [upgradeTargetPlan, setUpgradeTargetPlan] = useState<string>('premium');

  // When user picks Stripe + a plan in the open upgrade modal, create a Stripe
  // PaymentIntent and stash the client secret so <Elements> can mount.
  useEffect(() => {
    if (!upgradeModal || upgradeMethod !== 'stripe' || !upgradeTargetPlan) {
      setStripeClientSecret(null);
      setStripePaymentIntentId(null);
      setStripeError(null);
      return;
    }
    let cancelled = false;
    setStripeLoading(true);
    setStripeError(null);
    nclexApi.createUpgradeIntent(upgradeTargetPlan)
      .then((res) => {
        if (cancelled) return;
        const { clientSecret, paymentIntentId } = res.data?.data ?? res.data ?? {};
        if (!clientSecret) throw new Error('No client secret returned');
        setStripeClientSecret(clientSecret);
        setStripePaymentIntentId(paymentIntentId);
      })
      .catch((err) => {
        if (cancelled) return;
        setStripeError(err?.response?.data?.error || err?.message || 'Failed to start payment');
      })
      .finally(() => { if (!cancelled) setStripeLoading(false); });
    return () => { cancelled = true; };
  }, [upgradeModal, upgradeMethod, upgradeTargetPlan]);

  // Create Test modal
  const [createTestModal, setCreateTestModal] = useState(false);
  const [ctExamType, setCtExamType] = useState<string>('TUTORIAL');
  const [ctBank, setCtBank] = useState<string>('');
  const [ctQuestionCount, setCtQuestionCount] = useState<number>(85);
  const [ctTopics, setCtTopics] = useState<string[]>([]);
  const [ctFormats, setCtFormats] = useState<string[]>([]);
  const [ctShowTopics, setCtShowTopics] = useState(false);
  const [ctMode, setCtMode] = useState<'manual' | 'blueprint' | 'ai'>('manual');
  const [aiSuggesting, setAiSuggesting] = useState(false);
  const [aiResult, setAiResult] = useState<{ topics: string[]; questionCount: number; formats: string[]; focus: string; reasoning: string } | null>(null);
  const [aiGoal, setAiGoal] = useState('');
  const [ctStep, setCtStep] = useState<1|2>(1);
  const [ctQuestionFilter, setCtQuestionFilter] = useState<string>('unused');
  const [ctFormatFilter, setCtFormatFilter] = useState<string>('all');
  const [ctOrganization, setCtOrganization] = useState<string>('subject');

  // Previous Tests sub-tab (RA / CAT / TUTORIAL)
  const [prevTestType, setPrevTestType] = useState<'READINESS_ASSESSMENT' | 'CAT' | 'TUTORIAL'>('READINESS_ASSESSMENT');
  // Previous Tests detail sub-tab (completed / pending)
  const [prevDetailTab, setPrevDetailTab] = useState<'completed' | 'pending'>('completed');

  // Remediation daily input
  const [dailyNote, setDailyNote] = useState('');
  const [dailyGoal, setDailyGoal] = useState('20');
  const [dailySaved, setDailySaved] = useState(false);

  // Animated counter tick for days
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    nclexApi.getHome()
      .then(r => {
        const d = r.data.data as HomeData;
        setData(d);
        if (d.profile?.examDate) setExamDate(d.profile.examDate.split('T')[0]);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    nclexApi.getPublicPlans()
      .then(r => setPlanConfig(r.data.data))
      .catch(() => {});
    nclexApi.getVideoConfig()
      .then(r => setVideoConfig(r.data.data))
      .catch(() => {});
    nclexApi.getApprovedTestimonials()
      .then(r => setApprovedTestimonials(r.data.data ?? []))
      .catch(() => {});
    nclexApi.getLiveSessions()
      .then(r => setLiveSessions(r.data.data ?? []))
      .catch(() => {});
    nclexApi.getSiteSettings()
      .then(r => {
        const url = r.data?.data?.group_support_url;
        if (url) setGroupSupportUrl(url);
      })
      .catch(() => {});
  }, []);

  const profile = data?.profile;
  const tier = profile?.tier ?? 'FREE';
  const specialAccess = (profile?.specialAccess ?? []) as string[];
  const classic = data?.stats.questionBanks.find(b => b.bank === 'CLASSIC')?._count ?? 0;
  const ngn = data?.stats.questionBanks.find(b => b.bank === 'NGN')?._count ?? 0;
  const usedClassic = data?.stats.usedByBank?.['CLASSIC'] ?? 0;
  const usedNgn = data?.stats.usedByBank?.['NGN'] ?? 0;
  const unusedClassic = Math.max(0, classic - usedClassic);
  const unusedNgn = Math.max(0, ngn - usedNgn);
  const isPremium = tier === 'PREMIUM' && (!profile?.tierExpiresAt || new Date(profile.tierExpiresAt) > new Date());
  const isVip = isPremium && specialAccess.includes('live_lectures') && specialAccess.includes('cheat_sheets') && specialAccess.includes('week_of_exam');
  const questionsToday = data?.questionsToday ?? 0;

  // Days remaining until exam (live)
  const examMs = examDate ? new Date(examDate).getTime() + 86400000 - Date.now() : null;
  const daysUntilExam = examMs !== null ? Math.max(0, Math.floor(examMs / 86400000)) : null;
  const hoursUntilExam = examMs !== null && daysUntilExam !== null ? Math.floor((examMs % 86400000) / 3600000) : null;
  const minsUntilExam = examMs !== null ? Math.floor((examMs % 3600000) / 60000) : null;
  const examPassed = examDate ? new Date(examDate).getTime() + 86400000 < Date.now() : false;

  // Urgency level for countdown styling
  const urgency = daysUntilExam === null ? 'none'
    : daysUntilExam <= 3 ? 'critical'
    : daysUntilExam <= 7 ? 'high'
    : daysUntilExam <= 30 ? 'medium'
    : 'low';

  void tick; // ensure re-render on tick for live countdown

  const saveExamDate = async () => {
    setSavingDate(true);
    try { await nclexApi.updateExamDate(examDate || null); } catch {}
    finally { setSavingDate(false); }
  };

  const handleStart = async (examType: string, bank?: string, opts?: { questionCount?: number; topics?: string[]; formats?: string[] }) => {
    setStarting(examType);
    try {
      const res = await nclexApi.startSession({
        examType,
        bank: bank || undefined,
        questionCount: opts?.questionCount,
        topics: opts?.topics?.length ? opts.topics : undefined,
        formats: opts?.formats?.length ? opts.formats : undefined,
      });
      const sessionId = res.data.data.session.id;
      // Every test — Tutorial, CAT, Readiness Assessment, Exit Exam — runs
      // on the pearsonvue.gritsync.com surface so learners always practice
      // in the Pearson VUE-styled environment they'll see on test day.
      // Access to that subdomain is gated by the session id: the
      // PearsonVueExam component revalidates ownership + IN_PROGRESS status
      // and bounces anyone who didn't come through here. On the landing /
      // marketing subdomain the helper falls back to a relative path so
      // dev still works (path-prefix routing).
      const ctx = getSubdomainContext();
      if (ctx === 'review' || ctx === 'app') {
        window.location.href = pearsonVueUrl(`/exam/${sessionId}`);
        return;
      }
      navigate(`/nclex/exam/${sessionId}`);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to start exam.');
    } finally { setStarting(null); setBankPick(null); }
  };

  const sendTestimonial = async () => {
    if (!testForm.content.trim()) return;
    setTestSending(true);
    try {
      await nclexApi.submitTestimonial(testForm);
      setTestSent(true);
      setTestForm({ content: '', rating: 5, designation: '', location: '' });
    } catch { toast.error('Failed to submit. Please try again.'); }
    finally { setTestSending(false); }
  };

  const submitUpgrade = async () => {
    if (!upgradeRef.trim()) { toast.error('Please enter your payment reference number.'); return; }
    if ((upgradeMethod === 'gcash' || upgradeMethod === 'bdo') && !upgradeReceipt) {
      toast.error('Please upload your payment receipt.'); return;
    }
    setUpgradeSending(true);
    try {
      const fd = new FormData();
      fd.append('paymentRef', upgradeRef);
      fd.append('paymentMethod', upgradeMethod);
      fd.append('targetPlanId', upgradeTargetPlan);
      if (upgradeReceipt) fd.append('receipt', upgradeReceipt);
      await nclexApi.requestUpgrade(fd);
      setUpgradeModal(false);
      setUpgradeRef('');
      setUpgradeReceipt(null);
      toast.success('Upgrade request submitted! Admin will verify your payment within 24 hours.');
    } catch { toast.error('Failed to submit request.'); }
    finally { setUpgradeSending(false); }
  };

  const openUpgradeModal = (planId: string) => {
    setUpgradeTargetPlan(planId);
    setUpgradeModal(true);
  };

  const canAccess = (item: typeof NAV_ITEMS[0]): boolean => {
    if (item.requiresSpecial) return isVip || specialAccess.includes(item.requiresSpecial);
    if (item.requiresPremium) return isPremium;
    return true;
  };

  const completedSessions = data?.sessions.filter(s => s.status === 'COMPLETED') ?? [];

  // ── Render sections ──────────────────────────────────────────────────────────

  const renderOverview = () => {
    const totalCompleted = completedSessions.length;
    const passedCount = completedSessions.filter(s => (s.result as Record<string, unknown>)?.passed).length;
    const passRate = totalCompleted > 0 ? Math.round((passedCount / totalCompleted) * 100) : 0;

    return (
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Welcome banner - full width */}
        <div className="bg-gradient-to-br from-[#0c1e3c] to-[#1a4080] rounded-2xl p-5 mb-6 text-white flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-blue-200 text-sm mb-0.5">Welcome back,</p>
            <h1 className="text-2xl font-black truncate">{user?.firstName} {user?.lastName}</h1>
            <div className="flex items-center flex-wrap gap-2 mt-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${isPremium ? 'bg-amber-500/30 text-amber-300' : 'bg-white/15 text-blue-200'}`}>
                {isPremium ? '⚡ Premium' : 'Free Plan'}
              </span>
              {daysUntilExam !== null && !examPassed && (
                <span className="text-xs text-blue-200">
                  <strong className="text-white">{daysUntilExam}</strong> days to exam
                </span>
              )}
              {examPassed && <span className="text-xs text-emerald-300 font-bold">🎉 Exam day passed — great work!</span>}
            </div>
          </div>
          <div className="h-14 w-14 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-xl font-black text-white flex-shrink-0">
            {user?.firstName?.[0]}{user?.lastName?.[0]}
          </div>
        </div>

        {/* Stats row - 4 columns */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-3xl font-black text-gray-900">{totalCompleted}</p>
            <p className="text-xs text-gray-500 mt-0.5">Sessions Done</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-3xl font-black text-gray-900">{totalCompleted > 0 ? `${passRate}%` : '—'}</p>
            <p className="text-xs text-gray-500 mt-0.5">Pass Rate</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <div className="flex items-center justify-center gap-1 mb-0.5">
              <p className="text-3xl font-black text-gray-900">{questionsToday}</p>
              {questionsToday > 0 && <Flame className="h-5 w-5 text-orange-400 flex-shrink-0" />}
            </div>
            <p className="text-xs text-gray-500">Qs Today</p>
            {!isPremium && (
              <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${Math.min(100, (questionsToday / 10) * 100)}%` }} />
              </div>
            )}
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-3xl font-black text-gray-900">{classic + ngn}</p>
            <p className="text-xs text-gray-500 mt-0.5">Questions in Bank</p>
          </div>
        </div>

        {/* Two-column layout for main content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Quick start (2/3 width) */}
          <div className="lg:col-span-2 space-y-5">
            {/* Free tier nudge */}
            {!isPremium && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-800">{questionsToday}/25 free questions used today</p>
                  <p className="text-xs text-amber-700">Upgrade to Premium for unlimited access to all exam types.</p>
                </div>
                <button onClick={() => { setActiveSection('subscription'); setUpgradeModal(true); }}
                  className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 flex-shrink-0">
                  Upgrade
                </button>
              </div>
            )}

            {/* Quick start */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Quick Start</h3>
                <button onClick={() => setActiveSection('qbanks')} className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  All exams <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { type: 'CAT', label: 'CAT Adaptive Test', icon: Brain, color: 'from-purple-500 to-fuchsia-600', meta: '85–150 Qs · Adaptive', locked: !isPremium },
                  { type: 'READINESS_ASSESSMENT', label: 'Readiness Assessment', icon: Target, color: 'from-blue-500 to-indigo-600', meta: '85 Qs · ~2 hrs', locked: !isPremium },
                  { type: 'TUTORIAL', label: 'Tutorial', icon: Play, color: 'from-emerald-500 to-teal-600', meta: '~15 min · Free', locked: false },
                  { type: 'EXIT_EXAM', label: 'Exit Exam', icon: Trophy, color: 'from-amber-500 to-orange-600', meta: '150 Qs · Timed', locked: !data?.exitAccess },
                ].map(item => (
                  <button
                    key={item.type}
                    onClick={() => { if (!item.locked) { setSelectedBank(''); setBankPick(item.type); } }}
                    disabled={item.locked}
                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                      item.locked ? 'border-gray-200 bg-white opacity-60 cursor-not-allowed' : 'border-transparent bg-white hover:shadow-md hover:border-blue-100 cursor-pointer'
                    }`}
                  >
                    <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0`}>
                      {item.locked ? <Lock className="h-5 w-5 text-white/80" /> : <item.icon className="h-5 w-5 text-white" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm text-gray-900 truncate">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.meta}</p>
                    </div>
                    {!item.locked && <ChevronRight className="h-4 w-4 text-gray-400 flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Recent activity (1/3 width) */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-gray-900">Recent Activity</h3>
              </div>
              {completedSessions.length === 0 ? (
                <div className="bg-white rounded-xl border border-dashed border-gray-200 py-10 text-center">
                  <BarChart3 className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm text-gray-500 font-medium">No sessions yet</p>
                  <button onClick={() => setActiveSection('qbanks')} className="mt-2 text-xs text-blue-600 hover:underline">
                    Take your first exam →
                  </button>
                </div>
              ) : (
                <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                  {completedSessions.slice(0, 5).map(s => {
                    const r = s.result as Record<string, unknown> | null;
                    const passed = r?.passed as boolean;
                    const pct = r?.percentCorrect as number | undefined;
                    const readiness = r?.readiness as string | undefined;
                    return (
                      <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-black ${passed ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {passed ? '✓' : '✗'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {s.examType === 'READINESS_ASSESSMENT' ? 'Readiness' : s.examType === 'CAT' ? 'CAT Exam' : s.examType === 'EXIT_EXAM' ? 'Exit Exam' : 'Tutorial'}
                            {readiness && <span className="ml-1 text-xs text-blue-600">{readiness}</span>}
                            {pct !== undefined && <span className="ml-1 text-xs text-gray-400">{pct.toFixed(0)}%</span>}
                          </p>
                          <p className="text-xs text-gray-400">{new Date(s.completedAt ?? s.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</p>
                        </div>
                        <button onClick={() => navigate(`/nclex/results/${s.id}`)} className="text-xs text-blue-600 hover:underline flex-shrink-0">
                          View
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Exam countdown */}
            {daysUntilExam !== null && !examPassed && (
              <div className={`rounded-xl p-4 text-center ${
                urgency === 'critical' ? 'bg-red-50 border-2 border-red-200' :
                urgency === 'high' ? 'bg-orange-50 border-2 border-orange-200' :
                urgency === 'medium' ? 'bg-amber-50 border-2 border-amber-200' :
                'bg-blue-50 border-2 border-blue-100'
              }`}>
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">Time to Exam</p>
                <p className={`text-5xl font-black ${urgency === 'critical' ? 'text-red-600' : urgency === 'high' ? 'text-orange-600' : 'text-blue-700'}`}>{daysUntilExam}</p>
                <p className="text-sm font-semibold text-gray-600">days remaining</p>
                {examDate && <p className="text-xs text-gray-400 mt-1">{new Date(examDate).toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })}</p>}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderLiveLectures = () => {
    const now = new Date();
    const upcoming = liveSessions
      .filter(s => new Date(s.scheduledAt) >= now && s.status !== 'past' && s.status !== 'cancelled')
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    const past = liveSessions
      .filter(s => new Date(s.scheduledAt) < now || s.status === 'past')
      .sort((a, b) => new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime());

    const fmtWhen = (iso: string) => {
      const d = new Date(iso);
      return d.toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    };

    const Row = ({ s, isPast }: { s: LiveSessionRow; isPast: boolean }) => (
      <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-xl flex-shrink-0">
          {isPast ? <PlayCircle className="h-5 w-5 text-blue-600" /> : <Mic className="h-5 w-5 text-blue-600" />}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-sm text-gray-900">{s.title}</p>
            {s.status === 'live' && <span className="text-[10px] uppercase font-bold tracking-wider bg-red-100 text-red-700 px-2 py-0.5 rounded-full animate-pulse">Live now</span>}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {fmtWhen(s.scheduledAt)} · {s.durationMin}min
            {s.instructor && <> · {s.instructor}</>}
            {s.topic && <> · {s.topic}</>}
          </p>
          {s.description && <p className="text-xs text-gray-600 mt-1 line-clamp-2">{s.description}</p>}
        </div>
        <div className="flex-shrink-0">
          {isPast && s.recordingUrl ? (
            <a href={s.recordingUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-lg">
              <PlayCircle className="h-3.5 w-3.5" /> Watch recording
            </a>
          ) : isPast ? (
            <span className="text-xs text-gray-400">Recording not posted</span>
          ) : s.zoomJoinUrl ? (
            <a href={s.zoomJoinUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0c1e3c] hover:bg-[#1a3058] text-white text-xs font-semibold rounded-lg">
              <ExternalLink className="h-3.5 w-3.5" /> Join Zoom
            </a>
          ) : (
            <span className="text-xs text-gray-400 bg-gray-100 px-2.5 py-1 rounded-full">Link soon</span>
          )}
        </div>
      </div>
    );

    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <h2 className="text-xl font-black text-gray-900 mb-1">Live Lectures</h2>
        <p className="text-gray-500 text-sm mb-6">Instructor-led Zoom review sessions</p>

        <div className="bg-gradient-to-r from-[#0c1e3c] to-[#1a4080] rounded-2xl p-5 mb-6 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Mic className="h-6 w-6 text-white" />
          </div>
          <div>
            <p className="text-white font-bold">Live NCLEX Review (Zoom)</p>
            <p className="text-blue-200 text-sm">{upcoming.length} upcoming · {past.length} past</p>
          </div>
        </div>

        <div className="mb-6">
          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Calendar className="h-4 w-4 text-primary-600" /> Upcoming</h3>
          {upcoming.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center text-sm text-gray-500">
              No upcoming sessions scheduled. Check back soon.
            </div>
          ) : (
            <div className="space-y-3">{upcoming.map(s => <Row key={s.id} s={s} isPast={false} />)}</div>
          )}
        </div>

        <div>
          <h3 className="text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><PlayCircle className="h-4 w-4 text-purple-600" /> Past sessions</h3>
          {past.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-center text-sm text-gray-500">
              No past sessions yet.
            </div>
          ) : (
            <div className="space-y-3">{past.map(s => <Row key={s.id} s={s} isPast={true} />)}</div>
          )}
        </div>

        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
          <p className="text-sm text-blue-700 font-medium">New live sessions are announced in the Study Group.</p>
          <a href={groupSupportUrl} target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 mt-2 text-sm text-blue-600 hover:text-blue-800 font-semibold">
            Join the Group <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>
    );
  };

  const getLogoDataUrl = async (): Promise<string> => {
    if (logoDataUrlRef.current) return logoDataUrlRef.current;
    const res = await fetch('/logo.png');
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        logoDataUrlRef.current = reader.result as string;
        resolve(reader.result as string);
      };
      reader.readAsDataURL(blob);
    });
  };

  const downloadCardAsJpg = async (file: string, title: string) => {
    const [svgText, logoUrl] = await Promise.all([
      fetch(`/cheatsheets/${file}`).then(r => r.text()),
      getLogoDataUrl(),
    ]);
    const modified = svgText.replace(/href="\/logo\.png"/g, `href="${logoUrl}"`);
    const blob = new Blob([modified], { type: 'image/svg+xml;charset=utf-8' });
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const m = modified.match(/viewBox="0 0 (\d+) (\d+)"/);
      const w = m ? parseInt(m[1]) : 800;
      const h = m ? parseInt(m[2]) : 600;
      const scale = 2;
      const canvas = document.createElement('canvas');
      canvas.width = w * scale;
      canvas.height = h * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(blobUrl);
      canvas.toBlob((jpegBlob) => {
        if (!jpegBlob) return;
        const url = URL.createObjectURL(jpegBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.toLowerCase().replace(/[\s/&]+/g, '-')}.jpg`;
        a.click();
        URL.revokeObjectURL(url);
      }, 'image/jpeg', 0.92);
    };
    img.src = blobUrl;
  };

  const renderCheatSheets = () => {
    type SheetItem = { label: string; value: string };
    type Sheet = {
      id: string;
      category: string;
      title: string;
      subtitle: string;
      accentColor: string;
      headerBg: string;
      tagBg: string;
      tagText: string;
      items: SheetItem[];
      badge?: string;
    };

    const sheets: Sheet[] = [
      {
        id: 'test-blueprint',
        category: '2026 TEST PLAN',
        title: 'NCLEX-RN Blueprint',
        subtitle: 'Client Needs Categories & % Distribution',
        accentColor: '#0070C0',
        headerBg: 'bg-[#0c1e3c]',
        tagBg: 'bg-blue-100',
        tagText: 'text-blue-800',
        badge: 'UPDATED 2026',
        items: [
          { label: 'Safe & Effective Care — Mgmt of Care', value: '15–21%' },
          { label: 'Safe & Effective Care — Safety & Infection', value: '9–15%' },
          { label: 'Health Promotion & Maintenance', value: '6–12%' },
          { label: 'Psychosocial Integrity', value: '6–12%' },
          { label: 'Physiological — Basic Care & Comfort', value: '6–12%' },
          { label: 'Physiological — Pharmacological Therapies', value: '12–18%' },
          { label: 'Physiological — Reduction of Risk Potential', value: '9–15%' },
          { label: 'Physiological — Physiological Adaptation', value: '11–17%' },
        ],
      },
      {
        id: 'cjmm',
        category: 'NGN CLINICAL JUDGMENT',
        title: '6-Step Clinical Judgment',
        subtitle: 'NCSBN Clinical Judgment Measurement Model (NCJMM)',
        accentColor: '#0070C0',
        headerBg: 'bg-[#0070C0]',
        tagBg: 'bg-blue-50',
        tagText: 'text-blue-700',
        badge: 'NGN CORE',
        items: [
          { label: '1. Recognize Cues', value: 'What matters most? Identify relevant data from EHR, vitals, labs' },
          { label: '2. Analyze Cues', value: 'What could it mean? Connect cues to pathophysiology & expected findings' },
          { label: '3. Prioritize Hypotheses', value: 'Most urgent? Rank by acuity, risk, probability of condition' },
          { label: '4. Generate Solutions', value: 'What can I do? Identify evidence-based interventions per hypothesis' },
          { label: '5. Take Actions', value: 'Implement highest-priority nursing interventions within scope of practice' },
          { label: '6. Evaluate Outcomes', value: 'Did it work? Compare actual vs. expected outcomes; adjust plan' },
        ],
      },
      {
        id: 'management-of-care',
        category: 'SAFE CARE — MGT OF CARE · 15–21%',
        title: 'Management of Care',
        subtitle: 'Delegation · Ethics · Advocacy · Legal · Continuity',
        accentColor: '#1d4ed8',
        headerBg: 'bg-blue-800',
        tagBg: 'bg-blue-50',
        tagText: 'text-blue-700',
        items: [
          { label: 'Delegation Rule', value: 'RN retains accountability. UAP: ADLs, stable VS, I&O, ambulation, wound care (not assessment)' },
          { label: 'Cannot Delegate', value: 'Assessment, Nursing Dx, Planning, Teaching/Evaluation, IV push, unstable clients' },
          { label: 'Priority Framework', value: 'ABC → Maslow → Acute/unstable before chronic/stable → Safety before comfort' },
          { label: 'Client Rights', value: 'Right to refuse treatment, informed consent, confidentiality, access to records, non-discrimination' },
          { label: 'Ethical Principles', value: 'Autonomy · Beneficence · Non-maleficence · Justice · Fidelity · Veracity' },
          { label: '2026 New Statement', value: 'Perform care supporting unbiased treatment regardless of culture, ethnicity, sexual orientation, gender identity/expression' },
          { label: 'Informed Consent', value: 'Nurse witnesses only; MD explains risks/benefits; must be voluntary, competent, informed' },
          { label: 'SBAR Handoff', value: 'Situation → Background → Assessment → Recommendation; verify back if verbal order' },
        ],
      },
      {
        id: 'safety-infection',
        category: 'SAFE CARE — SAFETY & INFECTION · 9–15%',
        title: 'Safety & Infection Control',
        subtitle: 'Precautions · Asepsis · Error Prevention · Equipment Safety',
        accentColor: '#dc2626',
        headerBg: 'bg-red-700',
        tagBg: 'bg-red-50',
        tagText: 'text-red-700',
        items: [
          { label: 'Airborne Precautions', value: 'TB, Measles, Varicella, COVID-19 → N95 mask, negative-pressure room, HEPA filtration' },
          { label: 'Droplet Precautions', value: 'Influenza, Meningitis, Pertussis, Mumps → Surgical mask, private room' },
          { label: 'Contact Precautions', value: 'MRSA, C. diff, RSV, scabies, VRE → Gloves + gown, dedicated equipment, EPA-approved disinfectant for C. diff' },
          { label: 'Protective/Reverse Isolation', value: 'Neutropenic clients (ANC <500): N95, positive pressure, no live plants/flowers, cooked foods only' },
          { label: 'Hand Hygiene Priority', value: 'Wash with soap & water for C. diff & norovirus (alcohol gel ineffective); all other situations: alcohol gel acceptable' },
          { label: 'Surgical Asepsis Principles', value: 'Only sterile touches sterile. Sterile field = 1-inch border. Eyes-above-waist rule. Open toward yourself.' },
          { label: 'Medication Safety', value: '9 Rights: Patient · Drug · Dose · Route · Time · Documentation · Reason · Response · Right to Refuse' },
          { label: 'Fall Prevention', value: 'High-risk: elderly, confusion, post-op, narcotics, history of falls → bed lowest, call light within reach, non-slip socks' },
        ],
      },
      {
        id: 'pharmacology',
        category: 'PHYSIOLOGICAL INTEGRITY — PHARM · 12–18%',
        title: 'Pharmacological Therapies',
        subtitle: 'High-Alert Drugs · Dosage Calculation · IV Therapy · Antidotes',
        accentColor: '#7c3aed',
        headerBg: 'bg-purple-800',
        tagBg: 'bg-purple-50',
        tagText: 'text-purple-700',
        items: [
          { label: 'High-Alert Medications', value: 'Insulin · Heparin · Opioids · Concentrated electrolytes · Anticoagulants · Chemotherapy (requires 2-nurse check)' },
          { label: 'Narrow Therapeutic Index', value: 'Digoxin 0.5–2.0 ng/mL · Lithium 0.6–1.2 mEq/L · Phenytoin 10–20 mcg/mL · Theophylline 10–20 mcg/mL' },
          { label: 'Dosage Formula', value: 'Dose ordered ÷ Dose available × Volume on hand = Amount to give' },
          { label: 'IV Rate Formula', value: 'Volume (mL) ÷ Time (hr) = mL/hr; (Volume × Drop factor) ÷ Time (min) = gtt/min' },
          { label: 'Key Antidotes', value: 'Heparin → Protamine sulfate · Warfarin → Vitamin K (phytonadione) · Opioids → Naloxone · Benzodiazepines → Flumazenil' },
          { label: 'Digoxin Toxicity', value: 'Hold if HR <60 bpm. S/sx: N/V, yellow-green halos, bradycardia. Antidote: Digibind (digoxin immune Fab)' },
          { label: 'ACE Inhibitors (-pril)', value: 'Monitor: dry cough, angioedema, hyperkalemia, renal function. Contraindicated in pregnancy.' },
          { label: 'Corticosteroids', value: 'Give with food. Never stop abruptly (adrenal crisis). Monitor glucose, BP, infection signs, osteoporosis risk.' },
        ],
      },
      {
        id: 'reduction-of-risk',
        category: 'PHYSIOLOGICAL INTEGRITY — REDUCTION OF RISK · 9–15%',
        title: 'Lab Values & Risk Reduction',
        subtitle: 'Critical Labs · Diagnostics · System Assessments · Pre/Post-Op',
        accentColor: '#0f766e',
        headerBg: 'bg-teal-800',
        tagBg: 'bg-teal-50',
        tagText: 'text-teal-700',
        items: [
          { label: 'Critical Lab Values', value: 'Na⁺ 136–145 · K⁺ 3.5–5.0 · Glucose 70–99 (fasting) · HbA1c <5.7% · Creatinine 0.6–1.2 · BUN 10–20' },
          { label: 'CBC Reference', value: 'Hgb: M 14–18, F 12–16 g/dL · Hct: M 42–52%, F 37–47% · WBC 4,500–11,000 · Platelets 150,000–400,000' },
          { label: 'ABG Normal Values', value: 'pH 7.35–7.45 · PaCO₂ 35–45 mmHg · HCO₃ 22–26 mEq/L · PaO₂ 80–100 mmHg · SpO₂ ≥95%' },
          { label: 'ABG Interpretation', value: 'pH↓+CO₂↑ = Resp. Acidosis · pH↑+CO₂↓ = Resp. Alkalosis · pH↓+HCO₃↓ = Met. Acidosis · pH↑+HCO₃↑ = Met. Alkalosis' },
          { label: 'Pre-Op Priority', value: 'Verify consent · NPO status · Allergies · Baseline VS · Lab results (INR, CBC) · Remove prosthetics/jewelry' },
          { label: 'Post-Op Assessment', value: 'Airway first → VS q15min ×4, then q30min → Pain → I&O → Wound site → Level of consciousness' },
          { label: 'INR / Coagulation', value: 'PT 11–12.5 sec · INR 0.8–1.1 (therapeutic anticoag: 2–3) · aPTT 25–35 sec (heparin 1.5–2.5× normal)' },
          { label: 'Urinalysis Normals', value: 'Color: pale yellow · pH 4.5–8.0 · Specific gravity 1.010–1.025 · Protein: none · Glucose: none' },
        ],
      },
      {
        id: 'physiological-adaptation',
        category: 'PHYSIOLOGICAL INTEGRITY — ADAPTATION · 11–17%',
        title: 'Physiological Adaptation',
        subtitle: 'Fluid/Electrolytes · Cardiac · Respiratory · Medical Emergencies',
        accentColor: '#b45309',
        headerBg: 'bg-amber-800',
        tagBg: 'bg-amber-50',
        tagText: 'text-amber-700',
        items: [
          { label: 'Fluid Tonicity', value: 'Isotonic: 0.9% NS, LR (expands plasma) · Hypotonic: 0.45% NS, D5W (hydrates cells) · Hypertonic: 3% NS, D5NS (pulls fluid into vessels)' },
          { label: 'Hyponatremia <136', value: 'Confusion, seizures, decreased LOC → correct slowly (≤10 mEq/L/day) to prevent central pontine myelinolysis' },
          { label: 'Hyperkalemia >5.0', value: 'Peaked T-waves, wide QRS, bradycardia → Ca gluconate (cardiac protect) → Insulin+D50 → Kayexalate → Dialysis' },
          { label: 'Cardiac Emergencies', value: 'V-Fib/pulseless V-Tach → CPR + Defib · V-Tach with pulse → Synchronized cardioversion · Asystole → CPR + Epinephrine (no defib)' },
          { label: 'Respiratory Emergencies', value: 'Tension pneumo: absent BS + tracheal deviation → needle decompression at 2nd ICS MCL · PE: SOB + chest pain + hemoptysis → O₂ + anticoagulation' },
          { label: 'ARDS Management', value: 'Bilateral infiltrates, PaO₂/FiO₂ <200 → low tidal volume 4–6 mL/kg, prone positioning, PEEP ventilation' },
          { label: 'Shock Recognition', value: 'All shock: ↓BP, ↑HR, cool/clammy (except septic: warm/flushed early). Priority = airway → IV access → fluids → vasopressors' },
          { label: 'Increased ICP', value: 'HOB 30°, neutral neck alignment, avoid Valsalva. Report: Cushing\'s triad (↑BP, ↓HR, irregular respirations)' },
        ],
      },
      {
        id: 'health-promotion',
        category: 'HEALTH PROMOTION & MAINTENANCE · 6–12%',
        title: 'Health Promotion & Development',
        subtitle: 'Screening · Developmental Milestones · Maternal-Newborn · Teaching',
        accentColor: '#15803d',
        headerBg: 'bg-green-800',
        tagBg: 'bg-green-50',
        tagText: 'text-green-700',
        items: [
          { label: 'Immunization Schedule (Key)', value: 'Birth: HepB · 2,4,6 mo: DTaP, IPV, PCV, Hib · 12–15 mo: MMR, Varicella · Annual: Influenza (>6 mo)' },
          { label: 'Cancer Screening (ACS)', value: 'Mammography: ≥40–45 yr annually · Colonoscopy: ≥45 yr every 10 yr · Pap smear: 21–65 yr every 3 yr · PSA: discuss with MD ≥50 yr' },
          { label: 'Developmental Milestones', value: 'Social smile: 2 mo · Sits unsupported: 8 mo · Walks: 12 mo · 2-word phrases: 24 mo · Toilet trained: 2–3 yr' },
          { label: 'Maternal — Prenatal Priority', value: 'Call provider: BP >140/90, protein in urine, severe headache, visual changes, epigastric pain, decreased fetal movement' },
          { label: 'Eclampsia Protocol', value: 'Mag sulfate IV + seizure precautions + dim lighting. Toxicity: RR <12, absent DTRs, UO <30 mL/hr → stop infusion, give calcium gluconate' },
          { label: 'Newborn Assessment', value: 'APGAR at 1 & 5 min (7–10 normal). Normal: HR 120–160, RR 30–60, Temp 36.5–37.5°C, glucose >40 mg/dL' },
          { label: 'Teaching Principles', value: 'Assess readiness first. Use simple language (5th-grade reading level). Return demonstration = best evaluation. Family included.' },
          { label: 'Aging Changes', value: 'Decreased: renal/hepatic clearance, gastric acid, lung elasticity, bone density, immune response · Increased: ADR risk, fall risk' },
        ],
      },
      {
        id: 'psychosocial',
        category: 'PSYCHOSOCIAL INTEGRITY · 6–12%',
        title: 'Psychosocial Integrity',
        subtitle: 'Therapeutic Communication · Mental Health · Substance Misuse · Crisis',
        accentColor: '#7c3aed',
        headerBg: 'bg-violet-800',
        tagBg: 'bg-violet-50',
        tagText: 'text-violet-700',
        items: [
          { label: 'Therapeutic Techniques', value: 'Open-ended questions · Silence · Active listening · Reflecting · Clarifying · Focusing · Summarizing' },
          { label: 'Non-Therapeutic (AVOID)', value: 'False reassurance ("Everything will be fine") · Advice-giving · Changing subject · "Why" questions · Judgmental statements' },
          { label: 'Suicide Risk Assessment', value: 'Ask directly: "Are you thinking about harming yourself?" One-to-one observation for active suicidal ideation. Remove ligature risks.' },
          { label: 'Schizophrenia Priority', value: 'Safety first. Do not argue with delusions. Distract from hallucinations. Antipsychotics: monitor EPS, tardive dyskinesia, metabolic effects.' },
          { label: 'Defense Mechanisms', value: 'Denial, Rationalization, Projection, Displacement, Regression, Sublimation (healthy), Repression, Reaction Formation' },
          { label: 'Substance Misuse (2026)', value: 'Term updated from "substance abuse." Withdrawal: alcohol (DTs 24–72 hr) → benzos. Opioids → clonidine/buprenorphine. CAGE assessment.' },
          { label: 'Crisis Intervention', value: '1) Assess safety 2) Establish rapport 3) Identify problem 4) Active coping strategies 5) Support system 6) Referral/follow-up plan' },
          { label: 'Cultural Competence', value: 'Avoid assumptions. Use professional interpreters (not family). Assess health beliefs, practices. Respect spiritual/religious needs.' },
        ],
      },
      {
        id: 'basic-care',
        category: 'PHYSIOLOGICAL INTEGRITY — BASIC CARE · 6–12%',
        title: 'Basic Care & Comfort',
        subtitle: 'Nutrition · Mobility · Wound Care · Pain · Rest · Elimination',
        accentColor: '#0369a1',
        headerBg: 'bg-sky-800',
        tagBg: 'bg-sky-50',
        tagText: 'text-sky-700',
        items: [
          { label: 'Pressure Injury Staging', value: 'Stage 1: non-blanchable redness · Stage 2: partial-thickness · Stage 3: full-thickness, no bone/tendon · Stage 4: bone/tendon/muscle visible' },
          { label: 'Nutrition Enteral Feeds', value: 'Verify placement: x-ray (gold standard) or pH <4 (aspirate). Elevate HOB 30–45° during and 1 hr after feeds. Check residual q4h.' },
          { label: 'Bowel/Urinary Elimination', value: 'Constipation: activity + fluids + fiber first. Foley: clean with soap-water daily, maintain closed system, bag below bladder.' },
          { label: 'Range of Motion', value: 'Passive ROM for immobile clients q2–4h. Prevent foot drop: foot board/high-top sneakers. Reposition q2h. Early ambulation = #1 prevention of complications.' },
          { label: 'Pain Management (Non-Pharm)', value: 'Distraction, guided imagery, heat/cold, positioning, massage, TENS. Non-pharm preferred in: elderly, renal failure, opioid-tolerant.' },
          { label: 'Rest & Sleep Promotion', value: 'Cluster nursing care. Darken room. Limit caffeine after noon. Sleep hygiene education. Report: sleep apnea signs (snoring, apneic episodes).' },
          { label: '2026 New Statement', value: 'Maintain client dignity and privacy during all aspects of care — knock before entering, drape properly, use preferred pronouns.' },
          { label: 'Swallowing Precautions', value: 'Dysphagia: thickened liquids, chin-tuck position, small bites, avoid straws, semi-Fowler\'s position, suction available.' },
        ],
      },
      {
        id: 'ngn-item-types',
        category: 'NGN ITEM FORMATS',
        title: 'Next Generation NCLEX Item Types',
        subtitle: '2026 Format Guide — 10 Question Types',
        accentColor: '#0070C0',
        headerBg: 'bg-[#0c1e3c]',
        tagBg: 'bg-blue-50',
        tagText: 'text-blue-700',
        badge: 'NGN 2026',
        items: [
          { label: 'MCQ (Classic)', value: 'Single best answer from 4+ options. Eliminate 2 wrong, compare remaining 2. Evidence-based = correct.' },
          { label: 'SATA — Extended Multiple Response', value: 'Treat each option as True/False independently. No pattern reasoning. All correct options must be chosen (partial credit on exam).' },
          { label: 'Bowtie (NGN)', value: 'Left: most likely condition (1 of 4) · Center: nursing actions to take (2 of 5) · Right: parameters to monitor (1 of 4). All 3 must be consistent.' },
          { label: 'Matrix MCQ / SATA (NGN)', value: 'Table with findings (rows) × categories (columns). MCQ = one column per row. SATA = all applicable columns per row.' },
          { label: 'Drop-Down Cloze (NGN)', value: 'Complete clinical sentences, care plans, or EHR notes using embedded dropdowns. Answer must be grammatically and clinically correct.' },
          { label: 'Highlight Text / Hot Spot (NGN)', value: 'Read nurse\'s note or EHR. Highlight ONLY findings that answer the specific clinical question. Do not over-select.' },
          { label: 'Extended Drag & Drop (NGN)', value: 'Drag findings to categories (e.g., assign to body systems, sequence steps, prioritize actions). Linked to NCJMM Take Actions step.' },
          { label: 'Fill-in-the-Blank', value: 'Numeric calculation answer. Show formula: Dose ordered ÷ Dose available × Volume. Round only at the final step.' },
        ],
      },
    ];

    return (
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Cheat Sheets</h2>
              <span className="text-[10px] font-bold bg-[#0070C0] text-white px-2 py-0.5 rounded-full">2026 TEST PLAN</span>
            </div>
            <p className="text-gray-500 dark:text-gray-400 text-sm">High-yield quick references based on the official 2026 NCLEX-RN Test Plan</p>
          </div>
          <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">
            <Printer className="h-3.5 w-3.5" /> Print All
          </button>
        </div>

        {/* Test Plan Quick Reference Banner */}
        <div className="mb-6 bg-[#0c1e3c] rounded-2xl p-4 text-white">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-blue-300 uppercase tracking-wider mb-1">2026 NCLEX-RN Test Plan — Exam Structure</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-2">
                {[
                  { label: 'Min–Max Items', value: '85–150' },
                  { label: 'Time Limit', value: '5 Hours' },
                  { label: 'Case Study Sets', value: '3 × 6 Items' },
                  { label: 'Pretest Items', value: '15 Unscored' },
                ].map(s => (
                  <div key={s.label} className="bg-white/10 rounded-xl px-3 py-2 text-center">
                    <p className="text-lg font-black text-white">{s.value}</p>
                    <p className="text-[10px] text-blue-200 mt-0.5">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Sheet Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sheets.map(sheet => (
            <div key={sheet.id}
              className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              {/* Card Header */}
              <div className={`${sheet.headerBg} px-4 py-3`}>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold text-white/70 uppercase tracking-wider">{sheet.category}</p>
                  {sheet.badge && (
                    <span className="text-[9px] font-black bg-white/20 text-white px-2 py-0.5 rounded-full">{sheet.badge}</span>
                  )}
                </div>
                <h3 className="font-black text-white text-base mt-0.5">{sheet.title}</h3>
                <p className="text-[11px] text-white/60 mt-0.5">{sheet.subtitle}</p>
              </div>

              {/* Card Body */}
              <div className="bg-white dark:bg-gray-800 p-3">
                <div className="space-y-2">
                  {(activeSheet === sheet.id ? sheet.items : sheet.items.slice(0, 5)).map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black text-white"
                        style={{ backgroundColor: sheet.accentColor }}>{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-[11px] font-bold text-gray-800 dark:text-gray-100">{item.label}</span>
                        {item.value && (
                          <span className="text-[11px] text-gray-600 dark:text-gray-300"> — {item.value}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {sheet.items.length > 5 && (
                  <button
                    onClick={() => setActiveSheet(activeSheet === sheet.id ? null : sheet.id)}
                    className="mt-3 w-full text-center text-[11px] font-semibold py-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    style={{ color: sheet.accentColor }}>
                    {activeSheet === sheet.id
                      ? '▲ Show Less'
                      : `▼ Show ${sheet.items.length - 5} More Points`}
                  </button>
                )}
              </div>

              {/* Card Footer */}
              <div className="px-4 py-2 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60">
                <span className={`text-[9px] font-bold ${sheet.tagBg.replace('bg-', 'text-').replace('-50', '-600')} uppercase tracking-wider`}>
                  {sheet.items.length} key points
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Downloadable SVG Image Cards */}
        <div className="mt-8">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-base font-black text-gray-900 dark:text-white">Printable Image Cards</h3>
            <span className="text-[10px] font-bold bg-[#0070C0] text-white px-2 py-0.5 rounded-full">SAVE &amp; PRINT</span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">Click any card to download as JPG · Designed with GritSync 2026 branding</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              { file: '01-test-blueprint.svg', title: 'Test Blueprint', desc: 'Client Needs % Distribution' },
              { file: '02-clinical-judgment.svg', title: 'Clinical Judgment Model', desc: '6-Step NCJMM + NGN Mapping' },
              { file: '03-pharmacology.svg', title: 'Pharmacology', desc: 'High-Alert Drugs · Antidotes · Dosage' },
              { file: '04-safety-infection.svg', title: 'Safety & Infection', desc: 'Precautions · Asepsis · Hand Hygiene' },
              { file: '05-lab-values.svg', title: 'Lab Values & ABGs', desc: 'Critical Labs · ABG Interpretation' },
              { file: '06-psychosocial.svg', title: 'Psychosocial Integrity', desc: 'Therapeutic Comm · Mental Health' },
              { file: '07-management-of-care.svg', title: 'Management of Care', desc: 'Delegation · Ethics · Legal · SBAR' },
              { file: '08-physiological-adaptation.svg', title: 'Physiological Adaptation', desc: 'Fluids · Cardiac · Respiratory · Neuro' },
              { file: '09-health-promotion.svg', title: 'Health Promotion', desc: 'Screening · Milestones · Maternal-Newborn' },
              { file: '10-ngn-items.svg', title: 'NGN Item Types', desc: 'Bowtie · Matrix · Drop-Down · Highlight' },
            ].map(img => (
              <div key={img.file} className="rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden bg-white dark:bg-gray-800 shadow-sm hover:shadow-lg transition-shadow group cursor-pointer"
                onClick={() => downloadCardAsJpg(img.file, img.title)}>
                <img
                  src={`/cheatsheets/${img.file}`}
                  alt={img.title}
                  className="w-full object-contain group-hover:scale-[1.02] transition-transform duration-200"
                  style={{ maxHeight: 180 }}
                />
                <div className="p-3 border-t border-gray-100 dark:border-gray-700 flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-gray-900 dark:text-white">{img.title}</p>
                    <p className="text-[10px] text-gray-500 dark:text-gray-400">{img.desc}</p>
                  </div>
                  <span className="text-[10px] font-bold text-[#0070C0] border border-[#0070C0]/30 px-2 py-0.5 rounded-lg group-hover:bg-[#0070C0] group-hover:text-white transition-colors flex-shrink-0">
                    Download JPG
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Banner */}
        <div className="mt-6 bg-[#0c1e3c] rounded-xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-white font-bold text-sm">GritSync NCLEX 2026 Study System</p>
            <p className="text-blue-200 text-xs mt-0.5">Cheat sheets are updated to reflect the official NCSBN 2026 NCLEX-RN Test Plan. Print · Study · Pass.</p>
          </div>
          <div className="flex-shrink-0 text-right">
            <p className="text-[10px] text-blue-300 font-bold">Effective April 2026</p>
            <p className="text-[9px] text-blue-400">NCSBN Official Framework</p>
          </div>
        </div>
      </div>
    );
  };

  const renderQBanks = () => {
    const totalQ = classic + ngn;
    const usedTotal = usedClassic + usedNgn;
    const unusedTotal = Math.max(0, totalQ - usedTotal);
    const classicPct = classic > 0 ? Math.round((usedClassic / classic) * 100) : 0;
    const ngnPct = ngn > 0 ? Math.round((usedNgn / ngn) * 100) : 0;

    const raSessions       = completedSessions.filter(s => s.examType === 'READINESS_ASSESSMENT');
    const catSessions      = completedSessions.filter(s => s.examType === 'CAT');
    const tutorialSessions = completedSessions.filter(s => s.examType === 'TUTORIAL');

    // Chances of passing — based solely on the latest Readiness Assessment score
    const chancesOfPassing = (() => {
      if (!raSessions.length) return null;
      const pct = (raSessions[0].result as Record<string,unknown>)?.percentCorrect as number | undefined;
      return typeof pct === 'number' ? Math.min(99, Math.max(1, Math.round(pct))) : null;
    })();

    const usedByTopic = data?.stats.usedByTopic ?? {};
    const remediationTopics = (data?.stats.byTopic ?? [])
      .map(({ topic, count }) => {
        const used = usedByTopic[topic] ?? 0;
        const pct = count > 0 ? Math.round((used / count) * 100) : 0;
        return { topic, total: count, used, pct };
      })
      .sort((a, b) => a.pct - b.pct);

    const QBANKS_TABS = [
      { id: 'statistics' as QbanksTab,     label: 'Statistics',     icon: BarChart3 },
      { id: 'previous-tests' as QbanksTab, label: 'Previous Tests', icon: Trophy },
      { id: 'remediation' as QbanksTab,    label: 'Remediation',    icon: Sparkles },
    ];

    return (
      <div>
        {/* Sticky header with tabs */}
        <div className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 px-4 sm:px-6 lg:px-8 pt-5 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-black text-gray-900 dark:text-white">Question Banks</h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-0.5">
                {isPremium ? 'Unlimited access · all exam types.' : `Free tier: ${questionsToday}/25 questions used today.`}
              </p>
            </div>
            <button
              onClick={() => {
                // Default selection depends on tier — FREE users can only run
                // the Tutorial, so we pre-select it. PREMIUM/VIP get RA as the
                // default per product spec.
                setCtExamType(isPremium ? 'READINESS_ASSESSMENT' : 'TUTORIAL')
                setCtBank('')
                setCreateTestModal(true)
              }}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#0c1e3c] text-white rounded-xl text-sm font-bold hover:bg-[#1a3058] transition-all shadow-md flex-shrink-0"
            >
              <Play className="h-4 w-4" /> Create Test
            </button>
          </div>

          {/* Free tier nudge */}
          {!isPremium && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center gap-3 mb-3">
              <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-800">Free Plan: {questionsToday}/25 questions today</p>
                <p className="text-xs text-amber-700">Upgrade to Premium for unlimited access to all exam types.</p>
              </div>
              <button onClick={() => setUpgradeModal(true)} className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 flex-shrink-0">
                Upgrade
              </button>
            </div>
          )}

          {/* Sub-tab bar */}
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-700/60 rounded-xl p-1">
            {QBANKS_TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setQbanksTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold transition-all ${
                  activeQbanksTab === tab.id
                    ? 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                }`}
              >
                <tab.icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">{tab.label.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab pane content */}
        <div className="px-4 sm:px-6 lg:px-8 pt-5 pb-8 space-y-6">

          {/* ── STATISTICS ── */}
          {activeQbanksTab === 'statistics' && (() => {
            const bankData = [
              { name: 'Classic', value: classic, fill: '#3b82f6' },
              { name: 'NGN',     value: ngn,     fill: '#a855f7' },
            ];
            const usageData = [
              { name: 'Used',   value: usedTotal,   fill: '#22c55e' },
              { name: 'Unused', value: unusedTotal, fill: '#e5e7eb' },
            ];
            const topicBarData = (data?.stats.byTopic ?? []).map(({ topic, count }) => ({
              name: topic.length > 24 ? topic.slice(0, 22) + '…' : topic,
              total: count,
              used: usedByTopic[topic] ?? 0,
              remaining: Math.max(0, count - (usedByTopic[topic] ?? 0)),
            }));
            const formatBarData = (data?.stats.byFormat ?? []).map(({ format, count }) => {
              const meta = FORMAT_META[format] ?? { label: format, tag: 'Other', tagColor: '' };
              return { name: meta.label, count, tag: meta.tag };
            });
            return (
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* ── Left column: charts ── */}
                <div className="xl:col-span-2 space-y-6">
                  {/* Summary stat cards */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Questions', value: totalQ.toLocaleString(),     color: 'text-gray-900',   bg: 'bg-white border-gray-200' },
                      { label: 'Classic Bank',     value: classic.toLocaleString(),   color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
                      { label: 'NGN Bank',         value: ngn.toLocaleString(),       color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
                      { label: 'Explored',         value: `${totalQ > 0 ? Math.round(usedTotal/totalQ*100) : 0}%`, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
                    ].map(c => (
                      <div key={c.label} className={`${c.bg} border rounded-2xl p-4 text-center`}>
                        <p className={`text-2xl font-black ${c.color}`}>{c.value}</p>
                        <p className="text-xs text-gray-500 mt-0.5 leading-tight">{c.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Donut charts: bank split + usage */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-blue-500" /> Question Bank Distribution
                    </h4>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Bank split donut */}
                      <div className="flex flex-col items-center">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Bank Split</p>
                        <ResponsiveContainer width="100%" height={150}>
                          <PieChart>
                            <Pie data={bankData} cx="50%" cy="50%" innerRadius={40} outerRadius={62}
                              dataKey="value" startAngle={90} endAngle={-270} paddingAngle={2}>
                              {bankData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                            </Pie>
                            <Tooltip formatter={(v: unknown) => [`${(v as number).toLocaleString()} Qs`]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex gap-3 mt-1 text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block"/>Classic ({classic.toLocaleString()})</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-purple-500 inline-block"/>NGN ({ngn.toLocaleString()})</span>
                        </div>
                      </div>
                      {/* Usage donut */}
                      <div className="flex flex-col items-center">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Usage</p>
                        <ResponsiveContainer width="100%" height={150}>
                          <PieChart>
                            <Pie data={usageData} cx="50%" cy="50%" innerRadius={40} outerRadius={62}
                              dataKey="value" startAngle={90} endAngle={-270} paddingAngle={2}>
                              {usageData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                            </Pie>
                            <Tooltip formatter={(v: unknown) => [`${(v as number).toLocaleString()} Qs`]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="flex gap-3 mt-1 text-xs">
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Used ({usedTotal.toLocaleString()})</span>
                          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-200 inline-block"/>Unused ({unusedTotal.toLocaleString()})</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Question types horizontal bar */}
                  {formatBarData.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-500" /> Question Types
                      </h4>
                      <ResponsiveContainer width="100%" height={Math.max(160, formatBarData.length * 34 + 20)}>
                        <BarChart data={formatBarData} layout="vertical" margin={{ left: 0, right: 24, top: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 11 }} />
                          <YAxis dataKey="name" type="category" width={136} tick={{ fontSize: 11 }} />
                          <Tooltip formatter={(v: unknown) => [`${(v as number).toLocaleString()} questions`]} />
                          <Bar dataKey="count" radius={[0, 5, 5, 0]}>
                            {formatBarData.map((e, i) => (
                              <Cell key={i} fill={e.tag === 'NGN' ? '#a855f7' : e.tag === 'Classic' ? '#3b82f6' : '#94a3b8'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex gap-4 mt-3 text-xs">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"/>Classic</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-purple-500 inline-block"/>NGN</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-slate-400 inline-block"/>Both</span>
                      </div>
                    </div>
                  )}

                  {/* Topics coverage stacked bar */}
                  {topicBarData.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Target className="h-4 w-4 text-blue-500" /> Topics Coverage
                        <span className="text-xs font-normal text-gray-400">({topicBarData.length} topics)</span>
                      </h4>
                      <ResponsiveContainer width="100%" height={Math.max(200, topicBarData.length * 30 + 20)}>
                        <BarChart data={topicBarData} layout="vertical" margin={{ left: 0, right: 36, top: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                          <XAxis type="number" tick={{ fontSize: 10 }} />
                          <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 10 }} />
                          <Tooltip formatter={(v: unknown, name: unknown) => [`${(v as number).toLocaleString()} Qs`, (name as string) === 'used' ? 'Attempted' : 'Remaining']} />
                          <Bar dataKey="used" name="Attempted" fill="#22c55e" stackId="a" />
                          <Bar dataKey="remaining" name="Remaining" fill="#e5e7eb" stackId="a" radius={[0, 4, 4, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                      <div className="flex gap-4 mt-2 text-xs">
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block"/>Attempted</span>
                        <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-gray-200 inline-block"/>Remaining</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Right column: Speedometer ── */}
                <div className="space-y-4">
                  <div className="bg-white rounded-2xl border border-gray-200 p-5 text-center">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Zap className="h-4 w-4 text-amber-500" />
                      <h4 className="font-bold text-gray-900">Passing Probability</h4>
                    </div>
                    <SpeedometerGauge value={chancesOfPassing ?? 0} />
                    <div className="mt-3">
                      {chancesOfPassing === null ? (
                        <p className="text-sm text-gray-400 mt-1">Complete a Readiness Assessment to see your score</p>
                      ) : (
                        <p className={`text-sm font-bold mt-1 ${chancesOfPassing >= 70 ? 'text-green-600' : chancesOfPassing >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {chancesOfPassing >= 80 ? '🎉 Excellent — you\'re on track!'
                            : chancesOfPassing >= 65 ? '👍 Good readiness, keep going'
                            : chancesOfPassing >= 50 ? '📈 Developing — practice more'
                            : '📚 Needs improvement'}
                        </p>
                      )}
                    </div>
                    {(raSessions.length > 0 || catSessions.length > 0) && (
                      <div className="mt-4 space-y-2 border-t border-gray-100 pt-4 text-left">
                        {raSessions.length > 0 && (() => {
                          const pct = (raSessions[0].result as Record<string,unknown>)?.percentCorrect as number|undefined;
                          return typeof pct === 'number' ? (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">Latest RA</span>
                              <span className={`font-bold ${pct >= 60 ? 'text-green-600' : 'text-red-500'}`}>{pct.toFixed(1)}%</span>
                            </div>
                          ) : null;
                        })()}
                        {catSessions.length > 0 && (() => {
                          const theta = (catSessions[0].result as Record<string,unknown>)?.finalTheta as number|undefined;
                          const passed = (catSessions[0].result as Record<string,unknown>)?.passed as boolean|undefined;
                          return typeof theta === 'number' ? (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-gray-500">Latest CAT θ</span>
                              <span className={`font-bold ${passed ? 'text-green-600' : 'text-red-500'}`}>{theta.toFixed(2)}</span>
                            </div>
                          ) : null;
                        })()}
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500">Bank explored</span>
                          <span className="font-bold text-blue-600">{totalQ > 0 ? Math.round(usedTotal/totalQ*100) : 0}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Quick progress bars */}
                  <div className="bg-white rounded-2xl border border-gray-200 p-5">
                    <h4 className="font-bold text-gray-900 mb-4 text-sm">Bank Progress</h4>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-600 font-medium">Classic Bank</span>
                          <span className="font-bold text-blue-600">{classicPct}%</span>
                        </div>
                        <div className="h-3 bg-blue-100 rounded-full overflow-hidden">
                          <div className="h-full bg-blue-500 rounded-full transition-all duration-700" style={{ width: `${classicPct}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>{usedClassic.toLocaleString()} used</span>
                          <span>{unusedClassic.toLocaleString()} left</span>
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-xs mb-1.5">
                          <span className="text-gray-600 font-medium">NGN Bank</span>
                          <span className="font-bold text-purple-600">{ngnPct}%</span>
                        </div>
                        <div className="h-3 bg-purple-100 rounded-full overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full transition-all duration-700" style={{ width: `${ngnPct}%` }} />
                        </div>
                        <div className="flex justify-between text-[10px] text-gray-400 mt-1">
                          <span>{usedNgn.toLocaleString()} used</span>
                          <span>{unusedNgn.toLocaleString()} left</span>
                        </div>
                      </div>
                      <div className="pt-3 border-t border-gray-100 grid grid-cols-2 gap-2 text-center">
                        <div className="bg-green-50 rounded-xl py-2">
                          <p className="text-xl font-black text-green-700">{usedTotal.toLocaleString()}</p>
                          <p className="text-[10px] text-green-600">Attempted</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl py-2">
                          <p className="text-xl font-black text-gray-700">{unusedTotal.toLocaleString()}</p>
                          <p className="text-[10px] text-gray-400">Remaining</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── PREVIOUS TESTS ── */}
          {activeQbanksTab === 'previous-tests' && (() => {
            const activeSessions = prevTestType === 'READINESS_ASSESSMENT' ? raSessions
              : prevTestType === 'CAT' ? catSessions : tutorialSessions;
            const pendingForType = (data?.sessions ?? []).filter(
              s => s.status !== 'COMPLETED' && s.examType === prevTestType
            );
            const peerAvg = prevTestType === 'READINESS_ASSESSMENT'
              ? (data?.peerStats?.avgRA ?? null)
              : prevTestType === 'CAT' ? (data?.peerStats?.avgCAT ?? null) : null;

            const lineData = activeSessions.slice().reverse().map((s, idx) => {
              const r = s.result as Record<string, unknown> | null;
              const pct = r?.percentCorrect as number | undefined;
              const theta = r?.finalTheta as number | undefined;
              const scoreVal = typeof pct === 'number' ? Math.round(pct * 10) / 10
                : (typeof theta === 'number' ? Math.round(((1 / (1 + Math.exp(-theta))) * 100) * 10) / 10 : undefined);
              return { attempt: idx + 1, score: scoreVal, peer: peerAvg ?? undefined };
            }).filter(d => d.score !== undefined);

            const xMax = Math.max(35, lineData.length);

            const PREV_TABS = [
              { key: 'READINESS_ASSESSMENT' as const, label: 'Readiness Assessment', count: raSessions.length },
              { key: 'CAT' as const, label: 'CAT', count: catSessions.length },
              { key: 'TUTORIAL' as const, label: 'Tutorial', count: tutorialSessions.length },
            ];

            const examTypeLabel = (t: string) =>
              t === 'READINESS_ASSESSMENT' ? 'Readiness' : t === 'CAT' ? 'CAT' : t === 'TUTORIAL' ? 'Tutorial' : t;

            const fmtDate = (d: string | null) => d
              ? new Date(d).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
              : '—';

            const getScore = (s: Session) => {
              const r = s.result as Record<string, unknown> | null;
              const pct = r?.percentCorrect as number | undefined;
              const theta = r?.finalTheta as number | undefined;
              if (typeof pct === 'number') return `${pct.toFixed(1)}%`;
              if (typeof theta === 'number') return `θ ${theta.toFixed(2)}`;
              return '—';
            };

            const getRemarks = (s: Session) => {
              const r = s.result as Record<string, unknown> | null;
              const passed = r?.passed as boolean | undefined;
              if (s.status !== 'COMPLETED') return { label: 'In Progress', cls: 'bg-blue-100 text-blue-700' };
              if (passed === true)  return { label: 'PASS', cls: 'bg-green-100 text-green-700' };
              if (passed === false) return { label: 'FAIL', cls: 'bg-red-100 text-red-600' };
              return { label: 'Completed', cls: 'bg-gray-100 text-gray-600' };
            };

            const getTotalQ = (s: Session) => {
              const r = s.result as Record<string, unknown> | null;
              const items = r?.totalItems as number | undefined;
              return items ?? s.currentIndex ?? '—';
            };

            const tableRows = prevDetailTab === 'completed' ? activeSessions : pendingForType;

            return (
              <div>
                {/* Exam-type tabs */}
                <div className="flex border-b border-gray-200 mb-0">
                  {PREV_TABS.map(tab => (
                    <button key={tab.key} onClick={() => setPrevTestType(tab.key)}
                      className={`px-5 py-3 text-sm font-semibold transition-colors relative ${
                        prevTestType === tab.key ? 'text-[#17a2b8]' : 'text-gray-500 hover:text-gray-700'
                      }`}>
                      {tab.label}
                      {prevTestType === tab.key && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#17a2b8]" />
                      )}
                    </button>
                  ))}
                </div>

                {/* Graph — x-axis always 1-35, extends if more data */}
                <div className="bg-white border border-t-0 border-gray-200 rounded-b-xl">
                  {lineData.length < 2 ? (
                    <div className="relative overflow-hidden" style={{ height: 280 }}>
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 600 280" preserveAspectRatio="none">
                        {[40, 80, 120, 160, 200, 240].map(y => (
                          <line key={y} x1="0" y1={y} x2="600" y2={y} stroke="#e5e7eb" strokeWidth="1"/>
                        ))}
                        {Array.from({ length: 35 }, (_, i) => i + 1).map(n => (
                          <text key={n} x={n * (600 / 36)} y={270} textAnchor="middle" fontSize="9" fill="#d1d5db">{n}</text>
                        ))}
                        <polyline points="0,200 60,60 120,180 180,40 240,160 300,80 360,200 420,50 480,170 540,90 600,220"
                          fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        <polyline points="0,80 60,180 120,60 180,200 240,80 300,160 360,40 420,180 480,70 540,200 600,90"
                          fill="none" stroke="#e2e8f0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <p className="text-lg font-bold text-gray-400 mb-1">More data needed</p>
                        <p className="text-xs text-gray-400 mb-4">Complete more tests to view your performance graph</p>
                        <button onClick={() => { setCtExamType(prevTestType); setCtBank(''); setCreateTestModal(true); }}
                          className="px-4 py-2 bg-[#17a2b8] text-white text-xs font-bold rounded-lg hover:bg-[#138a9e] transition-colors">
                          Start a {prevTestType === 'READINESS_ASSESSMENT' ? 'Readiness Assessment' : prevTestType === 'CAT' ? 'CAT' : 'Tutorial'} →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-5">
                      <ResponsiveContainer width="100%" height={240}>
                        <LineChart data={lineData} margin={{ left: -20, right: 16, top: 10, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                          <XAxis dataKey="attempt" type="number" domain={[1, xMax]}
                            tickCount={Math.min(xMax, 35) + 1}
                            tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDataOverflow />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={v => `${v}`} />
                          <Tooltip
                            contentStyle={{ border: '1px solid #e5e7eb', borderRadius: 8, fontSize: 12 }}
                            formatter={(v: unknown, name: unknown) => [`${v}%`, (name as string) === 'score' ? 'Your Score' : 'Peer Avg']}
                            labelFormatter={v => `Attempt ${v}`}
                          />
                          {peerAvg !== null && (
                            <Line type="monotone" dataKey="peer" stroke="#d1d5db" strokeWidth={1.5}
                              strokeDasharray="6 3" dot={false} name="peer" />
                          )}
                          <Line type="monotone" dataKey="score" stroke="#17a2b8" strokeWidth={2.5}
                            dot={{ fill: '#17a2b8', r: 4, strokeWidth: 2, stroke: 'white' }}
                            activeDot={{ r: 6 }} name="score" connectNulls />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

                {/* Completed / Pending detail tabs + table */}
                <div className="mt-5">
                  <div className="flex gap-1.5 mb-3">
                    {([
                      { key: 'completed' as const, label: 'Completed Tests', count: activeSessions.length },
                      { key: 'pending'   as const, label: 'Pending Tests',   count: pendingForType.length },
                    ]).map(t => (
                      <button key={t.key} onClick={() => setPrevDetailTab(t.key)}
                        className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 ${
                          prevDetailTab === t.key
                            ? 'bg-[#0c1e3c] text-white'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        }`}>
                        {t.label}
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${
                          prevDetailTab === t.key ? 'bg-white/20' : 'bg-gray-200 text-gray-500'
                        }`}>{t.count}</span>
                      </button>
                    ))}
                  </div>

                  <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
                    <table className="w-full text-sm min-w-[720px]">
                      <thead>
                        <tr className="border-b border-gray-100 bg-gray-50">
                          {['Test ID', 'Score', 'Completed Date', 'Created Date', 'Mode', 'Total Questions', 'Remarks', 'Action'].map(h => (
                            <th key={h} className="px-4 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wide whitespace-nowrap">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-4 py-10 text-center text-sm text-gray-400">
                              No {prevDetailTab === 'completed' ? 'completed' : 'pending'} tests found.
                            </td>
                          </tr>
                        ) : tableRows.map((s, idx) => {
                          const rem = getRemarks(s);
                          return (
                            <tr key={s.id} className={`hover:bg-gray-50 transition-colors ${idx > 0 ? 'border-t border-gray-100' : ''}`}>
                              <td className="px-4 py-3 font-mono text-[11px] text-gray-400">{s.id.slice(0, 8).toUpperCase()}</td>
                              <td className="px-4 py-3 font-bold text-gray-800">{getScore(s)}</td>
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(s.completedAt)}</td>
                              <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(s.startedAt)}</td>
                              <td className="px-4 py-3 text-xs text-gray-600">{examTypeLabel(s.examType)}</td>
                              <td className="px-4 py-3 text-xs text-gray-600 text-center">{getTotalQ(s)}</td>
                              <td className="px-4 py-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${rem.cls}`}>{rem.label}</span>
                              </td>
                              <td className="px-4 py-3">
                                {s.status === 'COMPLETED' ? (
                                  <button onClick={() => navigate(`/nclex/review/${s.id}`)}
                                    className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50 whitespace-nowrap">
                                    Review
                                  </button>
                                ) : (
                                  <button onClick={() => navigate(`/nclex/exam/${s.id}`)}
                                    className="px-3 py-1.5 bg-[#17a2b8] text-white rounded-lg text-xs font-semibold hover:bg-[#138a9e] whitespace-nowrap">
                                    Continue
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── REMEDIATION ── */}
          {activeQbanksTab === 'remediation' && (() => {
            const untouched  = remediationTopics.filter(t => t.pct === 0);
            const weak       = remediationTopics.filter(t => t.pct > 0 && t.pct < 25);
            const developing = remediationTopics.filter(t => t.pct >= 25 && t.pct < 60);
            const strong     = remediationTopics.filter(t => t.pct >= 60);

            // AI-generated today's focus (top 3 priority topics)
            const focusTopics = [...untouched, ...weak].slice(0, 3);
            // Weekly schedule — spread weakest topics across Mon-Sun
            const weekTopics = [...untouched, ...weak, ...developing].slice(0, 21);
            const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
            const weekSchedule = DAYS.map((day, i) => ({
              day,
              topics: weekTopics.filter((_, j) => j % 7 === i),
              isRest: i === 6,
            }));

            const dailyGoalNum = parseInt(dailyGoal) || 20;
            const todayProgress = Math.min(100, Math.round((questionsToday / dailyGoalNum) * 100));

            // Remediation coverage bar data
            const coverageData = [
              { name: 'Untouched', value: untouched.length,  fill: '#ef4444' },
              { name: 'Weak',      value: weak.length,       fill: '#f97316' },
              { name: 'Partial',   value: developing.length, fill: '#eab308' },
              { name: 'Strong',    value: strong.length,     fill: '#22c55e' },
            ].filter(d => d.value > 0);

            return (
              <div className="space-y-6">
                {/* AI Study Coach banner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#0c1e3c] to-[#1a3a6e] p-5 text-white">
                  <div className="absolute top-0 right-0 opacity-10">
                    <Sparkles className="h-32 w-32 -mt-6 -mr-6" />
                  </div>
                  <div className="flex items-start gap-3 relative">
                    <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
                      <Sparkles className="h-5 w-5 text-blue-200" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-black text-lg leading-tight">AI Study Coach</p>
                      <p className="text-blue-200 text-sm mt-0.5">
                        {remediationTopics.length === 0
                          ? 'Take a few exams to unlock personalized recommendations.'
                          : `You have ${untouched.length + weak.length} topics that need attention. Here's your personalized plan.`}
                      </p>
                    </div>
                  </div>
                  {remediationTopics.length > 0 && (
                    <div className="grid grid-cols-4 gap-3 mt-4">
                      {[
                        { label: 'Untouched', count: untouched.length,  color: 'bg-red-500/30 text-red-200' },
                        { label: 'Weak',      count: weak.length,       color: 'bg-orange-500/30 text-orange-200' },
                        { label: 'Developing',count: developing.length, color: 'bg-yellow-500/30 text-yellow-200' },
                        { label: 'Strong',    count: strong.length,     color: 'bg-green-500/30 text-green-200' },
                      ].map(s => (
                        <div key={s.label} className={`${s.color} rounded-xl px-3 py-2 text-center`}>
                          <p className="text-2xl font-black">{s.count}</p>
                          <p className="text-[10px] font-semibold uppercase tracking-wide opacity-80">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Left: Daily Input + Today's Plan */}
                  <div className="lg:col-span-2 space-y-5">
                    {/* Daily Input Form */}
                    <div className="bg-white rounded-2xl border border-gray-200 p-5">
                      <h4 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <PenLine className="h-4 w-4 text-blue-500" /> Today's Study Log
                      </h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
                            Daily Question Goal
                          </label>
                          <div className="flex gap-2">
                            {['10', '20', '30', '50'].map(n => (
                              <button key={n} onClick={() => setDailyGoal(n)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${dailyGoal === n ? 'bg-[#0c1e3c] text-white border-[#0c1e3c]' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                                {n} Qs
                              </button>
                            ))}
                            <input type="number" value={dailyGoal} onChange={e => setDailyGoal(e.target.value)}
                              min={1} max={200} placeholder="Custom"
                              className="w-20 px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-400 text-center" />
                          </div>
                        </div>
                        {/* Progress towards today's goal */}
                        <div>
                          <div className="flex justify-between text-xs mb-1.5">
                            <span className="text-gray-600 font-medium">Today's progress</span>
                            <span className={`font-bold ${todayProgress >= 100 ? 'text-green-600' : 'text-blue-600'}`}>
                              {questionsToday} / {dailyGoalNum} Qs {todayProgress >= 100 ? '🎉' : ''}
                            </span>
                          </div>
                          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${todayProgress >= 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                              style={{ width: `${Math.min(100, todayProgress)}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">
                            Notes / What you studied
                          </label>
                          <textarea
                            value={dailyNote}
                            onChange={e => { setDailyNote(e.target.value); setDailySaved(false); }}
                            rows={3}
                            placeholder="e.g. Reviewed Cardiovascular Nursing, did 20 CAT questions, struggled with dysrhythmias…"
                            className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 placeholder-gray-300"
                          />
                        </div>
                        <button
                          onClick={() => { setDailySaved(true); toast.success('Study log saved!'); }}
                          disabled={!dailyNote.trim()}
                          className="w-full py-2.5 bg-[#0c1e3c] text-white text-sm font-bold rounded-xl hover:bg-[#1a3058] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all">
                          {dailySaved ? <><CheckCircle className="h-4 w-4" /> Saved!</> : <><PenLine className="h-4 w-4" /> Save Today's Log</>}
                        </button>
                      </div>
                    </div>

                    {/* AI Today's Focus */}
                    {focusTopics.length > 0 && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                          <Flame className="h-4 w-4 text-red-500" /> Today's AI Focus
                        </h4>
                        <p className="text-xs text-gray-400 mb-4">Your highest-priority topics based on coverage gaps</p>
                        <div className="space-y-3">
                          {focusTopics.map(({ topic, total, used, pct }, i) => {
                            const isUntouched = pct === 0;
                            return (
                              <div key={topic} className={`rounded-xl border-2 p-4 ${isUntouched ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}`}>
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0 ${isUntouched ? 'bg-red-500 text-white' : 'bg-orange-500 text-white'}`}>
                                      {i + 1}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="text-sm font-bold text-gray-900 leading-tight">{topic}</p>
                                      <p className="text-xs text-gray-500 mt-0.5">
                                        {isUntouched ? `Never attempted · ${total} questions available` : `${used}/${total} done · ${pct}% covered`}
                                      </p>
                                      <div className="flex items-center gap-1.5 mt-2">
                                        <Lightbulb className="h-3 w-3 text-amber-500 flex-shrink-0" />
                                        <p className="text-xs text-gray-600 italic">
                                          {isUntouched
                                            ? `Start with 10 practice questions to get familiar with this topic.`
                                            : pct < 15
                                            ? `Focus on core concepts. Try 15–20 targeted questions today.`
                                            : `Review rationales from previous attempts, then do 10 more questions.`}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => {
                // Default selection depends on tier — FREE users can only run
                // the Tutorial, so we pre-select it. PREMIUM/VIP get RA as the
                // default per product spec.
                setCtExamType(isPremium ? 'READINESS_ASSESSMENT' : 'TUTORIAL')
                setCtBank('')
                setCreateTestModal(true)
              }}
                                    className={`flex-shrink-0 px-3 py-1.5 text-xs font-bold rounded-lg flex items-center gap-1 ${isUntouched ? 'bg-red-500 text-white hover:bg-red-600' : 'bg-orange-500 text-white hover:bg-orange-600'}`}>
                                    <Play className="h-3 w-3" /> Practice
                                  </button>
                                </div>
                                {pct > 0 && (
                                  <div className="mt-3">
                                    <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
                                      <div className="h-full bg-orange-400 rounded-full" style={{ width: `${pct}%` }} />
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Weekly Remediation Schedule */}
                    {weekTopics.length > 0 && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h4 className="font-bold text-gray-900 mb-1 flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-blue-500" /> AI Weekly Study Schedule
                        </h4>
                        <p className="text-xs text-gray-400 mb-4">
                          {daysUntilExam !== null
                            ? `${daysUntilExam} days until your exam — personalized for your weak areas`
                            : 'Personalized plan to close your coverage gaps'}
                        </p>
                        <div className="space-y-2">
                          {weekSchedule.map(({ day, topics: dayTopics, isRest }) => (
                            <div key={day} className={`rounded-xl border px-4 py-3 ${isRest ? 'border-green-200 bg-green-50' : dayTopics.length === 0 ? 'border-gray-100 bg-gray-50' : 'border-blue-100 bg-blue-50'}`}>
                              <div className="flex items-center gap-3">
                                <span className="text-xs font-black text-gray-500 w-20 flex-shrink-0">{day}</span>
                                {isRest ? (
                                  <span className="text-xs text-green-600 font-semibold">🌿 Rest & Light Review</span>
                                ) : dayTopics.length === 0 ? (
                                  <span className="text-xs text-gray-400">Review any weak topics</span>
                                ) : (
                                  <div className="flex flex-wrap gap-1.5">
                                    {dayTopics.map(t => (
                                      <span key={t.topic} className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${t.pct === 0 ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                                        {t.topic.length > 20 ? t.topic.slice(0, 18) + '…' : t.topic}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Coverage breakdown + full topic list */}
                  <div className="space-y-5">
                    {/* Coverage pie */}
                    {coverageData.length > 0 && (
                      <div className="bg-white rounded-2xl border border-gray-200 p-5">
                        <h4 className="font-bold text-gray-900 mb-3 text-sm">Coverage Breakdown</h4>
                        <ResponsiveContainer width="100%" height={170}>
                          <PieChart>
                            <Pie data={coverageData} cx="50%" cy="50%" innerRadius={45} outerRadius={70}
                              dataKey="value" paddingAngle={2}>
                              {coverageData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                            </Pie>
                            <Tooltip formatter={(v: unknown, name: unknown) => [`${v} topics`, name as string]} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="space-y-1.5 mt-1">
                          {coverageData.map(d => (
                            <div key={d.name} className="flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: d.fill }} />
                                <span className="text-gray-600">{d.name}</span>
                              </span>
                              <span className="font-bold text-gray-800">{d.value} topics</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Full topic list sorted by priority */}
                    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
                      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                        <h4 className="font-bold text-gray-900 text-sm">All Topics</h4>
                        <span className="text-xs text-gray-400">{remediationTopics.length} total</span>
                      </div>
                      {remediationTopics.length === 0 ? (
                        <div className="p-6 text-center">
                          <p className="text-sm text-gray-400">Take exams to see topic coverage</p>
                        </div>
                      ) : (
                        <div className="divide-y divide-gray-50 max-h-[480px] overflow-y-auto">
                          {remediationTopics.map(({ topic, total, used, pct }, idx) => {
                            const pri = pct === 0 ? 'untouched' : pct < 25 ? 'low' : pct < 60 ? 'mid' : 'good';
                            const barColor = { untouched: 'bg-red-400', low: 'bg-orange-400', mid: 'bg-yellow-400', good: 'bg-green-500' }[pri];
                            const badge = {
                              untouched: 'bg-red-100 text-red-700',
                              low:       'bg-orange-100 text-orange-700',
                              mid:       'bg-yellow-100 text-yellow-700',
                              good:      'bg-green-100 text-green-700',
                            }[pri];
                            const label = { untouched: 'New', low: 'Low', mid: 'Mid', good: 'Good' }[pri];
                            return (
                              <div key={topic} className="px-4 py-2.5 hover:bg-gray-50 transition-colors">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold text-gray-300 tabular-nums w-4">{idx + 1}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                      <p className="text-xs font-semibold text-gray-800 truncate">{topic}</p>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${badge}`}>{label}</span>
                                        <span className="text-[10px] font-black text-gray-600 tabular-nums">{pct}%</span>
                                      </div>
                                    </div>
                                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                      <div className={`h-full ${barColor} rounded-full`} style={{ width: `${Math.max(pct > 0 ? 2 : 0, pct)}%` }} />
                                    </div>
                                    <p className="text-[9px] text-gray-400 mt-0.5">{used}/{total} Qs</p>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}

        </div>
      </div>
    );
  };

  const renderLocked = (title: string, reason: string, icon: React.ElementType) => {
    const Icon = icon;
    return (
      <div className="p-6 lg:p-8 flex flex-col items-center justify-center h-full text-center max-w-sm mx-auto">
        <div className="h-20 w-20 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
          <Lock className="h-10 w-10 text-gray-400" />
        </div>
        <div className="h-10 w-10 -mt-12 mb-3 bg-white rounded-full flex items-center justify-center border-2 border-gray-200 mx-auto">
          <Icon className="h-5 w-5 text-gray-400" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-4">{reason}</p>
        <div className="bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-sm text-blue-700">
          Contact your GritSync admin to unlock access.
        </div>
      </div>
    );
  };

  const renderVideos = () => {
    if (!isPremium) return renderLocked('Video Library', 'Videos are available for Premium members. Upgrade your plan to access nursing review videos.', Video);

    const videos = videoConfig?.videos ?? [];
    const sorted = [...videos].sort((a, b) => a.order - b.order);
    const publishedCount = sorted.filter(v => v.isPublished && v.videoUrl).length;
    const totalCount = sorted.length;

    const getEmbedUrl = (url: string) => {
      if (!url) return null;
      const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([A-Za-z0-9_-]+)/);
      if (ytMatch) return `https://www.youtube.com/embed/${ytMatch[1]}`;
      return url;
    };

    return (
      <div className="p-4 sm:p-6 lg:p-8">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-black text-gray-900">Video Learning Path</h2>
          <p className="text-gray-500 text-sm mt-0.5">Watch from start to finish — structured NCLEX review</p>
          <div className="flex items-center gap-3 mt-3">
            <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5">
              <PlayCircle className="h-3.5 w-3.5 text-green-600" />
              <span className="text-xs font-bold text-green-700">{publishedCount} Available</span>
            </div>
            <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
              <Clock className="h-3.5 w-3.5 text-gray-500" />
              <span className="text-xs font-bold text-gray-600">{totalCount - publishedCount} Coming Soon</span>
            </div>
          </div>
        </div>

        {/* Video player modal */}
        {playingVideoId && (() => {
          const vid = sorted.find(v => v.id === playingVideoId);
          if (!vid) return null;
          const embed = getEmbedUrl(vid.videoUrl);
          return (
            <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={() => setPlayingVideoId(null)}>
              <div className="bg-white rounded-2xl overflow-hidden w-full max-w-3xl shadow-2xl" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-gray-900 text-sm truncate">{vid.title}</p>
                    {vid.duration && <p className="text-xs text-gray-400">{vid.duration}</p>}
                  </div>
                  <button onClick={() => setPlayingVideoId(null)} className="ml-3 p-1 text-gray-400 hover:text-gray-600 flex-shrink-0">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {embed ? (
                  <div className="aspect-video bg-black">
                    <iframe src={embed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                  </div>
                ) : (
                  <div className="aspect-video bg-gray-900 flex items-center justify-center">
                    <video src={vid.videoUrl} controls className="w-full h-full" />
                  </div>
                )}
                {vid.description && (
                  <div className="px-4 py-3">
                    <p className="text-sm text-gray-600">{vid.description}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        {/* Roadmap */}
        <div className="relative">
          {/* Vertical connector line */}
          <div className="absolute left-6 top-6 bottom-6 w-0.5 bg-gradient-to-b from-blue-200 via-blue-100 to-gray-100 hidden sm:block" style={{ marginLeft: '1px' }} />

          <div className="space-y-3">
            {sorted.map((video, idx) => {
              const isAvailable = video.isPublished && !!video.videoUrl;
              const topicMeta = NCLEX_TOPICS.find(t => t.name === video.topic);

              return (
                <div key={video.id} className="relative flex items-start gap-4">
                  {/* Step number bubble */}
                  <div className={`relative z-10 flex-shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-sm font-black shadow-sm border-2 ${isAvailable ? 'bg-[#0c1e3c] border-[#0c1e3c] text-white' : 'bg-white border-gray-200 text-gray-400'}`}>
                    {isAvailable ? <span>{idx + 1}</span> : <Lock className="h-4 w-4" />}
                  </div>

                  {/* Card */}
                  <div className={`flex-1 bg-white rounded-xl border transition-all ${isAvailable ? 'border-gray-200 hover:shadow-md cursor-pointer' : 'border-dashed border-gray-200 opacity-70'}`}
                    onClick={() => isAvailable && setPlayingVideoId(video.id)}>
                    <div className="flex items-start gap-3 p-3">
                      {/* Small thumbnail */}
                      <div className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden flex items-center justify-center ${topicMeta ? topicMeta.color : 'bg-gray-100'}`}
                        style={{ fontSize: '1.5rem' }}>
                        {video.thumbnailUrl ? (
                          <img src={video.thumbnailUrl} alt={video.title} className="w-full h-full object-cover" />
                        ) : (
                          <span>{topicMeta?.icon ?? '📚'}</span>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className={`text-sm font-bold leading-tight ${isAvailable ? 'text-gray-900' : 'text-gray-500'}`}>{video.title}</p>
                            {video.description && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{video.description}</p>}
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {video.duration && <span className="text-xs text-gray-400">{video.duration}</span>}
                            {isAvailable ? (
                              <div className="w-7 h-7 rounded-full bg-[#0c1e3c] flex items-center justify-center">
                                <Play className="h-3 w-3 text-white ml-0.5" />
                              </div>
                            ) : (
                              <span className="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded-full">Soon</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {publishedCount === 0 && (
          <div className="mt-4 bg-blue-50 border border-blue-100 rounded-xl p-4 text-center">
            <Video className="h-8 w-8 text-blue-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-blue-700">Videos are being prepared</p>
            <p className="text-xs text-blue-500 mt-1">Your advisor will notify you when the first video is ready.</p>
          </div>
        )}
      </div>
    );
  };

  const selectCalPlan = (planKey: string) => {
    setSelectedCalPlan(planKey);
    localStorage.setItem('nclex_cal_plan', planKey);
  };

  const clearCalPlan = () => {
    setSelectedCalPlan(null);
    localStorage.removeItem('nclex_cal_plan');
  };

  const renderCalendar = () => {
    if (!isPremium) return renderLocked('Study Calendar', 'Study Calendar is available for Premium members. Get a personalized weekly study plan.', Calendar);

    // Plan chooser
    if (!selectedCalPlan && !showWeekOfExam) {
      const PLAN_CARDS = [
        { key: '2', label: '2-Week Emergency', emoji: '⚡', description: 'Exam is very soon — high intensity, focused review', color: 'border-red-200 bg-red-50', iconColor: 'text-red-600', rec: 'For exam in 2 weeks or less', intensity: 'Extreme' },
        { key: '3', label: '3-Week Rapid', emoji: '🔥', description: 'Rapid but complete review of all NCLEX topics', color: 'border-orange-200 bg-orange-50', iconColor: 'text-orange-600', rec: 'For exam in 3 weeks', intensity: 'High' },
        { key: '4', label: '4-Week Intensive', emoji: '💪', description: 'Intensive daily study covering all body systems', color: 'border-amber-200 bg-amber-50', iconColor: 'text-amber-600', rec: 'For exam in 4 weeks', intensity: 'High' },
        { key: '6', label: '6-Week Accelerated', emoji: '🚀', description: 'Balanced study pace with room for review', color: 'border-blue-200 bg-blue-50', iconColor: 'text-blue-600', rec: 'Most popular plan', intensity: 'Moderate' },
        { key: '9', label: '9-Week Focused', emoji: '🎯', description: 'Focused and paced — thorough coverage without burnout', color: 'border-purple-200 bg-purple-50', iconColor: 'text-purple-600', rec: 'Great for working nurses', intensity: 'Moderate' },
        { key: '12', label: '12-Week Comprehensive', emoji: '📚', description: 'Comprehensive deep-dive with time to master each topic', color: 'border-green-200 bg-green-50', iconColor: 'text-green-600', rec: 'Best for thorough preparation', intensity: 'Steady' },
      ];

      return (
        <div className="p-4 sm:p-6 lg:p-8">
          <div className="mb-6">
            <h2 className="text-xl font-black text-gray-900">Choose Your Study Plan</h2>
            <p className="text-gray-500 text-sm mt-0.5">Pick one plan based on how much time you have before your exam</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {PLAN_CARDS.map(card => (
              <button
                key={card.key}
                onClick={() => selectCalPlan(card.key)}
                className={`text-left rounded-2xl border-2 p-5 hover:shadow-md transition-all hover:scale-[1.01] ${card.color}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{card.emoji}</span>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full bg-white/70 ${card.iconColor}`}>{card.intensity}</span>
                </div>
                <p className="font-black text-gray-900 text-base mb-1">{card.label}</p>
                <p className="text-xs text-gray-600 mb-3">{card.description}</p>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-500 bg-white/60 px-2 py-0.5 rounded-full">{card.rec}</span>
                </div>
              </button>
            ))}
          </div>

          {/* Week of Exam guide option */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 rounded-2xl p-5 flex items-center justify-between gap-4">
            <div>
              <p className="font-black text-white text-base">Week of Exam Guide</p>
              <p className="text-emerald-100 text-sm">Day-by-day plan for your final 7 days before the exam</p>
            </div>
            <button
              onClick={() => setShowWeekOfExam(true)}
              className="px-4 py-2.5 bg-white text-emerald-700 font-bold text-sm rounded-xl hover:bg-emerald-50 flex-shrink-0 flex items-center gap-1.5"
            >
              <Award className="h-4 w-4" /> Open Guide
            </button>
          </div>
        </div>
      );
    }

    if (showWeekOfExam && (isVip || specialAccess.includes('week_of_exam') || isPremium)) {
      return (
        <div className="p-4 sm:p-6 lg:p-8">
          <button onClick={() => { setShowWeekOfExam(false); if (!selectedCalPlan) clearCalPlan(); }} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft className="h-4 w-4" /> Back to Study Plans
          </button>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-xl font-black text-gray-900">Week of Exam Study Guide</h2>
              <p className="text-sm text-gray-500">GritSync NCLEX-RN Review</p>
            </div>
            <button onClick={() => window.print()} className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <Printer className="h-4 w-4" /> Print
            </button>
          </div>

          <div className="bg-gradient-to-r from-[#0c1e3c] to-[#1a4080] rounded-2xl p-5 mb-6 text-white">
            <div className="flex items-center gap-3 mb-2">
              <GraduationCap className="h-8 w-8 text-blue-300" />
              <div>
                <p className="font-black text-lg">GritSync NCLEX-RN Review</p>
                <p className="text-blue-200 text-sm">Final Week Preparation Guide</p>
              </div>
            </div>
            <p className="text-blue-100 text-sm mt-2">You have prepared. You are ready. This final week is about reinforcing your confidence and ensuring peak performance on exam day.</p>
          </div>

          <div className="space-y-4">
            {WEEK_OF_EXAM.map((day, i) => (
              <div key={i} className={`rounded-xl border-2 ${day.color} p-4`}>
                <div className="flex items-start gap-3">
                  <div className="w-16 flex-shrink-0 text-center">
                    <p className="text-xs font-bold text-gray-500">{day.day}</p>
                    <div className={`w-10 h-10 rounded-xl mx-auto mt-1 flex items-center justify-center text-lg ${i === 7 ? 'bg-emerald-500' : 'bg-white border border-gray-200'}`}>
                      {i === 7 ? '🏆' : `${i + 1}`}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-gray-900 mb-2">{day.label}</p>
                    <ul className="space-y-1 mb-3">
                      {day.tasks.map((task, j) => (
                        <li key={j} className="flex items-start gap-2 text-sm text-gray-700">
                          <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0 mt-0.5" />
                          {task}
                        </li>
                      ))}
                    </ul>
                    <div className="bg-white/70 rounded-lg px-3 py-2">
                      <p className="text-xs font-semibold text-gray-600">💡 Tip: {day.tip}</p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }

    const activePlanKey = selectedCalPlan ?? calWeeks;
    const plan = WEEK_PLANS[activePlanKey] ?? WEEK_PLANS['6'];
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-xl font-black text-gray-900">Study Calendar</h2>
            <p className="text-gray-500 text-sm">{plan.label}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 hidden sm:flex">
              <Printer className="h-4 w-4" /> Print
            </button>
            <button onClick={clearCalPlan} className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
              <ChevronLeft className="h-4 w-4" /> Change Plan
            </button>
          </div>
        </div>

        <div className="bg-gradient-to-r from-[#0c1e3c] to-[#1a4080] rounded-2xl p-4 mb-5 flex items-center gap-3">
          <Calendar className="h-8 w-8 text-blue-300 flex-shrink-0" />
          <div>
            <p className="font-black text-white">{plan.label}</p>
            {examDate && daysUntilExam !== null && (
              <p className="text-blue-200 text-sm">{daysUntilExam} days until your exam</p>
            )}
          </div>
          <button
            onClick={() => setShowWeekOfExam(true)}
            className="ml-auto px-3 py-1.5 bg-emerald-600 text-white text-xs font-bold rounded-lg hover:bg-emerald-700 flex items-center gap-1 flex-shrink-0"
          >
            <Award className="h-3.5 w-3.5" /> Final Week
          </button>
        </div>

        <div className="space-y-4">
          {plan.weeks.map(week => (
            <div key={week.week} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="bg-[#0c1e3c] px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-white font-bold text-sm">Week {week.week}</p>
                  <p className="text-blue-200 text-xs">{week.theme}</p>
                </div>
                <span className="text-xs bg-blue-500/30 text-blue-200 px-2 py-1 rounded-full font-semibold">
                  Goal: {week.qGoal} Qs
                </span>
              </div>
              <div className="p-4">
                <div className="flex flex-wrap gap-2 mb-3">
                  {week.topics.map(ti => (
                    <span key={ti} className={`text-xs px-2.5 py-1 rounded-full font-medium ${NCLEX_TOPICS[ti].color}`}>
                      {NCLEX_TOPICS[ti].icon} {NCLEX_TOPICS[ti].name}
                    </span>
                  ))}
                </div>
                <div className="border-t border-gray-100 pt-3">
                  <p className="text-xs font-bold text-gray-500 mb-1.5">DAILY ROUTINE</p>
                  <div className="flex flex-wrap gap-3">
                    {week.daily.map((d, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-700 font-bold flex items-center justify-center text-xs flex-shrink-0">{i + 1}</div>
                        {d}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTestimonial = () => (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="max-w-2xl">
        <h2 className="text-xl font-black text-gray-900 mb-1">Testimonials</h2>
        <p className="text-gray-500 text-sm mb-6">What GritSync students say about their NCLEX journey</p>

        {/* Approved testimonials feed */}
        {approvedTestimonials.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <ThumbsUp className="h-4 w-4 text-blue-600" />
              <h3 className="font-bold text-gray-800 text-sm">{approvedTestimonials.length} Success {approvedTestimonials.length === 1 ? 'Story' : 'Stories'}</h3>
            </div>
            <div className="space-y-4">
              {approvedTestimonials.map(t => (
                <div key={t.id} className={`bg-white rounded-2xl border p-4 ${t.isFeatured ? 'border-amber-300 bg-amber-50/30' : 'border-gray-200'}`}>
                  {t.isFeatured && (
                    <div className="flex items-center gap-1 mb-2">
                      <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                      <span className="text-xs font-bold text-amber-600">Featured</span>
                    </div>
                  )}
                  {/* Stars */}
                  <div className="flex gap-0.5 mb-2">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`h-4 w-4 ${s <= t.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-200'}`} />
                    ))}
                  </div>
                  {/* Content */}
                  <p className="text-sm text-gray-700 leading-relaxed mb-3">"{t.content}"</p>
                  {/* Author */}
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white text-xs font-black flex-shrink-0">
                      {t.clientName.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900 truncate">{t.clientName}</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        {t.designation && <span className="text-xs text-blue-600 font-medium">{t.designation}</span>}
                        {t.location && (
                          <span className="text-xs text-gray-400 flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />{t.location}
                          </span>
                        )}
                        <span className="text-xs text-gray-300">
                          {new Date(t.createdAt).toLocaleDateString([], { month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Divider */}
        <div className="border-t border-gray-100 mb-6 pt-6">
          <h3 className="font-bold text-gray-900 mb-1">Share Your Experience</h3>
          <p className="text-gray-500 text-sm mb-4">Your testimonial will be reviewed before being published.</p>
        </div>

        {/* Submit form */}
        {testSent ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-6 text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-3" />
            <h3 className="font-bold text-green-800 text-lg mb-1">Thank you!</h3>
            <p className="text-green-700 text-sm">Your testimonial has been submitted for review. We'll publish it soon!</p>
            <button onClick={() => setTestSent(false)} className="mt-4 text-sm text-green-600 hover:underline">Submit another</button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4">
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-2">Rating</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(star => (
                  <button key={star} onClick={() => setTestForm(f => ({ ...f, rating: star }))}>
                    <Star className={`h-7 w-7 transition-colors ${star <= testForm.rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-600 mb-1">Your Story *</label>
              <textarea
                value={testForm.content}
                onChange={e => setTestForm(f => ({ ...f, content: e.target.value }))}
                rows={4}
                placeholder="Share how GritSync NCLEX Review helped you prepare for your exam..."
                className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Designation</label>
                <input value={testForm.designation} onChange={e => setTestForm(f => ({ ...f, designation: e.target.value }))}
                  placeholder="e.g. RN, BSN" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1">Location</label>
                <input value={testForm.location} onChange={e => setTestForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="e.g. Manila, PH" className="w-full px-3 py-2 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <button
              onClick={sendTestimonial}
              disabled={testSending || !testForm.content.trim()}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0c1e3c] text-white rounded-xl font-bold text-sm hover:bg-[#1a3058] disabled:opacity-50 transition-colors"
            >
              {testSending ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="h-4 w-4" />}
              Submit Testimonial
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderSubscription = () => {
    const activePlans = planConfig?.plans.filter(p => p.isActive) ?? [];
    const freePlan = activePlans.find(p => p.id === 'free' || p.price === 0);
    const paidPlans = activePlans.filter(p => p.price > 0);
    const premiumPlan = paidPlans.find(p => p.id === 'premium');
    const vipPlan = paidPlans.find(p => p.id === 'vip');

    const PLAN_ACCENTS: Record<string, { border: string; activeBorder: string; check: string; badge: string; btn: string }> = {
      premium: { border: 'border-[#0c1e3c]', activeBorder: 'border-blue-500', check: 'text-blue-600', badge: 'bg-blue-100 text-blue-800', btn: 'bg-[#0c1e3c] hover:bg-[#1a3058]' },
      vip:     { border: 'border-amber-400', activeBorder: 'border-amber-500', check: 'text-amber-500', badge: 'bg-amber-100 text-amber-800', btn: 'bg-amber-500 hover:bg-amber-600' },
    };
    const defaultAccent = PLAN_ACCENTS.premium;

    const currentPlanLabel = isVip ? 'VIP' : isPremium ? 'Premium' : 'Free';

    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <h2 className="text-xl font-black text-gray-900 mb-1">Subscription</h2>
        <p className="text-gray-500 text-sm mb-5">Choose the plan that fits your needs.</p>

        {/* Current plan status banner */}
        {isVip && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <span className="text-xl">⭐</span>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-amber-800 text-sm">You're on VIP!</p>
              <p className="text-amber-600 text-xs">All features unlocked · Expires: {profile?.tierExpiresAt ? new Date(profile.tierExpiresAt).toLocaleDateString() : 'N/A'}</p>
            </div>
            <button onClick={() => setDowngradeModal(true)} className="text-xs text-amber-700 border border-amber-300 px-2.5 py-1 rounded-lg hover:bg-amber-100 flex-shrink-0">
              Downgrade
            </button>
          </div>
        )}
        {isPremium && !isVip && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-blue-800 text-sm">You're on Premium</p>
              <p className="text-blue-600 text-xs">Expires: {profile?.tierExpiresAt ? new Date(profile.tierExpiresAt).toLocaleDateString() : 'N/A'}</p>
            </div>
            <button onClick={() => setDowngradeModal(true)} className="text-xs text-blue-700 border border-blue-200 px-2.5 py-1 rounded-lg hover:bg-blue-100 flex-shrink-0">
              Downgrade
            </button>
          </div>
        )}
        {profile?.upgradeRequested && !isPremium && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 text-sm">Upgrade request pending</p>
              <p className="text-amber-600 text-xs">Admin is reviewing your payment. Check back soon.</p>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 gap-4 ${paidPlans.length >= 2 ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2'}`}>
          {/* Free Plan */}
          {freePlan && (
            <div className={`rounded-2xl border-2 p-5 ${!isPremium ? 'border-gray-400 bg-gray-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center justify-between mb-2">
                <p className="font-black text-gray-900 text-lg">{freePlan.name}</p>
                {!isPremium && <span className="text-xs bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full font-bold">Current</span>}
              </div>
              <p className="text-2xl font-black text-gray-900 mb-0.5">₱0 <span className="text-sm font-normal text-gray-400">forever</span></p>
              {freePlan.description && <p className="text-xs text-gray-400 mb-3">{freePlan.description}</p>}
              <ul className="space-y-1.5 my-3">
                {freePlan.features.slice(0, 6).map((f, i) => {
                  const { name, included } = planIncluded(f as string | PlanFeature);
                  return (
                    <li key={i} className={`flex items-center gap-2 text-xs ${included ? 'text-gray-600' : 'text-gray-300 line-through'}`}>
                      {included ? <CheckCircle className="h-3.5 w-3.5 text-green-500 flex-shrink-0" /> : <X className="h-3.5 w-3.5 text-gray-200 flex-shrink-0" />}
                      {name}
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Paid Plans */}
          {paidPlans.map(plan => {
            const acc = PLAN_ACCENTS[plan.id] ?? defaultAccent;
            const isCurrentPlan = (plan.id === 'vip' && isVip) || (plan.id === 'premium' && isPremium && !isVip);
            const canUpgradeTo = !isCurrentPlan && !profile?.upgradeRequested && (
              (plan.id === 'premium' && !isPremium) ||
              (plan.id === 'vip' && !isVip)
            );

            return (
              <div key={plan.id} className={`rounded-2xl border-2 p-5 relative overflow-hidden ${isCurrentPlan ? `${acc.activeBorder} bg-blue-50/20` : `${acc.border} bg-white`}`}>
                {plan.id === 'vip' && (
                  <div className="absolute top-0 right-0 bg-amber-500 text-white text-xs px-3 py-1 rounded-bl-xl font-bold">⭐ VIP</div>
                )}
                {plan.isPopular && plan.id !== 'vip' && (
                  <div className="absolute top-0 right-0 bg-[#0c1e3c] text-white text-xs px-3 py-1 rounded-bl-xl font-bold">POPULAR</div>
                )}
                <div className="flex items-center justify-between mb-2 mt-1">
                  <p className="font-black text-gray-900 text-lg">{plan.name}</p>
                  {isCurrentPlan && <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${acc.badge}`}>Current</span>}
                </div>
                <p className="text-2xl font-black text-gray-900 mb-0.5">
                  ₱{plan.price.toLocaleString()}
                  {plan.durationDays && <span className="text-sm font-normal text-gray-400"> / {plan.durationDays} days</span>}
                </p>
                {plan.description && <p className="text-xs text-gray-400 mb-3">{plan.description}</p>}
                <ul className="space-y-1.5 my-3">
                  {plan.features.slice(0, 6).map((f, i) => {
                    const { name, included } = planIncluded(f as string | PlanFeature);
                    return (
                      <li key={i} className={`flex items-center gap-2 text-xs ${included ? 'text-gray-700' : 'text-gray-300 line-through'}`}>
                        {included ? <CheckCircle className={`h-3.5 w-3.5 flex-shrink-0 ${acc.check}`} /> : <X className="h-3.5 w-3.5 text-gray-200 flex-shrink-0" />}
                        {name}
                      </li>
                    );
                  })}
                </ul>
                {canUpgradeTo && (
                  <button
                    onClick={() => openUpgradeModal(plan.id)}
                    className={`w-full py-2.5 rounded-xl font-bold text-sm transition-colors flex items-center justify-center gap-2 text-white mt-2 ${acc.btn}`}
                  >
                    <Zap className="h-4 w-4" />
                    {isPremium ? 'Upgrade to VIP' : `Get ${plan.name}`}
                  </button>
                )}
                {profile?.upgradeRequested && !isPremium && (
                  <div className="mt-2 text-xs text-amber-600 text-center font-medium">Request pending review…</div>
                )}
              </div>
            );
          })}

          {activePlans.length === 0 && !planConfig && (
            <div className="col-span-3 py-8 text-center text-gray-400 text-sm">Loading plans…</div>
          )}
        </div>

        {/* VIP special features note */}
        <div className="mt-5 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs font-bold text-amber-800 mb-2">⭐ VIP EXCLUSIVE FEATURES</p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Live Lectures', icon: Mic, granted: isVip || specialAccess.includes('live_lectures') },
              { label: 'Cheat Sheets', icon: FileText, granted: isVip || specialAccess.includes('cheat_sheets') },
              { label: 'Week of Exam', icon: Award, granted: isVip || specialAccess.includes('week_of_exam') },
            ].map(item => (
              <div key={item.label} className={`rounded-lg p-3 text-center ${item.granted ? 'bg-amber-100/60 border border-amber-200' : 'bg-white border border-gray-200'}`}>
                <item.icon className={`h-5 w-5 mx-auto mb-1 ${item.granted ? 'text-amber-600' : 'text-gray-300'}`} />
                <p className="text-xs font-semibold text-gray-700">{item.label}</p>
                <p className={`text-xs mt-0.5 ${item.granted ? 'text-amber-600 font-bold' : 'text-gray-300'}`}>{item.granted ? '✓ Active' : 'VIP only'}</p>
              </div>
            ))}
          </div>
          {!isVip && <p className="text-xs text-amber-600 mt-2 text-center">Upgrade to VIP to unlock all three features</p>}
        </div>

        {/* Downgrade modal */}
        {downgradeModal && (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-2">Downgrade Plan?</h3>
              <p className="text-sm text-gray-500 mb-4">
                To downgrade from <strong>{currentPlanLabel}</strong>, please contact your GritSync advisor.
                Your current plan remains active until it expires.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4">
                <p className="text-xs text-amber-700">Your current plan is active until: <strong>{profile?.tierExpiresAt ? new Date(profile.tierExpiresAt).toLocaleDateString() : 'N/A'}</strong></p>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setDowngradeModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                  Close
                </button>
                <button onClick={() => { setDowngradeModal(false); }}
                  className="flex-1 px-4 py-2.5 bg-[#0c1e3c] text-white rounded-xl text-sm font-semibold hover:bg-[#1a3058] flex items-center justify-center gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Message Advisor
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };


  const sectionContent: Record<NavSection, React.ReactNode> = {
    qbanks: renderQBanks(),
    videos: renderVideos(),
    live: (isVip || specialAccess.includes('live_lectures'))
      ? renderLiveLectures()
      : renderLocked('Live Lectures', 'Live lectures are available for VIP members or by admin grant. Contact your advisor to unlock access.', Mic),
    cheatsheets: (isVip || specialAccess.includes('cheat_sheets'))
      ? renderCheatSheets()
      : renderLocked('Cheat Sheets', 'Cheat sheets are available for VIP members or by admin grant. Contact your advisor to unlock.', FileText),
    calendar: renderCalendar(),
    testimonial: renderTestimonial(),
    subscription: renderSubscription(),
  };

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden">

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className={`${sidebarOpen ? 'flex' : 'hidden'} md:flex w-72 bg-[#0c1e3c] flex-col flex-shrink-0 overflow-y-auto fixed md:relative inset-y-0 left-0 z-50`}>

        {/* Logo */}
        <div className="px-5 py-4 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo-blue.png"
              alt="GritSync"
              className="h-8 w-8 rounded-lg object-contain flex-shrink-0 bg-white/5"
            />
            <div>
              <p className="text-white font-black text-sm leading-tight">GritSync</p>
              <p className="text-blue-300 text-xs">NCLEX-RN Review</p>
            </div>
          </div>
        </div>

        {/* Exam Date Card — clickable, shows only the date with animation */}
        <div className="mx-4 mt-4 flex-shrink-0">
          {examDateEditMode ? (
            <div className={`rounded-xl p-3 ${
              urgency === 'critical' ? 'bg-gradient-to-br from-red-600 to-rose-700' :
              urgency === 'high' ? 'bg-gradient-to-br from-orange-500 to-red-600' :
              urgency === 'medium' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
              'bg-gradient-to-br from-blue-600 to-indigo-700'
            }`}>
              <p className="text-white/70 text-xs font-bold mb-2">Set Exam Date</p>
              <div className="flex gap-1.5">
                <input
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="flex-1 px-2 py-1.5 bg-white/15 text-white text-xs rounded-lg border border-white/20 focus:outline-none focus:border-white/50 min-w-0"
                  autoFocus
                />
                <button onClick={async () => { await saveExamDate(); setExamDateEditMode(false); }} disabled={savingDate}
                  className="px-2 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs rounded-lg font-bold transition-colors disabled:opacity-50 flex-shrink-0">
                  {savingDate ? '…' : 'Save'}
                </button>
                <button onClick={() => setExamDateEditMode(false)}
                  className="px-2 py-1.5 bg-white/10 hover:bg-white/20 text-white text-xs rounded-lg transition-colors flex-shrink-0">
                  ✕
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setExamDateEditMode(true)}
              className={`w-full rounded-xl p-3 text-left group transition-all ${
                urgency === 'critical' ? 'bg-gradient-to-br from-red-600 to-rose-700' :
                urgency === 'high' ? 'bg-gradient-to-br from-orange-500 to-red-600' :
                urgency === 'medium' ? 'bg-gradient-to-br from-amber-500 to-orange-600' :
                'bg-gradient-to-br from-blue-600 to-indigo-700'
              } hover:brightness-110`}
            >
              {examDate && daysUntilExam !== null && !examPassed ? (
                <div className="flex items-center gap-3">
                  {/* Animated writing person SVG */}
                  <div className="flex-shrink-0 relative w-10 h-10">
                    <svg viewBox="0 0 40 40" className="w-10 h-10 fill-white/80">
                      {/* Head */}
                      <circle cx="20" cy="8" r="4" />
                      {/* Body */}
                      <rect x="16" y="13" width="8" height="10" rx="2" />
                      {/* Left arm - static */}
                      <rect x="9" y="14" width="7" height="2.5" rx="1.5" />
                      {/* Right arm - animated writing */}
                      <rect x="24" y="14" width="7" height="2.5" rx="1.5" className="origin-left"
                        style={{ transformOrigin: '24px 15px', animation: 'writing 1.2s ease-in-out infinite alternate' }} />
                      {/* Pen */}
                      <rect x="30" y="15" width="1.5" height="5" rx="0.5" style={{ animation: 'writing 1.2s ease-in-out infinite alternate', transformOrigin: '30px 15px' }} />
                      {/* Legs */}
                      <rect x="16" y="23" width="3" height="7" rx="1.5" />
                      <rect x="21" y="23" width="3" height="7" rx="1.5" />
                    </svg>
                    <style>{`@keyframes writing { 0%{transform:rotate(-15deg)} 100%{transform:rotate(15deg)} }`}</style>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white/60 text-xs">Exam Date</p>
                    <p className="text-white font-black text-base leading-tight">
                      {new Date(examDate).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                    <p className="text-white/70 text-xs font-semibold">{daysUntilExam}d remaining</p>
                  </div>
                  <Edit3 className="h-3.5 w-3.5 text-white/40 group-hover:text-white/70 flex-shrink-0 transition-colors" />
                </div>
              ) : examPassed ? (
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎉</span>
                  <div>
                    <p className="text-white font-black text-sm">Exam day passed!</p>
                    <p className="text-white/70 text-xs">Great work!</p>
                  </div>
                  <Edit3 className="h-3.5 w-3.5 text-white/40 group-hover:text-white/70 flex-shrink-0 ml-auto" />
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  {/* Animated writing person */}
                  <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center">
                    <svg viewBox="0 0 40 40" className="w-8 h-8 fill-white/60">
                      <circle cx="20" cy="8" r="4" />
                      <rect x="16" y="13" width="8" height="10" rx="2" />
                      <rect x="9" y="14" width="7" height="2.5" rx="1.5" />
                      <rect x="24" y="14" width="7" height="2.5" rx="1.5" style={{ transformOrigin: '24px 15px', animation: 'writing 1.2s ease-in-out infinite alternate' }} />
                      <rect x="16" y="23" width="3" height="7" rx="1.5" />
                      <rect x="21" y="23" width="3" height="7" rx="1.5" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-white/60 text-xs">Exam Date</p>
                    <p className="text-white/80 text-sm font-semibold">Tap to set date</p>
                  </div>
                  <Edit3 className="h-3.5 w-3.5 text-white/40 group-hover:text-white/70 flex-shrink-0" />
                </div>
              )}
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 pt-3 pb-4 flex flex-col">
          <div className="flex-1">
            {NAV_ITEMS.map(item => {
              const accessible = canAccess(item);
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : accessible
                      ? 'text-blue-200 hover:bg-white/10 hover:text-white'
                      : 'text-blue-400/50'
                  }`}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {!accessible && <Lock className="h-3 w-3 flex-shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="border-t border-white/10 pt-3 mt-3">
            {BOTTOM_NAV_ITEMS.map(item => {
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => { setActiveSection(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 ${
                    isActive
                      ? 'bg-white/15 text-white'
                      : 'text-blue-200 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <item.icon className="h-4 w-4 flex-shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.id === 'subscription' && isVip && <span className="text-xs bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">⭐VIP</span>}
                  {item.id === 'subscription' && isPremium && !isVip && <span className="text-xs bg-amber-500/30 text-amber-300 px-1.5 py-0.5 rounded-full font-bold">PRO</span>}
                  {item.id === 'subscription' && !isPremium && <span className="text-xs bg-white/10 text-gray-400 px-1.5 py-0.5 rounded-full">FREE</span>}
                </button>
              );
            })}

            {/* Study Group — external link */}
            <a
              href="https://www.facebook.com/groups/gritsync"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all mb-0.5 text-blue-200 hover:bg-white/10 hover:text-white"
            >
              <Users className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1 text-left">Study Group</span>
              <ExternalLink className="h-3 w-3 flex-shrink-0 text-blue-400" />
            </a>
          </div>
        </nav>

        {/* Back to Portal — cross-subdomain hop from review.gritsync.com back to
            the user's role-appropriate home on app.gritsync.com. In dev the
            appUrl helper stays on the same origin and prefixes /app. */}
        <div className="px-4 pb-5 flex-shrink-0 border-t border-white/10 pt-3">
          <a
            href={appUrl(homePathForRole(user?.role))}
            className="flex items-center gap-2 text-blue-300 hover:text-white text-sm transition-colors py-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Portal
          </a>
        </div>
      </aside>

      {/* ── Main Content ─────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar */}
        <header className="bg-[#0c1e3c] h-12 flex items-center justify-between px-4 sm:px-6 flex-shrink-0 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setSidebarOpen(o => !o)} className="md:hidden p-1 text-white/70 hover:text-white flex-shrink-0">
              <Menu className="h-5 w-5" />
            </button>
            <span className="text-white font-semibold text-sm truncate">
              {[...NAV_ITEMS, ...BOTTOM_NAV_ITEMS].find(n => n.id === activeSection)?.label ?? 'NCLEX-RN Review'}
            </span>
            {!isPremium && activeSection === 'qbanks' && (
              <span className="text-xs text-blue-300 hidden sm:inline flex-shrink-0">
                {questionsToday}/25 Qs today
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Days Remaining Counter */}
            {daysUntilExam !== null && !examPassed && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                urgency === 'critical' ? 'bg-red-500/30 text-red-200 animate-pulse' :
                urgency === 'high' ? 'bg-orange-500/20 text-orange-200' :
                urgency === 'medium' ? 'bg-amber-500/15 text-amber-200' :
                'bg-white/10 text-blue-200'
              }`}>
                <Timer className={`h-3.5 w-3.5 flex-shrink-0 ${urgency === 'critical' ? 'animate-spin' : ''}`} style={urgency === 'critical' ? { animationDuration: '2s' } : {}} />
                <span className="hidden sm:inline">
                  {daysUntilExam > 0
                    ? <><span className="text-white font-black">{daysUntilExam}</span>d <span className="text-white font-black">{hoursUntilExam}</span>h remaining</>
                    : <><span className="text-white font-black">{hoursUntilExam}</span>h <span className="text-white font-black">{minsUntilExam}</span>m remaining</>
                  }
                </span>
                <span className="sm:hidden font-black text-white">
                  {daysUntilExam > 0 ? `${daysUntilExam}d` : `${hoursUntilExam}h`}
                </span>
              </div>
            )}
            {examPassed && examDate && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold">
                🎉 <span className="hidden sm:inline">Exam Day!</span>
              </div>
            )}
            <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
              {user?.firstName?.[0]}
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto bg-gray-50">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#0c1e3c] border-t-transparent" />
            </div>
          ) : (
            sectionContent[activeSection]
          )}
        </div>
      </div>

      {/* Create Test modal - Archer Review style */}
      {createTestModal && (() => {
        const isPractice = ctExamType === 'TUTORIAL';
        const EXAM_OPTS = [
          { type: 'TUTORIAL',             label: 'Practice Mode',        icon: Play,        color: 'from-emerald-500 to-teal-600',   meta: 'Custom Qs · Free',     locked: false,             desc: 'Fully customizable practice with topics, formats, and question count' },
          { type: 'READINESS_ASSESSMENT', label: 'Readiness Assessment', icon: Target,      color: 'from-blue-500 to-indigo-600',    meta: '85 Qs · ~2 hrs',       locked: !isPremium,        desc: 'Official NCLEX-style 85-question readiness assessment' },
          { type: 'CAT',                  label: 'CAT Adaptive',         icon: Brain,       color: 'from-purple-500 to-fuchsia-600', meta: '85–150 Qs · Adaptive', locked: !isPremium,        desc: 'Computerized adaptive test that adjusts to your ability' },
          { type: 'EXIT_EXAM',            label: 'GritSync Exit Exam',   icon: Trophy,      color: 'from-amber-500 to-orange-600',   meta: '150 Qs · 350 min',     locked: !data?.exitAccess, desc: 'Comprehensive exit exam — contact admin for access' },
        ];
        const MODE_DESCS: Record<string, string> = {
          TUTORIAL: 'Receive instant explanations after submitting your answers.',
          CAT: 'Computerized Adaptive Testing that adjusts difficulty based on your performance.',
          READINESS_ASSESSMENT: 'Assess your NCLEX readiness with an official 85-question scored exam.',
          EXIT_EXAM: 'Comprehensive 150-question timed exit examination.',
        };

        const SUBJECT_GROUPS = [
          { name: 'Adult Health',           topics: ['Cardiovascular Nursing', 'Respiratory Nursing', 'Neurological Nursing', 'Gastrointestinal Nursing', 'Genitourinary/Renal Nursing', 'Endocrine Nursing'] },
          { name: 'Pharmacology',           topics: ['Pharmacology Fundamentals'] },
          { name: 'Fundamentals',           topics: ['Safety & Infection Control', 'Musculoskeletal & Integumentary', 'NCLEX Strategies & Test-Taking'] },
          { name: 'Leadership & Management',topics: ['Leadership & Management', 'Community & Transcultural'] },
          { name: 'Child Health',           topics: ['Pediatric Nursing'] },
          { name: 'Maternal & Newborn Health', topics: ['Maternal-Newborn Nursing'] },
          { name: 'Mental Health',          topics: ['Mental Health Nursing'] },
          { name: 'Critical Care',          topics: ['Critical Care & Emergency', 'Hematological & Immunological', 'Oncology & Palliative Care'] },
          { name: 'Nutrition',              topics: ['Nutrition & Metabolism', 'Comprehensive Review & Mock Exams'] },
        ];

        const CLIENT_NEED_GROUPS = [
          { name: 'Physiological Adaptation',           topics: TEST_PLAN_CATEGORIES.find(c => c.id === 'physio')!.topics },
          { name: 'Reduction of Risk Potential',        topics: TEST_PLAN_CATEGORIES.find(c => c.id === 'risk')!.topics },
          { name: 'Health Promotion and Maintenance',   topics: TEST_PLAN_CATEGORIES.find(c => c.id === 'health')!.topics },
          { name: 'Basic Care and Comfort',             topics: TEST_PLAN_CATEGORIES.find(c => c.id === 'basic')!.topics },
          { name: 'Safety & Infection Control',         topics: TEST_PLAN_CATEGORIES.find(c => c.id === 'safety')!.topics },
          { name: 'Psychosocial Integrity',             topics: TEST_PLAN_CATEGORIES.find(c => c.id === 'psycho')!.topics },
          { name: 'Pharmacological and Parenteral Therapies', topics: TEST_PLAN_CATEGORIES.find(c => c.id === 'pharma')!.topics },
          { name: 'Management of Care',                 topics: TEST_PLAN_CATEGORIES.find(c => c.id === 'mgmt')!.topics },
        ];

        const activeGroups = ctOrganization === 'clientNeed' ? CLIENT_NEED_GROUPS : SUBJECT_GROUPS;

        const getGroupCount = (topics: string[]) =>
          topics.reduce((sum, t) => sum + ((data?.stats.byTopic ?? []).find(b => b.topic === t)?.count ?? 0), 0);

        const isGroupSelected = (topics: string[]) => topics.every(t => ctTopics.includes(t));
        const isGroupPartial  = (topics: string[]) => !isGroupSelected(topics) && topics.some(t => ctTopics.includes(t));
        const allGroupsSelected = activeGroups.every(g => isGroupSelected(g.topics));

        const toggleGroup = (topics: string[]) => {
          if (isGroupSelected(topics)) setCtTopics(prev => prev.filter(t => !topics.includes(t)));
          else setCtTopics(prev => [...new Set([...prev, ...topics])]);
        };
        const toggleAllGroups = () => {
          if (allGroupsSelected) setCtTopics([]);
          else setCtTopics(activeGroups.flatMap(g => g.topics));
        };


        const sataCnt = data?.stats.byFormat?.find(f => f.format === 'SATA')?.count ?? 0;
        const unusedC = unusedClassic;
        const unusedN = unusedNgn;

        const closeModal = () => { setCreateTestModal(false); setAiResult(null); setCtStep(1); };

        const handleAiGenerate = async () => {
          setAiSuggesting(true);
          setAiResult(null);
          try {
            const usedByTopic = data?.stats.usedByTopic ?? {};
            const topicStats = (data?.stats.byTopic ?? []).map(({ topic, count }) => {
              const used = usedByTopic[topic] ?? 0;
              return { topic, total: count, used, pct: count > 0 ? Math.round((used / count) * 100) : 0 };
            }).sort((a, b) => a.pct - b.pct);
            const res = await nclexApi.suggestTest({ topicStats, studyGoal: aiGoal || undefined, examDate: examDate || null });
            setAiResult(res.data.data);
          } catch {
            toast.error('AI suggestion failed. Please try again.');
          } finally {
            setAiSuggesting(false);
          }
        };

        const applyAiSuggestion = () => {
          if (!aiResult) return;
          setCtTopics(aiResult.topics);
          setCtQuestionCount(aiResult.questionCount);
          setCtFormats(aiResult.formats);
          setCtMode('manual');
          setAiResult(null);
        };

        // Blueprint: toggle all topics for a category
        const toggleBpCategory = (catTopics: string[]) => {
          const allSelected = catTopics.every(t => ctTopics.includes(t));
          if (allSelected) setCtTopics(prev => prev.filter(t => !catTopics.includes(t)));
          else setCtTopics(prev => [...new Set([...prev, ...catTopics])]);
        };

        // Blueprint: select balanced set proportional to test plan
        const applyBlueprint = () => {
          const totalWeight = TEST_PLAN_CATEGORIES.reduce((s, c) => s + c.weight, 0);
          const target = 40;
          const topics: string[] = [];
          TEST_PLAN_CATEGORIES.forEach(cat => {
            const n = Math.max(1, Math.round((cat.weight / totalWeight) * target));
            topics.push(...cat.topics.slice(0, n));
          });
          setCtTopics([...new Set(topics)]);
          setCtQuestionCount(40);
          setCtFormats([]);
          setCtMode('manual');
        };

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-200">
                <h3 className="text-lg font-bold text-gray-900 tracking-wide">CREATE TEST</h3>
                <button onClick={closeModal} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* STEP INDICATOR */}
              {isPractice && (
                <div className="flex border-b border-gray-100 bg-gray-50 px-6 py-2 gap-6">
                  {[{n:1,label:'Settings'},{n:2,label: ctOrganization === 'clientNeed' ? 'Choose Test Plans' : 'Choose Subjects'}].map(s => (
                    <button key={s.n} onClick={() => s.n === 1 && setCtStep(1)}
                      className={`flex items-center gap-1.5 text-xs font-bold pb-1 border-b-2 transition-colors ${
                        ctStep === s.n ? 'border-[#17a2b8] text-[#17a2b8]' : 'border-transparent text-gray-400'
                      }`}>
                      <span className={`w-4 h-4 rounded-full text-[10px] flex items-center justify-center font-black ${ctStep === s.n ? 'bg-[#17a2b8] text-white' : 'bg-gray-200 text-gray-500'}`}>{s.n}</span>
                      {s.label}
                    </button>
                  ))}
                </div>
              )}

              {/* ── STEP 1: Settings ── */}
              {(!isPractice || ctStep === 1) && (
              <div className="px-6 py-5 space-y-6 max-h-[68vh] overflow-y-auto">

                {/* Q-BANK MODE */}
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">Q-BANK MODE</p>
                  <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { type: 'CAT',      label: 'CAT (Adaptive Test)', icon: Brain,    locked: !isPremium },
                        { type: 'TUTORIAL', label: 'Tutorial',            icon: BookOpen, locked: false },
                      ].map(m => {
                        const active = ctExamType === m.type;
                        return (
                          <div key={m.type} className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <m.icon className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                              <span className={`text-xs truncate ${m.locked ? 'text-gray-400' : 'text-gray-700'}`}>{m.label}</span>
                            </div>
                            <button
                              onClick={() => !m.locked && setCtExamType(m.type)}
                              disabled={m.locked}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                                active && !m.locked ? 'bg-[#17a2b8]' : 'bg-gray-200'
                              } ${m.locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                              <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${active && !m.locked ? 'translate-x-4' : 'translate-x-0'}`} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-3 border-t border-gray-100">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => isPremium && setCtExamType('READINESS_ASSESSMENT')}
                          disabled={!isPremium}
                          className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                            ctExamType === 'READINESS_ASSESSMENT' && isPremium ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
                          } ${!isPremium ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}>
                          {ctExamType === 'READINESS_ASSESSMENT' && isPremium && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                          )}
                        </button>
                        <span className={`text-xs font-semibold ${!isPremium ? 'text-gray-400' : 'text-orange-600'}`}>Readiness Assessment</span>
                        <span className="w-4 h-4 rounded-full bg-[#17a2b8] text-white text-[9px] flex items-center justify-center font-bold flex-shrink-0 cursor-default" title="Assess your NCLEX readiness with 85 questions">i</span>
                        {!isPremium && <Lock className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <Trophy className="h-3.5 w-3.5 text-gray-500 flex-shrink-0" />
                          <span className={`text-xs ${!data?.exitAccess ? 'text-gray-400' : 'text-gray-700'}`}>GritSync Exit Exam</span>
                          {!data?.exitAccess && <Lock className="h-3 w-3 text-gray-400 flex-shrink-0" />}
                        </div>
                        <div
                          className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${
                            ctExamType === 'EXIT_EXAM' && data?.exitAccess ? 'bg-[#17a2b8]' : 'bg-gray-200'
                          } ${!data?.exitAccess ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                          onClick={() => data?.exitAccess && setCtExamType('EXIT_EXAM')}>
                          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${ctExamType === 'EXIT_EXAM' && data?.exitAccess ? 'translate-x-4' : 'translate-x-0'}`} />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Mode description card */}
                  <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
                    <div className="bg-[#17a2b8] text-white px-3 py-1.5 inline-block">
                      <span className="text-xs font-bold">
                        {ctExamType === 'TUTORIAL' ? 'Tutorial' : ctExamType === 'CAT' ? 'CAT' : ctExamType === 'READINESS_ASSESSMENT' ? 'Readiness Assessment' : 'Exit Exam'}
                      </span>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm text-gray-600">{MODE_DESCS[ctExamType]}</p>
                    </div>
                  </div>
                </div>

                {/* TEST TYPE */}
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">TEST TYPE</p>
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="flex gap-8">
                      {[{v:'CLASSIC',l:'Classic'},{v:'NGN',l:'NGN'},{v:'',l:'Mixed'}].map(opt => (
                        <label key={opt.v} className="flex items-center gap-2 cursor-pointer" onClick={() => setCtBank(opt.v)}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${ctBank === opt.v ? 'border-[#17a2b8]' : 'border-gray-400'}`}>
                            {ctBank === opt.v && <div className="w-2 h-2 rounded-full bg-[#17a2b8]" />}
                          </div>
                          <span className="text-sm text-gray-700">{opt.l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* ORGANIZATION */}
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">ORGANIZATION</p>
                  <div className="border border-gray-200 rounded-xl p-4">
                    <div className="flex gap-8">
                      {[{v:'subject',l:'Subject or System'},{v:'clientNeed',l:'Client Need Areas'}].map(opt => (
                        <label key={opt.v} className="flex items-center gap-2 cursor-pointer" onClick={() => { setCtOrganization(opt.v); setCtTopics([]); }}>
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${ctOrganization === opt.v ? 'border-[#17a2b8]' : 'border-gray-400'}`}>
                            {ctOrganization === opt.v && <div className="w-2 h-2 rounded-full bg-[#17a2b8]" />}
                          </div>
                          <span className="text-sm text-gray-700">{opt.l}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* QUESTION TYPES */}
                <div>
                  <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-3">QUESTION TYPES</p>
                  <div className="border border-gray-200 rounded-xl p-4 space-y-4">
                    <div className="flex flex-wrap gap-2">
                      {[
                        { v:'all',         l:`All (${(classic+ngn).toLocaleString()})` },
                        { v:'SATA',        l:`SATA (${sataCnt.toLocaleString()})` },
                        { v:'UNFOLDING',   l:'Unfolding NGN Case Studies' },
                        { v:'STANDALONE',  l:'Standalone NGN Case Studies' },
                      ].map(p => (
                        <button key={p.v} onClick={() => setCtFormatFilter(p.v)}
                          className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                            ctFormatFilter === p.v ? 'bg-[#17a2b8] text-white border-[#17a2b8]' : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
                          }`}>{p.l}</button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                      {[
                        { v:'unused',          l:'Unused',             count:`${unusedC.toLocaleString()} Classic + ${unusedN.toLocaleString()} NGN` },
                        { v:'marked',          l:'Marked',             count:'0' },
                        { v:'incorrect',       l:'Incorrect',          count:'' },
                        { v:'all',             l:'All',                count:`${classic.toLocaleString()} Classic + ${ngn.toLocaleString()} NGN` },
                        { v:'correct_reattempt',l:'Correct On Reattempt',count:'' },
                        { v:'omitted',         l:'Omitted',            count:'0' },
                        { v:'custom',          l:'Custom',             count:'' },
                      ].map(opt => (
                        <label key={opt.v} className="flex items-start gap-2 cursor-pointer" onClick={() => setCtQuestionFilter(opt.v)}>
                          <div className={`w-4 h-4 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${ctQuestionFilter === opt.v ? 'border-[#17a2b8]' : 'border-gray-400'}`}>
                            {ctQuestionFilter === opt.v && <div className="w-2 h-2 rounded-full bg-[#17a2b8]" />}
                          </div>
                          <div className="min-w-0">
                            <span className="text-sm text-gray-700">{opt.l}</span>
                            {opt.count && <span className="ml-1.5 text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded font-mono">{opt.count}</span>}
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>

                {/* TEST LENGTH — Tutorial only. For FREE users the max is
                    capped at the remaining daily quota (25/day total).
                    Premium/VIP get the standard 150-item ceiling. */}
                {(() => {
                  const dailyCap = 25
                  const remainingToday = Math.max(0, dailyCap - questionsToday)
                  const maxLen = isPremium ? 150 : remainingToday
                  const dailyExhausted = !isPremium && remainingToday === 0
                  const clamped = Math.min(Math.max(1, ctQuestionCount), Math.max(1, maxLen))
                  // Clamp the actual state so the request body matches the
                  // displayed value when the user hits Start.
                  if (ctQuestionCount !== clamped && !dailyExhausted) {
                    setTimeout(() => setCtQuestionCount(clamped), 0)
                  }
                  return (
                    <div>
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-1">TEST LENGTH</p>
                      <p className="text-xs text-gray-400 mb-3">
                        Number of questions per test (
                        {isPremium
                          ? 'maximum of 150'
                          : dailyExhausted
                            ? `daily limit reached — ${questionsToday}/${dailyCap} used`
                            : `Free plan: up to ${remainingToday} left today, ${questionsToday}/${dailyCap} used`}
                        )
                      </p>
                      <div className={`border rounded-xl p-4 ${dailyExhausted ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
                        <input
                          type="number"
                          min={1}
                          max={maxLen || 1}
                          value={ctQuestionCount}
                          disabled={dailyExhausted}
                          onChange={(e) => {
                            const v = parseInt(e.target.value)
                            if (!isNaN(v) && v > 0) setCtQuestionCount(Math.min(v, maxLen))
                          }}
                          className="w-32 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-semibold text-gray-900 focus:outline-none focus:border-[#17a2b8] focus:ring-1 focus:ring-[#17a2b8] disabled:bg-gray-100 disabled:cursor-not-allowed"
                        />
                        {dailyExhausted && (
                          <p className="mt-2 text-xs text-red-700">
                            You've answered {dailyCap} questions today on the Free plan. Upgrade to Premium for unlimited access, or come back tomorrow.
                          </p>
                        )}
                      </div>
                    </div>
                  )
                })()}

              </div>
              )}

              {/* ── STEP 2: Choose Subjects / Test Plans (Tutorial only) ── */}
              {isPractice && ctStep === 2 && (
                <div className="px-6 py-5 max-h-[68vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <p className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                        {ctOrganization === 'clientNeed' ? 'CHOOSE TEST PLANS' : 'CHOOSE SUBJECTS'}
                      </p>
                      <span className="text-[11px] text-red-500 font-medium">
                        * Please select a {ctOrganization === 'clientNeed' ? 'test plan' : 'subject'} to proceed
                      </span>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer" onClick={toggleAllGroups}>
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${allGroupsSelected ? 'bg-[#17a2b8] border-[#17a2b8]' : 'border-gray-300'}`}>
                        {allGroupsSelected && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </div>
                      <span className="text-xs text-gray-600">Select all</span>
                    </label>
                  </div>
                  <div className="mt-4 bg-[#eef6fb] border border-[#cce6f4] rounded-xl overflow-hidden">
                    <div className="grid grid-cols-2">
                      {activeGroups.map((group, i) => {
                        const cnt = getGroupCount(group.topics);
                        const sel = isGroupSelected(group.topics);
                        const par = isGroupPartial(group.topics);
                        const isLastOdd = i === activeGroups.length - 1 && activeGroups.length % 2 !== 0;
                        return (
                          <button key={group.name} onClick={() => toggleGroup(group.topics)}
                            className={`flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/60 transition-colors border-b border-r border-[#cce6f4]/60 ${isLastOdd ? 'col-span-2' : ''}`}>
                            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${sel ? 'bg-[#17a2b8] border-[#17a2b8]' : par ? 'border-[#17a2b8]' : 'border-gray-400'}`}>
                              {sel && <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                              {par && !sel && <div className="w-1.5 h-1.5 rounded-sm bg-[#17a2b8]" />}
                            </div>
                            <span className="flex-1 text-sm text-gray-700 font-medium leading-tight">{group.name}</span>
                            <span className="text-xs text-gray-400 tabular-nums border border-gray-300 bg-white rounded px-1.5 py-0.5 font-mono">{cnt || 0}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                {ctStep === 1 || !isPractice ? (
                  <button onClick={closeModal}
                    className="px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                    Cancel
                  </button>
                ) : (
                  <button onClick={() => setCtStep(1)}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
                    <ChevronLeft className="h-4 w-4" /> Prev
                  </button>
                )}
                {ctStep === 1 ? (
                  <button
                    onClick={() => {
                      if (isPractice) { setCtStep(2); }
                      else {
                        closeModal();
                        handleStart(ctExamType, ctBank, { questionCount: ctQuestionCount });
                      }
                    }}
                    disabled={!!starting}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#17a2b8] text-white text-sm font-bold hover:bg-[#138fa3] disabled:opacity-60 transition-colors">
                    {starting
                      ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : <>Next <ChevronRight className="h-4 w-4" /></>}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      if (ctTopics.length === 0) {
                        toast.error(`Please select at least one ${ctOrganization === 'clientNeed' ? 'test plan' : 'subject'}.`);
                        return;
                      }
                      closeModal();
                      handleStart(ctExamType, ctBank, { questionCount: ctQuestionCount, topics: ctTopics, formats: ctFormats });
                    }}
                    disabled={!!starting || ctTopics.length === 0}
                    className="flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-[#17a2b8] text-white text-sm font-bold hover:bg-[#138fa3] disabled:opacity-60 transition-colors">
                    {starting
                      ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      : 'Create Test'}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Bank selection modal */}
      {bankPick && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="text-lg font-bold text-gray-900 mb-1">Select Question Bank</h3>
            <p className="text-sm text-gray-500 mb-5">Choose your question bank.</p>
            <div className="space-y-3 mb-6">
              {[
                { value: 'CLASSIC', label: 'Classic', desc: `Traditional MCQ/SATA · ${classic.toLocaleString()} Qs` },
                { value: 'NGN', label: 'NGN (Next Gen)', desc: `Next Generation NCLEX · ${ngn.toLocaleString()} Qs` },
                { value: '', label: 'Mixed', desc: `Both banks · ${(classic + ngn).toLocaleString()} Qs` },
              ].map(opt => (
                <button key={opt.value} onClick={() => setSelectedBank(opt.value)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${selectedBank === opt.value ? 'border-[#0c1e3c] bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedBank === opt.value ? 'border-[#0c1e3c]' : 'border-gray-300'}`}>
                    {selectedBank === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-[#0c1e3c]" />}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-gray-900">{opt.label}</p>
                    <p className="text-xs text-gray-500">{opt.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setBankPick(null)} className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
              <button onClick={() => handleStart(bankPick, selectedBank)} disabled={!!starting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#0c1e3c] text-white text-sm font-semibold hover:bg-[#1a3058] disabled:opacity-60 flex items-center justify-center gap-2">
                {starting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Play className="h-4 w-4" />}
                Start Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upgrade modal */}
      {upgradeModal && (() => {
        const targetPlan = planConfig?.plans.find(p => p.id === upgradeTargetPlan && p.isActive)
          ?? planConfig?.plans.find(p => p.price > 0 && p.isActive);
        const premiumPlan = targetPlan;
        const price = premiumPlan?.price ?? 300;
        const durationLabel = premiumPlan?.durationDays ? `${premiumPlan.durationDays} days` : '2 months';
        const gcashNum = planConfig?.gcashNumber;
        const gcashAcct = planConfig?.gcashName;
        const bdoNum = planConfig?.bdoNumber;
        const bdoAcct = planConfig?.bdoName;
        const instructions = planConfig?.paymentInstructions ?? '';

        // review.gritsync.com uses Stripe as the primary payment method.
        // Stripe is always shown (it works as long as the admin has set a
        // publishable key). GCash/BDO appear only when explicitly configured.
        const ALL_METHODS: Array<{ id: PaymentMethod; label: string; color: string; available: boolean }> = [
          { id: 'stripe', label: 'Card / Stripe', color: 'bg-purple-600', available: true },
          { id: 'gcash', label: 'GCash', color: 'bg-blue-500', available: !!gcashNum },
          { id: 'bdo', label: 'BDO', color: 'bg-green-600', available: !!bdoNum },
        ];
        const METHODS = ALL_METHODS.filter(m => m.available);

        return (
          <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md my-8">
              {/* Header */}
              <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
                <h3 className="text-lg font-bold text-gray-900">Upgrade to {premiumPlan?.name ?? (upgradeTargetPlan === 'vip' ? 'VIP' : 'Premium')}</h3>
                <button onClick={() => setUpgradeModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg"><X className="h-5 w-5" /></button>
              </div>

              <div className="p-6 space-y-5">
                {/* Price banner */}
                <div className="bg-[#0c1e3c] rounded-xl p-4 text-center">
                  <p className="text-3xl font-black text-white mb-0.5">₱{price.toLocaleString()}</p>
                  <p className="text-blue-200 text-sm">{durationLabel} full access</p>
                  <div className="mt-2 flex flex-wrap justify-center gap-x-4">
                    {premiumPlan?.features.slice(0, 3).map((f, i) => {
                      const { name } = planIncluded(f as string | PlanFeature);
                      return <p key={i} className="text-blue-300 text-xs">✓ {name}</p>;
                    })}
                  </div>
                </div>

                {/* Payment method selector */}
                <div>
                  <p className="text-xs font-bold text-gray-500 mb-2 uppercase tracking-wide">Payment Method</p>
                  <div className="flex gap-2">
                    {METHODS.map(m => (
                      <button key={m.id} onClick={() => setUpgradeMethod(m.id)}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${
                          upgradeMethod === m.id
                            ? `${m.color} text-white border-transparent`
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
                        } ${!m.available ? 'opacity-50 cursor-not-allowed' : ''}`}
                        disabled={!m.available}>
                        {m.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* GCash details */}
                {upgradeMethod === 'gcash' && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-bold text-blue-800">Send to GCash:</p>
                    {instructions && <p className="text-xs text-blue-700 whitespace-pre-line">{instructions}</p>}
                    <div className="bg-white rounded-lg p-3 border border-blue-200">
                      <p className="text-xs text-blue-500 mb-0.5">GCash Number</p>
                      <p className="text-lg font-black text-blue-900 tracking-wide">{gcashNum || '—'}</p>
                      <p className="text-xs text-blue-600">{gcashAcct || ''}</p>
                    </div>
                    <p className="text-xs text-blue-600">After sending, enter your reference number and upload the screenshot below.</p>
                  </div>
                )}

                {/* BDO details */}
                {upgradeMethod === 'bdo' && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-2">
                    <p className="text-sm font-bold text-green-800">Send to BDO:</p>
                    {instructions && <p className="text-xs text-green-700 whitespace-pre-line">{instructions}</p>}
                    <div className="bg-white rounded-lg p-3 border border-green-200">
                      <p className="text-xs text-green-500 mb-0.5">BDO Account Number</p>
                      <p className="text-lg font-black text-green-900 tracking-wide">{bdoNum || '—'}</p>
                      <p className="text-xs text-green-600">{bdoAcct || ''}</p>
                    </div>
                    <p className="text-xs text-green-600">After transfer, enter your reference number and upload the receipt below.</p>
                  </div>
                )}

                {/* Stripe — real card payment via Stripe Elements */}
                {upgradeMethod === 'stripe' && (() => {
                  const pk = planConfig?.stripePublishableKey || (import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined);
                  if (!pk) {
                    return (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-xs text-purple-700">
                        Stripe is not configured — ask an admin to set a publishable key in NCLEX → Plans.
                      </div>
                    );
                  }
                  if (!stripePromiseRef.current) stripePromiseRef.current = loadStripe(pk);
                  if (stripeError) {
                    return (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-xs text-red-700">{stripeError}</div>
                    );
                  }
                  if (stripeLoading || !stripeClientSecret || !stripePaymentIntentId) {
                    return (
                      <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-xs text-purple-700 flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border-2 border-purple-300 border-t-purple-700 animate-spin" />
                        Preparing secure payment…
                      </div>
                    );
                  }
                  return (
                    <Elements stripe={stripePromiseRef.current} options={{ clientSecret: stripeClientSecret, appearance: { theme: 'stripe' } }}>
                      <StripeUpgradeForm
                        paymentIntentId={stripePaymentIntentId}
                        clientSecret={stripeClientSecret}
                        onSuccess={async () => {
                          try {
                            await nclexApi.confirmStripeUpgrade(stripePaymentIntentId);
                            setUpgradeModal(false);
                            setStripeClientSecret(null);
                            setStripePaymentIntentId(null);
                            toast.success('Payment received — premium access granted.');
                            window.location.reload();
                          } catch (err: any) {
                            toast.error(err?.response?.data?.error || 'Payment confirmed but upgrade could not be finalised. Contact support.');
                          }
                        }}
                        onError={(msg) => setStripeError(msg)}
                      />
                    </Elements>
                  );
                })()}

                {/* Reference number */}
                {upgradeMethod !== 'stripe' && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Payment Reference Number *</label>
                    <input value={upgradeRef} onChange={e => setUpgradeRef(e.target.value)}
                      placeholder={upgradeMethod === 'gcash' ? 'e.g. GCash Ref #20250501-123456' : 'e.g. BDO Ref #20250501-789012'}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                )}

                {/* Receipt upload */}
                {(upgradeMethod === 'gcash' || upgradeMethod === 'bdo') && (
                  <div>
                    <label className="block text-xs font-bold text-gray-600 mb-1">Upload Receipt Screenshot *</label>
                    <label className={`flex flex-col items-center justify-center gap-2 w-full border-2 border-dashed rounded-xl py-4 cursor-pointer transition-colors ${
                      upgradeReceipt ? 'border-green-400 bg-green-50' : 'border-gray-300 hover:border-blue-400 bg-gray-50 hover:bg-blue-50'
                    }`}>
                      <input type="file" className="hidden" accept="image/*,.pdf"
                        onChange={e => setUpgradeReceipt(e.target.files?.[0] ?? null)} />
                      {upgradeReceipt ? (
                        <>
                          <CheckCircle className="h-6 w-6 text-green-500" />
                          <p className="text-xs font-semibold text-green-700">{upgradeReceipt.name}</p>
                          <p className="text-xs text-green-500">Click to change</p>
                        </>
                      ) : (
                        <>
                          <FileText className="h-6 w-6 text-gray-400" />
                          <p className="text-xs text-gray-500">Click to upload receipt (JPG, PNG, PDF)</p>
                        </>
                      )}
                    </label>
                  </div>
                )}

                {/* Actions — Stripe has its own inline "Pay now" inside StripeUpgradeForm */}
                <div className="flex gap-3 pt-1">
                  <button onClick={() => setUpgradeModal(false)} className="flex-1 px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50">
                    {upgradeMethod === 'stripe' ? 'Close' : 'Cancel'}
                  </button>
                  {upgradeMethod !== 'stripe' && (
                    <button onClick={submitUpgrade} disabled={upgradeSending}
                      className="flex-1 px-4 py-2.5 bg-[#0c1e3c] text-white rounded-xl text-sm font-semibold hover:bg-[#1a3058] disabled:opacity-50 flex items-center justify-center gap-2">
                      {upgradeSending ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Send className="h-4 w-4" />}
                      Submit Request
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

// ── StripeUpgradeForm ──────────────────────────────────────────────────────
// Confirms the PaymentIntent that NclexHome created. Lives inside the
// <Elements> provider so `useStripe()` / `useElements()` resolve. On success,
// the parent's onSuccess() finalises the upgrade by calling
// /api/nclex/confirm-stripe-upgrade.
function StripeUpgradeForm({
  paymentIntentId,
  clientSecret,
  onSuccess,
  onError,
}: {
  paymentIntentId: string;
  clientSecret: string;
  onSuccess: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    const { error: submitErr } = await elements.submit();
    if (submitErr) { onError(submitErr.message || 'Card validation failed'); return; }

    setSubmitting(true);
    try {
      const { error: confirmErr, paymentIntent } = await stripe.confirmPayment({
        elements,
        clientSecret,
        confirmParams: { return_url: `${window.location.origin}/?upgrade=stripe_return&intent=${paymentIntentId}` },
        redirect: 'if_required',
      });
      if (confirmErr) { onError(confirmErr.message || 'Payment failed'); setSubmitting(false); return; }
      if (paymentIntent?.status === 'succeeded') {
        await onSuccess();
      } else if (paymentIntent?.status === 'requires_action') {
        onError('Additional authentication required. Please retry.');
        setSubmitting(false);
      } else {
        onError(`Payment ${paymentIntent?.status || 'failed'}. Please try again.`);
        setSubmitting(false);
      }
    } catch (err: any) {
      onError(err?.message || 'Unexpected payment error');
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-purple-50/40 border border-purple-200 rounded-xl p-4 space-y-3">
      <p className="text-sm font-bold text-purple-800">Pay with card</p>
      <PaymentElement options={{ layout: 'tabs' }} />
      <button
        type="submit"
        disabled={!stripe || !elements || submitting}
        className="w-full px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
      >
        {submitting && <span className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />}
        {submitting ? 'Confirming payment…' : 'Pay now'}
      </button>
      <p className="text-[11px] text-purple-600/80 text-center">Secured by Stripe. Your card details never touch our servers.</p>
    </form>
  );
}
