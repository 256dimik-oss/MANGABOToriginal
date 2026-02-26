import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { db } from "./db";
import { votes, ideas } from "@shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth setup
  await setupAuth(app);
  registerAuthRoutes(app);

  // Ideas
  app.get('/api/idea', async (req, res) => {
    const allIdeas = await storage.getIdeas();
    res.json(allIdeas);
  });

  app.get(api.ideas.list.path, async (req, res) => {
    const allIdeas = await storage.getIdeas();
    res.json(allIdeas);
  });

  app.post(api.ideas.create.path, isAuthenticated, async (req: any, res) => {
    try {
      const settings = await storage.getSettings();
      if (!settings.botRunning) {
        return res.status(403).json({ message: "The Idea Box is currently closed. Please try again later." });
      }

      const input = api.ideas.create.input.parse(req.body);
      const user = req.user.claims;
      const userId = user.sub;

      const seenCount = await storage.getVotedCount(userId);
      const totalOtherCount = await storage.getTotalOtherIdeasCount(userId);

      if (seenCount < totalOtherCount) {
        return res.status(403).json({ 
          message: `You must evaluate all other ideas first! ${totalOtherCount - seenCount} remaining.` 
        });
      }

      const idea = await storage.createIdea({
        ...input,
        userId: userId,
        username: user.username || user.first_name || "Anonymous",
      });
      res.status(201).json(idea);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({
          message: err.errors[0].message,
          field: err.errors[0].path.join('.'),
        });
      }
      throw err;
    }
  });

  app.get(api.settings.get.path, async (req, res) => {
    const s = await storage.getSettings();
    res.json(s);
  });

  app.patch(api.settings.update.path, isAuthenticated, async (req, res) => {
    // In a real app, restrict to admins
    const input = api.settings.update.input.parse(req.body);
    const s = await storage.updateSettings(input);
    res.json(s);
  });

  app.get(api.ideas.evaluate.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const ideas = await storage.getUnseenIdeas(userId);
    res.json(ideas);
  });

  app.post(api.ideas.vote.path, isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const ideaId = Number(req.params.id);

    const idea = await storage.getIdea(ideaId);
    if (!idea) {
      return res.status(404).json({ message: "Idea not found" });
    }

    if (idea.userId === userId) {
      return res.status(400).json({ message: "You cannot vote for your own idea" });
    }

    const alreadyVoted = await storage.hasUserVotedForIdea(userId, ideaId);
    if (alreadyVoted) {
      return res.status(400).json({ message: "You already voted for this idea" });
    }

    await storage.createVote(userId, ideaId);
    res.json({ message: "Voted successfully" });
  });

  app.patch(api.ideas.setCategory.path, isAuthenticated, async (req, res) => {
    const id = Number(req.params.id);
    const { category } = api.ideas.setCategory.input.parse(req.body);
    
    const updated = await storage.updateIdeaCategory(id, category);
    if (!updated) {
      return res.status(404).json({ message: "Idea not found" });
    }
    res.json(updated);
  });

  app.delete(api.ideas.delete.path, isAuthenticated, async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteIdea(id);
    res.status(204).send();
  });

  app.post("/api/admin/summarize", isAuthenticated, async (req, res) => {
    try {
      const topIdeas = await storage.getIdeas();
      const top3 = topIdeas.slice(0, 3);
      
      const tgUserIds = await storage.getTelegramUsers();
      
      console.log(`Summary broadcast to users: ${tgUserIds.join(", ")}`);

      if (top3.length > 0) {
        const summaryText = `🏆 Подведение итогов!\n\nЛучшие идеи этого этапа:\n\n` + 
          top3.map((idea, idx) => `${idx + 1}. ${idea.username}: ${idea.content} (⭐ ${idea.voteCount})`).join("\n\n") +
          `\n\nВсе остальные идеи и голоса очищены. Начинаем новый этап! 🚀`;

        const bot = (app as any).bot;
        if (bot) {
          for (const tgId of tgUserIds) {
            try {
              console.log(`Attempting to send summary to TG ID: ${tgId}`);
              await bot.sendMessage(tgId, summaryText);
              console.log(`Successfully sent summary to ${tgId}`);
            } catch (e) {
              console.error(`CRITICAL: Failed to send summary to ${tgId}. Error:`, e);
            }
          }
        } else {
          console.error("CRITICAL: Telegram bot instance not found on app object!");
        }
      }

      // Clear data
      await storage.clearAllIdeas();
      
      res.json(top3);
    } catch (error) {
      console.error("Summary error:", error);
      res.status(500).json({ message: "Failed to summarize" });
    }
  });

  return httpServer;
}
