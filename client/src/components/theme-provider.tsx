import { usePreferences } from "@/components/preferences-provider";
import type { AppTheme } from "@/types/user-preferences";

export function useTheme() {
  const { effectiveTheme, preferences, updatePreferences } = usePreferences();
  return {
    theme: preferences.theme,
    effectiveTheme,
    setTheme: (theme: AppTheme) => updatePreferences({ theme }),
  };
}
