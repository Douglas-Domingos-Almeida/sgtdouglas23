import importlib.util
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch

import pandas as pd


spec = importlib.util.spec_from_file_location(
    "importar_associados", Path(__file__).with_name("03_importar_associados.py")
)
importador = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importador)


class ImportacaoAssociadosTest(unittest.TestCase):
    def test_contagem_separa_codigos_existentes_de_novos(self):
        class Cursor:
            def execute(self, query, codes):
                self.codes = codes

            def fetchall(self):
                return [("BRA 2",), ("BRA 3",)]

        inserted, updated = importador.contar_existentes(
            Cursor(),
            [
                ("BRA 1", "Ana", "ANA", None, "SC"),
                ("BRA 2", "Bia", "BIA", None, "SC"),
                ("BRA 3", "Eva", "EVA", None, "SC"),
            ],
        )
        self.assertEqual((inserted, updated), (1, 2))

    def test_normalizacao_e_datas_invalidas(self):
        self.assertEqual(importador.normalizar_nome("  Ana  Ávila "), "ANA AVILA")
        self.assertEqual(importador.nascimento("31/12/2005", 2), date(2005, 12, 31))
        with self.assertLogs(level="WARNING"):
            self.assertIsNone(importador.nascimento("01/01/2006", 3))
            self.assertIsNone(importador.nascimento("31/02/1990", 4))

    @patch.object(importador, "validar_xml_ods")
    @patch.object(importador.pd, "read_excel")
    def test_bra_duplicado_bloqueia_carga(self, read_excel, _validar_xml):
        read_excel.return_value = pd.DataFrame(
            [["BRA 1", "Ana", "01/01/1980", "SC"],
             ["bra 1", "Outra", "01/01/1981", "SC"]],
            columns=["BRA", "Nome", "D. NASC", "UF"],
        )
        with self.assertRaisesRegex(ValueError, "BRA repetido"):
            importador.ler_associados("exemplo.ods")


if __name__ == "__main__":
    unittest.main()
