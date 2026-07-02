import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, ExternalLink, RotateCcw } from "lucide-react";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { PreviewMode } from "@/types/story-runtime";
import type { ParsedGlobalTags, MetadataField, ThemeName } from "@/lib/tag-interpreter";
import type { AppTheme, PreviewThemePreference } from "@/types/user-preferences";
import type { HtmlExportFont } from "@/features/export/html-export-options";

interface SettingsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parsedGlobalTags: ParsedGlobalTags;
  currentFileName: string;
  storyTitle: string;
  author: string | null | undefined;
  previewMode: PreviewMode;
  storyTypeface: HtmlExportFont;
  onWriteTag: (field: MetadataField, value: string | null) => void;
  onStoryDetailsChange: (updates: { title?: string; author?: string }) => void;
  onRenameFile: (fileName: string) => void | Promise<void>;
  onPreviewModeChange: (mode: PreviewMode) => void;
  onStoryTypefaceChange: (font: HtmlExportFont) => void;
  onJumpToTagLine: (field: MetadataField) => void;
}

const GITHUB_URL = "https://github.com/mmolarskybeck/InkPad";
const ISSUES_URL = `${GITHUB_URL}/issues/new/choose`;
const NOTICES_URL = `${GITHUB_URL}/blob/main/THIRD_PARTY_NOTICES.md`;

const PREVIEW_THEMES: ThemeName[] = ["light", "dark", "high-contrast", "sepia"];
const STORY_TYPEFACES: Array<{ value: HtmlExportFont; label: string }> = [
  { value: "serif", label: "Serif" },
  { value: "sans", label: "Sans" },
  { value: "mono", label: "Mono" },
];

function capTheme(theme: string): string {
  if (theme === "high-contrast") return "High contrast";
  return theme.charAt(0).toUpperCase() + theme.slice(1);
}

// ─── Small shared atoms ────────────────────────────────────────────────────

function SettingsSection({
  title,
  danger,
  children,
}: {
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4 border-b border-border-color pb-7 last:border-b-0 last:pb-0">
      <h2
        className={cn(
          "text-[0.75rem] font-semibold uppercase tracking-[0.08em]",
          danger ? "text-error" : "text-text-secondary",
        )}
      >
        {title}
      </h2>
      <div className="space-y-5">{children}</div>
    </section>
  );
}

/** Inline `# field:` chip shown when a tag exists in the ink source. */
function TagChip({ field }: { field: string }) {
  const tagName = `# ${field}:`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          className="rounded bg-accent px-1.5 py-0.5 font-mono text-[0.6875rem] font-medium text-accent-blue focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
        >
          {tagName}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-64 text-[0.75rem] leading-5">
        Comes from {tagName} in this ink file.
      </TooltipContent>
    </Tooltip>
  );
}

/** `# field:` in monospace, for use inside pending-state messages. */
function TagCode({ field }: { field: string }) {
  return (
    <code className="rounded bg-editor-bg px-1 py-0.5 font-mono text-[0.6875rem]">
      # {field}:
    </code>
  );
}

/** Link-style button that jumps from Settings to the tag in the ink file. */
function ShowInStoryButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="ml-auto flex items-center gap-1 text-[0.75rem] text-accent-blue hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
    >
      <ArrowUpRight className="h-3 w-3" aria-hidden />
      Show in file
    </button>
  );
}

