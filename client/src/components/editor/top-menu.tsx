import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
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
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Archive, ChevronDown, Download, PenTool, Upload, File, FilePlus2, FolderOpen, Save, SaveAll, Play, Settings, Clock, Menu } from "lucide-react";
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
  // "New ink file" hands focus to the inline rename in the files pane; skip the menu's focus restore.
  const skipNewMenuFocusRestoreRef = useRef(false);

  const getSaveStatusDotClass = () => {
    const baseClass = "h-2 w-2 flex-shrink-0 rounded-full transition-colors duration-200";
    switch (saveState) {
      case "dirty":  return `${baseClass} bg-warning`;
      case "saving": return `${baseClass} animate-pulse bg-accent-blue`;
      case "saved":  return `${baseClass} bg-success`;
      case "error":    return `${baseClass} bg-error`;
      case "disabled": return `${baseClass} bg-warning opacity-70`;
      default:         return `${baseClass} bg-text-secondary opacity-30`;
    }
  };

  const getSaveStatusLabel = () => {
    switch (saveState) {
      case "dirty":  return "Modified";
      case "saving": return "Saving...";
      case "error":    return "Save failed";
      case "disabled": return "Autosave disabled";
      default:         return null; // silence when saved
    }
  };

  const saveLabel = getSaveStatusLabel();

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
    <DropdownMenuContent align="start" className="w-72 bg-panel-bg border-border-color">
      <DropdownMenuItem onClick={onOpen} className="cursor-pointer">
        <FolderOpen className="w-4 h-4" />
        Import .ink, .inkpad, or .zip...
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="flex items-center gap-2 text-text-secondary">
        <Clock className="w-3.5 h-3.5" />
        Recent
      </DropdownMenuLabel>
      {recentFiles.length === 0 ? (
        <DropdownMenuItem disabled>No saved projects</DropdownMenuItem>
      ) : (
        recentFiles.slice(0, 8).map((file) => (
          <DropdownMenuItem
            key={file.name}
            onClick={() => onOpenRecent(file.name)}
            className="cursor-pointer flex-col items-start gap-0.5"
          >
            <span className="flex w-full items-center justify-between gap-3">
              <span className="truncate text-text-emphasis">
                {file.settings?.title ?? file.name.replace(/\.ink$/i, "")}
              </span>
              {file.name === currentSaveFileName && (
                <span className="text-[0.6875rem] text-accent-blue">open</span>
              )}
            </span>
            <span className="text-[0.75rem] text-text-secondary">
              {file.name} · {formatRecentFileTime(file.lastSavedAt ?? file.lastModified)}
            </span>
          </DropdownMenuItem>
        ))
      )}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onManageSaves} className="cursor-pointer">
        <Archive className="w-4 h-4" />
        Manage Projects...
      </DropdownMenuItem>
    </DropdownMenuContent>
  );

  const renderNewMenu = () => {
    if (!onNewFile) {
      return (
        <Button
          variant="ghost"
          size="sm"
          onClick={onNew}
          className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-text-primary hover:bg-accent hover:text-text-emphasis"
        >
          <File className="h-3.5 w-3.5" />
          New
        </Button>
      );
    }

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-text-primary hover:bg-accent hover:text-text-emphasis"
          >
            <FilePlus2 className="h-3.5 w-3.5" />
            New
          </Button>
        </DropdownMenuTrigger>
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
        
        <div className="flex min-w-0 flex-1 items-center gap-1 border-l border-border-color pl-2 md:w-[210px] md:flex-none md:gap-1.5 md:pl-2.5">
          <EditableTitle 
            title={title}
            onTitleChange={onTitleChange}
            className="w-fit min-w-0 md:w-full"
          />
          <div
            className="flex shrink-0 items-center gap-1.5"
            role="status"
            aria-label={saveState === "saved" ? "Saved" : saveLabel ?? saveState}
          >
            <div className={getSaveStatusDotClass()} />
            {saveLabel && (
              <span className={`hidden text-[0.75rem] tabular-nums sm:inline ${
                saveState === "error" ? "text-error" :
                saveState === "saving" ? "text-accent-blue" :
                saveState === "disabled" ? "text-warning" :
                "text-text-secondary"
              }`}>{saveLabel}</span>
            )}
          </div>
        </div>
        
        <div className="hidden items-center gap-0.5 min-[1120px]:flex">
          {renderNewMenu()}
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-text-primary hover:bg-accent hover:text-text-emphasis"
              >
                <FolderOpen className="h-3.5 w-3.5" />
                Open
              </Button>
            </DropdownMenuTrigger>
            {renderRecentFilesMenu()}
          </DropdownMenu>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-text-primary hover:bg-accent hover:text-text-emphasis"
              >
                <Save className="h-3.5 w-3.5" />
                Save
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-40 bg-panel-bg border-border-color">
              <DropdownMenuItem onClick={onSave} className="cursor-pointer">
                <Save className="h-4 w-4" />
                Save
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
      </div>
      
      <div className="hidden items-center gap-2 min-[1120px]:flex">
        <Select onValueChange={handleKnotNavigation}>
          <SelectTrigger
            aria-label="Navigate to knot"
            className="h-8 min-w-[156px] border-border-color bg-panel-bg px-2.5 text-[0.8125rem] text-text-emphasis transition-colors hover:bg-accent focus:border-accent-blue data-[placeholder]:text-text-secondary"
          >
            <SelectValue placeholder="Navigate to knot..." />
          </SelectTrigger>
          <SelectContent className="bg-panel-bg border-border-color">
            {knots.map((knot) => (
              <SelectItem key={knot} value={knot} className="text-text-secondary focus:text-text-emphasis focus:bg-accent cursor-pointer">
                → {knot}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        
        <Button
          onClick={onRun}
          className="h-8 gap-1.5 bg-success px-3.5 text-[0.8125rem] font-semibold text-editor-bg hover:brightness-105"
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          Run
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-1 min-[1120px]:hidden">
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
                <Select onValueChange={handleKnotNavigation}>
                  <SelectTrigger
                    aria-label="Navigate to knot"
                    className="bg-panel-bg text-text-emphasis border-border-color focus:border-accent-blue"
                  >
                    <SelectValue placeholder="Choose knot..." />
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
