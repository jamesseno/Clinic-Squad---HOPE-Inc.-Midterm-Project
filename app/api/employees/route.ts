import { NextResponse } from "next/server";
import { getSprint2ApiContext, mapBusinessDatabaseError } from "@/lib/sprint2-api";
import type { BusinessRight } from "@/lib/business-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const noStore = { "Cache-Control": "no-store" } as const;

function fail(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: noStore });
}

export async function GET(request: Request) {
  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!["view_employee", "add_employee", "edit_employee", "delete_employee"].some((r) => context.access.rights.has(r as BusinessRight)))
    return fail("You do not have Employee access.", 403);

  const url = new URL(request.url);
  const includeDeleted = url.searchParams.get("includeDeleted") === "true";
  if (includeDeleted && !context.access.rights.has("delete_employee" as BusinessRight))
    return fail("You need the delete-employee right to view deleted employees.", 403);

  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const gender = (url.searchParams.get("gender") ?? "").trim();
  const dept = (url.searchParams.get("dept") ?? "").trim().toUpperCase();

  const { data, error } = await context.admin
    .from("employee")
    .select("empno, lastname, firstname, gender, birthdate, hiredate, sepdate, is_deleted, stamp")
    .order("lastname", { ascending: true })
    .limit(500);

  if (error) { const m = mapBusinessDatabaseError(error, "employee list"); return fail(m.error, m.status); }

  // Fetch current job per employee.
  const { data: jh } = await context.admin
    .from("employee_current_job")
    .select("empno, jobcode, jobdesc, deptcode, deptname, salary, effdate");

  const jobByEmp = new Map((jh ?? []).map((j: { empno: string; jobcode: string; jobdesc: string; deptcode: string | null; deptname: string | null; salary: number | null; effdate: string }) => [j.empno, j]));

  const canViewSalary = context.access.rights.has("view_job_history" as BusinessRight);

  let employees = (data ?? []).filter((row) => {
    if (!includeDeleted && row.is_deleted) return false;
    if (!query) return true;
    return [row.empno, row.lastname, row.firstname].some((v) => v?.toLowerCase().includes(query));
  });

  if (gender) employees = employees.filter((e) => e.gender === gender);

  const result = employees.map((e) => {
    const job = jobByEmp.get(e.empno);
    return {
      ...e,
      currentJob: job ? {
        jobcode: job.jobcode,
        jobdesc: job.jobdesc,
        deptcode: job.deptcode,
        deptname: job.deptname,
        salary: canViewSalary ? job.salary : null,
        effdate: job.effdate,
      } : null,
    };
  });

  if (dept) {
    // filter by current department
    const filtered = result.filter((e) => e.currentJob?.deptcode === dept);
    return NextResponse.json(
      { employees: filtered, permissions: perms(context) },
      { headers: noStore },
    );
  }

  return NextResponse.json(
    { employees: result, permissions: perms(context) },
    { headers: noStore },
  );
}

function perms(context: { access: { rights: ReadonlySet<BusinessRight> } }) {
  return {
    add: context.access.rights.has("add_employee" as BusinessRight),
    edit: context.access.rights.has("edit_employee" as BusinessRight),
    delete: context.access.rights.has("delete_employee" as BusinessRight),
    canViewDeleted: context.access.rights.has("delete_employee" as BusinessRight),
    canRestore: context.access.rights.has("delete_employee" as BusinessRight),
    canViewSalary: context.access.rights.has("view_job_history" as BusinessRight),
    canManageJobHistory: context.access.rights.has("add_job_history" as BusinessRight),
  };
}

export async function POST(request: Request) {
  let payload: unknown;
  try { payload = await request.json(); } catch { return fail("Request body must be valid JSON.", 400); }

  const context = await getSprint2ApiContext();
  if (!context.ok) return fail(context.error, context.status);
  if (!context.access.rights.has("add_employee" as BusinessRight)) return fail("You cannot add employees.", 403);

  const body = payload as Record<string, unknown>;
  const empno = typeof body.empno === "string" ? body.empno.trim().toUpperCase() : "";
  const lastname = typeof body.lastname === "string" ? body.lastname.trim() : "";
  const firstname = typeof body.firstname === "string" ? body.firstname.trim() : "";
  const gender = typeof body.gender === "string" ? body.gender.trim().toUpperCase() : "";
  const birthdate = typeof body.birthdate === "string" ? body.birthdate.trim() : null;
  const hiredate = typeof body.hiredate === "string" ? body.hiredate.trim() : null;

  if (!empno || empno.length > 5) return fail("Employee number must be 1-5 characters.", 400);
  if (!lastname || lastname.length > 15) return fail("Last name must be 1-15 characters.", 400);
  if (!firstname || firstname.length > 15) return fail("First name must be 1-15 characters.", 400);
  if (!["M", "F"].includes(gender)) return fail("Gender must be M or F.", 400);

  const { data, error } = await context.session
    .from("employee")
    .insert({ empno, lastname, firstname, gender, birthdate, hiredate })
    .select("empno, lastname, firstname, gender, birthdate, hiredate, sepdate, is_deleted, stamp")
    .single();

  if (error) { const m = mapBusinessDatabaseError(error, "employee creation"); return fail(m.error, m.status); }
  return NextResponse.json({ employee: data }, { status: 201, headers: noStore });
}
