/**
 * Database initialization script.
 * Run with: pnpm db:init
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const schemaPath = path.join(__dirname, "..", "schema.sql");

async function main() {
  const schema = fs.readFileSync(schemaPath, "utf-8");
  console.log("Schema loaded successfully.");
  console.log(schema.substring(0, 200) + "...");
}

main().catch(console.error);
