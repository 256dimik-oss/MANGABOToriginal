import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";

export * from "./models/auth";

export const telegramUsers = pgTable("telegram_users", {
  id: serial("id").primaryKey(),
  telegramId: text("telegram_id").notNull().unique(),
  username: text("username"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ideas = pgTable("ideas", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  userId: text("user_id").notNull(), 
  username: text("username").notNull(), 
  category: text("category").notNull().default("No Category"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const votes = pgTable("votes", {
  id: serial("id").primaryKey(),
  ideaId: integer("idea_id").notNull(),
  userId: text("user_id").notNull(),
  points: integer("points").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow(),
});

export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  botRunning: boolean("bot_running").notNull().default(true),
  hintText: text("hint_text").notNull().default(""),
  currentStage: text("current_stage").notNull().default(""),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertIdeaSchema = createInsertSchema(ideas).omit({ 
  id: true, 
  userId: true, 
  username: true,
  createdAt: true,
  category: true
});

export const setCategorySchema = z.object({
  category: z.enum(["Excellent", "Good", "Normal", "Bad", "Terrible", "No Category"])
});

export const updateSettingsSchema = z.object({
  botRunning: z.boolean().optional(),
  hintText: z.string().optional(),
  currentStage: z.string().optional()
});

export type Idea = typeof ideas.$inferSelect;
export type InsertIdea = z.infer<typeof insertIdeaSchema>;
export type Vote = typeof votes.$inferSelect;
export type Settings = typeof settings.$inferSelect;
