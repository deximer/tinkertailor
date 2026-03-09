import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import fs from "fs";
import path from "path";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL environment variable is required");
}

const client = postgres(connectionString, { max: 1 });
const db = drizzle(client);

function checkJournalSync(migrationsFolder: string) {
  const journalPath = path.join(migrationsFolder, "meta/_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8"));
  const registeredTags = new Set<string>(
    journal.entries.map((e: { tag: string }) => e.tag),
  );

  const sqlFiles = fs
    .readdirSync(migrationsFolder)
    .filter((f) => f.endsWith(".sql"))
    .map((f) => f.replace(/\.sql$/, ""));

  const unregistered = sqlFiles.filter((tag) => !registeredTags.has(tag));

  if (unregistered.length > 0) {
    throw new Error(
      `Migration files not registered in _journal.json:\n${unregistered.map((t) => `  - ${t}.sql`).join("\n")}\n\nAdd them to lib/db/migrations/meta/_journal.json before running migrations.`,
    );
  }
}

async function main() {
  const migrationsFolder = "./lib/db/migrations";
  checkJournalSync(migrationsFolder);
  console.log("Running migrations...");
  await migrate(db, { migrationsFolder });
  console.log("Migrations complete.");
  await client.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
