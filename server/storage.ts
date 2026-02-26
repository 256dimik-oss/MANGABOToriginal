import { db } from "./db";
import { ideas, votes, settings, telegramUsers, type InsertIdea, type Idea, type Vote, type Settings } from "@shared/schema";
import { eq, and, notInArray, desc, sql, count, ne } from "drizzle-orm";
import { authStorage, type IAuthStorage } from "./replit_integrations/auth/storage";

export interface IStorage extends IAuthStorage {
  createIdea(idea: InsertIdea & { userId: string, username: string }): Promise<Idea>;
  getIdeas(): Promise<(Idea & { voteCount: number })[]>;
  getArchivedIdeas(): Promise<(Idea & { voteCount: number })[]>;
  getIdea(id: number): Promise<Idea | undefined>;
  updateIdeaCategory(id: number, category: string): Promise<Idea | undefined>;
  deleteIdea(id: number): Promise<void>;
  clearAllIdeas(): Promise<void>;
  
  // Voting/Evaluation
  getUnseenIdeas(userId: string, limit?: number): Promise<Idea[]>;
  createVote(userId: string, ideaId: number, points?: number): Promise<void>;
  hasUserVotedForIdea(userId: string, ideaId: number): Promise<boolean>;
  getVotedCount(userId: string): Promise<number>;
  getTotalOtherIdeasCount(userId: string): Promise<number>;
  getLastUserIdea(userId: string): Promise<Idea | undefined>;
  getTelegramUsers(): Promise<string[]>;
  trackTelegramUser(telegramId: string, username?: string): Promise<void>;
  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(updates: Partial<Settings>): Promise<Settings>;
}

export class DatabaseStorage implements IStorage {
  // Auth methods delegated to authStorage
  getUser = authStorage.getUser;
  upsertUser = authStorage.upsertUser;

  async getLastUserIdea(userId: string): Promise<Idea | undefined> {
    const [lastIdea] = await db.select()
      .from(ideas)
      .where(eq(ideas.userId, userId))
      .orderBy(desc(ideas.createdAt))
      .limit(1);
    return lastIdea;
  }

  async getTelegramUsers(): Promise<string[]> {
    const allUsers = await db.select({ telegramId: telegramUsers.telegramId }).from(telegramUsers);
    return allUsers.map(u => u.telegramId);
  }

  async trackTelegramUser(telegramId: string, username?: string): Promise<void> {
    await db.insert(telegramUsers)
      .values({ telegramId, username })
      .onConflictDoUpdate({
        target: telegramUsers.telegramId,
        set: { username, createdAt: new Date() }
      });
  }

  async getSettings(): Promise<Settings> {
    const [existing] = await db.select().from(settings).limit(1);
    if (existing) return existing;
    
    const [created] = await db.insert(settings).values({}).returning();
    return created;
  }

  async updateSettings(updates: Partial<Settings>): Promise<Settings> {
    const s = await this.getSettings();
    const [updated] = await db.update(settings)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(settings.id, s.id))
      .returning();
    return updated;
  }

  async createIdea(idea: InsertIdea & { userId: string, username: string }): Promise<Idea> {
    const [newIdea] = await db.insert(ideas).values(idea).returning();
    return newIdea;
  }

  async getIdeas(): Promise<(Idea & { voteCount: number })[]> {
    const result = await db.select({
      id: ideas.id,
      content: ideas.content,
      userId: ideas.userId,
      username: ideas.username,
      category: ideas.category,
      status: ideas.status,
      createdAt: ideas.createdAt,
      voteCount: sql<number>`COALESCE(SUM(${votes.points}), 0)`,
    })
    .from(ideas)
    .leftJoin(votes, eq(ideas.id, votes.ideaId))
    .where(eq(ideas.status, "active"))
    .groupBy(ideas.id)
    .orderBy(desc(sql<number>`COALESCE(SUM(${votes.points}), 0)`), desc(ideas.createdAt));
    
    return result as (Idea & { voteCount: number })[];
  }

  async getArchivedIdeas(): Promise<(Idea & { voteCount: number })[]> {
    const result = await db.select({
      id: ideas.id,
      content: ideas.content,
      userId: ideas.userId,
      username: ideas.username,
      category: ideas.category,
      status: ideas.status,
      createdAt: ideas.createdAt,
      voteCount: sql<number>`COALESCE(SUM(${votes.points}), 0)`,
    })
    .from(ideas)
    .leftJoin(votes, eq(ideas.id, votes.ideaId))
    .where(eq(ideas.status, "archived"))
    .groupBy(ideas.id)
    .orderBy(desc(sql<number>`COALESCE(SUM(${votes.points}), 0)`), desc(ideas.createdAt))
    .limit(3);
    
    return result as (Idea & { voteCount: number })[];
  }

  async getIdea(id: number): Promise<Idea | undefined> {
    const [idea] = await db.select().from(ideas).where(eq(ideas.id, id));
    return idea;
  }

  async updateIdeaCategory(id: number, category: string): Promise<Idea | undefined> {
    const [updated] = await db
      .update(ideas)
      .set({ category })
      .where(eq(ideas.id, id))
      .returning();
    return updated;
  }

  async deleteIdea(id: number): Promise<void> {
    await db.delete(ideas).where(eq(ideas.id, id));
  }

  async clearAllIdeas(): Promise<void> {
    // Archive active ideas instead of deleting them
    await db.update(ideas)
      .set({ status: "archived" })
      .where(eq(ideas.status, "active"));
      
    await db.delete(votes);
  }

  async getUnseenIdeas(userId: string, limit: number = 10): Promise<Idea[]> {
    // Get IDs user has already voted on
    const userVotes = await db.select({ ideaId: votes.ideaId })
      .from(votes)
      .where(eq(votes.userId, userId));
    
    const seenIds = userVotes.map(v => v.ideaId);

    // Filter out user's own ideas, already seen ideas, and archived ideas
    let query = db.select().from(ideas).where(
      and(
        ne(ideas.userId, userId),
        eq(ideas.status, "active")
      )
    );
    
    if (seenIds.length > 0) {
      query = db.select().from(ideas).where(
        and(
          ne(ideas.userId, userId),
          eq(ideas.status, "active"),
          notInArray(ideas.id, seenIds)
        )
      );
    }

    // Randomize result
    const result = await query.orderBy(sql`RANDOM()`).limit(limit);
    return result;
  }

  async createVote(userId: string, ideaId: number, points: number = 1): Promise<void> {
    await db.insert(votes).values({ userId, ideaId, points });
  }

  async hasUserVotedForIdea(userId: string, ideaId: number): Promise<boolean> {
    const [existing] = await db.select()
      .from(votes)
      .where(and(eq(votes.userId, userId), eq(votes.ideaId, ideaId)));
    return !!existing;
  }

  async getVotedCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() })
      .from(votes)
      .where(eq(votes.userId, userId));
    return Number(result.count);
  }

  async getTotalOtherIdeasCount(userId: string): Promise<number> {
    const [result] = await db.select({ count: count() })
      .from(ideas)
      .where(
        and(
          ne(ideas.userId, userId),
          eq(ideas.status, "active")
        )
      );
    return Number(result.count);
  }
}

export const storage = new DatabaseStorage();
