import neo4j from 'neo4j-driver';
import { getDriver } from './neo4j';

export interface DeveloperNode {
  id: string;       // github_login — MERGE key
  name: string;
  isElite?: boolean;
}

export interface WalletNode {
  id: string;       // blockchain_address — MERGE key
  isElite?: boolean;
}

export interface RepositoryNode {
  id: string;       // "owner/repo_name" — MERGE key
  url: string;
}

export interface ContractNode {
  id: string;       // contract_address — MERGE key
}

interface StarredEvent {
  type: 'STARRED';
  actorId: string;
  assetId: string;
  createdAt: string;
}

interface DeployedEvent {
  type: 'DEPLOYED';
  actorId: string;
  assetId: string;
  createdAt: string;
}

interface FundedEvent {
  type: 'FUNDED';
  actorId: string;
  assetId: string;
  amount: number;
  createdAt: string;
}

export type GraphEvent = StarredEvent | DeployedEvent | FundedEvent;

export interface GraphPayload {
  developer?: DeveloperNode;
  wallet?: WalletNode;
  repository?: RepositoryNode;
  contract?: ContractNode;
  events: GraphEvent[];
}

export interface ClusterCandidate {
  assetId: string;
  assetLabels: string[];
  eliteCount: number;
  crossAssets: number;
}

/**
 * Finds dense cross-asset clusters in Neo4j.
 *
 * A cluster is an Asset with ≥2 inbound connections from Elite actors,
 * where at least one of those actors also reaches a second Asset
 * (confirming cross-asset density, not just star count).
 */
export async function findNewClusters(): Promise<ClusterCandidate[]> {
  const driver = getDriver();
  const session = driver.session();

  try {
    const result = await session.executeRead((tx) =>
      tx.run(`
        MATCH (a:Actor:Elite)-[r]->(t:Asset)
        WITH t, collect(DISTINCT a) AS elites, count(DISTINCT a) AS eliteCount
        WHERE eliteCount >= 2
        WITH t, elites
        UNWIND elites AS e
        MATCH (e)-[r2]->(t2:Asset) WHERE t2 <> t
        WITH t, elites, count(DISTINCT t2) AS crossAssets
        WHERE crossAssets >= 1
        RETURN t.id AS assetId, labels(t) AS assetLabels,
               size(elites) AS eliteCount, crossAssets
      `)
    );

    return result.records.map((rec) => ({
      assetId: rec.get('assetId') as string,
      assetLabels: rec.get('assetLabels') as string[],
      eliteCount: neo4j.integer.toNumber(rec.get('eliteCount')),
      crossAssets: neo4j.integer.toNumber(rec.get('crossAssets')),
    }));
  } finally {
    await session.close();
  }
}

/**
 * Idempotently upserts all nodes and edges described by payload into Neo4j.
 *
 * MERGE key is always `id` on the base label (Actor / Asset). Additional
 * domain labels (Developer, Wallet, Repository, SmartContract, Elite) are
 * SET after the MERGE so they accumulate correctly on repeated runs without
 * creating duplicate nodes.
 */
export async function upsertEntities(payload: GraphPayload): Promise<void> {
  const driver = getDriver();
  const session = driver.session();

  try {
    await session.executeWrite(async (tx) => {
      // --- Nodes first, then edges ---

      if (payload.developer) {
        const { id, name, isElite } = payload.developer;
        const extraLabels = isElite ? 'SET a:Developer:Elite' : 'SET a:Developer';
        await tx.run(
          `MERGE (a:Actor {id: $id})
           SET a.name = $name
           ${extraLabels}`,
          { id, name }
        );
      }

      if (payload.wallet) {
        const { id, isElite } = payload.wallet;
        const extraLabels = isElite ? 'SET a:Wallet:Elite' : 'SET a:Wallet';
        await tx.run(
          `MERGE (a:Actor {id: $id})
           ${extraLabels}`,
          { id }
        );
      }

      if (payload.repository) {
        const { id, url } = payload.repository;
        await tx.run(
          `MERGE (a:Asset {id: $id})
           SET a:Repository
           SET a.url = $url`,
          { id, url }
        );
      }

      if (payload.contract) {
        const { id } = payload.contract;
        await tx.run(
          `MERGE (a:Asset {id: $id})
           SET a:SmartContract`,
          { id }
        );
      }

      // --- Edges ---
      // Nodes created above are visible within the same transaction.

      for (const event of payload.events) {
        if (event.type === 'STARRED') {
          await tx.run(
            `MATCH (actor:Actor {id: $actorId})
             MATCH (asset:Asset {id: $assetId})
             MERGE (actor)-[r:STARRED]->(asset)
             ON CREATE SET r.createdAt = $createdAt`,
            { actorId: event.actorId, assetId: event.assetId, createdAt: event.createdAt }
          );
        } else if (event.type === 'DEPLOYED') {
          await tx.run(
            `MATCH (actor:Actor {id: $actorId})
             MATCH (asset:Asset {id: $assetId})
             MERGE (actor)-[r:DEPLOYED]->(asset)
             ON CREATE SET r.createdAt = $createdAt`,
            { actorId: event.actorId, assetId: event.assetId, createdAt: event.createdAt }
          );
        } else if (event.type === 'FUNDED') {
          await tx.run(
            `MATCH (actor:Actor {id: $actorId})
             MATCH (asset:Asset {id: $assetId})
             MERGE (actor)-[r:FUNDED]->(asset)
             ON CREATE SET r.createdAt = $createdAt, r.amount = $amount`,
            {
              actorId: event.actorId,
              assetId: event.assetId,
              createdAt: event.createdAt,
              amount: event.amount,
            }
          );
        }
      }
    });
  } finally {
    await session.close();
  }
}
