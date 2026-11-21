/**
 * Server-only helper for building links that leave the app. APP_ORIGIN must be
 * a bare origin so it cannot be used to redirect to an arbitrary path.
 */
export function getAppOrigin(): string {
  const value = process.env.APP_ORIGIN;
  if (!value) {
    throw new Error("APP_ORIGIN is not configured.");
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch (cause) {
    throw new Error("APP_ORIGIN must be a valid URL.", { cause });
  }

  if (
    parsed.pathname !== "/" ||
    parsed.search ||
    parsed.hash ||
    (parsed.protocol !== "https:" &&
      parsed.hostname !== "localhost" &&
      parsed.hostname !== "127.0.0.1")
  ) {
    throw new Error(
      "APP_ORIGIN must be an HTTPS origin (HTTP is allowed only for localhost).",
    );
  }

  return parsed.origin;
}
