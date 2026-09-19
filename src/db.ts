import { DatabaseSync } from "node:sqlite";
import fs from "node:fs";
import path from "node:path";

export type Webhook = {
  id: string; method: string; path: string; headers: Record<string, string | string[]>;
  query: Record<string, string | string[]>; body: string; bodyEncoding: string; timestamp: string;
};

export function createDatabase(filename: string) {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(path.resolve(filename)), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(`CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY, method TEXT NOT NULL, path TEXT NOT NULL, headers TEXT NOT NULL,
    query TEXT NOT NULL, body TEXT NOT NULL, body_encoding TEXT NOT NULL DEFAULT 'utf8',
    timestamp TEXT NOT NULL
  )`);
  const insert = db.prepare(`INSERT INTO webhooks
    (id, method, path, headers, query, body, body_encoding, timestamp)
    VALUES (?,?,?,?,?,?,?,?)`);
  const row = db.prepare("SELECT * FROM webhooks WHERE id = ?");
  const list = db.prepare("SELECT * FROM webhooks ORDER BY timestamp DESC LIMIT ?");
  const map = (r: any): Webhook => ({
    id: r.id, method: r.method, path: r.path, headers: JSON.parse(r.headers),
    query: JSON.parse(r.query), body: r.body, bodyEncoding: r.body_encoding, timestamp: r.timestamp
  });
  return {
    insert(webhook: Webhook) { insert.run(webhook.id, webhook.method, webhook.path, JSON.stringify(webhook.headers), JSON.stringify(webhook.query), webhook.body, webhook.bodyEncoding, webhook.timestamp); },
    get(id: string) { const value = row.get(id); return value ? map(value) : undefined; },
    list(limit = 100) { return (list.all(Math.min(Math.max(limit, 1), 500)) as any[]).map(map); },
    close() { db.close(); }
  };
}
export type WebhookDb = ReturnType<typeof createDatabase>;
