import type React from "react";
import { Toaster as SonnerToaster, type ToasterProps } from "sonner";
import { useTheme } from "@/components/theme-provider";

/**
 * App-wide toast host. Colors come from the active theme's CSS tokens
 * (see `.app-toaster` in index.css), so light, dark, and high-contrast all
 * render on-palette without Sonner's built-in colors.
 */
export function Toaster(props: ToasterProps) {
  const { effectiveTheme } = useTheme();

  return (
    <SonnerToaster
      className="app-toaster"
      theme={effectiveTheme === "light" ? "light" : "dark"}
      position="bottom-center"
      offset={16}
      mobileOffset={12}
      gap={8}
      visibleToasts={3}
      duration={4000}
      closeButton
      style={{ fontFamily: "inherit", "--width": "380px" } as React.CSSProperties}
      {...props}
    />
  );
}
