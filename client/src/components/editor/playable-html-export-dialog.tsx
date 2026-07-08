import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  DEFAULT_HTML_EXPORT_APPEARANCE,
  type HtmlExportFont,
  type HtmlExportOptions,
  type HtmlExportRequest,
  type HtmlExportTheme,
} from "@/features/export/html-export-options";
import type { StoryMetadata, ThemeName } from "@/lib/tag-interpreter";
import { replaceFilenameExtension } from "@/lib/filename-utils";
import { Input } from "@/components/ui/input";

function capTheme(theme: ThemeName): string {
  if (theme === "high-contrast") return "High contrast";
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

interface PlayableHtmlExportDialogProps {
  open: boolean;
  metadata: StoryMetadata;
  savedOptions?: HtmlExportOptions;
  storyTypeface: HtmlExportFont;
  resolvedTheme: ThemeName;
  resolvedFromSystem: boolean;
  filename: string;
  isExporting?: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (request: HtmlExportRequest) => void | Promise<void>;
  onSetFileTheme: (theme: HtmlExportTheme) => void;
  onStoryTypefaceChange: (font: HtmlExportFont) => void;
}

export function PlayableHtmlExportDialog({
  open,
  metadata,
  savedOptions,
  storyTypeface,
  resolvedTheme,
  resolvedFromSystem,
  filename,
  isExporting = false,
  onOpenChange,
  onExport,
  onSetFileTheme,
  onStoryTypefaceChange,
}: PlayableHtmlExportDialogProps) {
  const [options, setOptions] = useState<HtmlExportOptions>(() => ({
    title: metadata.title,
    author: metadata.author ?? "",
    ...DEFAULT_HTML_EXPORT_APPEARANCE,
  }));
  const [rememberChoices, setRememberChoices] = useState(true);
  const [localFileTheme, setLocalFileTheme] = useState<ThemeName | null>(metadata.theme);
  const wasOpenRef = useRef(false);
  const defaultThemeRef = useRef<ThemeName>(metadata.theme ?? resolvedTheme);

  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    const defaultTheme = metadata.theme ?? resolvedTheme;
    defaultThemeRef.current = defaultTheme;
    setLocalFileTheme(metadata.theme);
    setOptions({
      title: savedOptions?.title ?? metadata.title,
      author: savedOptions?.author ?? metadata.author ?? "",
      theme: defaultTheme,
      font: storyTypeface,
      includeReadme: savedOptions?.includeReadme ?? DEFAULT_HTML_EXPORT_APPEARANCE.includeReadme,
    });
    setRememberChoices(true);
  }, [metadata.author, metadata.theme, metadata.title, open, resolvedTheme, savedOptions, storyTypeface]);

  const handleExport = async () => {
    await onExport({
      ...options,
      title: options.title.trim() || "Untitled Story",
      author: options.author.trim(),
      rememberChoices,
    });
    onOpenChange(false);
  };

  const defaultTheme = defaultThemeRef.current;
  const themeMatchesFile = localFileTheme !== null && options.theme === localFileTheme;
  const themeIsDefault = options.theme === defaultTheme;
  const showSetFileTheme = !themeIsDefault && options.theme !== localFileTheme;

  const themeName = capTheme(options.theme);
  let themeStatusText: React.ReactNode;
  if (themeMatchesFile) {
    themeStatusText = (
      <>
        Export will use {themeName} from{" "}
        <code className="rounded bg-editor-bg px-1 py-0.5 font-mono text-[0.6875rem]">
          # theme:
        </code>{" "}
        in this ink file.
      </>
    );
  } else if (themeIsDefault && localFileTheme === null) {
    themeStatusText = resolvedFromSystem ? (
      <>
        No{" "}
        <code className="rounded bg-editor-bg px-1 py-0.5 font-mono text-[0.6875rem]">
          # theme:
        </code>{" "}
        tag in this file. Export will use {themeName}, based on your current system setting.
      </>
    ) : (
      <>
        No{" "}
        <code className="rounded bg-editor-bg px-1 py-0.5 font-mono text-[0.6875rem]">
          # theme:
        </code>{" "}
        tag in this file. Export will use {themeName}.
      </>
    );
  } else {
    themeStatusText = (
      <>
        Export will use {themeName}. You can also write {themeName} to this ink file.
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onOpenAutoFocus={(event) => event.preventDefault()}
        className="max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] overflow-y-auto border-border-color bg-panel-bg text-text-primary sm:max-w-lg"
      >
        <DialogHeader className="mb-4">
          <DialogTitle className="text-xl font-semibold tracking-tight text-text-emphasis">Export playable HTML</DialogTitle>
          <DialogDescription className="text-text-secondary">
            Download a standalone web version of this story.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-8 py-2">
          {/* Metadata Section */}
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="html-export-title" className="text-text-emphasis">Story title</Label>
                <Input
                  id="html-export-title"
                  value={options.title}
                  onChange={(event) => setOptions((current) => ({
                    ...current,
                    title: event.target.value,
                  }))}
                  className="min-h-10 border-border-color bg-editor-bg text-text-emphasis"
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="html-export-author" className="text-text-emphasis">Author</Label>
                <Input
                  id="html-export-author"
                  value={options.author}
                  placeholder="No byline"
                  onChange={(event) => setOptions((current) => ({
                    ...current,
                    author: event.target.value,
                  }))}
                  className="min-h-10 border-border-color bg-editor-bg text-text-emphasis"
                />
              </div>
            </div>
            <p className="text-[0.8125rem] leading-snug text-text-secondary">
              Title and author changes only affect this download. Theme and typeface use the same story appearance values as Settings.
            </p>
          </div>

          {/* Appearance Section */}
          <div className="flex flex-col gap-4">
            <div className="text-[0.875rem] font-semibold tracking-tight text-text-emphasis">Appearance</div>
            <div className="grid gap-6 sm:grid-cols-2 sm:gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="html-export-theme" className="text-text-emphasis">Export theme</Label>
                <Select
                  value={options.theme}
                  onValueChange={(theme) => {
                    setOptions((current) => ({
                      ...current,
                      theme: theme as HtmlExportTheme,
                    }));
                  }}
                >
                  <SelectTrigger id="html-export-theme" aria-label="HTML export theme" className="min-h-10 border-border-color bg-editor-bg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border-color bg-panel-bg">
                    <SelectItem value="light">Light</SelectItem>
                    <SelectItem value="dark">Dark</SelectItem>
                    <SelectItem value="sepia">Sepia</SelectItem>
                    <SelectItem value="high-contrast">High contrast</SelectItem>
                  </SelectContent>
                </Select>
                <div className="mt-1 flex flex-col gap-2">
                  <p className="text-[0.75rem] leading-snug text-text-secondary">
                    {themeStatusText}
                  </p>
                  {showSetFileTheme && (
                    <button
                      type="button"
                      onClick={() => {
                        onSetFileTheme(options.theme);
                        setLocalFileTheme(options.theme);
                      }}
                      className="self-start rounded border border-border-color px-2.5 py-1 text-[0.75rem] font-medium text-text-secondary transition-colors hover:bg-editor-bg hover:text-text-emphasis active:scale-[0.98]"
                    >
                      Set file theme to {themeName}
                    </button>
                  )}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="html-export-font" className="text-text-emphasis">Story typeface</Label>
                <Select
                  value={options.font}
                  onValueChange={(font) => {
                    const nextFont = font as HtmlExportFont;
                    setOptions((current) => ({
                      ...current,
                      font: nextFont,
                    }));
                    onStoryTypefaceChange(nextFont);
                  }}
                >
                  <SelectTrigger id="html-export-font" aria-label="HTML export typeface" className="min-h-10 border-border-color bg-editor-bg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="border-border-color bg-panel-bg">
                    <SelectItem value="serif">Serif</SelectItem>
                    <SelectItem value="sans">Sans</SelectItem>
                    <SelectItem value="mono">Mono</SelectItem>
                  </SelectContent>
                </Select>
                <p className="mt-1 text-[0.75rem] leading-snug text-text-secondary">
                  Shared with Settings. Applies to the story title and reading text.
                </p>
              </div>
            </div>
          </div>

          {/* Options Section */}
          <div className="flex flex-col gap-4">
            <div className="text-[0.875rem] font-semibold tracking-tight text-text-emphasis">Options</div>
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label id="include-readme-label" className="cursor-pointer text-[0.875rem] font-medium text-text-emphasis" onClick={() => setOptions(c => ({...c, includeReadme: !c.includeReadme}))}>
                    Include README
                  </Label>
                  <span className="text-[0.8125rem] leading-snug text-text-secondary">
                    Adds basic hosting and playback instructions to the ZIP.
                  </span>
                </div>
                <Switch
                  id="include-readme-switch"
                  checked={options.includeReadme}
                  aria-labelledby="include-readme-label"
                  onCheckedChange={(checked) => setOptions((current) => ({
                    ...current,
                    includeReadme: checked,
                  }))}
                />
              </div>

              <div className="flex items-center justify-between gap-4">
                <div className="flex flex-col gap-1">
                  <Label id="remember-export-label" className="cursor-pointer text-[0.875rem] font-medium text-text-emphasis" onClick={() => setRememberChoices(c => !c)}>
                    Remember these choices
                  </Label>
                  <span className="text-[0.8125rem] leading-snug text-text-secondary">
                    Reuse this export profile for this InkPad story next time.
                  </span>
                </div>
                <Switch
                  id="remember-export-switch"
                  checked={rememberChoices}
                  aria-labelledby="remember-export-label"
                  onCheckedChange={setRememberChoices}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 text-[0.75rem] leading-snug text-text-secondary">
          Story content is embedded in the HTML. InkJS and web fonts still require an internet connection.
        </div>

        <DialogFooter className="mt-4">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isExporting}
            onClick={() => void handleExport()}
            className="gap-2 bg-success text-editor-bg transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
          >
            <Download className="h-4 w-4" />
            {isExporting ? "Preparing…" : "Download ZIP"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
