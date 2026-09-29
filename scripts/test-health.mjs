#!/usr/bin/env node
/**
 * Provider health-check contract test (spec §18).
 * Run: npm run build && npm start && npm run test:health
 *
 * Unconfigured deployment → {configured:false, status:"not-configured"} (503)
 * Configured + valid keys → {provider:"amadeus", authenticated:true, "ready"}
 * Configured + bad keys   → {authenticated:false, status:"auth-failed"}
 * The API key/secret/token must never appear in the response.
 */

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "  PASS" : "✗ FAIL"}  ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures += 1;
};

async function main() {
  const res = await fetch(`${BASE}/api/hotels/health`);
  const body = await res.json();
  const raw = JSON.stringify(body);

  check("health endpoint responds", res.status === 200 || res.status === 503, `status ${res.status}`);
  check("reports provider id", body.provider === "amadeus");
  check("reports configured flag", typeof body.configured === "boolean");

  if (!body.configured) {
    check("unconfigured → not-configured status", body.status === "not-configured" && body.authenticated === false);
  } else if (res.status === 200) {
    check("configured + authenticated → ready", body.authenticated === true && body.status === "ready");
  } else {
    check("configured but auth failed → auth-failed", body.authenticated === false && ["auth-failed", "unreachable"].includes(body.status));
  }

  check("never leaks secrets/tokens", !/"HOTEL_API|access_token|API_SECRET/i.test(raw));

  console.log(failures === 0 ? "\nHealth contract: ALL PASS" : `\nHealth contract: ${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
