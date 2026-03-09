#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Next Immo Lab API v1 — Bash Quickstart
# ──────────────────────────────────────────────────────────────────────────────
#
# Full example: trigger → poll → display results. Only needs curl + jq.
#
# Usage:
#   export NEXTIMMOLAB_API_KEY="ak_live_xxxx"
#   chmod +x quickstart.sh
#   ./quickstart.sh
#
# ──────────────────────────────────────────────────────────────────────────────

set -euo pipefail

API_BASE="https://immo.next-lab.tech/api/v1"
API_KEY="${NEXTIMMOLAB_API_KEY:?Set NEXTIMMOLAB_API_KEY environment variable}"

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

# ─── 1. Check usage ─────────────────────────────────────────────────────────

echo -e "${CYAN}── Checking usage ──${NC}"

USAGE=$(curl -sf "${API_BASE}/usage" -H "x-api-key: ${API_KEY}")

TOTAL=$(echo "$USAGE" | jq -r '.totalCalls')
MAX=$(echo "$USAGE" | jq -r '.maxCalls // "unlimited"')
REMAINING=$(echo "$USAGE" | jq -r '.remaining // "unlimited"')
QUALIFIED=$(echo "$USAGE" | jq -r '.qualifiedCount')
AVG_SCORE=$(echo "$USAGE" | jq -r '.averageScore // "--"')

echo "Calls: ${TOTAL}/${MAX} | Remaining: ${REMAINING}"
echo "Qualified: ${QUALIFIED} | Avg score: ${AVG_SCORE}"

if [ "$REMAINING" != "unlimited" ] && [ "$REMAINING" -le 0 ] 2>/dev/null; then
  echo -e "${RED}No calls remaining.${NC}"
  exit 1
fi

# ─── 2. Trigger call ────────────────────────────────────────────────────────

TOMORROW=$(date -v+1d +%Y-%m-%d 2>/dev/null || date -d "+1 day" +%Y-%m-%d)
DAY_AFTER=$(date -v+2d +%Y-%m-%d 2>/dev/null || date -d "+2 days" +%Y-%m-%d)
REF="BASH-$(date +%Y%m%d-%H%M%S)"

echo ""
echo -e "${CYAN}── Triggering call ──${NC}"

TRIGGER_RESPONSE=$(curl -sf -X POST "${API_BASE}/calls/trigger" \
  -H "x-api-key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d "$(cat <<EOF
{
  "lead": {
    "prenom": "Emma",
    "nom": "Van den Berg",
    "telephone": "+41791234567",
    "email": "emma.vandenberg@example.com",
    "language": "en",
    "budget": "3500",
    "remarks": "Looking for a quiet neighborhood, works from home"
  },
  "property": {
    "title": "Modern 4-Room Apartment in Bern",
    "address": "Bundesplatz 3, 3011 Bern",
    "price": 3200,
    "type": "rent",
    "description": "Spacious 4-room apartment, 110m2, fully renovated, open kitchen, 2 bedrooms, home office, large living room with fireplace. Central location, 5 min walk to train station.",
    "features": ["Fireplace", "Home office", "Open kitchen", "Cellar", "Parking"]
  },
  "agent_config": {
    "agent_name": "Clara",
    "agency_name": "Avendo Immobilier",
    "transfer_number": "+41791234568",
    "qualification_criteria": [
      {
        "question": "What is your maximum monthly budget for rent?",
        "type": "number",
        "expectedValue": "3200",
        "eliminatory": true
      },
      {
        "question": "Do you have a stable income or employment?",
        "type": "yes_no",
        "expectedValue": "oui",
        "eliminatory": true
      },
      {
        "question": "How many people will live in the apartment?",
        "type": "number",
        "expectedValue": "1-4",
        "eliminatory": false
      }
    ]
  },
  "viewing_slots": [
    {
      "date": "${TOMORROW}",
      "startTime": "14:00",
      "endTime": "15:00",
      "maxBookings": 3
    },
    {
      "date": "${DAY_AFTER}",
      "startTime": "10:00",
      "endTime": "11:00",
      "maxBookings": 3
    }
  ],
  "external_ref": "${REF}"
}
EOF
)")

CALL_ID=$(echo "$TRIGGER_RESPONSE" | jq -r '.callId')
STATUS=$(echo "$TRIGGER_RESPONSE" | jq -r '.status')

echo -e "${GREEN}Call triggered${NC} — ID: ${CALL_ID}"
echo "Status: ${STATUS} | Ref: ${REF}"

# ─── 3. Poll for results ────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}── Polling for results ──${NC}"
echo "Waiting 5s for call to connect..."
sleep 5

MAX_ATTEMPTS=60  # 10 minutes

for i in $(seq 1 $MAX_ATTEMPTS); do
  CALL_DATA=$(curl -sf "${API_BASE}/calls/${CALL_ID}" -H "x-api-key: ${API_KEY}")
  CALL_STATUS=$(echo "$CALL_DATA" | jq -r '.status')

  TIME=$(date +%H:%M:%S)
  echo -n "  [${TIME}] ${CALL_STATUS}"

  case "$CALL_STATUS" in
    completed|failed|no_answer)
      echo ""
      break
      ;;
    *)
      echo " — waiting 10s..."
      sleep 10
      ;;
  esac

  if [ "$i" -eq "$MAX_ATTEMPTS" ]; then
    echo -e "\n${YELLOW}Timeout reached.${NC}"
    exit 1
  fi
