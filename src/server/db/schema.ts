import { sql } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  serial,
  timestamp,
  varchar,
  text,
  boolean,
} from "drizzle-orm/pg-core";

export const createTable = pgTableCreator((name) => `copyman_${name}`);

export const posts = createTable(
  "post",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }),
    createdAt: timestamp("created_at")
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updatedAt"),
  },
  (example) => ({
    nameIndex: index("name_idx").on(example.name),
  }),
);

export const tasks = createTable("task", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }),
  content: text("content"),
  completed: boolean("completed").default(false),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt"),
  sessionId: serial("session_id").references(() => sessions.id),
});

export const contents = createTable("content", {
  id: serial("id").primaryKey(),
  contentURL: varchar("content_url", { length: 256 }).notNull(),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  pathname: varchar("pathname", { length: 256 }),
  sessionId: serial("session_id").references(() => sessions.id),
});

export const sessions = createTable("session", {
  id: serial("id").primaryKey(),
  token: varchar("token", { length: 256 }).notNull().unique(),
  createdAt: timestamp("created_at")
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  updatedAt: timestamp("updatedAt"),
});

export type sessionType = typeof sessions.$inferSelect;
export type tasksType = typeof tasks.$inferSelect;
export type contentType = typeof contents.$inferSelect;
