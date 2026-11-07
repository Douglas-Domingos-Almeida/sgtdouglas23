import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicSnapshot } from './public-snapshot.js';

test('exports only public collections and allowed record fields', () => {
  const result = createPublicSnapshot({
    admin: { password: 'not-public' },
    depoimentos: [{ id: '1', quote: 'Depoimento', internalNote: 'private' }],
    competicoes: [{ id: '2', image: 'data:image/png;base64,abc', secret: 'private' }],
    noticias: [{ id: '3', status: 'published', content: 'Notícia', internalNote: 'private' }]
  });
  assert.deepEqual(Object.keys(result), ['depoimentos', 'competicoes', 'noticias']);
  assert.deepEqual(result.depoimentos, [{ id: '1', quote: 'Depoimento' }]);
  assert.deepEqual(result.competicoes, [{ id: '2', image: 'data:image/png;base64,abc' }]);
  assert.deepEqual(result.noticias, [{ id: '3', content: 'Notícia', status: 'published' }]);
});

test('does not export drafts, future schedules or invalid scheduled dates', () => {
  const statuses = [
    { id: 'published', status: 'published' },
    { id: 'draft', status: 'draft' },
    { id: 'due', status: 'scheduled', publishedAt: '2026-10-30' },
    { id: 'future', status: 'scheduled', publishedAt: '2026-10-31' },
    { id: 'invalid', status: 'scheduled', publishedAt: '2026-02-30' },
    { id: 'empty', status: 'scheduled', publishedAt: '' }
  ];
  const result = createPublicSnapshot({
    depoimentos: [], competicoes: [], noticias: statuses
  }, '2026-10-30');
  assert.deepEqual(result.noticias.map((item) => item.id), ['published', 'due']);
});

test('fails explicitly for missing collections or malformed records', () => {
  assert.throws(() => createPublicSnapshot({}), /depoimentos/);
  assert.throws(() => createPublicSnapshot({
    depoimentos: [null], competicoes: [], noticias: []
  }), /registro inválido/);
});
