// User-authored snippets. Stored separately from user preferences (see
// docs/roadmap.md) under its own localStorage key so a corrupt or oversized
// snippet file can never take the rest of the preferences down with it.

import {
  desktopToMobileInsert,
  type InkSnippet,
  type SnippetContext,
} from "./ink-snippets";

export interface CustomSnippet {
  id: string;
  label: string;
  body: string;
  aliases: string[];
  description: string;
  context: SnippetContext;
  createdAt: number;
  updatedAt: number;
}

export const CUSTOM_SNIPPETS_STORAGE_KEY = "inkpad:custom-snippets";
export const CUSTOM_SNIPPETS_SCHEMA_VERSION = 1;

export interface CustomSnippetsFile {
  schemaVersion: 1;
  snippets: CustomSnippet[];
}

const MAX_LABEL_LENGTH = 60;
const MAX_ALIAS_LENGTH = 24;
const SNIPPET_CONTEXTS: SnippetContext[] = ["top-level", "flow", "inline"];

function isCustomSnippet(value: unknown): value is CustomSnippet {
  if (typeof value !== "object" || value === null) return false;
  const snippet = value as Record<string, unknown>;
  return (
    typeof snippet.id === "string"
    && typeof snippet.label === "string"
    && typeof snippet.body === "string"
    && Array.isArray(snippet.aliases)
    && snippet.aliases.every((alias) => typeof alias === "string")
    && typeof snippet.description === "string"
    && SNIPPET_CONTEXTS.includes(snippet.context as SnippetContext)
    && typeof snippet.createdAt === "number"
    && typeof snippet.updatedAt === "number"
  );
}

/** Read the stored snippets. Never throws: anything unusable reads as empty. */
export function loadCustomSnippets(storage: Storage = localStorage): CustomSnippet[] {
  try {
    const raw = storage.getItem(CUSTOM_SNIPPETS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null) return [];

    const file = parsed as Record<string, unknown>;
    if (file.schemaVersion !== CUSTOM_SNIPPETS_SCHEMA_VERSION) return [];
    if (!Array.isArray(file.snippets)) return [];

    return file.snippets.filter(isCustomSnippet);
  } catch {
    return [];
  }
}

/** Persist the snippets. Never throws (private mode / quota exceeded). */
export function saveCustomSnippets(
  snippets: CustomSnippet[],
  storage: Storage = localStorage,
): void {
  const file: CustomSnippetsFile = {
    schemaVersion: CUSTOM_SNIPPETS_SCHEMA_VERSION,
    snippets,
  };

  try {
    storage.setItem(CUSTOM_SNIPPETS_STORAGE_KEY, JSON.stringify(file));
  } catch {
    // Storage is unavailable or full; the in-memory library still works.
  }
}

export interface CustomSnippetInput {
  label: string;
  body: string;
  aliases: string[];
  description?: string;
  context?: SnippetContext;
}

/** Human-readable problems with an input. Empty array means valid. */
export function validateCustomSnippet(input: CustomSnippetInput): string[] {
  const problems: string[] = [];

  const label = input.label.trim();
  if (label === "") {
    problems.push("Give the snippet a name.");
  } else if (label.length > MAX_LABEL_LENGTH) {
    problems.push(`Name must be ${MAX_LABEL_LENGTH} characters or fewer.`);
  }

  if (input.body === "") {
    problems.push("Snippet text cannot be empty.");
  }

  if (input.aliases.length === 0) {
    problems.push("Add at least one trigger word.");
  }

  for (const alias of input.aliases) {
    const trimmed = alias.trim();
    if (trimmed === "") {
      problems.push("Trigger words cannot be blank.");
    } else if (/\s/.test(alias)) {
      problems.push(`Trigger "${alias}" cannot contain spaces.`);
    } else if (alias.length > MAX_ALIAS_LENGTH) {
      problems.push(`Trigger "${alias}" must be ${MAX_ALIAS_LENGTH} characters or fewer.`);
    }
  }

  return problems;
}

export function createCustomSnippet(
  input: CustomSnippetInput,
  now = Date.now(),
): CustomSnippet {
  return {
    id: `custom-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    label: input.label,
    body: input.body,
    aliases: input.aliases,
    description: input.description ?? "",
    context: input.context ?? "flow",
    createdAt: now,
    updatedAt: now,
  };
}

/** Adapt a user snippet to the shape the completion and palette UIs consume. */
export function customSnippetToInkSnippet(custom: CustomSnippet): InkSnippet {
  return {
    id: custom.id,
    label: custom.label,
    category: "Custom",
    context: custom.context,
    aliases: custom.aliases,
    desktopSnippet: custom.body,
    mobileInsert: desktopToMobileInsert(custom.body),
    description: custom.description,
    source: "custom",
  };
}
