SET NAMES utf8mb4;

CREATE DATABASE IF NOT EXISTS atletismo_masters
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE atletismo_masters;

-- Cadastro de associados e atletas historicos.
CREATE TABLE IF NOT EXISTS atleta (
  codigo_bra VARCHAR(32) NOT NULL,
  nome_completo VARCHAR(255) NOT NULL,
  nome_normalizado VARCHAR(191) NOT NULL,
  data_nascimento DATE NULL,
  uf CHAR(2) NULL,
  socio_ativo TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (codigo_bra),
  KEY idx_atleta_nome_completo (nome_completo),
  KEY idx_atleta_nome_normalizado (nome_normalizado),
  KEY idx_atleta_nome_busca (nome_normalizado, nome_completo),
  KEY idx_atleta_nome_status (nome_normalizado, socio_ativo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Variações devem ser gravadas ja normalizadas pelo importador.
CREATE TABLE IF NOT EXISTS atleta_alias (
  nome_variacao VARCHAR(191) NOT NULL,
  nome_variacao_original VARCHAR(255) NOT NULL,
  codigo_bra VARCHAR(32) NOT NULL,
  PRIMARY KEY (nome_variacao),
  KEY idx_alias_codigo_bra (codigo_bra),
  CONSTRAINT fk_alias_atleta
    FOREIGN KEY (codigo_bra) REFERENCES atleta (codigo_bra)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sequencia para codigos SEM-BRA-0001, SEM-BRA-0002 etc.
CREATE TABLE IF NOT EXISTS codigo_provisorio_seq (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Classificacao e frequencia ficam somente em competicao.
CREATE TABLE IF NOT EXISTS competicao (
  id_competicao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome_competicao VARCHAR(191) NOT NULL,
  classificacao ENUM('Local', 'Estadual', 'Nacional', 'Regional') NOT NULL,
  frequencia ENUM('Anual', 'Eventual', 'Inativo') NOT NULL,
  PRIMARY KEY (id_competicao),
  UNIQUE KEY uq_competicao_nome (nome_competicao),
  KEY idx_competicao_classificacao_frequencia (classificacao, frequencia)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS edicao (
  id_edicao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_competicao BIGINT UNSIGNED NOT NULL,
  ano SMALLINT UNSIGNED NOT NULL,
  numero_edicao VARCHAR(50) NOT NULL,
  PRIMARY KEY (id_edicao),
  UNIQUE KEY uq_edicao_competicao_ano_numero (id_competicao, ano, numero_edicao),
  KEY idx_edicao_ano (ano),
  CONSTRAINT fk_edicao_competicao
    FOREIGN KEY (id_competicao) REFERENCES competicao (id_competicao)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categoria (
  id_categoria BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  codigo VARCHAR(32) NOT NULL,
  PRIMARY KEY (id_categoria),
  UNIQUE KEY uq_categoria_codigo (codigo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- tipo_prova e validado pelas triggers de resultado abaixo.
CREATE TABLE IF NOT EXISTS prova (
  id_prova BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome_prova VARCHAR(150) NOT NULL,
  descricao VARCHAR(255) NOT NULL DEFAULT '',
  tipo_prova ENUM('INDIVIDUAL', 'REVEZAMENTO', 'MISTO')
    NOT NULL DEFAULT 'INDIVIDUAL',
  tipo_medida ENUM('TEMPO', 'DISTANCIA', 'PONTOS') NULL,
  PRIMARY KEY (id_prova),
  UNIQUE KEY uq_prova_nome_descricao (nome_prova, descricao),
  KEY idx_prova_tipo (tipo_prova)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessao_prova (
  id_sessao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_edicao BIGINT UNSIGNED NOT NULL,
  id_prova BIGINT UNSIGNED NOT NULL,
  id_categoria BIGINT UNSIGNED NOT NULL,
  fase VARCHAR(100) NOT NULL DEFAULT '',
  PRIMARY KEY (id_sessao),
  UNIQUE KEY uq_sessao (id_edicao, id_prova, id_categoria, fase),
  KEY idx_sessao_prova (id_prova),
  KEY idx_sessao_categoria (id_categoria),
  CONSTRAINT fk_sessao_edicao
    FOREIGN KEY (id_edicao) REFERENCES edicao (id_edicao)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sessao_prova
    FOREIGN KEY (id_prova) REFERENCES prova (id_prova)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_sessao_categoria
    FOREIGN KEY (id_categoria) REFERENCES categoria (id_categoria)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserva a coluna "Equipe" publicada no site, inclusive em provas individuais.
CREATE TABLE IF NOT EXISTS organizacao (
  id_organizacao BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nome_organizacao VARCHAR(191) NOT NULL,
  PRIMARY KEY (id_organizacao),
  UNIQUE KEY uq_organizacao_nome (nome_organizacao)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada equipe representa uma entrada de revezamento de uma sessao.
CREATE TABLE IF NOT EXISTS equipe (
  id_equipe BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_sessao BIGINT UNSIGNED NOT NULL,
  id_organizacao BIGINT UNSIGNED NULL,
  nome_equipe VARCHAR(191) NOT NULL,
  chave_fonte CHAR(64) NOT NULL,
  PRIMARY KEY (id_equipe),
  UNIQUE KEY uq_equipe_chave_fonte (chave_fonte),
  UNIQUE KEY uq_equipe_id_sessao (id_equipe, id_sessao),
  KEY idx_equipe_sessao (id_sessao),
  KEY idx_equipe_organizacao (id_organizacao),
  CONSTRAINT fk_equipe_sessao
    FOREIGN KEY (id_sessao) REFERENCES sessao_prova (id_sessao)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_equipe_organizacao
    FOREIGN KEY (id_organizacao) REFERENCES organizacao (id_organizacao)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Associacao atomica N:N entre equipes de revezamento e atletas.
CREATE TABLE IF NOT EXISTS equipe_composicao (
  id_equipe BIGINT UNSIGNED NOT NULL,
  ordem SMALLINT UNSIGNED NOT NULL,
  codigo_bra VARCHAR(32) NOT NULL,
  PRIMARY KEY (id_equipe, ordem),
  UNIQUE KEY uq_equipe_composicao_atleta (id_equipe, codigo_bra),
  KEY idx_composicao_codigo_bra (codigo_bra),
  CONSTRAINT fk_composicao_equipe
    FOREIGN KEY (id_equipe) REFERENCES equipe (id_equipe)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_composicao_atleta
    FOREIGN KEY (codigo_bra) REFERENCES atleta (codigo_bra)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS resultado (
  id_resultado BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_key CHAR(64) NOT NULL,
  id_sessao BIGINT UNSIGNED NOT NULL,
  tipo_participante ENUM('ATLETA', 'EQUIPE') NOT NULL,
  codigo_bra VARCHAR(32) NULL,
  id_equipe BIGINT UNSIGNED NULL,
  id_organizacao BIGINT UNSIGNED NULL,
  atleta_fonte VARCHAR(255) NOT NULL DEFAULT '',
  posicao VARCHAR(32) NULL,
  posicao_codigo VARCHAR(32) NULL,
  marca VARCHAR(64) NOT NULL DEFAULT '',
  marca_ordem VARCHAR(64) NULL,
  vento VARCHAR(32) NULL,
  data_prova DATE NULL,
  local_prova VARCHAR(255) NULL,
  PRIMARY KEY (id_resultado),
  UNIQUE KEY uq_resultado_source (source_key),
  UNIQUE KEY uq_resultado_sessao_atleta (id_sessao, codigo_bra),
  UNIQUE KEY uq_resultado_sessao_equipe (id_sessao, id_equipe),
  KEY idx_resultado_codigo_bra (codigo_bra),
  KEY idx_resultado_equipe_sessao (id_equipe, id_sessao),
  KEY idx_resultado_organizacao (id_organizacao),
  KEY idx_resultado_sessao_data (id_sessao, data_prova),
  CONSTRAINT fk_resultado_sessao
    FOREIGN KEY (id_sessao) REFERENCES sessao_prova (id_sessao)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_resultado_atleta
    FOREIGN KEY (codigo_bra) REFERENCES atleta (codigo_bra)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_resultado_equipe_sessao
    FOREIGN KEY (id_equipe, id_sessao)
    REFERENCES equipe (id_equipe, id_sessao)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_resultado_organizacao
    FOREIGN KEY (id_organizacao) REFERENCES organizacao (id_organizacao)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada pendencia corresponde a um atleta/participante, nunca a uma lista.
CREATE TABLE IF NOT EXISTS stg_resultados_pendentes (
  id_pendencia BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  source_key CHAR(64) NOT NULL,
  id_sessao BIGINT UNSIGNED NULL,
  id_resultado BIGINT UNSIGNED NULL,
  id_equipe BIGINT UNSIGNED NULL,
  tipo_participante ENUM('ATLETA', 'EQUIPE') NOT NULL,
  ordem SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  nome_atleta_origem VARCHAR(255) NOT NULL DEFAULT '',
  nome_normalizado VARCHAR(191) NOT NULL DEFAULT '',
  nome_equipe_origem VARCHAR(191) NOT NULL DEFAULT '',
  competicao_origem VARCHAR(191) NOT NULL DEFAULT '',
  ano_origem VARCHAR(20) NOT NULL DEFAULT '',
  numero_edicao_origem VARCHAR(50) NOT NULL DEFAULT '',
  categoria_origem VARCHAR(32) NOT NULL DEFAULT '',
  prova_origem VARCHAR(150) NOT NULL DEFAULT '',
  descricao_prova_origem VARCHAR(255) NOT NULL DEFAULT '',
  fase_origem VARCHAR(100) NOT NULL DEFAULT '',
  data_origem VARCHAR(32) NOT NULL DEFAULT '',
  organizacao_origem VARCHAR(191) NOT NULL DEFAULT '',
  motivo VARCHAR(64) NOT NULL,
  status ENUM('PENDENTE', 'RESOLVIDO', 'IGNORADO')
    NOT NULL DEFAULT 'PENDENTE',
  ocorrencias INT UNSIGNED NOT NULL DEFAULT 1,
  posicao VARCHAR(32) NULL,
  marca VARCHAR(64) NOT NULL DEFAULT '',
  vento VARCHAR(32) NULL,
  data_prova DATE NULL,
  local_prova VARCHAR(255) NULL,
  codigo_bra_resolvido VARCHAR(32) NULL,
  criado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_pendencia),
  UNIQUE KEY uq_stg_source (source_key),
  KEY idx_stg_status (status),
  KEY idx_stg_sessao (id_sessao),
  KEY idx_stg_nome_normalizado (nome_normalizado),
  CONSTRAINT fk_stg_sessao
    FOREIGN KEY (id_sessao) REFERENCES sessao_prova (id_sessao)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stg_resultado
    FOREIGN KEY (id_resultado) REFERENCES resultado (id_resultado)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stg_equipe
    FOREIGN KEY (id_equipe) REFERENCES equipe (id_equipe)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stg_atleta_resolvido
    FOREIGN KEY (codigo_bra_resolvido) REFERENCES atleta (codigo_bra)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Candidatos ficam em linhas separadas, sem listas ou JSON.
CREATE TABLE IF NOT EXISTS stg_pendencia_candidato (
  id_pendencia BIGINT UNSIGNED NOT NULL,
  codigo_bra VARCHAR(32) NOT NULL,
  criterio VARCHAR(32) NOT NULL DEFAULT 'NOME',
  PRIMARY KEY (id_pendencia, codigo_bra),
  KEY idx_stg_candidato_bra (codigo_bra),
  CONSTRAINT fk_stg_candidato_pendencia
    FOREIGN KEY (id_pendencia)
    REFERENCES stg_resultados_pendentes (id_pendencia)
    ON UPDATE CASCADE ON DELETE RESTRICT,
  CONSTRAINT fk_stg_candidato_atleta
    FOREIGN KEY (codigo_bra) REFERENCES atleta (codigo_bra)
    ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Remove nomes de triggers da versao anterior, se existirem.
DROP TRIGGER IF EXISTS trg_resultado_tipo_bi;
DROP TRIGGER IF EXISTS trg_resultado_tipo_bu;
DROP TRIGGER IF EXISTS trg_resultado_before_insert;
DROP TRIGGER IF EXISTS trg_resultado_before_update;

DELIMITER $$

CREATE TRIGGER trg_resultado_before_insert
BEFORE INSERT ON resultado
FOR EACH ROW
BEGIN
  DECLARE v_tipo_prova VARCHAR(20);

  IF (NEW.codigo_bra IS NULL AND NEW.id_equipe IS NULL)
     OR (NEW.codigo_bra IS NOT NULL AND NEW.id_equipe IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'Resultado invalido: informe exatamente um atleta ou uma equipe';
  END IF;

  IF (NEW.tipo_participante = 'ATLETA' AND NEW.codigo_bra IS NULL)
     OR (NEW.tipo_participante = 'EQUIPE' AND NEW.id_equipe IS NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'Resultado invalido: tipo_participante nao corresponde ao participante';
  END IF;

  SELECT COALESCE(MAX(p.tipo_prova), '')
    INTO v_tipo_prova
  FROM sessao_prova sp
  JOIN prova p ON p.id_prova = sp.id_prova
  WHERE sp.id_sessao = NEW.id_sessao;

  IF v_tipo_prova = '' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Sessao/prova inexistente para o resultado';
  ELSEIF v_tipo_prova = 'REVEZAMENTO'
      AND NEW.tipo_participante <> 'EQUIPE' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Prova de revezamento exige participante EQUIPE';
  ELSEIF v_tipo_prova = 'INDIVIDUAL'
      AND NEW.tipo_participante <> 'ATLETA' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Prova individual exige participante ATLETA';
  END IF;
END$$

CREATE TRIGGER trg_resultado_before_update
BEFORE UPDATE ON resultado
FOR EACH ROW
BEGIN
  DECLARE v_tipo_prova VARCHAR(20);

  IF (NEW.codigo_bra IS NULL AND NEW.id_equipe IS NULL)
     OR (NEW.codigo_bra IS NOT NULL AND NEW.id_equipe IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'Resultado invalido: informe exatamente um atleta ou uma equipe';
  END IF;

  IF (NEW.tipo_participante = 'ATLETA' AND NEW.codigo_bra IS NULL)
     OR (NEW.tipo_participante = 'EQUIPE' AND NEW.id_equipe IS NULL) THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT =
        'Resultado invalido: tipo_participante nao corresponde ao participante';
  END IF;

  SELECT COALESCE(MAX(p.tipo_prova), '')
    INTO v_tipo_prova
  FROM sessao_prova sp
  JOIN prova p ON p.id_prova = sp.id_prova
  WHERE sp.id_sessao = NEW.id_sessao;

  IF v_tipo_prova = '' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Sessao/prova inexistente para o resultado';
  ELSEIF v_tipo_prova = 'REVEZAMENTO'
      AND NEW.tipo_participante <> 'EQUIPE' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Prova de revezamento exige participante EQUIPE';
  ELSEIF v_tipo_prova = 'INDIVIDUAL'
      AND NEW.tipo_participante <> 'ATLETA' THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Prova individual exige participante ATLETA';
  END IF;
END$$

DELIMITER ;

CREATE OR REPLACE VIEW vw_resultados_completos AS
SELECT
  r.id_resultado,
  'ATLETA' AS tipo_participante,
  a.codigo_bra,
  a.nome_completo,
  c.nome_competicao,
  c.classificacao,
  c.frequencia,
  ed.ano,
  cat.codigo AS categoria,
  p.nome_prova,
  p.descricao AS descricao_prova,
  sp.fase,
  r.posicao,
  org.nome_organizacao AS equipe_fonte,
  r.marca,
  r.vento,
  r.data_prova,
  r.local_prova
FROM resultado r
JOIN atleta a ON a.codigo_bra = r.codigo_bra
JOIN sessao_prova sp ON sp.id_sessao = r.id_sessao
JOIN edicao ed ON ed.id_edicao = sp.id_edicao
JOIN competicao c ON c.id_competicao = ed.id_competicao
JOIN categoria cat ON cat.id_categoria = sp.id_categoria
JOIN prova p ON p.id_prova = sp.id_prova
LEFT JOIN organizacao org ON org.id_organizacao = r.id_organizacao
WHERE r.tipo_participante = 'ATLETA'

UNION ALL

SELECT
  r.id_resultado,
  'EQUIPE' AS tipo_participante,
  a.codigo_bra,
  a.nome_completo,
  c.nome_competicao,
  c.classificacao,
  c.frequencia,
  ed.ano,
  cat.codigo AS categoria,
  p.nome_prova,
  p.descricao AS descricao_prova,
  sp.fase,
  r.posicao,
  COALESCE(org.nome_organizacao, eq.nome_equipe) AS equipe_fonte,
  r.marca,
  r.vento,
  r.data_prova,
  r.local_prova
FROM resultado r
JOIN equipe eq ON eq.id_equipe = r.id_equipe
JOIN equipe_composicao ec ON ec.id_equipe = eq.id_equipe
JOIN atleta a ON a.codigo_bra = ec.codigo_bra
JOIN sessao_prova sp ON sp.id_sessao = r.id_sessao
JOIN edicao ed ON ed.id_edicao = sp.id_edicao
JOIN competicao c ON c.id_competicao = ed.id_competicao
JOIN categoria cat ON cat.id_categoria = sp.id_categoria
JOIN prova p ON p.id_prova = sp.id_prova
LEFT JOIN organizacao org ON org.id_organizacao = r.id_organizacao
WHERE r.tipo_participante = 'EQUIPE';
