import { NextResponse } from "next/server";
import { getSprint2ApiContext, mapBusinessDatabaseError } from "@/lib/sprint2-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;
const actions = new Set(["ADD", "EDIT", "DELETE", "RESTORE"]);

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

function parseDate(value: string | null) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
    ? value
    : false;
}

export async function GET(request: Request) {
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (context.access.roleCode !== "superadmin" || !context.access.rights.has("view_audit_log")) {
    return fail("Audit history is available only to authorized superadmins.", 403);
  }

  const url = new URL(request.url);
  const from = parseDate(url.searchParams.get("from"));
  const to = parseDate(url.searchParams.get("to"));
  if (from === false || to === false) return fail("Dates must be valid YYYY-MM-DD values.", 400);
  if (from && to && from > to) return fail("The start date must be on or before the end date.", 400);
  const action = url.searchParams.get("action")?.toUpperCase() ?? "";
  if (action && !actions.has(action)) return fail("Choose a valid audit action.", 400);
  const tableName = url.searchParams.get("table")?.trim() ?? "";
  const actor = url.searchParams.get("actor")?.trim() ?? "";
  const rawPage = Number(url.searchParams.get("page") ?? "1");
  if (!Number.isInteger(rawPage) || rawPage < 1 || rawPage > 1000) {
    return fail("Page must be a whole number between 1 and 1000.", 400);
  }

  let query = context.session
    .from("audit_log_superadmin")
    .select("audit_id, table_name, action, record_key, old_values, new_values, action_by, action_at")
    .order("action_at", { ascending: false })
    .order("audit_id", { ascending: false })
    .range((rawPage - 1) * 100, rawPage * 100 - 1);
  if (from) query = query.gte("action_at", `${from}T00:00:00.000Z`);
  if (to) {
    const endExclusive = new Date(`${to}T00:00:00.000Z`);
    endExclusive.setUTCDate(endExclusive.getUTCDate() + 1);
    query = query.lt("action_at", endExclusive.toISOString());
  }
  if (action) query = query.eq("action", action);
  if (tableName) query = query.ilike("table_name", tableName);
  if (actor) query = query.ilike("action_by", `%${actor}%`);
  const { data, error } = await query;
  if (error) {
    const mapped = mapBusinessDatabaseError(error, "audit log list");
    return fail(mapped.error, mapped.status);
  }
  return NextResponse.json(
    { entries: data ?? [], page: rawPage, pageSize: 100 },
    { headers: noStore },
  );
}
