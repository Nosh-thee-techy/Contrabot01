# ContraBot - Production Architecture

ContraBot is an AI-powered contraception counseling platform for East Africa. It provides WHO MEC-grounded recommendations through USSD, WhatsApp, a user-facing web app, and a CHW dashboard.

## Architecture

```text
channels/ussd.py, channels/whatsapp.py -> channels/intake.py (shared flow)
                                             |
engine/safety_screen.py -> engine/scorer.py -> engine/recommender.py (+ RAG)
                                             |
services/knowledge.py (ChromaDB)   services/facilities.py (PostgreSQL)
services/session.py (Redis)
```

## Apps

| App | Location | Purpose | Local URL |
| --- | --- | --- | --- |
| Backend API | `app/` | FastAPI API, USSD, WhatsApp, recommendation engine | `http://localhost:8000` |
| Web app | `web/` | User-facing landing, chat, compare, facilities | `http://localhost:5173` |
| CHW dashboard | `chw/` | CHW consult workflow, referrals, outcomes analytics | `http://localhost:5174` |

`frontend/` is the earlier React prototype. Use `web/` and `chw/` for the production-facing apps.

CHW roles, referrals, and setup: [CHW.md](CHW.md).

## Data Sources

| Source | Location | Collection |
| --- | --- | --- |
| WHO Medical Eligibility Criteria | `data/chromadb/WHO_MEC.pdf` | `who_mec` |
| APHRC regional evidence | `data/aphrc/` | `aphrc` |
| Kenya/Uganda facilities | `data/facilities/*.csv` | PostgreSQL `facilities` |

Run `python ingest.py` after adding or changing APHRC records, WHO material, or ChromaDB-backed content.

## Quick Start

### 1. Infrastructure

```bash
docker compose up -d redis postgres
```

### 2. Backend

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
python ingest.py
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Fill the provider keys in `.env` before using live AI responses. If no LLM key is configured, the engine tests still use deterministic fallback behavior.

### 3. Web App

```bash
cd web
copy .env.example .env
npm install
npm run dev
```

Set `VITE_USE_MOCK=true` in `web/.env` to demo without the backend.

### 4. CHW Dashboard

```bash
cd chw
copy .env.example .env
npm install
npm run dev
```

`chw/.env.example` defaults to mock mode so the dashboard can be demonstrated quickly. Set `VITE_USE_MOCK=false` and `VITE_API_URL` to sync outcomes/referrals to the backend. See [CHW.md](CHW.md).

## API Endpoints

| Method | Path | Description |
| --- | --- | --- |
| GET | `/health` | Health check |
| POST | `/recommend` | Full engine pipeline for a profile JSON |
| POST | `/chat` | Free-form chat with RAG context |
| GET | `/facilities?district=` | Nearest clinics |
| POST | `/outcomes` | CHW outcome logging |
| GET | `/analytics/outcomes` | Aggregated outcomes |
| POST | `/referrals` | Create anonymous CHW referral |
| GET | `/referrals?district=` | List referral queue |
| PATCH | `/referrals/{id}` | Claim / complete referral |
| GET | `/methods/compare` | Method comparison table |
| POST/GET | `/ussd` | Africa's Talking USSD |
| GET/POST | `/whatsapp` or `/webhook` | Meta WhatsApp |

WhatsApp setup and usage: [WHATSAPP.md](WHATSAPP.md). Production deployment detail: [whatsapp_production_guide.md](whatsapp_production_guide.md).
CHW dashboard: [CHW.md](CHW.md).

The same product API is also mounted under `/api` for the Vite frontends.

## Environment Variables

See `.env.example` for:

- `GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GOOGLE_API_KEY`
- `AT_API_KEY`, `AT_USERNAME`
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`
- `REDIS_URL`, `DATABASE_URL`
- `CORS_ORIGINS`

## Testing And Builds

```bash
pytest tests -v
cd web && npm run build
cd ../chw && npm run build
```

The Python suite covers engine safety behavior and WhatsApp webhook handling. The web and CHW builds verify the production frontend bundles.

## Deployment

1. Connect the repository to Railway, Render, or another Python host.
2. Set environment variables from `.env.example`.
3. Add Redis and PostgreSQL add-ons, or use `docker-compose.yml`.
4. Use `uvicorn app.main:app --host 0.0.0.0 --port $PORT` as the backend start command.
5. Deploy `web/` and `chw/` to Vercel/Netlify with `VITE_API_URL=https://your-api-host`.

