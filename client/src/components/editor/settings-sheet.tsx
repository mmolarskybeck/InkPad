import { useEffect, useId, useRef, useState } from "react";
import { ExternalLink, FileText, Info, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isAnalyticsEnabled,
  setAnalyticsEnabled,
  trackPrivacySettingsOpened,
} from "@/lib/analytics";
import { usePreferences } from "@/components/preferences-provider";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PreviewMode } from "@/types/story-runtime";
import type { ParsedGlobalTags, MetadataField, ThemeName } from "@/lib/tag-interpreter";
import type { AppTheme, PreviewThemePreference } from "@/types/user-preferences";
import type { HtmlExportFont } from "@/features/export/html-export-options";

export type SettingsTab = "story" | "inkpad";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Controlled active tab. Keep this in the parent so the sheet reopens on the tab you left. */
  activeTab?: SettingsTab;
  onActiveTabChange?: (tab: SettingsTab) => void;
  parsedGlobalTags: ParsedGlobalTags;
  currentFileName: string;
  storyTitle: string;
  author: string | null | undefined;
  previewMode: PreviewMode;
  storyTypeface: HtmlExportFont;
  onWriteTag: (field: MetadataField, value: string | null) => void;
  onStoryDetailsChange: (updates: { title?: string; author?: string }) => void;
  onRenameFile: (fileName: string) => void | Promise<void>;
  hasMultipleFiles?: boolean;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onStoryTypefaceChange: (font: HtmlExportFont) => void;
  onJumpToTagLine: (field: MetadataField) => void;
}

const GITHUB_URL = "https://github.com/mmolarskybeck/inkpad";
const ISSUES_URL = `${GITHUB_URL}/issues/new/choose`;
const NOTICES_URL = `${GITHUB_URL}/blob/main/THIRD_PARTY_NOTICES.md`;

const PREVIEW_THEMES: ThemeName[] = ["light", "dark", "high-contrast", "sepia"];
const STORY_TYPEFACES: Array<{ value: HtmlExportFont; label: string }> = [
  { value: "serif", label: "Serif" },
  { value: "sans", label: "Sans" },
  { value: "mono", label: "Mono" },
];

const TAB_TRIGGER_CLASS =
  "rounded-none border-b-2 border-transparent bg-transparent px-2.5 pb-2.5 pt-2 text-[0.8125rem] font-medium text-text-secondary shadow-none data-[state=active]:border-accent-blue data-[state=active]:bg-transparent data-[state=active]:text-text-emphasis data-[state=active]:shadow-none";

const LINK_BUTTON_CLASS =
  "font-medium text-accent-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue";

