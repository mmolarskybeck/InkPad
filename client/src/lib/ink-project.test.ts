import { describe, expect, it } from "vitest";
import {
  createSingleFileProject,
  isInkProject,
  parseInkProject,
  projectToCompileInput,
} from "./ink-project";

describe("InkProject", () => {
  it("creates a versioned project that wraps the current single-file model", () => {
    const project = createSingleFileProject({
      id: "project-1",
      name: "Story",
      fileName: "story.ink",
      content: "Hello",
    });

    expect(project).toEqual({
      schemaVersion: 1,
      id: "project-1",
      name: "Story",
      entryFile: "story.ink",
      files: {
        "story.ink": { content: "Hello" },
      },
    });
    expect(isInkProject(project)).toBe(true);
  });

  it("normalizes single-file project paths when creating a project", () => {
    const project = createSingleFileProject({
      id: "project-1",
      name: "Story",
      fileName: "chapters\\start.ink",
      content: "Hello",
    });

    expect(project.entryFile).toBe("chapters/start.ink");
    expect(project.files).toEqual({
      "chapters/start.ink": { content: "Hello" },
    });
  });

  it("normalizes single-file project paths to NFC when creating a project", () => {
    const project = createSingleFileProject({
      id: "project-1",
      name: "Story",
      fileName: "cafe\u0301.ink",
      content: "Hello",
    });

    expect(project.entryFile).toBe("caf\u00e9.ink");
    expect(project.files).toEqual({
      "caf\u00e9.ink": { content: "Hello" },
    });
  });

  it("rejects unsafe single-file project paths when creating a project", () => {
    expect(() => createSingleFileProject({
      id: "project-1",
      name: "Story",
      fileName: "../story.ink",
      content: "Hello",
    })).toThrow("relative project paths");
  });

  it("rejects projects whose entry file is missing", () => {
    expect(isInkProject({
      schemaVersion: 1,
      id: "project-1",
      name: "Story",
      entryFile: "main.ink",
      files: {
        "chapter.ink": { content: "Hello" },
      },
    })).toBe(false);
  });

  it("rejects projects with non-normalized or unsafe paths", () => {
    expect(isInkProject({
      schemaVersion: 1,
      id: "project-1",
      name: "Story",
      entryFile: "./story.ink",
      files: {
        "./story.ink": { content: "Hello" },
      },
    })).toBe(false);

    expect(isInkProject({
      schemaVersion: 1,
      id: "project-1",
      name: "Story",
      entryFile: "story.ink",
      files: {
        "story.ink": { content: "Hello" },
        "../secrets.ink": { content: "Nope" },
      },
    })).toBe(false);

    expect(isInkProject({
      schemaVersion: 1,
      id: "project-1",
      name: "Story",
      entryFile: "caf\u00e9.ink",
      files: {
        "caf\u00e9.ink": { content: "Hello" },
        "cafe\u0301.ink": { content: "Nope" },
      },
    })).toBe(false);
  });

  it("rejects projects with case-insensitive path collisions", () => {
    expect(isInkProject({
      schemaVersion: 1,
      id: "project-1",
      name: "Story",
      entryFile: "chapters/Start.ink",
      files: {
        "chapters/Start.ink": { content: "Hello" },
        "chapters/start.ink": { content: "Nope" },
      },
    })).toBe(false);
  });

  it("parses a serialized project snapshot", () => {
    const serialized = JSON.stringify(createSingleFileProject({
      id: "project-1",
      name: "Story",
      fileName: "story.ink",
      content: "Hello",
    }));

    expect(parseInkProject(serialized).entryFile).toBe("story.ink");
  });

  it("converts project files into the compiler's virtual file map", () => {
    const project = createSingleFileProject({
      id: "project-1",
      name: "Story",
      fileName: "story.ink",
      content: "Hello",
    });

    project.files["chapter.ink"] = { content: "Chapter" };

    expect(projectToCompileInput(project)).toEqual({
      entryFile: "story.ink",
      files: {
        "story.ink": "Hello",
        "chapter.ink": "Chapter",
      },
    });
  });
});
