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
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const messageRole = pgEnum("message_role", ["user", "assistant"]);
export const messageStatus = pgEnum("message_status", ["complete", "streaming", "interrupted", "error"]);
export const preferredLanguage = pgEnum("preferred_language", ["auto", "en", "id"]);
export const preferenceModel = pgEnum("preference_model", ["fast", "balanced", "reasoning"]);
export const responseLength = pgEnum("response_length", ["concise", "balanced", "detailed"]);
export const responseStyle = pgEnum("response_style", ["natural", "professional", "direct"]);

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
    replyToMessageId: uuid("reply_to_message_id"),
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
    unique("messages_id_conversation_owner_key").on(table.id, table.conversationId, table.userId),
    unique("messages_conversation_reply_key").on(table.conversationId, table.replyToMessageId),
    foreignKey({
      name: "messages_reply_owner_fk",
      columns: [table.replyToMessageId, table.conversationId, table.userId],
      foreignColumns: [table.id, table.conversationId, table.userId],
    }),
    uniqueIndex("messages_one_active_response_idx").on(table.conversationId).where(sql`${table.role} = 'assistant' AND ${table.status} = 'streaming'`),
    index("messages_user_conversation_idx").on(table.userId, table.conversationId),
    check("messages_content_not_blank", sql`${table.content} <> ''`),
  ],
);

// Account-level defaults. One row per owner. Conversation rows keep their own selected_model.
export const userPreferences = pgTable(
  "user_preferences",
  {
    userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    preferredName: text("preferred_name"),
    preferredLanguage: preferredLanguage("preferred_language").notNull().default("auto"),
    defaultModel: preferenceModel("default_model").notNull().default("balanced"),
    responseLength: responseLength("response_length").notNull().default("balanced"),
    responseStyle: responseStyle("response_style").notNull().default("natural"),
    aboutYou: text("about_you"),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [
    check(
      "user_preferences_preferred_name_length",
      sql`${table.preferredName} is null or (char_length(${table.preferredName}) between 1 and 80 and ${table.preferredName} = btrim(${table.preferredName}))`,
    ),
    check(
      "user_preferences_about_you_length",
      sql`${table.aboutYou} is null or (char_length(${table.aboutYou}) between 1 and 1500 and ${table.aboutYou} = btrim(${table.aboutYou}))`,
    ),
  ],
);
