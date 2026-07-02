import { useEffect, useState } from "react";
import { Analytics } from "@vercel/analytics/react";
import {
  ANALYTICS_ENABLED_STORAGE_KEY,
  isAnalyticsEnabled,
  sanitizeVercelAnalyticsEvent,
  trackAppLoaded,
} from "@/lib/analytics";

let hasTrackedAppLoad = false;

export function AppAnalytics() {
  const [enabled, setEnabled] = useState(isAnalyticsEnabled);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === ANALYTICS_ENABLED_STORAGE_KEY) {
        setEnabled(isAnalyticsEnabled());
      }
    };

    const handlePreferenceChange = () => {
      setEnabled(isAnalyticsEnabled());
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener("inkpad:analytics-preference-change", handlePreferenceChange);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener("inkpad:analytics-preference-change", handlePreferenceChange);
    };
  }, []);

  useEffect(() => {
    if (!enabled || hasTrackedAppLoad) return;
    hasTrackedAppLoad = true;
    trackAppLoaded();
  }, [enabled]);

  if (!enabled) return null;

  return <Analytics beforeSend={sanitizeVercelAnalyticsEvent} />;
}
