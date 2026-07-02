import * as ink from "inkjs/full";
import type {
  CompilerCompileRequest,
  CompilerResponse,
  InkCompilerMessage,
} from "@/types/worker-messages";

export function compileInkProject(
  request: CompilerCompileRequest,
): CompilerResponse {
  const { requestId, entryFile, files, unresolvedIncludePolicy = "strict" } = request;
  const collectedErrors: InkCompilerMessage[] = [];

  try {
    let source = files[entryFile];
    if (typeof source !== "string") {
      throw new Error(`Entry file "${entryFile}" was not found in this project.`);
    }

    if (unresolvedIncludePolicy === "ignore") {
      const prepared = ignoreUnresolvedIncludes(source, entryFile, files);
      source = prepared.source;
      collectedErrors.push(...prepared.messages);
    }

    const options = new ink.CompilerOptions(
      entryFile,
      [],
      false,
      (message: string, errorType: unknown) => {
        // inkjs ErrorType enum (compiler/Parser/ErrorType):
        //   Author = 0, Warning = 1, Error = 2
        // Author/TODO messages were previously mislabeled as errors because
        // only `=== 1` (Warning) was checked; everything else fell to "error".
        let type: InkCompilerMessage["type"];
        if (errorType === 0) {
          type = "info";       // Author / TODO message
        } else if (errorType === 1) {
          type = "warning";
        } else {
          type = "error";
        }
        collectedErrors.push(normalizeInkCompilerMessage(message, type));
      },
      new ink.JsonFileHandler(files),
    );

    const compiledStory = new ink.Compiler(source, options).Compile();
    const fatalErrors = collectedErrors.filter((error) => error.type === "error");

    if (fatalErrors.length > 0) {
      return {
        type: "compile-error",
        requestId,
        errors: collectedErrors,
      };
    }

    const storyJson = compiledStory.ToJson();
    if (typeof storyJson !== "string") {
      throw new Error("Failed to serialize story to JSON");
    }

    return {
      type: "compile-success",
      requestId,
      storyJson,
      warnings: collectedErrors.filter((error) => error.type === "warning" || error.type === "info"),
    };
  } catch (error) {
    const fatalErrors = collectedErrors.filter((item) => item.type === "error");

    return {
      type: "compile-error",
      requestId,
      errors: fatalErrors.length > 0
        ? collectedErrors
        : [{
            message: error instanceof Error ? error.message : "Unknown error",
            type: "error",
          }],
    };
  }
}

function ignoreUnresolvedIncludes(
  source: string,
  entryFile: string,
  files: Record<string, string>,
): { source: string; messages: InkCompilerMessage[] } {
  const messages: InkCompilerMessage[] = [];

  const preparedSource = source.replace(/^([ \t]*INCLUDE\b[^\r\n]*)(\r?\n|$)/gm, (match, includeLine: string, lineEnding: string, offset: number) => {
    const includePath = includeLine.trim().replace(/^INCLUDE\s+/i, "").trim();

    if (Object.prototype.hasOwnProperty.call(files, includePath)) {
      return match;
    }

    messages.push({
      fileId: entryFile,
      line: source.slice(0, offset).split("\n").length,
      message: `INCLUDE ${includePath} is recognized but ignored until multi-file support is available.`,
      type: "info",
    });

    // Preserve line numbers for downstream inkjs diagnostics.
    return lineEnding;
  });

  return {
    source: preparedSource,
    messages,
  };
}

function normalizeInkCompilerMessage(
  message: string,
  type: InkCompilerMessage["type"],
): InkCompilerMessage {
  let fileId: string | undefined;
  let line: number | undefined;
  let cleanMessage = message;

  const lineMatch = message.match(/\bline\s+(\d+):/i);
  if (lineMatch) {
    line = Number(lineMatch[1]);
    fileId = message.match(/'([^']+)'\s+line\s+\d+:/i)?.[1];

    cleanMessage = message
      .replace(/^(?:ERROR|WARNING):\s*(?:'[^']+'\s+)?line\s+\d+:\s*/i, "")
      .replace(/^(TODO|FIXME):\s*(?:'[^']+'\s+)?line\s+\d+:\s*/i, "$1: ")
      .trimStart();
  }

  return {
    message: cleanMessage,
    type,
    ...(fileId ? { fileId } : {}),
    ...(line ? { line } : {}),
  };
}
