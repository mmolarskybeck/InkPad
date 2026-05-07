import { useRef, useEffect, useCallback, useState } from 'react';

export type SaveState = "dirty" | "saving" | "saved" | "error";

export interface AutosaveOptions {
  fileName: string;
  content: string;
  onSave: (fileName: string, content: string) => Promise<void>;
  debounceMs?: number;
  throttleMs?: number;
  checkpointMs?: number;
}

export interface AutosaveStatus {
  saveState: SaveState;
  lastSavedAt: number | null;
  isLeader: boolean;
  saveNow: () => Promise<boolean>;
}

// Simple non-crypto hash for change detection
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

export function useAutosave(options: AutosaveOptions): AutosaveStatus {
  const {
    fileName,
    content,
    onSave,
    debounceMs = 1500,
    throttleMs = 8000,
    checkpointMs = 300000 // 5 minutes
  } = options;

  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [isLeader, setIsLeader] = useState(true);
  
  // Add debugging for state changes
  useEffect(() => {
    console.log(`🔄 Save state changed to: ${saveState}`);
  }, [saveState]);

  // Refs for tracking state
  const lastSavedHashRef = useRef<string>("");
  const debounceTimerRef = useRef<NodeJS.Timeout>();
  const throttleTimerRef = useRef<NodeJS.Timeout>();
  const checkpointTimerRef = useRef<NodeJS.Timeout>();
  const lastThrottledSaveRef = useRef<number>(0);
  const broadcastChannelRef = useRef<BroadcastChannel>();
  const isUnloadingRef = useRef(false);
  const initializedRef = useRef(false);

  // Initialize the hash on first render  
  useEffect(() => {
    if (!initializedRef.current && content !== undefined) {
      lastSavedHashRef.current = simpleHash(content);
      initializedRef.current = true;
      // If we have content that seems to be loaded from storage, mark as saved
      if (content.length > 0) {
        setSaveState("saved");
      }
    }
  }, [content]);

  // Initialize leadership and broadcast channel
  useEffect(() => {
    if (!fileName) return;

    const channel = new BroadcastChannel(`inkpad/${fileName}`);
    broadcastChannelRef.current = channel;

    // Announce presence and check for existing leader
    let leaderTimeout: NodeJS.Timeout;
    
    channel.postMessage({ type: 'announce', timestamp: Date.now() });
    
    // If no response in 100ms, assume leadership
    leaderTimeout = setTimeout(() => {
      setIsLeader(true);
      channel.postMessage({ type: 'leader', timestamp: Date.now() });
    }, 100);

    channel.onmessage = (event) => {
      const { type, timestamp } = event.data;
      
      if (type === 'announce') {
        // Respond if we're the leader
        if (isLeader) {
          channel.postMessage({ type: 'leader', timestamp: Date.now() });
        }
      } else if (type === 'leader') {
        // Another tab is the leader
        clearTimeout(leaderTimeout);
        setIsLeader(false);
      }
    };

    return () => {
      clearTimeout(leaderTimeout);
      channel.close();
    };
  }, [fileName]);

  // Perform the actual save operation
  const performSave = useCallback(async (forceWrite = false): Promise<boolean> => {
    const currentHash = simpleHash(content);
    
    console.log(`💾 PerformSave: currentHash=${currentHash}, lastSaved=${lastSavedHashRef.current}, force=${forceWrite}`);
    
    // Skip if content hasn't changed (unless forced)
    if (!forceWrite && currentHash === lastSavedHashRef.current) {
      console.log('✅ Content unchanged, setting saved state');
      setSaveState("saved");
      return true;
    }

    console.log('🔵 Setting state to saving');
    setSaveState("saving");
    
    try {
      await onSave(fileName, content);
      // Important: Update the hash AFTER successful save
      lastSavedHashRef.current = currentHash;
      const now = Date.now();
      setLastSavedAt(now);
      console.log('🟢 Save successful, setting saved state');
      setSaveState("saved");
      return true;
    } catch (error) {
      console.error('❌ Autosave failed:', error);
      setSaveState("error");
      return false;
    }
  }, [fileName, content, onSave]);

  // Manual save function (works even for non-leaders)
  const saveNow = useCallback(async (): Promise<boolean> => {
    return performSave(true);
  }, [performSave]);

  // Debounced save logic
  const scheduleSave = useCallback(() => {
    if (!isLeader) return;

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Mark as dirty
    console.log('🟡 Setting state to dirty');
    setSaveState("dirty");

    // Check if we need to throttle (during continuous typing)
    const now = Date.now();
    const timeSinceLastThrottledSave = now - lastThrottledSaveRef.current;
    
    if (timeSinceLastThrottledSave >= throttleMs) {
      // Immediate save due to throttle
      console.log('⚡ Throttled save - immediate');
      debounceTimerRef.current = setTimeout(() => {
        performSave().then(() => {
          lastThrottledSaveRef.current = Date.now();
        });
      }, debounceMs);
    } else {
      // Regular debounced save
      console.log('⏱️ Regular debounced save');
      debounceTimerRef.current = setTimeout(() => {
        performSave();
      }, debounceMs);
    }
  }, [isLeader, debounceMs, throttleMs, performSave]);

  // Schedule save when content changes
  useEffect(() => {
    if (!fileName || content === undefined) return;
    
    const currentHash = simpleHash(content);
    console.log(`📝 Content effect: hash=${currentHash}, lastSaved=${lastSavedHashRef.current}, initialized=${initializedRef.current}`);
    
    // Only schedule save if content has actually changed AND we're initialized
    if (initializedRef.current && currentHash !== lastSavedHashRef.current) {
      console.log('🚀 Scheduling save due to content change');
      scheduleSave();
    } else if (!initializedRef.current) {
      console.log('⏳ Not initialized yet, skipping save');
    } else {
      console.log('✅ Content unchanged, no save needed');
    }
  }, [content, fileName, scheduleSave]);

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
        performSave(true);
      }
    };

    const handleBeforeUnload = () => {
      isUnloadingRef.current = true;
      // Synchronous save for unload (best effort)
      const currentHash = simpleHash(content);
      if (currentHash !== lastSavedHashRef.current) {
        performSave(true);
      }
    };

    const handlePageHide = () => {
      performSave(true);
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [isLeader, content, performSave]);

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
      if (checkpointTimerRef.current) clearInterval(checkpointTimerRef.current);
    };
  }, []);

  return {
    saveState,
    lastSavedAt,
    isLeader,
    saveNow
  };
}
