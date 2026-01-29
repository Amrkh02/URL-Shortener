# URL Shortener (Minimal Fullstack)

A minimal URL shortener using Node + Express and SQLite, with a small static frontend.

Features
- URL shortening (POST /api/shorten) with optional custom alias (POST { url, custom })
- Redirection (GET /:shortId) with HTTP 301
- Uniqueness & persistence using SQLite (data.db)
- Returns existing short URL when the original URL was previously shortened
- Link analytics (clicks, country, device, browser, referrer) with GET /api/analytics/:id
- Resolve (inspect short without redirect) via POST /api/resolve
- Short-id generator API: GET /api/generate

Quick start
1. Install dependencies:

   npm install

2. Run in development (requires nodemon):

   npm run dev

3. Or just start:

   npm start

Open http://localhost:3000 and try it out.

Notes
- The database file `data.db` is created automatically in the project root. If you ran the previous version which enforced unique long URLs and you want custom aliases for existing URLs, remove `data.db` to recreate the DB (development only).
- Configure BASE_URL with an environment variable if you bind to a different host/port.

Security / production notes
- Add rate limiting and input sanitization in production
- Consider switching to a persistent DB for production (Postgres), and add migrations
- Add an admin interface for listing and managing URLs if needed

Admin token (analytics)
- Set an admin token with the `ADMIN_TOKEN` environment variable to protect analytics: `export ADMIN_TOKEN=yourtoken` (Linux/macOS) or PowerShell: `$env:ADMIN_TOKEN = 'yourtoken'`.
- The analytics endpoint `GET /api/analytics/:id` requires the `x-admin-token` header (or `Authorization: Bearer <token>`).

Running tests
- Tests run against an in-memory SQLite DB and expect `ADMIN_TOKEN` to be set. Run:

  npm test

This uses `cross-env` to set `SQLITE_FILE=:memory:` and `ADMIN_TOKEN=testtoken` for the test run.

License: MIT
