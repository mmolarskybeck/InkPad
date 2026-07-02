import { FormEvent, useEffect, useRef, useState } from "react";
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

export type FileActionMode = "save-as" | "rename";

interface FileActionDialogProps {
  mode: FileActionMode | null;
  initialName: string;
  onOpenChange: (open: boolean) => void;
  onConfirm: (name: string) => void | Promise<void>;
}

const actionCopy = {
  "save-as": {
    title: "Save As",
    description: "Create a separate local file. The story title will stay unchanged.",
    label: "New file name",
    confirm: "Save copy",
  },
  rename: {
    title: "Rename File",
    description: "Change the local file name without changing the story title.",
    label: "File name",
    confirm: "Rename",
  },
} satisfies Record<FileActionMode, {
  title: string;
  description: string;
  label: string;
  confirm: string;
}>;

export function FileActionDialog({
  mode,
  initialName,
  onOpenChange,
  onConfirm,
}: FileActionDialogProps) {
  const [draftName, setDraftName] = useState(initialName);
  const inputRef = useRef<HTMLInputElement>(null);
  const isOpen = mode !== null;
  const copy = mode ? actionCopy[mode] : actionCopy["save-as"];
  const getBaseName = (name: string) => name.trim().replace(/\.ink$/i, "");

  useEffect(() => {
    if (!isOpen) return;

    setDraftName(getBaseName(initialName));
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    }, 0);
  }, [initialName, isOpen]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await onConfirm(draftName);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="bg-panel-bg border-border-color text-text-primary">
        <form onSubmit={handleSubmit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle className="text-text-emphasis">{copy.title}</DialogTitle>
            <DialogDescription className="text-text-secondary">
              {copy.description}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-2">
            <Label htmlFor="file-action-name" className="text-text-emphasis">
              {copy.label}
            </Label>
            <div className="flex min-w-0 items-stretch">
              <Input
                ref={inputRef}
                id="file-action-name"
                value={draftName}
                onChange={(event) => setDraftName(event.target.value.replace(/\.ink$/i, ""))}
                className="min-w-0 rounded-r-none border-border-color bg-editor-bg text-text-emphasis focus-visible:z-10"
              />
              <span
                aria-hidden="true"
                className="flex items-center rounded-r-md border border-l-0 border-border-color bg-muted px-3 font-mono text-[0.8125rem] text-text-secondary"
              >
                .ink
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="bg-success text-editor-bg hover:brightness-110">
              {copy.confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
