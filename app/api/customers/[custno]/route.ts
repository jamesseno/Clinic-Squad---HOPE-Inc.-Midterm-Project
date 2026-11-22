import { NextResponse } from "next/server";
import { hasAnyBusinessRight } from "@/lib/business-access";
import { getSprint2ApiContext, hasRight, mapBusinessDatabaseError } from "@/lib/sprint2-api";
import { validateCustomerEditInput } from "@/lib/sprint2-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;
const customerRights = ["add_customer", "edit_customer", "delete_customer"] as const;

interface RouteContext {
  params: Promise<{ custno: string }>;
}

function fail(error: string, status: number, fieldErrors?: Record<string, string>) {
  return NextResponse.json(fieldErrors ? { error, fieldErrors } : { error }, {
    status,
    headers: noStore,
  });
}

async function updateDeleteState(
  context: Awaited<ReturnType<typeof getSprint2ApiContext>> & { ok: true },
  custno: string,
  isDeleted: boolean,
) {
  const { data: current, error: lookupError } = await context.admin
    .from("customer")
    .select("custno, is_deleted")
    .eq("custno", custno)
    .maybeSingle();

  if (lookupError) {
    const mapped = mapBusinessDatabaseError(lookupError, "customer lookup");
    return fail(mapped.error, mapped.status);
  }
  if (!current) return fail("Customer not found.", 404);
  if (current.is_deleted === isDeleted) {
    return fail(isDeleted ? "Customer is already deleted." : "Customer is already active.", 409);
  }

  const { error } = await context.session
    .from("customer")
    .update({ is_deleted: isDeleted })
    .eq("custno", custno);

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "customer status update");
    return fail(mapped.error, mapped.status);
  }

  const { data: updated, error: verifyError } = await context.admin
    .from("customer")
    .select("custno, is_deleted, stamp")
    .eq("custno", custno)
    .maybeSingle();

  if (verifyError || !updated || updated.is_deleted !== isDeleted) {
    console.error("Customer status verification failed:", verifyError?.message ?? "No updated row.");
    return fail("The customer status could not be verified.", 500);
  }
  return NextResponse.json({ customer: updated }, { headers: noStore });
}

export async function PATCH(request: Request, route: RouteContext) {
  const { custno } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasAnyBusinessRight(context.access, customerRights)) {
    return fail("You do not have Customer access.", 403);
  }
  if (!hasRight(context, "edit_customer")) return fail("You cannot edit customers.", 403);

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }
  const validation = validateCustomerEditInput(payload);
  if (!validation.ok) return fail(validation.error, 400, validation.fieldErrors);

  const { data, error } = await context.session
    .from("customer")
    .update(validation.value)
    .eq("custno", custno)
    .eq("is_deleted", false)
    .select("custno, custname, address, payterm, is_deleted, stamp")
    .maybeSingle();

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "customer update");
    return fail(mapped.error, mapped.status);
  }
  if (!data) return fail("Customer not found.", 404);
  return NextResponse.json({ customer: data }, { headers: noStore });
}

export async function DELETE(_request: Request, route: RouteContext) {
  const { custno } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasRight(context, "delete_customer")) return fail("You cannot delete customers.", 403);
  return updateDeleteState(context, custno, true);
}

export async function POST(_request: Request, route: RouteContext) {
  const { custno } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasRight(context, "delete_customer")) return fail("You cannot restore customers.", 403);
  return updateDeleteState(context, custno, false);
}
