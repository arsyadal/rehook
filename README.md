# ReHook

ReHook is a small, self-hostable webhook inspector and replay tool. It captures incoming HTTP requests in SQLite, provides a browser UI/API for inspection, and can forward a captured request to a target URL.

## Run locally

Requires Node.js 22+ (uses the built-in `node:sqlite` module).

```sh
npm install
npm test
npm run dev
```

Open <http://localhost:3000>. Send a webhook to `POST http://localhost:3000/webhooks/anything` (any HTTP method/path under `/webhooks` is accepted). Captures are stored in `./data/rehook.db`.

Configuration is available in `.env` (copy `.env.example`): `PORT`, `DATABASE_PATH`, `MAX_BODY_BYTES`, `REPLAY_TIMEOUT_MS`, and `ALLOW_PRIVATE_REPLAY`. Replay blocks localhost/private IPs by default to reduce SSRF risk; set the last option to `true` only in a trusted local environment.

## API

- `GET /api/webhooks` — list captures (`?limit=100`)
- `GET /api/webhooks/:id` — inspect one capture
- `POST /api/webhooks/:id/replay` with `{"target":"https://example.com/hook"}` — forward it
- `GET /health` — health check

## Docker

```sh
docker build -t rehook .
docker run --rm -p 3000:3000 -v "$PWD/data:/app/data" rehook
```

This is an MVP: authenticate it and put it behind a reverse proxy before exposing it publicly.
