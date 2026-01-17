import type { Config } from "drizzle-kit";

export default {
  // Schema files location
  schema: "./schema/entities/*.ts",

  // Output directory for migrations
  out: "./database/drizzle",

  // Database driver
  dialect: "sqlite",

  // Database file location
  dbCredentials: {
    url: "./database/ideas.db",
  },

  // Verbose logging
  verbose: true,

  // Strict mode for migrations
  strict: true,
} satisfies Config;