function capTheme(theme: string): string {
  if (theme === "high-contrast") return "High contrast";
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

// ─── Small shared atoms ────────────────────────────────────────────────────

function Group({
  title,
  hint,
  children,
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border-color/60 py-4 first-of-type:border-t-0">
      {title && (
        <div className="mb-1 flex items-baseline gap-2">
          <h3 className="text-[0.8125rem] font-semibold text-text-emphasis">{title}</h3>
          {hint && <span className="text-[0.75rem] text-text-secondary">{hint}</span>}
        </div>
      )}
      <div className="flex flex-col">{children}</div>
    </section>
  );
}

function Row({
  label,
  htmlFor,
  info,
  badge,
  description,
  children,
}: {
  label: string;
  htmlFor?: string;
  info?: React.ReactNode;
  badge?: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={htmlFor} className="text-[0.875rem] font-medium text-text-emphasis">
            {label}
          </Label>
          {badge}
          {info && <InfoTip text={info} label={`About ${label}`} />}
        </div>
        {description && (
          <p className="mt-0.5 text-[0.8125rem] text-text-secondary">{description}</p>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">{children}</div>
    </div>
  );
}

function StackRow({
  label,
  htmlFor,
  info,
  badge,
  description,
  children,
}: {
  label: string;
  htmlFor?: string;
  info?: React.ReactNode;
  badge?: React.ReactNode;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <Label htmlFor={htmlFor} className="text-[0.875rem] font-medium text-text-emphasis">
            {label}
          </Label>
          {badge}
          {info && <InfoTip text={info} label={`About ${label}`} />}
        </div>
        {description && (
          <p className="mt-0.5 text-[0.8125rem] text-text-secondary">{description}</p>
        )}
      </div>
      <div className="flex flex-col">{children}</div>
    </div>
  );
}

function InfoTip({ text, label }: { text: React.ReactNode; label: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className="grid h-5 w-5 place-items-center rounded-full text-text-secondary transition-colors hover:text-accent-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
        >
          <Info className="h-3.5 w-3.5" aria-hidden />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 text-[0.75rem] leading-5">
        {text}
      </TooltipContent>
    </Tooltip>
  );
}

/** Pill shown when the value lives in the ink file; jumps to the tag line. */
function InFileChip({ field, onJump }: { field: string; onJump: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onJump}
          className="inline-flex items-center gap-1 rounded-full bg-accent px-2 py-px text-[0.6875rem] font-medium leading-4 text-accent-blue transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
        >
          <FileText className="h-2.5 w-2.5" aria-hidden />
          In file
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-60 text-[0.75rem] leading-5">
        Written as <code className="font-mono text-accent-blue"># {field}:</code> at the top of
        the file. Click to jump to that line.
      </TooltipContent>
    </Tooltip>
  );
}

function SelectField({
  id,
  ariaLabel,
  value,
  onValueChange,
  options,
  width,
}: {
  id?: string;
  ariaLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  options: Array<{ value: string; label: string }>;
  width?: string;
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        id={id}
        aria-label={ariaLabel}
        className={cn(
          "h-8 border-border-color bg-editor-bg text-[0.8125rem]",
          width ?? "w-[150px]",
        )}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="border-border-color bg-panel-bg">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ─── MetaField ────────────────────────────────────────────────────────────
// Title / author: commits on blur or Enter, with a short-lived Undo.

interface MetaFieldProps {
  field: "title" | "author";
  label: string;
  value: string;
  /** undefined = tag doesn't exist; null = empty author tag; string = tag value */
  tagValue: string | null | undefined;
  onValueCommit: (value: string) => void;
  onWrite: (value: string | null) => void;
  onJumpToTag: () => void;
}

interface LastWrite {
  previousTag: string | null | undefined;
}

function MetaField({
  field,
  label,
  value,
  tagValue,
  onValueCommit,
  onWrite,
  onJumpToTag,
}: MetaFieldProps) {
  const id = useId();
  const hasTag = tagValue !== undefined;
  const sourceValue = tagValue ?? "";

  const [draft, setDraft] = useState(hasTag ? sourceValue : value || sourceValue);
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const [lastWrite, setLastWrite] = useState<LastWrite | null>(null);
  const announcementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // When a tag exists in the ink source it is the source of truth for this
    // field; the stored value only fills in when no tag is present.
    setDraft(hasTag ? sourceValue : value || sourceValue);
  }, [hasTag, sourceValue, value]);

  useEffect(
    () => () => {
      if (announcementTimer.current) clearTimeout(announcementTimer.current);
      if (undoTimer.current) clearTimeout(undoTimer.current);
    },
    [],
  );

  const announce = (msg: string) => {
    setAnnouncementMsg(msg);
    if (announcementTimer.current) clearTimeout(announcementTimer.current);
    announcementTimer.current = setTimeout(() => setAnnouncementMsg(""), 3000);
  };

  const armUndo = (previousTag: string | null | undefined) => {
    setLastWrite({ previousTag });
    if (undoTimer.current) clearTimeout(undoTimer.current);
    undoTimer.current = setTimeout(() => setLastWrite(null), 8000);
  };

  const handleCommit = () => {
    const normalized = draft.trim();
    if (normalized === sourceValue) return;

    const previousTag = tagValue;

    if (normalized === "") {
      if (hasTag) {
        onValueCommit("");
        onWrite(null);
        armUndo(previousTag);
        announce(`${label} removed from file.`);
      } else {
        onValueCommit("");
      }
      return;
    }

    onValueCommit(normalized);
    onWrite(normalized);
    armUndo(previousTag);
    announce(`${label} saved to file.`);
  };

  const handleUndo = () => {
    if (!lastWrite) return;
    const { previousTag } = lastWrite;

    if (previousTag === undefined) {
      onWrite(null);
      onValueCommit("");
    } else {
      onWrite(previousTag ?? "");
      onValueCommit(previousTag ?? "");
    }

    if (undoTimer.current) clearTimeout(undoTimer.current);
    setLastWrite(null);
    announce("Undone.");
  };

  return (
    <StackRow
      label={label}
      htmlFor={id}
      badge={hasTag ? <InFileChip field={field} onJump={onJumpToTag} /> : undefined}
      info={
        field === "title"
          ? "Shown as the story's name in exports."
          : "Shown with the title in exports."
      }
    >
      <Input
        id={id}
        value={draft}
        placeholder={field === "title" ? "Story title" : "Author name"}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={handleCommit}
        onKeyDown={(e) => {
          if (e.key === "Enter") e.currentTarget.blur();
        }}
        className="h-8 border-border-color bg-editor-bg text-[0.875rem] text-text-emphasis"
      />

      {lastWrite && (
        <p className="flex items-center gap-2 text-[0.75rem] text-text-secondary">
          Saved to file.{" "}
          <button type="button" onClick={handleUndo} className={LINK_BUTTON_CLASS}>
            Undo
          </button>
        </p>
      )}

      <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {announcementMsg}
      </span>
    </StackRow>
  );
}

// ─── FileNameField ────────────────────────────────────────────────────────

interface FileNameFieldProps {
  currentFileName: string;
  onRenameFile: (fileName: string) => void | Promise<void>;
}

function getFileBaseName(fileName: string): string {
  return fileName.replace(/\.ink$/i, "");
}

function FileNameField({ currentFileName, onRenameFile }: FileNameFieldProps) {
  const sourceBaseName = getFileBaseName(currentFileName);
  const [draftName, setDraftName] = useState(sourceBaseName);
  const [isRenaming, setIsRenaming] = useState(false);

  useEffect(() => {
    setDraftName(sourceBaseName);
  }, [sourceBaseName]);

  const normalizedDraft = draftName.trim().replace(/\.ink$/i, "");
  const isDirty = normalizedDraft !== sourceBaseName;
  const isEmpty = normalizedDraft.length === 0;
  const canRename = isDirty && !isEmpty && !isRenaming;

  const handleRename = async () => {
    if (!canRename) return;
    setIsRenaming(true);
    try {
      await onRenameFile(normalizedDraft);
    } finally {
      setIsRenaming(false);
    }
  };

  return (
    <>
      <div className="flex min-w-0 items-stretch">
        <Input
          id="settings-filename"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value.replace(/\.ink$/i, ""))}
          className="h-8 min-w-0 rounded-r-none border-border-color bg-editor-bg font-mono text-[0.8125rem] text-text-primary focus-visible:z-10"
        />
        <span
          aria-hidden="true"
          className="flex items-center rounded-r-md border border-l-0 border-border-color bg-muted px-2.5 font-mono text-[0.8125rem] text-text-secondary"
        >
          .ink
        </span>
      </div>

      {isDirty && isEmpty && (
        <p className="mt-1.5 text-[0.75rem] text-error">File name can&apos;t be empty.</p>
      )}

      {isDirty && !isEmpty && (
        <div className="mt-1.5 flex items-center gap-3">
          <Button
            type="button"
            size="sm"
            disabled={!canRename}
            onClick={handleRename}
            className="h-7 bg-accent-blue px-2.5 text-[0.75rem] text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-45"
          >
            {isRenaming ? "Renaming…" : "Rename"}
          </Button>
          <button
            type="button"
            onClick={() => setDraftName(sourceBaseName)}
            className="rounded text-[0.75rem] font-medium text-text-secondary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
          >
            Undo
          </button>
        </div>
      )}
    </>
  );
}

