export interface ParsedMcq { text: string; options: string[]; answerIndex: number | null; explanation: string; topic: string }
export interface ParseResult { questions: ParsedMcq[]; problems: string[] }

const strip = (s: string) => s.replace(/\*\*|__/g, '').replace(/^#{1,6}\s*/, '').replace(/\s+$/g, '');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const QSTART = /^\s*(?:Q(?:uestion)?\s*\.?\s*)?(\d{1,3})\s*[.):\-]\s*(.*)$/i;
const OPT = /^\s*\(?([A-Fa-f])\s*[.):\]]\s+(.+)$/;
const ANS = /^\s*(?:the\s+)?(?:correct\s+)?(?:answer|ans)\s*(?:is)?\s*[:\-–=]?\s*(.+)$/i;
const EXPL = /^\s*(?:explanation|solution|reason|rationale)\s*[:\-–]\s*(.*)$/i;
const TOPIC = /^\s*topic\s*:\s*(.+)$/i;
const KEYHEAD = /^\s*(?:answer\s*key|answers)\s*[:\-–]?\s*(.*)$/i;

function letterIndex(token: string, options: string[]): number | null {
  const t = token.trim().replace(/^\(|\)$/g, '');
  const m = t.match(/^([A-Fa-f])(?:[.):\s]|$)/);
  if (m) { const i = m[1].toUpperCase().charCodeAt(0) - 65; return i < options.length ? i : null; }
  if (/^[1-6]$/.test(t)) { const i = Number(t) - 1; return i < options.length ? i : null; }
  const k = norm(t);
  if (k) { const i = options.findIndex((o) => norm(o) === k); if (i >= 0) return i; }
  return null;
}

/** Parses multiple-choice questions pasted from ChatGPT, Claude, Word, PDFs... */
export function parseMcqText(input: string): ParseResult {
  const lines = input.replace(/\r\n?/g, '\n').split('\n').map(strip);
  const qs: ParsedMcq[] = []; const problems: string[] = [];
  let cur: ParsedMcq | null = null; let mode: 'q' | 'opt' | 'expl' = 'q';
  let inKey = false; const key = new Map<number, string>();
  const pushCur = () => { if (cur && (cur.text || cur.options.length)) qs.push(cur); cur = null; };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const kh = line.match(KEYHEAD);
    if (kh && !ANS.test(line.replace(/^answers?\b/i, 'Answer'))) { /* fallthrough */ }
    if (kh && /^(answer\s*key|answers)\b/i.test(line) && (qs.length > 0 || cur)) {
      inKey = true;
      for (const m of kh[1].matchAll(/(\d{1,3})\s*[-.):]\s*([A-Fa-f1-6])\b/g)) key.set(Number(m[1]), m[2]);
      continue;
    }
    if (inKey) { for (const m of line.matchAll(/(\d{1,3})\s*[-.):]\s*([A-Fa-f1-6])\b/g)) key.set(Number(m[1]), m[2]); continue; }

    const ex = line.match(EXPL);
    if (ex && cur) { cur.explanation = ex[1]; mode = 'expl'; continue; }
    const tp = line.match(TOPIC);
    if (tp && cur) { cur.topic = tp[1].trim(); continue; }
    const an = line.match(ANS);
    if (an && cur && cur.options.length >= 2) {
      const idx = letterIndex(an[1], cur.options);
      if (idx === null) problems.push(`Question ${qs.length + 1}: could not understand the answer "${an[1].trim()}".`); else cur.answerIndex = idx;
      mode = 'q'; continue;
    }
    const op = line.match(OPT);
    if (op && cur && (mode === 'q' || mode === 'opt') && (cur.text !== '' || cur.options.length > 0)) { cur.options.push(op[2].trim()); mode = 'opt'; continue; }
    const qm = line.match(QSTART);
    if (qm && (!cur || cur.options.length >= 2 || mode === 'expl' || cur.answerIndex !== null)) {
      pushCur(); cur = { text: qm[2].trim(), options: [], answerIndex: null, explanation: '', topic: '' }; mode = 'q'; continue;
    }
    if (!cur) { cur = { text: line, options: [], answerIndex: null, explanation: '', topic: '' }; mode = 'q'; continue; }
    if (mode === 'expl') cur.explanation += (cur.explanation ? ' ' : '') + line;
    else if (mode === 'opt' && cur.options.length) cur.options[cur.options.length - 1] += ` ${line}`;
    else cur.text += (cur.text ? '\n' : '') + line;
  }
  pushCur();

  qs.forEach((q, i) => {
    if (q.answerIndex === null && key.has(i + 1)) q.answerIndex = letterIndex(key.get(i + 1) as string, q.options);
    if (!q.text.trim()) problems.push(`Question ${i + 1}: no question text.`);
    if (q.options.length < 2) problems.push(`Question ${i + 1}: needs at least 2 options (A, B, C...).`);
    else if (q.answerIndex === null) problems.push(`Question ${i + 1}: correct answer not found. Choose it in the preview.`);
  });
  return { questions: qs, problems };
}

export const AI_MCQ_PROMPT = (topic: string, n: number) =>
  `Create ${n} multiple-choice questions on "${topic}" for engineering college students. Use exactly this format for every question, no extra text:\n\n1. Question text?\nA) option\nB) option\nC) option\nD) option\nAnswer: B\nExplanation: one or two lines.\n\nMake sure exactly one option is correct and the answers are accurate.`;

export const AI_CODING_PROMPT = (topic: string, difficulty: string) =>
  `Create 1 ${difficulty} programming problem on "${topic}" for students. Reply with ONLY a JSON object (no markdown) with these fields: title, difficulty ("easy"|"medium"|"hard"), topic, description, inputFormat, outputFormat, constraints, languages (["c","cpp","java","python"]), examples [{input, output, explanation}], visibleTests [{input, expected}] (2 items), hiddenTests [{input, expected}] (at least 5 items including edge cases), hints [strings], editorial (short solution idea), timeLimitMs 2000, memoryLimitKb 262144, status "draft". Each test "input" is exactly what the program reads from standard input and "expected" is the exact standard output. Double-check every expected output by hand.`;
