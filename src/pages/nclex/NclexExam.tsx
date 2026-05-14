import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Flag, List, Settings, Pencil, MessageSquare,
  CheckCircle, XCircle, BookOpen, Pause,
  LogOut, ChevronLeft, ChevronRight, Clock, AlertTriangle, X,
} from 'lucide-react';
import { nclexApi } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';

// ── Types ─────────────────────────────────────────────────────────────────────

interface Option { id: string; text: string }
interface CaseStudy {
  id: string; title: string; scenario: string;
  tabs: Array<{ label: string; content: string }>; caseType: string;
}
interface QuestionMetadata {
  subject?: string | null; lesson?: string | null;
  clientNeedArea?: string | null; clientNeedTopic?: string | null;
  questionType?: string | null; estimatedTimeSeconds?: number | null;
}
interface Question {
  id: string; format: string; stem: string;
  options: unknown; correctAnswer: unknown; rationale: string;
  additionalInfo?: string | null;
  topic?: string; subtopic?: string; bank: string;
  difficulty?: number; discrimination?: number;
  metadata?: QuestionMetadata | null;
  caseStudy?: CaseStudy | null;
}
interface Session {
  id: string; examType: string; status: string;
  currentIndex: number; timeLimit?: number | null;
  startedAt: string; questionPool?: string[] | null;
}
interface Feedback {
  isCorrect: boolean; correctAnswer: unknown; rationale: string;
  additionalInfo?: string | null;
  metadata?: QuestionMetadata | null;
  peerCorrectPct?: number | null;
  optionStats?: Record<string, number>;
}
interface NextData { question: Question | null; index: number; completed: boolean }

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDiffLabel(d: number): string {
  if (d < -1) return 'Very Easy';
  if (d < 0) return 'Easy';
  if (d < 1) return 'Medium';
  if (d < 2) return 'Hard';
  return 'Very Hard';
}
function isCorrectOpt(correctAnswer: unknown, id: string): boolean {
  if (Array.isArray(correctAnswer)) return correctAnswer.includes(id);
  if (typeof correctAnswer === 'string') return correctAnswer === id;
  return false;
}
function splitStem(stem: string): { context: string; question: string } {
  const lastQ = stem.lastIndexOf('?');
  if (lastQ < 0) return { context: '', question: stem };
  const before = stem.slice(0, lastQ + 1).trimEnd();
  const lastDot = before.lastIndexOf('. ');
  if (lastDot < 0) return { context: '', question: stem };
  return {
    context: stem.slice(0, lastDot + 1).trim(),
    question: stem.slice(lastDot + 2).trim(),
  };
}

// ── Calculator ────────────────────────────────────────────────────────────────

