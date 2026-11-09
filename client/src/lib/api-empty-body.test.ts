import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { brandProfilesApi, setAuthToken } from "./api";

function respond(body: string, headers: Record<string, string>, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(body, { status, headers })),
  );
}

describe("request: empty successful responses", () => {
  beforeEach(() => setAuthToken("test-token"));
  afterEach(() => {
    vi.unstubAllGlobals();
    setAuthToken(null);
  });

  it("treats an empty 200 (the API's 'nothing found') as null", async () => {
    respond("", {});
    await expect(brandProfilesApi.getMine("t1", "w1")).resolves.toBeNull();
  });

  it("treats an empty body with content-length 0 as null", async () => {
    respond("", { "content-length": "0" });
    await expect(brandProfilesApi.getMine("t1")).resolves.toBeNull();
  });

  it("still parses JSON bodies", async () => {
    respond(JSON.stringify({ id: "p1", companyName: "Acme" }), { "content-type": "application/json" });
    await expect(brandProfilesApi.getMine("t1")).resolves.toMatchObject({ id: "p1", companyName: "Acme" });
  });

  it("still rejects an HTML page served in place of the API", async () => {
    respond("<!doctype html><html></html>", { "content-type": "text/html" });
    await expect(brandProfilesApi.getMine("t1")).rejects.toThrow(/non-JSON/);
  });
});
