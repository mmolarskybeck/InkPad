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
    const newTitle = editValue.trim() || 'story';
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
        className={`bg-transparent border border-accent-blue rounded px-2 py-1 text-text-emphasis font-semibold text-sm min-w-[120px] ${className}`}
        placeholder="Story title..."
      />
    );
  }

  return (
    <div 
      className={`flex items-center space-x-1 cursor-pointer hover:bg-border-color/50 rounded px-2 py-1 transition-colors group ${className}`}
      onClick={handleStartEdit}
      title="Click to edit title"
    >
      <span className="text-text-emphasis font-semibold text-sm">{title}</span>
      <Edit3 className="w-3 h-3 text-text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
    </div>
  );
}
