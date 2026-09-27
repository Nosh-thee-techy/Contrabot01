# ContraBot Meta WhatsApp — How It Is Used

ContraBot already includes a working Meta Cloud API WhatsApp channel. This document explains how people use the bot on WhatsApp, and how developers configure and run it.

For deeper architecture and production hardening, see [whatsapp_production_guide.md](whatsapp_production_guide.md).

---

## What It Does

Users message the ContraBot WhatsApp number. Meta delivers those messages to this backend via webhooks. The bot:

1. Runs a short counseling intake (language → profile questions → WHO MEC-grounded recommendation)
2. Offers nearest-clinic lookup (by district name or shared GPS location)
3. Switches into free-form chat for follow-up questions (RAG + LLM)

Code lives in:

| File | Role |
|------|------|
| `channels/whatsapp.py` | Webhook verify/handle, send text/buttons/lists, conversation UX |
| `channels/intake.py` | Shared intake state machine (also used by USSD) |
| `app/main.py` | Exposes `GET/POST /whatsapp` and `GET/POST /webhook` |
| `services/session.py` | Redis (or in-memory) session store |

---

## How An End User Uses It

1. User opens WhatsApp via the web icon (or messages the business/test number) — often with a short greeting like `Habari ContraBot`.
2. Bot replies with a short ContraBot welcome:
   - `Welcome to ContraBot.`
   - Plain help line, then `Choose your language:`
   - Interactive buttons: **English** or **Kiswahili** only.
3. After language, a warm name prompt in that language, then short profile questions (buttons/lists).
4. Bot returns a concise recommendation.
5. User can tap **Find clinic** (uses district), share a **location pin**, or **Talk to CHW**.
6. Session enters **chat mode** for free-form questions.
7. User can type `restart` anytime to begin again.

---

## Environment Variables

Copy `.env.example` to `.env` and set:

```env
WHATSAPP_TOKEN=          # Meta access token (temporary test token or permanent system-user token)
WHATSAPP_PHONE_ID=       # WhatsApp Phone Number ID from Meta API Setup
WHATSAPP_VERIFY_TOKEN=   # Any secret string you invent; Meta must use the same value
WHATSAPP_APP_SECRET=     # App Secret from Meta App settings (HMAC webhook signatures)
```

Also needed for full counseling/chat:

- At least one LLM key (`GROQ_API_KEY`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, or `GOOGLE_API_KEY`)
- `REDIS_URL` (optional; falls back to in-memory sessions)
- `DATABASE_URL` (for facility lookup)

Without `WHATSAPP_TOKEN` / `WHATSAPP_PHONE_ID`, the webhook still receives messages, but outbound sends will fail and be logged.

---

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/whatsapp` or `/webhook` | Meta webhook verification (`hub.mode`, `hub.verify_token`, `hub.challenge`) |
| `POST` | `/whatsapp` or `/webhook` | Incoming messages and delivery status callbacks |

Both path pairs are equivalent — point Meta at whichever you prefer.

### Verification handshake

Meta calls:

```
GET /webhook?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=12345
```

The server returns `12345` as plain text when `hub.verify_token` matches `WHATSAPP_VERIFY_TOKEN`.

### Incoming message security

- `POST` bodies are checked with `X-Hub-Signature-256` when `WHATSAPP_APP_SECRET` is set.
- Duplicate Meta deliveries are ignored via a 5-minute message-id cache (Redis when available).

---

## Frontend WhatsApp button

The web app (`web/`) shows a WhatsApp icon that opens the user’s WhatsApp app (or WhatsApp Web on desktop) via `https://wa.me/<number>`.

Set the business/test number in `web/.env`:

```env
VITE_WHATSAPP_NUMBER=254700000000
```

Use digits only with country code (no `+` or spaces). Restart the Vite dev server after changing it. If unset, the icon is hidden.

After a recommendation, users can also **Request CHW follow-up** (anonymous district referral code). See [CHW.md](CHW.md).

---

## Local Development Setup

1. Install dependencies and start the API:

```bash
pip install -r requirements.txt
cp .env.example .env   # fill WhatsApp + LLM values
uvicorn app.main:app --reload --port 8000
```

2. Expose localhost to Meta (Meta cannot call `localhost` directly):

```bash
ngrok http 8000
# use the https URL Meta gives you, e.g. https://abcd.ngrok-free.app
```

3. In [Meta Developers](https://developers.facebook.com/) → your app → **WhatsApp** → **Configuration**:

   - Callback URL: `https://YOUR-NGROK-HOST/webhook`
   - Verify token: same as `WHATSAPP_VERIFY_TOKEN`
   - Subscribe to the **messages** field

4. In **WhatsApp** → **API Setup**:

   - Copy **Phone number ID** → `WHATSAPP_PHONE_ID`
   - Copy **Temporary access token** → `WHATSAPP_TOKEN` (or use a permanent token)
   - Add your personal number as a test recipient
   - Message the test WhatsApp number with `hi`

5. Confirm:

   - Server logs show a received message
   - Phone receives Start/Help buttons
   - Completing intake reaches recommendation + chat mode

---

## Conversation Stages (Developer View)

```
language → name → gender → age
  → (female) breastfeeding → health_flags → preference
  → access → district → recommendation → facility_lookup
  → chat
```

Male users skip breastfeeding / health_flags / preference and go from age → access.

Session key = WhatsApp phone number (`from` field). TTL = 30 minutes.

Interactive UI used by stage:

- Language: WhatsApp **list** message
- Yes/no and preference questions: WhatsApp **reply buttons** (max 3)
- Free text: name, age, district, chat Q&A
- Optional: WhatsApp **location** message for GPS clinic lookup

---

## Outbound Message Types

Implemented in `channels/whatsapp.py`:

- `send_text` — plain text (capped for Meta limits)
- `send_buttons` — up to 3 quick-reply buttons
- `send_list` — scrollable list (when needed)
- Language choice uses **reply buttons**: English / Kiswahili only
- `mark_as_read` — blue ticks on the user’s device

All outbound calls go to:

```
POST https://graph.facebook.com/v19.0/{WHATSAPP_PHONE_ID}/messages
Authorization: Bearer {WHATSAPP_TOKEN}
```

---

## Quick Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| Meta “Verify and Save” fails | Backend not reachable (need HTTPS tunnel) or verify token mismatch |
| Webhook returns 403 | Signature check failed — wrong/missing `WHATSAPP_APP_SECRET` |
| Bot receives but never replies | Missing `WHATSAPP_TOKEN` or `WHATSAPP_PHONE_ID` |
| “User not in allowed list” | Test number not added under Meta API Setup |
| Temporary token expired | Generate a new token or create a permanent System User token |
| Duplicate answers | Dedup cache miss; check Redis connectivity |
| Chat answers empty/errors | No LLM API key configured |

---

## Tests

```bash
pytest tests/test_whatsapp.py -v
```

These cover webhook verification, signature checks, deduplication, interactive payloads, intake buttons, location, and chat mode (with mocked Meta sends).
