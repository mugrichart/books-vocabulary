import { MongoClient, Db } from 'mongodb';

const uri = process.env.MONGO_URI || '';
if (!uri) {
  throw new Error('Please define the MONGO_URI environment variable inside .env.local');
}

// Extend global type to prevent multiple clients in dev hot-reloads
interface CustomNodeJSGlobal {
  _mongoClientPromise?: Promise<MongoClient>;
}

declare const global: CustomNodeJSGlobal;

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === 'development') {
  // In development mode, use a global variable so that the value
  // is preserved across module reloads caused by HMR (Hot Module Replacement).
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production mode, it's best to not use a global variable.
  client = new MongoClient(uri);
  clientPromise = client.connect();
}

export async function connectToDatabase(): Promise<{ client: MongoClient; db: Db }> {
  const connectedClient = await clientPromise;
  const db = connectedClient.db();
  return { client: connectedClient, db };
}
