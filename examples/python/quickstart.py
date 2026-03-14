#!/usr/bin/env python3
"""
Next Immo Lab API v1 — Python Quickstart
=========================================

Full example: trigger a call, poll for results, handle webhook.

Requirements:
    pip install requests

Usage:
    export NEXTIMMOLAB_API_KEY="ak_live_xxxx"
    python quickstart.py
"""

import os
import sys
import json
import time
import requests
from datetime import datetime, timedelta

# ─── Config ──────────────────────────────────────────────────────────────────

API_BASE = "https://immo.next-lab.tech/api/v1"
API_KEY = os.environ.get("NEXTIMMOLAB_API_KEY", "")

if not API_KEY:
    print("Set NEXTIMMOLAB_API_KEY environment variable")
    sys.exit(1)

HEADERS = {
    "x-api-key": API_KEY,
    "Content-Type": "application/json",
}


# ─── 1. Check usage before triggering ───────────────────────────────────────

def check_usage():
    """GET /api/v1/usage — verify you have remaining calls."""
    res = requests.get(f"{API_BASE}/usage", headers=HEADERS)
    res.raise_for_status()
    usage = res.json()

    print(f"Calls used: {usage['totalCalls']}/{usage.get('maxCalls', 'unlimited')}")
    print(f"Remaining:  {usage.get('remaining', 'unlimited')}")
    print(f"Qualified:  {usage['qualifiedCount']} | Avg score: {usage.get('averageScore', '--')}")

    if usage.get("remaining") is not None and usage["remaining"] <= 0:
        print("No calls remaining — contact support.")
        sys.exit(1)

    return usage


# ─── 2. Trigger a call ──────────────────────────────────────────────────────

