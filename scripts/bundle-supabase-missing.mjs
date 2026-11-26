import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migDir = path.join(root, "supabase", "migrations");
const outPath = path.join(root, "supabase", "hosted-missing.generated.sql");

const needed = [
  "20261118_hope_base_tables_and_sample_data.sql",
  "20261121_audit_user_jwt_actor.sql",
  "20261121030000_grant_app_private_to_service_role.sql",
  "20261121130000_user_rights_audit_and_rpc.sql",
  "20261122130000_sprint2_customer_product_access.sql",
  "20261124090000_sprint2_deleted_view_rights.sql",
  "20261125090000_s3_employee_current_position.sql",
];

const parts = [
  "-- HOPE Inc. ERP - MISSING migrations only (hosted DB already has S1 access-control tables).",
  "-- Run this in the Supabase SQL Editor. Do NOT run the full bundle (it fails on app_role).",
  "--",
  `-- Generated ${new Date().toISOString()}`,
  "",
];
for (const name of needed) {
  const sql = fs.readFileSync(path.join(migDir, name), "utf8");
  parts.push("-- =====================================================================", "-- " + name, "-- =====================================================================", sql.trimEnd(), "");
}
fs.writeFileSync(outPath, parts.join("\n") + "\n", "utf8");
console.log("wrote", outPath, (fs.statSync(outPath).size / 1024).toFixed(1) + " KiB");
console.log("files:", needed.length);
