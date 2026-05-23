// schema.prisma

datasource db {
  provider = "sqlite"
  url      = "file:./dev.db"
}

generator client {
  provider = "prisma-client-js"
}

// Event-Driven Task Queue
model AgentTask {
  id          String   @id @default(uuid())
  type        String   // e.g., "GITHUB_INGEST", "ANALYZE_CLUSTER", "MAP_TICKER"
  status      String   // PENDING, PROCESSING, COMPLETED, FAILED
  payload     String   // JSON string (The data to be processed)
  result      String?  // JSON string (The output from the agent)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

// Final output for the UI Dashboard
model AlphaAlert {
  id              String   @id @default(uuid())
  ticker          String?  // e.g., "LRT" or Contract Address
  domain          String   // e.g., "DeFi", "Liquid Restaking"
  confidenceScore Int      // 0 - 100
  thesis          String   // DeepSeek's laconic reasoning
  evidence        String   // JSON array of graph nodes (Devs/Wallets involved)
  createdAt       DateTime @default(now())
}