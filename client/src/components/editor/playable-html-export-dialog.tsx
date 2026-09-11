import { useEffect, useRef, useState, type ReactNode } from "react";
import { Download, Loader2 } from "lucide-react";
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

const FIELD_CLASS = "h-9 border-border-color bg-editor-bg text-[0.875rem] text-text-emphasis";
const LABEL_CLASS = "text-[0.875rem] font-medium text-text-emphasis";

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded border border-border-color/60 bg-editor-bg px-1 py-px font-mono text-[0.6875rem] text-text-primary">
      {children}
    </code>
  );
}

function Section({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3 border-t border-border-color/60 pt-5 first-of-type:border-t-0 first-of-type:pt-0">
      {title && <h3 className="text-[0.8125rem] font-semibold text-text-emphasis">{title}</h3>}
      {children}
    </section>
  );
}

function Hint({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <p id={id} className="text-[0.75rem] leading-5 text-text-secondary">
      {children}
    </p>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  description: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

function ToggleRow({ id, label, description, checked, onCheckedChange }: ToggleRowProps) {
  const descriptionId = `${id}-description`;
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Label htmlFor={id} className={`cursor-pointer ${LABEL_CLASS}`}>
          {label}
        </Label>
        <p id={descriptionId} className="mt-0.5 text-[0.8125rem] leading-5 text-text-secondary">
          {description}
        </p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        aria-describedby={descriptionId}
        className="mt-0.5"
      />
    </div>
  );
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
  const contentRef = useRef<HTMLDivElement>(null);

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
      includeSource: savedOptions?.includeSource ?? DEFAULT_HTML_EXPORT_APPEARANCE.includeSource,
    });
    setRememberChoices(true);
  }, [metadata.author, metadata.theme, metadata.title, open, resolvedTheme, savedOptions, storyTypeface]);

  const update = (patch: Partial<HtmlExportOptions>) =>
    setOptions((current) => ({ ...current, ...patch }));

  const handleExport = async () => {
    if (isExporting) return;
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
  const zipFilename = replaceFilenameExtension(filename, ".zip");

  const themeName = capTheme(options.theme);
  let themeStatusText: ReactNode;
  if (themeMatchesFile) {
    themeStatusText = (
      <>
        Export will use {themeName} from <Code># theme:</Code> in this ink file.
      </>
    );
  } else if (themeIsDefault && localFileTheme === null) {
    themeStatusText = resolvedFromSystem ? (
      <>
        No <Code># theme:</Code> tag in this file. Export will use {themeName}, based on your
        current system setting.
      </>
    ) : (
      <>
        No <Code># theme:</Code> tag in this file. Export will use {themeName}.
      </>
    );
  } else if (localFileTheme !== null) {
    themeStatusText = (
      <>
        Export will use {themeName}. The file&apos;s <Code># theme:</Code> tag stays{" "}
        {capTheme(localFileTheme)} unless you update it.
      </>
    );
  } else {
    themeStatusText = (
      <>
        Export will use {themeName}. This file has no <Code># theme:</Code> tag.
      </>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        ref={contentRef}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        className="flex max-h-[calc(100dvh-2rem)] w-[calc(100vw-2rem)] flex-col gap-0 overflow-hidden border-border-color bg-panel-bg p-0 text-text-primary sm:max-w-lg"
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border-color/60 px-6 pb-4 pr-12 pt-5 text-left">
          <DialogTitle className="text-[1.0625rem] font-semibold tracking-tight text-text-emphasis">
            Export playable HTML
          </DialogTitle>
          <DialogDescription className="text-[0.8125rem] text-text-secondary">
            A ZIP with a standalone index.html that plays this story. The story and Ink runtime are
            embedded, so it works from any host or a local folder.
          </DialogDescription>
        </DialogHeader>

        <form
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void handleExport();
          }}
        >
          <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-5">
            <Section title="Details">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="html-export-title" className={LABEL_CLASS}>
                    Story title
                  </Label>
                  <Input
                    id="html-export-title"
                    value={options.title}
                    placeholder="Untitled Story"
                    onChange={(event) => update({ title: event.target.value })}
                    className={FIELD_CLASS}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="html-export-author" className={LABEL_CLASS}>
                    Author
                  </Label>
                  <Input
                    id="html-export-author"
                    value={options.author}
                    placeholder="No byline"
                    onChange={(event) => update({ author: event.target.value })}
                    className={FIELD_CLASS}
                  />
                </div>
              </div>
              <Hint>Shown on the exported page. Title and author here don&apos;t change the ink file.</Hint>
            </Section>

            <Section title="Appearance">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="html-export-theme" className={LABEL_CLASS}>
                    Theme
                  </Label>
                  <Select
                    value={options.theme}
                    onValueChange={(theme) => update({ theme: theme as HtmlExportTheme })}
                  >
                    <SelectTrigger
                      id="html-export-theme"
                      aria-label="HTML export theme"
                      aria-describedby="html-export-theme-status"
                      className={FIELD_CLASS}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border-color bg-panel-bg">
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                      <SelectItem value="sepia">Sepia</SelectItem>
                      <SelectItem value="high-contrast">High contrast</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="html-export-font" className={LABEL_CLASS}>
                    Story typeface
                  </Label>
                  <Select
                    value={options.font}
                    onValueChange={(font) => {
                      const nextFont = font as HtmlExportFont;
                      update({ font: nextFont });
                      onStoryTypefaceChange(nextFont);
                    }}
                  >
                    <SelectTrigger
                      id="html-export-font"
                      aria-label="HTML export typeface"
                      aria-describedby="html-export-font-hint"
                      className={FIELD_CLASS}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-border-color bg-panel-bg">
                      <SelectItem value="serif">Serif</SelectItem>
                      <SelectItem value="sans">Sans</SelectItem>
                      <SelectItem value="mono">Mono</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Hint id="html-export-theme-status">{themeStatusText}</Hint>
                {showSetFileTheme && (
                  <button
                    type="button"
                    onClick={() => {
                      onSetFileTheme(options.theme);
                      setLocalFileTheme(options.theme);
                    }}
                    className="self-start rounded-md border border-border-color px-2.5 py-1 text-[0.75rem] font-medium text-text-primary transition-colors hover:bg-editor-bg hover:text-text-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-panel-bg active:scale-[0.98]"
                  >
                    Set file theme to {themeName}
                  </button>
                )}
                <Hint id="html-export-font-hint">
                  Typeface is shared with Settings. Fonts load from the web when the page opens.
                </Hint>
              </div>
            </Section>

            <Section title="Add to ZIP">
              <div className="flex flex-col gap-4">
                <ToggleRow
                  id="include-readme-switch"
                  label="Author guide (README.html)"
                  description="How to publish the story and customize its colors and layout."
                  checked={options.includeReadme}
                  onCheckedChange={(includeReadme) => update({ includeReadme })}
                />
                <ToggleRow
                  id="include-source-switch"
                  label="Editable project source"
                  description={
                    <>
                      Adds <Code>source.inkpad</Code> so the export can be reopened in InkPad.
                      Anyone with the ZIP can read the full source, including comments and
                      unpublished content.
                    </>
                  }
                  checked={options.includeSource}
                  onCheckedChange={(includeSource) => update({ includeSource })}
                />
              </div>
            </Section>

            <Section>
              <ToggleRow
                id="remember-export-switch"
                label="Remember these choices"
                description="Start from these settings the next time you export this story."
                checked={rememberChoices}
                onCheckedChange={setRememberChoices}
              />
            </Section>
          </div>

          <DialogFooter className="shrink-0 flex-col gap-3 border-t border-border-color/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
            <p className="min-w-0 truncate text-[0.75rem] leading-5 text-text-secondary">
              Downloads as <Code>{zipFilename}</Code>
            </p>
            <div className="flex shrink-0 justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
                className="text-text-primary hover:text-text-emphasis"
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isExporting} aria-live="polite">
                {isExporting ? <Loader2 className="animate-spin" /> : <Download />}
                {isExporting ? "Preparing…" : "Download ZIP"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
