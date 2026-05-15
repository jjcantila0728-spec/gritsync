/**
 * NCLEX AI generation — Anthropic Claude integration.
 *
 * Powers POST /api/nclex/admin/generate-questions and
 * POST /api/nclex/admin/generate-case-study. The system prompt is large and
 * static across calls, so we mark it `cache_control: ephemeral` to get the
 * ~90% prompt-cache discount on subsequent invocations within the 5-minute
 * cache window.
 *
 * The model is asked to emit a single JSON object; we strip code fences and
 * parse strictly. If the model returns an invalid envelope, the caller gets a
 * structured error and nothing is written to the DB.
 */

import Anthropic from '@anthropic-ai/sdk'

const MODEL = 'claude-opus-4-7'

let _client: Anthropic | null = null
function client(): Anthropic {
  if (_client) return _client
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured')
  _client = new Anthropic({ apiKey })
  return _client
}

// ─── format shape descriptions ───────────────────────────────────────────────
//
// Embedded directly in the system prompt so the model knows the exact JSON
// shape it must return for every supported format. Keep in sync with the
// `checkAnswer()` switch in server/routes/nclex.ts and the Question Editor
// component in src/pages/AdminNclex.tsx.

const FORMAT_SCHEMAS = `
Question formats and their JSON shapes:

- MCQ
  options: string[] (exactly 4 plausible distractors, one correct)
  correctAnswer: number (zero-based index into options)

- SATA  (Select All That Apply)
  options: string[] (5 or 6 statements)
  correctAnswer: number[] (zero-based indices, 2-4 correct)

- ORDERED_RESPONSE
  options: string[] (4-6 steps in random order)
  correctAnswer: number[] (option indices in the correct sequence)

- FILL_IN_BLANK
  options: []
  correctAnswer: { "value": number, "tolerance": number } for numeric blanks,
                 OR string for text blanks

- HIGHLIGHT_TEXT
  options: { "segments": string[] }   (the stem broken into clickable spans)
  correctAnswer: number[] (segment indices that should be highlighted)

- BOW_TIE
  options: { "actions": string[], "conditions": string[], "parameters": string[] }
  correctAnswer: { "action": number, "condition": number, "parameter": number }

- DROP_DOWN
  options: { "blanks": string[], "choices": string[][] }
    (parallel arrays: choices[i] is the dropdown for blanks[i])
  correctAnswer: number[] (one chosen index per blank)

- MATRIX_MCQ
  options: { "rows": string[], "cols": string[] }
  correctAnswer: number[] (one col index per row)

- MATRIX_SATA
  options: { "rows": string[], "cols": string[] }
  correctAnswer: number[][] (per-row array of col indices)

- DRAG_DROP
  options: { "items": string[], "targets": string[] }
  correctAnswer: number[] (target index per item, same length as items)
`.trim()

const QUESTION_SYSTEM_PROMPT = `
You are an expert NCLEX-RN item writer for a US licensure-prep platform serving Filipino nurses. You write items that are clinically accurate, free of cultural ambiguity, and aligned to the NCSBN test plan.

You MUST return a single JSON object matching the requested schema. No prose, no markdown, no code fences. Begin your response with "{" and end with "}".

${FORMAT_SCHEMAS}

Common fields on every question object you emit:
- stem: string (the question prompt; use plain prose, no markdown headings)
- options: <per-format shape above>
- correctAnswer: <per-format shape above>
- rationale: string (3-6 sentences explaining why the correct answer is correct and the distractors are wrong; cite the underlying nursing concept)
- additionalInfo: string | null (optional clinical pearls, mnemonics, or NCLEX strategy notes)
- topic: string
- subtopic: string | null
- difficulty: number in [-2.0, 2.0] (IRT b-parameter — negative is easy, positive is hard; pick a varied range across the batch)
- discrimination: number in [0.5, 2.0] (IRT a-parameter; target around 1.0)
- cognitiveSkill: one of "Recall", "Application", "Analysis"

Style rules:
- Use SI units and US generic drug names.
- Use the patient/client terminology consistently with current NCSBN guidance.
- Avoid cultural assumptions that would not generalize to a US clinical setting.
- Do not generate exam-leak items or copyrighted test bank items.
`.trim()

