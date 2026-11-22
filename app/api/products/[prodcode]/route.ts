import { NextResponse } from "next/server";
import { getSprint2ApiContext, hasRight, mapBusinessDatabaseError } from "@/lib/sprint2-api";
import { validateProductEditInput } from "@/lib/sprint2-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

interface RouteContext {
  params: Promise<{ prodcode: string }>;
}

function fail(error: string, status: number, fieldErrors?: Record<string, string>) {
  return NextResponse.json(fieldErrors ? { error, fieldErrors } : { error }, {
    status,
    headers: noStore,
  });
}

async function updateDeleteState(
  context: Awaited<ReturnType<typeof getSprint2ApiContext>> & { ok: true },
  prodcode: string,
  isDeleted: boolean,
) {
  const { data: current, error: lookupError } = await context.admin
    .from("product")
    .select("prodcode, is_deleted")
    .eq("prodcode", prodcode)
    .maybeSingle();

  if (lookupError) {
    const mapped = mapBusinessDatabaseError(lookupError, "product lookup");
    return fail(mapped.error, mapped.status);
  }
  if (!current) return fail("Product not found.", 404);
  if (current.is_deleted === isDeleted) {
    return fail(isDeleted ? "Product is already deleted." : "Product is already active.", 409);
  }

  const { error } = await context.session
    .from("product")
    .update({ is_deleted: isDeleted })
    .eq("prodcode", prodcode);

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "product status update");
    return fail(mapped.error, mapped.status);
  }

  const { data: updated, error: verifyError } = await context.admin
    .from("product")
    .select("prodcode, is_deleted, stamp")
    .eq("prodcode", prodcode)
    .maybeSingle();

  if (verifyError || !updated || updated.is_deleted !== isDeleted) {
    console.error("Product status verification failed:", verifyError?.message ?? "No updated row.");
    return fail("The product status could not be verified.", 500);
  }
  return NextResponse.json({ product: updated }, { headers: noStore });
}

export async function PATCH(request: Request, route: RouteContext) {
  const { prodcode } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasRight(context, "edit_product")) return fail("You cannot edit products.", 403);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }
  const validation = validateProductEditInput(payload);
  if (!validation.ok) return fail(validation.error, 400, validation.fieldErrors);

  const { data, error } = await context.session
    .from("product")
    .update(validation.value)
    .eq("prodcode", prodcode)
    .eq("is_deleted", false)
    .select("prodcode, description, unit, is_deleted, stamp")
    .maybeSingle();

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "product update");
    return fail(mapped.error, mapped.status);
  }
  if (!data) return fail("Product not found.", 404);
  return NextResponse.json({ product: data }, { headers: noStore });
}

export async function DELETE(_request: Request, route: RouteContext) {
  const { prodcode } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasRight(context, "delete_product")) return fail("You cannot delete products.", 403);
  return updateDeleteState(context, prodcode, true);
}

export async function POST(_request: Request, route: RouteContext) {
  const { prodcode } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasRight(context, "delete_product")) return fail("You cannot restore products.", 403);
  return updateDeleteState(context, prodcode, false);
}
