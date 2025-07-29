import { type User, type InsertUser, type Story, type InsertStory } from "../shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  
  // Story methods
  getAllStories(): Promise<Story[]>;
  getStory(id: string): Promise<Story | undefined>;
  createStory(story: InsertStory): Promise<Story>;
  updateStory(id: string, updates: Partial<InsertStory>): Promise<Story | undefined>;
  deleteStory(id: string): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private stories: Map<string, Story>;

  constructor() {
    this.users = new Map();
    this.stories = new Map();
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  // Story methods
  async getAllStories(): Promise<Story[]> {
    return Array.from(this.stories.values());
  }

  async getStory(id: string): Promise<Story | undefined> {
    return this.stories.get(id);
  }

  async createStory(insertStory: InsertStory): Promise<Story> {
    const id = randomUUID();
    const now = new Date();
    const story: Story = { 
      ...insertStory,
      userId: insertStory.userId || null,
      id, 
      createdAt: now,
      updatedAt: now
    };
    this.stories.set(id, story);
    return story;
  }

  async updateStory(id: string, updates: Partial<InsertStory>): Promise<Story | undefined> {
    const existing = this.stories.get(id);
    if (!existing) {
      return undefined;
    }
    
    const updated: Story = {
      ...existing,
      ...updates,
      updatedAt: new Date()
    };
    this.stories.set(id, updated);
    return updated;
  }

  async deleteStory(id: string): Promise<boolean> {
    return this.stories.delete(id);
  }
}

export const storage = new MemStorage();
