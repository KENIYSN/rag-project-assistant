"""
test_search.py
--------------
Script de test pour la recherche sémantique via MongoDB Atlas Vector Search.

Prérequis :
  - Index Atlas Vector Search nommé 'vector_index' créé sur la collection
    'course_chunks' (champ 'embedding', 384 dimensions, similarité cosinus).
  - Fichier .env contenant MONGODB_URI.
"""

import os
import sys
from pathlib import Path

from dotenv import load_dotenv

# pyrefly: ignore [missing-import]
from pymongo import MongoClient

# pyrefly: ignore [missing-import]
from sentence_transformers import SentenceTransformer

# ── Configuration ─────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

MONGODB_URI    = os.getenv("MONGODB_URI")
DB_NAME        = "rag_university"
COLLECTION     = "course_chunks"
VECTOR_INDEX   = "vector_index"
EMBEDDING_FIELD = "embedding"
MODEL_NAME     = "all-MiniLM-L6-v2"
TOP_K          = 3

# ── Question de test ──────────────────────────────────────────────────────────
TEST_QUERY = "What is NoSQL ?"


def main() -> None:
    print("=" * 60)
    print("  🔍  Test de recherche sémantique — RAG Project Assistant")
    print("=" * 60)

    # 1. Vérification de l'URI
    if not MONGODB_URI:
        print("❌ MONGODB_URI introuvable dans .env. Abandon.")
        sys.exit(1)

    # 2. Chargement du modèle d'embedding
    print(f"\n🤖 Chargement du modèle '{MODEL_NAME}'...")
    model = SentenceTransformer(MODEL_NAME)
    print("✅ Modèle prêt.")

    # 3. Vectorisation de la question
    print(f"\n❓ Question : « {TEST_QUERY} »")
    query_vector = model.encode(TEST_QUERY).tolist()
    print(f"📐 Vecteur généré ({len(query_vector)} dimensions).")

    # 4. Connexion MongoDB
    print("\n🔌 Connexion à MongoDB Atlas...")
    client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
    client.admin.command("ping")
    print("✅ Connexion établie.")

    collection = client[DB_NAME][COLLECTION]

    # 5. Pipeline $vectorSearch
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX,
                "path": EMBEDDING_FIELD,
                "queryVector": query_vector,
                "numCandidates": TOP_K * 10,   # candidats explorés (≥ limit)
                "limit": TOP_K,
            }
        },
        {
            "$project": {
                "_id": 0,
                "chunk_id": 1,
                "text": 1,
                "source_file": 1,
                "page_number": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    print(f"\n⚙️  Recherche des {TOP_K} chunks les plus pertinents...\n")
    results = list(collection.aggregate(pipeline))

    # 6. Affichage des résultats
    if not results:
        print("⚠️  Aucun résultat trouvé. Vérifie que l'index 'vector_index' est bien créé sur Atlas.")
    else:
        print("─" * 60)
        for rank, doc in enumerate(results, start=1):
            print(f"\n🏆 Résultat #{rank}")
            print(f"   chunk_id   : {doc.get('chunk_id', 'N/A')}")
            print(f"   page       : {doc.get('page_number', 'N/A')}")
            print(f"   score      : {doc.get('score', 0):.4f}")
            print(f"   texte      :\n   {'-'*40}")
            print(f"   {doc.get('text', '').strip()}")
            print(f"   {'-'*40}")

    client.close()
    print("\n✅ Test terminé.")
    print("=" * 60)


if __name__ == "__main__":
    main()
