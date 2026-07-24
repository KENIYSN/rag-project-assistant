# Rapport de Projet — RAG University Assistant
### Retrieval-Augmented Generation pour l'Enseignement Universitaire

---

## Informations Générales

| Champ | Détail |
|-------|--------|
| **Nom du projet** | RAG University Assistant |
| **Type** | Application fullstack — Retrieval-Augmented Generation (RAG) |
| **Auteur principal** | Esserdaoui Yassine |
| **Dépôt GitHub** | https://github.com/KENIYSN/rag-project-assistant |
| **Dernier commit** | `f888aa6` — "fix error" |
| **Période de développement** | Juillet 2026 |
| **Environnement** | macOS · Python 3.9 · Node.js 20 |

---

## 1. Contexte et Objectifs du Projet

### 1.1 Problématique

Les étudiants universitaires disposent de nombreux cours en format PDF mais manquent d'outils pour interagir avec ce contenu de manière intelligente. Parcourir des dizaines de pages pour trouver une réponse précise est chronophage et peu efficace.

### 1.2 Solution Développée

Le projet **RAG University Assistant** est un assistant pédagogique intelligent basé sur la technique **Retrieval-Augmented Generation (RAG)**. Il permet à un étudiant de :

- Poser des questions en langage naturel sur ses cours
- Uploader n'importe quel PDF de cours en temps réel
- Recevoir des réponses précises générées par un LLM, **basées exclusivement sur le contenu du cours**
- Voir les sources citées (fichier, page) pour chaque réponse

### 1.3 Principe du RAG

La technique RAG combine deux approches :
1. **Retrieval** : Recherche des passages les plus pertinents dans une base vectorielle
2. **Generation** : Un LLM génère une réponse en se basant uniquement sur ces passages récupérés

Cela évite les hallucinations tout en permettant des réponses structurées et académiques.

---

## 2. Architecture Générale du Système

```
NAVIGATEUR (port 3000)
│
│  ChatBar → ChatInterface → MessageList → MessageBubble
│       │
│       ├─ 1. Upload PDF → FormData → POST /upload_course (FastAPI)
│       └─ 2. Question → POST /api/chat (Next.js server route)
│
├── FastAPI Backend (port 8000)
│   ├── POST /upload_course : PyMuPDF → Chunking → Embeddings → MongoDB
│   └── POST /search        : encode(query) → $vectorSearch → $match → results
│
├── MongoDB Atlas
│   └── rag_university.course_chunks (index: vector_index, 384 dims, cosinus)
│
└── OpenRouter (google/gemma-4-26b-a4b-it:free)
    └── Streaming SSE → token par token → navigateur
```

---

## 3. Phases de Développement et Tâches Réalisées

### Phase 1 — Extraction et Préparation des Données

**Fichier :** `backend/extract_data.py` (116 lignes)

**Tâches accomplies :**

- [x] Développement d'un extracteur PDF en Python avec PyPDF2
- [x] Implémentation d'une logique de chunking avec chevauchement (sliding window)
  - Taille de chunk : **800 caractères**
  - Chevauchement : **150 caractères** (évite de couper le contexte)
- [x] Enrichissement des chunks avec métadonnées structurées :
  - `chunk_id` : identifiant unique composé (ex: `NoSQL_L1_P3_C2`)
  - `source_file` : nom du fichier PDF source
  - `lecture_number` : numéro de la leçon
  - `page_number` : numéro de la page d'origine
  - `chunk_index` : index du chunk dans la page
- [x] Sérialisation de la sortie en JSON (`data/extracted_chunks.json`)
- [x] Gestion des pages vides et erreurs de lecture PDF

---

### Phase 2 — Génération des Embeddings

**Fichier :** `backend/generate_embeddings.py` (107 lignes)

**Tâches accomplies :**

- [x] Intégration du modèle `all-MiniLM-L6-v2` via `sentence-transformers`
  - Modèle léger, open-source, performant pour les phrases courtes
  - Produit des vecteurs de **384 dimensions**
  - Similarité cosinus pour la recherche
