import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderToString } from 'react-dom/server';
import { validateAssessment, validateQuestion } from '../src/lib/validate';
import { Markdown } from '../src/components/Markdown';

test('seed files pass the same validation as the import screens', () => {
  for (const q of JSON.parse(readFileSync('seed/sample-questions.json', 'utf8'))) assert.ok(validateQuestion(q).ok, q.title);
  for (const a of JSON.parse(readFileSync('seed/sample-assessment.json', 'utf8'))) assert.ok(validateAssessment(a).ok, a.title);
  const course = JSON.parse(readFileSync('seed/sample-course-c.json', 'utf8'));
  assert.ok(course.modules[0].lessons.every((l: { title: string; content: string }) => l.title && l.content));
});
test('markdown escapes HTML (no script injection) and renders code', () => {
  const html = renderToString(<Markdown source={'<script>alert(1)</script> **b** `c`\n\n```c\nint x = 1 < 2;\n```'} />);
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(html.includes('<strong>b</strong>') && html.includes('<pre'));
});