done

# ─── 4. Display results ─────────────────────────────────────────────────────

echo ""
echo "════════════════════════════════════════════════════════════"
echo -e "RESULT: ${GREEN}$(echo "$CALL_DATA" | jq -r '.status | ascii_upcase')${NC}"
echo "════════════════════════════════════════════════════════════"

echo "Lead:      $(echo "$CALL_DATA" | jq -r '.leadName')"
echo "Duration:  $(echo "$CALL_DATA" | jq -r '.duration // "--"')"
echo "Score:     $(echo "$CALL_DATA" | jq -r '.score // "--"')/100"
echo "Qualified: $(echo "$CALL_DATA" | jq -r '.qualified // "--"')"

# Criteria
CRITERIA_COUNT=$(echo "$CALL_DATA" | jq '.criteriaResults | length')
if [ "$CRITERIA_COUNT" -gt 0 ]; then
  PASSED=$(echo "$CALL_DATA" | jq '[.criteriaResults[] | select(.passed)] | length')
  echo ""
  echo "Criteria (${PASSED}/${CRITERIA_COUNT} passed):"
  echo "$CALL_DATA" | jq -r '.criteriaResults[] |
    "  [" + (if .passed then "PASS" else "FAIL" end) + "] " + .question +
    (if .eliminatory then " [ELIMINATORY]" else "" end) +
    "\n         Answer: " + (.answer // "--")'
fi

# Transcript preview
TRANSCRIPT_COUNT=$(echo "$CALL_DATA" | jq '.transcript // [] | length')
if [ "$TRANSCRIPT_COUNT" -gt 0 ]; then
  echo ""
  echo "Transcript (${TRANSCRIPT_COUNT} messages):"
  echo "$CALL_DATA" | jq -r '.transcript[:6][] |
    "  " + (if .role == "agent" then "AGENT" else "LEAD " end) + ": " + (.text[:80])'
  if [ "$TRANSCRIPT_COUNT" -gt 6 ]; then
    echo "  ... +$((TRANSCRIPT_COUNT - 6)) more messages"
  fi
fi

echo "════════════════════════════════════════════════════════════"

# ─── 5. List recent calls ───────────────────────────────────────────────────

echo ""
echo -e "${CYAN}── Recent calls ──${NC}"
curl -sf "${API_BASE}/calls?limit=5" -H "x-api-key: ${API_KEY}" | \
  jq -r '.calls[] |
    "  " + .id[:8] + "... | " + (.status | . + " " * (12 - length)) + " | " +
    (.leadName | . + " " * (20 - length)) + " | " +
    (if .status == "completed" then "score=" + (.score // "--" | tostring) else "" end)'

echo ""
echo -e "${GREEN}Done.${NC}"
