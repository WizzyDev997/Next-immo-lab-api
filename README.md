# Next Immo Lab by Next Lab — Voice AI API

Automate real estate lead qualification with AI voice calls. Our agent calls your leads, qualifies them against your criteria, and books property viewings — all via a single API call.

```
POST /api/v1/calls/trigger  →  AI calls your lead  →  Results via webhook + API
```

**Base URL:** `https://immo.next-lab.tech`

**Developer Portal:** [immo.next-lab.tech/v1-api](https://immo.next-lab.tech/v1-api)

---

## Getting Started

### 1. Get Your API Key

Contact **abdullah@next-lab.tech** to receive your API key.

```
ak_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 2. Trigger Your First Call

```bash
curl -X POST "https://immo.next-lab.tech/api/v1/calls/trigger" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lead": {
      "prenom": "Jean",
      "nom": "Dupont",
      "telephone": "+41791234567",
      "email": "jean.dupont@example.com",
      "language": "fr",
      "budget": "3500",
      "remarks": "Prefers ground floor, has a small dog"
    },
    "property": {
      "title": "Appartement 4.5 pièces à Genève",
      "address": "Rue du Mont-Blanc 12, 1201 Genève",
      "price": 3100,
      "type": "rent",
      "description": "Superbe appartement rénové de 95m2, lumineux, vue sur le lac Léman. Cuisine ouverte entièrement équipée, 2 chambres, 1 bureau, grand balcon.",
      "features": ["Vue lac", "Cuisine ouverte", "Parking souterrain", "Cave", "Balcon"]
    },
    "agent_config": {
      "agency_name": "Your Agency Name",
      "qualification_criteria": [
        {
          "question": "Quel est votre budget mensuel maximum pour le loyer?",
          "type": "number",
          "expectedValue": "3100",
          "eliminatory": true
        },
        {
          "question": "Avez-vous un emploi stable ou un revenu régulier?",
          "type": "yes_no",
          "expectedValue": "oui",
          "eliminatory": true
        },
        {
          "question": "Combien de personnes occuperont le logement?",
          "type": "number",
          "expectedValue": "1-4",
          "eliminatory": false
        }
      ],
      "transfer_number": "+41791234568"
    },
    "viewing_slots": [
      {
        "date": "2026-03-15",
        "startTime": "14:00",
        "endTime": "15:00",
        "maxBookings": 3
      },
      {
        "date": "2026-03-17",
        "startTime": "10:00",
        "endTime": "11:30",
        "maxBookings": 3
      }
    ],
    "callback_webhook": "https://your-api.com/webhooks/voice-result",
    "external_ref": "YOUR-LEAD-12345"
  }'
```

**Response:**

```json
{
  "callId": "a91b4f0f-00bc-429f-bac8-2ec0969aa214",
  "status": "initiated",
  "externalRef": "YOUR-LEAD-12345",
  "roomName": "immolab-call-..."
}
```

### 3. Wait for the Call to Complete (~2-3 min)

The AI agent will:
1. Call the lead on their phone
2. Introduce itself with your agency name
3. Ask your qualification criteria
4. Answer property questions using your description
5. Propose viewing slots if qualified
6. Book the viewing + send SMS/email confirmation
7. For now the agent will transfer if:
   7.1. The lead is qualified but now viewing slot matching
   7.2. The lead asks for a transfer (only if he is qualified)

### 4. Get Results

```bash
curl "https://immo.next-lab.tech/api/v1/calls/CALL_ID" \
  -H "x-api-key: YOUR_API_KEY"
```

Or receive them automatically via your `callback_webhook`.

---

## API Reference

### Authentication

All requests require an API key via the `x-api-key` header:

```
x-api-key: ak_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Rate limit: **10 requests/minute** per API key.

---

### `POST /api/v1/calls/trigger`

Trigger an outbound AI voice call to qualify a lead.

#### Request Body

| Field | Required | Description |
|-------|----------|-------------|
| `lead.prenom` | Yes | First name |
| `lead.nom` | Yes | Last name |
| `lead.telephone` | Yes | Phone number (international format) |
| `lead.email` | Yes | Email address |
| `lead.language` | Yes | `de`, `fr`, `en`, or `nl` |
| `lead.budget` | No | Lead's stated budget |
| `lead.remarks` | No | Additional notes for the agent |
| `property.title` | Yes | Property title |
| `property.address` | Yes | Full address |
| `property.price` | Yes | Price (number) |
| `property.type` | No | `sale` or `rent` (default: `sale`) |
| `property.description` | Yes | Description the agent uses to answer questions |
| `property.features` | No | Array of features/amenities |
| `agent_config.agency_name` | No | Name the agent introduces itself with |
| `agent_config.qualification_criteria` | No | Questions to qualify the lead |
| `agent_config.transfer_number` | No | Phone for transfer on complex questions |
| `viewing_slots` | No | Available viewing time slots |
| `callback_webhook` | No | URL to POST results when call completes |
| `external_ref` | No | Your reference ID (must be unique per call) |

