import { forwardRef, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useMediaQuery } from "@/hooks/use-media-query";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Shortcut } from "@/components/ui/kbd";
import { toAriaKeyShortcuts } from "@/lib/keyboard-shortcuts";
import { Archive, ChevronDown, Download, Loader2, PenTool, Upload, File, FilePlus2, FolderOpen, ListTree, Save, SaveAll, Play, Settings, Clock, Menu, type LucideIcon } from "lucide-react";
import type { ShortcutKey } from "@/lib/keyboard-shortcuts";
import { EditableTitle } from "@/components/ui/editable-title";
import { StoryExportMenu } from "./story-export-menu";
import { PlayableHtmlExportDialog } from "./playable-html-export-dialog";
import type { StoredInkDocument } from "@/lib/file-operations";
import type {
  HtmlExportFont,
  HtmlExportOptions,
  HtmlExportRequest,
  HtmlExportTheme,
} from "@/features/export/html-export-options";
import type { StoryMetadata, ThemeName } from "@/lib/tag-interpreter";


/** Inline expand/collapse row for the mobile menu. Items render in the drawer, not a popover. */
function MobileMenuDisclosure({
  id,
  icon,
  label,
  open,
  onToggle,
  children,
}: {
  id: string;
  icon: React.ReactNode;
  label: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Button
        variant="ghost"
        aria-expanded={open}
        aria-controls={id}
        onClick={onToggle}
        className="w-full justify-start gap-2"
      >
        {icon}
        {label}
        <ChevronDown
          className={cn(
            "ml-auto h-4 w-4 text-text-secondary transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </Button>
      <div id={id} className={cn("gap-1 pl-6 pt-1", open ? "grid" : "hidden")}>
        {children}
      </div>
    </div>
  );
}

/**
 * Desktop toolbar tiers. Above 1120px every action keeps its text label;
 * between md and 1120px the same actions render icon-only (with tooltips)
 * so nothing has to be hidden behind the hamburger.
 */
export type ToolbarVariant = "labels" | "icons";

interface ToolbarActionButtonProps extends ComponentPropsWithoutRef<typeof Button> {
  icon: LucideIcon;
  label: string;
  showLabel: boolean;
}

/** One toolbar action, rendered with or without its text label. */
const ToolbarActionButton = forwardRef<HTMLButtonElement, ToolbarActionButtonProps>(
  ({ icon: Icon, label, showLabel, className, ...props }, ref) => (
    <Button
      ref={ref}
      variant="ghost"
      size="sm"
      aria-label={showLabel ? undefined : label}
      className={cn(
        "text-[0.8125rem] text-text-primary hover:bg-accent hover:text-text-emphasis data-[state=open]:bg-accent data-[state=open]:text-text-emphasis",
        showLabel ? "h-8 gap-1.5 px-2.5" : "h-8 w-8 p-0",
        className,
      )}
      {...props}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {showLabel ? label : null}
    </Button>
  ),
);
ToolbarActionButton.displayName = "ToolbarActionButton";

/** Wraps a trigger in a Tooltip only when the button has no visible label. */
function ToolbarTooltip({
  enabled,
  label,
  shortcut,
  children,
}: {
  enabled: boolean;
  label: string;
  shortcut?: readonly ShortcutKey[];
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="bottom" shortcut={shortcut}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

interface TopMenuProps {
  title: string;
  knots: string[];
  onNew: () => void;
  onNewFile?: () => void;
  onOpen: () => void;
  recentFiles: StoredInkDocument[];
  currentFileName: string;
  currentSaveFileName?: string;
  exportMetadata: StoryMetadata;
  savedHtmlExport?: HtmlExportOptions;
  storyTypeface: HtmlExportFont;
  onOpenRecent: (fileName: string) => void;
  onSave: () => void;
  onSaveAs: () => void;
  onManageSaves: () => void;
  onTitleChange: (newTitle: string) => void;
  onRun: () => void;
  onOpenSettings: () => void;
  onExportInk: () => void | Promise<void>;
  onExportProject?: () => void | Promise<void>;
  onExportProjectZip?: () => void | Promise<void>;
  onExportJson: () => void | Promise<void>;
  resolvedTheme: ThemeName;
  resolvedFromSystem: boolean;
  onExportHtml: (request: HtmlExportRequest) => void | Promise<void>;
  onSetFileTheme: (theme: HtmlExportTheme) => void;
  onStoryTypefaceChange: (font: HtmlExportFont) => void;
  isExporting?: boolean;
  hasMultipleFiles?: boolean;
  onNavigateToKnot?: (knotName: string) => void;
  saveState?: "dirty" | "saving" | "saved" | "error" | "disabled";
}

export function TopMenu({
  title,
  knots,
  onNew,
  onNewFile,
  onOpen,
  recentFiles,
  currentFileName,
  currentSaveFileName = currentFileName,
  exportMetadata,
  savedHtmlExport,
  storyTypeface,
  onOpenRecent,
  onSave,
  onSaveAs,
  onManageSaves,
  onTitleChange,
  onRun,
  onOpenSettings,
  onExportInk,
  onExportProject,
  onExportProjectZip,
  onExportJson,
  resolvedTheme,
  resolvedFromSystem,
  onExportHtml,
  onSetFileTheme,
  onStoryTypefaceChange,
  isExporting = false,
  hasMultipleFiles = false,
  onNavigateToKnot,
  saveState = "saved"
}: TopMenuProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileExportOpen, setIsMobileExportOpen] = useState(false);
  const [isMobileOpenOpen, setIsMobileOpenOpen] = useState(false);
  const [isHtmlExportOpen, setIsHtmlExportOpen] = useState(false);
  // Three toolbar tiers: labels (>=1120px), icon-only (md..1120px), and the
  // Run + hamburger sheet below md.
  const hasDesktopToolbar = useMediaQuery("(min-width: 768px)");
  const hasToolbarLabels = useMediaQuery("(min-width: 1120px)");
  const hasRunLabel = useMediaQuery("(min-width: 900px)");
  const toolbarVariant: ToolbarVariant = hasToolbarLabels ? "labels" : "icons";
  const showLabels = toolbarVariant === "labels";
  const showRunLabel = hasToolbarLabels || hasRunLabel;
  // "New ink file" hands focus to the inline rename in the files pane; skip the menu's focus restore.
  const skipNewMenuFocusRestoreRef = useRef(false);

  // One dot next to the title; the label lives in a tooltip. Green when saved.
  const getSaveStatus = () => {
    switch (saveState) {
      case "dirty":    return { label: "Unsaved changes", dot: "bg-warning" };
      case "saving":   return { label: "Saving\u2026", dot: null };
      case "error":    return { label: "Save failed", dot: "bg-error" };
      case "disabled": return { label: "Autosave disabled", dot: "bg-warning opacity-70" };
      default:         return { label: "Saved", dot: "bg-success" };
    }
  };

  const saveStatus = getSaveStatus();

  const hasKnots = knots.length > 0;

  const handleKnotNavigation = (knotName: string) => {
    if (knotName && onNavigateToKnot) {
      onNavigateToKnot(knotName);
    }
  };

  const formatRecentFileTime = (timestamp: number) => {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(timestamp));
  };

  const renderRecentFilesMenu = () => (
    <DropdownMenuContent align="start" className="w-[288px] border-border-color bg-panel-bg p-1.5 shadow-md">
      <DropdownMenuItem
        onClick={onOpen}
        className="group flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 focus:bg-accent"
      >
        <FolderOpen className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary transition-colors group-focus:text-text-emphasis" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[0.875rem] font-medium leading-tight text-text-emphasis">Open from disk…</span>
          <span className="text-[0.75rem] leading-snug text-text-secondary">.ink, .inkpad, or .zip</span>
        </div>
        <DropdownMenuShortcut className="mt-0.5 pl-2">
          <Shortcut keys={["mod", "o"]} />
        </DropdownMenuShortcut>
      </DropdownMenuItem>

      <DropdownMenuSeparator className="my-1 bg-border-color/60" />

      <DropdownMenuLabel className="flex items-center gap-1.5 px-2 pb-1 pt-2 text-[0.75rem] font-medium uppercase tracking-[0.05em] text-text-secondary">
        <Clock className="h-3.5 w-3.5" aria-hidden="true" />
        Recent
      </DropdownMenuLabel>
      {recentFiles.length === 0 ? (
        <DropdownMenuItem disabled className="px-2 py-1.5 text-[0.8125rem] text-text-secondary">
          No saved projects yet
        </DropdownMenuItem>
      ) : (
        recentFiles.slice(0, 8).map((file) => {
          const isCurrent = file.name === currentSaveFileName;
          return (
            <DropdownMenuItem
              key={file.name}
              onClick={() => onOpenRecent(file.name)}
              className="group flex cursor-pointer flex-col items-stretch gap-0.5 rounded-md px-2 py-1.5 focus:bg-accent"
            >
              <span className="flex min-w-0 items-center justify-between gap-3">
                <span className="truncate text-[0.875rem] font-medium leading-tight text-text-emphasis">
                  {file.settings?.title ?? file.name.replace(/\.ink$/i, "")}
                </span>
                {isCurrent && (
                  <span className="shrink-0 rounded-full border border-accent-blue/40 bg-accent-blue/10 px-1.5 py-px text-[0.625rem] font-medium uppercase tracking-[0.05em] leading-4 text-accent-blue">
                    Open
                  </span>
                )}
              </span>
              <span className="flex min-w-0 items-center gap-1.5 text-[0.75rem] leading-snug text-text-secondary">
                <span className="truncate">{file.name}</span>
                <span aria-hidden="true">·</span>
                <span className="shrink-0 tabular-nums">{formatRecentFileTime(file.lastSavedAt ?? file.lastModified)}</span>
              </span>
            </DropdownMenuItem>
          );
        })
      )}

      <DropdownMenuSeparator className="my-1 bg-border-color/60" />

      <DropdownMenuItem
        onClick={onManageSaves}
        className="group flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 focus:bg-accent"
      >
        <Archive className="h-4 w-4 shrink-0 text-text-secondary transition-colors group-focus:text-text-emphasis" />
        <span className="text-[0.875rem] font-medium leading-tight text-text-emphasis">Manage projects…</span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  const renderNewMenu = () => {
    if (!onNewFile) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <ToolbarActionButton
              icon={File}
              label="New"
              showLabel={showLabels}
              onClick={onNew}
              aria-label="New project"
              aria-keyshortcuts={toAriaKeyShortcuts(["mod", "n"])}
            />
          </TooltipTrigger>
          <TooltipContent side="bottom" shortcut={["mod", "n"]}>New project</TooltipContent>
        </Tooltip>
      );
    }

    return (
      <DropdownMenu>
        <ToolbarTooltip enabled={!showLabels} label="New">
          <DropdownMenuTrigger asChild>
            <ToolbarActionButton icon={FilePlus2} label="New" showLabel={showLabels} />
          </DropdownMenuTrigger>
        </ToolbarTooltip>
        <DropdownMenuContent
          align="start"
          className="w-52 bg-panel-bg border-border-color"
          onCloseAutoFocus={(event) => {
            if (!skipNewMenuFocusRestoreRef.current) return;
            skipNewMenuFocusRestoreRef.current = false;
            event.preventDefault();
          }}
        >
          <DropdownMenuItem
            onClick={() => {
              skipNewMenuFocusRestoreRef.current = true;
              onNewFile();
            }}
            className="cursor-pointer"
          >
            <FilePlus2 className="h-4 w-4" />
            New ink file
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onNew} className="cursor-pointer">
            <File className="h-4 w-4" />
            New project
            <DropdownMenuShortcut>
              <Shortcut keys={["mod", "n"]} />
            </DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  return (
    <div
      data-testid="top-menu"
      className="flex h-11 items-center justify-between gap-2 overflow-hidden border-b border-border-color bg-panel-bg px-2 md:h-[52px] md:gap-2.5 md:px-3"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 md:gap-2.5">
        <div className="flex shrink-0 items-center gap-1.5 md:gap-2">
          <PenTool className="h-5 w-5 rotate-[-90deg] text-accent-blue" strokeWidth={2.25} />
          <span className="hidden text-[0.9375rem] font-semibold text-text-emphasis min-[360px]:inline">
            inkpad
          </span>
        </div>
        
        <div className="flex min-w-0 flex-1 items-center border-l border-border-color pl-2 md:w-[210px] md:flex-none md:pl-2.5">
          <EditableTitle 
            title={title}
            onTitleChange={onTitleChange}
            className="w-fit min-w-0"
          />
          <Tooltip>
            <TooltipTrigger asChild>
              <span
                className="flex shrink-0 items-center rounded-full p-1"
                tabIndex={0}
                role="status"
                aria-live="polite"
                aria-label={saveStatus.label}
              >
                {saveStatus.dot ? (
                  <span className={`block h-2 w-2 rounded-full transition-colors duration-200 ${saveStatus.dot}`} aria-hidden="true" />
                ) : (
                  <Loader2 className="h-3 w-3 animate-spin text-text-secondary" aria-hidden="true" />
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{saveStatus.label}</TooltipContent>
          </Tooltip>
        </div>
        
        {hasDesktopToolbar && (
        <div className="flex items-center gap-0.5">
          {renderNewMenu()}

          <DropdownMenu>
            <ToolbarTooltip enabled={!showLabels} label="Open" shortcut={["mod", "o"]}>
              <DropdownMenuTrigger asChild>
                <ToolbarActionButton icon={FolderOpen} label="Open" showLabel={showLabels} />
              </DropdownMenuTrigger>
            </ToolbarTooltip>
            {renderRecentFilesMenu()}
          </DropdownMenu>

          <DropdownMenu>
            <ToolbarTooltip enabled={!showLabels} label="Save" shortcut={["mod", "s"]}>
              <DropdownMenuTrigger asChild>
                <ToolbarActionButton icon={Save} label="Save" showLabel={showLabels} />
              </DropdownMenuTrigger>
            </ToolbarTooltip>
            <DropdownMenuContent align="start" className="w-40 bg-panel-bg border-border-color">
              <DropdownMenuItem onClick={onSave} className="cursor-pointer">
                <Save className="h-4 w-4" />
                Save
                <DropdownMenuShortcut>
                  <Shortcut keys={["mod", "s"]} />
                </DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onSaveAs} className="cursor-pointer">
                <SaveAll className="h-4 w-4" />
                Save As...
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="mx-1 h-4 w-px bg-border-color" />
          
          <StoryExportMenu
            onExportInk={onExportInk}
            onExportProject={onExportProject}
            onExportProjectZip={onExportProjectZip}
            onExportJson={onExportJson}
            onConfigureHtml={() => setIsHtmlExportOpen(true)}
            hasMultipleFiles={hasMultipleFiles}
            isExporting={isExporting}
            iconOnly={!showLabels}
          />

          <div className="mx-1 h-4 w-px bg-border-color" />

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                onClick={onOpenSettings}
                className="h-8 w-8 p-0 text-text-primary hover:bg-accent hover:text-text-emphasis"
                aria-label="Open settings"
              >
                <Settings className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Settings</TooltipContent>
          </Tooltip>
        </div>
        )}
      </div>

      {hasDesktopToolbar && (
      <div className="flex shrink-0 items-center gap-2">
        {showLabels ? (
          <Select onValueChange={handleKnotNavigation} disabled={!hasKnots}>
            <SelectTrigger
              aria-label="Navigate to knot"
              className="h-8 min-w-[156px] border-border-color bg-panel-bg px-2.5 text-[0.8125rem] text-text-emphasis transition-colors hover:bg-accent focus:border-accent-blue disabled:opacity-40 data-[placeholder]:text-text-secondary"
            >
              <SelectValue placeholder={hasKnots ? "Navigate to knot..." : "No knots yet"} />
            </SelectTrigger>
            <SelectContent className="bg-panel-bg border-border-color">
              {knots.map((knot) => (
                <SelectItem key={knot} value={knot} className="text-text-secondary focus:text-text-emphasis focus:bg-accent cursor-pointer">
                  → {knot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : !hasKnots ? (
          // `disabled` would take pointer events with it and swallow the
          // tooltip, so the empty state stays hoverable and explains itself.
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                aria-disabled="true"
                aria-label="Navigate to knot"
                onClick={(event) => event.preventDefault()}
                className="h-8 w-8 cursor-default p-0 text-text-primary opacity-40 hover:bg-transparent hover:text-text-primary"
              >
                <ListTree className="h-4 w-4" aria-hidden="true" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">No knots yet</TooltipContent>
          </Tooltip>
        ) : (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Navigate to knot"
                    className="h-8 w-8 p-0 text-text-primary hover:bg-accent hover:text-text-emphasis data-[state=open]:bg-accent data-[state=open]:text-text-emphasis"
                  >
                    <ListTree className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent side="bottom">Navigate to knot</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="max-h-[60vh] w-56 overflow-y-auto border-border-color bg-panel-bg">
              <DropdownMenuLabel className="px-2 pb-1 pt-2 text-[0.75rem] font-medium uppercase tracking-[0.05em] text-text-secondary">
                Knots
              </DropdownMenuLabel>
              {knots.map((knot) => (
                <DropdownMenuItem
                  key={knot}
                  onClick={() => handleKnotNavigation(knot)}
                  className="cursor-pointer text-text-secondary focus:bg-accent focus:text-text-emphasis"
                >
                  → {knot}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={onRun}
              aria-label="Run story"
              aria-keyshortcuts={toAriaKeyShortcuts(["mod", "enter"])}
              className={cn(
                "h-8 bg-success text-[0.8125rem] font-semibold text-editor-bg hover:brightness-105",
                showRunLabel ? "gap-1.5 px-3.5" : "w-8 p-0",
              )}
            >
              <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
              {showRunLabel ? "Run" : null}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" shortcut={["mod", "enter"]}>Compile and run story</TooltipContent>
        </Tooltip>
      </div>
      )}

      {!hasDesktopToolbar && (
      <div className="flex shrink-0 items-center gap-1">
        <Button
          onClick={onRun}
          size="sm"
          className="h-8 gap-1 bg-success px-2.5 text-[0.8125rem] font-semibold text-editor-bg hover:brightness-105"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Run
        </Button>

        <Sheet
          open={isMobileMenuOpen}
          onOpenChange={(open) => {
            setIsMobileMenuOpen(open);
            if (!open) {
              setIsMobileOpenOpen(false);
              setIsMobileExportOpen(false);
            }
          }}
        >
          <SheetTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-9 w-9 p-0 hover:bg-accent hover:text-accent-foreground"
              aria-label="Open menu"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="right"
            className="flex w-[86vw] max-w-sm flex-col overflow-y-auto overscroll-contain touch-pan-y border-border-color bg-panel-bg p-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(0.75rem,env(safe-area-inset-top))] text-text-primary"
          >
            <SheetHeader className="mb-1 space-y-0 pr-8">
              <SheetTitle className="flex h-6 items-center text-[0.875rem] font-semibold text-text-emphasis">
                Menu
              </SheetTitle>
              <SheetDescription className="sr-only">
                File, export, navigation, and settings actions.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-3">
              <div className="grid gap-1">
                {onNewFile && (
                  <SheetClose asChild>
                    <Button variant="ghost" onClick={onNewFile} className="justify-start gap-2">
                      <FilePlus2 className="h-4 w-4" />
                      New ink file
                    </Button>
                  </SheetClose>
                )}
                <SheetClose asChild>
                  <Button variant="ghost" onClick={onNew} className="justify-start gap-2">
                    <File className="h-4 w-4" />
                    New project
                  </Button>
                </SheetClose>
                <MobileMenuDisclosure
                  id="mobile-open-items"
                  icon={<FolderOpen className="h-4 w-4" />}
                  label="Open"
                  open={isMobileOpenOpen}
                  onToggle={() => setIsMobileOpenOpen((open) => !open)}
                >
                  <SheetClose asChild>
                    <Button variant="ghost" onClick={onOpen} className="justify-start gap-2">
                      <Upload className="h-4 w-4" aria-hidden />
                      Import .ink, .inkpad, or .zip...
                    </Button>
                  </SheetClose>
                  <div className="flex items-center gap-2 px-4 pt-2 text-[0.75rem] font-medium text-text-secondary">
                    <Clock className="h-3.5 w-3.5" aria-hidden />
                    Recent
                  </div>
                  {recentFiles.length === 0 ? (
                    <p className="px-4 py-2 text-[0.8125rem] text-text-secondary">No saved projects</p>
                  ) : (
                    recentFiles.slice(0, 8).map((file) => (
                      <SheetClose asChild key={file.name}>
                        <Button
                          variant="ghost"
                          onClick={() => onOpenRecent(file.name)}
                          className="h-auto flex-col items-start gap-0.5 py-2"
                        >
                          <span className="flex w-full items-center justify-between gap-3">
                            <span className="truncate text-text-emphasis">
                              {file.settings?.title ?? file.name.replace(/\.ink$/i, "")}
                            </span>
                            {file.name === currentSaveFileName && (
                              <span className="text-[0.6875rem] text-accent-blue">open</span>
                            )}
                          </span>
                          <span className="text-[0.75rem] font-normal text-text-secondary">
                            {file.name} · {formatRecentFileTime(file.lastSavedAt ?? file.lastModified)}
                          </span>
                        </Button>
                      </SheetClose>
                    ))
                  )}
                </MobileMenuDisclosure>
                <SheetClose asChild>
                  <Button variant="ghost" onClick={onSave} className="justify-start gap-2">
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button variant="ghost" onClick={onSaveAs} className="justify-start gap-2">
                    <SaveAll className="h-4 w-4" />
                    Save As...
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button variant="ghost" onClick={onManageSaves} className="justify-start gap-2">
                    <Archive className="h-4 w-4" />
                    Manage Projects...
                  </Button>
                </SheetClose>
              </div>

              <div className="border-t border-border-color pt-4">
                <MobileMenuDisclosure
                  id="mobile-export-items"
                  icon={<Download className="h-4 w-4" />}
                  label="Export"
                  open={isMobileExportOpen}
                  onToggle={() => setIsMobileExportOpen((open) => !open)}
                >
                  <SheetClose asChild>
                    <Button variant="ghost" onClick={onExportInk} disabled={isExporting} className="justify-start">
                      Current .ink file
                    </Button>
                  </SheetClose>
                  {hasMultipleFiles && onExportProject && (
                    <>
                      <SheetClose asChild>
                        <Button variant="ghost" onClick={onExportProject} disabled={isExporting} className="justify-start">
                          Full .inkpad project
                        </Button>
                      </SheetClose>
                      {onExportProjectZip && (
                        <SheetClose asChild>
                          <Button variant="ghost" onClick={onExportProjectZip} disabled={isExporting} className="justify-start">
                            Project ZIP
                          </Button>
                        </SheetClose>
                      )}
                    </>
                  )}
                  <SheetClose asChild>
                    <Button variant="ghost" onClick={onExportJson} disabled={isExporting} className="justify-start">
                      JSON
                    </Button>
                  </SheetClose>
                  <Button
                    variant="ghost"
                    disabled={isExporting}
                    className="justify-start"
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsHtmlExportOpen(true);
                    }}
                  >
                    Playable HTML
                  </Button>
                </MobileMenuDisclosure>
              </div>

              <div className="border-t border-border-color pt-4">
                <div className="mb-2 px-3 text-[0.75rem] font-medium uppercase tracking-[0.08em] text-text-secondary">
                  Navigate to knot
                </div>
                <Select onValueChange={handleKnotNavigation} disabled={!hasKnots}>
                  <SelectTrigger
                    aria-label="Navigate to knot"
                    className="bg-panel-bg text-text-emphasis border-border-color focus:border-accent-blue"
                  >
                    <SelectValue placeholder={hasKnots ? "Choose knot..." : "No knots yet"} />
                  </SelectTrigger>
                  <SelectContent className="bg-panel-bg border-border-color">
                    {knots.map((knot) => (
                      <SelectItem key={knot} value={knot} className="text-text-secondary focus:text-text-emphasis focus:bg-accent cursor-pointer">
                        → {knot}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1 border-t border-border-color pt-4">
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenSettings();
                  }}
                  className="justify-start gap-2"
                >
                  <Settings className="h-4 w-4" />
                  Settings
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      )}
      <PlayableHtmlExportDialog
        open={isHtmlExportOpen}
        metadata={exportMetadata}
        savedOptions={savedHtmlExport}
        storyTypeface={storyTypeface}
        resolvedTheme={resolvedTheme}
        resolvedFromSystem={resolvedFromSystem}
        filename={currentFileName}
        isExporting={isExporting}
        onOpenChange={setIsHtmlExportOpen}
        onExport={onExportHtml}
        onSetFileTheme={onSetFileTheme}
        onStoryTypefaceChange={onStoryTypefaceChange}
      />
    </div>
  );
}
