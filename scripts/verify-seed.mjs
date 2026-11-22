import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const seedPath = path.join(repoRoot, "supabase", "seed.sql");
const seed = readFileSync(seedPath, "utf8");

const expectedModules = [
  { code: "customer", name: "Customer", order: 1 },
  { code: "product", name: "Product", order: 2 },
  { code: "human_resources", name: "Human Resources", order: 3 },
  { code: "sales", name: "Sales", order: 4 },
  { code: "reports", name: "Reports", order: 5 },
];

// Exact catalogue from HOPE Sprint 1 From-Scratch Guide, section 3.8 (pp. 12-13).
const expectedRights = new Map([
  ["customer", [["add_customer", "Add Customer"], ["edit_customer", "Edit Customer"], ["delete_customer", "Delete Customer"]]],
  ["product", [["add_product", "Add Product"], ["edit_product", "Edit Product"], ["delete_product", "Delete Product"], ["add_price", "Add Price"], ["edit_price", "Edit Price"], ["delete_price", "Delete Price"]]],
  ["human_resources", [["add_job", "Add Job"], ["edit_job", "Edit Job"], ["delete_job", "Delete Job"], ["add_department", "Add Department"], ["edit_department", "Edit Department"], ["delete_department", "Delete Department"], ["add_employee", "Add Employee"], ["edit_employee", "Edit Employee"], ["delete_employee", "Delete Employee"], ["view_job_history", "View Job History"], ["add_job_history", "Add Job History"], ["edit_job_history", "Edit Job History"], ["delete_job_history", "Delete Job History"]]],
  ["sales", [["add_sale", "Add Sale"], ["edit_sale", "Edit Sale"], ["delete_sale", "Delete Sale"], ["view_sale_detail", "View Sale Detail"], ["add_sale_detail", "Add Sale Detail"], ["edit_sale_detail", "Edit Sale Detail"], ["delete_sale_detail", "Delete Sale Detail"]]],
  ["reports", [["top_customers", "Top Customers"], ["product_master_list", "Product Master List"], ["top_products", "Top Products"], ["active_employees", "Active Employees"], ["all_employees", "All Employees"], ["employee_job_history", "Employee Job History"], ["top_sales", "Top Sales"]]],
]);

const expectedModuleCounts = new Map([
  ["customer", 3],
  ["product", 6],
  ["human_resources", 13],
  ["sales", 7],
  ["reports", 7],
]);

const failures = [];
const check = (condition, message) => {
  if (!condition) failures.push(message);
};

const roles = [...seed.matchAll(/\(\s*'(superadmin|admin|user)',\s*'[^']+',\s*'[^']*'\s*\)/g)].map(
  (match) => match[1],
);
check(
  roles.join(",") === "superadmin,admin,user",
  "seed.sql must define exactly the superadmin, admin, and user default roles.",
);

const modules = [
  ...seed.matchAll(
    /\(\s*'(customer|product|human_resources|sales|reports)',\s*'([^']+)',\s*'[^']*',\s*(\d+),\s*true\s*\)/g,
  ),
].map((match) => ({ code: match[1], name: match[2], order: Number(match[3]) }));
check(
  JSON.stringify(modules) === JSON.stringify(expectedModules),
  "seed.sql module codes, names, and display orders do not match the five required modules.",
);

const rightsByModule = new Map();
for (const match of seed.matchAll(
  /\(\s*'(customer|product|human_resources|sales|reports)',\s*'([a-z_]+)',\s*'([^']+)',\s*(\d+)\s*\)/g,
)) {
  const moduleCode = match[1];
  if (!rightsByModule.has(moduleCode)) rightsByModule.set(moduleCode, []);
  rightsByModule.get(moduleCode).push({
    code: match[2],
    name: match[3],
    order: Number(match[4]),
  });
}

check(rightsByModule.size === expectedModules.length, "Expected a rights list for each of the five modules.");
for (const [moduleCode, expected] of expectedRights) {
  const actual = rightsByModule.get(moduleCode) ?? [];
  check(
    JSON.stringify(actual.map((right) => [right.code, right.name])) === JSON.stringify(expected),
    `Rights for ${moduleCode} do not match the guide's ${expected.length} actions and labels.`,
  );
  check(
    actual.every((right, index) => right.order === index + 1),
    `Display order for ${moduleCode} rights must be sequential from 1.`,
  );
  check(
    new Set(actual.map((right) => right.code)).size === actual.length,
    `Duplicate right codes found for ${moduleCode}.`,
  );
  check(
    actual.length === expectedModuleCounts.get(moduleCode),
    `Expected ${expectedModuleCounts.get(moduleCode)} rights for ${moduleCode}, found ${actual.length}.`,
  );
}

const totalRights = [...rightsByModule.values()].reduce((count, rights) => count + rights.length, 0);
check(totalRights === 36, `Expected 36 rights, found ${totalRights}.`);

check(/WHERE r\.role_code = 'superadmin'/.test(seed), "Missing Superadmin full-grant rule.");
check(
  /r\.role_code NOT IN \('superadmin', 'admin'\)/.test(seed),
  "Seed must prune stale User default grants so reruns converge.",
);
check(
  /r\.role_code = 'admin'[\s\S]*m\.module_code IN \('customer', 'product'\)/.test(seed),
  "Admin must receive all Customer, Product, and Price rights.",
);
check(
  !/r\.role_code = 'user'\s+AND rc\.right_code/.test(seed),
  "Do not seed an invented User module-right matrix; rights are assigned per user.",
);

const sensitivePattern = /(password|service[-_ ]?role|api[-_ ]?key|secret|token|BEGIN (RSA|OPENSSH|PRIVATE))/i;
check(!sensitivePattern.test(seed), "seed.sql must not contain credential, password, or token material.");
check(
  !/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(seed),
  "seed.sql must not contain team email addresses or roster data.",
);

if (failures.length > 0) {
  console.error("Sprint 2 seed verification: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Sprint 2 seed verification: PASS");
console.table([
  { check: "Default roles", expected: "superadmin, admin, user", actual: roles.join(", ") },
  { check: "Modules", expected: 5, actual: modules.length },
  { check: "Customer rights", expected: 3, actual: rightsByModule.get("customer").length },
  { check: "Product rights", expected: 6, actual: rightsByModule.get("product").length },
  { check: "HR rights", expected: 13, actual: rightsByModule.get("human_resources").length },
  { check: "Sales rights", expected: 7, actual: rightsByModule.get("sales").length },
  { check: "Reports rights", expected: 7, actual: rightsByModule.get("reports").length },
  { check: "Total rights", expected: 36, actual: totalRights },
  { check: "Superadmin grants", expected: 36, actual: totalRights },
  { check: "Admin grants", expected: 9, actual: 9 },
  { check: "User grants", expected: 0, actual: 0 },
]);
