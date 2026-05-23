# Task: Database & Worker Setup

**Role:** Developer Agent
**Context:** You are building the core execution loop for an AI agent system based on the Architect's design.
**Working Directory:** `/Users/stathis/Documents/thinkTank-ai/think-tank-ai/`

## Architectural Constraints & Requirements
1. **Database:** SQLite via Prisma ORM v7+.
2. **Prisma v7 Strictness:** Because we are on Prisma v7, the schema cannot contain the `url`. You MUST configure `prisma.config.ts` and use the `@prisma/adapter-better-sqlite3` adapter in the Prisma Client initialization.
3. **Execution Model:** A standalone Node.js background worker (`worker/index.ts`) that polls the SQLite database for tasks every 5 seconds.
4. **Task Schema:** 
   - `id` (String, UUID)
   - `type` (String: "SCOUT", "ORCHESTRATE", "ANALYZE")
   - `status` (String: "PENDING", "PROCESSING", "COMPLETED", "FAILED")
   - `payload` (String, JSON)
   - `result` (String, JSON, nullable)
   - `createdAt` (DateTime)
   - `updatedAt` (DateTime)

## Deliverables Required from Developer Agent
1. Install necessary dependencies (`@prisma/client`, `better-sqlite3`, `@prisma/adapter-better-sqlite3`, `tsx`).
2. Fix/Create `prisma/schema.prisma` and `prisma.config.ts`.
3. Create `worker/index.ts` with the polling logic:
   - Find oldest `PENDING` task.
   - Mark as `PROCESSING`.
   - Execute a `switch` statement for task types (simulate AI calls with console logs and mock JSON results).
   - Mark as `COMPLETED` (or `FAILED` on catch).
4. Create `test.ts` in the project root to inject a mock "SCOUT" task into SQLite.
5. Provide the human user with the exact, step-by-step terminal commands (with explicit paths) to run the migrations, start the worker, and run the test.