- [x] Vectorisation séquentielle de chaque chunk avec logs de progression
- [x] Conversion des tableaux NumPy en listes Python sérialisables en JSON
- [x] Sauvegarde dans `data/chunks_with_embeddings.json` (23 248 lignes, 665 KB)
- [x] Vérification du premier chunk comme exemple de sortie

---

### Phase 3 — Configuration MongoDB Atlas et Vector Search

**Tâches accomplies :**

- [x] Création du cluster MongoDB Atlas (cloud, tier gratuit M0)
- [x] Import manuel du fichier `chunks_with_embeddings.json` dans `rag_university.course_chunks`
- [x] Configuration de l'index Vector Search :
  - Nom : `vector_index`
  - Champ : `embedding`
  - Dimensions : 384
  - Similarité : **cosinus**
- [x] Configuration de `MONGODB_URI` dans `.env`
- [x] Test de connexion et validation de l'index

**Structure d'un document MongoDB :**
```json
{
  "chunk_id":       "NoSQL_L1_P3_C2",
  "text":           "MongoDB is a document-oriented NoSQL database...",
  "source_file":    "Big data - NOSQL Overview__.pdf",
  "lecture_number": 1,
  "page_number":    3,
  "chunk_index":    2,
  "embedding":      [-0.027, 0.062, ..., 0.031]
}
```

---

### Phase 4 — Développement du Backend FastAPI

**Fichier :** `backend/api.py` (317 lignes)

#### Route GET `/` — Health Check
- [x] Endpoint de vérification que le serveur est opérationnel

#### Route POST `/search` — Recherche Sémantique
- [x] Réception de la requête `{ query, top_k, source_file? }`
- [x] Validation de la query et bornes sur `top_k`
- [x] Vectorisation de la question avec `embedding_model.encode()`
- [x] Pipeline MongoDB Aggregation : `$vectorSearch → [$match] → $limit → $project`
- [x] **Filtre `source_file` optionnel** : isolation des chunks par PDF
  - `numCandidates` adaptatif : `limit × 20` avec filtre
  - `limit` pré-filtre : `limit × 4`
- [x] Retour des résultats avec scores de pertinence et métadonnées

#### Route POST `/upload_course` — Ingestion Dynamique de PDF
- [x] Réception via `UploadFile` (multipart/form-data)
- [x] Validation de l'extension `.pdf`
- [x] Lecture en mémoire avec `await file.read()`
- [x] Extraction du texte page par page via **PyMuPDF (fitz)**
- [x] Chunking : 500 mots, overlap 50 mots
- [x] Vectorisation batch : `embedding_model.encode(chunks)` (modèle déjà en RAM)
- [x] Documents MongoDB avec UUID v4 comme `chunk_id`
- [x] Insertion via `insert_many(ordered=False)` — robuste aux erreurs partielles
- [x] Réponse `{ filename, chunks_inserted, message }`

#### Aspects Transversaux
- [x] Modèle `all-MiniLM-L6-v2` chargé **une seule fois** au démarrage (singleton)
- [x] Import conditionnel de `fitz` — le serveur démarre même si PyMuPDF est absent
- [x] Schémas Pydantic : `SearchRequest`, `SearchResponse`, `ChunkResult`, `UploadResponse`
- [x] CORS configuré pour autoriser le frontend local
- [x] Gestion des erreurs HTTP : 400, 422, 500, 503

---

### Phase 5 — Développement du Frontend Next.js

**Architecture :**
```
src/
├── app/
│   ├── globals.css         # Design system (957 lignes)
│   └── api/chat/
│       └── route.js        # Orchestrateur RAG server-side (144 lignes)
└── components/
    ├── ChatInterface.jsx   # Composant principal (283 lignes)
    ├── ChatBar.jsx         # Saisie + upload (110 lignes)
    ├── MessageList.jsx     # Liste messages (13 lignes)
    └── MessageBubble.jsx   # Rendu markdown + sources (108 lignes)
```

#### ChatInterface.jsx
- [x] 4 états React : `messages`, `isStreaming`, `isUploading`, `activeSource`
- [x] Flux upload PDF : FormData → `/upload_course` → confirmation "✅ N chunks indexés"
- [x] Stockage du fichier actif dans `activeSource` pour les questions suivantes
- [x] Indicateur "📚 Source active : *nom.pdf*" avec bouton ✕
- [x] Blocage de l'input pendant upload ET pendant streaming (états séparés)
- [x] Chips de suggestions de questions (écran vide)

