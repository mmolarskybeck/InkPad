import { useCallback, useEffect, useRef, type RefObject } from "react";
import type { CodeMirrorEditorHandle } from "@/components/editor/codemirror-editor";
import {
  FileOperations,
  type StoredStorySettings,
} from "@/lib/file-operations";

interface UseEditorSourceBufferOptions {
  editorRef: RefObject<CodeMirrorEditorHandle>;
  fileName: string;
  source: string;
  onSourceCommit: (source: string) => void;
}

export function useEditorSourceBuffer({
  editorRef,
  fileName,
  source,
  onSourceCommit,
}: UseEditorSourceBufferOptions) {
  const latestSourceRef = useRef(source);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRecoveryRef = useRef<{
    filename: string;
    source: string;
    settings?: StoredStorySettings;
  } | null>(null);
  const onSourceCommitRef = useRef(onSourceCommit);

  useEffect(() => {
    onSourceCommitRef.current = onSourceCommit;
  }, [onSourceCommit]);

  const flushSourceState = useCallback(() => {
    onSourceCommitRef.current(latestSourceRef.current);
  }, []);

  const scheduleSourceState = useCallback((nextSource: string) => {
    latestSourceRef.current = nextSource;
    onSourceCommitRef.current(nextSource);
  }, []);

  const resetBufferedSource = useCallback((nextSource: string) => {
    latestSourceRef.current = nextSource;
  }, []);

  const cancelPendingRecoveryDraft = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    pendingRecoveryRef.current = null;
  }, []);

  const flushRecoveryDraft = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
    const draft = pendingRecoveryRef.current;
    if (!draft) return;
    FileOperations.saveRecoveryDraft(draft.filename, draft.source, draft.settings);
    pendingRecoveryRef.current = null;
  }, []);

  const scheduleRecoveryDraft = useCallback((
    draftFileName: string,
    nextSource: string,
    settings?: StoredStorySettings,
  ) => {
    pendingRecoveryRef.current = { filename: draftFileName, source: nextSource, settings };
    if (recoveryTimerRef.current) clearTimeout(recoveryTimerRef.current);
    recoveryTimerRef.current = setTimeout(() => {
      recoveryTimerRef.current = null;
      const draft = pendingRecoveryRef.current;
      if (!draft) return;
      FileOperations.saveRecoveryDraft(draft.filename, draft.source, draft.settings);
      pendingRecoveryRef.current = null;
    }, 500);
  }, []);

  const getCurrentSource = useCallback(() => (
    editorRef.current?.getValue() || latestSourceRef.current || source
  ), [editorRef, source]);

  useEffect(() => {
    const flushAll = () => {
      editorRef.current?.flushChanges();
      flushSourceState();
      flushRecoveryDraft();
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") flushAll();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", flushAll);
    window.addEventListener("beforeunload", flushAll);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", flushAll);
      window.removeEventListener("beforeunload", flushAll);
      flushAll();
    };
  }, [editorRef, flushRecoveryDraft, flushSourceState]);

  useEffect(() => {
    latestSourceRef.current = source;
  }, [fileName, source]);

  return {
    scheduleSourceState,
    resetBufferedSource,
    cancelPendingRecoveryDraft,
    scheduleRecoveryDraft,
    getCurrentSource,
  };
}
