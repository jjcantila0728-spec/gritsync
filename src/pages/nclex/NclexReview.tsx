import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, XCircle, BookOpen } from 'lucide-react';
import { NclexLayout } from '../../components/layout/NclexLayout';
import { nclexApi } from '../../services/api';

interface Option { id: string; text: string }
interface CaseStudy { title: string; scenario: string; tabs: Array<{ label: string; content: string }>; caseType: string }
interface Question {
  id: string; format: string; stem: string; options: unknown;
  correctAnswer: unknown; rationale: string; topic?: string; caseStudy?: CaseStudy | null;
}
interface SessionItem {
  id: string; itemIndex: number; response: unknown; isCorrect: boolean | null;
  question: Question;
}
interface Session {
  id: string; examType: string; status: string; result: unknown;
  items: SessionItem[];
}

const formatResponse = (_format: string, response: unknown): string => {
  if (response === null || response === undefined) return '(not answered)';
  if (Array.isArray(response)) return response.join(', ') || '(none selected)';
  if (typeof response === 'object') return JSON.stringify(response);
  return String(response);
};

const formatCorrectAnswer = (_format: string, answer: unknown): string => {
  if (Array.isArray(answer)) return answer.join(', ');
  if (typeof answer === 'object' && answer !== null) {
    const obj = answer as Record<string, unknown>;
    if ('value' in obj) return `${obj.value}${obj.unit ? ' ' + obj.unit : ''}`;
    if ('leftIds' in obj) return `Left: ${(obj.leftIds as string[]).join(', ')} | Right: ${(obj.rightIds as string[]).join(', ')}`;
    return JSON.stringify(answer);
  }
  return String(answer);
};

