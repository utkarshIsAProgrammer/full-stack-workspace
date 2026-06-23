const mongoose = require("mongoose");
const { config } = require("dotenv");
const { resolve } = require("path");

const possiblePaths = [
  resolve(process.cwd(), "backend/.env"),
  resolve(process.cwd(), ".env"),
  resolve(__dirname, "../.env"),
];
for (const p of possiblePaths) {
  config({ path: p });
}

async function clearAll() {
  const MONGO_URI = process.env.MONGO_URI;
  if (!MONGO_URI) {
    console.error("MONGO_URI not set");
    process.exit(1);
  }

  await mongoose.connect(MONGO_URI);
  console.log("Connected to MongoDB!");

  const db = mongoose.connection.db;

  const collections = await db.listCollections().toArray();
  for (const coll of collections) {
    console.log(`Clearing collection: ${coll.name}`);
    await db.collection(coll.name).deleteMany({});
  }

  console.log("All data cleared!");
  await mongoose.disconnect();
}

clearAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
