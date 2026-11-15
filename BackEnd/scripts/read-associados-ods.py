import json
import sys
import zipfile
import xml.etree.ElementTree as ET

TABLE = "{urn:oasis:names:tc:opendocument:xmlns:table:1.0}"
OFFICE = "{urn:oasis:names:tc:opendocument:xmlns:office:1.0}"
TEXT = "{urn:oasis:names:tc:opendocument:xmlns:text:1.0}"


def text_content(element):
    result = element.text or ""
    for child in element:
        if child.tag == TEXT + "s":
            result += " " * int(child.get(TEXT + "c", "1"))
        elif child.tag == TEXT + "tab":
            result += "\t"
        elif child.tag == TEXT + "line-break":
            result += "\n"
        else:
            result += text_content(child)
        result += child.tail or ""
    return result


def read_sheet(filename):
    with zipfile.ZipFile(filename) as archive:
        info = archive.getinfo("content.xml")
        if info.file_size > 16 * 1024 * 1024:
            raise ValueError("O conteúdo da planilha excede o limite permitido.")
        xml = archive.read(info)
    if b"<!DOCTYPE" in xml.upper() or b"<!ENTITY" in xml.upper():
        raise ValueError("Declarações DTD não são permitidas na planilha.")
    root = ET.fromstring(xml)
    sheets = root.findall(".//" + TABLE + "table")
    if len(sheets) != 1:
        raise ValueError("A planilha deve conter exatamente uma aba.")
    rows = []
    pending_empty = 0
    for row in sheets[0].findall(TABLE + "table-row"):
        values = []
        for cell in row:
            if cell.tag != TABLE + "table-cell":
                raise ValueError("A planilha contém células mescladas ou não suportadas.")
            count = int(cell.get(TABLE + "number-columns-repeated", "1"))
            kind = cell.get(OFFICE + "value-type")
            if kind not in (None, "string") or cell.get(TABLE + "formula") is not None:
                raise ValueError("A planilha contém valores ou fórmulas não textuais.")
            paragraphs = cell.findall(TEXT + "p")
            value = "\n".join(text_content(p) for p in paragraphs)
            if len(values) + count > 4:
                raise ValueError("A planilha contém mais de quatro colunas.")
            values.extend([value] * count)
        if len(values) != 4:
            raise ValueError("Uma linha não contém as quatro colunas esperadas.")
        repeat = int(row.get(TABLE + "number-rows-repeated", "1"))
        if not any(values):
            pending_empty += repeat
            continue
        if len(rows) + pending_empty + repeat > 100000:
            raise ValueError("A planilha contém linhas demais para importar.")
        rows.extend([["", "", "", ""]] * pending_empty)
        pending_empty = 0
        rows.extend([values] * repeat)
    if not rows or rows[0] != ["BRA", "Nome", "D. NASC", "UF"]:
        raise ValueError("Os cabeçalhos da planilha não correspondem aos esperados.")
    return rows[1:]


try:
    json.dump(read_sheet(sys.argv[1]), sys.stdout, ensure_ascii=True)
except (IndexError, OSError, ValueError, zipfile.BadZipFile, KeyError, ET.ParseError) as error:
    print("Falha ao ler a planilha: " + str(error), file=sys.stderr)
    sys.exit(1)