export const NclexReview = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const [showRationale, setShowRationale] = useState(true);
  const [filter, setFilter] = useState<'all' | 'correct' | 'incorrect'>('all');

  useEffect(() => {
    if (!sessionId) return;
    nclexApi.getSessionReview(sessionId)
      .then(r => setSession(r.data.data))
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

  if (!session) return (
    <NclexLayout backTo="/nclex">
      <div className="max-w-2xl mx-auto px-4 py-12 text-center">
        <p className="text-gray-500">Session not found.</p>
        <button onClick={() => navigate('/nclex')} className="mt-4 text-blue-600 underline text-sm">Return home</button>
      </div>
    </NclexLayout>
  );

  const filteredItems = session.items.filter(item => {
    if (filter === 'correct') return item.isCorrect === true;
    if (filter === 'incorrect') return item.isCorrect === false;
    return true;
  });

  const currentItem = filteredItems[currentIdx];
  if (!currentItem && filteredItems.length > 0) {
    setCurrentIdx(0);
    return null;
  }

  const correct = session.items.filter(i => i.isCorrect).length;
  const total = session.items.filter(i => i.isCorrect !== null).length;

  return (
    <NclexLayout backTo={`/nclex/results/${sessionId}`}>
      <div className="flex h-[calc(100vh-56px)] overflow-hidden">
        {/* Left panel — item list */}
        <div className="w-64 bg-white border-r border-gray-200 flex-shrink-0 flex flex-col hidden lg:flex">
          <div className="p-3 border-b border-gray-200">
            <p className="text-xs font-bold text-gray-700 mb-2">REVIEW: {total} ITEMS</p>
            <p className="text-xs text-gray-500 mb-2">{correct}/{total} correct ({total > 0 ? Math.round((correct / total) * 100) : 0}%)</p>
            <div className="flex gap-1">
              {(['all', 'correct', 'incorrect'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => { setFilter(f); setCurrentIdx(0); }}
                  className={`flex-1 py-1 text-xs rounded font-medium transition-colors ${
                    filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f === 'all' ? 'All' : f === 'correct' ? '✓' : '✗'}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-y-auto py-2">
            {filteredItems.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setCurrentIdx(i)}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left transition-colors ${
                  i === currentIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                  item.isCorrect === true ? 'bg-green-100' : item.isCorrect === false ? 'bg-red-100' : 'bg-gray-100'
                }`}>
                  {item.isCorrect === true
                    ? <CheckCircle className="h-3.5 w-3.5 text-green-600" />
                    : item.isCorrect === false
                    ? <XCircle className="h-3.5 w-3.5 text-red-500" />
                    : <span className="text-xs text-gray-400">-</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-semibold ${i === currentIdx ? 'text-blue-700' : 'text-gray-700'}`}>
                    Item {item.itemIndex + 1}
                  </p>
                  {item.question.topic && (
                    <p className="text-xs text-gray-400 truncate">{item.question.topic}</p>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Main review area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Top bar */}
          <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between flex-shrink-0">
            <button onClick={() => navigate(`/nclex/results/${sessionId}`)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700">
              <ArrowLeft className="h-4 w-4" /> Results
            </button>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>{currentIdx + 1} / {filteredItems.length}</span>
              {currentItem && (
                <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                  currentItem.isCorrect ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                }`}>
                  {currentItem.isCorrect ? '✓ Correct' : '✗ Incorrect'}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowRationale(r => !r)}
                className={`text-xs px-3 py-1.5 rounded-lg font-medium border transition-colors ${
                  showRationale ? 'bg-blue-50 border-blue-300 text-blue-700' : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                }`}
              >
                <BookOpen className="h-3.5 w-3.5 inline mr-1" />
                Rationale
              </button>
            </div>
          </div>

          {!currentItem ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">
              <p>No items to review.</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-3xl mx-auto px-6 py-6">
                {/* Case study */}
                {currentItem.question.caseStudy && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl mb-4">
                    <div className="flex border-b border-blue-200 overflow-x-auto">
                      {[
                        { label: 'Scenario', content: currentItem.question.caseStudy.scenario },
                        ...(currentItem.question.caseStudy.tabs ?? []),
                      ].map((tab, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveTab(i)}
                          className={`px-4 py-2 text-xs font-semibold whitespace-nowrap flex-shrink-0 transition-colors ${
                            activeTab === i ? 'text-blue-700 border-b-2 border-blue-600 bg-white' : 'text-blue-500 hover:text-blue-700'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                    <div className="p-4 text-sm text-blue-900 leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto">
                      {([
                        { label: 'Scenario', content: currentItem.question.caseStudy.scenario },
                        ...(currentItem.question.caseStudy.tabs ?? []),
                      ])[activeTab]?.content}
                    </div>
                  </div>
                )}

                {/* Item info */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded font-mono">
                    Item {currentItem.itemIndex + 1}
                  </span>
                  {currentItem.question.topic && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded font-medium">{currentItem.question.topic}</span>
                  )}
                  <span className="text-xs text-gray-400 ml-auto">{currentItem.question.format}</span>
                </div>

                {/* Question stem */}
                <p className="text-gray-900 text-base leading-relaxed mb-5 whitespace-pre-wrap">{currentItem.question.stem}</p>

                {/* Options with correct/incorrect highlights */}
                {(currentItem.question.format === 'MCQ' || currentItem.question.format === 'SATA') && (
                  <div className="space-y-2 mb-5">
                    {(currentItem.question.options as Option[]).map(opt => {
                      const correctAns = currentItem.question.correctAnswer;
                      const isCorrectOption = Array.isArray(correctAns)
                        ? correctAns.includes(opt.id)
                        : correctAns === opt.id;
                      const wasSelected = Array.isArray(currentItem.response)
                        ? (currentItem.response as string[]).includes(opt.id)
                        : currentItem.response === opt.id;

                      return (
                        <div
                          key={opt.id}
                          className={`flex items-start gap-3 p-3 rounded-lg border-2 ${
                            isCorrectOption
                              ? 'border-green-400 bg-green-50'
                              : wasSelected && !isCorrectOption
                              ? 'border-red-400 bg-red-50'
                              : 'border-gray-100 bg-gray-50'
                          }`}
                        >
                          <div className={`w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center ${
                            isCorrectOption ? 'border-green-500 bg-green-500' :
                            wasSelected ? 'border-red-500 bg-red-500' : 'border-gray-300'
                          }`}>
                            {(isCorrectOption || wasSelected) && <div className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={`text-sm leading-relaxed ${
                            isCorrectOption ? 'text-green-800 font-medium' :
                            wasSelected ? 'text-red-700' : 'text-gray-600'
                          }`}>
                            {opt.id}. {opt.text}
                          </span>
                          {isCorrectOption && (
                            <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5 ml-auto" />
                          )}
                          {wasSelected && !isCorrectOption && (
                            <XCircle className="h-4 w-4 text-red-500 flex-shrink-0 mt-0.5 ml-auto" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* For other formats: show your answer vs correct */}
                {currentItem.question.format !== 'MCQ' && currentItem.question.format !== 'SATA' && (
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className={`p-3 rounded-lg border-2 ${currentItem.isCorrect ? 'border-green-300 bg-green-50' : 'border-red-300 bg-red-50'}`}>
                      <p className={`text-xs font-bold mb-1 ${currentItem.isCorrect ? 'text-green-700' : 'text-red-600'}`}>Your Answer</p>
                      <p className="text-sm text-gray-800">{formatResponse(currentItem.question.format, currentItem.response)}</p>
                    </div>
                    <div className="p-3 rounded-lg border-2 border-green-300 bg-green-50">
                      <p className="text-xs font-bold text-green-700 mb-1">Correct Answer</p>
                      <p className="text-sm text-gray-800">{formatCorrectAnswer(currentItem.question.format, currentItem.question.correctAnswer)}</p>
                    </div>
                  </div>
                )}

                {/* Rationale */}
                {showRationale && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                    <p className="text-xs font-bold text-blue-700 mb-2 flex items-center gap-1">
                      <BookOpen className="h-3.5 w-3.5" /> Rationale
                    </p>
                    <p className="text-sm text-blue-900 leading-relaxed">{currentItem.question.rationale}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="bg-white border-t border-gray-200 px-6 py-3 flex items-center justify-between flex-shrink-0">
            <button
              onClick={() => setCurrentIdx(i => Math.max(0, i - 1))}
              disabled={currentIdx === 0}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 disabled:opacity-40 text-sm font-medium text-gray-700 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>

            {/* Mobile item counter */}
            <span className="text-sm text-gray-500">{currentIdx + 1} / {filteredItems.length}</span>

            <button
              onClick={() => setCurrentIdx(i => Math.min(filteredItems.length - 1, i + 1))}
              disabled={currentIdx >= filteredItems.length - 1}
              className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-sm font-semibold text-white transition-colors"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </NclexLayout>
  );
};
