import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertStorySchema } from "../shared/schema";
import { z } from "zod";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import { tmpdir } from "os";

const execAsync = promisify(exec);

async function compileInkSource(inkSource: string): Promise<{ compiled?: any; error?: string }> {
  try {
    // Create temporary files for compilation
    const tempDir = tmpdir();
    const tempInkFile = path.join(tempDir, `temp_${Date.now()}.ink`);
    const tempJsonFile = path.join(tempDir, `temp_${Date.now()}.json`);

    try {
      // Write the Ink source to a temporary file
      await fs.writeFile(tempInkFile, inkSource, 'utf8');

      // Use the native inklecate binary
      const inklecateBinPath = path.join(process.cwd(), 'node_modules', 'inklecate', 'bin', 'inklecate');
      
      // Construct the command more carefully
      const command = `"${inklecateBinPath}" -o "${tempJsonFile}" "${tempInkFile}"`;
      console.log('Executing inklecate command:', command);
      
      // Use inklecate to compile the Ink file with increased timeout
      const { stdout, stderr } = await execAsync(command, { 
        timeout: 10000, // 10 second timeout
        encoding: 'utf8'
      });

      console.log('inklecate stdout:', stdout);
      console.log('inklecate stderr:', stderr);

      // Check for compilation errors in stdout (inklecate puts errors there)
      if (stdout && stdout.includes('ERROR:')) {
        // Parse inklecate errors and make them more user-friendly
        const errorLines = stdout.split('\n')
          .filter(line => line.includes('ERROR:'))
          .map(line => {
            // Clean up the error message
            const cleaned = line.replace(/^.*ERROR:\s*/, '').trim();
            // Extract filename and line number pattern: 'filename' line X: message
            const match = cleaned.match(/'([^']+)'\s+line\s+(\d+):\s*(.+)/);
            if (match) {
              const [, , lineNum, message] = match;
              return `Line ${lineNum}: ${message}`;
            }
            return cleaned;
          });
        
        if (errorLines.length > 0) {
          return { error: errorLines.join('\n') };
        }
      }

      // Check if output file was created (successful compilation)
      let outputExists = false;
      try {
        await fs.access(tempJsonFile);
        outputExists = true;
      } catch (accessError) {
        console.log('Output file does not exist:', (accessError as Error).message);
      }

      if (!outputExists) {
        // If no errors were found in stdout but no output file, return generic error
        const errorMsg = stdout || stderr || 'No output file generated and no error message';
        return { error: `Compilation failed: ${errorMsg}` };
      }

      // Read the compiled JSON
      const compiledJson = await fs.readFile(tempJsonFile, 'utf8');
      
      if (!compiledJson.trim()) {
        return { error: 'Compilation produced empty output' };
      }
      
      // Handle potential BOM (Byte Order Mark) in the JSON
      const cleanJson = compiledJson.replace(/^\uFEFF/, '');
      
      let compiled;
      try {
        compiled = JSON.parse(cleanJson);
      } catch (parseError) {
        console.error('JSON parse error:', parseError);
        console.error('Raw JSON content:', compiledJson);
        return { error: `Invalid JSON output from compiler: ${(parseError as Error).message}` };
      }

      return { compiled };
    } finally {
      // Clean up temporary files
      try {
        await fs.unlink(tempInkFile);
      } catch (e) { 
        console.log('Failed to cleanup ink file:', (e as Error).message); 
      }
      try {
        await fs.unlink(tempJsonFile);
      } catch (e) { 
        console.log('Failed to cleanup json file:', (e as Error).message); 
      }
    }
  } catch (error) {
    console.error('Ink compilation error:', error);
    
    let errorMessage = (error as Error).message;
    
    // Handle common compilation errors
    if (errorMessage.includes('ENOENT')) {
      errorMessage = 'Inklecate compiler not found. Please ensure inklecate is properly installed.';
    } else if (errorMessage.includes('spawn')) {
      errorMessage = 'Failed to start Ink compiler process.';
    } else if (errorMessage.includes('Permission denied')) {
      errorMessage = 'Permission denied: Cannot execute inklecate binary.';
    } else if (errorMessage.includes('timeout')) {
      errorMessage = 'Compilation timed out. The Ink source may be too complex or contain infinite loops.';
    }
    
    return { error: errorMessage };
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint
  app.get('/api/health', async (req, res) => {
    try {
      // In development, use npx inklecate
      await execAsync('npx inklecate --version', { timeout: 5000 });
      res.json({ 
        status: 'healthy', 
        timestamp: Date.now(),
        service: 'inkpad-compiler'
      });
    } catch (error) {
      console.error('Health check failed:', error);
      res.status(503).json({ 
        status: 'unhealthy',
        error: 'inklecate not accessible' 
      });
    }
  });

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

      // Log variable extraction info on server side
      console.log('--- SERVER SIDE DEBUG ---');
      console.log('Compiled story structure:');
      if (result.compiled && result.compiled.root) {
        result.compiled.root.forEach((item: any, index: number) => {
          if (item && typeof item === 'object' && item['global decl']) {
            console.log(`Found global declarations at root[${index}]:`, JSON.stringify(item['global decl'], null, 2));
          }
        });
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
