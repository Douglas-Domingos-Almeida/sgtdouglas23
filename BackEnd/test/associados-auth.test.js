const assert = require('node:assert/strict');
const { test } = require('node:test');
const { authenticateAssociado } = require('../associados-auth');

function poolFor(rows) {
  return {
    async execute(query, parameters) {
      assert.match(query, /BINARY `D\. NASC` = BINARY \?/);
      assert.match(query, /BINARY `BRA` = BINARY \?/);
      return [rows.filter((row) => row.date === parameters[0] && row.BRA === parameters[1])];
    }
  };
}

test('associados autenticam com valores exatos e somente o BRA indicado é administrador', async () => {
  const pool = poolFor([
    { date: '01/02/2000', BRA: 'ADMBRA 0460' },
    { date: '02/03/2001', BRA: 'BRA 0001' }
  ]);
  assert.equal((await authenticateAssociado(pool, '01/02/2000', 'ADMBRA 0460')).role, 'admin');
  assert.equal((await authenticateAssociado(pool, '02/03/2001', 'BRA 0001')).role, 'member');
  assert.equal(await authenticateAssociado(pool, '01/02/2000 ', 'ADMBRA 0460'), null);
  assert.equal(await authenticateAssociado(pool, '01/02/2000', 'admbra 0460'), null);
  assert.equal(await authenticateAssociado(pool, '', ''), null);
});

test('credenciais duplicadas não autenticam e erros de banco são propagados', async () => {
  const row = { date: '01/02/2000', BRA: 'BRA 0001' };
  assert.equal(await authenticateAssociado(poolFor([row, row]), row.date, row.BRA), null);
  await assert.rejects(authenticateAssociado({
    async execute() { throw new Error('banco indisponível'); }
  }, row.date, row.BRA), /banco indisponível/);
});