// ─── StoryThemeRow ────────────────────────────────────────────────────────

interface StoryThemeRowProps {
  themeTagValue: ThemeName | undefined;
  themeWarningMessage: string | undefined;
  previewTheme: PreviewThemePreference;
  onPreviewThemeChange: (theme: PreviewThemePreference) => void;
  onWriteTag: (value: string | null) => void;
  onJumpToTag: () => void;
}

function StoryThemeRow({
  themeTagValue,
  themeWarningMessage,
  previewTheme,
  onPreviewThemeChange,
  onWriteTag,
  onJumpToTag,
}: StoryThemeRowProps) {
  const hasTag = themeTagValue !== undefined;
  const hasValidTag = hasTag && !themeWarningMessage && Boolean(themeTagValue);

  let status: React.ReactNode = null;
  let statusIsWarning = false;

  if (themeWarningMessage) {
    statusIsWarning = true;
    status = (
      <>
        {themeWarningMessage}{" "}
        <button type="button" onClick={onJumpToTag} className={LINK_BUTTON_CLASS}>
          Show in file
        </button>
      </>
    );
  } else if (previewTheme === "inkpad" && hasValidTag && themeTagValue) {
    status = (
      <>
        File says {capTheme(themeTagValue)}.{" "}
        <button
          type="button"
          onClick={() => onPreviewThemeChange(themeTagValue)}
          className={LINK_BUTTON_CLASS}
        >
          Use it
        </button>
        {" · "}
        <button type="button" onClick={() => onWriteTag(null)} className={LINK_BUTTON_CLASS}>
          Remove from file
        </button>
      </>
    );
  } else if (
    previewTheme !== "inkpad" &&
    hasValidTag &&
    themeTagValue &&
    themeTagValue !== previewTheme
  ) {
    status = (
      <>
        File says {capTheme(themeTagValue)}.{" "}
        <button
          type="button"
          onClick={() => onWriteTag(previewTheme)}
          className={LINK_BUTTON_CLASS}
        >
          Save {capTheme(previewTheme)} to file
        </button>
        {" · "}
        <button
          type="button"
          onClick={() => onPreviewThemeChange(themeTagValue)}
          className={LINK_BUTTON_CLASS}
        >
          Use {capTheme(themeTagValue)}
        </button>
      </>
    );
  } else if (previewTheme !== "inkpad" && !hasTag) {
    status = (
      <>
        Not in file.{" "}
        <button
          type="button"
          onClick={() => onWriteTag(previewTheme)}
          className={LINK_BUTTON_CLASS}
        >
          Save to file
        </button>
      </>
    );
  }

  return (
    <>
      <Row
        label="Theme"
        htmlFor="settings-preview-style"
        badge={
          hasTag && !themeWarningMessage ? (
            <InFileChip field="theme" onJump={onJumpToTag} />
          ) : undefined
        }
        info={
          <>
            How the story looks when played. &ldquo;Match InkPad&rdquo; follows the InkPad theme
            instead.
          </>
        }
      >
        <SelectField
          id="settings-preview-style"
          ariaLabel="Story theme"
          value={previewTheme}
          onValueChange={(value) => onPreviewThemeChange(value as PreviewThemePreference)}
          options={[
            { value: "inkpad", label: "Match InkPad" },
            ...PREVIEW_THEMES.map((theme) => ({ value: theme, label: capTheme(theme) })),
          ]}
        />
      </Row>

      {status && (
        <p
          className={cn(
            "pb-2 text-[0.75rem] leading-5",
            statusIsWarning ? "text-warning" : "text-text-secondary",
          )}
        >
          {status}
        </p>
      )}
    </>
  );
}

