"""
upload_to_mongodb.py
---------------------
Importe les chunks vectorisés (avec embeddings) depuis
data/chunks_with_embeddings.json vers MongoDB Atlas.

Base de données  : rag_university
Collection       : course_chunks
"""

import json
import os
import sys
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, OperationFailure

# ── Chemins ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
ENV_FILE = BASE_DIR / ".env"
DATA_FILE = BASE_DIR / "data" / "chunks_with_embeddings.json"

# ── Paramètres MongoDB ────────────────────────────────────────────────────────
DB_NAME = "rag_university"
COLLECTION_NAME = "course_chunks"


def load_env() -> str:
    """Charge le fichier .env et retourne la chaîne de connexion MongoDB."""
    load_dotenv(dotenv_path=ENV_FILE)
    uri = os.getenv("MONGODB_URI")
    if not uri:
        raise EnvironmentError(
            "❌ Variable MONGODB_URI introuvable.\n"
            f"   Vérifie que le fichier '{ENV_FILE}' existe et contient MONGODB_URI=..."
        )
    return uri


def load_chunks(path: Path) -> list[dict]:
    """Charge les chunks depuis le fichier JSON local."""
    if not path.exists():
        raise FileNotFoundError(
            f"❌ Fichier introuvable : {path}\n"
            "   Exécute d'abord backend/generate_embeddings.py."
        )
    with open(path, "r", encoding="utf-8") as f:
        chunks = json.load(f)
    print(f"📂 {len(chunks)} chunks chargés depuis : {path.name}")
    return chunks


def connect(uri: str) -> MongoClient:
    """Crée et teste la connexion à MongoDB Atlas."""
    print("\n🔌 Connexion à MongoDB Atlas...")
    client = MongoClient(uri, serverSelectionTimeoutMS=10_000)
    # Vérifie la connexion réelle
    client.admin.command("ping")
    print("✅ Connexion établie avec succès !")
    return client


def upload(client: MongoClient, chunks: list[dict]) -> None:
    """
    Supprime les anciens documents et insère les nouveaux chunks
    dans la collection course_chunks de la base rag_university.
    """
    db = client[DB_NAME]
    collection = db[COLLECTION_NAME]

    # Suppression des anciens documents (évite les doublons)
    deleted = collection.delete_many({})
    if deleted.deleted_count > 0:
        print(f"🗑️  {deleted.deleted_count} anciens documents supprimés de '{COLLECTION_NAME}'.")
    else:
        print(f"ℹ️  Collection '{COLLECTION_NAME}' était vide — aucune suppression nécessaire.")

    # Insertion en masse (bulk insert)
    print(f"\n⬆️  Insertion de {len(chunks)} documents dans '{DB_NAME}.{COLLECTION_NAME}'...")
    result = collection.insert_many(chunks)
    print(f"✅ {len(result.inserted_ids)} documents insérés avec succès !")


def main() -> None:
    print("=" * 60)
    print("  🚀  Upload vers MongoDB Atlas — RAG Project Assistant")
    print("=" * 60)

    # 1. Chargement de l'URI depuis .env
    uri = load_env()
    print("🔑 MONGODB_URI chargée depuis .env")

    # 2. Chargement des chunks locaux
    chunks = load_chunks(DATA_FILE)

    # 3. Connexion
    try:
        client = connect(uri)
    except (ConnectionFailure, OperationFailure) as e:
        print(f"\n❌ Impossible de se connecter à MongoDB Atlas :\n   {e}")
        sys.exit(1)

    # 4. Upload
    try:
        upload(client, chunks)
    finally:
        client.close()
        print("\n🔒 Connexion fermée.")

    # 5. Résumé final
    print("\n" + "=" * 60)
    print(f"  🎉  Importation terminée !")
    print(f"      Base de données : {DB_NAME}")
    print(f"      Collection      : {COLLECTION_NAME}")
    print(f"      Documents       : {len(chunks)} chunks avec embeddings (384 dim.)")
    print("=" * 60)


if __name__ == "__main__":
    main()
