import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
import zipfile

READER = pathlib.Path(__file__).resolve().parents[1] / "scripts" / "read-associados-ods.py"
HEADER = "".join(
    '<table:table-cell office:value-type="string"><text:p>' + value + '</text:p></table:table-cell>'
    for value in ["BRA", "Nome", "D. NASC", "UF"]
)
START = '''<office:document-content
 xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
 xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
 xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
 <office:body><office:spreadsheet><table:table table:name="Dados">
 <table:table-row>''' + HEADER + '</table:table-row>'
END = '</table:table></office:spreadsheet></office:body></office:document-content>'


class ReadAssociadosTest(unittest.TestCase):
    def run_reader(self, body):
        with tempfile.TemporaryDirectory() as directory:
            file = pathlib.Path(directory) / "fixture.ods"
            with zipfile.ZipFile(file, "w") as archive:
                archive.writestr("content.xml", START + body + END)
            return subprocess.run([sys.executable, str(READER), str(file)], capture_output=True, text=True)

    def test_preserves_text_internal_blanks_and_row_repetitions(self):
        body = '''<table:table-row><table:table-cell office:value-type="string"><text:p>BRA<text:s/>01</text:p></table:table-cell>
        <table:table-cell office:value-type="string"><text:p>Ana</text:p></table:table-cell>
        <table:table-cell office:value-type="string"><text:p>01/02/2000</text:p></table:table-cell>
        <table:table-cell office:value-type="string"><text:p>SC</text:p></table:table-cell></table:table-row>
        <table:table-row><table:table-cell table:number-columns-repeated="4"/></table:table-row>
        <table:table-row table:number-rows-repeated="2"><table:table-cell office:value-type="string"><text:p>X</text:p></table:table-cell>
        <table:table-cell table:number-columns-repeated="3"/></table:table-row>
        <table:table-row table:number-rows-repeated="1048570"><table:table-cell table:number-columns-repeated="4"/></table:table-row>'''
        result = self.run_reader(body)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), [
            ["BRA 01", "Ana", "01/02/2000", "SC"],
            ["", "", "", ""], ["X", "", "", ""], ["X", "", "", ""]
        ])

    def test_rejects_nontext_values(self):
        result = self.run_reader('''<table:table-row><table:table-cell office:value-type="float" office:value="1"/>
        <table:table-cell table:number-columns-repeated="3"/></table:table-row>''')
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")


if __name__ == "__main__":
    unittest.main()
