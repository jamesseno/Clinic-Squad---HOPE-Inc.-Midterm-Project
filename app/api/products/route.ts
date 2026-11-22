import { NextResponse } from "next/server";
import { hasAnyBusinessRight } from "@/lib/business-access";
import { canReadPrices, canReadProducts, getSprint2ApiContext, hasRight, isManager, mapBusinessDatabaseError } from "@/lib/sprint2-api";
import { validateProductInput } from "@/lib/sprint2-validation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;
const productRights = ["add_product", "edit_product", "delete_product", "add_price", "edit_price", "delete_price"] as const;

function fail(error: string, status: number, fieldErrors?: Record<string, string>) {
  return NextResponse.json(fieldErrors ? { error, fieldErrors } : { error }, {
    status,
    headers: noStore,
  });
}

function isIsoDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const [, year, month, day] = match;
  const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  return parsed.getUTCFullYear() === Number(year)
    && parsed.getUTCMonth() === Number(month) - 1
    && parsed.getUTCDate() === Number(day);
}

export async function GET(request: Request) {
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!canReadProducts(context.access)) return fail("You do not have Product access.", 403);

  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  if (includeDeleted && !isManager(context.access)) {
    return fail("Only Admins can view deleted products.", 403);
  }

  const rawAsOf = url.searchParams.get("asOf") ?? new Date().toISOString().slice(0, 10);
  if (!isIsoDate(rawAsOf)) return fail("Enter a valid as-of date.", 400);

  const [productsResult, pricesResult] = await Promise.all([
    context.admin
      .from("product")
      .select("prodcode, description, unit, is_deleted, stamp")
      .order("prodcode", { ascending: true })
      .limit(500),
    canReadPrices(context.access)
      ? context.admin
          .from("pricehist")
          .select("prodcode, effdate, unitprice, is_deleted")
          .lte("effdate", rawAsOf)
          .order("prodcode", { ascending: true })
          .order("effdate", { ascending: false })
          .limit(2000)
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (productsResult.error || pricesResult.error) {
    const error = productsResult.error ?? pricesResult.error;
    if (!error) return fail("Could not load products.", 500);
    const mapped = mapBusinessDatabaseError(error, "product list");
    return fail(mapped.error, mapped.status);
  }

  const currentPriceByCode = new Map<string, { effdate: string; unitprice: number }>();
  for (const price of pricesResult.data ?? []) {
    if (price.is_deleted || currentPriceByCode.has(price.prodcode)) continue;
    currentPriceByCode.set(price.prodcode, {
      effdate: price.effdate,
      unitprice: Number(price.unitprice),
    });
  }

  const query = (url.searchParams.get("q") ?? "").trim().toLocaleLowerCase();
  const products = (productsResult.data ?? []).filter((product) => {
    if (!includeDeleted && product.is_deleted) return false;
    if (!query) return true;
    return [product.prodcode, product.description]
      .some((value) => value?.toLocaleLowerCase().includes(query));
  }).map((product) => ({
    ...product,
    currentPrice: currentPriceByCode.get(product.prodcode) ?? null,
  }));

  return NextResponse.json(
    {
      products,
      asOf: rawAsOf,
      permissions: {
        add: hasRight(context, "add_product"),
        edit: hasRight(context, "edit_product"),
        delete: hasRight(context, "delete_product"),
        canViewDeleted: isManager(context.access),
        canViewPrices: canReadPrices(context.access),
        addPrice: hasRight(context, "add_price"),
        editPrice: hasRight(context, "edit_price"),
        deletePrice: hasRight(context, "delete_price"),
        canRestore: hasRight(context, "delete_product") && includeDeleted,
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
  if (!hasAnyBusinessRight(context.access, productRights)) {
    return fail("You do not have Product access.", 403);
  }
  if (!hasRight(context, "add_product")) return fail("You cannot add products.", 403);

  const validation = validateProductInput(payload);
  if (!validation.ok) return fail(validation.error, 400, validation.fieldErrors);

  const { data, error } = await context.session
    .from("product")
    .insert(validation.value)
    .select("prodcode, description, unit, is_deleted, stamp")
    .single();

  if (error) {
    const mapped = mapBusinessDatabaseError(error, "product creation");
    return fail(mapped.error, mapped.status);
  }

  return NextResponse.json({ product: data }, { status: 201, headers: noStore });
}
