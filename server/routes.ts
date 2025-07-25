import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStorySchema } from "@shared/schema";
import { z } from "zod";

// Import inkjs compiler for server-side compilation
import * as inkjs from 'inkjs/full';

async function compileInkSource(inkSource: string): Promise<{ compiled?: any; error?: string }> {
  try {
    // Use inkjs built-in compiler to compile Ink source directly
    const compiler = new inkjs.Compiler(inkSource);
    const story = compiler.Compile();
    
    // Convert compiled story to JSON
    const compiledJson = story.ToJson();
    if (!compiledJson) {
      return { error: "Failed to compile story to JSON" };
    }
    const compiled = JSON.parse(compiledJson);
    
    return { compiled };
  } catch (error) {
    // Extract meaningful error message from inkjs compiler
    let errorMessage = (error as Error).message;
    
    console.error('Ink compilation error:', error);
    
    // Try to parse line numbers and make error more user-friendly
    if (errorMessage.includes('ERROR:')) {
      errorMessage = errorMessage.replace(/^ERROR:\s*/, '');
    }
    
    // Handle common inkjs compilation errors
    if (errorMessage.includes('Unexpected token')) {
      errorMessage = 'Syntax error: ' + errorMessage;
    } else if (errorMessage.includes('is not defined')) {
      errorMessage = 'Reference error: ' + errorMessage;
    }
    
    return { error: errorMessage };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Ink compilation endpoint
  app.post("/api/compile", async (req, res) => {
    try {
      const { source } = req.body;
      
      if (!source || typeof source !== 'string') {
        return res.status(400).json({ error: "Missing or invalid 'source' parameter" });
      }

      const result = await compileInkSource(source);
      
      if (result.error) {
        return res.status(400).json({ error: result.error });
      }

      res.json({ compiled: result.compiled });
    } catch (error) {
      console.error('Compilation error:', error);
      res.status(500).json({ error: "Internal server error during compilation" });
    }
  });

  // Story management routes (stubbed for future expansion)
  
  app.get("/api/stories", async (req, res) => {
    try {
      const stories = await storage.getAllStories();
      res.json(stories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch stories" });
    }
  });

  app.get("/api/stories/:id", async (req, res) => {
    try {
      const story = await storage.getStory(req.params.id);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      res.json(story);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch story" });
    }
  });

  app.post("/api/stories", async (req, res) => {
    try {
      const data = insertStorySchema.parse(req.body);
      const story = await storage.createStory(data);
      res.status(201).json(story);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create story" });
    }
  });

  app.put("/api/stories/:id", async (req, res) => {
    try {
      const data = insertStorySchema.partial().parse(req.body);
      const story = await storage.updateStory(req.params.id, data);
      if (!story) {
        return res.status(404).json({ message: "Story not found" });
      }
      res.json(story);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid request data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update story" });
    }
  });

  app.delete("/api/stories/:id", async (req, res) => {
    try {
      const success = await storage.deleteStory(req.params.id);
      if (!success) {
        return res.status(404).json({ message: "Story not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete story" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
