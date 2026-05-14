import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  CheckCircle, XCircle, BookOpen, Trophy, Brain, Target,
  TrendingUp, BarChart3, Clock, ChevronRight, ArrowLeft,
} from 'lucide-react';
import { NclexLayout } from '../../components/layout/NclexLayout';
import { nclexApi } from '../../services/api';

interface CategoryBreakdown { topic: string; correct: number; total: number; percent?: number }
interface Result {
  examType: string;
  totalItems: number;
  correctCount?: number;
  percentCorrect?: number;
  readiness?: string;
  passed: boolean;
  finalTheta?: number;
  standardError?: number;
  stopReason?: string;
  categoryBreakdown?: CategoryBreakdown[];
  timeSpent?: number;
}
interface Session {
  id: string; examType: string; status: string;
  startedAt: string; completedAt?: string;
  correctCount: number; result: Result | null;
}

const READINESS_CONFIG: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  'Low': { label: 'Low', color: 'text-red-700', bg: 'bg-red-50 border-red-200', desc: 'Additional study is strongly recommended before sitting for NCLEX.' },
  'Near Passing': { label: 'Near Passing', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', desc: 'You are approaching readiness. Focus on your weak areas.' },
  'Approaching': { label: 'Approaching', color: 'text-yellow-700', bg: 'bg-yellow-50 border-yellow-200', desc: 'You are making good progress. Keep reviewing clinical topics.' },
  'High': { label: 'High', color: 'text-green-700', bg: 'bg-green-50 border-green-200', desc: 'You demonstrate strong readiness for the NCLEX examination.' },
  'Very High': { label: 'Very High', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', desc: 'Excellent performance! You have a >98% predicted passing rate.' },
};

export const NclexResults = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    nclexApi.getSession(sessionId)
      .then(r => setSession(r.data.data.session))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return (
    <NclexLayout>
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-600 border-t-transparent" />
      </div>
    </NclexLayout>
  );

  if (!session || session.status === 'IN_PROGRESS') {
    navigate(`/nclex/exam/${sessionId}`, { replace: true });
    return null;
  }

  const result = session.result;
  if (!result) return (
    <NclexLayout backTo="/nclex">
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">No results found for this session.</p>
        <button onClick={() => navigate('/nclex')} className="mt-4 text-blue-600 underline text-sm">Return home</button>
      </div>
    </NclexLayout>
  );

  const isRA = result.examType === 'READINESS_ASSESSMENT';
  const isCAT = result.examType === 'CAT';
  const isExit = result.examType === 'EXIT_EXAM';
  const readinessConf = isRA && result.readiness ? READINESS_CONFIG[result.readiness] : null;

  const duration = session.completedAt
    ? Math.floor((new Date(session.completedAt).getTime() - new Date(session.startedAt).getTime()) / 1000)
    : null;

  const formatDuration = (s: number): string => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s % 60}s`;
  };

  return (
    <NclexLayout backTo="/nclex">
      <div className="max-w-3xl mx-auto px-4 py-8">
        {/* Header */}
        <button onClick={() => navigate('/nclex')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
          <ArrowLeft className="h-4 w-4" /> Back to Home
        </button>

        {/* Main result card */}
        <div className={`rounded-2xl border-2 p-6 mb-6 ${result.passed ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-4 mb-4">
            <div className={`h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0 ${result.passed ? 'bg-green-100' : 'bg-red-100'}`}>
              {result.passed
                ? <CheckCircle className="h-9 w-9 text-green-600" />
                : <XCircle className="h-9 w-9 text-red-500" />}
            </div>
            <div>
              <h1 className={`text-2xl font-black ${result.passed ? 'text-green-700' : 'text-red-700'}`}>
                {isRA ? (readinessConf?.label ?? 'Complete') :
                 isCAT ? (result.passed ? 'PASS' : 'FAIL') :
                 result.passed ? 'Passed' : 'Not Passing'}
              </h1>
              <p className={`text-sm ${result.passed ? 'text-green-600' : 'text-red-500'}`}>
                {isRA ? 'Readiness Assessment' :
                 isCAT ? 'CAT Adaptive Test' :
                 isExit ? 'GritSync Exit Exam' : 'Tutorial'}
                {' '}Complete
              </p>
            </div>
          </div>
          {readinessConf && (
            <p className="text-sm text-gray-700">{readinessConf.desc}</p>
          )}
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-black text-gray-900">{result.totalItems}</p>
            <p className="text-xs text-gray-500 mt-0.5">Items Delivered</p>
          </div>

          {(isRA || isExit) && result.percentCorrect !== undefined && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-black text-blue-600">{result.percentCorrect.toFixed(1)}%</p>
                <p className="text-xs text-gray-500 mt-0.5">Score</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-black text-green-600">{result.correctCount}</p>
                <p className="text-xs text-gray-500 mt-0.5">Correct</p>
              </div>
            </>
          )}

          {isCAT && result.finalTheta !== undefined && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-black text-purple-600">{result.finalTheta.toFixed(2)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Final θ (Ability)</p>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
                <p className="text-2xl font-black text-gray-700">{result.standardError?.toFixed(3)}</p>
                <p className="text-xs text-gray-500 mt-0.5">Std Error</p>
              </div>
            </>
          )}

          {duration !== null && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 text-center">
              <p className="text-2xl font-black text-gray-700 flex items-center justify-center gap-1">
                <Clock className="h-5 w-5 text-gray-400" />
                <span>{formatDuration(duration)}</span>
              </p>
              <p className="text-xs text-gray-500 mt-0.5">Time Spent</p>
            </div>
          )}
        </div>

        {/* CAT info */}
        {isCAT && result.stopReason && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 flex items-start gap-3">
            <Brain className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-blue-800 text-sm">Why the exam ended</p>
              <p className="text-sm text-blue-700 mt-1">
                {result.stopReason === 'SE_THRESHOLD'
                  ? 'The CAT algorithm determined your ability estimate with sufficient confidence (Standard Error < 0.4).'
                  : result.stopReason === 'MAX_ITEMS'
                  ? 'The maximum number of items (150) was reached.'
                  : 'Minimum items delivered with confident estimate.'}
              </p>
              <p className="text-sm text-blue-600 mt-1">
                {result.passed
                  ? '✓ Your estimated ability (θ ≥ 0.0) exceeded the passing standard.'
                  : '✗ Your estimated ability (θ < 0.0) did not meet the passing standard.'}
              </p>
            </div>
          </div>
        )}

        {/* Category breakdown */}
        {result.categoryBreakdown && result.categoryBreakdown.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 className="h-5 w-5 text-blue-600" />
              <h2 className="font-bold text-gray-900">Performance by Topic</h2>
            </div>
            <div className="space-y-3">
              {[...result.categoryBreakdown]
                .sort((a, b) => (a.percent ?? 0) - (b.percent ?? 0))
                .map(cat => {
                  const pct = cat.percent ?? (cat.total > 0 ? Math.round((cat.correct / cat.total) * 100) : 0);
                  return (
                    <div key={cat.topic}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="text-gray-700 font-medium">{cat.topic}</span>
                        <span className={`font-semibold ${pct >= 70 ? 'text-green-600' : pct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                          {cat.correct}/{cat.total} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${pct >= 70 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Exit exam insights */}
        {isExit && result.categoryBreakdown && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Trophy className="h-5 w-5 text-amber-600" />
              <h2 className="font-bold text-amber-900">Exit Exam Insights</h2>
            </div>
            <ul className="space-y-2 text-sm text-amber-800">
              {result.categoryBreakdown
                .filter(c => (c.percent ?? 0) < 60)
                .map(c => (
                  <li key={c.topic} className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 flex-shrink-0" />
                    Focus on <strong>{c.topic}</strong> — only {c.percent ?? Math.round((c.correct / c.total) * 100)}% correct
                  </li>
                ))}
              {result.categoryBreakdown.filter(c => (c.percent ?? 0) < 60).length === 0 && (
                <li className="text-amber-700">Outstanding performance across all topics!</li>
              )}
            </ul>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={() => navigate(`/nclex/review/${sessionId}`)}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl border-2 border-blue-600 text-blue-600 font-semibold hover:bg-blue-50 transition-colors"
          >
            <BookOpen className="h-4 w-4" /> Review Questions
          </button>
          <button
            onClick={() => navigate('/nclex')}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-blue-600 text-white font-semibold hover:bg-blue-700 transition-colors"
          >
            <TrendingUp className="h-4 w-4" /> Take Another Exam
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Exam type specific icons */}
        <div className="mt-8 flex items-center justify-center gap-2 text-gray-300">
          {isRA && <><Target className="h-4 w-4" /> <span className="text-xs">Readiness Assessment</span></>}
          {isCAT && <><Brain className="h-4 w-4" /> <span className="text-xs">Computerized Adaptive Testing</span></>}
          {isExit && <><Trophy className="h-4 w-4" /> <span className="text-xs">GritSync Exit Exam</span></>}
        </div>
      </div>
    </NclexLayout>
  );
};
