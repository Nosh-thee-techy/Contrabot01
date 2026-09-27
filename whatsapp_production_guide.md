# ContraBot WhatsApp Bot — Architecture & Production Deployment Guide

This guide explains how the ContraBot WhatsApp integration works under the hood and outlines the steps to deploy it to a production environment using Meta's Cloud API.

For a shorter how-to (user flow, env vars, local ngrok setup), start with [WHATSAPP.md](WHATSAPP.md).

---

## 🏗️ Architecture & Message Flow

ContraBot's WhatsApp bot operates as a stateless FastAPI endpoint that interfaces with the **Meta Graph API** (webhooks for receiving, HTTP requests for sending) and maintains user state via a **Redis Session Store**.

```mermaid
graph TD
    Meta[Meta Graph API] -->|1. Webhook POST| Webhook[FastAPI /webhook]
    Webhook -->|2. Verify Sig & Dedup| Sec[Security Layer]
    Sec -->|3. Get Session| Redis[(Redis / Memory)]
    Redis -->|4. Stage State| Engine[Intake State Machine]
    Engine -->|5a. Profile recommendation| Rec[Safety/Scoring Engine]
    Engine -->|5b. Q&A / Free-form chat| Chat[RAG & LLM Engine]
    Rec -->|6. Result| Format[Message Formatter]
    Chat -->|6. Response| Format
    Format -->|7. Send payload| Meta
```

### 1. Webhook Intake & Verification
* **Endpoint**: `POST /whatsapp` or `POST /webhook`.
* **Signature Verification**: Every request contains an `X-Hub-Signature-256` header containing a SHA256 HMAC of the raw body generated with your `WHATSAPP_APP_SECRET`. The bot calculates this locally to authenticate that the payload genuinely came from Meta.
* **Deduplication**: Meta delivers webhooks with an "at-least-once" guarantee, meaning duplicate retries can occur. The bot checks the unique `message_id` against a Redis-backed TTL cache (5-minute expiry) to prevent double-processing.
* **Read Receipts**: The bot immediately triggers a POST request to mark the message as read on the sender's device.

### 2. Session Management
The session ID is the user's phone number. User state is loaded from `session_store` with a 30-minute (1800s) TTL:
* **Stage Flow**:
  1. `language`: Welcomes user and sends an Interactive List message.
  2. `name`: Text input for preferred name.
  3. `gender`: Buttons (Female/Male).
  4. `age`: Prompts for age.
  5. `breastfeeding`: Buttons (Yes/No) — female path only.
  6. `health_flags`: Buttons (Yes/No) — female path only.
  7. `preference`: Buttons (Daily/Long-acting) — female path only.
  8. `access`: Buttons (Yes/No).
  9. `district`: Text input.
  10. `recommendation` & `facility_lookup`: Recommendations are generated and presented with a clinic lookup prompt.
  11. `chat`: Free-form Q&A mode.

### 3. Location-Based Nearest Clinic Lookup
If the user reaches the clinic lookup step and clicks "Find clinic", they can send their GPS location. The bot extracts the coordinate lat/lng, calculates distance against PostgreSQL facilities, and returns the top 3 nearest clinics.

### 4. Transition to AI Chat Mode (RAG + LLM)
Once the intake flow is finished, the session does not close. It transitions to `chat` stage. The user can type free-form questions (e.g., *"what are the side-effects of implants?"*). The bot uses semantic search (ChromaDB) to fetch context from WHO MEC guidelines and feeds it to the LLM (Gemini/OpenAI) to return plain-text, non-prescriptive counseling answers.

Users can also tap **Talk to CHW** to create an anonymous district referral code (no phone number stored). See [CHW.md](CHW.md).

---

## 🚀 Production Deployment Steps

### Step 1: Meta Developer Portal Setup
1. Go to the [Meta Developers Portal](https://developers.facebook.com/) and register as a developer.
2. Create a new App: Select **Other** -> **Business** App type.
3. Under **Add products to your app**, click **Set up** next to **WhatsApp**.
4. In the left panel, go to **WhatsApp** -> **API Setup**.
   * Note your **Phone Number ID**.
   * Note your **Temporary Access Token** (for testing) or set up a Permanent System User token under Business Settings.

### Step 2: Set Up Webhook
1. Deploy the ContraBot FastAPI backend to your server (e.g. Render, Railway, AWS).
2. Go to **WhatsApp** -> **Configuration** in the Meta portal.
3. Click **Edit** under **Webhook**:
   * **Callback URL**: `https://your-domain.com/webhook` (or `/whatsapp` — both point to the same router).
   * **Verify Token**: Choose a secret string (e.g. `my-verify-token-2026`).
4. Set the `WHATSAPP_VERIFY_TOKEN` env variable on your server to match this string.
5. Click **Verify and Save** in the Meta portal.
6. Under **Webhook Fields**, click **Manage** and subscribe to **messages**.

### Step 3: Server Environment Variables
Ensure the following variables are configured in your production environment:

```env
# LLM APIs
GOOGLE_API_KEY=your-gemini-key
OPENAI_API_KEY=your-openai-key

# Meta Credentials
WHATSAPP_TOKEN=your-meta-access-token
WHATSAPP_PHONE_ID=your-whatsapp-phone-id
WHATSAPP_VERIFY_TOKEN=your-chosen-verification-string
WHATSAPP_APP_SECRET=your-meta-app-secret-key

# Infrastructure
REDIS_URL=redis://your-redis-host:6379/0
DATABASE_URL=postgresql://user:password@host:5432/dbname
```

---

## 🧪 Production Verification & Testing

Once deployed, you can verify your WhatsApp bot works without risking real charges by using Meta's test sandbox:

1. In the Meta Developer Portal -> **WhatsApp** -> **API Setup**.
2. Under **Send and receive messages**, add your own personal phone number as a test number.
3. Send a message containing "hi" or "hello" from your registered test number to the test number listed in the dashboard.
4. Verify that:
   * The server receives the webhook and logs signature matches.
   * You receive the Welcome buttons interactive message.
   * The list menu for language choices pops up correctly.
   * The flow transitions to the AI chat mode once you complete the recommendation cycle.