#### Route API `/api/chat` — Orchestrateur RAG (Server-side)
- [x] Clé API OpenRouter **protégée côté serveur** — jamais exposée au navigateur
- [x] Appel `/search` FastAPI avec `{ query, top_k: 5, source_file?: fileName }`
- [x] Construction du system prompt RAG :
  ```
  "You are a university course assistant.
  ONLY use the provided context. Never hallucinate.
  [Source 1: fichier.pdf] Texte du chunk..."
  ```
- [x] Appel OpenRouter `google/gemma-4-26b-a4b-it:free` en mode `stream: true`
- [x] Flux SSE : `{ type: "sources" }` → `{ type: "token" }` → `{ type: "done" }`

#### MessageBubble.jsx
- [x] Rendu **Markdown** avec `react-markdown` + `remark-gfm`
- [x] Coloration syntaxique (`react-syntax-highlighter`, thème OneLight)
- [x] Animation "points clignotants" pendant réflexion du LLM
- [x] Curseur de frappe animé pendant le streaming
- [x] Chips de sources (nom fichier + numéro de page) après chaque réponse

#### Design System (globals.css)
- [x] Variables CSS complètes : couleurs, ombres, rayons, transitions, typographie Geist
- [x] Interface "clean/minimal" inspirée des assistants IA modernes
- [x] Glassmorphisme léger sur éléments flottants
- [x] Micro-animations : hover, focus, transitions 200ms/300ms cubic-bezier

---

### Phase 6 — Script de Test

**Fichier :** `backend/test_search.py` (115 lignes)

- [x] Validation standalone de la recherche sémantique MongoDB
- [x] Vectorise une question test ("What is NoSQL ?")
- [x] Exécute `$vectorSearch` directement et affiche les top-3 résultats avec scores

---

### Phase 7 — Portabilité et Requirements

**Fichier :** `requirements.txt`

- [x] Génération complète via `pip freeze` sur le venv actif
- [x] **38 packages** avec versions exactes pinned
- [x] Organisation par groupes commentés (Web, MongoDB, ML, PDF, Utils)
- [x] Instructions d'installation intégrées dans le fichier

---

## 4. Inventaire Complet des Fichiers

### Backend Python

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `backend/api.py` | 317 | API FastAPI principale — 3 routes |
| `backend/extract_data.py` | 116 | Extraction PDF hors-ligne (PyPDF2) |
| `backend/generate_embeddings.py` | 107 | Génération embeddings hors-ligne |
| `backend/test_search.py` | 115 | Script de validation de la recherche |
| `requirements.txt` | ~60 | 38 dépendances Python avec versions |
| `.env` | 1 | MONGODB_URI (non committé) |

### Données

| Fichier | Taille | Contenu |
|---------|--------|---------|
| `data/Big data - NOSQL Overview__.pdf` | — | PDF source du cours NoSQL |
| `data/extracted_chunks.json` | variable | Chunks bruts (PyPDF2) |
| `data/chunks_with_embeddings.json` | 665 KB / 23 248 lignes | Chunks + vecteurs 384d |

### Frontend Next.js / React

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `src/app/api/chat/route.js` | 144 | Orchestrateur RAG server-side |
| `src/components/ChatInterface.jsx` | 283 | Composant principal — logique upload + chat |
| `src/components/ChatBar.jsx` | 110 | Input + bouton fichier + envoi |
| `src/components/MessageBubble.jsx` | 108 | Rendu markdown, sources, animations |
| `src/components/MessageList.jsx` | 13 | Liste des bulles de messages |
| `src/app/globals.css` | 957 | Design system complet |
| `frontend/.env.local` | 14 | Clés API (non committé) |
| `frontend/package.json` | 20 | Dépendances NPM |

---

## 5. Stack Technique Complète

### Backend Python — 38 packages

