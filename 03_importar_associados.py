import logging
import sys
from datetime import date, datetime
from pathlib import Path
from zipfile import ZipFile

import pandas as pd
import mysql.connector
from defusedxml import sax
from xml.sax.handler import ContentHandler

from atletismo_importacao import conectar, normalizar_nome


PLANILHA = Path.home() / "Downloads" / "Associados_ABRAM_SC.ods"
LOTE_TAMANHO = 500


def validar_xml_ods(path):
    with ZipFile(path) as archive:
        for item in archive.infolist():
            if item.file_size and item.filename.lower().endswith(".xml"):
                with archive.open(item) as source:
                    sax.parse(source, ContentHandler(), forbid_dtd=True)


def nascimento(value, linha):
    if pd.isna(value) or not str(value).strip():
        logging.warning("Linha %d: nascimento ausente; gravado como NULL.", linha)
        return None
    try:
        if isinstance(value, (date, datetime)):
            parsed = pd.Timestamp(value)
        else:
            parsed = pd.to_datetime(str(value).strip(), format="%d/%m/%Y", errors="raise")
        if pd.isna(parsed) or not 1915 <= parsed.year <= 2005:
            raise ValueError("ano fora da faixa permitida")
        return parsed.date()
    except (ValueError, TypeError, OverflowError):
        logging.warning("Linha %d: nascimento invalido ou fora de 1915-2005; gravado como NULL.", linha)
        return None


def ler_associados(path):
    validar_xml_ods(path)
    frame = pd.read_excel(path, engine="odf", dtype=object)
    frame.columns = [normalizar_nome(column) for column in frame.columns]
    required = ("BRA", "NOME", "D. NASC", "UF")
    if not set(required).issubset(frame.columns) or not frame.columns.is_unique:
        raise ValueError("A planilha nao contem cabecalhos unicos BRA, NOME, D. NASC e UF.")
    records = []
    seen = set()
    for row_index, row in frame.iterrows():
        if all(pd.isna(row[field]) or not str(row[field]).strip() for field in required):
            continue
        codigo = "" if pd.isna(row["BRA"]) else " ".join(str(row["BRA"]).upper().split())
        nome = "" if pd.isna(row["NOME"]) else " ".join(str(row["NOME"]).split())
        uf = None if pd.isna(row["UF"]) or not str(row["UF"]).strip() else str(row["UF"]).strip().upper()
        normalizado = normalizar_nome(nome)
        if not codigo or len(codigo) > 32 or not nome or len(nome) > 255 or len(normalizado) > 191:
            raise ValueError(f"Linha {row_index + 2}: BRA ou nome invalido.")
        if uf and (len(uf) != 2 or not uf.isascii() or not uf.isalpha()):
            raise ValueError(f"Linha {row_index + 2}: UF invalida.")
        if codigo in seen:
            raise ValueError(f"Linha {row_index + 2}: BRA repetido na planilha.")
        seen.add(codigo)
        records.append((codigo, nome, normalizado, nascimento(row["D. NASC"], row_index + 2), uf))
    if not records:
        raise ValueError("A planilha nao contem associados.")
    return records


def contar_existentes(cursor, records):
    existing = set()
    for offset in range(0, len(records), LOTE_TAMANHO):
        codes = [record[0] for record in records[offset:offset + LOTE_TAMANHO]]
        placeholders = ", ".join(["%s"] * len(codes))
        cursor.execute(
            f"SELECT codigo_bra FROM atleta WHERE codigo_bra IN ({placeholders}) FOR UPDATE",
            tuple(codes),
        )
        existing.update(row[0] for row in cursor.fetchall())
    return len(records) - len(existing), len(existing)


def main():
    logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
    records = ler_associados(PLANILHA)
    connection = conectar()
    try:
        cursor = connection.cursor()
        try:
            inserted, updated = contar_existentes(cursor, records)
            cursor.executemany(
                """INSERT INTO atleta
                   (codigo_bra, nome_completo, nome_normalizado, data_nascimento, uf, socio_ativo)
                   VALUES (%s, %s, %s, %s, %s, 1)
                   ON DUPLICATE KEY UPDATE nome_completo=VALUES(nome_completo),
                       nome_normalizado=VALUES(nome_normalizado),
                       data_nascimento=VALUES(data_nascimento), uf=VALUES(uf),
                       socio_ativo=1""",
                records,
            )
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            cursor.close()
    finally:
        connection.close()
    print(f"Registros inseridos: {inserted}")
    print(f"Registros atualizados: {updated}")


if __name__ == "__main__":
    try:
        main()
    except mysql.connector.Error as error:
        logging.error("Importacao de associados falhou no MySQL (codigo %s).", error.errno)
        sys.exit(1)
    except (OSError, ValueError) as error:
        logging.error("Importacao de associados falhou: %s", error)
        sys.exit(1)
