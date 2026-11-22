import { NextResponse } from "next/server";
import { getSprint2ApiContext, hasRight, mapBusinessDatabaseError } from "@/lib/sprint2-api";
import { validatePriceInput } from "@/lib/sprint2-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

interface RouteContext {
  params: Promise<{ prodcode: string; effdate: string }>;
}

function fail(error: string, status: number, fieldErrors?: Record<string, string>) {
  return NextResponse.json(fieldErrors ? { error, fieldErrors } : { error }, {
    status,
    headers: noStore,
  });
}

async function updateDeleteState(
  context: NonNullable<Awaited<ReturnType<typeof getSprint2ApiContext>> & { ok: true }>,
  prodcode: string,
  effdate: string,
  isDeleted: boolean,
) {
  const { data: current, error: lookupError } = await context.admin
    .from("pricehist")
    .select("prodcode, effdate, is_deleted")
    .eq("prodcode", prodcode)
    .eq("effdate", effdate)
    .maybeSingle();

  if (lookupError) {
    const mapped = mapBusinessDatabaseError(lookupError, "price lookup");
    return fail(mapped.error, mapped.status);
  }
  if (!current) return fail("Price history entry not found.", 404);
  if (current.is_deleted === isDeleted) {
    return fail(isDeleted ? "Price is already deleted." : "Price is already active.", 409);
  }

  const { error } = await context.session
    .from("pricehist")
    .update({ is_deleted: isDeleted })
    .eq("prodcode", prodcode)
    .eq("effdate", effdate);

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "price status update");
    return fail(mapped.error, mapped.status);
  }

  const { data: updated, error: verifyError } = await context.admin
    .from("pricehist")
    .select("prodcode, effdate, unitprice, is_deleted, stamp")
    .eq("prodcode", prodcode)
    .eq("effdate", effdate)
    .maybeSingle();

  if (verifyError || !updated || updated.is_deleted !== isDeleted) {
    console.error("Price status verification failed:", verifyError?.message ?? "No updated row.");
    return fail("The price status could not be verified.", 500);
  }
  return NextResponse.json({ price: updated }, { headers: noStore });
}

export async function PATCH(request: Request, route: RouteContext) {
  const { prodcode, effdate } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasRight(context, "edit_price")) return fail("You cannot edit prices.", 403);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }
  const validation = validatePriceInput(payload);
  if (!validation.ok) return fail(validation.error, 400, validation.fieldErrors);

  const { data, error } = await context.session
    .from("pricehist")
    .update(validation.value)
    .eq("prodcode", prodcode)
    .eq("effdate", effdate)
    .eq("is_deleted", false)
    .select("prodcode, effdate, unitprice, is_deleted, stamp")
    .maybeSingle();

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "price update");
    return fail(mapped.error, mapped.status);
  }
  if (!data) return fail("Price history entry not found.", 404);
  return NextResponse.json({ price: data }, { headers: noStore });
}

export async function DELETE(_request: Request, route: RouteContext) {
  const { prodcode, effdate } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasRight(context, "delete_price")) return fail("You cannot delete prices.", 403);
  return updateDeleteState(context, prodcode, effdate, true);
}

export async function POST(_request: Request, route: RouteContext) {
  const { prodcode, effdate } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasRight(context, "delete_price")) return fail("You cannot restore prices.", 403);
  return updateDeleteState(context, prodcode, effdate, false);
}
