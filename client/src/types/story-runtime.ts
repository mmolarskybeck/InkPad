export type PreviewMode = "transcript" | "scene";

export interface StoryPassage {
  id: string;
  text: string;
  tags: string[];
}

export interface StoryChoice {
  index: number;
  text: string;
  tags: string[];
}

export type StoryTranscriptEntry =
  | { id: string; type: "passage"; passage: StoryPassage }
  | { id: string; type: "choice"; choice: StoryChoice };

export interface StoryRuntimeState {
  transcript: StoryTranscriptEntry[];
  currentPassage: StoryPassage | null;
  choices: StoryChoice[];
  canContinue: boolean;
  isComplete: boolean;
  canStepBack: boolean;
}
