import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMediaQuery } from "@/hooks/use-media-query";
import { loadUserPreferences, saveUserPreferences } from "@/lib/preferences-storage";
import {
  DEFAULT_USER_PREFERENCES,
  type EffectiveAppTheme,
  type UserPreferences,
} from "@/types/user-preferences";

interface PreferencesContextValue {
  preferences: UserPreferences;
  effectiveTheme: EffectiveAppTheme;
  updatePreferences: (updates: Partial<Omit<UserPreferences, "schemaVersion">>) => void;
  resetPreferences: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

/**
 * Resolves the "system" theme from OS settings. An OS-level high-contrast or
 * forced-colors setting wins over light/dark, mirroring how the pre-mount
 * script in index.html picks the first-paint theme. Falls back to dark where
 * matchMedia is unavailable so tests and old browsers keep the historic look.
 */
export function useSystemTheme(): EffectiveAppTheme {
  const prefersDark = useMediaQuery("(prefers-color-scheme: dark)");
  const prefersLight = useMediaQuery("(prefers-color-scheme: light)");
  const prefersMoreContrast = useMediaQuery("(prefers-contrast: more)");
  const forcedColors = useMediaQuery("(forced-colors: active)");
  if (prefersMoreContrast || forcedColors) return "high-contrast";
  if (prefersDark) return "dark";
  return prefersLight ? "light" : "dark";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(loadUserPreferences);
  const systemTheme = useSystemTheme();
  const effectiveTheme: EffectiveAppTheme = preferences.theme === "system"
    ? systemTheme
    : preferences.theme;

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark", "high-contrast");
    root.classList.add(effectiveTheme);
  }, [effectiveTheme]);

  const updatePreferences = useCallback((
    updates: Partial<Omit<UserPreferences, "schemaVersion">>,
  ) => {
    setPreferences((current) => {
      const next = { ...current, ...updates };
      saveUserPreferences(next);
      return next;
    });
  }, []);

  const resetPreferences = useCallback(() => {
    const next = { ...DEFAULT_USER_PREFERENCES };
    saveUserPreferences(next);
    setPreferences(next);
  }, []);

  const value = useMemo(() => ({
    preferences,
    effectiveTheme,
    updatePreferences,
    resetPreferences,
  }), [effectiveTheme, preferences, resetPreferences, updatePreferences]);

  return (
    <PreferencesContext.Provider value={value}>
      {children}
    </PreferencesContext.Provider>
  );
}

export function usePreferences() {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error("usePreferences must be used within PreferencesProvider");
  }
  return context;
}
