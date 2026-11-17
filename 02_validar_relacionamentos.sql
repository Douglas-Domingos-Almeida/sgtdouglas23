USE atletismo_masters;

SELECT
  kcu.table_name AS tabela,
  kcu.constraint_name AS chave_estrangeira,
  GROUP_CONCAT(
    CONCAT(
      kcu.column_name,
      ' -> ',
      kcu.referenced_table_name,
      '.',
      kcu.referenced_column_name
    )
    ORDER BY kcu.ordinal_position
    SEPARATOR ', '
  ) AS relacionamento,
  rc.update_rule AS ao_atualizar,
  rc.delete_rule AS ao_excluir
FROM information_schema.KEY_COLUMN_USAGE kcu
JOIN information_schema.TABLE_CONSTRAINTS tc
  ON tc.constraint_schema = kcu.constraint_schema
 AND tc.table_name = kcu.table_name
 AND tc.constraint_name = kcu.constraint_name
JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
  ON rc.constraint_schema = kcu.constraint_schema
 AND rc.table_name = kcu.table_name
 AND rc.constraint_name = kcu.constraint_name
WHERE kcu.constraint_schema = 'atletismo_masters'
  AND tc.constraint_type = 'FOREIGN KEY'
  AND kcu.referenced_table_name IS NOT NULL
GROUP BY
  kcu.table_name,
  kcu.constraint_name,
  rc.update_rule,
  rc.delete_rule
ORDER BY kcu.table_name, kcu.constraint_name;

-- Teste manual da trigger:
-- Descomente e execute apenas o INSERT. Ele deve falhar com SQLSTATE 45000
-- antes de validar a FK de id_sessao.
--
-- INSERT INTO resultado
--   (source_key, id_sessao, tipo_participante, codigo_bra, id_equipe)
-- VALUES
--   (SHA2('teste-identidade-invalida', 256), 1, 'ATLETA', NULL, NULL);
