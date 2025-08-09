import { Clock, Save, AlertCircle, Loader2 } from "lucide-react";
import { SaveState } from "@/hooks/use-autosave";

interface SaveStatusProps {
  saveState: SaveState;
  lastSavedAt: number | null;
  isLeader: boolean;
  className?: string;
}

export function SaveStatus({ saveState, lastSavedAt, isLeader, className = "" }: SaveStatusProps) {
  const formatTimeSince = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    
    if (seconds < 60) return "just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  const getStatusConfig = () => {
    if (!isLeader) {
      return {
        icon: Clock,
        text: "Read-only (open in another tab)",
        variant: "secondary" as const,
        color: "text-amber-600"
      };
    }

    switch (saveState) {
      case "dirty":
        return {
          icon: Clock,
          text: "Unsaved changes",
          variant: "secondary" as const,
          color: "text-amber-600"
        };
      case "saving":
        return {
          icon: Loader2,
          text: "Saving...",
          variant: "secondary" as const,
          color: "text-blue-600",
          animate: true
        };
      case "saved":
        return {
          icon: Save,
          text: lastSavedAt ? `Saved ${formatTimeSince(lastSavedAt)}` : "Saved",
          variant: "secondary" as const,
          color: "text-green-600"
        };
      case "error":
        return {
          icon: AlertCircle,
          text: "Save failed",
          variant: "destructive" as const,
          color: "text-red-600"
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.icon;

  return (
    <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors ${
      config.variant === "destructive" 
        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" 
        : "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
    } ${className}`}>
      <Icon 
        size={12} 
        className={`${config.color} ${config.animate ? "animate-spin" : ""}`} 
      />
      <span className={config.color}>{config.text}</span>
    </div>
  );
}