#### Qualification Criteria

```json
{
  "question": "What is your maximum monthly budget?",
  "type": "number",
  "expectedValue": "3100",
  "eliminatory": true
}
```

| Field | Values | Description |
|-------|--------|-------------|
| `type` | `yes_no`, `number`, `text`, `multiple_choice` | Question type |
| `expectedValue` | string | Expected answer (for budget: minimum acceptable) |
| `eliminatory` | boolean | If `true`, wrong answer = disqualification |

**Evaluation logic:**
- Budget: candidate value >= expected = **PASS** (3200 for expected 3100 = OK)
- Yes/No: match = **PASS**
- Number range (e.g., "1-4"): within range = **PASS**
- The agent errs on the side of passing when in doubt.

#### Errors

| Status | Meaning |
|--------|---------|
| `400` | Validation error (missing/invalid fields) |
| `401` | Missing or invalid API key |
| `403` | Usage limit exceeded or API key call limit reached |
| `409` | Duplicate `external_ref` |
| `500` | Internal error |

---

### `GET /api/v1/calls/{callId}`

Retrieve full results of a completed call.

```bash
curl "https://immo.next-lab.tech/api/v1/calls/CALL_ID" \
  -H "x-api-key: YOUR_API_KEY" | jq .
```

#### Response

```json
{
  "id": "a91b4f0f-00bc-429f-bac8-2ec0969aa214",
  "status": "completed",
  "externalRef": "YOUR-LEAD-12345",
  "leadName": "Jean Dupont",
  "leadPhone": "+41791234567",
  "leadEmail": "jean.dupont@example.com",
  "startedAt": "2026-03-07T21:55:47.227Z",
  "endedAt": "2026-03-07T21:58:04.040Z",
  "duration": "133s",
  "outcome": null,
  "score": 100,
  "qualified": true,
  "criteriaResults": [
    {
      "question": "Quel est votre budget mensuel maximum?",
      "answer": "environ 3200",
      "passed": true,
      "eliminatory": true
    }
  ],
  "transcript": [
    {
      "role": "agent",
      "text": "Bonjour, ici Your Agency...",
      "timestamp": "2026-03-07T21:55:50.000Z"
    }
  ],
  "toolCallsLog": [
    { "timestamp": "...", "tool": "save_criterion_result" },
    { "timestamp": "...", "tool": "book_property_viewing" }
  ]
}
```

---

### `GET /api/v1/calls`

List all calls for your API key.

```bash
curl "https://immo.next-lab.tech/api/v1/calls?limit=20&status=completed" \
  -H "x-api-key: YOUR_API_KEY"
```

| Parameter | Default | Description |
|-----------|---------|-------------|
| `limit` | 50 | Max results (max: 100) |
| `offset` | 0 | Pagination offset |
| `status` | — | Filter by status |

---

### `GET /api/v1/usage`

Get your API key usage statistics.

```bash
curl "https://immo.next-lab.tech/api/v1/usage" \
  -H "x-api-key: YOUR_API_KEY"
```

```json
{
  "totalCalls": 5,
  "maxCalls": 17,
  "remaining": 12,
  "byStatus": { "completed": 4, "failed": 1 },
  "activeCalls": [],
  "averageScore": 85,
  "qualifiedCount": 3
}
```

---

## Webhook Callback

When a call completes, if you provided `callback_webhook`, we POST the results:

```json
{
  "event": "call.completed",
  "callId": "a91b4f0f-...",
  "externalRef": "YOUR-LEAD-12345",
  "status": "completed",
  "score": 100,
  "qualified": true,
  "criteriaResults": [...],
  "transcript": [...],
  "completedAt": "2026-03-07T21:58:04.040Z"
}
```

If your endpoint is unreachable, results are still available via `GET /api/v1/calls/{callId}`.

---

## Scoring

Leads are scored 0-100 based on qualification criteria:

| Criterion Type | Pass | Fail |
|----------------|------|------|
| Eliminatory | +30 pts | 0 pts (disqualifying) |
| Non-eliminatory | +10 pts | 0 pts |

**Qualified** = all eliminatory criteria pass AND score >= 60%

---

## Supported Languages

| Code | Language |
|------|----------|
| `de` | Deutsch (German) |
| `fr` | Francais (French) |
| `en` | English |
| `nl` | Nederlands (Dutch) |

---

## Call Flow

