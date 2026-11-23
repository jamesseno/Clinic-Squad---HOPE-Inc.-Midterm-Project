export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; fieldErrors: Record<string, string> };

export interface CustomerInput {
  custno: string;
  custname: string;
  address: string;
  payterm: "COD" | "30D" | "45D";
}

export interface CustomerEditInput {
  custname: string;
  address: string;
  payterm: CustomerInput["payterm"];
}

export interface ProductInput {
  prodcode: string;
  description: string;
  unit: "pc" | "ea" | "mtr" | "pkg" | "ltr";
}

export interface ProductEditInput {
  description: string;
  unit: ProductInput["unit"];
}

export interface PriceInput {
  effdate: string;
  unitprice: number;
}

function getRecord(payload: unknown): Record<string, unknown> | null {
  return typeof payload === "object" && payload !== null && !Array.isArray(payload)
    ? (payload as Record<string, unknown>)
    : null;
}

function hasOnlyKeys(record: Record<string, unknown>, allowedKeys: readonly string[]) {
  return Object.keys(record).every((key) => allowedKeys.includes(key));
}

function readText(
  record: Record<string, unknown>,
  key: string,
  maxLength: number,
  fieldErrors: Record<string, string>,
): string {
  const value = typeof record[key] === "string" ? record[key].trim() : "";
  if (!value) fieldErrors[key] = "This field is required.";
  else if (value.length > maxLength) fieldErrors[key] = `Must be ${maxLength} characters or fewer.`;
  return value;
}

function failure<T>(fieldErrors: Record<string, string>): ValidationResult<T> {
  return { ok: false, error: "Please correct the highlighted fields.", fieldErrors };
}

export function validateCustomerInput(payload: unknown): ValidationResult<CustomerInput> {
  const record = getRecord(payload);
  if (!record || !hasOnlyKeys(record, ["custno", "custname", "address", "payterm"])) {
    return failure({ form: "Invalid customer data." });
  }

  const fieldErrors: Record<string, string> = {};
  const custno = readText(record, "custno", 5, fieldErrors);
  const custname = readText(record, "custname", 20, fieldErrors);
  const address = readText(record, "address", 50, fieldErrors);
  const payterm = record.payterm;

  if (custno && !/^[A-Za-z0-9_-]{1,5}$/.test(custno)) {
    fieldErrors.custno = "Use up to 5 letters, numbers, hyphens, or underscores.";
  }
  if (!["COD", "30D", "45D"].includes(String(payterm))) {
    fieldErrors.payterm = "Choose COD, 30D, or 45D.";
  }
  if (Object.keys(fieldErrors).length > 0) return failure(fieldErrors);

  return {
    ok: true,
    value: { custno, custname, address, payterm: payterm as CustomerInput["payterm"] },
  };
}

export function validateCustomerEditInput(payload: unknown): ValidationResult<CustomerEditInput> {
  const record = getRecord(payload);
  if (!record || !hasOnlyKeys(record, ["custname", "address", "payterm"])) {
    return failure({ form: "Invalid customer data." });
  }

  const fieldErrors: Record<string, string> = {};
  const custname = readText(record, "custname", 20, fieldErrors);
  const address = readText(record, "address", 50, fieldErrors);
  const payterm = record.payterm;
  if (!["COD", "30D", "45D"].includes(String(payterm))) {
    fieldErrors.payterm = "Choose COD, 30D, or 45D.";
  }
  if (Object.keys(fieldErrors).length > 0) return failure(fieldErrors);

  return {
    ok: true,
    value: { custname, address, payterm: payterm as CustomerInput["payterm"] },
  };
}

export function validateProductInput(payload: unknown): ValidationResult<ProductInput> {
  const record = getRecord(payload);
  if (!record || !hasOnlyKeys(record, ["prodcode", "description", "unit"])) {
    return failure({ form: "Invalid product data." });
  }

  const fieldErrors: Record<string, string> = {};
  const prodcode = readText(record, "prodcode", 6, fieldErrors);
  const description = readText(record, "description", 30, fieldErrors);
  const unit = record.unit;

  if (prodcode && !/^[A-Za-z0-9_-]{1,6}$/.test(prodcode)) {
    fieldErrors.prodcode = "Use up to 6 letters, numbers, hyphens, or underscores.";
  }
  if (!["pc", "ea", "mtr", "pkg", "ltr"].includes(String(unit))) {
    fieldErrors.unit = "Choose a supported product unit.";
  }
  if (Object.keys(fieldErrors).length > 0) return failure(fieldErrors);

  return {
    ok: true,
    value: { prodcode, description, unit: unit as ProductInput["unit"] },
  };
}

export function validateProductEditInput(payload: unknown): ValidationResult<ProductEditInput> {
  const record = getRecord(payload);
  if (!record || !hasOnlyKeys(record, ["description", "unit"])) {
    return failure({ form: "Invalid product data." });
  }

  const fieldErrors: Record<string, string> = {};
  const description = readText(record, "description", 30, fieldErrors);
  const unit = record.unit;
  if (!["pc", "ea", "mtr", "pkg", "ltr"].includes(String(unit))) {
    fieldErrors.unit = "Choose a supported product unit.";
  }
  if (Object.keys(fieldErrors).length > 0) return failure(fieldErrors);

  return {
    ok: true,
    value: { description, unit: unit as ProductInput["unit"] },
  };
}

export function validatePriceInput(payload: unknown): ValidationResult<PriceInput> {
  const record = getRecord(payload);
  if (!record || !hasOnlyKeys(record, ["effdate", "unitprice"])) {
    return failure({ form: "Invalid price data." });
  }

  const fieldErrors: Record<string, string> = {};
  const effdate = typeof record.effdate === "string" ? record.effdate : "";
  const unitprice = record.unitprice;
  const dateParts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(effdate);
  if (!dateParts) {
    fieldErrors.effdate = "Enter a valid effective date.";
  } else {
    const [, year, month, day] = dateParts;
    const parsedDate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    if (
      parsedDate.getUTCFullYear() !== Number(year)
      || parsedDate.getUTCMonth() !== Number(month) - 1
      || parsedDate.getUTCDate() !== Number(day)
    ) {
      fieldErrors.effdate = "Enter a valid effective date.";
    }
  }
  if (typeof unitprice !== "number" || !Number.isFinite(unitprice) || unitprice <= 0 || unitprice > 99999999.99) {
    fieldErrors.unitprice = "Enter a price greater than 0 and no greater than 99,999,999.99.";
  } else {
    // Compare in cents with a tolerance: 19.99 * 100 is 1998.9999999999998 in
    // binary floating point, so a strict equality check rejects valid prices.
    const cents = Math.round(unitprice * 100);
    if (Math.abs(unitprice * 100 - cents) > 1e-6) {
      fieldErrors.unitprice = "Price can have no more than 2 decimal places.";
    }
  }
  if (Object.keys(fieldErrors).length > 0) return failure(fieldErrors);

  return { ok: true, value: { effdate, unitprice: unitprice as number } };
}
