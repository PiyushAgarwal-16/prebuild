import { Hono } from "hono";
import type { DerivedBuilding } from "../pipeline/types.js";
import { lodge } from "./lodgement.js";
import { claim, decide, get, list, verify } from "./review.js";
import { read } from "./store.js";
import type { Decision, Role, SubmissionState } from "./types.js";

const ROLES: Role[] = ["surveyor", "officer", "public"];
const DECISIONS: Decision[] = ["approve", "object", "reject"];

export const registryRoutes = new Hono();

function roleOf(header: string | undefined): Role {
  return ROLES.includes(header as Role) ? (header as Role) : "public";
}

registryRoutes.post("/submissions", async (c) => {
  const role = roleOf(c.req.header("x-ulpin-role"));
  if (role !== "surveyor") return c.json({ ok: false, error: "Only a surveyor may lodge" }, 403);

  const body = (await c.req.json().catch(() => null)) as
    | { buildings?: DerivedBuilding[]; note?: string }
    | null;
  const buildings = body?.buildings;
  if (!Array.isArray(buildings) || !buildings.length) {
    return c.json({ ok: false, error: "buildings[] required" }, 400);
  }

  const submission = lodge(buildings, body?.note?.slice(0, 500) ?? null, role);
  return c.json({ ok: true, submission }, 201);
});

registryRoutes.get("/submissions", (c) => {
  const state = c.req.query("state") as SubmissionState | undefined;
  const summaries = list(state).map((s) => ({
    id: s.id,
    reference: s.reference,
    state: s.state,
    lodgedAt: s.lodgedAt,
    decidedAt: s.decidedAt,
    buildings: s.buildings.length,
    volumes: s.buildings.reduce((n, b) => n + b.volumes.length, 0),
    criticalFindings: s.validation.findings.filter((f) => f.severity === "critical").length,
    conflicts: s.conflicts.length,
    note: s.note,
  }));
  return c.json({ ok: true, submissions: summaries });
});

registryRoutes.get("/submissions/:id", (c) => {
  const submission = get(c.req.param("id"));
  if (!submission) return c.json({ ok: false, error: "Submission not found" }, 404);
  return c.json({ ok: true, submission });
});

registryRoutes.post("/submissions/:id/claim", async (c) => {
  if (roleOf(c.req.header("x-ulpin-role")) !== "officer") {
    return c.json({ ok: false, error: "Only an officer may open a review" }, 403);
  }
  const body = (await c.req.json().catch(() => null)) as { note?: string } | null;
  const result = claim(c.req.param("id"), body?.note?.slice(0, 500) ?? null);
  if ("error" in result) return c.json({ ok: false, error: result.error }, 409);
  return c.json({ ok: true, submission: result });
});

registryRoutes.post("/submissions/:id/decide", async (c) => {
  if (roleOf(c.req.header("x-ulpin-role")) !== "officer") {
    return c.json({ ok: false, error: "Only an officer may decide" }, 403);
  }
  const body = (await c.req.json().catch(() => null)) as
    | { decision?: Decision; note?: string }
    | null;
  const decision = body?.decision;
  if (!decision || !DECISIONS.includes(decision)) {
    return c.json({ ok: false, error: "decision must be approve, object or reject" }, 400);
  }
  const result = decide(c.req.param("id"), decision, body?.note?.slice(0, 500) ?? null);
  if ("error" in result) return c.json({ ok: false, error: result.error }, 409);
  return c.json({ ok: true, ...result });
});

registryRoutes.get("/records", (c) => {
  const records = read().records.map((r) => ({
    ulpin: r.ulpin,
    label: r.label,
    band: r.band,
    level: r.level,
    use: r.use,
    zMin: r.zMin,
    zMax: r.zMax,
    registeredAt: r.registeredAt,
  }));
  return c.json({ ok: true, count: records.length, records });
});

registryRoutes.get("/verify/:ulpin", (c) => c.json({ ok: true, ...verify(c.req.param("ulpin")) }));
