import importlib.util
import unittest
from datetime import date
from pathlib import Path
from unittest.mock import patch


spec = importlib.util.spec_from_file_location(
    "importar_resultados", Path(__file__).with_name("04_importar_resultados.py")
)
importador = importlib.util.module_from_spec(spec)
spec.loader.exec_module(importador)


class ImportacaoResultadosTest(unittest.TestCase):
    def test_indice_inclui_ativos_e_inativos_e_rejeita_nome_provisorio_repetido(self):
        indexed = importador.indexar_atletas([
            ("BRA 1", "ANA SILVA", date(1980, 1, 1), 1),
            ("SEM-BRA-1", "BIA SOUZA", None, 0),
        ])
        self.assertEqual(set(indexed), {"ANA SILVA", "BIA SOUZA"})
        with self.assertRaisesRegex(ValueError, "repetido"):
            importador.indexar_atletas([
                ("SEM-BRA-1", "BIA SOUZA", None, 0),
                ("SEM-BRA-2", "BIA SOUZA", None, 0),
            ])

    def test_homonimo_exige_candidatos_com_datas_conhecidas(self):
        names = {"ANA SILVA": [("BRA 1", date(1980, 1, 1)), ("BRA 2", date(1970, 1, 1))]}
        self.assertEqual(importador.selecionar("Ana Silva", "W45", 2026, names, {}), ("BRA 1", []))
        names["ANA SILVA"][1] = ("BRA 2", None)
        self.assertEqual(importador.selecionar("Ana Silva", "W45", 2026, names, {}),
                         (None, ["BRA 1", "BRA 2"]))
        self.assertEqual(importador.selecionar("Ana Silva", "W45", 2026, names,
                                              {"ANA SILVA": "BRA 2"}), ("BRA 2", []))

    def test_revezamento_deve_ter_quatro_membros_identificados(self):
        self.assertEqual(importador.members({"athletes": "Ana (W45), Bia (W50), Lia (W55), Eva (W60)"}),
                         [("Ana", "W45"), ("Bia", "W50"), ("Lia", "W55"), ("Eva", "W60")])
        self.assertIsNone(importador.members({"athletes": "Ana (W45), Bia"}))

    @patch.object(importador, "LIMIT", 2)
    @patch.object(importador, "requisitar")
    def test_grupo_no_limite_e_dividido_por_competicao(self, request):
        def responder(_session, endpoint, params):
            if endpoint == "filters":
                return {"data": ["A", "B"], "meta": {"contract_version": "1.1.0"}}
            competition = params.get("competicao")
            rows = ([{"year": 2024, "competition": "A"}, {"year": 2024, "competition": "B"}]
                    if not competition else [{"year": 2024, "competition": competition}])
            return {"data": rows, "meta": {"per_page": 2}}
        request.side_effect = responder
        rows = importador.coletar_grupo(None, {"ano": 2024})
        self.assertEqual([row["competition"] for row in rows], ["A", "B"])


if __name__ == "__main__":
    unittest.main()
