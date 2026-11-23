import { NextResponse } from "next/server";
import { hasAnyBusinessRight } from "@/lib/business-access";
import { canReadCustomer, getSprint2ApiContext, hasRight, mapBusinessDatabaseError } from "@/lib/sprint2-api";
import { validateCustomerInput } from "@/lib/sprint2-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;
const customerRights = ["add_customer", "edit_customer", "delete_customer"] as const;

function fail(error: string, status: number, fieldErrors?: Record<string, string>) {
  return NextResponse.json(fieldErrors ? { error, fieldErrors } : { error }, {
    status,
    headers: noStore,
  });
}

export async function GET(request: Request) {
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!canReadCustomer(context.access)) return fail("You do not have Customer access.", 403);

  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  if (includeDeleted && !hasRight(context, "delete_customer")) {
    return fail("You need the delete-customer right to view deleted customers.", 403);
  }

  const { data, error } = await context.admin
    .from("customer")
    .select("custno, custname, address, payterm, is_deleted, stamp")
    .order("custno", { ascending: true })
    .limit(500);

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "customer list");
    return fail(mapped.error, mapped.status);
  }

  const query = (url.searchParams.get("q") ?? "").trim().toLocaleLowerCase();
  const customers = (data ?? []).filter((row) => {
    if (!includeDeleted && row.is_deleted) return false;
    if (!query) return true;
    return [row.custno, row.custname, row.address]
      .some((value) => value?.toLocaleLowerCase().includes(query));
  });

  return NextResponse.json(
    {
      customers,
      permissions: {
        add: hasRight(context, "add_customer"),
        edit: hasRight(context, "edit_customer"),
        delete: hasRight(context, "delete_customer"),
        canViewDeleted: hasRight(context, "delete_customer"),
        canRestore: hasRight(context, "delete_customer") && includeDeleted,
      },
    },
    { headers: noStore },
  );
}

export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }

  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasAnyBusinessRight(context.access, customerRights)) {
    return fail("You do not have Customer access.", 403);
  }
  if (!hasRight(context, "add_customer")) return fail("You cannot add customers.", 403);

  const validation = validateCustomerInput(payload);
  if (!validation.ok) return fail(validation.error, 400, validation.fieldErrors);

  const { data, error } = await context.session
    .from("customer")
    .insert(validation.value)
    .select("custno, custname, address, payterm, is_deleted, stamp")
    .single();

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "customer creation");
    return fail(mapped.error, mapped.status);
  }

  return NextResponse.json({ customer: data }, { status: 201, headers: noStore });
}
