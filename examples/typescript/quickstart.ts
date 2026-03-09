/**
 * Next Immo Lab API v1 — TypeScript Quickstart
 * ==============================================
 *
 * Full example: trigger a call, poll for results, webhook handler.
 * Zero dependencies — uses native fetch (Node 18+).
 *
 * Usage:
 *   export NEXTIMMOLAB_API_KEY="ak_live_xxxx"
 *   npx tsx quickstart.ts
 */

const API_BASE = "https://immo.next-lab.tech/api/v1";
const API_KEY = process.env.NEXTIMMOLAB_API_KEY ?? "";

if (!API_KEY) {
  console.error("Set NEXTIMMOLAB_API_KEY environment variable");
  process.exit(1);
}

const headers = {
  "x-api-key": API_KEY,
  "Content-Type": "application/json",
};

// ─── Types ──────────────────────────────────────────────────────────────────

interface TriggerResponse {
  callId: string;
  status: string;
  externalRef?: string;
  roomName?: string;
}

interface CriterionResult {
  criterionId: string;
  question: string;
  answer: string;
  passed: boolean;
  eliminatory: boolean;
}

interface TranscriptEntry {
  role: "agent" | "user";
  text: string;
  timestamp: string;
}

interface CallResult {
  id: string;
  status: "pending" | "ringing" | "in_progress" | "completed" | "failed";
  externalRef?: string;
  leadName: string;
  leadPhone: string;
  leadEmail: string;
  startedAt: string;
  endedAt?: string;
  duration?: string;
  score?: number;
  qualified?: boolean;
  criteriaResults: CriterionResult[];
  transcript?: TranscriptEntry[];
}

interface UsageStats {
  totalCalls: number;
  maxCalls: number | null;
  remaining: number | null;
  byStatus: Record<string, number>;
  activeCalls: unknown[];
  averageScore: number | null;
  qualifiedCount: number;
}

// ─── 1. Check usage ────────────────────────────────────────────────────────

async function checkUsage(): Promise<UsageStats> {
  const res = await fetch(`${API_BASE}/usage`, { headers });
  if (!res.ok) throw new Error(`Usage check failed: ${res.status}`);
  const usage: UsageStats = await res.json();

  console.log(`Calls: ${usage.totalCalls}/${usage.maxCalls ?? "unlimited"}`);
  console.log(`Remaining: ${usage.remaining ?? "unlimited"}`);
  console.log(`Qualified: ${usage.qualifiedCount} | Avg score: ${usage.averageScore ?? "--"}`);

  if (usage.remaining !== null && usage.remaining <= 0) {
    throw new Error("No calls remaining");
  }
  return usage;
}

// ─── 2. Trigger a call ─────────────────────────────────────────────────────