// ─── MetaField ────────────────────────────────────────────────────────────
// Handles title and author with full pending-state "Add / Update / Remove" flow.

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

  const [draft, setDraft] = useState(value || sourceValue);
  const [announcementMsg, setAnnouncementMsg] = useState("");
  const announcementTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setDraft(value || sourceValue);
  }, [sourceValue, value]);

  const normalizedDraft = draft.trim();
  const isDirty = normalizedDraft !== sourceValue;

  let pendingType: "add" | "update" | "remove" | null = null;
  if (isDirty) {
    if (!hasTag && normalizedDraft !== "") pendingType = "add";
    else if (hasTag && normalizedDraft === "") pendingType = "remove";
    else if (hasTag && normalizedDraft !== "") pendingType = "update";
  }

  const announce = (msg: string) => {
    setAnnouncementMsg(msg);
    if (announcementTimer.current) clearTimeout(announcementTimer.current);
    announcementTimer.current = setTimeout(() => setAnnouncementMsg(""), 3000);
  };

  const handleConfirm = () => {
    if (pendingType === "remove") {
      onValueCommit("");
      onWrite(null);
      announce(`${label} tag removed from this ink file.`);
    } else if (pendingType === "add") {
      onValueCommit(normalizedDraft);
      onWrite(normalizedDraft);
      announce(`${label} tag added to this ink file.`);
    } else if (pendingType === "update") {
      onValueCommit(normalizedDraft);
      onWrite(normalizedDraft);
      announce(`${label} tag updated in this ink file.`);
    }
  };

  const handleUndo = () => {
    setDraft(sourceValue);
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor={id} className="text-[0.875rem] font-medium text-text-emphasis">
          {label}
        </Label>
        {hasTag && <TagChip field={field} />}
        {hasTag && <ShowInStoryButton onClick={onJumpToTag} />}
      </div>

      <Input
        id={id}
        value={draft}
        placeholder={field === "title" ? "Story title" : "Author name"}
        onChange={(e) => setDraft(e.target.value)}
        className="border-border-color bg-editor-bg text-text-emphasis"
      />

      {!isDirty && (
        <p className="text-[0.75rem] leading-5 text-text-secondary">
          {hasTag
            ? "Defined in this ink file."
            : `No # ${field}: tag in this ink file.`}
        </p>
      )}

      {isDirty && pendingType && (
        <div className="space-y-2">
          <div
            className={cn(
              "rounded-[var(--border-radius-md)] px-3 py-2 text-[0.75rem] leading-5",
              pendingType === "remove"
                ? "bg-error/10 text-error"
                : "bg-warning/10 text-warning",
            )}
          >
            {pendingType === "add" && (
              <>
                Will add <TagCode field={field} /> to this ink file.
              </>
            )}
            {pendingType === "update" && (
              <>
                Will update <TagCode field={field} /> in this ink file.
              </>
            )}
            {pendingType === "remove" && (
              <>
                Will remove <TagCode field={field} /> from this ink file.
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              onClick={handleConfirm}
              className={cn(
                "h-7 px-2.5 text-[0.75rem]",
                pendingType === "remove"
                  ? "bg-error text-white hover:brightness-110"
                  : "bg-accent-blue text-white hover:brightness-110",
              )}
            >
              {pendingType === "add" && `Add ${field} tag`}
              {pendingType === "update" && `Update ${field} tag`}
              {pendingType === "remove" && `Remove ${field} tag`}
            </Button>
            <button
              type="button"
              onClick={handleUndo}
              className="text-[0.75rem] text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue rounded"
            >
              Undo
            </button>
          </div>
        </div>
      )}

      <span
        role="status"
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {announcementMsg}
      </span>
    </div>
  );
}

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
  const canRename = isDirty && normalizedDraft.length > 0 && !isRenaming;

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
    <div className="space-y-2">
      <Label
        htmlFor="settings-filename"
        className="text-[0.875rem] font-medium text-text-emphasis"
      >
        File name
      </Label>
      <div className="flex min-w-0 items-stretch">
        <Input
          id="settings-filename"
          value={draftName}
          onChange={(event) => setDraftName(event.target.value.replace(/\.ink$/i, ""))}
          className="min-w-0 rounded-r-none border-border-color bg-editor-bg font-mono text-[0.8125rem] text-text-primary focus-visible:z-10"
        />
        <span
          aria-hidden="true"
          className="flex items-center rounded-r-md border border-l-0 border-border-color bg-muted px-3 font-mono text-[0.8125rem] text-text-secondary"
        >
          .ink
        </span>
      </div>
      {!isDirty && (
        <p className="text-[0.75rem] leading-5 text-text-secondary">
          Used for saves and exports. This can be different from the story title.
        </p>
      )}
      {isDirty && (
        <div className="space-y-2">
          <p className={cn(
            "text-[0.75rem] leading-5",
            normalizedDraft.length === 0 ? "text-error" : "text-text-secondary",
          )}>
            {normalizedDraft.length === 0
              ? "File name cannot be empty."
              : "Renames this local save. Story title stays unchanged."}
          </p>
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="sm"
              disabled={!canRename}
              onClick={handleRename}
              className="h-8 px-3 text-[0.75rem] bg-accent-blue text-white hover:brightness-110 disabled:opacity-45"
            >
              {isRenaming ? "Renaming..." : "Rename file"}
            </Button>
            <button
              type="button"
              onClick={() => setDraftName(sourceBaseName)}
              className="rounded text-[0.75rem] text-text-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
            >
              Undo
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── StoryThemeSection ────────────────────────────────────────────────────
// Story theme first; explicit action writes a portable `# theme:` tag.

interface StoryThemeSectionProps {
  themeTagValue: ThemeName | undefined;
  themeWarningMessage: string | undefined;
  previewTheme: PreviewThemePreference;
  onPreviewThemeChange: (theme: PreviewThemePreference) => void;
  onWriteTag: (value: string | null) => void;
  onJumpToTag: () => void;
}

function StoryThemeSection({
  themeTagValue,
  themeWarningMessage,
  previewTheme,
  onPreviewThemeChange,
  onWriteTag,
  onJumpToTag,
}: StoryThemeSectionProps) {
  const hasTag = themeTagValue !== undefined;
  const selectedName = previewTheme === "inkpad" ? "InkPad theme" : capTheme(previewTheme);
  const hasValidStoryTheme = hasTag && !themeWarningMessage && Boolean(themeTagValue);
  const selectedCanBeSaved = previewTheme !== "inkpad";
  const selectedMatchesStory = selectedCanBeSaved && themeTagValue === previewTheme && !themeWarningMessage;
  const canSaveSelection = selectedCanBeSaved && !selectedMatchesStory;

  let statusTone = "border-border-color bg-editor-bg text-text-secondary";
  let statusText: React.ReactNode;

  if (themeWarningMessage) {
    statusTone = "border-warning/40 bg-warning/10 text-warning";
    statusText = (
      <>
        {themeWarningMessage} Choose a story theme here, or update{" "}
        <TagCode field="theme" /> in this ink file.
      </>
    );
  } else if (previewTheme === "inkpad" && hasValidStoryTheme && themeTagValue) {
    statusText = (
      <>
        Appearance will match selected InkPad theme. <TagCode field="theme" /> is{" "}
        {capTheme(themeTagValue)} in this ink file.
      </>
    );
  } else if (previewTheme === "inkpad") {
    statusText = <>No defined story theme. Appearance will match selected InkPad theme.</>;
  } else if (selectedMatchesStory) {
    statusText = (
      <>
        Story theme: {selectedName}. Defined by <TagCode field="theme" /> in this ink file.
      </>
    );
  } else if (hasValidStoryTheme && themeTagValue) {
    statusText = (
      <>
        Story theme: {selectedName}. <TagCode field="theme" /> is{" "}
        {capTheme(themeTagValue)} in this ink file.
      </>
    );
  } else {
    statusText = (
      <>
        Story theme: {selectedName}. No <TagCode field="theme" /> tag in this ink file.
      </>
    );
  }

  const storyActionLabel = canSaveSelection
    ? `Set # theme: to ${selectedName}`
    : previewTheme === "inkpad" && hasValidStoryTheme
      ? "Remove # theme:"
      : null;
  const storyActionNote = canSaveSelection
    ? hasTag
      ? <>Will update <TagCode field="theme" /> in this ink file.</>
      : <>Will add <TagCode field="theme" /> to this ink file.</>
    : previewTheme === "inkpad" && hasValidStoryTheme
      ? <>Will remove <TagCode field="theme" /> from this ink file.</>
      : null;
  const storyAction = canSaveSelection
    ? () => onWriteTag(previewTheme)
    : previewTheme === "inkpad" && hasValidStoryTheme
      ? () => onWriteTag(null)
      : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Label htmlFor="settings-preview-style" className="text-[0.875rem] font-medium text-text-emphasis">
          Story theme
        </Label>
        {hasTag && !themeWarningMessage && <TagChip field="theme" />}
        {hasTag && !themeWarningMessage && (
          <ShowInStoryButton onClick={onJumpToTag} />
        )}
        {themeWarningMessage && hasTag && (
          <ShowInStoryButton onClick={onJumpToTag} />
        )}
      </div>

      <Select
        value={previewTheme}
        onValueChange={(value) => onPreviewThemeChange(value as PreviewThemePreference)}
      >
        <SelectTrigger
          id="settings-preview-style"
          aria-label="Story theme"
          className="min-h-9 border-border-color bg-editor-bg"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="border-border-color bg-panel-bg">
          <SelectItem value="inkpad">Match InkPad theme</SelectItem>
          {PREVIEW_THEMES.map((t) => (
            <SelectItem key={t} value={t}>
              {capTheme(t)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-2">
        <div
          className={cn(
            "rounded-[var(--border-radius-md)] border px-3 py-2 text-[0.75rem] leading-5",
            statusTone,
          )}
        >
          {statusText}
        </div>

        {storyActionLabel && storyAction && (
          <div className="flex flex-col gap-1.5">
            <Button
              type="button"
              size="sm"
              onClick={storyAction}
              className="h-8 w-fit px-3 text-[0.75rem] bg-accent-blue text-white hover:brightness-110"
            >
              {storyActionLabel}
            </Button>
            <p className="text-[0.6875rem] leading-5 text-text-tertiary">
              {storyActionNote}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main SettingsSheet ───────────────────────────────────────────────────

export function SettingsSheet({
  open,
  onOpenChange,
  parsedGlobalTags,
  currentFileName,
  storyTitle,
  author,
  previewMode,
  storyTypeface,
  onWriteTag,
  onStoryDetailsChange,
  onRenameFile,
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="flex w-[92vw] max-w-lg flex-col overflow-hidden border-border-color bg-panel-bg p-0 text-text-primary"
      >
        <SheetHeader className="shrink-0 border-b border-border-color bg-panel-bg px-5 py-5 pr-12 text-left">
          <SheetTitle className="text-[1.125rem] text-text-emphasis">
            Settings
          </SheetTitle>
          <SheetDescription className="text-[0.8125rem] text-text-secondary">
            Ink tags travel with exported .ink files. Browser preferences stay
            in InkPad.
          </SheetDescription>
        </SheetHeader>

        <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-5 py-6">

          {/* ── Story details ── */}
          <SettingsSection title="Story details">
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
              onValueCommit={(author) => onStoryDetailsChange({ author })}
              onWrite={(v) => onWriteTag("author", v)}
              onJumpToTag={() => onJumpToTagLine("author")}
            />
          </SettingsSection>

          {/* ── File ── */}
          <SettingsSection title="File">
            <FileNameField
              currentFileName={currentFileName}
              onRenameFile={onRenameFile}
            />
          </SettingsSection>

          {/* ── Story Preview ── */}
          <SettingsSection title="Story Preview">
            <StoryThemeSection
              themeTagValue={themeTagValue}
              themeWarningMessage={themeWarning?.message}
              previewTheme={preferences.previewTheme}
              onPreviewThemeChange={(previewTheme) => updatePreferences({ previewTheme })}
              onWriteTag={(v) => onWriteTag("theme", v)}
              onJumpToTag={() => onJumpToTagLine("theme")}
            />

            <div className="space-y-2">
              <Label
                htmlFor="settings-story-typeface"
                className="text-[0.875rem] font-medium text-text-emphasis"
              >
                Story typeface
              </Label>
              <Select
                value={storyTypeface}
                onValueChange={(value) => onStoryTypefaceChange(value as HtmlExportFont)}
              >
                <SelectTrigger
                  id="settings-story-typeface"
                  aria-label="Story typeface"
                  className="min-h-9 border-border-color bg-editor-bg"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border-color bg-panel-bg">
                  {STORY_TYPEFACES.map((typeface) => (
                    <SelectItem key={typeface.value} value={typeface.value}>
                      {typeface.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[0.75rem] leading-5 text-text-secondary">
                Applies to playable HTML exports. The export dialog uses this same value.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="settings-display-mode"
                className="text-[0.875rem] font-medium text-text-emphasis"
              >
                Display mode
              </Label>
              <Select
                value={previewMode}
                onValueChange={(v) => onPreviewModeChange(v as PreviewMode)}
              >
                <SelectTrigger
                  id="settings-display-mode"
                  aria-label="Preview display mode"
                  className="min-h-9 border-border-color bg-editor-bg"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border-color bg-panel-bg">
                  <SelectItem value="transcript">Transcript</SelectItem>
                  <SelectItem value="scene">Scene</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[0.75rem] leading-5 text-text-secondary">
                Transcript shows the path you've played so far. Scene shows only
                the current moment.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="settings-preview-font-size"
                className="text-[0.875rem] font-medium text-text-emphasis"
              >
                Preview font size
              </Label>
              <Select
                value={String(preferences.previewFontSize)}
                onValueChange={(v) =>
                  updatePreferences({
                    previewFontSize: Number(v) as typeof preferences.previewFontSize,
                  })
                }
              >
                <SelectTrigger
                  id="settings-preview-font-size"
                  aria-label="Preview font size"
                  className="min-h-9 border-border-color bg-editor-bg"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border-color bg-panel-bg">
                  {[14, 16, 18, 20, 22].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </SettingsSection>

          {/* ── InkPad appearance ── */}
          <SettingsSection title="InkPad appearance">
            <div className="space-y-2">
              <Label
                htmlFor="settings-inkpad-theme"
                className="text-[0.875rem] font-medium text-text-emphasis"
              >
                InkPad theme
              </Label>
              <Select
                value={preferences.theme}
                onValueChange={(v) => updatePreferences({ theme: v as AppTheme })}
              >
                <SelectTrigger
                  id="settings-inkpad-theme"
                  aria-label="InkPad theme"
                  className="min-h-9 border-border-color bg-editor-bg"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border-color bg-panel-bg">
                  <SelectItem value="system">System</SelectItem>
                  <SelectItem value="light">Light</SelectItem>
                  <SelectItem value="dark">Dark</SelectItem>
                  <SelectItem value="high-contrast">High contrast</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[0.75rem] leading-5 text-text-secondary">
                Changes the InkPad interface. Story theme can be set separately.
              </p>
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="settings-editor-font-size"
                className="text-[0.875rem] font-medium text-text-emphasis"
              >
                Editor font size
              </Label>
              <Select
                value={String(preferences.editorFontSize)}
                onValueChange={(v) =>
                  updatePreferences({
                    editorFontSize: Number(v) as typeof preferences.editorFontSize,
                  })
                }
              >
                <SelectTrigger
                  id="settings-editor-font-size"
                  aria-label="Editor font size"
                  className="min-h-9 border-border-color bg-editor-bg"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="border-border-color bg-panel-bg">
                  {[12, 14, 16, 18, 20].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size} px
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p
                  id="word-wrap-label"
                  className="text-[0.875rem] font-medium text-text-emphasis"
                >
                  Word wrap
                </p>
                <p className="text-[0.75rem] leading-5 text-text-secondary">
                  Show long lines on multiple visual lines.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={preferences.wordWrap}
                aria-labelledby="word-wrap-label"
                onClick={() =>
                  updatePreferences({ wordWrap: !preferences.wordWrap })
                }
                className={cn(
                  "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue",
                  preferences.wordWrap ? "bg-accent-blue" : "bg-border-color",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                    preferences.wordWrap ? "translate-x-5" : "translate-x-0",
                  )}
                />
              </button>
            </div>
          </SettingsSection>

          {/* ── Privacy and data ── */}
          <div ref={privacySectionRef}>
            <SettingsSection title="Privacy and data">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p
                    id="analytics-opt-out-label"
                    className="text-[0.875rem] font-medium text-text-emphasis"
                  >
                    Help improve InkPad with privacy-preserving analytics
                  </p>
                  <p className="mt-1 text-[0.75rem] leading-5 text-text-secondary">
                    InkPad collects aggregate usage data, such as which features
                    are used and whether the app runs successfully. Analytics
                    never include your story text, project names, filenames, or
                    personal information.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={analyticsEnabled}
                  aria-labelledby="analytics-opt-out-label"
                  onClick={() => handleAnalyticsEnabledChange(!analyticsEnabled)}
                  className={cn(
                    "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue",
                    analyticsEnabled ? "bg-accent-blue" : "bg-border-color",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-sm transition-transform duration-200",
                      analyticsEnabled ? "translate-x-5" : "translate-x-0",
                    )}
                  />
                </button>
              </div>
            </SettingsSection>
          </div>

          {/* ── About ── */}
          <SettingsSection title="About">
            <div className="flex items-center justify-between text-[0.875rem]">
              <span className="text-text-emphasis">InkPad</span>
              <span className="font-mono text-[0.75rem] text-text-secondary">
                v{__APP_VERSION__}
              </span>
            </div>
            {(
              [
                ["GitHub", GITHUB_URL],
                ["Report an issue", ISSUES_URL],
                ["Third-party notices", NOTICES_URL],
              ] as const
            ).map(([label, href]) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-11 items-center justify-between rounded-md px-2 text-[0.875rem] text-text-primary hover:bg-accent hover:text-text-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue"
              >
                {label}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
            ))}
          </SettingsSection>

          {/* ── Danger zone ── */}
          <SettingsSection title="Danger zone" danger>
            <div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsResetOpen(true)}
                className="min-h-11 gap-2 border-border-color text-text-primary"
              >
                <RotateCcw className="h-4 w-4" />
                Reset preferences
              </Button>
              <p className="mt-2 text-[0.75rem] leading-5 text-text-secondary">
                Resets InkPad theme, story theme, font sizes, and word wrap to
                defaults. Ink tags and file names stay unchanged.
              </p>
            </div>
          </SettingsSection>
        </div>

        <AlertDialog open={isResetOpen} onOpenChange={setIsResetOpen}>
          <AlertDialogContent className="border-border-color bg-panel-bg text-text-primary">
            <AlertDialogHeader>
              <AlertDialogTitle>
                Reset appearance and editor preferences?
              </AlertDialogTitle>
              <AlertDialogDescription className="text-text-secondary">
                InkPad theme, story theme, font sizes, and word wrap will return to
                their defaults. Ink tags and file names stay unchanged.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <Button
                variant="ghost"
                onClick={() => setIsResetOpen(false)}
              >
                Keep preferences
              </Button>
              <Button
                onClick={() => {
                  resetPreferences();
                  setIsResetOpen(false);
                }}
                className="bg-error text-white hover:brightness-110"
              >
                Reset preferences
              </Button>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}