| Catégorie | Package | Version |
|-----------|---------|---------|
| **Web** | fastapi | 0.128.8 |
| | uvicorn | 0.39.0 |
| | starlette | 0.49.3 |
| | python-multipart | 0.0.20 |
| **Validation** | pydantic | 2.13.4 |
| | pydantic_core | 2.46.4 |
| **Base de données** | pymongo | 4.17.0 |
| | dnspython | 2.7.0 |
| **ML / Embeddings** | sentence-transformers | 5.1.2 |
| | transformers | 4.57.6 |
| | torch | 2.8.0 |
| | tokenizers | 0.22.2 |
| | safetensors | 0.7.0 |
| | huggingface_hub | 0.36.2 |
| | scikit-learn | 1.6.1 |
| | scipy | 1.13.1 |
| | numpy | 2.0.2 |
| **PDF** | PyMuPDF | 1.26.5 |
| | PyPDF2 | 3.0.1 |
| **Env & Utils** | python-dotenv | 1.2.1 |
| | requests | 2.32.5 |
| | tqdm | 4.68.4 |

### Frontend Node.js — 7 packages NPM

| Package | Version | Rôle |
|---------|---------|------|
| `next` | ^16.2.11 | Framework React fullstack |
| `react` | 19.2.4 | Library UI |
| `react-dom` | 19.2.4 | Rendu DOM |
| `@openrouter/sdk` | ^0.13.65 | Client LLM OpenRouter |
| `react-markdown` | ^10.1.0 | Rendu Markdown dans les bulles |
| `react-syntax-highlighter` | ^16.1.1 | Coloration syntaxique du code |
| `remark-gfm` | ^4.0.1 | Support GitHub Flavored Markdown |

### Infrastructure Cloud

| Service | Configuration |
|---------|---------------|
| **MongoDB Atlas** | Cluster M0 gratuit · Index `vector_index` · 384 dims · similarité cosinus |
| **OpenRouter** | Modèle `google/gemma-4-26b-a4b-it:free` · Streaming activé |

---

## 6. Difficultés Rencontrées et Solutions Apportées

### Difficulté 1 — `python-multipart` manquant dans le venv

| | |
|-|-|
| **Symptôme** | Crash serveur au rechargement : `RuntimeError: Form data requires "python-multipart"` |
| **Cause** | Dépendance absente du virtualenv |
| **Solution** | `source venv/bin/activate && pip install python-multipart` |
| **Leçon** | FastAPI ne détecte l'absence de `python-multipart` qu'à la définition de la route avec `UploadFile`, pas au démarrage. |

---

### Difficulté 2 — Architecture d'upload incorrecte (bug fonctionnel majeur)

| | |
|-|-|
| **Symptôme** | Après upload d'un PDF (ex: `cours_propriete_intellectuelle_maroc.pdf`), le LLM répondait systématiquement "I don't have enough information in the course materials to answer this question." |
| **Cause racine** | Le frontend utilisait `file.text()` pour lire le PDF côté navigateur et injectait ce texte brut dans le system prompt. **Les chunks n'étaient jamais indexés dans MongoDB.** La recherche vectorielle retournait uniquement les chunks du cours Big Data. |
| **Solution** | Refactoring complet du flux : (1) Upload réel via FormData vers `/upload_course`, (2) ingestion complète dans MongoDB, (3) état React `activeSource`, (4) transmission de `source_file` dans `/search`, (5) filtre `$match` dans le pipeline MongoDB. |
| **Leçon** | `file.text()` sur un PDF retourne du texte encodé binaire illisible. Le traitement sémantique d'un PDF nécessite obligatoirement une bibliothèque dédiée côté serveur (PyMuPDF, pdfminer, etc.). |

---

### Difficulté 3 — `pymupdf` installé dans le mauvais interpréteur Python

| | |
|-|-|
| **Symptôme** | `import fitz` fonctionnait depuis le terminal mais échouait dans `uvicorn` |
| **Cause** | Installation avec `python3` système (macOS) au lieu du `python3` du venv |
| **Solution** | `source venv/bin/activate && pip install pymupdf` + import conditionnel dans `api.py` |
| **Leçon** | Sur macOS, toujours vérifier avec `which python3`. Préférer `python -m pip install` pour garantir le bon interpréteur. |

---

### Difficulté 4 — Mélange des résultats entre PDFs différents

