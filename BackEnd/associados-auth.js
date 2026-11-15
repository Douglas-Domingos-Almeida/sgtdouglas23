async function authenticateAssociado(pool, username, password) {
  if (!username || !password) return null;
  const [matches] = await pool.execute(
    'SELECT `BRA` FROM `ABRAM_SC`.`Associados` WHERE BINARY `D. NASC` = BINARY ? AND BINARY `BRA` = BINARY ? LIMIT 2',
    [username, password]
  );
  if (matches.length !== 1) return null;
  return {
    username,
    role: matches[0].BRA === 'ADMBRA 0460' ? 'admin' : 'member'
  };
}

module.exports = { authenticateAssociado };
