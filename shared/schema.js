import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
export const users = pgTable("users", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    username: text("username").notNull().unique(),
    password: text("password").notNull(),
});
export const stories = pgTable("stories", {
    id: varchar("id").primaryKey().default(sql `gen_random_uuid()`),
    title: text("title").notNull(),
    content: text("content").notNull(),
    userId: varchar("user_id").references(() => users.id),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
});
export const insertUserSchema = createInsertSchema(users).pick({
    username: true,
    password: true,
});
export const insertStorySchema = createInsertSchema(stories).pick({
    title: true,
    content: true,
    userId: true,
});
