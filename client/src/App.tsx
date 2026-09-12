import { Switch, Route } from "wouter";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PreferencesProvider } from "@/components/preferences-provider";
import { SnippetLibraryProvider } from "@/features/snippets/snippet-library-provider";
import Editor from "@/pages/editor";
import NotFound from "@/pages/not-found";
import { FontSwitcher } from "@/components/font-switcher";
import { AppErrorBoundary } from "@/components/app-error-boundary";
import { AppAnalytics } from "@/components/app-analytics";
import { sanitizeVercelSpeedInsightsEvent } from "@/lib/analytics";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Editor} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <AppErrorBoundary>
      <PreferencesProvider>
        <SnippetLibraryProvider>
          <TooltipProvider>
            <Toaster />
            {/* <FontSwitcher /> Uncomment this to test different fonts locally */}
            <Router />
            <AppAnalytics />
            {/* Performance-only telemetry; URL privacy is enforced in beforeSend. */}
            <SpeedInsights beforeSend={sanitizeVercelSpeedInsightsEvent} />
          </TooltipProvider>
        </SnippetLibraryProvider>
      </PreferencesProvider>
    </AppErrorBoundary>
  );
}

export default App;