```
1. POST /api/v1/calls/trigger
2. AI agent calls the lead
3. Agent introduces itself with your agency_name
4. Agent confirms lead identity
5. Agent asks qualification_criteria
6. Agent answers property questions from description/features
7. If qualified → agent proposes viewing_slots
8. If accepted → books viewing + SMS/email sent to lead & agency
9. If complex question → transfers to transfer_number
10. Call ends → results saved
11. POST results to callback_webhook (if provided)
12. GET /api/v1/calls/{callId} for full results anytime
```

---

## Developer Portal

Access your real-time dashboard at:

**[immo.next-lab.tech/v1-api](https://immo.next-lab.tech/v1-api)**

Log in with your API key to see:
- Live call status
- Usage and remaining calls
- Call history with transcripts and qualification results
- Score analytics

---

## Quick Examples

### Minimal Request (required fields only)

```bash
curl -X POST "https://immo.next-lab.tech/api/v1/calls/trigger" \
  -H "x-api-key: YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "lead": {
      "prenom": "Jean",
      "nom": "Dupont",
      "telephone": "+41791234567",
      "email": "jean@example.com",
      "language": "fr"
    },
    "property": {
      "title": "Studio à Lausanne",
      "address": "Avenue de la Gare 5, 1003 Lausanne",
      "price": 1200,
      "type": "rent",
      "description": "Studio meublé de 30m2 au centre-ville."
    }
  }'
```

### Python

```python
import requests

response = requests.post(
    "https://immo.next-lab.tech/api/v1/calls/trigger",
    headers={"x-api-key": "YOUR_API_KEY"},
    json={
        "lead": {
            "prenom": "Jean",
            "nom": "Dupont",
            "telephone": "+41791234567",
            "email": "jean@example.com",
            "language": "fr"
        },
        "property": {
            "title": "Appartement 4.5 pièces",
            "address": "Rue du Mont-Blanc 12, Genève",
            "price": 3100,
            "type": "rent",
            "description": "Bel appartement rénové, lumineux."
        },
        "callback_webhook": "https://your-api.com/webhook",
        "external_ref": "LEAD-001"
    }
)

data = response.json()
print(f"Call initiated: {data['callId']}")
```

### TypeScript / Node.js

```typescript
const response = await fetch(
  "https://immo.next-lab.tech/api/v1/calls/trigger",
  {
    method: "POST",
    headers: {
      "x-api-key": "YOUR_API_KEY",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      lead: {
        prenom: "Jean",
        nom: "Dupont",
        telephone: "+41791234567",
        email: "jean@example.com",
        language: "fr",
      },
      property: {
        title: "Appartement 4.5 pièces",
        address: "Rue du Mont-Blanc 12, Genève",
        price: 3100,
        type: "rent",
        description: "Bel appartement rénové, lumineux.",
      },
      callback_webhook: "https://your-api.com/webhook",
      external_ref: "LEAD-001",
    }),
  }
);

const data = await response.json();
console.log(`Call initiated: ${data.callId}`);
```

### Poll for Results

```bash
#!/bin/bash
CALL_ID="your-call-id"
API_KEY="your-api-key"

while true; do
  STATUS=$(curl -s "https://immo.next-lab.tech/api/v1/calls/$CALL_ID" \
    -H "x-api-key: $API_KEY" | jq -r '.status')

  echo "Status: $STATUS"

  if [ "$STATUS" = "completed" ] || [ "$STATUS" = "failed" ]; then
    curl -s "https://immo.next-lab.tech/api/v1/calls/$CALL_ID" \
      -H "x-api-key: $API_KEY" | jq .
    break
  fi

  sleep 10
done
```

---

## Code Samples

Full runnable examples in the [`examples/`](./examples/) folder:

| Language | File | What it does |
|----------|------|-------------|
| Python | [`examples/python/quickstart.py`](./examples/python/quickstart.py) | Trigger, poll, display results, list calls |
| TypeScript | [`examples/typescript/quickstart.ts`](./examples/typescript/quickstart.ts) | Full typed example + webhook handler snippet |
| Bash | [`examples/bash/quickstart.sh`](./examples/bash/quickstart.sh) | curl + jq only, zero dependencies |

Run any sample:

```bash
export NEXTIMMOLAB_API_KEY="ak_live_xxxx"

# Python
pip install requests
python examples/python/quickstart.py

# TypeScript
npx tsx examples/typescript/quickstart.ts

# Bash
./examples/bash/quickstart.sh
```

---

## Support

**Email:** abdullah@next-lab.tech

**To get an API key:** Contact us at the email above.

---

**Next Immo Lab** is a product by **[Next Lab](https://next-lab.tech)** | [immo.next-lab.tech](https://immo.next-lab.tech)
