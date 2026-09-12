import { beforeEach, describe, expect, it } from "vitest";
import {
  USER_PREFERENCES_STORAGE_KEY,
  loadUserPreferences,
  saveUserPreferences,
} from "./preferences-storage";
import { DEFAULT_USER_PREFERENCES } from "@/types/user-preferences";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return Array.from(this.values.keys())[index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

describe("preferences storage", () => {
  const storage = new MemoryStorage();

  beforeEach(() => storage.clear());

  it("returns and stores defaults when no preferences exist", () => {
    expect(loadUserPreferences(storage)).toEqual(DEFAULT_USER_PREFERENCES);
    expect(JSON.parse(storage.getItem(USER_PREFERENCES_STORAGE_KEY)!)).toEqual(
      DEFAULT_USER_PREFERENCES,
    );
  });

  it("migrates the legacy theme key", () => {
    storage.setItem("inkpad-theme", "light");

    expect(loadUserPreferences(storage).theme).toBe("light");
    expect(storage.getItem("inkpad-theme")).toBeNull();
  });

  it("migrates older preference records with the default story theme", () => {
    storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify({
      schemaVersion: 2,
      theme: "light",
      editorFontSize: 18,
      previewFontSize: 20,
      wordWrap: false,
    }));

    expect(loadUserPreferences(storage)).toEqual({
      ...DEFAULT_USER_PREFERENCES,
      theme: "light",
      editorFontSize: 18,
      previewFontSize: 20,
      previewTheme: "inkpad",
      wordWrap: false,
    });
  });

  it("migrates v3 records by defaulting the snippet toolbar on", () => {
    storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify({
      schemaVersion: 3,
      theme: "light",
      editorFontSize: 16,
      previewFontSize: 18,
      previewTheme: "sepia",
      wordWrap: false,
    }));

    expect(loadUserPreferences(storage)).toEqual({
      ...DEFAULT_USER_PREFERENCES,
      theme: "light",
      editorFontSize: 16,
      previewFontSize: 18,
      previewTheme: "sepia",
      wordWrap: false,
      showSnippetToolbar: true,
      showVariablesInspector: true,
      showSnippetsInspector: true,
    });
  });

  it("round-trips a v4 record", () => {
    const preferences = { ...DEFAULT_USER_PREFERENCES, showSnippetToolbar: false };
    storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(preferences));

    expect(loadUserPreferences(storage)).toEqual(preferences);
  });

  it("rejects a v4 record that is missing an inspector flag", () => {
    const { showSnippetsInspector: _omitted, ...incomplete } = DEFAULT_USER_PREFERENCES;
    storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify(incomplete));

    expect(loadUserPreferences(storage)).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it("falls back safely when stored preferences are invalid", () => {
    storage.setItem(USER_PREFERENCES_STORAGE_KEY, JSON.stringify({
      schemaVersion: 99,
      theme: "neon",
    }));

    expect(loadUserPreferences(storage)).toEqual(DEFAULT_USER_PREFERENCES);
  });

  it("persists valid updates", () => {
    const preferences = { ...DEFAULT_USER_PREFERENCES, previewTheme: "sepia" as const, wordWrap: false };
    expect(saveUserPreferences(preferences, storage)).toBe(true);
    expect(loadUserPreferences(storage)).toEqual(preferences);
  });
});
