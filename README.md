# API-Rest-Bun

A barebones, high-performance REST API boilerplate built entirely on native Bun APIs. 

Designed for local-first execution, offline-capable setups, and strict zero-trust architectures. No middleware chains, no external database requirements out-of-the-box, no telemetry.

## Philosophy

- **Local-first:** Data stays on the host. Uses `bun:sqlite` with WAL mode enabled for persistent local storage.
- **Privacy-by-design:** Zero logging of PII. Stateless authentication primitives ready for E2EE integration.
- **Minimal Attack Surface:** Relies on `URLPattern` for routing and native `Request`/`Response` objects. No Express, Fastify, or Hono bloat.
- **Zero Telemetry:** Nothing phones home. No analytics, no error-tracking SDKs.

## Stack

- **Runtime:** Bun
- **Routing:** Native `URLPattern` API
- **Database:** `bun:sqlite`
- **Validation:** Standard schema validation (Zod/Valibot optional, native `try/catch` preferred for zero-dep setups)

## Prerequisites

- [Bun](https://bun.sh) v1.1+

## Setup

```bash
git clone https://github.com/frank-graves/API-Rest-Bun.git
cd API-Rest-Bun
bun install
```

## Usage

Start the development server with hot reloading:

```bash
bun run dev
```

The API defaults to `http://localhost:3000`.

## Project Structure

```text
src/
├── index.ts       # Entry point, Bun.serve() initialization
├── routes/        # URLPattern route definitions
├── db/            # SQLite schema and migrations
└── utils/         # Cryptographic primitives and helpers
```

## Security & Privacy

- **CORS:** Strictly configured. Fails closed.
- **Rate Limiting:** In-memory sliding window via native `Map` (or SQLite-backed for multi-instance setups).
- **Data Minimization:** Endpoints return only explicitly requested fields.
- **Headers:** Strips server signatures (`X-Powered-By`, `Server`, etc.).

## Build / Deployment

Compile to a single standalone executable or optimized JS bundle:

```bash
# Standalone executable (Linux/macOS)
bun build ./src/index.ts --compile --outfile api-rest-bun

# Optimized bundle
bun build ./src/index.ts --target=bun --outdir=./dist --minify
```

## License

Unlicense / MIT. Do whatever you want with it. No warranties.