function Calculator({ onClose }: { onClose: () => void }) {
  const [display, setDisplay] = useState('0');
  const [prev, setPrev] = useState<string | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [waitNew, setWaitNew] = useState(false);

  const press = (val: string) => {
    if (val === 'C') { setDisplay('0'); setPrev(null); setOp(null); setWaitNew(false); return; }
    if (val === '±') { setDisplay(d => d === '0' ? '0' : d.startsWith('-') ? d.slice(1) : '-' + d); return; }
    if (val === '%') { setDisplay(d => String(parseFloat(d) / 100)); return; }
    if (['+', '-', '×', '÷'].includes(val)) {
      setPrev(display); setOp(val); setWaitNew(true); return;
    }
    if (val === '=') {
      if (!op || !prev) return;
      const a = parseFloat(prev), b = parseFloat(display);
      let res: number;
      if (op === '+') res = a + b;
      else if (op === '-') res = a - b;
      else if (op === '×') res = a * b;
      else res = b !== 0 ? a / b : NaN;
      setDisplay(isNaN(res) ? 'Error' : String(parseFloat(res.toFixed(10))));
      setPrev(null); setOp(null); setWaitNew(true); return;
    }
    if (val === '.' && display.includes('.') && !waitNew) return;
    if (waitNew) { setDisplay(val === '.' ? '0.' : val); setWaitNew(false); }
    else setDisplay(d => d === '0' && val !== '.' ? val : d.length < 12 ? d + val : d);
  };

  const buttons = ['C', '±', '%', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '='];
  return (
    <div className="fixed bottom-14 left-4 z-50 bg-[#1c1c1e] rounded-2xl shadow-2xl overflow-hidden w-60 select-none">
      <div className="flex items-center justify-between px-4 py-2.5 bg-[#2c2c2e] border-b border-[#3a3a3c]">
        <span className="text-white text-xs font-semibold tracking-wide">CALCULATOR</span>
        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors"><X className="h-4 w-4" /></button>
      </div>
      <div className="px-4 py-3 text-right">
        <div className="text-gray-400 text-xs h-4 font-mono">{prev && op ? `${prev} ${op}` : ''}</div>
        <div className="text-white text-3xl font-light truncate font-mono">{display}</div>
      </div>
      <div className="grid grid-cols-4 gap-px bg-[#3a3a3c]">
        {buttons.map(b => {
          const isOp = ['+', '-', '×', '÷', '='].includes(b);
          const isFn = ['C', '±', '%'].includes(b);
          const isZero = b === '0';
          return (
            <button key={b} onClick={() => press(b)}
              className={`${isZero ? 'col-span-2' : ''} h-14 text-lg font-medium transition-opacity active:opacity-60 ${
                isOp ? 'bg-[#ff9f0a] text-white hover:bg-[#ffb340]'
                : isFn ? 'bg-[#636366] text-white hover:bg-[#7c7c80]'
                : 'bg-[#2c2c2e] text-white hover:bg-[#3a3a3c]'
              }`}>
              {b}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Animated Loading Screen (exam open) ──────────────────────────────────────

function ExamLoadingScreen() {
  const [dots, setDots] = useState('');
  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="fixed inset-0 bg-[#2a2a2a] flex flex-col items-center justify-center z-50">
      <div className="relative flex items-center justify-center mb-10">
        <div className="absolute w-32 h-32 rounded-full border-2 border-[#17a2b8]/20 animate-ping" style={{ animationDuration: '2s' }} />
        <div className="absolute w-24 h-24 rounded-full border-2 border-[#17a2b8]/30 animate-ping" style={{ animationDuration: '1.5s', animationDelay: '0.3s' }} />
        <div className="w-16 h-16 rounded-full border-4 border-white/10 border-t-[#17a2b8] animate-spin" style={{ animationDuration: '0.9s' }} />
        <div className="absolute w-10 h-10 rounded-full overflow-hidden bg-white flex items-center justify-center">
          <img src="/logo.png" alt="GritSync" className="h-8 w-8 object-contain" />
        </div>
      </div>
      <p className="text-white text-xl font-semibold tracking-wide mb-2">
        Your test is loading{dots}
      </p>
      <p className="text-[#17a2b8] text-sm">Please wait while we prepare your questions</p>
    </div>
  );
}

// ── Animated Results Screen (RA/CAT/EXIT post-submit) ────────────────────────

function ResultsAnimation({ examType }: { examType: string }) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  const phases = [
    'Scoring your responses…',
    'Calculating performance metrics…',
    'Applying IRT calibration…',
    'Generating your results…',
    'Almost done…',
  ];

  useEffect(() => {
    const duration = 5000;
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / duration) * 100);
      setProgress(pct);
      setPhase(Math.min(4, Math.floor((elapsed / duration) * 5)));
      if (elapsed >= duration) clearInterval(timer);
    }, 50);
    return () => clearInterval(timer);
  }, []);

  const examLabel = examType === 'READINESS_ASSESSMENT' ? 'Readiness Assessment'
    : examType === 'EXIT_EXAM' ? 'Exit Exam' : 'CAT Exam';

  return (
    <div className="fixed inset-0 bg-[#2a2a2a] flex flex-col items-center justify-center z-50">
      <div className="relative flex items-center justify-center mb-10">
        <div className="w-28 h-28 rounded-full border-4 border-white/10 border-t-[#17a2b8] border-r-[#17a2b8] animate-spin" style={{ animationDuration: '0.6s' }} />
        <div className="absolute w-20 h-20 rounded-full border-4 border-white/10 border-b-[#4dd4e8] animate-spin" style={{ animationDuration: '0.4s', animationDirection: 'reverse' }} />
        <div className="absolute w-12 h-12 rounded-full border-4 border-white/10 border-t-white animate-spin" style={{ animationDuration: '0.8s' }} />
        <div className="absolute w-5 h-5 rounded-full bg-[#17a2b8] animate-pulse" />
      </div>

      <p className="text-white text-xl font-bold mb-1 tracking-wide">{examLabel} Complete</p>
      <p className="text-[#17a2b8] text-sm mb-8 h-5 transition-all duration-300">{phases[phase]}</p>

      <div className="w-64 h-1.5 bg-white/10 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-[#17a2b8] to-[#4dd4e8] rounded-full transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
      <p className="text-[#17a2b8]/60 text-xs mt-3 font-mono">{Math.round(progress)}%</p>
    </div>
  );
}

// ── Option Button (Archer style) ──────────────────────────────────────────────

