import { useState, useRef, useEffect } from "react";
import { Edit3 } from "lucide-react";

interface EditableTitleProps {
  title: string;
  onTitleChange: (newTitle: string) => void;
  className?: string;
}

export function EditableTitle({ title, onTitleChange, className = "" }: EditableTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(title);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  useEffect(() => {
    setEditValue(title);
  }, [title]);

  const handleStartEdit = () => {
    setIsEditing(true);
    setEditValue(title);
  };

  const handleFinishEdit = () => {
    setIsEditing(false);
    const newTitle = editValue.trim() || "Untitled Story";
    if (newTitle !== title) {
      onTitleChange(newTitle);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleFinishEdit();
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
        onBlur={handleFinishEdit}
        onKeyDown={handleKeyDown}
        className={`h-8 min-w-0 max-w-full truncate rounded border border-accent-blue bg-transparent px-1 py-1 text-[0.875rem] font-medium text-text-emphasis md:px-2 ${className}`}
        placeholder="Story title..."
      />
    );
  }

  return (
    <button
      type="button"
      className={`group flex h-8 min-w-0 max-w-full cursor-pointer items-center gap-1 rounded px-1 py-1 transition-colors hover:bg-border-color/50 md:px-2 ${className}`}
      onClick={handleStartEdit}
      aria-label="Edit story title"
    >
      <span className="min-w-0 truncate text-[0.875rem] font-medium text-text-emphasis">{title}</span>
      <Edit3 className="hidden w-3 h-3 shrink-0 text-text-secondary opacity-0 transition-opacity group-hover:opacity-100 sm:block" />
    </button>
  );
}
