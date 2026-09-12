import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  desktopToMobileInsert,
  type SnippetContext,
} from "@/features/snippets/ink-snippets";
import {
  validateCustomSnippet,
  type CustomSnippet,
  type CustomSnippetInput,
} from "@/features/snippets/custom-snippets";

export interface CustomSnippetDialogProps {
  open: boolean;
  mode: "create" | "edit";
  initialValue?: CustomSnippet;
  onOpenChange: (open: boolean) => void;
  onSubmit: (input: CustomSnippetInput) => void;
}

const CONTEXT_OPTIONS: { value: SnippetContext; label: string }[] = [
  { value: "top-level", label: "Top level" },
  { value: "flow", label: "Flow" },
  { value: "inline", label: "Inline" },
];

function parseAliases(raw: string): string[] {
  return raw
    .split(",")
    .map((alias) => alias.trim())
    .filter((alias) => alias.length > 0);
}

export function CustomSnippetDialog({
  open,
  mode,
  initialValue,
  onOpenChange,
  onSubmit,
}: CustomSnippetDialogProps) {
  const [label, setLabel] = useState("");
  const [triggers, setTriggers] = useState("");
  const [context, setContext] = useState<SnippetContext>("flow");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const labelInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;

    setLabel(initialValue?.label ?? "");
    setTriggers(initialValue?.aliases.join(", ") ?? "");
    setContext(initialValue?.context ?? "flow");
    setDescription(initialValue?.description ?? "");
    setBody(initialValue?.body ?? "");
    setProblems([]);

    window.setTimeout(() => {
      labelInputRef.current?.focus();
    }, 0);
  }, [open, initialValue]);

  const clearProblems = () => {
    if (problems.length > 0) setProblems([]);
  };

  const handleBodyKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== "Tab") return;
    event.preventDefault();
    const textarea = event.currentTarget;
    const { selectionStart, selectionEnd, value } = textarea;
    const nextValue = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
    setBody(nextValue);
    window.setTimeout(() => {
      textarea.selectionStart = selectionStart + 2;
      textarea.selectionEnd = selectionStart + 2;
    }, 0);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const input: CustomSnippetInput = {
      label: label.trim(),
      body,
      aliases: parseAliases(triggers),
      description: description.trim(),
      context,
    };

    const nextProblems = validateCustomSnippet(input);
    if (nextProblems.length > 0) {
      setProblems(nextProblems);
      return;
    }

    onSubmit(input);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel-bg border-border-color text-text-primary">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="text-text-emphasis">
              {mode === "create" ? "New custom snippet" : "Edit custom snippet"}
            </DialogTitle>
            <DialogDescription className="text-text-secondary">
              {"Snippets insert Ink structure at the cursor. Use ${1:placeholder} for tab stops."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="custom-snippet-label" className="text-text-emphasis">
              Label
            </Label>
            <Input
              ref={labelInputRef}
              id="custom-snippet-label"
              value={label}
              onChange={(event) => {
                setLabel(event.target.value);
                clearProblems();
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="custom-snippet-triggers" className="text-text-emphasis">
              Triggers
            </Label>
            <Input
              id="custom-snippet-triggers"
              value={triggers}
              onChange={(event) => {
                setTriggers(event.target.value);
                clearProblems();
              }}
              placeholder="e.g. mychoice, mc"
            />
            <p className="text-[0.75rem] text-text-secondary">
              Comma-separated words that trigger this snippet in autocomplete.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="custom-snippet-context" className="text-text-emphasis">
              Context
            </Label>
            <Select
              value={context}
              onValueChange={(value) => {
                setContext(value as SnippetContext);
                clearProblems();
              }}
            >
              <SelectTrigger id="custom-snippet-context">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTEXT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="custom-snippet-description" className="text-text-emphasis">
              Description
            </Label>
            <Input
              id="custom-snippet-description"
              value={description}
              onChange={(event) => {
                setDescription(event.target.value);
                clearProblems();
              }}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="custom-snippet-body" className="text-text-emphasis">
              Body
            </Label>
            <Textarea
              id="custom-snippet-body"
              value={body}
              onChange={(event) => {
                setBody(event.target.value);
                clearProblems();
              }}
              onKeyDown={handleBodyKeyDown}
              className="font-mono text-[0.8125rem]"
              rows={6}
              spellCheck={false}
            />
          </div>

          <div className="grid gap-1">
            <span className="text-[0.75rem] text-text-secondary">Mobile form</span>
            <div className="rounded border border-border-color bg-editor-bg p-2 font-mono text-[0.75rem] whitespace-pre-wrap">
              {desktopToMobileInsert(body)}
            </div>
          </div>

          {problems.length > 0 && (
            <ul role="alert" className="text-[0.8125rem] text-error">
              {problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-success text-editor-bg hover:brightness-110">
              Save snippet
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
