export interface MCQ { question: string; options: string[]; answer: number; explanation: string; page?: number; }
export interface Blank { question: string; answer: string; explanation?: string; page?: number; }
export interface TrueFalse { question: string; answer: boolean; explanation: string; page?: number; }
export interface Written { question: string; answer: string; page?: number; }
export interface QuizBank {
  mcq: MCQ[];
  blanks: Blank[];
  trueFalse: TrueFalse[];
  definitions: Written[];
  reasons: Written[];
  diagrams: Written[];
}
export function validBank(value: unknown): value is QuizBank {
  if (!value || typeof value !== 'object') return false;
  const q = value as Record<string, unknown>;
  const text = (v: any) => typeof v === 'string' && v.trim().length > 0;
  const list = (key: string, n: number) => Array.isArray(q[key]) && (q[key] as any[]).length === n;
  if (!list('mcq', 10) || !list('blanks', 10) || !list('trueFalse', 5) || !list('definitions', 5) || !list('reasons', 5)) return false;
  if (!Array.isArray(q.diagrams) || q.diagrams.length > 2) return false;
  return (q.mcq as any[]).every((x) => text(x.question) && Array.isArray(x.options) && x.options.length === 4 && x.options.every(text) && Number.isInteger(x.answer) && x.answer >= 0 && x.answer < 4 && text(x.explanation)) &&
    (q.blanks as any[]).every((x) => text(x.question) && text(x.answer)) &&
    (q.trueFalse as any[]).every((x) => text(x.question) && typeof x.answer === 'boolean' && text(x.explanation)) &&
    [...q.definitions as any[], ...q.reasons as any[], ...q.diagrams as any[]].every((x) => text(x.question) && text(x.answer));
}


/** Compare short answers without unfairly penalizing case, Arabic diacritics,
 *  extra whitespace, or a final punctuation mark. Free-text definitions and
 *  explanations still require manual review. */
export function normalizeShortAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '') // Arabic vowel marks
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // invisible separators
    .replace(/[\s\u00A0]+/g, ' ')
    .trim()
    .replace(/[.،,؛;!?؟]+$/g, '')
    .trim()
    .toLowerCase();
}

export function isBlankAnswerCorrect(given: string, expected: string): boolean {
  const answer = normalizeShortAnswer(given);
  return answer.length > 0 && answer === normalizeShortAnswer(expected);
}
