import {
  check,
  foreignKey,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const messageRole = pgEnum("message_role", ["user", "assistant"]);
export const messageStatus = pgEnum("message_status", ["complete", "streaming", "interrupted", "error"]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const conversations = pgTable(
  "conversations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull().default("New chat"),
    selectedModel: text("selected_model").notNull().default("default"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    index("conversations_user_updated_idx").on(table.userId, table.updatedAt),
    unique("conversations_id_user_id_key").on(table.id, table.userId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: uuid("conversation_id").notNull(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    role: messageRole("role").notNull(),
    content: text("content").notNull(),
    status: messageStatus("status").notNull().default("complete"),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      name: "messages_conversation_owner_fk",
      columns: [table.conversationId, table.userId],
      foreignColumns: [conversations.id, conversations.userId],
    }).onDelete("cascade"),
    unique("messages_conversation_position_key").on(table.conversationId, table.position),
    index("messages_user_conversation_idx").on(table.userId, table.conversationId),
    check("messages_content_not_blank", sql`${table.content} <> ''`),
  ],
);
