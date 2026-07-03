import { useState } from "react";
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
import { Archive, Copy, PenTool, File, FilePlus2, FolderOpen, Save, Play, Settings, Clock, Menu } from "lucide-react";
import { EditableTitle } from "@/components/ui/editable-title";
import { StoryExportDialog } from "./story-export-dialog";
import { PlayableHtmlExportDialog } from "./playable-html-export-dialog";
import type { StoredInkDocument } from "@/lib/file-operations";
import type {
  HtmlExportFont,
  HtmlExportOptions,
  HtmlExportRequest,
  HtmlExportTheme,
} from "@/features/export/html-export-options";
import type { StoryMetadata, ThemeName } from "@/lib/tag-interpreter";

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
  const [isHtmlExportOpen, setIsHtmlExportOpen] = useState(false);

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
        Import .ink from disk...
      </DropdownMenuItem>
      <DropdownMenuItem onClick={onManageSaves} className="cursor-pointer">
        <Archive className="w-4 h-4" />
        Manage local saves...
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="flex items-center gap-2 text-text-secondary">
        <Clock className="w-3.5 h-3.5" />
        Recent
      </DropdownMenuLabel>
      {recentFiles.length === 0 ? (
        <DropdownMenuItem disabled>No saved local drafts</DropdownMenuItem>
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
        <DropdownMenuContent align="start" className="w-52 bg-panel-bg border-border-color">
          <DropdownMenuItem onClick={onNewFile} className="cursor-pointer">
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
          
          <Button
            variant="ghost"
            size="sm"
            onClick={onSave}
            className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-text-primary hover:bg-accent hover:text-text-emphasis"
          >
            <Save className="h-3.5 w-3.5" />
            Save
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={onSaveAs}
            className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-text-primary hover:bg-accent hover:text-text-emphasis"
          >
            <Copy className="h-3.5 w-3.5" />
            Save As
          </Button>

          <div className="mx-1 h-4 w-px bg-border-color" />
          
          <StoryExportDialog
            onExportInk={onExportInk}
            onExportProject={onExportProject}
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
          <Play className="h-3.5 w-3.5" />
          Run
        </Button>
      </div>

      <div className="flex shrink-0 items-center gap-1 min-[1120px]:hidden">
        <Button
          onClick={onRun}
          size="sm"
          className="h-8 gap-1 bg-success px-2.5 text-[0.8125rem] font-semibold text-editor-bg hover:brightness-105"
        >
          <Play className="h-3.5 w-3.5" />
          Run
        </Button>

        <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
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
          <SheetContent side="right" className="w-[86vw] max-w-sm bg-panel-bg border-border-color p-4 pt-12 text-text-primary">
            <SheetHeader>
              <SheetTitle className="sr-only">Menu</SheetTitle>
              <SheetDescription className="sr-only">
                File, export, navigation, and settings actions.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4">
              <div className="grid gap-2">
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="justify-start gap-2">
                      <FolderOpen className="h-4 w-4" />
                      Open
                    </Button>
                  </DropdownMenuTrigger>
                  {renderRecentFilesMenu()}
                </DropdownMenu>
                <SheetClose asChild>
                  <Button variant="ghost" onClick={onSave} className="justify-start gap-2">
                    <Save className="h-4 w-4" />
                    Save
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button variant="ghost" onClick={onSaveAs} className="justify-start gap-2">
                    <Copy className="h-4 w-4" />
                    Save As
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button variant="ghost" onClick={onManageSaves} className="justify-start gap-2">
                    <Archive className="h-4 w-4" />
                    Local saves
                  </Button>
                </SheetClose>
              </div>

              <div className="border-t border-border-color pt-4">
                <div className="mb-2 px-3 text-[0.75rem] font-medium uppercase tracking-[0.08em] text-text-secondary">
                  Export
                </div>
                <div className="grid gap-2">
                  <SheetClose asChild>
                    <Button variant="ghost" onClick={onExportInk} disabled={isExporting} className="justify-start">
                      Current .ink file
                    </Button>
                  </SheetClose>
                  {hasMultipleFiles && onExportProject && (
                    <SheetClose asChild>
                      <Button variant="ghost" onClick={onExportProject} disabled={isExporting} className="justify-start">
                        Full .inkpad project
                      </Button>
                    </SheetClose>
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
                </div>
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

              <div className="grid gap-2 border-t border-border-color pt-4">
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
