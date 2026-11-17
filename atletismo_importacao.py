import json
import os
import unicodedata
from pathlib import Path

import mysql.connector


def normalizar_nome(value):
    text = unicodedata.normalize("NFKD", str(value))
    text = "".join(char for char in text if not unicodedata.combining(char))
    return " ".join(text.upper().split())


def conectar():
    if os.environ.get("UCA_MYSQL_CONFIG_FILE"):
        config_path = Path(os.environ["UCA_MYSQL_CONFIG_FILE"])
    elif os.environ.get("UCA_ADMIN_CONFIG_FILE"):
        config_path = Path(os.environ["UCA_ADMIN_CONFIG_FILE"]).parent / "mysql.json"
    else:
        config_path = Path(os.environ.get("LOCALAPPDATA") or
                           os.environ.get("XDG_CONFIG_HOME") or
                           Path.home() / ".config") / "Projeto UCA" / "mysql.json"
    with config_path.open(encoding="utf-8") as file:
        saved = json.load(file)
    host = os.environ.get("MYSQL_HOST") or saved.get("host") or "127.0.0.1"
    if host not in ("127.0.0.1", "localhost", "::1"):
        raise ValueError("A importacao esta limitada ao MySQL local.")
    return mysql.connector.connect(
        host=host,
        port=int(os.environ.get("MYSQL_PORT") or saved.get("port") or 3306),
        user=os.environ.get("MYSQL_USER") or saved["user"],
        password=os.environ.get("MYSQL_PASSWORD", saved.get("password", "")),
        database="atletismo_masters",
        charset="utf8mb4",
        connection_timeout=10,
    )
