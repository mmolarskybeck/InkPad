import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createCustomSnippet,
  customSnippetToInkSnippet,
  CUSTOM_SNIPPETS_STORAGE_KEY,
  loadCustomSnippets,
  saveCustomSnippets,
  type CustomSnippet,
  type CustomSnippetInput,
} from "./custom-snippets";
import { ALL_BUILTIN_SNIPPETS, type InkSnippet } from "./ink-snippets";

export interface SnippetLibraryContextValue {
  /** Built-ins followed by the user's own snippets. */
  snippets: InkSnippet[];
  customSnippets: CustomSnippet[];
  addCustomSnippet: (input: CustomSnippetInput) => CustomSnippet;
  updateCustomSnippet: (id: string, input: CustomSnippetInput) => void;
  removeCustomSnippet: (id: string) => void;
}

const SnippetLibraryContext = createContext<SnippetLibraryContextValue | null>(null);

export function SnippetLibraryProvider({ children }: { children: ReactNode }) {
  const [customSnippets, setCustomSnippets] = useState<CustomSnippet[]>(
    () => loadCustomSnippets(),
  );

  // Another tab editing the library should not leave this one stale.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && event.key !== CUSTOM_SNIPPETS_STORAGE_KEY) return;
      setCustomSnippets(loadCustomSnippets());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const addCustomSnippet = useCallback((input: CustomSnippetInput) => {
    const created = createCustomSnippet(input);
    setCustomSnippets((current) => {
      const next = [...current, created];
      saveCustomSnippets(next);
      return next;
    });
    return created;
  }, []);

  const updateCustomSnippet = useCallback((id: string, input: CustomSnippetInput) => {
    setCustomSnippets((current) => {
      const next = current.map((snippet) => snippet.id === id
        ? {
          ...snippet,
          label: input.label,
          body: input.body,
          aliases: input.aliases,
          description: input.description ?? "",
          context: input.context ?? snippet.context,
          updatedAt: Date.now(),
        }
        : snippet);
      saveCustomSnippets(next);
      return next;
    });
  }, []);

  const removeCustomSnippet = useCallback((id: string) => {
    setCustomSnippets((current) => {
      const next = current.filter((snippet) => snippet.id !== id);
      saveCustomSnippets(next);
      return next;
    });
  }, []);

  const snippets = useMemo(
    () => [...ALL_BUILTIN_SNIPPETS, ...customSnippets.map(customSnippetToInkSnippet)],
    [customSnippets],
  );

  const value = useMemo(() => ({
    snippets,
    customSnippets,
    addCustomSnippet,
    updateCustomSnippet,
    removeCustomSnippet,
  }), [
    addCustomSnippet,
    customSnippets,
    removeCustomSnippet,
    snippets,
    updateCustomSnippet,
  ]);

  return (
    <SnippetLibraryContext.Provider value={value}>
      {children}
    </SnippetLibraryContext.Provider>
  );
}

export function useSnippetLibrary(): SnippetLibraryContextValue {
  const context = useContext(SnippetLibraryContext);
  if (!context) {
    throw new Error("useSnippetLibrary must be used within SnippetLibraryProvider");
  }
  return context;
}
