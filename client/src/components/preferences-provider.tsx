import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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

function getSystemTheme(): EffectiveAppTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(loadUserPreferences);
  const [systemTheme, setSystemTheme] = useState<EffectiveAppTheme>(getSystemTheme);
  const effectiveTheme: EffectiveAppTheme = preferences.theme === "system"
    ? systemTheme
    : preferences.theme;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => setSystemTheme(mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

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