const OptionBtn = ({
  opt, isSelected, showFeedback, correctAnswer, onClick, multiSelect, peerPct,
}: {
  opt: Option; isSelected: boolean; showFeedback: boolean;
  correctAnswer?: unknown; onClick: () => void; multiSelect?: boolean;
  peerPct?: number;
}) => {
  const correct = showFeedback && isCorrectOpt(correctAnswer, opt.id);
  const wrong = showFeedback && isSelected && !correct;

  let rowCls = 'hover:bg-gray-50 cursor-pointer';
  let circleCls = 'border-gray-400 bg-white';
  if (showFeedback) {
    if (correct) { rowCls = 'bg-green-50'; circleCls = 'border-green-500 bg-green-500'; }
    else if (wrong) { rowCls = 'bg-red-50'; circleCls = 'border-red-500 bg-red-400'; }
    else rowCls = 'cursor-default opacity-70';
  } else if (isSelected) {
    rowCls = 'bg-[#e8f6fa] cursor-pointer';
    circleCls = 'border-[#17a2b8] bg-white';
  }

  return (
    <button onClick={onClick} disabled={showFeedback}
      className={`w-full flex items-center gap-3 px-2 py-2.5 text-left text-sm text-gray-800 transition-colors disabled:cursor-default ${rowCls}`}>
      <div className={`${multiSelect ? 'rounded-sm' : 'rounded-full'} w-[18px] h-[18px] min-w-[18px] border-2 flex items-center justify-center flex-shrink-0 ${circleCls}`}>
        {showFeedback
          ? correct ? <CheckCircle className="w-3 h-3 text-white" />
            : wrong ? <XCircle className="w-3 h-3 text-white" /> : null
          : isSelected
            ? <div className={`${multiSelect ? 'w-2 h-2 rounded-sm' : 'w-2.5 h-2.5 rounded-full'} bg-[#17a2b8]`} />
            : null}
      </div>
      <span className="leading-relaxed flex-1">
        <span className="font-medium">{opt.id}.</span>{' '}{opt.text}
      </span>
      {showFeedback && peerPct !== undefined && (
        <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${correct ? 'text-green-600' : 'text-gray-400'}`}>
          [{peerPct}%]
        </span>
      )}
    </button>
  );
};

// ── Statistics Panel (Archer style, shown below options on left) ──────────────

const FORMAT_TIME_MAP: Record<string, number> = {
  MCQ: 45, SATA: 75, FILL_IN_BLANK: 60, ORDERED_RESPONSE: 70,
  BOW_TIE: 90, MATRIX_MCQ: 90, MATRIX_SATA: 105, DROP_DOWN: 80,
  HIGHLIGHT_TEXT: 85, DRAG_DROP: 90,
};

function StatsPanel({ question, feedback, timeSpentSec }: {
  question: Question; feedback: Feedback; timeSpentSec: number;
}) {
  const meta = feedback.metadata as Record<string, string | number | null> | null;
  const d = question.difficulty ?? 0;
  const diffLabel = d < -0.5 ? 'Easy' : d <= 0.5 ? 'Medium' : 'Hard';
  const diffColor = d < -0.5 ? 'text-green-600' : d <= 0.5 ? 'text-amber-500' : 'text-red-500';
  const peerPct = feedback.peerCorrectPct;
  const subject = meta?.subject as string | null ?? question.topic;
  const lesson = meta?.lesson as string | null ?? question.subtopic;
  const clientNeedArea = meta?.clientNeedArea as string | null;
  const clientNeedTopic = meta?.clientNeedTopic as string | null;
  const questionType = meta?.questionType as string | null ?? 'Application';
  const estTime = meta?.estimatedTimeSeconds as number | null ?? FORMAT_TIME_MAP[question.format] ?? 60;

  return (
    <div className="mt-5 border-t border-gray-100">
      <p className="text-xs font-bold text-gray-600 mt-4 mb-3">Statistics</p>
      <div className="grid grid-cols-3 gap-y-3 gap-x-2 text-xs mb-3">
        <div>
          <p className="text-gray-400 text-[10px] mb-0.5">Difficulty level</p>
          <p className={`font-bold ${diffColor}`}>{diffLabel.toUpperCase()}</p>
        </div>
        <div>
          <p className="text-gray-400 text-[10px] mb-0.5">Peers got it right</p>
          <p className="font-bold text-gray-700">{peerPct !== null && peerPct !== undefined ? `${peerPct}%` : '—'}</p>
        </div>
        <div>
          <p className="text-gray-400 text-[10px] mb-0.5">Time taken</p>
          <p className="font-bold text-gray-700">{timeSpentSec} s</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[10px]">
        {subject && (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">Subject</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-semibold">{subject}</span>
          </span>
        )}
        {lesson && (
          <span className="flex items-center gap-1">
            <span className="text-gray-400">Lesson</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full font-semibold">{lesson}</span>
          </span>
        )}
        {estTime && (
          <span className="px-2 py-0.5 bg-gray-100 text-gray-500 rounded-full">Est. {estTime}s</span>
        )}
      </div>
      {(clientNeedArea || clientNeedTopic || questionType) && (
        <div className="mt-2 space-y-1.5 text-[10px]">
          {clientNeedArea && (
            <div className="flex items-start gap-1">
              <span className="text-gray-400 flex-shrink-0 mt-0.5">Client Need Area</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded font-semibold leading-tight">{clientNeedArea}</span>
            </div>
          )}
          {clientNeedTopic && (
            <div className="flex items-start gap-1">
              <span className="text-gray-400 flex-shrink-0 mt-0.5">Client Need Topic</span>
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded leading-tight">{clientNeedTopic}</span>
            </div>
          )}
          {questionType && (
            <div className="flex items-center gap-1">
              <span className="text-gray-400">Question Type</span>
              <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded font-semibold">{questionType}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Answer renderers ──────────────────────────────────────────────────────────

interface DropdownDef { id: string; choices: Option[] }
interface MatrixRowDef { id: string; text: string }
interface MatrixColDef { id: string; text: string }

function renderAnswerInput(
  question: Question,
  response: unknown,
  setResponse: (v: unknown) => void,
  locked: boolean,
  feedback: Feedback | null,
) {
  const opts = question.options as Option[];
  const fmt = question.format;
  const showFeedback = locked && !!feedback;
  const correctAnswer = feedback?.correctAnswer;

  if (fmt === 'MCQ') {
    return (
      <div className="mt-4">
        {opts.map(opt => (
          <OptionBtn key={opt.id} opt={opt}
            isSelected={response === opt.id}
            showFeedback={showFeedback} correctAnswer={correctAnswer}
            peerPct={showFeedback ? (feedback?.optionStats?.[opt.id] ?? undefined) : undefined}
            onClick={() => !locked && setResponse(opt.id)} />
        ))}
      </div>
    );
  }

  if (fmt === 'SATA' || fmt === 'HIGHLIGHT_TEXT' || fmt === 'DRAG_DROP') {
    const val = (response as string[]) ?? [];
    return (
      <div className="mt-4">
        <p className="text-xs text-[#17a2b8] font-semibold mb-3 flex items-center gap-1">
          <ChevronRight className="h-3.5 w-3.5" /> Select all that apply
        </p>
        {opts.map(opt => (
          <OptionBtn key={opt.id} opt={opt} multiSelect
            isSelected={val.includes(opt.id)}
            showFeedback={showFeedback} correctAnswer={correctAnswer}
            onClick={() => {
              if (locked) return;
              setResponse(val.includes(opt.id) ? val.filter(x => x !== opt.id) : [...val, opt.id]);
            }} />
        ))}
      </div>
    );
  }

  if (fmt === 'FILL_IN_BLANK') {
    return (
      <div className="mt-4 space-y-2">
        {showFeedback && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded font-medium">
            Correct answer: <strong>{String(correctAnswer)}</strong>
          </p>
        )}
        <input type="number" step="0.01"
          value={response as string}
          onChange={e => !locked && setResponse(e.target.value)}
          disabled={locked}
          placeholder="Enter your answer…"
          className="w-48 px-4 py-2.5 border-2 border-gray-300 rounded-lg text-sm focus:outline-none focus:border-[#17a2b8] disabled:bg-gray-100" />
      </div>
    );
  }

  if (fmt === 'DROP_DOWN') {
    const rawOpts = ((question.options ?? {}) as Record<string, unknown>);

    // Normalize cloze stem: new format stores it in options.stem; old format put it in question.stem
    const rawStem = typeof rawOpts.stem === 'string' ? rawOpts.stem : question.stem ?? '';
    // Support legacy [DROPDOWN_N] placeholders alongside current [N]
    const clozeStem = rawStem.replace(/\[DROPDOWN_(\d+)\]/g, '[$1]');

    // Normalize dropdowns from multiple possible AI output shapes
    let dropdowns: DropdownDef[] = [];
    if (Array.isArray(rawOpts.dropdowns)) {
      dropdowns = (rawOpts.dropdowns as Array<Record<string, unknown>>).map(dd => ({
        id: String(dd.id ?? ''),
        choices: Array.isArray(dd.choices)
          ? (dd.choices as unknown[]).map((c, ci) =>
              typeof c === 'string'
                ? { id: String.fromCharCode(65 + ci), text: c }
                : { id: String((c as Option).id), text: String((c as Option).text) }
            )
          : [],
      }));
    } else if (Array.isArray(rawOpts.blanks)) {
      // Legacy case-study format: blanks = [["choice1","choice2",...], ...]
      dropdowns = (rawOpts.blanks as unknown[][]).map((choices, i) => ({
        id: String(i + 1),
        choices: (choices as string[]).map(c => ({ id: c, text: c })),
      }));
    }

    const val = (response as Record<string, string>) ?? {};
    const parts = clozeStem.split(/(\[\d+\])/g);
    return (
      <div className="mt-4 space-y-3">
        <p className="text-sm text-gray-800 leading-relaxed flex flex-wrap items-center gap-2">
          {parts.map((part, i) => {
            const m = part.match(/^\[(\d+)\]$/);
            if (m) {
              const dd = dropdowns.find(d => d.id === m[1]);
              if (!dd) return null;
              return (
                <select key={i} value={val[m[1]] ?? ''}
                  onChange={e => !locked && setResponse({ ...val, [m[1]]: e.target.value })}
                  disabled={locked}
                  className="px-2 py-1 border-2 border-[#17a2b8] rounded text-sm bg-[#e8f6fa] focus:outline-none disabled:opacity-70">
                  <option value="">-- select --</option>
                  {dd.choices.map(c => <option key={c.id} value={c.id}>{c.text}</option>)}
                </select>
              );
            }
            return <span key={i}>{part}</span>;
          })}
        </p>
        {showFeedback && (
          <p className="text-sm text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded">
            Correct: <strong>{JSON.stringify(correctAnswer)}</strong>
          </p>
        )}
      </div>
    );
  }

  if (fmt === 'MATRIX_MCQ' || fmt === 'MATRIX_SATA') {
    const matOpts = question.options as { rows: MatrixRowDef[]; columns: MatrixColDef[] };
    const val = (response as Record<string, string | string[]>) ?? {};
    const isSata = fmt === 'MATRIX_SATA';
    return (
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 text-left text-xs font-bold text-gray-600 border border-gray-200 min-w-[180px]">Options</th>
              {matOpts.columns.map(col => (
                <th key={col.id} className="p-2 text-center text-xs font-bold text-gray-600 border border-gray-200 min-w-[80px]">{col.text}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matOpts.rows.map((row, ri) => (
              <tr key={row.id} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="p-2 text-gray-700 border border-gray-200">{row.text}</td>
                {matOpts.columns.map(col => {
                  const sel = isSata
                    ? ((val[row.id] as string[]) ?? []).includes(col.id)
                    : val[row.id] === col.id;
                  const crt = showFeedback && (() => {
                    const ca = correctAnswer as Record<string, unknown>;
                    const a = ca?.[row.id];
                    return isSata ? Array.isArray(a) && a.includes(col.id) : a === col.id;
                  })();
                  return (
                    <td key={col.id} className="p-2 text-center border border-gray-200">
                      <button onClick={() => {
                        if (locked) return;
                        if (isSata) {
                          const curr = (val[row.id] as string[]) ?? [];
                          setResponse({ ...val, [row.id]: curr.includes(col.id) ? curr.filter(x => x !== col.id) : [...curr, col.id] });
                        } else {
                          setResponse({ ...val, [row.id]: col.id });
                        }
                      }}
                        disabled={locked}
                        className={`w-6 h-6 rounded-full border-2 flex items-center justify-center mx-auto transition-colors ${
                          crt ? 'bg-green-500 border-green-500' : sel ? 'bg-[#17a2b8] border-[#17a2b8]' : 'border-gray-400 hover:border-[#17a2b8]'
                        }`}>
                        {(sel || crt) && <div className="w-2.5 h-2.5 rounded-full bg-white" />}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (fmt === 'ORDERED_RESPONSE') {
    const ordOpts = question.options as Option[];
    const order = (response as string[]) ?? [];
    return (
      <div className="mt-4 space-y-2">
        <p className="text-xs text-[#17a2b8] font-semibold mb-2">Arrange in correct order</p>
        {ordOpts.map(opt => {
          const pos = order.indexOf(opt.id);
          const sel = pos >= 0;
          const crt = showFeedback && (() => {
            const ca = correctAnswer as string[];
            return Array.isArray(ca) && ca[pos] === opt.id;
          })();
          return (
            <button key={opt.id} onClick={() => {
              if (locked) return;
              setResponse(sel ? order.filter(x => x !== opt.id) : [...order, opt.id]);
            }}
              disabled={locked}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-sm text-left transition-colors ${
                crt ? 'bg-green-50 border-green-300' : sel ? 'bg-[#e8f6fa] border-[#17a2b8]' : 'border-gray-200 hover:border-[#17a2b8]'
              }`}>
              <span className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center flex-shrink-0 ${
                crt ? 'bg-green-500 text-white' : sel ? 'bg-[#17a2b8] text-white' : 'bg-gray-200 text-gray-600'
              }`}>{sel ? pos + 1 : ''}</span>
              {opt.text}
            </button>
          );
        })}
      </div>
    );
  }

  return null;
}

// ── Explanation Panel (right side: rationale + Additional Info) ───────────────

function ExplanationPanel({ question, feedback }: { question: Question; feedback: Feedback | null }) {
  if (!feedback) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[200px] text-center p-8">
        <BookOpen className="h-8 w-8 text-gray-300 mb-3" />
        <p className="text-sm text-gray-400">Submit your answer to see the explanation</p>
      </div>
    );
  }

  const additionalInfo = feedback.additionalInfo ?? question.additionalInfo;
  const bullets = additionalInfo
    ? additionalInfo.split('\n').map(l => l.trim()).filter(l => l.length > 0)
    : [];

  return (
    <div className="p-5 space-y-5">
      {/* Rationale */}
      <div>
        <p className={`text-sm font-bold mb-2 ${feedback.isCorrect ? 'text-green-700' : 'text-red-600'}`}>
          {feedback.isCorrect ? '✓ Correct' : '✗ Incorrect'}
        </p>
        <p className="text-sm text-gray-700 leading-relaxed">{feedback.rationale}</p>
      </div>

      {/* Additional Info */}
      {bullets.length > 0 && (
        <div className="border border-[#17a2b8]/30 rounded-xl overflow-hidden">
          <div className="bg-[#e8f6fa] px-4 py-2.5 flex items-center gap-2 border-b border-[#17a2b8]/20">
            <svg className="h-4 w-4 text-[#17a2b8]" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/>
            </svg>
            <span className="text-sm font-bold text-[#17a2b8]">Additional Info</span>
          </div>
          <div className="bg-white px-4 py-3">
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-700 leading-relaxed">
                  <span className="text-[#17a2b8] flex-shrink-0 mt-0.5">✓</span>
                  <span>{b.replace(/^[•·\-]\s*/, '')}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Format + bank tags */}
      <div className="flex flex-wrap gap-1.5 text-xs pt-1 border-t border-gray-100">
        <span className="px-2.5 py-1 rounded bg-gray-100 text-gray-500 font-mono">{question.format}</span>
        <span className={`px-2.5 py-1 rounded font-semibold ${question.bank === 'NGN' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{question.bank}</span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export const NclexExam = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [session, setSession] = useState<Session | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [response, setResponse] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [nextData, setNextData] = useState<NextData | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showEndConfirm, setShowEndConfirm] = useState(false);
  const [flagged, setFlagged] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showingResults, setShowingResults] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [questionTimeSpent, setQuestionTimeSpent] = useState(0);

  const questionStartRef = useRef<number>(Date.now());
  const sessionStartRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!sessionId) return;
    nclexApi.getSession(sessionId)
      .then(r => {
        const { session: s, currentQuestion, currentIndex: idx } = r.data.data;
        setSession(s);
        setQuestion(currentQuestion);
        setCurrentIndex(idx ?? 0);
        const startMs = new Date(s.startedAt).getTime();
        sessionStartRef.current = startMs;
        setElapsed(Math.floor((Date.now() - startMs) / 1000));
        if (s.timeLimit) {
          const used = Math.floor((Date.now() - startMs) / 1000);
          setTimeLeft(Math.max(0, s.timeLimit * 60 - used));
        }
        if (s.status !== 'IN_PROGRESS') navigate(`/nclex/results/${sessionId}`, { replace: true });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId, navigate]);

  useEffect(() => {
    if (timeLeft === null || paused) return;
    if (timeLeft <= 0) { handleEndExam(); return; }
    const t = setTimeout(() => setTimeLeft(tl => (tl ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  });

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - sessionStartRef.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, [paused]);

  useEffect(() => {
    setResponse(getInitialResponse(question?.format ?? ''));
    setActiveTab(0);
    setFlagged(false);
    setFeedback(null);
    setNextData(null);
    setQuestionTimeSpent(0);
    questionStartRef.current = Date.now();
  }, [question?.id]);

  function getInitialResponse(format: string): unknown {
    if (['SATA', 'HIGHLIGHT_TEXT', 'DRAG_DROP', 'ORDERED_RESPONSE'].includes(format)) return [];
    if (['MATRIX_MCQ', 'MATRIX_SATA', 'DROP_DOWN'].includes(format)) return {};
    if (format === 'BOW_TIE') return { leftIds: [], rightIds: [] };
    return '';
  }

  function hasResponse(): boolean {
    if (!question) return false;
    if (typeof response === 'string') return response.trim() !== '';
    if (Array.isArray(response)) return response.length > 0;
    if (typeof response === 'object' && response !== null) {
      const obj = response as Record<string, unknown>;
      if ('leftIds' in obj) return (obj.leftIds as string[]).length > 0 || (obj.rightIds as string[]).length > 0;
      return Object.keys(obj).length > 0 && Object.values(obj).every(v => v !== '' && v !== undefined);
    }
    return false;
  }

  // Tutorial: submit + show rationale
  const handleTutorialSubmit = async () => {
    if (!question || !session || !hasResponse() || submitting) return;
    setSubmitting(true);
    const timeSpent = Math.floor((Date.now() - questionStartRef.current) / 1000);
    setQuestionTimeSpent(timeSpent);
    try {
      const res = await nclexApi.submitAnswer(session.id, { questionId: question.id, response, timeSpent });
      const data = res.data.data;
      setFeedback({
        isCorrect: data.isCorrect,
        correctAnswer: data.correctAnswer,
        rationale: data.rationale,
        additionalInfo: data.additionalInfo ?? null,
        metadata: data.metadata ?? null,
        peerCorrectPct: data.peerCorrectPct ?? null,
        optionStats: data.optionStats ?? {},
      });
      setNextData({ question: data.nextQuestion, index: data.currentIndex, completed: !!data.completed });
    } catch {
      toast.error('Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // RA/CAT/EXIT: submit silently + advance (or end exam)
  const handleTimedNext = async () => {
    if (!question || !session || !hasResponse() || submitting) return;
    setSubmitting(true);
    const timeSpent = Math.floor((Date.now() - questionStartRef.current) / 1000);
    try {
      const res = await nclexApi.submitAnswer(session.id, { questionId: question.id, response, timeSpent });
      const data = res.data.data;
      if (data.completed) {
        setShowingResults(true);
        setTimeout(() => navigate(`/nclex/results/${session.id}`), 5000);
      } else {
        setQuestion(data.nextQuestion);
        setCurrentIndex(data.currentIndex);
      }
    } catch {
      toast.error('Failed to submit answer. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Tutorial: advance to next question after seeing rationale
  const handleTutorialNext = () => {
    if (!nextData) return;
    if (nextData.completed) {
      navigate(`/nclex/results/${session!.id}`);
      return;
    }
    setQuestion(nextData.question);
    setCurrentIndex(nextData.index);
  };

  const handleEndExam = useCallback(async () => {
    if (!session) return;
    try { await nclexApi.abandonSession(session.id); } catch {}
    navigate(`/nclex/results/${session.id}`);
  }, [session, navigate]);

  const fmtTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return `${h > 0 ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  if (loading) return <ExamLoadingScreen />;

  if (!question) return (
    <div className="fixed inset-0 bg-white flex items-center justify-center">
      <div className="text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-3" />
        <p className="text-gray-700 font-semibold">No question available</p>
        <button onClick={() => navigate('/nclex')} className="mt-4 text-[#17a2b8] text-sm underline">Return home</button>
      </div>
    </div>
  );

  if (showingResults) return <ResultsAnimation examType={session?.examType ?? ''} />;

  const isTutorial = session?.examType === 'TUTORIAL';
  const isTimedExam = !isTutorial;
  const answered = !!feedback;
  const hasCaseStudy = !!question.caseStudy;
  const caseTabs = hasCaseStudy
    ? (question.caseStudy!.tabs as Array<{ label: string; content: string }>)
    : [];

  // CAT is adaptive (85–150 questions); backend signals completion via data.completed
  const isCat = session?.examType === 'CAT';
  const totalItems = isCat
    ? null // no fixed total for CAT — adaptive stopping
    : session?.questionPool?.length
      ?? (session?.examType === 'EXIT_EXAM' ? 150 : 85);

  // CAT never shows "Submit" — backend signals end; RA/EXIT show Submit on last question
  const isLastQuestion = isTimedExam && !isCat && totalItems !== null && currentIndex >= totalItems - 1;

  const examTypeLabel =
    session?.examType === 'READINESS_ASSESSMENT' ? 'Readiness Assessment' :
    session?.examType === 'CAT' ? 'CAT' :
    session?.examType === 'EXIT_EXAM' ? 'Exit Exam' :
    'Tutorial';

  const { context: stemContext, question: stemQuestion } = splitStem(question.stem);
  const userName = user ? `${user.firstName} ${user.lastName}`.toUpperCase() : 'STUDENT';
  const qidShort = question.id ? question.id.slice(-6).toUpperCase() : '------';

  // Render question body (shared between case-study right + regular left panels)
  const renderQuestionBody = (inlineExplanation = false) => (
    <div className="px-7 py-6">
      {stemContext && <p className="text-sm text-gray-700 leading-relaxed mb-4">{stemContext}</p>}
      <p className="text-sm font-bold text-gray-900 leading-relaxed flex items-start gap-1.5 mb-1">
        <ChevronRight className="h-4 w-4 text-[#17a2b8] flex-shrink-0 mt-0.5" />
        {stemQuestion || question.stem}
      </p>

      {/* Archer-style answer status bar (shown after submitting) */}
      {isTutorial && answered && feedback && (
        <div className={`mt-4 px-4 py-2.5 rounded-lg flex items-center justify-between text-sm font-semibold ${
          feedback.isCorrect ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <span className={feedback.isCorrect ? 'text-green-700' : 'text-red-600'}>
            {feedback.isCorrect ? '✓ Correct' : '✗ Incorrect'}
          </span>
          <span className="text-gray-500 font-normal text-xs">
            Correct Answer(s):{' '}
            <span className="font-bold text-gray-700">
              {Array.isArray(feedback.correctAnswer)
                ? (feedback.correctAnswer as string[]).join(', ')
                : String(feedback.correctAnswer)}
            </span>
          </span>
        </div>
      )}

      {renderAnswerInput(question, response, setResponse,
        isTutorial ? answered : false,
        isTutorial ? feedback : null,
      )}

      {/* Tutorial Submit button (inline, before answering) */}
      {isTutorial && !answered && (
        <div className="mt-6">
          <button
            onClick={handleTutorialSubmit}
            disabled={!hasResponse() || submitting}
            className="px-6 py-2.5 bg-[#17a2b8] text-white text-sm font-semibold rounded-lg hover:bg-[#138fa3] disabled:opacity-40 transition-colors flex items-center gap-2">
            {submitting
              ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              : 'Submit'}
          </button>
        </div>
      )}

      {/* Statistics section (Tutorial: shown on left below options) */}
      {isTutorial && answered && feedback && (
        <StatsPanel question={question} feedback={feedback} timeSpentSec={questionTimeSpent} />
      )}

      {/* Tutorial: inline explanation (mobile or case-study) */}
      {isTutorial && answered && inlineExplanation && (
        <div className="mt-6 pt-5 border-t border-gray-200">
          <p className="text-sm font-bold text-gray-900 mb-4">Explanation</p>
          <ExplanationPanel question={question} feedback={feedback} />
        </div>
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-white">

      {/* ── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div className="bg-[#3d3d3d] text-white flex items-center justify-between px-5 h-14 flex-shrink-0 z-10">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded flex-shrink-0 overflow-hidden bg-white flex items-center justify-center">
            <img src="/logo.png" alt="GritSync" className="h-7 w-7 object-contain" />
          </div>
          <span className="font-bold text-sm tracking-wide hidden sm:block whitespace-nowrap">
            GRITSYNC &nbsp;–&nbsp; <span className="font-normal">{userName}</span>
          </span>
        </div>

        <div className="text-center flex-shrink-0">
          <div className="text-sm font-semibold leading-tight">
            {session?.id?.slice(-8).toUpperCase() ?? '--------'}
            <span className="ml-1.5 text-gray-300 font-normal">({examTypeLabel})</span>
          </div>
          <div className="text-xs text-gray-300 leading-tight">QID: {qidShort}</div>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-gray-300">
            <Clock className="h-3.5 w-3.5" />
            <span className="font-mono">
              {timeLeft !== null ? `Time Left: ${fmtTime(timeLeft)}` : `Time Elapsed: ${fmtTime(elapsed)}`}
            </span>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-300">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <span className="font-semibold">
              {currentIndex + 1}{totalItems !== null && ` of ${totalItems}`}
            </span>
          </div>
        </div>
      </div>

      {/* ── TEAL ACTION BAR ──────────────────────────────────────────────────── */}
      <div className="bg-[#17a2b8] text-white flex items-center justify-between px-5 h-10 flex-shrink-0">
        <div className="flex items-center gap-1">
          {/* Calculator button */}
          <button
            onClick={() => setShowCalculator(c => !c)}
            className={`p-2 rounded transition-colors ${showCalculator ? 'bg-white/25' : 'hover:bg-white/10'}`}
            title="Calculator">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="2" width="16" height="20" rx="2"/>
              <rect x="7" y="5" width="10" height="4" rx="1" fill="currentColor" stroke="none"/>
              <circle cx="8" cy="14" r="1" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/>
              <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/>
              <circle cx="8" cy="18" r="1" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>
              <circle cx="16" cy="18" r="1" fill="currentColor" stroke="none"/>
            </svg>
          </button>
          <button onClick={() => setFlagged(f => !f)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold transition-colors ${
              flagged ? 'bg-white/25 text-yellow-200' : 'hover:bg-white/10'
            }`}>
            <Flag className="h-3.5 w-3.5" fill={flagged ? 'currentColor' : 'none'} />
            MARK FOR LATER
          </button>
          <button className="p-2 rounded hover:bg-white/10 transition-colors" title="Question list">
            <List className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button className="p-2 rounded hover:bg-white/10 transition-colors" title="Settings"><Settings className="h-4 w-4" /></button>
          <button className="p-2 rounded hover:bg-white/10 transition-colors" title="Notes"><Pencil className="h-4 w-4" /></button>
          <button className="p-2 rounded hover:bg-white/10 transition-colors" title="Feedback"><MessageSquare className="h-4 w-4" /></button>
        </div>
      </div>

      {/* ── BODY ─────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {hasCaseStudy ? (
          <>
            {/* Left: scenario + tabs */}
            <div className="w-1/2 flex flex-col border-r border-gray-200 overflow-hidden hidden lg:flex">
              <div className="px-6 pt-5 pb-3 flex-shrink-0 border-b border-gray-100">
                <p className="text-sm font-bold text-gray-900 leading-snug">The following scenario applies to the next 1 items</p>
                {question.caseStudy!.title && (
                  <p className="text-sm text-[#17a2b8] mt-1 leading-snug">{question.caseStudy!.title}</p>
                )}
                <p className="text-sm font-bold text-gray-900 mt-2">Item 1 of 1</p>
              </div>
              <div className="flex border-b border-gray-200 bg-white flex-shrink-0 overflow-x-auto">
                {caseTabs.map((tab, i) => (
                  <button key={i} onClick={() => setActiveTab(i)}
                    className={`px-5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeTab === i ? 'border-gray-700 text-gray-900 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 bg-gray-50'
                    }`}>
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto px-6 py-4 text-sm text-[#17a2b8] leading-relaxed whitespace-pre-wrap">
                {caseTabs[activeTab]?.content}
              </div>
            </div>

            {/* Right: question + options */}
            <div className="flex-1 flex flex-col overflow-hidden">
              <div className="lg:hidden flex border-b border-gray-200 bg-gray-50 overflow-x-auto flex-shrink-0">
                {caseTabs.map((tab, i) => (
                  <button key={i} onClick={() => setActiveTab(i)}
                    className={`px-4 py-2 text-xs font-bold whitespace-nowrap flex-shrink-0 ${
                      activeTab === i ? 'border-b-2 border-[#17a2b8] text-[#17a2b8] bg-white' : 'text-gray-500'
                    }`}>{tab.label}</button>
                ))}
              </div>
              <div className="lg:hidden px-4 py-3 text-sm text-[#17a2b8] leading-relaxed whitespace-pre-wrap border-b border-gray-200 max-h-40 overflow-y-auto">
                {caseTabs[activeTab]?.content}
              </div>
              <div className="flex-1 overflow-y-auto">
                {renderQuestionBody(true)}
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Left/main: question */}
            <div className={`flex flex-col overflow-hidden transition-all duration-300 ${
              isTutorial && answered ? 'w-full lg:w-[56%]' : 'w-full'
            }`}>
              <div className="flex-1 overflow-y-auto">
                {renderQuestionBody(false)}
                {/* Mobile explanation (tutorial only) */}
                {isTutorial && answered && (
                  <div className="lg:hidden px-7 pb-6 border-t border-gray-200">
                    <p className="text-sm font-bold text-gray-900 mb-4 pt-5">Explanation</p>
                    <ExplanationPanel question={question} feedback={feedback} />
                  </div>
                )}
              </div>
            </div>

            {/* Right: explanation panel (tutorial mode, after answering) */}
            {isTutorial && answered && (
              <div className="hidden lg:flex flex-col flex-1 border-l border-gray-200 overflow-hidden">
                <div className="border-b border-gray-200 px-5 py-3 bg-white flex-shrink-0">
                  <p className="text-sm font-bold text-gray-900">Explanation</p>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <ExplanationPanel question={question} feedback={feedback} />
                </div>
              </div>
            )}
          </>
        )}

      </div>

      {/* ── CALCULATOR OVERLAY ───────────────────────────────────────────────── */}
      {showCalculator && <Calculator onClose={() => setShowCalculator(false)} />}

      {/* ── BOTTOM BAR ───────────────────────────────────────────────────────── */}
      <div className="bg-[#3d3d3d] px-5 h-12 flex items-center justify-between flex-shrink-0 z-10 text-white text-sm">
        {/* Left: End | Pause */}
        <div className="flex items-center">
          <button onClick={() => setShowEndConfirm(true)}
            className="flex items-center gap-1.5 py-1.5 hover:text-gray-300 transition-colors font-medium">
            <LogOut className="h-4 w-4" /> End
          </button>
          <span className="mx-3 text-white/30 text-lg leading-none">|</span>
          <button onClick={() => setPaused(p => !p)}
            className="flex items-center gap-1.5 py-1.5 hover:text-gray-300 transition-colors font-medium">
            <Pause className="h-4 w-4" /> {paused ? 'Resume' : 'Pause'}
          </button>
        </div>

        {/* Right: Previous | Submit/Next */}
        <div className="flex items-center">
          <button
            disabled={currentIndex === 0 || submitting || isTimedExam}
            className="flex items-center gap-1.5 py-1.5 hover:text-gray-300 disabled:opacity-30 transition-colors font-medium">
            <ChevronLeft className="h-4 w-4" /> Previous
          </button>
          <span className="mx-3 text-white/30 text-lg leading-none">|</span>

          {isTutorial ? (
            <button
              onClick={handleTutorialNext}
              disabled={!answered || !nextData}
              className="flex items-center gap-1.5 py-1.5 hover:text-gray-300 disabled:opacity-30 transition-colors font-medium">
              {nextData?.completed ? 'View Results' : 'Next'}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleTimedNext}
              disabled={!hasResponse() || submitting}
              className={`flex items-center gap-1.5 py-1.5 transition-colors font-medium ${
                hasResponse() && !submitting ? 'hover:text-gray-300' : 'opacity-30'
              } ${isLastQuestion ? 'text-[#17a2b8] font-bold' : ''}`}>
              {submitting
                ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                : isLastQuestion ? 'Submit' : 'Next'}
              {!submitting && <ChevronRight className="h-4 w-4" />}
            </button>
          )}
        </div>
      </div>

      {/* ── END EXAM CONFIRM ─────────────────────────────────────────────────── */}
      {showEndConfirm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-10 w-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">End Exam?</h3>
                <p className="text-sm text-gray-500">Your progress will be saved and scored.</p>
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowEndConfirm(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 text-sm font-semibold text-gray-700 hover:bg-gray-50">
                Continue
              </button>
              <button onClick={handleEndExam}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700">
                End Exam
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PAUSE OVERLAY ────────────────────────────────────────────────────── */}
      {paused && (
        <div className="fixed inset-0 bg-[#2a2a2a]/97 z-40 flex items-center justify-center">
          <div className="text-center text-white">
            <Pause className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <p className="text-2xl font-bold mb-2">Exam Paused</p>
            <p className="text-blue-300 mb-6 text-sm">Your progress is saved. Click to resume.</p>
            <button onClick={() => setPaused(false)}
              className="px-8 py-3 bg-[#17a2b8] rounded-xl text-white font-bold hover:bg-[#138fa3] transition-colors">
              Resume Exam
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
