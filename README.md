# ePawati Next App

This is the standalone Next.js version of Samavet ePawati.

The UI is copied from `/Users/shashikant/Desktop/VarganiFrontend`, and the backend API logic is copied into this project under `server/api/src`. Browser API calls go to same-origin `/api/v1`, handled by `pages/api/v1/[...path].ts`.

No original database schema, migration, or seed files were changed or deleted. The copied `prisma/schema.prisma` is used only so this project can generate Prisma Client against the same existing database.

## Local Setup

```bash
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000`.

## Deploy

Set the Vercel project root to this folder:

```txt
/Users/shashikant/Desktop/epawati
```

Use the values from `.env.example`, with real secrets in Vercel environment variables.