## Manual Launch Checklist

- [ ] Africa's Talking sandbox callback points to `https://your-api-host/ussd`
- [ ] Meta WhatsApp sandbox webhook points to `https://your-api-host/webhook`
- [ ] Real facility exports have been imported into `data/facilities/`
- [ ] APHRC data has been ingested with `python ingest.py`
- [ ] Production `.env` values are configured for API, Redis, PostgreSQL, and CORS
- [ ] CHW app has `VITE_API_URL` set and mock mode off for live outcome/referral sync
- [ ] `VITE_WHATSAPP_NUMBER` set in `web/.env` and `chw/.env` for WhatsApp deep links
- [ ] CHWs onboard with district + CHW ID; supervisors use supervisor role for analytics

---

## Model Architecture, Safety & Metrics

### 1. Model Stack & Integration
*   **Conversational Counseling Model**: **Anthropic Claude** (via API) is used as our primary Large Language Model (LLM) to deliver warm, empathetic, and dialect-calibrated counseling.
*   **Embedding Model**: **`all-MiniLM-L6-v2`** (a 384-dimensional Sentence Transformer) embeds clinical manuals and APHRC survey briefs.
*   **Translation Foundation**: **Meta's NLLB-200** was used for foundation translations, followed by native speaker back-translation and Flesch-Kincaid Grade 6 reading-level prompt tuning.
*   **Deterministic Safety Module**: A pure Python expert system that acts as the initial clinical filter, checking user parameters against a hardcoded eligibility matrix before calling generative APIs.

### 2. In-Context "Training" & Calibration
Rather than running expensive parameter fine-tuning (which increases hallucination risk and violates strict clinical safety boundaries), we calibrated the system's behavior using:
*   **Retrieval-Augmented Generation (RAG)**: Guidelines chunked (512 tokens with 64-token overlap) and retrieved via cosine similarity using a local **ChromaDB** vector database.
*   **Dialogue Calibration**: Instructing the model to utilize localized colloquial terminology (Sheng/Swahili like *mpira*, *kipandikizi*, *kitanzi*, *p2*) to replace confusing clinical terms.
*   **Hyperparameter Tuning**: Calibrating LLM generation temperature to `0.6` to balance conversational fluidity with strict factual consistency.

### 3. Primary Evaluation Metrics
*   **Machine Learning & Retrieval (RAGAS Framework)**:
    *   *Faithfulness* (**Target: >95%**): Evaluates that the generated response is strictly grounded in the retrieved WHO guidelines.
    *   *Answer Relevancy* (**Target: >90%**): Evaluates how closely the output addresses the user's question.
    *   *Context Precision* (**Target: >90%**): Measures the retrieval accuracy of the ChromaDB vector queries.
*   **Recommendation Rankings**:
    *   *NDCG (Normalized Discounted Cumulative Gain)*: Evaluates the ranking engine's ability to prioritize the safest and most preference-aligned methods at the top of the list.
*   **Clinical Safety**:
    *   *Sensitivity/Recall* (**Target: 100%**): Assures that all unsafe methods (MEC Categories 3 and 4) are correctly identified and hard-filtered by the deterministic safety engine.
*   **Real-world Impact**:
    *   *Contraceptive Continuation Rate* (**Target: 25% reduction in discontinuation**): Pre-counseling users on side effects to prevent fear-driven drop-off.
    *   *Referral Conversion Rate* (**Target: 70% clinic attendance**): Connecting digital triage users to physical clinics.

### 4. Data Safety & Privacy
*   **Zero PII Persistent Logging**: No names or phone numbers are saved to our SQL encounter databases. CHW outcome logging is limited to anonymous demographic metrics (district, recommended method, accepted status).
*   **Hashing Identifiers**: Phone numbers (`MSISDN`) are processed using **bcrypt** or **MD5 hashing** to track unique active sessions, keeping raw numbers out of server log traces.
*   **Ephemeral Redis Caching**: User response profiles are cached temporarily in Redis with a strict **30-minute expiration TTL** and are purged completely upon session completion or timeout.
*   **Local Triage Firewalls**: The safety engine is run entirely locally. Emergency medical questions (e.g. pain or severe bleeding) are intercepted by a triage keyword filter, bypassing the LLM entirely to serve immediate physical clinic referral cards.
