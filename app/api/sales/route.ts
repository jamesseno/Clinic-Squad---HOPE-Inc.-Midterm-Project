import { NextResponse } from "next/server";
import type { BusinessRight } from "@/lib/business-access";
import { getSprint2ApiContext, mapBusinessDatabaseError } from "@/lib/sprint2-api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function GET(request: Request) {
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!["view_sale", "add_sale", "edit_sale", "delete_sale"].some((r) => context.access.rights.has(r as BusinessRight)))
    return fail("You do not have Sale access.", 403);

  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const { data, error } = await context.admin
    .from("sales")
    .select("transno, salesdate, custno, empno, is_deleted, stamp")
    .order("salesdate", { ascending: false })
    .limit(500);

  if (error) { const m = mapBusinessDatabaseError(error, "sales list"); return fail(m.error, m.status); }

  // Get balances.
  const { data: balances } = await context.admin.from("sales_balance").select("*");
  const balanceMap = new Map((balances ?? []).map((b: { transno: string; total_amount: number; paid_amount: number; balance: number }) => [b.transno, b]));

  const sales = (data ?? []).filter((row) => {
    if (!includeDeleted && row.is_deleted) return false;
    if (!query) return true;
    return [row.transno, row.custno, row.empno].some((v) => v?.toLowerCase().includes(query));
  });

  const result = sales.map((s) => ({
    ...s,
    balance: balanceMap.get(s.transno) ?? null,
  }));

  return NextResponse.json(
    {
      sales: result,
      permissions: {
        add: context.access.rights.has("add_sale" as BusinessRight),
        edit: context.access.rights.has("edit_sale" as BusinessRight),
        delete: context.access.rights.has("delete_sale" as BusinessRight),
        canViewDeleted: context.access.rights.has("delete_sale" as BusinessRight),
        canRestore: context.access.rights.has("delete_sale" as BusinessRight) && includeDeleted,
        canViewPayment: context.access.rights.has("view_payment" as BusinessRight),
        canAddPayment: context.access.rights.has("add_payment" as BusinessRight),
      },
    },
    { headers: noStore },
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); } catch { return fail("Request body must be valid JSON.", 400); }

  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("add_sale" as BusinessRight)) return fail("You cannot add sales.", 403);

  const body = payload as Record<string, unknown>;
  const transno = typeof body.transno === "string" ? body.transno.trim().toUpperCase() : "";
  const salesdate = typeof body.salesdate === "string" ? body.salesdate.trim() : "";
  const custno = typeof body.custno === "string" ? body.custno.trim().toUpperCase() : null;
  const empno = typeof body.empno === "string" ? body.empno.trim().toUpperCase() : null;

  if (!transno || transno.length > 8) return fail("Transaction number must be 1-8 characters.", 400);
  if (!salesdate) return fail("Sales date is required.", 400);

  const { data, error } = await context.session
    .from("sales")
    .insert({ transno, salesdate, custno, empno })
    .select("transno, salesdate, custno, empno, is_deleted, stamp")
    .single();

  if (error) { const m = mapBusinessDatabaseError(error, "sale creation"); return fail(m.error, m.status); }
  return NextResponse.json({ sale: data }, { status: 201, headers: noStore });
}
