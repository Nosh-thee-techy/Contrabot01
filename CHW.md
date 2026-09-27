# ContraBot CHW Dashboard — Roles & Setup

The CHW app (`chw/`) helps community health workers run anonymous contraception consults, claim digital referrals from WhatsApp/web, and log outcomes. Supervisors get a district analytics view. There is **no password auth** in this MVP — role is chosen at onboard.

---

## Roles

| Role | What they see |
|------|----------------|
| **CHW** | New consult, outcomes, follow-ups due, open referral queue, claim → consult |
| **Supervisor** | District outcome analytics, referral counts, no new-consult entry |

On first open, set:

- Name
- Role (`chw` or `supervisor`)
- District
- **CHW ID** (required for CHW role; attached to outcome logs)

Profile is stored in browser `localStorage` only.

---

## Field workflow

1. **New consultation** — enter anonymous client profile → WHO MEC recommendation + talk scripts.
2. **Log outcome** — accepted / method / follow-up (including schedule date) / notes.
3. Outcomes are saved locally **and** synced to `POST /api/outcomes` (offline: local save still works).
4. **Follow-ups due** — Home lists outcomes with scheduled/pending follow-up in the next 7 days.
5. **Session View** — open a past session for age group, method, duration, notes, referral code.

Average session time uses real `started_at` / `ended_at` timestamps.

---

## Digital referrals (WhatsApp + web)

Referrals are **anonymous**. No client phone numbers are stored on the server.

| Source | How |
|--------|-----|
| Web | After recommendation → **Request CHW follow-up** (enter district) → short code e.g. `CB-A3F2` |
| WhatsApp | After intake / in chat → **Talk to CHW** → same short code |
| CHW | Home → **Open referrals** → **Claim** → opens consult with district + code |

API:

- `POST /api/referrals` — create
- `GET /api/referrals?district=&status=open` — queue
- `PATCH /api/referrals/{id}` — claim / complete

---

## Environment

`chw/.env`:

```env
VITE_API_URL=http://localhost:8000
VITE_USE_MOCK=false
VITE_WHATSAPP_NUMBER=2547XXXXXXXX
```

- `VITE_USE_MOCK=true` — demo without backend (mock recommend / referrals / analytics).
- `VITE_WHATSAPP_NUMBER` — powers **Message ContraBot on WhatsApp** on the dashboard.

Run:

```bash
cd chw
npm install
npm run dev
# http://localhost:5174
```

Backend should be running (`uvicorn app.main:app --reload --port 8000`) when mock is off.

---

## Privacy notes

- Consult forms do not collect client names or phone numbers.
- Outcome + referral rows store district, method interest, CHW ID, anonymous session/referral codes only.
- WhatsApp codes are meant to be spoken/shown in person so a CHW can match the client without server-side phone linkage.