def trigger_call():
    """POST /api/v1/calls/trigger — full example with all fields."""

    tomorrow = (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d")
    day_after = (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d")

    payload = {
        "lead": {
            "prenom": "Marie",
            "nom": "Müller",
            "telephone": "+41791234567",
            "email": "marie.muller@example.com",
            "language": "fr",
            "budget": "2800",
            "remarks": "Recherche appartement pet-friendly, travaille a domicile",
        },
        "property": {
            "title": "Appartement 3.5 pieces a Lausanne",
            "address": "Avenue de la Gare 22, 1003 Lausanne",
            "price": 2500,
            "type": "rent",
            "description": (
                "Bel appartement renove de 78m2, 2 chambres, salon lumineux, "
                "cuisine equipee, balcon avec vue sur les Alpes. "
                "Proche gare et commerces. Cave et buanderie."
            ),
            "features": [
                "Vue Alpes",
                "Balcon",
                "Cuisine equipee",
                "Cave",
                "Animaux acceptes",
            ],
            "area": 78,
            "rooms": 3.5,
            "bathrooms": 1,
            "terrace": 8,
        },
        "agent_config": {
            "agent_name": "Sophie",
            "agency_name": "Avendo Immobilier",
            "transfer_number": "+41791234568",
            "notification_email": "team@avendo.ch",
            "hangup_instruction": "Merci pour votre interet. Nous vous recontacterons par email dans les 24 heures. Excellente journee!",
            "qualification_criteria": [
                {
                    "question": "Quel est votre budget mensuel maximum pour le loyer?",
                    "type": "number",
                    "expectedValue": "2500",
                    "eliminatory": True,
                    "rejectionMessage": "Malheureusement, le budget minimum requis pour ce bien est de 2500 CHF.",
                },
                {
                    "question": "Avez-vous un emploi stable ou un revenu regulier?",
                    "type": "yes_no",
                    "expectedValue": "oui",
                    "eliminatory": True,
                    "rejectionMessage": "Un emploi stable est requis pour ce bien.",
                },
                {
                    "question": "Combien de personnes occuperont le logement?",
                    "type": "number",
                    "expectedValue": "1-3",
                    "eliminatory": False,
                },
            ],
            "transfer_conditions": [
                "Lead wants to negotiate the rent",
                "Lead asks about specific renovation plans",
            ],
        },
        "viewing_slots": [
            {
                "date": tomorrow,
                "startTime": "14:00",
                "endTime": "15:00",
                "maxBookings": 3,
            },
            {
                "date": day_after,
                "startTime": "10:00",
                "endTime": "11:00",
                "maxBookings": 3,
            },
        ],
        "callback_webhook": "https://your-server.com/webhooks/nextimmolab",
        "external_ref": f"SAMPLE-{datetime.now().strftime('%Y%m%d-%H%M%S')}",
    }

    print(f"\nTriggering call to {payload['lead']['prenom']} {payload['lead']['nom']}...")
    res = requests.post(f"{API_BASE}/calls/trigger", headers=HEADERS, json=payload)

    if res.status_code != 200:
        print(f"Error {res.status_code}: {res.text}")
        sys.exit(1)

    data = res.json()
    print(f"Call triggered — ID: {data['callId']} | Status: {data['status']}")
    return data["callId"]


# ─── 3. Poll for results ────────────────────────────────────────────────────

def wait_for_result(call_id: str, timeout_min: int = 10):
    """GET /api/v1/calls/{callId} — poll until completed/failed."""

    print(f"\nPolling call {call_id[:8]}...")
    deadline = time.time() + timeout_min * 60

    while time.time() < deadline:
        res = requests.get(f"{API_BASE}/calls/{call_id}", headers=HEADERS)
        res.raise_for_status()
        call = res.json()

        status = call["status"]
        print(f"  [{datetime.now().strftime('%H:%M:%S')}] {status}", end="")

        if status in ("completed", "failed", "no_answer"):
            print()
            return call
        else:
            print(" — waiting 10s...")
            time.sleep(10)

    print("Timeout reached.")
    return None


# ─── 4. Display results ─────────────────────────────────────────────────────

def print_results(call: dict):
    """Pretty-print call results."""

    print("\n" + "=" * 60)
    print(f"RESULT: {call['status'].upper()}")
    print("=" * 60)
    print(f"Lead:      {call.get('leadName')}")
    print(f"Duration:  {call.get('duration', '--')}")
    print(f"Score:     {call.get('score', '--')}/100")
    print(f"Qualified: {call.get('qualified', '--')}")

    criteria = call.get("criteriaResults", [])
    if criteria:
        print(f"\nCriteria ({sum(1 for c in criteria if c['passed'])}/{len(criteria)} passed):")
        for c in criteria:
            icon = "PASS" if c["passed"] else "FAIL"
            elim = " [ELIMINATORY]" if c.get("eliminatory") else ""
            print(f"  [{icon}] {c['question']}{elim}")
            print(f"         Answer: {c.get('answer', '--')}")

    transcript = call.get("transcript", [])
    if transcript:
        print(f"\nTranscript ({len(transcript)} messages):")
        for t in transcript[:6]:
            role = "AGENT" if t["role"] == "agent" else "LEAD "
            print(f"  {role}: {t['text'][:80]}{'...' if len(t['text']) > 80 else ''}")
        if len(transcript) > 6:
            print(f"  ... +{len(transcript) - 6} more messages")

    print("=" * 60)


# ─── 5. List recent calls ───────────────────────────────────────────────────

def list_calls(status: str = None, limit: int = 5):
    """GET /api/v1/calls — list calls with optional filter."""

    params = {"limit": limit}
    if status:
        params["status"] = status

    res = requests.get(f"{API_BASE}/calls", headers=HEADERS, params=params)
    res.raise_for_status()
    data = res.json()

    print(f"\nRecent calls ({data['total']} total):")
    for c in data["calls"]:
        score = f"score={c.get('score', '--')}" if c["status"] == "completed" else ""
        print(f"  {c['id'][:8]}... | {c['status']:12} | {c['leadName']:20} | {score}")


# ─── Main ────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    check_usage()
    call_id = trigger_call()

    print("\nWaiting 5s for call to connect...")
    time.sleep(5)

    result = wait_for_result(call_id)
    if result:
        print_results(result)

    list_calls(limit=5)
