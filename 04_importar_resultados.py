import hashlib
import json
import logging
import re
import sys
import time
from collections import Counter, defaultdict
from datetime import datetime

import mysql.connector
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from atletismo_importacao import conectar, normalizar_nome


API = "https://atletismomasters.com.br/wp-json/atletismo-rankings/v1/"
COMMON = {"type": "resultados-historicos", "filter": "brasil"}
LIMIT = 1000
PARTITIONS = (("competicao", "competition"), ("categoria", "category"),
              ("prova", "event"))
CATEGORY = re.compile(r"^[MW](\d{2,3})$", re.IGNORECASE)
MEMBER = re.compile(r"^(.*?)\s*\(([MW]\d{2,3})\)\s*$", re.IGNORECASE)


def texto(value):
    return "" if value is None else str(value).strip()


def chave(*parts):
    data = json.dumps(parts, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def requisitar(session, endpoint, params):
    response = session.get(API + endpoint, params={**COMMON, **params}, timeout=(15, 90))
    response.raise_for_status()
    payload = response.json()
    if not isinstance(payload, dict) or not isinstance(payload.get("data"), list):
        raise ValueError("A API retornou um formato inesperado.")
    if payload.get("meta", {}).get("contract_version") != "1.1.0":
        raise ValueError("A versao do contrato da API mudou.")
    return payload


def coletar_grupo(session, filtros, nivel=0):
    payload = requisitar(session, "results", {**filtros, "per_page": LIMIT})
    rows = payload["data"]
    if payload["meta"].get("per_page") != LIMIT or len(rows) > LIMIT:
        raise ValueError("O limite da API mudou; coleta interrompida.")
    for row in rows:
        if not isinstance(row, dict):
            raise ValueError("A API retornou uma linha invalida.")
        for param, field in (("ano", "year"), *PARTITIONS):
            if param in filtros and texto(row.get(field)) != texto(filtros[param]):
                raise ValueError("A API retornou linhas fora dos filtros solicitados.")
    if len(rows) < LIMIT:
        return rows
    if nivel >= len(PARTITIONS):
        raise ValueError("Um grupo atingiu o limite da API mesmo com todos os filtros.")
    param, field = PARTITIONS[nivel]
    if any(not texto(row.get(field)) for row in rows):
        raise ValueError("Grupo truncado possui valores vazios; nao e possivel dividir com seguranca.")
    values = requisitar(session, "filters", {**filtros, "field": param})["data"]
    if not values or any(not texto(value) for value in values):
        raise ValueError("A API nao forneceu filtros completos para dividir o grupo.")
    if len({texto(value) for value in values}) != len(values):
        raise ValueError("A API retornou filtros duplicados.")
    result = []
    for value in values:
        result.extend(coletar_grupo(session, {**filtros, param: value}, nivel + 1))
    if len(result) < len(rows):
        raise ValueError("A divisao por filtros perdeu resultados.")
    return result


def coletar():
    with requests.Session() as session:
        retry = Retry(total=4, backoff_factor=1, status_forcelist=(429, 500, 502, 503, 504),
                      allowed_methods=("GET",), respect_retry_after_header=True)
        session.mount("https://", HTTPAdapter(max_retries=retry))
        years = requisitar(session, "filters", {"field": "ano"})["data"]
        if not years or any(not texto(year).isdigit() for year in years):
            raise ValueError("A API nao forneceu anos validos.")
        if len({texto(year) for year in years}) != len(years):
            raise ValueError("A API retornou anos duplicados.")
        rows = []
        for year in years:
            batch = coletar_grupo(session, {"ano": year})
            rows.extend(batch)
            logging.info("Ano %s: %d linhas coletadas.", year, len(batch))
            time.sleep(0.1)
        return rows


def dados_sessao(row):
    fields = (texto(row.get("competition")), texto(row.get("year")),
              texto(row.get("edition")), texto(row.get("category")),
              texto(row.get("event")), texto(row.get("event_description")),
              texto(row.get("phase")))
    if not all(fields[i] for i in (0, 1, 2, 3, 4)) or not fields[1].isdigit():
        return None
    if not 1 <= int(fields[1]) <= 65535 or not fields[2].isdigit() or int(fields[2]) < 1:
        return None
    if any(len(value) > limit for value, limit in zip(fields, (191, 5, 50, 32, 150, 255, 100))):
        return None
    if texto(row.get("classification")) not in ("Local", "Estadual", "Nacional", "Regional"):
        return None
    if texto(row.get("frequency")) not in ("Anual", "Eventual", "Inativo"):
        return None
    return fields


def selecionar(nome, categoria, ano, por_nome, aliases):
    normalized = normalizar_nome(nome)
    if normalized in aliases:
        return aliases[normalized], []
    candidates = por_nome.get(normalized, [])
    if len(candidates) == 1:
        return candidates[0][0], []
    if len(candidates) < 2:
        return None, []
    match = CATEGORY.fullmatch(texto(categoria))
    if not match or not str(ano).isdigit():
        return None, [candidate[0] for candidate in candidates]
    lower = int(match.group(1))
    eligible = [candidate for candidate in candidates
                if candidate[1] and lower <= int(ano) - candidate[1].year < lower + 5]
    if len(eligible) == 1 and all(candidate[1] is not None for candidate in candidates):
        return eligible[0][0], []
    return None, [candidate[0] for candidate in candidates]


def data_prova(row):
    value = texto(row.get("event_date"))
    if not value:
        return None
    try:
        return datetime.strptime(value, "%d/%m/%Y").date()
    except ValueError:
        return None


def dados_pendencia(row, source_key, motivo, id_sessao=None, nome=None,
                    id_equipe=None, ordem=0, tipo="ATLETA", id_resultado=None):
    nome = texto(row.get("athlete")) if nome is None else nome
    data = (
        source_key, id_sessao, id_resultado, id_equipe, tipo, ordem,
        nome, normalizar_nome(nome), texto(row.get("team")),
        texto(row.get("competition")), texto(row.get("year")), texto(row.get("edition")),
        texto(row.get("category")), texto(row.get("event")),
        texto(row.get("event_description")), texto(row.get("phase")),
        texto(row.get("event_date")), texto(row.get("team")), motivo,
        texto(row.get("position_number")) or None, texto(row.get("original_mark")),
        texto(row.get("wind")) or None, data_prova(row), texto(row.get("event_location")) or None,
    )
    limits = (64, None, None, None, None, None, 255, 191, 191, 191, 20, 50,
              32, 150, 255, 100, 32, 191, 64, 32, 64, 32, None, 255)
    if any(limit and value is not None and len(str(value)) > limit
           for value, limit in zip(data, limits)):
        raise ValueError("Linha da API excede os limites da quarentena; importacao cancelada.")
    return data


def members(row):
    raw = row.get("athletes")
    if not isinstance(raw, str) or not raw.strip():
        return None
    parsed = []
    for item in raw.split(","):
        match = MEMBER.fullmatch(item.strip())
        if not match or not match.group(1).strip():
            return None
        parsed.append((match.group(1).strip(), match.group(2).upper()))
    return parsed if len(parsed) == 4 else None


def indexar_atletas(rows):
    por_nome = defaultdict(list)
    nomes_provisorios = set()
    for codigo, nome, nascimento, socio_ativo in rows:
        if not nome:
            continue
        if not socio_ativo:
            if nome in nomes_provisorios:
                raise ValueError("Nome normalizado repetido entre atletas inativos.")
            nomes_provisorios.add(nome)
        por_nome[nome].append((codigo, nascimento))
    return por_nome


def carregar_cadastro(cursor):
    cursor.execute("""SELECT codigo_bra, nome_normalizado, data_nascimento, socio_ativo
                      FROM atleta
                      WHERE nome_normalizado <> '' AND socio_ativo IN (0, 1)""")
    por_nome = indexar_atletas(cursor.fetchall())
    cursor.execute("SELECT nome_variacao, codigo_bra FROM atleta_alias")
    aliases = dict(cursor.fetchall())
    cursor.execute("""SELECT source_key, status, codigo_bra_resolvido
                      FROM stg_resultados_pendentes
                      WHERE status IN ('RESOLVIDO', 'IGNORADO')""")
    decisoes = {key: (status, codigo) for key, status, codigo in cursor.fetchall()}
    return por_nome, aliases, decisoes


def obter_id(cursor, table, column, value):
    queries = {
        "categoria": ("INSERT INTO categoria (codigo) VALUES (%s) ON DUPLICATE KEY UPDATE id_categoria=LAST_INSERT_ID(id_categoria)", "SELECT id_categoria FROM categoria WHERE codigo=%s"),
        "organizacao": ("INSERT INTO organizacao (nome_organizacao) VALUES (%s) ON DUPLICATE KEY UPDATE id_organizacao=LAST_INSERT_ID(id_organizacao)", "SELECT id_organizacao FROM organizacao WHERE nome_organizacao=%s"),
    }
    if (table, column) not in (("categoria", "codigo"), ("organizacao", "nome_organizacao")):
        raise ValueError("Tabela de catalogo nao permitida.")
    insert, select = queries[table]
    cursor.execute(insert, (value,))
    cursor.execute(select, (value,))
    return cursor.fetchone()[0]


def criar_sessao(cursor, row, fields, cache, race_types):
    if fields in cache:
        return cache[fields]
    competition, year, edition, category, event, description, phase = fields
    cursor.execute("SELECT id_competicao, nome_competicao, classificacao, frequencia FROM competicao WHERE nome_competicao=%s", (competition,))
    found = cursor.fetchone()
    metadata = (texto(row.get("classification")), texto(row.get("frequency")))
    if found:
        if found[1:] != (competition, *metadata):
            raise ValueError("Competicao possui metadados conflitantes; importacao cancelada.")
        competition_id = found[0]
    else:
        cursor.execute("INSERT INTO competicao (nome_competicao, classificacao, frequencia) VALUES (%s,%s,%s)", (competition, *metadata))
        competition_id = cursor.lastrowid
    cursor.execute("""INSERT INTO edicao (id_competicao, ano, numero_edicao)
                      VALUES (%s,%s,%s) ON DUPLICATE KEY UPDATE id_edicao=LAST_INSERT_ID(id_edicao)""",
                   (competition_id, int(year), edition))
    edition_id = cursor.lastrowid
    category_id = obter_id(cursor, "categoria", "codigo", category)
    race_type = race_types[(event, description)]
    cursor.execute("SELECT id_prova,tipo_prova FROM prova WHERE nome_prova=%s AND descricao=%s", (event, description))
    existing = cursor.fetchone()
    if existing:
        race_id = existing[0]
        if existing[1] != race_type and existing[1] != "MISTO":
            cursor.execute("UPDATE prova SET tipo_prova='MISTO' WHERE id_prova=%s", (race_id,))
    else:
        cursor.execute("INSERT INTO prova (nome_prova,descricao,tipo_prova) VALUES (%s,%s,%s)", (event, description, race_type))
        race_id = cursor.lastrowid
    cursor.execute("""INSERT INTO sessao_prova (id_edicao,id_prova,id_categoria,fase)
                      VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE id_sessao=LAST_INSERT_ID(id_sessao)""",
                   (edition_id, race_id, category_id, phase))
    cache[fields] = cursor.lastrowid
    return cache[fields]


def aplicar(rows):
    connection = conectar()
    totals = Counter()
    try:
        cursor = connection.cursor()
        try:
            por_nome, aliases, decisoes = carregar_cadastro(cursor)
            prepared = []
            slots = Counter()
            source_counts = Counter()
            race_kinds = defaultdict(set)
            for row in rows:
                fields = dados_sessao(row)
                relay = bool(int(row.get("is_team") or 0))
                if fields:
                    race_kinds[(fields[4], fields[5])].add("REVEZAMENTO" if relay else "INDIVIDUAL")
                participant = texto(row.get("team")) if relay else normalizar_nome(texto(row.get("athlete")))
                source_fields = fields or tuple(texto(row.get(field)) for field in (
                    "competition", "year", "edition", "category", "event", "event_description", "phase"))
                key = chave("resultado", source_fields, participant)
                source_counts[key] += 1
                decision = decisoes.get(key)
                bra = None
                candidates = []
                if not relay and participant:
                    if decision and decision[0] == "RESOLVIDO":
                        bra = decision[1]
                    elif not decision or decision[0] != "IGNORADO":
                        bra, candidates = selecionar(texto(row.get("athlete")), row.get("category"),
                                                     row.get("year"), por_nome, aliases)
                slot = (fields, "EQUIPE", participant) if relay else (fields, "ATLETA", bra)
                if fields and (participant if relay else bra):
                    slots[slot] += 1
                prepared.append((row, fields, relay, participant, key, decision, bra, candidates, slot))

            race_types = {race: next(iter(kinds)) if len(kinds) == 1 else "MISTO"
                          for race, kinds in race_kinds.items()}
            pending = []
            candidate_links = set()
            cache = {}
            for row, fields, relay, participant, key, decision, bra, candidates, slot in prepared:
                if decision and decision[0] == "IGNORADO":
                    totals["ignorados"] += 1
                    continue
                session_id = criar_sessao(cursor, row, fields, cache, race_types) if fields else None
                reason = None
                if not fields:
                    reason = "SESSAO_OU_EDICAO_INVALIDA"
                elif not participant:
                    reason = "PARTICIPANTE_AUSENTE"
                elif texto(row.get("event_date")) and data_prova(row) is None:
                    reason = "DATA_PROVA_INVALIDA"
                elif source_counts[key] > 1 or slots[slot] > 1:
                    reason = "RESULTADOS_AMBIGUOS_NA_SESSAO"
                elif not relay and not bra:
                    reason = "HOMONIMO" if candidates else "SEM_CORRESPONDENCIA"
                if reason:
                    # Preserve different colliding records without treating mark as a result identity.
                    pending_key = chave("pendencia-conflito", key, row) if reason == "RESULTADOS_AMBIGUOS_NA_SESSAO" else key
                    if relay:
                        team_members = members(row)
                        if team_members:
                            for order, (name, _) in enumerate(team_members, 1):
                                member_key = chave(pending_key, order, normalizar_nome(name))
                                pending.append(dados_pendencia(row, member_key, reason, session_id, name, ordem=order))
                        else:
                            pending.append(dados_pendencia(row, pending_key, reason, session_id, nome="", tipo="EQUIPE"))
                    else:
                        pending.append(dados_pendencia(row, pending_key, reason, session_id))
                        candidate_links.update((pending_key, candidate) for candidate in candidates)
                    totals["pendentes"] += 1
                    continue
                org = texto(row.get("team"))
                if len(org) > 191:
                    raise ValueError("Organizacao excede o limite do banco; importacao cancelada.")
                org_id = obter_id(cursor, "organizacao", "nome_organizacao", org) if org else None
                team_id = None
                if relay:
                    cursor.execute("""INSERT INTO equipe (id_sessao,id_organizacao,nome_equipe,chave_fonte)
                                      VALUES (%s,%s,%s,%s) ON DUPLICATE KEY UPDATE id_equipe=LAST_INSERT_ID(id_equipe)""",
                                   (session_id, org_id, participant, chave("equipe", fields, participant)))
                    team_id = cursor.lastrowid
                cursor.execute("SELECT id_resultado,id_sessao,codigo_bra,id_equipe FROM resultado WHERE source_key=%s", (key,))
                by_key = cursor.fetchone()
                if relay:
                    cursor.execute("SELECT id_resultado FROM resultado WHERE id_sessao=%s AND id_equipe=%s", (session_id, team_id))
                else:
                    cursor.execute("SELECT id_resultado FROM resultado WHERE id_sessao=%s AND codigo_bra=%s", (session_id, bra))
                by_slot = cursor.fetchone()
                if (by_key and (by_key[1:] != (session_id, bra, team_id))) or (by_slot and (not by_key or by_key[0] != by_slot[0])):
                    pending.append(dados_pendencia(row, key, "CONFLITO_RESULTADO_EXISTENTE", session_id, nome="" if relay else None, tipo="EQUIPE" if relay else "ATLETA"))
                    totals["pendentes"] += 1
                    continue
                result_type = "EQUIPE" if relay else "ATLETA"
                source_name = "" if relay else texto(row.get("athlete"))
                cursor.execute("""INSERT INTO resultado
                    (source_key,id_sessao,tipo_participante,codigo_bra,id_equipe,id_organizacao,
                     atleta_fonte,posicao,posicao_codigo,marca,marca_ordem,vento,data_prova,local_prova)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE id_resultado=LAST_INSERT_ID(id_resultado),
                      id_organizacao=VALUES(id_organizacao),atleta_fonte=VALUES(atleta_fonte),
                      posicao=VALUES(posicao),posicao_codigo=VALUES(posicao_codigo),
                      marca=VALUES(marca),marca_ordem=VALUES(marca_ordem),
                      vento=VALUES(vento),data_prova=VALUES(data_prova),local_prova=VALUES(local_prova)""",
                    (key, session_id, result_type, bra, team_id, org_id, source_name,
                     texto(row.get("position_number")) or None, texto(row.get("position")) or None,
                     texto(row.get("original_mark")), texto(row.get("mark_order")) or None,
                     texto(row.get("wind")) or None, data_prova(row), texto(row.get("event_location")) or None))
                result_id = by_key[0] if by_key else cursor.lastrowid
                if not result_id:
                    cursor.execute("SELECT id_resultado FROM resultado WHERE source_key=%s", (key,))
                    existing_result = cursor.fetchone()
                    if not existing_result:
                        raise ValueError("Resultado inserido sem ID recuperavel.")
                    result_id = existing_result[0]
                if not relay:
                    cursor.execute("""UPDATE stg_resultados_pendentes
                                      SET status='RESOLVIDO',codigo_bra_resolvido=%s,id_resultado=%s
                                      WHERE source_key=%s AND status='PENDENTE'""",
                                   (bra, result_id, key))
                totals["resultados"] += 1
                if relay:
                    composition = members(row)
                    if not composition:
                        raw = row.get("athletes")
                        parts = [part.strip() for part in raw.split(",") if part.strip()] if isinstance(raw, str) else []
                        if parts:
                            cursor.execute("""UPDATE stg_resultados_pendentes SET status='IGNORADO'
                                              WHERE source_key=%s AND status='PENDENTE'
                                              AND motivo='COMPOSICAO_INVALIDA'""", (chave("membros", key),))
                            for order, part in enumerate(parts, 1):
                                member_key = chave("membro-invalido", key, order, part)
                                pending.append(dados_pendencia(row, member_key, "COMPOSICAO_INVALIDA", session_id, nome=part, id_equipe=team_id, ordem=order, id_resultado=result_id))
                                totals["pendentes_membros"] += 1
                        else:
                            pending.append(dados_pendencia(row, chave("membros", key), "COMPOSICAO_INVALIDA", session_id, nome="", id_equipe=team_id, tipo="EQUIPE", id_resultado=result_id))
                            totals["pendentes_membros"] += 1
                    else:
                        for order, (name, category) in enumerate(composition, 1):
                            member_key = chave("membro", key, order, normalizar_nome(name))
                            member_decision = decisoes.get(member_key)
                            if member_decision and member_decision[0] == "IGNORADO":
                                continue
                            if member_decision and member_decision[0] == "RESOLVIDO":
                                member_bra, matches = member_decision[1], []
                            else:
                                member_bra, matches = selecionar(name, category, row.get("year"), por_nome, aliases)
                            if not member_bra:
                                pending.append(dados_pendencia(row, member_key, "HOMONIMO" if matches else "SEM_CORRESPONDENCIA", session_id, name, team_id, order, id_resultado=result_id))
                                candidate_links.update((member_key, candidate) for candidate in matches)
                                totals["pendentes_membros"] += 1
                            else:
                                cursor.execute("SELECT ordem,codigo_bra FROM equipe_composicao WHERE id_equipe=%s AND (ordem=%s OR codigo_bra=%s)", (team_id, order, member_bra))
                                existing = cursor.fetchall()
                                if existing and existing != [(order, member_bra)]:
                                    pending.append(dados_pendencia(row, member_key, "CONFLITO_COMPOSICAO", session_id, name, team_id, order, id_resultado=result_id))
                                    totals["pendentes_membros"] += 1
                                else:
                                    cursor.execute("INSERT INTO equipe_composicao (id_equipe,ordem,codigo_bra) VALUES (%s,%s,%s) ON DUPLICATE KEY UPDATE codigo_bra=VALUES(codigo_bra)", (team_id, order, member_bra))
                                    cursor.execute("""UPDATE stg_resultados_pendentes
                                                      SET status='RESOLVIDO',codigo_bra_resolvido=%s,id_resultado=%s
                                                      WHERE source_key=%s AND status='PENDENTE'""",
                                                   (member_bra, result_id, member_key))

            unique_pending = {}
            occurrences = Counter()
            for record in pending:
                key = record[0]
                if key in unique_pending and unique_pending[key] != record:
                    raise ValueError("Chave de quarentena representa registros diferentes.")
                unique_pending[key] = record
                occurrences[key] += 1
            pending_records = [(*record, occurrences[key]) for key, record in unique_pending.items()]
            for start in range(0, len(pending_records), 500):
                cursor.executemany("""INSERT INTO stg_resultados_pendentes
                    (source_key,id_sessao,id_resultado,id_equipe,tipo_participante,ordem,
                     nome_atleta_origem,nome_normalizado,nome_equipe_origem,competicao_origem,
                     ano_origem,numero_edicao_origem,categoria_origem,prova_origem,
                     descricao_prova_origem,fase_origem,data_origem,organizacao_origem,motivo,
                     posicao,marca,vento,data_prova,local_prova,ocorrencias)
                    VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
                    ON DUPLICATE KEY UPDATE
                      id_sessao=IF(status='PENDENTE',VALUES(id_sessao),id_sessao),
                      id_resultado=IF(status='PENDENTE',VALUES(id_resultado),id_resultado),
                      id_equipe=IF(status='PENDENTE',VALUES(id_equipe),id_equipe),
                      motivo=IF(status='PENDENTE',VALUES(motivo),motivo),
                      posicao=IF(status='PENDENTE',VALUES(posicao),posicao),
                      marca=IF(status='PENDENTE',VALUES(marca),marca),
                      vento=IF(status='PENDENTE',VALUES(vento),vento),
                      data_prova=IF(status='PENDENTE',VALUES(data_prova),data_prova),
                      local_prova=IF(status='PENDENTE',VALUES(local_prova),local_prova),
                      ocorrencias=IF(status='PENDENTE',VALUES(ocorrencias),ocorrencias)""",
                                   pending_records[start:start + 500])
            for source, codigo in candidate_links:
                cursor.execute("""INSERT INTO stg_pendencia_candidato (id_pendencia,codigo_bra)
                                  SELECT id_pendencia,%s FROM stg_resultados_pendentes
                                  WHERE source_key=%s AND status='PENDENTE'
                                  ON DUPLICATE KEY UPDATE codigo_bra=VALUES(codigo_bra)""", (codigo, source))
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            cursor.close()
    finally:
        connection.close()
    return totals


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    rows = coletar()
    print(f"Linhas coletadas: {len(rows)}", flush=True)
    totals = aplicar(rows)
    print("Importacao concluida:", dict(totals))


if __name__ == "__main__":
    try:
        main()
    except mysql.connector.Error as error:
        logging.error("Erro no MySQL (codigo %s): %s; transacao revertida.", error.errno, error.msg)
        sys.exit(1)
    except (requests.RequestException, OSError, ValueError) as error:
        logging.error("Coleta ou importacao falhou: %s", error)
        sys.exit(1)
