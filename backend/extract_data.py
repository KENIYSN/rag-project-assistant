import os
import json
from PyPDF2 import PdfReader  # pyrefly: ignore [missing-import]


def extract_and_chunk_pdf(file_path, course_name, lecture_num, chunk_size=800, overlap=150):
    """
    Extrait le texte d'un fichier PDF et le découpe en morceaux (chunks)
    avec chevauchement pour un usage optimal en RAG.

    Args:
        file_path    : Chemin absolu vers le fichier PDF.
        course_name  : Nom du cours (ex: "NoSQL", "Cloud_Computing").
        lecture_num  : Numéro de la leçon (ex: 1, 2, 3).
        chunk_size   : Taille maximale d'un chunk en caractères (défaut: 800).
        overlap      : Chevauchement entre deux chunks en caractères (défaut: 150).

    Returns:
        Liste de dictionnaires représentant les chunks extraits.
    """
    chunks = []

    # --- Vérification que le fichier existe ---
    if not os.path.exists(file_path):
        print(f"❌ Erreur : Le fichier est introuvable au chemin -> {os.path.abspath(file_path)}")
        return chunks

    try:
        reader = PdfReader(file_path)
        file_name = os.path.basename(file_path)
        total_pages = len(reader.pages)
        print(f"📄 PDF chargé : {file_name} ({total_pages} pages)")

        # --- Parcourir chaque page ---
        for i, page in enumerate(reader.pages):
            text = page.extract_text()

            # Ignorer les pages vides ou sans texte (ex: pages d'images scannées)
            if not text or not text.strip():
                continue

            text = text.strip()

            # --- Découpage en chunks avec chevauchement ---
            # Essentiel pour le RAG : évite de dépasser les limites de tokens des modèles
            start = 0
            chunk_idx = 1

            while start < len(text):
                end = start + chunk_size
                chunk_text = text[start:end].strip()

                if chunk_text:  # Ne pas ajouter de chunks vides
                    chunk = {
                        "chunk_id": f"{course_name}_L{lecture_num}_P{i+1}_C{chunk_idx}",
                        "text": chunk_text,
                        "source_file": file_name,
                        "lecture_number": lecture_num,
                        "page_number": i + 1,
                        "chunk_index": chunk_idx
                    }
                    chunks.append(chunk)
                    chunk_idx += 1

                # Avancer avec chevauchement pour ne pas perdre le contexte
                start += chunk_size - overlap

        print(f"✅ {len(chunks)} chunks créés depuis {total_pages} pages.")

    except Exception as e:
        print(f"❌ Erreur technique lors de la lecture du PDF : {e}")
        return []

    return chunks


def save_chunks_to_json(chunks, output_path):
    """Sauvegarde les chunks dans un fichier JSON."""
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(chunks, f, ensure_ascii=False, indent=2)
    print(f"💾 Données sauvegardées dans : {output_path}")


if __name__ == "__main__":
    # --- GESTION AUTOMATIQUE DES CHEMINS ---
    # Ce script peut être exécuté depuis n'importe quel dossier
    script_dir = os.path.dirname(os.path.abspath(__file__))
    project_root = os.path.join(script_dir, "..")
    data_dir = os.path.join(project_root, "data")

    # MODIFIEZ CES VARIABLES selon votre cours :
    NOM_FICHIER_PDF = "Big data - NOSQL Overview__.pdf"  # <- nom du PDF dans data/
    NOM_COURS = "NoSQL"
    NUMERO_LECON = 1

    pdf_path = os.path.join(data_dir, NOM_FICHIER_PDF)
    output_path = os.path.join(data_dir, "extracted_chunks.json")

    print(f"📂 Chemin du PDF : {os.path.abspath(pdf_path)}")

    # --- EXTRACTION ---
    donnees_extraites = extract_and_chunk_pdf(
        file_path=pdf_path,
        course_name=NOM_COURS,
        lecture_num=NUMERO_LECON
    )

    # --- SAUVEGARDE ET AFFICHAGE ---
    if donnees_extraites:
        save_chunks_to_json(donnees_extraites, output_path)
        print(f"\n--- Exemple du premier chunk ---")
        print(json.dumps(donnees_extraites[0], indent=4, ensure_ascii=False))
    else:
        print("\n⚠️  Aucune donnée extraite. Vérifie que le PDF contient du texte (pas seulement des images).")
