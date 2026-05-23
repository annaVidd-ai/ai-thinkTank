import neo4j, { Driver } from 'neo4j-driver';

let _driver: Driver | null = null;

export function getDriver(): Driver {
  if (_driver) return _driver;

  const uri = process.env.NEO4J_URI;
  const username = process.env.NEO4J_USERNAME;
  const password = process.env.NEO4J_PASSWORD;

  if (!uri || !username || !password) {
    throw new Error(
      'Missing required env vars: NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD'
    );
  }

  _driver = neo4j.driver(uri, neo4j.auth.basic(username, password));
  return _driver;
}

export async function closeDriver(): Promise<void> {
  if (_driver) {
    await _driver.close();
    _driver = null;
  }
}
