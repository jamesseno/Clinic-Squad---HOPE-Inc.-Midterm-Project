import { NextResponse } from "next/server";
import type { BusinessRight } from "@/lib/business-access";
import { getSprint2ApiContext, mapBusinessDatabaseError } from "@/lib/sprint2-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

interface RouteContext { params: Promise<{ transno: string }>; }

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function GET(_request: Request, route: RouteContext) {
  const { transno } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!["view_sale", "add_sale", "edit_sale", "delete_sale"].some((r) => context.access.rights.has(r as BusinessRight)))
    return fail("You do not have Sale access.", 403);

  const code = transno.toUpperCase();
  const { data: sale, error: saleErr } = await context.admin.from("sales").select("transno, salesdate, custno, empno, is_deleted, stamp").eq("transno", code).maybeSingle();
  if (saleErr) { const m = mapBusinessDatabaseError(saleErr, "sale lookup"); return fail(m.error, m.status); }
  if (!sale) return fail("Sale not found.", 404);

  const { data: details } = await context.admin.from("salesdetail").select("transno, prodcode, quantity, is_deleted, stamp").eq("transno", code);
  const { data: payments } = await context.admin.from("payment").select("orno, paydate, amount, transno, is_deleted, stamp").eq("transno", code);
  const { data: balance } = await context.admin.from("sales_balance").select("*").eq("transno", code).maybeSingle();

  return NextResponse.json({ sale, details: details ?? [], payments: payments ?? [], balance: balance ?? null }, { headers: noStore });
}

export async function DELETE(_request: Request, route: RouteContext) {
  const { transno } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("delete_sale" as BusinessRight)) return fail("You cannot delete sales.", 403);

  const code = transno.toUpperCase();
  const { data: current } = await context.admin.from("sales").select("transno, is_deleted").eq("transno", code).maybeSingle();
  if (!current) return fail("Sale not found.", 404);
  if (current.is_deleted) return fail("Sale is already deleted.", 409);

  const { error } = await context.session.from("sales").update({ is_deleted: true }).eq("transno", code);
  if (error) { const m = mapBusinessDatabaseError(error, "sale delete"); return fail(m.error, m.status); }

  const { data: updated } = await context.admin.from("sales").select("transno, is_deleted, stamp").eq("transno", code).maybeSingle();
  if (!updated || !updated.is_deleted) return fail("Delete could not be verified.", 500);
  return NextResponse.json({ sale: updated }, { headers: noStore });
}

export async function POST(_request: Request, route: RouteContext) {
  const { transno } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("delete_sale" as BusinessRight)) return fail("You cannot restore sales.", 403);

  const code = transno.toUpperCase();
  const { data: current } = await context.admin.from("sales").select("transno, is_deleted").eq("transno", code).maybeSingle();
  if (!current) return fail("Sale not found.", 404);
  if (!current.is_deleted) return fail("Sale is already active.", 409);

  const { error } = await context.session.from("sales").update({ is_deleted: false }).eq("transno", code);
  if (error) { const m = mapBusinessDatabaseError(error, "sale restore"); return fail(m.error, m.status); }

  const { data: updated } = await context.admin.from("sales").select("transno, is_deleted, stamp").eq("transno", code).maybeSingle();
  if (!updated || updated.is_deleted) return fail("Restore could not be verified.", 500);
  return NextResponse.json({ sale: updated }, { headers: noStore });
}
