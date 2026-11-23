import { NextResponse } from "next/server";
import { canReadPrices, getSprint2ApiContext, hasRight, mapBusinessDatabaseError } from "@/lib/sprint2-api";
import { validatePriceInput } from "@/lib/sprint2-validation";

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

export async function GET(request: Request, route: RouteContext) {
  const { prodcode } = await route.params;
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!canReadPrices(context.access)) return fail("You do not have Price access.", 403);

  const includeDeleted = new URL(request.url).searchParams.get("includeDeleted") === "true";
  if (includeDeleted && !hasRight(context, "delete_price")) {
    return fail("You need the delete-price right to view deleted prices.", 403);
  }

  const { data: product, error: productError } = await context.admin
    .from("product")
    .select("prodcode, is_deleted")
    .eq("prodcode", prodcode)
    .maybeSingle();

  if (productError) {
    const mapped = mapBusinessDatabaseError(productError, "price product lookup");
    return fail(mapped.error, mapped.status);
  }
  if (!product || (product.is_deleted && !includeDeleted)) return fail("Product not found.", 404);

  const { data, error } = await context.admin
    .from("pricehist")
    .select("prodcode, effdate, unitprice, is_deleted, stamp")
    .eq("prodcode", prodcode)
    .order("effdate", { ascending: false });

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "price history list");
    return fail(mapped.error, mapped.status);
  }

  return NextResponse.json(
    {
      prices: (data ?? []).filter((row) => includeDeleted || !row.is_deleted),
      permissions: {
        addPrice: hasRight(context, "add_price"),
        editPrice: hasRight(context, "edit_price"),
        deletePrice: hasRight(context, "delete_price"),
      },
    },
    { headers: noStore },
  );
}

export async function POST(request: Request, route: RouteContext) {
  const { prodcode } = await route.params;
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("Request body must be valid JSON.", 400);
  }

  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!hasRight(context, "add_price")) return fail("You cannot add prices.", 403);

  const validation = validatePriceInput(payload);
  if (!validation.ok) return fail(validation.error, 400, validation.fieldErrors);

  const { data: product, error: productError } = await context.admin
    .from("product")
    .select("prodcode")
    .eq("prodcode", prodcode)
    .eq("is_deleted", false)
    .maybeSingle();

  if (productError) {
    const mapped = mapBusinessDatabaseError(productError, "price product lookup");
    return fail(mapped.error, mapped.status);
  }
  if (!product) return fail("Active product not found.", 404);

  const { data, error } = await context.session
    .from("pricehist")
    .insert({ prodcode, ...validation.value })
    .select("prodcode, effdate, unitprice, is_deleted, stamp")
    .single();

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "price creation");
    return fail(mapped.error, mapped.status);
  }

  return NextResponse.json({ price: data }, { status: 201, headers: noStore });
}
