import { drizzle } from "drizzle-orm/mysql2";
import { env } from "../lib/env";
import * as schema from "@db/schema";
import * as relations from "@db/relations";

const fullSchema = { ...schema, ...relations };

function buildDb() {
  return drizzle(env.databaseUrl, {
    mode: "planetscale",
    schema: fullSchema,
  });
}

let instance: ReturnType<typeof buildDb>;

export function getDb() {
  if (!instance) {
    instance = buildDb();
  }
  return instance;
}
