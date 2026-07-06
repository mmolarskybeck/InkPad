import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronRight,
  Copy,
  Edit3,
  FileText,
  FolderOpen,
  MoreHorizontal,
  Search,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { EditableTitle } from "@/components/ui/editable-title";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { parseInkProject } from "@/lib/ink-project";
import { cn } from "@/lib/utils";
import type { StoredInkDocument } from "@/lib/file-operations";

interface LocalSavesDialogProps {
  open: boolean;
  files: StoredInkDocument[];
  currentFileName: string;
  storageAvailable?: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenFile: (fileName: string) => void;
  onRenameProject: (fileName: string, nextName: string) => void | Promise<void>;
  onDuplicateFile: (fileName: string) => void;
  onDeleteFile: (fileName: string) => void;
  onDeleteFiles: (fileNames: string[]) => void;
  onExport?: () => void;
}

interface ProjectDisplayInfo {
  fileNames: string[];
  entryFile: string | null;
}

type ProjectSortKey = "project" | "files" | "modified";
type SortDirection = "asc" | "desc";

interface ProjectSort {
  key: ProjectSortKey;
  direction: SortDirection;
}

const projectRowClass = "grid grid-cols-[2.5rem_2.5rem_minmax(0,1fr)] items-center gap-2 sm:grid-cols-[1.75rem_2rem_minmax(12rem,1fr)_4.5rem_7.5rem_6.75rem]";
const projectHeaderClass = "hidden items-center gap-2 sm:grid sm:grid-cols-[1.75rem_2rem_minmax(12rem,1fr)_4.5rem_7.5rem_6.75rem]";
const subfileRowClass = "grid grid-cols-[minmax(0,1fr)] items-center gap-2 pl-[5.5rem] sm:grid-cols-[1.75rem_2rem_minmax(12rem,1fr)_4.5rem_7.5rem_6.75rem] sm:pl-0";

function formatFileTime(timestamp: number): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function getProjectDisplayInfo(content: string): ProjectDisplayInfo {
  try {
    const project = parseInkProject(content);
    return {
      fileNames: Object.keys(project.files).sort((a, b) => {
        if (a === project.entryFile) return -1;
        if (b === project.entryFile) return 1;
        return a.localeCompare(b);
      }),
      entryFile: project.entryFile,
    };
  } catch {
    return {
      fileNames: [],
      entryFile: null,
    };
  }
}

function getDisplayedFileCount(projectInfo: ProjectDisplayInfo): number {
  return projectInfo.fileNames.length > 0 ? projectInfo.fileNames.length : 1;
}

