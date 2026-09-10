import { useState, useRef, useEffect } from "react";
import { Edit3 } from "lucide-react";
import { cn } from "@/lib/utils";

interface EditableTitleProps {
  title: string;
  onTitleChange: (newTitle: string) => void | Promise<void>;
  editTrigger?: "click" | "double-click";
  editRequestKey?: string | number;
  className?: string;
  inputClassName?: string;
  textClassName?: string;
  placeholder?: string;
  ariaLabel?: string;
  fallbackTitle?: string;
  normalizeValue?: (value: string) => string;
  showEditIcon?: boolean;
}

export function EditableTitle({
  title,
  onTitleChange,
  editTrigger = "click",
  editRequestKey,
  className = "",
  inputClassName = "",
  textClassName = "",
  placeholder = "Title...",
  ariaLabel = "Edit title",
  fallbackTitle = "Untitled Story",
  normalizeValue,
  showEditIcon = true,
}: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const [isCommitting, setIsCommitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const lastEditRequestKeyRef = useRef(editRequestKey);

  useEffect(() => {
    if (!isEditing || !inputRef.current) return;
    const input = inputRef.current;
    input.focus();
    // Select only the stem so typing replaces "name" in "name.ink" and keeps the extension.
    const extensionStart = /\.[A-Za-z0-9]+$/.exec(input.value)?.index ?? -1;
    if (extensionStart > 0) {
      input.setSelectionRange(0, extensionStart);
    } else {
      input.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditValue(title);
  };

  useEffect(() => {
    if (
      editRequestKey === undefined
      || editRequestKey === lastEditRequestKeyRef.current
    ) {
      return;
    }

    lastEditRequestKeyRef.current = editRequestKey;
    handleStartEdit();
  }, [editRequestKey, title]);

  const handleFinishEdit = async () => {
    if (isCommitting) return;

    const newTitle = normalizeValue
      ? normalizeValue(editValue)
      : editValue.trim() || fallbackTitle;

    if (newTitle === title) {
      setIsEditing(false);
      setEditValue(title);
      return;
    }

    setIsCommitting(true);
    try {
      await onTitleChange(newTitle);
      setIsEditing(false);
    } catch {
      inputRef.current?.focus();
      inputRef.current?.select();
    } finally {
      setIsCommitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isEditing && e.key === "F2") {
      e.preventDefault();
      handleStartEdit();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (isEditing) {
        void handleFinishEdit();
      } else if (editTrigger === "click") {
        handleStartEdit();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditValue(title);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={() => void handleFinishEdit()}
        onKeyDown={handleKeyDown}
        disabled={isCommitting}
        className={cn(
          "h-8 min-w-0 max-w-full truncate rounded border border-accent-blue bg-transparent px-1 py-1 text-[0.875rem] font-medium text-text-emphasis disabled:opacity-70 md:px-2",
          className,
          inputClassName,
        )}
        placeholder={placeholder}
      />
    );
  }

  return (
    <button
      type="button"
      className={cn(
        "group flex h-8 min-w-0 max-w-full items-center gap-1 rounded px-1 py-1 text-left transition-colors hover:bg-border-color/50 md:px-2",
        editTrigger === "click" ? "cursor-text" : "cursor-default",
        className,
      )}
      onClick={editTrigger === "click" ? handleStartEdit : undefined}
      onDoubleClick={editTrigger === "double-click" ? handleStartEdit : undefined}
      onKeyDown={handleKeyDown}
      aria-label={ariaLabel}
      title={editTrigger === "double-click" ? "Double-click or press F2 to rename" : undefined}
    >
      <span className={cn("min-w-0 truncate text-[0.875rem] font-medium text-text-emphasis", textClassName)}>
        {title}
      </span>
      {showEditIcon && (
        <Edit3 className="hidden w-3 h-3 shrink-0 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
      )}
    </button>
  );
}
