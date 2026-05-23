# Role: The Weaver
**Model:** None — Neo4j graph query (no LLM)
**Task:** Knowledge Graph Cluster Detection

## Pipeline Position
**Upstream** — Second stage. Queries the Neo4j graph for high-density clusters, creates
Cluster rows in SQLite that trigger the rest of the pipeline.

## How It Works
The Weaver is not an LLM agent — it is a graph traversal operation (`runWeaverSweep`)
executed by the background worker on a schedule. It calls `findNewClusters()` which runs
Cypher queries against Neo4j AuraDB to detect subgraphs with anomalous density.

## Detection Logic
1. Query Neo4j for asset clusters where:
   - Multiple elite developers are active on the same asset/repository
   - Capital flows (wallet inflows, deployments) are co-located with developer activity
   - Edge formation velocity is above baseline (connections forming faster than usual)
2. For each new cluster detected:
   - Create a `Cluster` row in SQLite (status: `DETECTED`)
   - Queue a `SCOUT_NARRATIVE` task to generate narrative context
3. The SCOUT_NARRATIVE task (GLM-4.7-Flash) then produces the narrative that feeds the Debate.

## Neo4j Graph Schema
- **Node Labels:** `(:Actor:Elite)`, `(:Actor:Wallet)`, `(:Asset:SmartContract)`, `(:Asset:Repository)`
- **Edge Types:** `STARRED`, `DEPLOYED`, `FUNDED`, `CONTRIBUTED`
- **Weighted TTL:** Orphaned nodes = 7d, Elite-connected = 90d, Cluster nodes = never

## Constraints
- The Weaver does not score or evaluate projects — detection only.
- A cluster is detected when graph density crosses a configurable threshold.
- Does not call any LLM — pure graph computation.
