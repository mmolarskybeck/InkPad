import { describe, expect, it } from "vitest";
import {
  createSingleFileProject,
  deleteProjectFile,
  duplicateProjectFile,
  getProjectStorageName,
  isInkProject,
  parseInkProject,
  pinExportNameBase,
  pinProjectName,
  projectToCompileInput,
  reconcileProjectNaming,
  renameProjectFile,
  rewriteIncludeReferences,
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
      schemaVersion: 2,
      id: "project-1",
      name: "Story",
      nameIsExplicit: false,
      fileNameIsExplicit: false,
      exportNameBase: "Story",
      exportNameIsExplicit: false,
      entryFile: "story.ink",
      files: {
        "story.ink": { content: "Hello" },
      },
    });
    expect(isInkProject(project)).toBe(true);
  });

  it("marks a project as already-explicit when created for a returning/legacy document", () => {
    const project = createSingleFileProject({
      id: "project-1",
      name: "Story",
      fileName: "story.ink",
      content: "Hello",
      explicit: true,
    });

    expect(project.nameIsExplicit).toBe(true);
    expect(project.fileNameIsExplicit).toBe(true);
    expect(project.exportNameIsExplicit).toBe(true);
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
      fileName: "café.ink",
      content: "Hello",
    });

    expect(project.entryFile).toBe("café.ink");
    expect(project.files).toEqual({
      "café.ink": { content: "Hello" },
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

  function validProject() {
    return createSingleFileProject({
      id: "project-1",
      name: "Story",
      fileName: "main.ink",
      content: "Hello",
    });
  }

  it("rejects projects whose entry file is missing", () => {
    expect(isInkProject({
      ...validProject(),
      entryFile: "main.ink",
      files: {
        "chapter.ink": { content: "Hello" },
      },
    })).toBe(false);
  });

  it("rejects projects missing naming-pin fields", () => {
    const { nameIsExplicit, ...withoutNameIsExplicit } = validProject();
    expect(isInkProject(withoutNameIsExplicit)).toBe(false);
  });

  it("rejects projects with non-normalized or unsafe paths", () => {
    expect(isInkProject({
      ...validProject(),
      entryFile: "./story.ink",
      files: {
        "./story.ink": { content: "Hello" },
      },
    })).toBe(false);

    expect(isInkProject({
      ...validProject(),
      entryFile: "story.ink",
      files: {
        "story.ink": { content: "Hello" },
        "../secrets.ink": { content: "Nope" },
      },
    })).toBe(false);

    expect(isInkProject({
      ...validProject(),
      entryFile: "café.ink",
      files: {
        "café.ink": { content: "Hello" },
        "café.ink": { content: "Nope" },
      },
    })).toBe(false);
  });

  it("rejects projects with case-insensitive path collisions", () => {
    expect(isInkProject({
      ...validProject(),
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

  it("migrates legacy schema-1 data to explicit-everything on read", () => {
    const legacy = {
      schemaVersion: 1,
      id: "project-1",
      name: "Old Story",
      entryFile: "story.ink",
      files: {
        "story.ink": { content: "Hello" },
      },
    };

    const migrated = parseInkProject(JSON.stringify(legacy));

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.nameIsExplicit).toBe(true);
    expect(migrated.fileNameIsExplicit).toBe(true);
    expect(migrated.exportNameIsExplicit).toBe(true);
    expect(migrated.exportNameBase).toBe("Old Story");
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

  describe("reconcileProjectNaming", () => {
    it("follows the resolved story title into the name and entry file name while unpinned", () => {
      const project = createSingleFileProject({
        id: "project-1",
        name: "Untitled Story",
        fileName: "Untitled Story.ink",
        content: "Hello",
      });

      const reconciled = reconcileProjectNaming(project, "80 Days");

      expect(reconciled.name).toBe("80 Days");
      expect(reconciled.entryFile).toBe("80 Days.ink");
      expect(reconciled.exportNameBase).toBe("80 Days");
      expect(reconciled.files["80 Days.ink"]).toEqual({ content: "Hello" });
    });

    it("returns the same reference when nothing changes", () => {
      const project = reconcileProjectNaming(
        createSingleFileProject({ id: "project-1", name: "80 Days", fileName: "80 Days.ink", content: "Hello" }),
        "80 Days",
      );

      expect(reconcileProjectNaming(project, "80 Days")).toBe(project);
    });

    it("stops following once the name is pinned", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "Untitled Story",
        fileName: "Untitled Story.ink",
        content: "Hello",
      });
      project = pinProjectName(project, "My Journey");

      const reconciled = reconcileProjectNaming(project, "80 Days");

      expect(reconciled.name).toBe("My Journey");
    });

    it("stops following the entry file name once it's pinned, but keeps following exportNameBase", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "My Journey.ink",
        content: "Hello",
      });
      project = renameProjectFile(project, "My Journey.ink", "draft.ink");

      const reconciled = reconcileProjectNaming(project, "Final Cut");

      expect(reconciled.name).toBe("Final Cut");
      expect(reconciled.entryFile).toBe("draft.ink");
      expect(reconciled.exportNameBase).toBe("Final Cut");
    });

    it("stops auto-following the entry file name once a second file exists", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "My Journey.ink",
        content: "Hello",
      });
      project = { ...project, files: { ...project.files, "chapter-two.ink": { content: "More" } } };

      const reconciled = reconcileProjectNaming(project, "Final Cut");

      expect(reconciled.name).toBe("Final Cut");
      expect(reconciled.entryFile).toBe("My Journey.ink");
      expect(reconciled.exportNameBase).toBe("Final Cut");
    });
  });

  describe("renameProjectFile / pinExportNameBase", () => {
    it("renaming the entry file pins fileNameIsExplicit without touching name or exportNameBase", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "My Journey.ink",
        content: "Hello",
      });
      project = renameProjectFile(project, "My Journey.ink", "draft.ink");

      expect(project.entryFile).toBe("draft.ink");
      expect(project.fileNameIsExplicit).toBe(true);
      expect(project.name).toBe("My Journey");
      expect(project.exportNameBase).toBe("My Journey");
    });

    it("renaming a non-entry file does not pin fileNameIsExplicit", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "start.ink",
        content: "INCLUDE chapter.ink",
      });
      project = { ...project, files: { ...project.files, "chapter.ink": { content: "Chapter text" } } };

      project = renameProjectFile(project, "chapter.ink", "chapter-one.ink");

      expect(project.fileNameIsExplicit).toBe(false);
      expect(project.files["chapter-one.ink"]).toEqual({ content: "Chapter text" });
      expect(project.files["chapter.ink"]).toBeUndefined();
    });

    it("rewrites INCLUDE references across the project when a file is renamed", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "start.ink",
        content: "INCLUDE chapter.ink\n\n-> DONE",
      });
      project = { ...project, files: { ...project.files, "chapter.ink": { content: "Chapter text" } } };

      project = renameProjectFile(project, "chapter.ink", "chapter-one.ink");

      expect(project.files["start.ink"].content).toBe("INCLUDE chapter-one.ink\n\n-> DONE");
    });

    it("resolves collisions when renaming a file to a name already in use", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "start.ink",
        content: "Hello",
      });
      project = { ...project, files: { ...project.files, "chapter.ink": { content: "Chapter" } } };

      project = renameProjectFile(project, "chapter.ink", "start.ink");

      expect(project.files["start 2.ink"]).toEqual({ content: "Chapter" });
      expect(project.files["start.ink"]).toEqual({ content: "Hello" });
    });

    it("pinExportNameBase pins independently of the entry file's own name", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "draft.ink",
        content: "Hello",
        explicit: true,
      });

      project = pinExportNameBase(project, "custom-bundle");

      expect(project.exportNameBase).toBe("custom-bundle");
      expect(project.exportNameIsExplicit).toBe(true);
      expect(project.entryFile).toBe("draft.ink");
    });
  });

  describe("duplicateProjectFile / deleteProjectFile", () => {
    it("duplicates a project file next to the original", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "start.ink",
        content: "Hello",
      });
      project = {
        ...project,
        files: {
          ...project.files,
          "chapters/opening.ink": { content: "Opening text" },
        },
      };

      project = duplicateProjectFile(project, "chapters/opening.ink");

      expect(project.files["chapters/opening-copy.ink"]).toEqual({ content: "Opening text" });
      expect(project.entryFile).toBe("start.ink");
    });

    it("resolves duplicate file name collisions", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "start.ink",
        content: "Hello",
      });
      project = {
        ...project,
        files: {
          ...project.files,
          "chapter.ink": { content: "Chapter" },
          "chapter-copy.ink": { content: "First copy" },
        },
      };

      project = duplicateProjectFile(project, "chapter.ink");

      expect(project.files["chapter-copy 2.ink"]).toEqual({ content: "Chapter" });
    });

    it("deletes a non-entry project file", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "start.ink",
        content: "INCLUDE chapter.ink",
      });
      project = { ...project, files: { ...project.files, "chapter.ink": { content: "Chapter" } } };

      project = deleteProjectFile(project, "chapter.ink");

      expect(project.files["chapter.ink"]).toBeUndefined();
      expect(project.files["start.ink"]).toEqual({ content: "INCLUDE chapter.ink" });
      expect(project.entryFile).toBe("start.ink");
    });

    it("does not delete the entry file", () => {
      const project = createSingleFileProject({
        id: "project-1",
        name: "My Journey",
        fileName: "start.ink",
        content: "Hello",
      });

      expect(deleteProjectFile(project, "start.ink")).toBe(project);
    });
  });

  describe("getProjectStorageName", () => {
    it("names a one-file project by the file itself", () => {
      const project = createSingleFileProject({
        id: "project-1",
        name: "Final Cut",
        fileName: "draft.ink",
        content: "Hello",
      });

      expect(getProjectStorageName(project)).toBe("draft.ink");
    });

    it("names a multi-file project by the project, not by any member file", () => {
      let project = createSingleFileProject({
        id: "project-1",
        name: "Final Cut",
        fileName: "draft.ink",
        content: "Hello",
        explicit: true,
      });
      project = { ...project, files: { ...project.files, "chapter-two.ink": { content: "More" } } };

      expect(getProjectStorageName(project)).toBe("Final Cut.inkpad");
    });
  });

  describe("rewriteIncludeReferences", () => {
    it("rewrites a matching INCLUDE line and leaves others untouched", () => {
      const source = "INCLUDE chapter.ink\nINCLUDE other.ink\n-> DONE";
      expect(rewriteIncludeReferences(source, "chapter.ink", "chapter-one.ink")).toBe(
        "INCLUDE chapter-one.ink\nINCLUDE other.ink\n-> DONE",
      );
    });
  });
});
