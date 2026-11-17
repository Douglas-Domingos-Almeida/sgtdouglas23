USE atletismo_masters;

SET @migration_sql = IF(
  (SELECT COUNT(*)
     FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'atleta'
      AND INDEX_NAME = 'uq_atleta_provisorio_nome') > 0,
  'ALTER TABLE atleta DROP INDEX uq_atleta_provisorio_nome',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*)
     FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'atleta'
      AND COLUMN_NAME = 'nome_provisorio_normalizado') > 0,
  'ALTER TABLE atleta DROP COLUMN nome_provisorio_normalizado',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*)
     FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'atleta'
      AND INDEX_NAME = 'idx_atleta_nome_status') = 0,
  'ALTER TABLE atleta ADD KEY idx_atleta_nome_status (nome_normalizado, socio_ativo)',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;

SET @migration_sql = IF(
  (SELECT COUNT(*)
     FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'prova'
      AND COLUMN_NAME = 'tipo_medida') = 0,
  'ALTER TABLE prova ADD COLUMN tipo_medida ENUM(''TEMPO'', ''DISTANCIA'', ''PONTOS'') NULL AFTER tipo_prova',
  'SELECT 1'
);
PREPARE migration_stmt FROM @migration_sql;
EXECUTE migration_stmt;
DEALLOCATE PREPARE migration_stmt;
