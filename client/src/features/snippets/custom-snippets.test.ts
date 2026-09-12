import { describe, expect, it } from "vitest";
import {
  createCustomSnippet,
  customSnippetToInkSnippet,
  CUSTOM_SNIPPETS_STORAGE_KEY,
  loadCustomSnippets,
  saveCustomSnippets,
  validateCustomSnippet,
  type CustomSnippet,
} from "./custom-snippets";

/** Minimal in-memory `Storage`, so tests never touch a real localStorage. */
function createStorageStub(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => map.get(key) ?? null,
    key: (index: number) => [...map.keys()][index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

const sampleSnippet: CustomSnippet = {
  id: "custom-abc-123456",
  label: "Scene break",
  body: "* * *\n${1:Next scene.}\n",
  aliases: ["scene"],
  description: "A visual scene break.",
  context: "flow",
  createdAt: 1000,
  updatedAt: 2000,
};

describe("loadCustomSnippets / saveCustomSnippets", () => {
  it("round-trips through storage", () => {
    const storage = createStorageStub();
    saveCustomSnippets([sampleSnippet], storage);
    expect(loadCustomSnippets(storage)).toEqual([sampleSnippet]);
  });

  it("writes a versioned file under the documented key", () => {
    const storage = createStorageStub();
    saveCustomSnippets([sampleSnippet], storage);
    const raw = storage.getItem(CUSTOM_SNIPPETS_STORAGE_KEY);
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).schemaVersion).toBe(1);
  });

  it("returns [] when nothing is stored", () => {
    expect(loadCustomSnippets(createStorageStub())).toEqual([]);
  });

  it("returns [] on invalid JSON", () => {
    const storage = createStorageStub({ [CUSTOM_SNIPPETS_STORAGE_KEY]: "{not json" });
    expect(loadCustomSnippets(storage)).toEqual([]);
  });

  it("returns [] on an unknown schema version", () => {
    const storage = createStorageStub({
      [CUSTOM_SNIPPETS_STORAGE_KEY]: JSON.stringify({ schemaVersion: 99, snippets: [] }),
    });
    expect(loadCustomSnippets(storage)).toEqual([]);
  });

  it("returns [] when the shape is wrong", () => {
    const storage = createStorageStub({
      [CUSTOM_SNIPPETS_STORAGE_KEY]: JSON.stringify({ schemaVersion: 1, snippets: "nope" }),
    });
    expect(loadCustomSnippets(storage)).toEqual([]);
  });

  it("drops individual malformed entries", () => {
    const storage = createStorageStub({
      [CUSTOM_SNIPPETS_STORAGE_KEY]: JSON.stringify({
        schemaVersion: 1,
        snippets: [sampleSnippet, { id: "broken" }, null],
      }),
    });
    expect(loadCustomSnippets(storage)).toEqual([sampleSnippet]);
  });

  it("does not throw when storage rejects writes", () => {
    const storage = createStorageStub();
    storage.setItem = () => {
      throw new Error("quota exceeded");
    };
    expect(() => saveCustomSnippets([sampleSnippet], storage)).not.toThrow();
  });
});

describe("validateCustomSnippet", () => {
  const valid = { label: "Scene break", body: "* * *", aliases: ["scene"] };

  it("accepts a valid input", () => {
    expect(validateCustomSnippet(valid)).toEqual([]);
  });

  it("rejects a blank label", () => {
    expect(validateCustomSnippet({ ...valid, label: "   " })).toHaveLength(1);
  });

  it("rejects a label longer than 60 characters", () => {
    expect(validateCustomSnippet({ ...valid, label: "x".repeat(61) })).toHaveLength(1);
    expect(validateCustomSnippet({ ...valid, label: "x".repeat(60) })).toEqual([]);
  });

  it("rejects an empty body", () => {
    expect(validateCustomSnippet({ ...valid, body: "" })).toHaveLength(1);
  });

  it("requires at least one alias", () => {
    expect(validateCustomSnippet({ ...valid, aliases: [] })).toHaveLength(1);
  });

  it("rejects blank, spaced, and over-long aliases", () => {
    expect(validateCustomSnippet({ ...valid, aliases: ["  "] })).toHaveLength(1);
    expect(validateCustomSnippet({ ...valid, aliases: ["two words"] })).toHaveLength(1);
    expect(validateCustomSnippet({ ...valid, aliases: ["x".repeat(25)] })).toHaveLength(1);
    expect(validateCustomSnippet({ ...valid, aliases: ["x".repeat(24)] })).toEqual([]);
  });

  it("reports every problem at once", () => {
    expect(validateCustomSnippet({ label: "", body: "", aliases: [] })).toHaveLength(3);
  });
});

describe("createCustomSnippet", () => {
  it("derives an id from the timestamp and stamps both times", () => {
    const snippet = createCustomSnippet(
      { label: "Scene break", body: "* * *", aliases: ["scene"] },
      1700000000000,
    );
    expect(snippet.id.startsWith(`custom-${(1700000000000).toString(36)}-`)).toBe(true);
    expect(snippet.createdAt).toBe(1700000000000);
    expect(snippet.updatedAt).toBe(1700000000000);
  });

  it("defaults context to flow and description to empty", () => {
    const snippet = createCustomSnippet({ label: "A", body: "b", aliases: ["a"] });
    expect(snippet.context).toBe("flow");
    expect(snippet.description).toBe("");
  });

  it("keeps an explicit context and description", () => {
    const snippet = createCustomSnippet({
      label: "A",
      body: "b",
      aliases: ["a"],
      context: "inline",
      description: "Note.",
    });
    expect(snippet.context).toBe("inline");
    expect(snippet.description).toBe("Note.");
  });

  it("generates distinct ids for snippets made in the same millisecond", () => {
    const a = createCustomSnippet({ label: "A", body: "b", aliases: ["a"] }, 1);
    const b = createCustomSnippet({ label: "A", body: "b", aliases: ["a"] }, 1);
    expect(a.id).not.toBe(b.id);
  });
});

describe("customSnippetToInkSnippet", () => {
  it("maps into the Custom category with a derived mobile form", () => {
    expect(customSnippetToInkSnippet(sampleSnippet)).toEqual({
      id: "custom-abc-123456",
      label: "Scene break",
      category: "Custom",
      context: "flow",
      aliases: ["scene"],
      desktopSnippet: "* * *\n${1:Next scene.}\n",
      mobileInsert: "* * *\n[Next scene.]\n",
      description: "A visual scene break.",
      source: "custom",
    });
  });
});
