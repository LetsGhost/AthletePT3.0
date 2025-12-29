# AthletePT-TS

Minimal TypeScript/Express API with MongoDB, JWT auth, Swagger docs, and Typegoose.

## Requirements
- Node.js 18+
- MongoDB running locally (or a connection string)

## Setup
1. Install dependencies:
   ```sh
   npm install
   ```
2. Configure environment:
   - Copy `.env` (already present) and update values if needed.
   - Defaults: local MongoDB, dev mode, and auth bypass enabled.

3. Run in development:
   ```sh
   npm run dev
   ```

4. API Docs:
   - Swagger UI: http://localhost:3000/api-docs
   - JSON: http://localhost:3000/api-docs.json

## Build & Run
```sh
npm run build
npm start
```

## Scripts
- dev: start with ts-node-dev
- build: compile TypeScript to `dist/`
- start: run compiled server

## Notes
- Auth bypass (BYPASS_AUTH=true) allows testing protected routes without JWT in development.
- Logs are written to `logs/` and console.