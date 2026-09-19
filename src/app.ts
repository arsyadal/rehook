import express, { type Request, type Response } from "express";
import crypto from "node:crypto";
import dns from "node:dns/promises";
import net from "node:net";
import path from "node:path";
import type { WebhookDb } from "./db.js";

function privateIp(address: string) {
  if (net.isIP(address) === 6) return address === "::1" || address.toLowerCase().startsWith("fc") || address.toLowerCase().startsWith("fd") || address.toLowerCase().startsWith("fe80:");
  const p = address.split(".").map(Number);
  return p.length === 4 && (p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168) || p[0] === 0);
}
export async function validateTarget(raw: string, allowPrivate = false) {
  let url: URL;
  try { url = new URL(raw); } catch { throw new Error("target must be a valid URL"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("target must use http or https");
  if (!allowPrivate && (url.hostname === "localhost" || privateIp(url.hostname))) throw new Error("private targets are not allowed");
  if (!allowPrivate) {
    const addresses = await dns.lookup(url.hostname, { all: true });
    if (addresses.some((a) => privateIp(a.address))) throw new Error("private targets are not allowed");
  }
  return url;
}

export function createApp(db: WebhookDb, options: { maxBodyBytes?: number; replayTimeoutMs?: number; allowPrivateReplay?: boolean } = {}) {
  const app = express();
  const max = options.maxBodyBytes ?? 1024 * 1024;
  app.use(express.static(path.join(process.cwd(), "public")));

  app.use("/webhooks", express.raw({ type: "*/*", limit: max }), (req: Request, res: Response) => {
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.from("");
    const contentType = String(req.headers["content-type"] ?? "");
    const bodyEncoding = body.length && !/^text\/|json|xml|form-urlencoded|javascript/.test(contentType) ? "base64" : "utf8";
    db.insert({
      id: crypto.randomUUID(), method: req.method, path: req.path,
      headers: req.headers as Record<string, string | string[]>,
      query: req.query as Record<string, string | string[]>,
      body: bodyEncoding === "base64" ? body.toString("base64") : body.toString("utf8"),
      bodyEncoding, timestamp: new Date().toISOString()
    });
    res.status(202).json({ received: true });
  });

  app.use(express.json());
  app.get("/api/webhooks", (req, res) => res.json(db.list(Number(req.query.limit) || 100)));
  app.get("/api/webhooks/:id", (req, res) => {
    const item = db.get(req.params.id);
    return item ? res.json(item) : res.status(404).json({ error: "webhook not found" });
  });
  app.post("/api/webhooks/:id/replay", async (req, res) => {
    const item = db.get(req.params.id);
    if (!item) return res.status(404).json({ error: "webhook not found" });
    const target = req.body?.target;
    if (typeof target !== "string") return res.status(400).json({ error: "target URL is required" });
    try {
      const url = await validateTarget(target, options.allowPrivateReplay ?? false);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), options.replayTimeoutMs ?? 10000);
      const headers: Record<string, string> = {};
      for (const [key, value] of Object.entries(item.headers)) headers[key] = Array.isArray(value) ? value.join(", ") : value;
      delete headers.host; delete headers["content-length"];
      const response = await fetch(url, { method: item.method, headers, body: item.bodyEncoding === "base64" ? Buffer.from(item.body, "base64") : item.body || undefined, signal: controller.signal });
      clearTimeout(timer);
      res.json({ status: response.status, statusText: response.statusText });
    } catch (error) {
      res.status(502).json({ error: error instanceof Error ? error.message : "replay failed" });
    }
  });
  app.get("/health", (_req, res) => res.json({ ok: true }));
  return app;
}
