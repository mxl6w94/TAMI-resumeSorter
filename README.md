# TAMI - Resume Sorter (Technical Applicant Match Intelligence)

TAMI is an intelligent, scalable, and cost-optimized resume screening platform. It parses resumes, preserves original documents, and uses semantic search to grade applicants against custom criteria with evidence-based highlighting.

## 🚀 Key Features

* **Source Preservation:** Securely stores original PDF/DOCX files for human review.
* **Evidence Highlighting:** Don't just trust the score. TAMI highlights the exact passage in the resume that generated the rating.
* **Token-Optimized Analysis:** Uses Vector Embeddings (RAG) to search for relevant skills before asking the LLM, reducing AI costs by up to 60%.
* **Scalable Architecture:** Built on Next.js and Supabase (Postgres) to handle thousands of applicants without browser crashes.

## 🛠 Tech Stack

* **Frontend:** Next.js (React), Tailwind CSS, Framer Motion
* **Backend:** Next.js API Routes (Serverless Functions)
* **Database & Vector Search:** Supabase (PostgreSQL + pgvector extension)
* **Storage:** Supabase Storage (S3 wrapper)
* **AI Processing:**
    * **Embeddings:** OpenAI `text-embedding-3-small` (for search)
    * **Generation:** Google Gemini Flash or GPT-4o-mini (for scoring)
    * **Parsing:** LangChain JS + PDF.js

## 🏗 Architecture Overview

1.  **Ingestion:** User uploads a resume.
2.  **Parsing:** Server extracts text and splits it into "chunks" (paragraphs).
3.  **Embedding:** Text chunks are converted into mathematical vectors and stored in Postgres.
4.  **Evaluation:**
    * When evaluating "Leadership":
    * We perform a *Semantic Search* for chunks related to "management," "leading," "team."
    * We send *only* those specific chunks to the LLM.
5.  **Result:** The LLM returns a score (e.g., 8/10) and the specific quote used for evidence.

## 📦 Getting Started

### Prerequisites
* Node.js 18+
* A Supabase Account (Free Tier works)
* Google Gemini or OpenAI API Key

### Installation

1.  **Clone the repo**
    ```bash
    git clone [https://github.com/mxl6w94/TAMI-resumeSorter.git](https://github.com/mxl6w94/TAMI-resumeSorter.git)
    cd TAMI-resumeSorter
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Environment Setup**
    Create a `.env.local` file:
    ```env
    NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
    NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key
    GEMINI_API_KEY=your_gemini_key
    ```

4.  **Run the development server**
    ```bash
    npm run dev
    ```

## 🗺 Roadmap

See [ROADMAP.md](ROADMAP.md) for the detailed development plan.
