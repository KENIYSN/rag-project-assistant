"""
generate_embeddings.py
----------------------
Génère les embeddings de chaque chunk textuel extrait du PDF
et sauvegarde le résultat enrichi dans data/chunks_with_embeddings.json.

Modèle utilisé : all-MiniLM-L6-v2 (sentence-transformers)
"""

import json
import os
from pathlib import Path

from sentence_transformers import SentenceTransformer

# ── Chemins ──────────────────────────────────────────────────────────────────
BASE_DIR = Path(__file__).resolve().parent.parent          # racine du projet
INPUT_FILE = BASE_DIR / "data" / "extracted_chunks.json"
OUTPUT_FILE = BASE_DIR / "data" / "chunks_with_embeddings.json"

# ── Modèle ───────────────────────────────────────────────────────────────────
MODEL_NAME = "all-MiniLM-L6-v2"


def load_chunks(path: Path) -> list[dict]:
    """Charge la liste de chunks depuis le fichier JSON."""
    if not path.exists():
        raise FileNotFoundError(
            f"❌ Fichier introuvable : {path}\n"
            "Exécute d'abord backend/extract_data.py pour générer les chunks."
        )
    with open(path, "r", encoding="utf-8") as f:
        chunks = json.load(f)
    print(f"📂 {len(chunks)} chunks chargés depuis : {path}")
    return chunks


def generate_embeddings(chunks: list[dict], model: SentenceTransformer) -> list[dict]:
    """
    Parcourt chaque chunk, génère son embedding et l'ajoute sous la clé 'embedding'.
    L'embedding NumPy est converti en liste Python pour la sérialisation JSON.
    """
    total = len(chunks)
    enriched = []

    for i, chunk in enumerate(chunks, start=1):
        chunk_id = chunk.get("chunk_id", f"chunk_{i}")
        text = chunk.get("text", "")

        print(f"  🔄 Vectorisation du chunk {i}/{total}  [{chunk_id}]...")

        embedding = model.encode(text)          # numpy.ndarray
        embedding_list = embedding.tolist()     # liste Python sérialisable

        enriched_chunk = {**chunk, "embedding": embedding_list}
        enriched.append(enriched_chunk)

    return enriched


def save_chunks(chunks: list[dict], path: Path) -> None:
    """Sauvegarde les chunks enrichis dans un fichier JSON."""
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Fichier sauvegardé : {path}")


def main() -> None:
    print("=" * 60)
    print("  🚀  Génération des embeddings — RAG Project Assistant")
    print("=" * 60)

    # 1. Chargement des chunks
    chunks = load_chunks(INPUT_FILE)

    # 2. Chargement du modèle
    print(f"\n🤖 Chargement du modèle '{MODEL_NAME}'...")
    model = SentenceTransformer(MODEL_NAME)
    print(f"✅ Modèle chargé. Dimension des vecteurs : {model.get_sentence_embedding_dimension()}\n")

    # 3. Génération des embeddings
    print(f"⚙️  Début de la vectorisation de {len(chunks)} chunks...\n")
    enriched_chunks = generate_embeddings(chunks, model)

    # 4. Sauvegarde
    save_chunks(enriched_chunks, OUTPUT_FILE)

    # 5. Vérification rapide
    sample = enriched_chunks[0]
    print("\n--- Exemple du premier chunk enrichi ---")
    print(json.dumps(
        {k: v for k, v in sample.items() if k != "embedding"},
        ensure_ascii=False,
        indent=4
    ))
    print(f"  embedding : [{sample['embedding'][0]:.6f}, {sample['embedding'][1]:.6f}, ... "
          f"({len(sample['embedding'])} dimensions)]")

    print("\n✅ Vectorisation terminée avec succès !")
    print(f"   → {len(enriched_chunks)} chunks avec embeddings → {OUTPUT_FILE}")
    print("=" * 60)


if __name__ == "__main__":
    main()