export function LocalSavesDialog({
  open,
  files,
  currentFileName,
  storageAvailable = true,
  onOpenChange,
  onOpenFile,
  onRenameProject,
  onDuplicateFile,
  onDeleteFile,
  onDeleteFiles,
  onExport,
}: LocalSavesDialogProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(() => new Set());
  const [selectedProjects, setSelectedProjects] = useState<Set<string>>(() => new Set());
  const [renameRequest, setRenameRequest] = useState<{ fileName: string; key: number } | null>(null);
  const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<ProjectSort>({ key: "modified", direction: "desc" });
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

  const displayedFiles = useMemo(() => (
    files
      .map((file) => {
        const title = file.settings?.title ?? file.name.replace(/\.ink$/i, "");
        const projectInfo = getProjectDisplayInfo(file.content);
        return { file, title, projectInfo };
      })
      .filter(({ file, title, projectInfo }) => {
        if (!normalizedSearchQuery) return true;
        return [title, file.name, ...projectInfo.fileNames]
          .some((value) => value.toLowerCase().includes(normalizedSearchQuery));
      })
      .sort((a, b) => {
        const directionMultiplier = sort.direction === "asc" ? 1 : -1;
        let comparison = 0;

        if (sort.key === "project") {
          comparison = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
        } else if (sort.key === "files") {
          comparison = getDisplayedFileCount(a.projectInfo) - getDisplayedFileCount(b.projectInfo);
        } else {
          comparison = (a.file.lastSavedAt ?? a.file.lastModified) - (b.file.lastSavedAt ?? b.file.lastModified);
        }

        if (comparison === 0) {
          comparison = a.file.name.localeCompare(b.file.name, undefined, { sensitivity: "base" });
        }

        return comparison * directionMultiplier;
      })
  ), [files, normalizedSearchQuery, sort]);

  const requestSort = (key: ProjectSortKey) => {
    setSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "project" ? "asc" : "desc",
      };
    });
  };

  const toggleProjectExpanded = (fileName: string) => {
    setExpandedProjects((current) => {
      const next = new Set(current);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  };

  const toggleProjectSelected = (fileName: string) => {
    setSelectedProjects((current) => {
      const next = new Set(current);
      if (next.has(fileName)) {
        next.delete(fileName);
      } else {
        next.add(fileName);
      }
      return next;
    });
  };

  useEffect(() => {
    if (open) return;
    setSearchQuery("");
    setSelectedProjects(new Set());
    setExpandedProjects(new Set());
    setRenameRequest(null);
    setIsBulkDeleteConfirmOpen(false);
  }, [open]);

  useEffect(() => {
    const fileNameSet = new Set(files.map((file) => file.name));
    setSelectedProjects((current) => new Set(Array.from(current).filter((fileName) => fileNameSet.has(fileName))));
    setExpandedProjects((current) => new Set(Array.from(current).filter((fileName) => fileNameSet.has(fileName))));
  }, [files]);

  const selectedProjectNames = Array.from(selectedProjects);
  const selectedCount = selectedProjectNames.length;
  const projectCountLabel = `${files.length} ${files.length === 1 ? "project" : "projects"}`;
  const SortHeaderButton = ({
    sortKey,
    children,
    className,
  }: {
    sortKey: ProjectSortKey;
    children: string;
    className?: string;
  }) => {
    const isActive = sort.key === sortKey;
    const SortIcon = isActive
      ? sort.direction === "asc" ? ArrowUp : ArrowDown
      : ArrowUpDown;
    const nextDirection = isActive && sort.direction === "asc" ? "descending" : "ascending";

    return (
      <button
        type="button"
        onClick={() => requestSort(sortKey)}
        className={cn(
          "inline-flex h-7 items-center gap-1 rounded px-1 text-left text-[0.75rem] font-medium transition-colors",
          "hover:bg-editor-bg hover:text-text-emphasis focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-blue focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg",
          isActive ? "text-text-emphasis" : "text-text-secondary",
          className,
        )}
        aria-label={`Sort by ${children} ${nextDirection}`}
      >
        <span>{children}</span>
        <SortIcon className={cn(
          "h-3 w-3 shrink-0",
          isActive ? "text-accent-blue" : "text-text-secondary",
        )} />
      </button>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[82vh] flex-col overflow-hidden border-border-color bg-panel-bg p-0 text-text-primary sm:max-w-3xl">
          <DialogHeader className="shrink-0 border-b border-border-color px-4 pb-3 pr-12 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle className="text-text-emphasis">Projects</DialogTitle>
                  {files.length > 0 && (
                    <span className="text-[0.8125rem] text-text-secondary">
                      {projectCountLabel}
                    </span>
                  )}
                  {selectedCount > 0 && (
                    <div className="ml-1 flex min-h-9 items-center gap-1.5 rounded-full border border-error/35 bg-error/8 py-1 pl-3 pr-1.5 text-[0.8125rem] font-medium text-text-emphasis">
                      <span>{selectedCount} selected</span>
                      <button
                        type="button"
                        onClick={() => setIsBulkDeleteConfirmOpen(true)}
                        className="inline-flex min-h-7 items-center gap-1 rounded-full px-2 text-error transition-colors hover:bg-error/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error/60"
                      >
                        <Trash2 className="h-3 w-3" />
                        <span>Delete</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {files.length > 0 && (
                <div className="relative w-full shrink-0 sm:mr-12 sm:w-[21rem] md:w-[24rem]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary" />
                  <Input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search projects"
                    aria-label="Search projects"
                    className="h-8 border-border-color bg-editor-bg pl-8 pr-2 text-[0.8125rem] text-text-primary placeholder:text-text-secondary focus-visible:ring-1 focus-visible:ring-accent-blue focus-visible:ring-offset-0"
                  />
                </div>
              )}
            </div>
            <DialogDescription className="sr-only">
              Manage projects saved in this browser.
            </DialogDescription>
          </DialogHeader>

          {!storageAvailable && (
            <div className="mx-4 mt-3 flex shrink-0 items-start gap-2 rounded border border-error/30 bg-error/8 px-3 py-2.5 text-[0.8125rem]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-error" />
              <div className="min-w-0">
                <p className="font-medium text-error">Browser storage is unavailable or full</p>
                <p className="mt-0.5 text-text-secondary">Autosave is disabled. Your current work is still active in this session, but you should export before closing this tab.</p>
                {onExport && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onExport}
                    className="mt-1.5 h-7 px-2 text-[0.75rem] text-error hover:bg-error/10 hover:text-error"
                  >
                    Export now
                  </Button>
                )}
              </div>
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
            {files.length === 0 ? (
              <div className="rounded border border-border-color bg-editor-bg p-6 text-center text-[0.875rem] text-text-secondary">
                {storageAvailable ? "No saved projects yet." : "Projects are unavailable in this browser."}
              </div>
            ) : displayedFiles.length === 0 ? (
              <div className="rounded border border-border-color bg-editor-bg p-6 text-center text-[0.875rem] text-text-secondary">
                No matching projects.
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border border-border-color bg-editor-bg">
                <div className={cn(
                  projectHeaderClass,
                  "border-b border-border-color bg-panel-bg px-3 py-2 text-[0.75rem] font-medium text-text-secondary",
                )}>
                  <div className="flex items-center justify-center">
                    <span className="sr-only">Select</span>
                  </div>
                  <div aria-hidden="true" />
                  <div>
                    <SortHeaderButton sortKey="project">Project</SortHeaderButton>
                  </div>
                  <div>
                    <SortHeaderButton sortKey="files">Files</SortHeaderButton>
                  </div>
                  <div>
                    <SortHeaderButton sortKey="modified">Modified</SortHeaderButton>
                  </div>
                  <div className="text-right">Actions</div>
                </div>

                {displayedFiles.map(({ file, title, projectInfo }) => {
                  const isCurrentFile = file.name === currentFileName;
                  const fileCount = projectInfo.fileNames.length;
                  const displayedFileCount = getDisplayedFileCount(projectInfo);
                  const hasSubfiles = fileCount > 1;
                  const isExpanded = expandedProjects.has(file.name);
                  const isSelected = selectedProjects.has(file.name);

                  return (
                    <div
                      key={file.name}
                      className={cn(
                        "group/project min-w-0 border-b border-border-color/80 transition-colors last:border-b-0",
                        "hover:bg-[color-mix(in_srgb,var(--accent-blue)_14%,var(--editor-bg))] [&:has(:focus-visible)]:bg-[color-mix(in_srgb,var(--accent-blue)_16%,var(--editor-bg))]",
                        isSelected && "bg-[color-mix(in_srgb,var(--accent-blue)_22%,var(--editor-bg))]",
                      )}
                    >
                      <div className={cn(projectRowClass, "px-3 py-2.5")}>
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => toggleProjectSelected(file.name)}
                            aria-label={`Select ${title}`}
                            className="h-5 w-5 border-text-secondary/70 bg-panel-bg data-[state=checked]:border-accent-blue data-[state=checked]:bg-accent-blue dark:data-[state=unchecked]:bg-editor-bg"
                          />
                        </div>

                        {hasSubfiles ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleProjectExpanded(file.name)}
                            className="h-10 w-10 shrink-0 p-0 text-text-secondary hover:bg-panel-bg hover:text-text-emphasis focus-visible:bg-panel-bg sm:h-8 sm:w-8"
                            aria-label={`${isExpanded ? "Hide" : "Show"} files for ${title}`}
                            aria-expanded={isExpanded}
                          >
                            <ChevronRight className={cn(
                              "h-4 w-4 transition-transform",
                              isExpanded && "rotate-90",
                            )} />
                          </Button>
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center sm:h-8 sm:w-8" aria-hidden="true">
                            <FileText className="h-3.5 w-3.5 text-text-secondary" />
                          </div>
                        )}

                        <div className="min-w-0">
                          <div className="flex min-w-0 items-center gap-2">
                            <EditableTitle
                              title={title}
                              onTitleChange={(nextTitle) => onRenameProject(file.name, nextTitle)}
                              editTrigger="double-click"
                              editRequestKey={renameRequest?.fileName === file.name ? renameRequest.key : undefined}
                              ariaLabel={`Rename ${title}`}
                              placeholder="Project name..."
                              fallbackTitle={title}
                              normalizeValue={(value) => value.trim() || title}
                              className="-ml-1 h-7 min-w-0 flex-1 justify-start px-1 hover:bg-panel-bg focus-visible:bg-panel-bg md:px-1"
                              inputClassName="h-7 text-[0.9375rem]"
                              textClassName="text-[0.9375rem]"
                            />
                          </div>
                          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[0.75rem] text-text-secondary">
                            <span className="font-mono">{file.name}</span>
                            {isCurrentFile && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-medium text-accent-blue">open</span>
                              </>
                            )}
                            <span className="sm:hidden" aria-hidden="true">·</span>
                            <span className="sm:hidden">
                              {displayedFileCount} {displayedFileCount === 1 ? "file" : "files"}
                            </span>
                            <span className="sm:hidden" aria-hidden="true">·</span>
                            <span className="sm:hidden">
                              {formatFileTime(file.lastSavedAt ?? file.lastModified)}
                            </span>
                          </div>
                        </div>

                        <div className="hidden text-[0.8125rem] tabular-nums text-text-primary sm:block">
                          {displayedFileCount}
                        </div>

                        <div className="hidden truncate text-[0.8125rem] text-text-secondary sm:block">
                          {formatFileTime(file.lastSavedAt ?? file.lastModified)}
                        </div>

                        <div className="col-span-3 flex items-center justify-end gap-1 sm:col-span-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenFile(file.name)}
                            className="h-10 shrink-0 gap-1.5 px-3 text-[0.8125rem] font-medium text-text-primary hover:bg-panel-bg hover:text-text-emphasis focus-visible:bg-panel-bg sm:h-8 sm:px-2"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            Open
                          </Button>

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-10 w-10 shrink-0 p-0 text-text-secondary hover:bg-panel-bg hover:text-text-emphasis focus-visible:bg-panel-bg sm:h-8 sm:w-8"
                                aria-label={`More actions for ${file.name}`}
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44 border-border-color bg-panel-bg">
                              <DropdownMenuItem
                                onClick={() => setRenameRequest((request) => ({
                                  fileName: file.name,
                                  key: (request?.key ?? 0) + 1,
                                }))}
                                className="cursor-pointer"
                              >
                                <Edit3 className="h-4 w-4" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => onDuplicateFile(file.name)} className="cursor-pointer">
                                <Copy className="h-4 w-4" />
                                Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => onDeleteFile(file.name)}
                                className="cursor-pointer text-error focus:text-error"
                              >
                                <Trash2 className="h-4 w-4" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>

                      {hasSubfiles && isExpanded && (
                        <div className="max-h-44 overflow-auto border-t border-border-color bg-panel-bg/70 px-3 py-1.5">
                          {projectInfo.fileNames.map((fileName) => {
                            const isEntryFile = fileName === projectInfo.entryFile;
                            return (
                              <div
                                key={fileName}
                                className={cn(subfileRowClass, "py-1 text-[0.8125rem]")}
                              >
                                <span className="hidden sm:block" aria-hidden="true" />
                                <span className="hidden sm:block" aria-hidden="true" />
                                <div className="flex min-w-0 items-center gap-2">
                                  <FileText className={cn(
                                    "h-3.5 w-3.5 shrink-0",
                                    isEntryFile ? "text-accent-blue" : "text-text-secondary",
                                  )} />
                                  <span className="min-w-0 truncate font-mono text-text-secondary">
                                    {fileName}
                                  </span>
                                  {isEntryFile && (
                                    <span className="shrink-0 rounded-sm bg-accent-blue/15 px-1.5 py-0.5 text-[0.625rem] font-medium leading-none text-accent-blue ring-1 ring-inset ring-accent-blue/20">
                                      entry
                                    </span>
                                  )}
                                </div>
                                <span className="hidden sm:block" aria-hidden="true" />
                                <span className="hidden sm:block" aria-hidden="true" />
                                <span className="hidden sm:block" aria-hidden="true" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isBulkDeleteConfirmOpen} onOpenChange={setIsBulkDeleteConfirmOpen}>
        <AlertDialogContent className="border-border-color bg-panel-bg text-text-primary">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete selected projects?</AlertDialogTitle>
            <AlertDialogDescription className="text-text-secondary">
              {selectedCount === 1
                ? `${selectedProjectNames[0]} and its included Ink files will be removed from this browser. This cannot be undone.`
                : `${selectedCount} projects and their included Ink files will be removed from this browser. This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <Button variant="ghost" onClick={() => setIsBulkDeleteConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                onDeleteFiles(selectedProjectNames);
                setSelectedProjects(new Set());
                setIsBulkDeleteConfirmOpen(false);
              }}
            >
              Delete projects
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
