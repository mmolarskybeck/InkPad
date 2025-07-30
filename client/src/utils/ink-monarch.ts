// client/src/ink-monarch.ts
export const inkLanguageId = "ink";

export const languageDefinition = {
  tokenizer: {
    root: [
      [/^===.*===$/, "keyword"],    // knots
      [/^\s*->.*$/, "identifier"],  // diverts
      [/\*\s*.+/, "delimiter"],     // choices
      [/\/\/.*$/, "comment"],       // line comments
      [/".*?"/, "string"],
    ],
  },
};
