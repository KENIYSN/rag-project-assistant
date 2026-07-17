"""
api.py
------
API FastAPI exposant la recherche sémantique RAG via MongoDB Atlas Vector Search.

Routes :
  GET  /         → health check
  POST /search   → recherche sémantique (body: {"query": "..."})

Lancement :
  uvicorn backend.api:app --reload --host 0.0.0.0 --port 8000
"""

import os
import sys
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# pyrefly: ignore [missing-import]
from pymongo import MongoClient

# pyrefly: ignore [missing-import]
from sentence_transformers import SentenceTransformer

# ── Chargement de l'environnement ─────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(dotenv_path=BASE_DIR / ".env")

MONGODB_URI     = os.getenv("MONGODB_URI")
DB_NAME         = "rag_university"
COLLECTION_NAME = "course_chunks"
VECTOR_INDEX    = "vector_index"
EMBEDDING_FIELD = "embedding"
MODEL_NAME      = "all-MiniLM-L6-v2"
TOP_K           = 3

# ── Vérification au démarrage ─────────────────────────────────────────────────
if not MONGODB_URI:
    sys.exit("❌ MONGODB_URI introuvable dans .env — serveur arrêté.")

# ── Initialisation du modèle et de MongoDB (une seule fois au démarrage) ──────
print(f"🤖 Chargement du modèle '{MODEL_NAME}'...")
embedding_model = SentenceTransformer(MODEL_NAME)
print("✅ Modèle prêt.")

print("🔌 Connexion à MongoDB Atlas...")
mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=10_000)
collection   = mongo_client[DB_NAME][COLLECTION_NAME]
print(f"✅ Connecté à '{DB_NAME}.{COLLECTION_NAME}'.")

# ── Application FastAPI ───────────────────────────────────────────────────────
app = FastAPI(
    title="RAG University API",
    description="API de recherche sémantique sur les cours NoSQL via MongoDB Atlas Vector Search.",
    version="1.0.0",
)

# CORS — autorise le frontend local (React/Next.js sur localhost:3000 ou 5173)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],         # En production : remplace par l'URL exacte du frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Schémas Pydantic ──────────────────────────────────────────────────────────
class SearchRequest(BaseModel):
    query: str
    top_k: Optional[int] = TOP_K   # nombre de résultats (défaut: 3)


class ChunkResult(BaseModel):
    chunk_id: str
    text: str
    source_file: Optional[str] = None
    page_number: Optional[int] = None
    lecture_number: Optional[int] = None
    score: float


class SearchResponse(BaseModel):
    query: str
    results: List[ChunkResult]
    total: int


# ── Routes ────────────────────────────────────────────────────────────────────
@app.get("/", summary="Health Check")
def root():
    """Vérifie que l'API est opérationnelle."""
    return {
        "status": "ok",
        "message": "RAG University API est en ligne 🚀",
        "docs": "/docs",
    }


@app.post("/search", response_model=SearchResponse, summary="Recherche sémantique")
def search(request: SearchRequest):
    """
    Reçoit une question (query) en texte libre, la vectorise avec
    all-MiniLM-L6-v2, puis interroge MongoDB Atlas via $vectorSearch
    pour retourner les chunks les plus pertinents.
    """
    if not request.query.strip():
        raise HTTPException(status_code=400, detail="La query ne peut pas être vide.")

    limit = max(1, min(request.top_k, 10))  # borne entre 1 et 10

    # 1. Vectorisation de la question
    query_vector = embedding_model.encode(request.query).tolist()

    # 2. Pipeline $vectorSearch
    pipeline = [
        {
            "$vectorSearch": {
                "index": VECTOR_INDEX,
                "path": EMBEDDING_FIELD,
                "queryVector": query_vector,
                "numCandidates": limit * 10,
                "limit": limit,
            }
        },
        {
            "$project": {
                "_id": 0,
                "chunk_id": 1,
                "text": 1,
                "source_file": 1,
                "page_number": 1,
                "lecture_number": 1,
                "score": {"$meta": "vectorSearchScore"},
            }
        },
    ]

    try:
        raw_results = list(collection.aggregate(pipeline))
    except Exception as e:
        raise HTTPException(
            status_code=503,
            detail=f"Erreur MongoDB lors de la recherche : {str(e)}"
        )

    # 3. Formatage de la réponse
    results = [ChunkResult(**doc) for doc in raw_results]

    return SearchResponse(
        query=request.query,
        results=results,
        total=len(results),
    )