// ─── Main SettingsSheet ───────────────────────────────────────────────────

export function SettingsSheet({
  open,
  onOpenChange,
  activeTab = "story",
  onActiveTabChange,
  parsedGlobalTags,
  currentFileName,
  storyTitle,
  author,
  previewMode,
  storyTypeface,
  onWriteTag,
  onStoryDetailsChange,
  onRenameFile,
  hasMultipleFiles = false,
  onPreviewModeChange,
  onStoryTypefaceChange,
  onJumpToTagLine,
}: SettingsSheetProps) {
  const { preferences, updatePreferences, resetPreferences } = usePreferences();
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [analyticsEnabled, setAnalyticsEnabledState] = useState(isAnalyticsEnabled);
  const privacySectionRef = useRef<HTMLDivElement | null>(null);
  const privacyTrackedThisOpenRef = useRef(false);

  const { metadata, warnings } = parsedGlobalTags;

  // Title tag: undefined = no tag, string = tag value
  const titleTagValue: string | undefined = metadata.title;

  // Author tag: undefined = no tag, null = empty tag, string = tag value
  const authorTagValue: string | null | undefined = Object.prototype.hasOwnProperty.call(
    metadata,
    "author",
  )
    ? (metadata.author ?? null)
    : undefined;

  const themeTagValue: ThemeName | undefined = metadata.theme;
  const themeWarning = warnings.find((w) => w.field === "theme");

  useEffect(() => {
    if (!open) {
      privacyTrackedThisOpenRef.current = false;
      return;
    }

    setAnalyticsEnabledState(isAnalyticsEnabled());
  }, [open]);

  useEffect(() => {
    if (!open || !privacySectionRef.current) return;

    if (typeof IntersectionObserver === "undefined") {
      if (!privacyTrackedThisOpenRef.current) {
        privacyTrackedThisOpenRef.current = true;
        trackPrivacySettingsOpened();
      }
      return;
    }

    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting && !privacyTrackedThisOpenRef.current) {
        privacyTrackedThisOpenRef.current = true;
        trackPrivacySettingsOpened();
      }
    }, { threshold: 0.4 });

    observer.observe(privacySectionRef.current);
    return () => observer.disconnect();
  }, [open]);

  const handleAnalyticsEnabledChange = (enabled: boolean) => {
    setAnalyticsEnabled(enabled);
    setAnalyticsEnabledState(enabled);
  };

  const aboutLinks = [
    ["GitHub", GITHUB_URL],
    ["Report a bug", ISSUES_URL],
    ["Third-party notices", NOTICES_URL],
  ] as const;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[92vw] max-w-lg flex-col overflow-hidden border-border-color bg-panel-bg p-0 text-text-primary"
      >
        <Tabs
          value={activeTab}
          onValueChange={(value) => onActiveTabChange?.(value as SettingsTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <SheetHeader className="shrink-0 border-b border-border-color px-5 pt-5 pr-12 text-left">
            <SheetTitle className="text-[1.0625rem] font-semibold tracking-tight text-text-emphasis">
              Settings
            </SheetTitle>
            <SheetDescription className="sr-only">
              Story settings are saved in the .ink file. InkPad settings are saved in this
              browser.
            </SheetDescription>
            <TabsList className="mt-3 h-auto justify-start gap-1 rounded-none border-0 bg-transparent p-0">
              <TabsTrigger value="story" className={TAB_TRIGGER_CLASS}>
                Story
              </TabsTrigger>
              <TabsTrigger value="inkpad" className={TAB_TRIGGER_CLASS}>
                InkPad
              </TabsTrigger>
            </TabsList>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
            {/* ── Story ── */}
            <TabsContent value="story" className="mt-0 focus-visible:outline-none">
              <p className="pt-4 text-[0.8125rem] text-text-secondary">
                Saved in your .ink file, so they travel with the story.
              </p>

              <Group>
                <MetaField
                  field="title"
                  label="Title"
                  value={storyTitle}
                  tagValue={titleTagValue}
                  onValueCommit={(title) => onStoryDetailsChange({ title })}
                  onWrite={(v) => onWriteTag("title", v)}
                  onJumpToTag={() => onJumpToTagLine("title")}
                />

                <MetaField
                  field="author"
                  label="Author"
                  value={author ?? ""}
                  tagValue={authorTagValue}
                  onValueCommit={(nextAuthor) => onStoryDetailsChange({ author: nextAuthor })}
                  onWrite={(v) => onWriteTag("author", v)}
                  onJumpToTag={() => onJumpToTagLine("author")}
                />

                <StackRow
                  label="File name"
                  htmlFor="settings-filename"
                  info={
                    hasMultipleFiles
                      ? "Renames this file only. The project name is set in the toolbar."
                      : "Used when saving and exporting. Can be different from the title."
                  }
                >
                  <FileNameField
                    currentFileName={currentFileName}
                    onRenameFile={onRenameFile}
                  />
                </StackRow>
              </Group>

              <Group title="Reading" hint="how the story looks when played">
                <StoryThemeRow
                  themeTagValue={themeTagValue}
                  themeWarningMessage={themeWarning?.message}
                  previewTheme={preferences.previewTheme}
                  onPreviewThemeChange={(previewTheme) => updatePreferences({ previewTheme })}
                  onWriteTag={(v) => onWriteTag("theme", v)}
                  onJumpToTag={() => onJumpToTagLine("theme")}
                />

                <Row
                  label="Typeface"
                  htmlFor="settings-story-typeface"
                  info="Used in the preview and in exported HTML."
                >
                  <SelectField
                    id="settings-story-typeface"
                    ariaLabel="Story typeface"
                    value={storyTypeface}
                    onValueChange={(value) => onStoryTypefaceChange(value as HtmlExportFont)}
                    options={STORY_TYPEFACES}
                  />
                </Row>
              </Group>
            </TabsContent>

            {/* ── InkPad ── */}
            <TabsContent value="inkpad" className="mt-0 focus-visible:outline-none">
              <p className="pt-4 text-[0.8125rem] text-text-secondary">
                Saved in this browser. Stories are not affected.
              </p>

              <Group title="Appearance">
                <Row label="Theme" htmlFor="settings-inkpad-theme">
                  <SelectField
                    id="settings-inkpad-theme"
                    ariaLabel="InkPad theme"
                    value={preferences.theme}
                    onValueChange={(v) => updatePreferences({ theme: v as AppTheme })}
                    options={[
                      { value: "system", label: "System" },
                      { value: "light", label: "Light" },
                      { value: "dark", label: "Dark" },
                      { value: "high-contrast", label: "High contrast" },
                    ]}
                  />
                </Row>
              </Group>

              <Group title="Editor">
                <Row label="Font size" htmlFor="settings-editor-font-size">
                  <SelectField
                    id="settings-editor-font-size"
                    ariaLabel="Editor font size"
                    value={String(preferences.editorFontSize)}
                    onValueChange={(v) =>
                      updatePreferences({
                        editorFontSize: Number(v) as typeof preferences.editorFontSize,
                      })
                    }
                    options={[12, 14, 16, 18, 20].map((size) => ({
                      value: String(size),
                      label: `${size} px`,
                    }))}
                    width="w-[96px]"
                  />
                </Row>

                <div className="flex min-h-11 items-center justify-between gap-4 py-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        id="word-wrap-label"
                        className="text-[0.875rem] font-medium text-text-emphasis"
                      >
                        Word wrap
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      id="word-wrap-switch"
                      checked={preferences.wordWrap}
                      aria-labelledby="word-wrap-label"
                      onCheckedChange={(checked) => updatePreferences({ wordWrap: checked })}
                    />
                  </div>
                </div>

                <div className="flex min-h-11 items-center justify-between gap-4 py-1">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span
                        id="variables-inspector-label"
                        className="text-[0.875rem] font-medium text-text-emphasis"
                        title="Show the Variables tab in the bottom dock"
                      >
                        Variables inspector
                      </span>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Switch
                      id="variables-inspector-switch"
                      checked={preferences.showVariablesInspector}
                      aria-labelledby="variables-inspector-label"
                      onCheckedChange={(checked) => updatePreferences({ showVariablesInspector: checked })}
                    />
                  </div>
                </div>

              </Group>

              <Group title="Preview">
                <Row
                  label="Show"
                  htmlFor="settings-display-mode"
                  info="Full transcript shows everything you've read so far. Current scene shows only the latest passage."
                >
                  <SelectField
                    id="settings-display-mode"
                    ariaLabel="Preview display mode"
                    value={previewMode}
                    onValueChange={(v) => onPreviewModeChange(v as PreviewMode)}
                    options={[
                      { value: "transcript", label: "Full transcript" },
                      { value: "scene", label: "Current scene" },
                    ]}
                  />
                </Row>

                <Row label="Font size" htmlFor="settings-preview-font-size">
                  <SelectField
                    id="settings-preview-font-size"
                    ariaLabel="Preview font size"
                    value={String(preferences.previewFontSize)}
                    onValueChange={(v) =>
                      updatePreferences({
                        previewFontSize: Number(v) as typeof preferences.previewFontSize,
                      })
                    }
                    options={[14, 16, 18, 20, 22].map((size) => ({
                      value: String(size),
                      label: `${size} px`,
                    }))}
                    width="w-[96px]"
                  />
                </Row>
              </Group>

              {/* The wrapper carries the divider because the Group inside it is
                  its parent's first section. */}
              <div ref={privacySectionRef} className="border-t border-border-color/60">
                <Group title="Privacy">
                  <div className="flex min-h-11 items-center justify-between gap-4 py-1">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          id="analytics-opt-out-label"
                          className="text-[0.875rem] font-medium text-text-emphasis"
                        >
                          Share anonymous usage stats
                        </span>
                      </div>
                      <p className="mt-0.5 text-[0.8125rem] text-text-secondary">
                        Never includes story text or file names.
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <Switch
                        id="analytics-opt-out-switch"
                        checked={analyticsEnabled}
                        aria-labelledby="analytics-opt-out-label"
                        onCheckedChange={handleAnalyticsEnabledChange}
                      />
                    </div>
                  </div>
                </Group>
              </div>

              <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-border-color/60 pt-4">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="font-mono text-[0.75rem] text-text-secondary">
                    InkPad v{__APP_VERSION__}
                  </p>
                  <nav aria-label="About">
                    {aboutLinks.map(([label, href], index) => (
                      <span key={href}>
                        {index > 0 && (
                          <span aria-hidden className="text-text-secondary">
                            {" · "}
                          </span>
                        )}
                        <a
                          href={href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[0.75rem] text-accent-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
                        >
                          {label}
                          <ExternalLink className="ml-0.5 inline h-2.5 w-2.5" aria-hidden />
                        </a>
                      </span>
                    ))}
                  </nav>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsResetOpen(true)}
                  className="h-8 gap-1.5 border-border-color text-[0.8125rem] text-text-primary"
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  Reset to defaults
                </Button>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <AlertDialog open={isResetOpen} onOpenChange={setIsResetOpen}>
          <AlertDialogContent className="border-border-color bg-panel-bg text-text-primary">
            <AlertDialogHeader>
              <AlertDialogTitle>Reset InkPad settings?</AlertDialogTitle>
              <AlertDialogDescription className="text-text-secondary">
                Theme, font sizes, word wrap, and story preview theme go back to their defaults.
                Your .ink files are not changed.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button variant="ghost" onClick={() => setIsResetOpen(false)}>
                Keep settings
              </Button>
              <Button
                onClick={() => {
                  resetPreferences();
                  setIsResetOpen(false);
                }}
                className="bg-error text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98]"
              >
                Reset
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