| | |
|-|-|
| **Symptôme** | Même après upload d'un nouveau PDF, les réponses portaient parfois sur le cours Big Data |
| **Cause** | `$vectorSearch` sans filtre interrogeait toute la collection. Les chunks Big Data, plus nombreux, obtenaient de meilleurs scores de similarité. |
| **Solution** | Paramètre `source_file: Optional[str]` dans `SearchRequest` + étape `$match` post-`$vectorSearch` avec `numCandidates` et `limit` adaptés. |
| **Leçon** | Dans un RAG multi-documents, il est indispensable de gérer l'isolement des sources. |

---

### Difficulté 5 — `requirements.txt` incomplet

| | |
|-|-|
| **Symptôme** | Le fichier ne contenait qu'une ligne (`PyPDF2==3.0.1`), projet non reproductible |
| **Cause** | Fichier jamais mis à jour après installation progressive des dépendances |
| **Solution** | `pip freeze` → annotation par catégories → 38 packages avec versions pinned |
| **Leçon** | Mettre à jour `requirements.txt` après chaque `pip install`. |

---

## 7. Compétences Acquises et Approfondies

### Python / Backend

| Compétence | Statut |
|------------|--------|
| FastAPI — routes, middleware CORS, schémas Pydantic | ✅ Maîtrisé |
| Upload multipart/form-data avec `UploadFile` | ✅ Maîtrisé |
| Gestion des virtualenvs et dépendances Python | ✅ Maîtrisé |
| Extraction de texte PDF avec PyMuPDF (fitz) | ✅ Maîtrisé |
| Extraction de texte PDF avec PyPDF2 | ✅ Maîtrisé |
| Algorithme de chunking avec overlap (sliding window) | ✅ Maîtrisé |
| Singleton pattern pour ressources lourdes (modèle ML) | ✅ Maîtrisé |
| Gestion d'erreurs HTTP structurée (HTTPException) | ✅ Maîtrisé |

### Machine Learning / NLP

| Compétence | Statut |
|------------|--------|
| Modèles d'embeddings texte (sentence-transformers) | ✅ Maîtrisé |
| Vectorisation batch pour la performance | ✅ Maîtrisé |
| Compréhension des embeddings 384 dimensions | ✅ Compris |
| Similarité cosinus pour la recherche sémantique | ✅ Compris |
| Architecture RAG (Retrieval + Augmented Generation) | ✅ Maîtrisé |

### MongoDB Atlas

| Compétence | Statut |
|------------|--------|
| Configuration d'un index Vector Search sur Atlas | ✅ Maîtrisé |
| Pipeline d'agrégation MongoDB ($vectorSearch, $match, $project, $limit) | ✅ Maîtrisé |
| Paramétrage numCandidates vs limit | ✅ Compris |
| Insertion batch avec `insert_many(ordered=False)` | ✅ Maîtrisé |
| Connexion via URI SRV (MongoDB Atlas) | ✅ Maîtrisé |

### Next.js / Frontend React

| Compétence | Statut |
|------------|--------|
| App Router Next.js 16 | ✅ Maîtrisé |
| Routes API serveur (route.js) — protection des clés API | ✅ Maîtrisé |
| Variables d'environnement NEXT_PUBLIC_* vs serveur | ✅ Maîtrisé |
| Gestion d'état React (useState, useCallback, useRef) | ✅ Maîtrisé |
| Upload fichier via FormData depuis le navigateur | ✅ Maîtrisé |
| Streaming Server-Sent Events (SSE) côté client | ✅ Maîtrisé |
| Rendu Markdown avec react-markdown + remark-gfm | ✅ Maîtrisé |
| Coloration syntaxique avec react-syntax-highlighter | ✅ Maîtrisé |
| Design system CSS avec variables personnalisées | ✅ Maîtrisé |

### LLM et API OpenRouter

| Compétence | Statut |
|------------|--------|
| Appel de l'API OpenRouter avec @openrouter/sdk | ✅ Maîtrisé |
| Streaming de tokens LLM | ✅ Maîtrisé |
| Construction de prompts système pour RAG | ✅ Maîtrisé |
| Contrainte LLM sur les sources (anti-hallucination) | ✅ Maîtrisé |
| Transformation stream → SSE → affichage progressif | ✅ Maîtrisé |