const CASE_STUDY_SYSTEM_PROMPT = `
You are an expert NCLEX-RN case study writer. You produce Next-Generation NCLEX (NGN) unfolding or standalone case studies for Filipino nurses preparing for the US licensure exam.

You MUST return a single JSON object. No prose, no markdown, no code fences. Begin with "{" and end with "}".

Output schema:
{
  "title": string,
  "scenario": string,                // 2-4 paragraph clinical narrative
  "tabs": [{ "label": string, "content": string }],
                                     // 3-5 tabs: e.g. "Nurses Notes",
                                     // "Vital Signs", "Lab Results", "Orders",
                                     // "History & Physical". Content should be
                                     // realistic chart data, not narrative.
  "questions": [
    {
      "format": <one of the requested formats>,
      "itemNumber": number,         // 1-indexed within the case
      "stem": string,
      "options": <per-format shape>,
      "correctAnswer": <per-format shape>,
      "rationale": string,
      "topic": string,
      "subtopic": string | null,
      "difficulty": number in [-2.0, 2.0],
      "discrimination": number in [0.5, 2.0],
      "cognitiveSkill": "Recall" | "Application" | "Analysis"
    }
  ]
}

${FORMAT_SCHEMAS}

The case must be internally consistent: vitals, labs, and orders should support the answers. For UNFOLDING cases the chart data should evolve across the question items.
`.trim()

// ─── shared helpers ──────────────────────────────────────────────────────────

function extractText(message: Anthropic.Messages.Message): string {
  return message.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

function parseJsonEnvelope<T>(text: string): T {
  // Strip leading code fences if the model adds them despite instructions.
  let s = text.trim()
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim()
  }
  // Take the first {...} block to tolerate trailing chatter.
  const first = s.indexOf('{')
  const last = s.lastIndexOf('}')
  if (first === -1 || last === -1 || last <= first) {
    throw new Error('AI response did not contain a JSON object')
  }
  return JSON.parse(s.slice(first, last + 1)) as T
}

// ─── public API ──────────────────────────────────────────────────────────────

export type GeneratedQuestion = {
  stem: string
  options: unknown
  correctAnswer: unknown
  rationale: string
  additionalInfo?: string | null
  topic?: string
  subtopic?: string | null
  difficulty?: number
  discrimination?: number
  cognitiveSkill?: string
  metadata?: Record<string, unknown>
}

export type GeneratedCaseStudy = {
  title: string
  scenario: string
  tabs: { label: string; content: string }[]
  questions: (GeneratedQuestion & { format: string; itemNumber?: number })[]
}

export type GenerateQuestionsInput = {
  format: string
  bank: 'CLASSIC' | 'NGN'
  topic: string
  count: number
  customContext?: string
}

export type GenerateCaseStudyInput = {
  caseType: 'UNFOLDING' | 'STANDALONE'
  topic: string
  formats: string[]
  customContext?: string
}

export async function generateQuestions(
  input: GenerateQuestionsInput,
): Promise<{ questions: GeneratedQuestion[]; raw: string }> {
  const { format, bank, topic, count, customContext } = input
  const userPrompt = [
    `Generate ${count} NCLEX ${bank === 'NGN' ? 'Next-Generation NCLEX' : 'classic'} question(s) in the ${format} format.`,
    `Topic: ${topic}`,
    customContext ? `Additional guidance from the educator:\n${customContext}` : null,
    '',
    'Return JSON of the form: {"questions":[ ...question objects... ]}.',
    `Each question must use format="${format}". Vary difficulty across the batch.`,
  ]
    .filter(Boolean)
    .join('\n')

  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: QUESTION_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = extractText(message)
  const parsed = parseJsonEnvelope<{ questions: GeneratedQuestion[] }>(raw)
  if (!parsed?.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI response missing "questions" array')
  }
  return { questions: parsed.questions, raw }
}

export async function generateCaseStudy(
  input: GenerateCaseStudyInput,
): Promise<{ caseStudy: GeneratedCaseStudy; raw: string }> {
  const { caseType, topic, formats, customContext } = input
  const userPrompt = [
    `Generate one ${caseType} NCLEX case study on the topic: ${topic}.`,
    `Produce ${formats.length} question(s), one per format, in this order: ${formats.join(', ')}.`,
    customContext ? `Additional guidance from the educator:\n${customContext}` : null,
    '',
    'Return a single JSON object with title, scenario, tabs, and questions.',
  ]
    .filter(Boolean)
    .join('\n')

  const message = await client().messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: [
      {
        type: 'text',
        text: CASE_STUDY_SYSTEM_PROMPT,
        cache_control: { type: 'ephemeral' },
      },
    ],
    messages: [{ role: 'user', content: userPrompt }],
  })

  const raw = extractText(message)
  const parsed = parseJsonEnvelope<GeneratedCaseStudy>(raw)
  if (!parsed?.questions || !Array.isArray(parsed.questions)) {
    throw new Error('AI response missing "questions" array')
  }
  if (typeof parsed.title !== 'string' || typeof parsed.scenario !== 'string') {
    throw new Error('AI response missing title or scenario')
  }
  return { caseStudy: parsed, raw }
}
