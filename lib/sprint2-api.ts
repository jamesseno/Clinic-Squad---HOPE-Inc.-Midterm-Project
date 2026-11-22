import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getBusinessAccess, type BusinessAccess, type BusinessRight } from "@/lib/business-access";

export async function getSprint2ApiContext() {
  let session: Awaited<ReturnType<typeof createClient>>;
  let admin: ReturnType<typeof createAdminClient>;
  try {
    session = await createClient();
    admin = createAdminClient();
  } catch (configError) {
    console.error("Sprint 2 API configuration error:", configError);
    return {
      ok: false as const,
      status: 500,
      error: "The workspace is not configured on the server.",
    };
  }

  const result = await getBusinessAccess(session, admin);
  if (!result.ok) return result;
  return { ok: true as const, session, admin, access: result.access };
}

export type Sprint2ApiContext = Extract<
  Awaited<ReturnType<typeof getSprint2ApiContext>>,
  { ok: true }
>;

export function hasRight(context: Sprint2ApiContext, right: BusinessRight) {
  return context.access.rights.has(right);
}

export function canReadCustomer(access: BusinessAccess) {
  return ["add_customer", "edit_customer", "delete_customer"].some((right) =>
    access.rights.has(right as BusinessRight),
  );
}

export function canReadProducts(access: BusinessAccess) {
  return [
    "add_product",
    "edit_product",
    "delete_product",
    "add_price",
    "edit_price",
    "delete_price",
  ].some((right) => access.rights.has(right as BusinessRight));
}

export function canReadPrices(access: BusinessAccess) {
  return ["add_price", "edit_price", "delete_price"].some((right) =>
    access.rights.has(right as BusinessRight),
  );
}

export function isManager(access: BusinessAccess) {
  return access.roleCode === "admin" || access.roleCode === "superadmin";
}

export function mapBusinessDatabaseError(
  error: { code?: string; message?: string },
  operation: string,
) {
  if (error.code === "42501") {
    return { status: 403, error: "You do not have permission to perform this action." };
  }
  if (error.code === "23505") {
    return { status: 409, error: "A record with that code or effective date already exists." };
  }
  if (error.code === "23514" || error.code === "22P02" || error.code === "22007") {
    return { status: 400, error: "The submitted values do not meet the data requirements." };
  }
  if (error.code === "P0001") {
    return {
      status: 409,
      error: "This record cannot be deleted while active related records exist.",
    };
  }

  console.error(`Sprint 2 ${operation} failed:`, error.message ?? error.code ?? "Unknown database error.");
  return { status: 500, error: "The record could not be saved." };
}
