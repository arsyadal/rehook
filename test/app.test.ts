import { describe, it, afterEach } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createDatabase } from "../src/db.js";
import { createApp, validateTarget } from "../src/app.js";

const dbs: ReturnType<typeof createDatabase>[] = [];
function app() { const db = createDatabase(":memory:"); dbs.push(db); return createApp(db, { allowPrivateReplay: true }); }
afterEach(() => dbs.splice(0).forEach((db) => db.close()));

describe("capture and inspection", () => {
  it("captures request data and returns it via API", async () => {
    const a = app();
    const capture = await request(a).post("/webhooks/orders?source=test").set("x-token", "abc").send('{"ok":true}');
    assert.equal(capture.status, 202);
    const list = await request(a).get("/api/webhooks");
    assert.equal(list.body.length, 1);
    assert.deepEqual({ method: list.body[0].method, path: list.body[0].path, body: list.body[0].body }, { method: "POST", path: "/orders", body: '{"ok":true}' });
    assert.deepEqual(list.body[0].query, { source: "test" });
  });
  it("rejects missing capture and invalid replay targets", async () => {
    const a = app();
    assert.equal((await request(a).get("/api/webhooks/nope")).status, 404);
    assert.equal((await request(a).post("/api/webhooks/nope/replay").send({ target: "file:///etc/passwd" })).status, 404);
  });
  it("blocks private replay targets by default", async () => {
    await assert.rejects(() => validateTarget("http://127.0.0.1:8080/hook"), /private targets/);
    await assert.rejects(() => validateTarget("ftp://example.com"), /http or https/);
  });
});
