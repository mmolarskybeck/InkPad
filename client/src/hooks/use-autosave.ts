import { useRef, useEffect, useCallback, useState, useMemo } from 'react';
import {
  AutosaveLeaderCoordinator,
  createAutosaveTabId,
  type AutosaveChannel,
} from '@/lib/autosave-leader';
import { debounce } from "@/lib/debounce";
import { simpleHash } from "@/lib/string-hash";

export type SaveState = "dirty" | "saving" | "saved" | "error" | "disabled";

export interface AutosaveOptions {
  fileName: string;
  content: string;
  onSave: (fileName: string, content: string) => Promise<void>;
  debounceMs?: number;
  checkpointMs?: number;
  enabled?: boolean;
}

export interface AutosaveStatus {
  saveState: SaveState;
  lastSavedAt: number | null;
  isLeader: boolean;
  saveNow: () => Promise<boolean>;
  markSaved: (fileName: string, content: string) => void;
}

export function useAutosave(options: AutosaveOptions): AutosaveStatus {
  const {
    fileName,
    content,
    onSave,
    debounceMs = 1500,
    checkpointMs = 300000, // 5 minutes
    enabled = true,
  } = options;

  const [saveState, setSaveState] = useState<SaveState>(enabled ? "saved" : "disabled");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isLeader, setIsLeader] = useState(
    () => typeof BroadcastChannel === "undefined"
  );
  
  // Refs for tracking state
  const lastSavedHashRef = useRef<string>("");
  const lastSavedFileNameRef = useRef<string>("");
  const checkpointTimerRef = useRef<NodeJS.Timeout>();
  const isLeaderRef = useRef(isLeader);
  const tabIdRef = useRef(createAutosaveTabId());
  const isUnloadingRef = useRef(false);
  const initializedRef = useRef(false);

  const updateLeadership = useCallback((nextIsLeader: boolean) => {
    isLeaderRef.current = nextIsLeader;
    setIsLeader(nextIsLeader);
  }, []);

  // Initialize the hash on first render  
  useEffect(() => {
    if (!initializedRef.current && content !== undefined) {
      lastSavedHashRef.current = simpleHash(content);
      lastSavedFileNameRef.current = fileName;
      initializedRef.current = true;
      // If we have content that seems to be loaded from storage, mark it clean.
      if (content.length > 0) {
        setSaveState(enabled ? "saved" : "disabled");
      }
    }
  }, [content, enabled, fileName]);

  // Initialize leadership and broadcast channel
  useEffect(() => {
    if (!fileName) return;

    if (typeof BroadcastChannel === "undefined") {
      updateLeadership(true);
      return;
    }

    updateLeadership(false);
    const coordinator = new AutosaveLeaderCoordinator({
      tabId: tabIdRef.current,
      channel: new BroadcastChannel(`inkpad/${fileName}`) as AutosaveChannel,
      onLeadershipChange: updateLeadership,
    });
    coordinator.start();
    return () => coordinator.stop();
  }, [fileName, updateLeadership]);

  // Perform the actual save operation
  const performSave = useCallback(async (forceWrite = false): Promise<boolean> => {
    if (!enabled) return false;
    const currentHash = simpleHash(content);
    const savedFileName = lastSavedFileNameRef.current;
    
    // Skip if content hasn't changed (unless forced)
    if (!forceWrite && currentHash === lastSavedHashRef.current && fileName === savedFileName) {
      setSaveState("saved");
      return true;
    }

    setSaveState("saving");
    
    try {
      await onSave(fileName, content);
      // Important: Update the hash AFTER successful save
      lastSavedHashRef.current = currentHash;
      lastSavedFileNameRef.current = fileName;
      const now = Date.now();
      setLastSavedAt(now);
      setSaveState("saved");
      return true;
    } catch (error) {
      console.error('❌ Autosave failed:', error);
      setSaveState("error");
      return false;
    }
  }, [content, enabled, fileName, onSave]);

  const performSaveRef = useRef(performSave);
  useEffect(() => { performSaveRef.current = performSave; }, [performSave]);

  const debouncedSave = useMemo(
    () => debounce(() => performSaveRef.current(), debounceMs),
    [debounceMs]
  );

  // Manual save function (works even for non-leaders)
  const saveNow = useCallback(async (): Promise<boolean> => {
    return performSave(true);
  }, [performSave]);

  const markSaved = useCallback((savedFileName: string, savedContent: string) => {
    lastSavedHashRef.current = simpleHash(savedContent);
    lastSavedFileNameRef.current = savedFileName;
    setLastSavedAt(Date.now());
    setSaveState("saved");
  }, []);

  const scheduleSave = useCallback(() => {
    if (!enabled) return;
    setSaveState("dirty");

    if (!isLeaderRef.current) return;

    debouncedSave();
  }, [enabled, debouncedSave]);

  // Schedule save when content changes
  useEffect(() => {
    if (!fileName || content === undefined) return;
    
    const currentHash = simpleHash(content);
    
    if (!initializedRef.current) return;

    const matchesSavedContent =
      currentHash === lastSavedHashRef.current &&
      fileName === lastSavedFileNameRef.current;

    if (!matchesSavedContent) {
      scheduleSave();
    } else {
      debouncedSave.cancel();
      setSaveState(enabled ? "saved" : "disabled");
    }
  }, [content, debouncedSave, enabled, fileName, scheduleSave]);

  // Periodic checkpoint saves
  useEffect(() => {
    if (!isLeader || !fileName) return;

    checkpointTimerRef.current = setInterval(() => {
      const currentHash = simpleHash(content);
      if (currentHash !== lastSavedHashRef.current) {
        performSave();
      }
    }, checkpointMs);

    return () => {
      if (checkpointTimerRef.current) {
        clearInterval(checkpointTimerRef.current);
      }
    };
  }, [isLeader, fileName, content, checkpointMs, performSave]);

  // Lifecycle saves (tab switch, page close)
  useEffect(() => {
    if (!isLeader) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && !isUnloadingRef.current) {
        debouncedSave.flush();
      }
    };

    const handleBeforeUnload = () => {
      isUnloadingRef.current = true;
      debouncedSave.flush();
    };

    const handlePageHide = () => {
      debouncedSave.flush();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isLeader, debouncedSave]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      debouncedSave.cancel();
      if (checkpointTimerRef.current) clearInterval(checkpointTimerRef.current);
    };
  }, [debouncedSave]);

  return {
    saveState,
    lastSavedAt,
    isLeader,
    saveNow,
    markSaved
  };
}