---

## 8. Limitations Connues et Pistes d'Amélioration

| Limitation | Impact | Solution suggérée |
|------------|--------|------------------|
| PDFs scannés (images) non supportés | Moyen | Intégrer OCR (`pytesseract` + `pdf2image`) |
| Pas de déduplication à l'upload | Moyen | Vérifier l'existence de `source_file` avant insertion |
| `allow_origins=["*"]` en production | Élevé | Restreindre aux origines connues |
| Pas d'authentification utilisateur | Moyen | Ajouter JWT ou sessions |
| Modèle Gemma 4 via free tier (rate limiting) | Faible | Utiliser un modèle payant en production |
| Historique de conversation non persistant | Faible | Sauvegarder en base par session |
| Chunking par nombre de mots | Faible | Utiliser `RecursiveCharacterTextSplitter` (LangChain) |
| `torch==2.8.0` très volumineux (~2 GB) | Faible | Utiliser sentence-transformers en mode CPU uniquement |

---

## 9. Instructions de Déploiement

### Prérequis
- Python 3.9+, Node.js 20+
- Compte MongoDB Atlas (gratuit M0)
- Compte OpenRouter (gratuit)

### Installation

```bash
# 1. Cloner le dépôt
git clone https://github.com/KENIYSN/rag-project-assistant.git
cd rag-project-assistant

# 2. Backend Python
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 3. Variables d'environnement backend
echo "MONGODB_URI=mongodb+srv://..." > .env

# 4. (Optionnel) Réindexer les données initiales
python backend/extract_data.py
python backend/generate_embeddings.py
# Puis importer chunks_with_embeddings.json dans MongoDB Atlas

# 5. Frontend
cd frontend
npm install
# Créer frontend/.env.local avec OPENROUTER_API_KEY, BACKEND_URL, NEXT_PUBLIC_BACKEND_URL

# 6. Lancement (deux terminaux)
# Terminal 1 :
source venv/bin/activate && uvicorn backend.api:app --reload --host 0.0.0.0 --port 8000
# Terminal 2 :
cd frontend && npm run dev
```

| Service | URL |
|---------|-----|
| Application web | http://localhost:3000 |
| API FastAPI | http://localhost:8000 |
| Documentation Swagger | http://localhost:8000/docs |

---

## 10. Glossaire Technique

| Terme | Définition |
|-------|------------|
| **RAG** | Retrieval-Augmented Generation — technique combinant recherche vectorielle et génération par LLM |
| **Embedding** | Représentation vectorielle d'un texte en N dimensions capturant son sens sémantique |
| **Chunk** | Fragment de texte découpé depuis un document, unité de base pour l'indexation |
| **Overlap** | Chevauchement entre deux chunks pour préserver le contexte aux frontières |
| **Vector Search** | Recherche par similarité cosinus dans un espace vectoriel à haute dimension |
| **$vectorSearch** | Opérateur d'agrégation MongoDB Atlas pour la recherche sémantique native |
| **SSE** | Server-Sent Events — protocole HTTP pour le streaming serveur → client |
| **LLM** | Large Language Model — modèle de langage massif capable de génération de texte |
| **System Prompt** | Instructions envoyées au LLM avant la question utilisateur pour contraindre son comportement |
| **all-MiniLM-L6-v2** | Modèle d'embeddings open-source léger (22M paramètres), vecteurs de 384 dimensions |
| **Gemma 4** | Modèle LLM open-source de Google, utilisé via OpenRouter en mode gratuit |
| **OpenRouter** | Plateforme d'accès unifié à de nombreux LLMs via une API commune |
| **multipart/form-data** | Format d'encodage HTTP permettant l'upload de fichiers binaires |
| **FormData** | API JavaScript pour construire des requêtes multipart dans le navigateur |
| **Pydantic** | Bibliothèque Python de validation de données basée sur les type hints |
| **ASGI** | Asynchronous Server Gateway Interface — standard Python pour serveurs web asynchrones |

---

*Document généré le 24 Juillet 2026*
*Commit : `f888aa6` — Dépôt : https://github.com/KENIYSN/rag-project-assistant*