async function triggerCall(): Promise<string> {
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
  const dayAfter = new Date(Date.now() + 172800000).toISOString().split("T")[0];

  const payload = {
    lead: {
      prenom: "Lukas",
      nom: "Weber",
      telephone: "+41791234567",
      email: "lukas.weber@example.com",
      language: "de" as const,
      budget: "3000",
      remarks: "Sucht hundefreundliche Wohnung, arbeitet von zu Hause",
    },
    property: {
      title: "4.5 Zimmer Wohnung in Zürich",
      address: "Bahnhofstrasse 50, 8001 Zürich",
      price: 2800,
      type: "rent" as const,
      description:
        "Moderne 4.5-Zimmer-Wohnung, 95m2, offene Küche, 2 Schlafzimmer, " +
        "Büro, grosser Balkon mit Blick auf die Limmat. " +
        "Nahe Hauptbahnhof, Einkaufsmöglichkeiten. Keller und Waschküche.",
      features: ["Balkon", "Offene Küche", "Tiefgarage", "Keller", "Haustiere erlaubt"],
    },
    agent_config: {
      agent_name: "Anna",
      agency_name: "Avendo Immobilier",
      transfer_number: "+41791234568",
      qualification_criteria: [
        {
          question: "Was ist Ihr maximales monatliches Budget für die Miete?",
          type: "number",
          expectedValue: "2800",
          eliminatory: true,
        },
        {
          question: "Haben Sie einen festen Arbeitsvertrag oder ein regelmässiges Einkommen?",
          type: "yes_no",
          expectedValue: "oui",
          eliminatory: true,
        },
        {
          question: "Wie viele Personen werden in der Wohnung wohnen?",
          type: "number",
          expectedValue: "1-4",
          eliminatory: false,
        },
      ],
    },
    viewing_slots: [
      { date: tomorrow, startTime: "14:00", endTime: "15:00", maxBookings: 3 },
      { date: dayAfter, startTime: "10:00", endTime: "11:00", maxBookings: 3 },
    ],
    callback_webhook: "https://your-server.com/webhooks/nextimmolab",
    external_ref: `TS-${Date.now()}`,
  };

  console.log(`\nTriggering call to ${payload.lead.prenom} ${payload.lead.nom}...`);

  const res = await fetch(`${API_BASE}/calls/trigger`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Trigger failed (${res.status}): ${err}`);
  }

  const data: TriggerResponse = await res.json();
  console.log(`Call triggered — ID: ${data.callId} | Status: ${data.status}`);
  return data.callId;
}

// ─── 3. Poll for results ───────────────────────────────────────────────────

async function waitForResult(callId: string, timeoutMin = 10): Promise<CallResult | null> {
  console.log(`\nPolling call ${callId.slice(0, 8)}...`);
  const deadline = Date.now() + timeoutMin * 60_000;

  while (Date.now() < deadline) {
    const res = await fetch(`${API_BASE}/calls/${callId}`, { headers });
    if (!res.ok) throw new Error(`Poll failed: ${res.status}`);

    const call: CallResult = await res.json();
    const time = new Date().toLocaleTimeString();
    process.stdout.write(`  [${time}] ${call.status}`);

    if (["completed", "failed", "no_answer"].includes(call.status)) {
      console.log();
      return call;
    }

    console.log(" — waiting 10s...");
    await new Promise((r) => setTimeout(r, 10_000));
  }

  console.log("Timeout reached.");
  return null;
}

// ─── 4. Display results ────────────────────────────────────────────────────

function printResults(call: CallResult) {
  console.log("\n" + "=".repeat(60));
  console.log(`RESULT: ${call.status.toUpperCase()}`);
  console.log("=".repeat(60));
  console.log(`Lead:      ${call.leadName}`);
  console.log(`Duration:  ${call.duration ?? "--"}`);
  console.log(`Score:     ${call.score ?? "--"}/100`);
  console.log(`Qualified: ${call.qualified ?? "--"}`);

  if (call.criteriaResults.length) {
    const passed = call.criteriaResults.filter((c) => c.passed).length;
    console.log(`\nCriteria (${passed}/${call.criteriaResults.length} passed):`);
    for (const c of call.criteriaResults) {
      const icon = c.passed ? "PASS" : "FAIL";
      const elim = c.eliminatory ? " [ELIMINATORY]" : "";
      console.log(`  [${icon}] ${c.question}${elim}`);
      console.log(`         Answer: ${c.answer ?? "--"}`);
    }
  }

  if (call.transcript?.length) {
    console.log(`\nTranscript (${call.transcript.length} messages):`);
    for (const t of call.transcript.slice(0, 6)) {
      const role = t.role === "agent" ? "AGENT" : "LEAD ";
      const text = t.text.length > 80 ? t.text.slice(0, 80) + "..." : t.text;
      console.log(`  ${role}: ${text}`);
    }
    if (call.transcript.length > 6) {
      console.log(`  ... +${call.transcript.length - 6} more messages`);
    }
  }
  console.log("=".repeat(60));
}

// ─── 5. List recent calls ──────────────────────────────────────────────────

async function listCalls(limit = 5) {
  const res = await fetch(`${API_BASE}/calls?limit=${limit}`, { headers });
  if (!res.ok) throw new Error(`List failed: ${res.status}`);

  const data = await res.json();
  console.log(`\nRecent calls (${data.total} total):`);
  for (const c of data.calls) {
    const score = c.status === "completed" ? `score=${c.score ?? "--"}` : "";
    console.log(
      `  ${c.id.slice(0, 8)}... | ${c.status.padEnd(12)} | ${c.leadName.padEnd(20)} | ${score}`
    );
  }
}

// ─── Webhook handler example (Express) ─────────────────────────────────────

/*
import express from "express";
const app = express();
app.use(express.json());

app.post("/webhooks/nextimmolab", (req, res) => {
  const { event, callId, externalRef, score, qualified, criteriaResults } = req.body;

  console.log(`Webhook: ${event} | Call: ${callId} | Ref: ${externalRef}`);
  console.log(`Score: ${score} | Qualified: ${qualified}`);

  // Sync back to your CRM here
  // e.g. updateLeadInCRM(externalRef, { score, qualified, criteriaResults });

  res.sendStatus(200);
});

app.listen(3001);
*/

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  await checkUsage();
  const callId = await triggerCall();

  console.log("\nWaiting 5s for call to connect...");
  await new Promise((r) => setTimeout(r, 5000));

  const result = await waitForResult(callId);
  if (result) printResults(result);

  await listCalls();
}

main().catch(console.error);
