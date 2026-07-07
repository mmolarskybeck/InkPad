import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight, Copy, File, FilePlus2, FileText, MoreHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditableTitle } from "@/components/ui/editable-title";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const PROJECT_FILES_DRAG_THRESHOLD = 28;
const PROJECT_FILES_MIN_WIDTH = 176;
const PROJECT_FILES_MAX_WIDTH = 352;
const PROJECT_FILES_COLLAPSE_SNAP_WIDTH = 128;
const PROJECT_FILES_CLICK_DRAG_TOLERANCE = 4;

export const PROJECT_FILES_COLLAPSED_WIDTH = 44;
export const PROJECT_FILES_DEFAULT_WIDTH = 224;

function clampProjectFilesPaneWidth(width: number) {
  return Math.min(PROJECT_FILES_MAX_WIDTH, Math.max(PROJECT_FILES_MIN_WIDTH, width));
}

interface ProjectFilesPaneProps {
  fileIds: string[];
  activeFileId: string;
  entryFileId: string;
  isCollapsed: boolean;
  paneWidth: number;
  inlineRenameRequest: { fileId: string; key: number } | null;
  onCollapsedChange: (collapsed: boolean) => void;
  onPaneWidthChange: (width: number) => void;
  onAddProjectFile: () => void;
  onNewProject: () => void;
  onOpenProjectFile: (fileId: string) => void;
  onRenameProjectFile: (fileId: string, nextName: string) => Promise<void>;
  onRequestRenameProjectFile: (fileId: string) => void;
  onDuplicateProjectFile: (fileId: string) => void | Promise<void>;
  onRequestDeleteProjectFile: (fileId: string) => void;
}

export function ProjectFilesPane({
  fileIds,
  activeFileId,
  entryFileId,
  isCollapsed,
  paneWidth,
  inlineRenameRequest,
  onCollapsedChange,
  onPaneWidthChange,
  onAddProjectFile,
  onNewProject,
  onOpenProjectFile,
  onRenameProjectFile,
  onRequestRenameProjectFile,
  onDuplicateProjectFile,
  onRequestDeleteProjectFile,
}: ProjectFilesPaneProps) {
  const handleDragRef = useRef<{
    pointerId: number | null;
    startX: number;
    startWidth: number;
    startCollapsed: boolean;
    hasDragged: boolean;
  } | null>(null);
  const handleCleanupRef = useRef<(() => void) | null>(null);
  const suppressHandleClickRef = useRef(false);
  const suppressMenuRestoreFocusRef = useRef(false);

  useEffect(() => () => {
    handleCleanupRef.current?.();
  }, []);

  const updateHandleDrag = useCallback((clientX: number) => {
    const drag = handleDragRef.current;
    if (!drag) return;

    const deltaX = clientX - drag.startX;
    if (Math.abs(deltaX) > PROJECT_FILES_CLICK_DRAG_TOLERANCE) {
      drag.hasDragged = true;
      suppressHandleClickRef.current = true;
    }

    if (drag.startCollapsed) {
      if (deltaX <= PROJECT_FILES_DRAG_THRESHOLD) return;

      onCollapsedChange(false);
      onPaneWidthChange(clampProjectFilesPaneWidth(PROJECT_FILES_MIN_WIDTH + deltaX - PROJECT_FILES_DRAG_THRESHOLD));
      return;
    }

    const nextWidth = drag.startWidth + deltaX;
    if (nextWidth <= PROJECT_FILES_COLLAPSE_SNAP_WIDTH) {
      onCollapsedChange(true);
      return;
    }

    onCollapsedChange(false);
    onPaneWidthChange(clampProjectFilesPaneWidth(nextWidth));
  }, [onCollapsedChange, onPaneWidthChange]);

  const finishHandleDrag = useCallback(() => {
    const drag = handleDragRef.current;
    handleDragRef.current = null;
    handleCleanupRef.current?.();
    handleCleanupRef.current = null;

    if (drag?.hasDragged) {
      window.setTimeout(() => {
        suppressHandleClickRef.current = false;
      }, 0);
    }
  }, []);

  const beginHandleDrag = useCallback((startX: number, pointerId: number | null) => {
    handleCleanupRef.current?.();
    handleDragRef.current = {
      pointerId,
      startX,
      startWidth: isCollapsed ? PROJECT_FILES_COLLAPSED_WIDTH : paneWidth,
      startCollapsed: isCollapsed,
      hasDragged: false,
    };
  }, [isCollapsed, paneWidth]);

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    beginHandleDrag(event.clientX, event.pointerId);
    event.currentTarget.setPointerCapture(event.pointerId);

    const handleWindowPointerMove = (moveEvent: PointerEvent) => {
      const drag = handleDragRef.current;
      if (!drag || drag.pointerId !== moveEvent.pointerId) return;
      updateHandleDrag(moveEvent.clientX);
    };
    const handleWindowPointerEnd = (endEvent: PointerEvent) => {
      const drag = handleDragRef.current;
      if (!drag || drag.pointerId !== endEvent.pointerId) return;
      finishHandleDrag();
    };

    window.addEventListener("pointermove", handleWindowPointerMove);
    window.addEventListener("pointerup", handleWindowPointerEnd);
    window.addEventListener("pointercancel", handleWindowPointerEnd);
    handleCleanupRef.current = () => {
      window.removeEventListener("pointermove", handleWindowPointerMove);
      window.removeEventListener("pointerup", handleWindowPointerEnd);
      window.removeEventListener("pointercancel", handleWindowPointerEnd);
    };
  }, [beginHandleDrag, finishHandleDrag, updateHandleDrag]);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = handleDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    updateHandleDrag(event.clientX);
  }, [updateHandleDrag]);

  const handlePointerEnd = useCallback((event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = handleDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    finishHandleDrag();
  }, [finishHandleDrag]);

  const handleMouseDown = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || handleDragRef.current) return;

    beginHandleDrag(event.clientX, null);
    const handleWindowMouseMove = (moveEvent: MouseEvent) => {
      updateHandleDrag(moveEvent.clientX);
    };
    const handleWindowMouseEnd = () => {
      finishHandleDrag();
    };

    window.addEventListener("mousemove", handleWindowMouseMove);
    window.addEventListener("mouseup", handleWindowMouseEnd);
    handleCleanupRef.current = () => {
      window.removeEventListener("mousemove", handleWindowMouseMove);
      window.removeEventListener("mouseup", handleWindowMouseEnd);
    };
  }, [beginHandleDrag, finishHandleDrag, updateHandleDrag]);

  const handleHandleClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    if (suppressHandleClickRef.current) {
      event.preventDefault();
      suppressHandleClickRef.current = false;
      return;
    }

    onCollapsedChange(!isCollapsed);
  }, [isCollapsed, onCollapsedChange]);

  const projectNewMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={cn(
            "p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis",
            isCollapsed ? "h-8 w-8" : "h-7 w-7",
          )}
          aria-label="New file or project"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52 border-border-color bg-panel-bg">
        <DropdownMenuItem onClick={onAddProjectFile} className="cursor-pointer">
          <FilePlus2 className="h-4 w-4" />
          New ink file
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onNewProject} className="cursor-pointer">
          <File className="h-4 w-4" />
          New project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <aside
      className={`${isCollapsed ? "flex flex-col items-center" : "flex flex-col"} relative shrink-0 border-border-color bg-panel-bg`}
      style={{ width: isCollapsed ? PROJECT_FILES_COLLAPSED_WIDTH : paneWidth }}
    >
      <button
        type="button"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onMouseDown={handleMouseDown}
        onClick={handleHandleClick}
        aria-label={isCollapsed ? "Project files divider: drag or click to show files" : "Project files divider: drag to resize or click to hide files"}
        aria-expanded={!isCollapsed}
        className="group absolute inset-y-0 -right-1 z-20 flex w-2 touch-none cursor-col-resize items-stretch justify-center bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg"
      >
        <span className="h-full w-px bg-border-color transition-colors group-hover:bg-accent-blue group-focus-visible:bg-accent-blue" aria-hidden="true" />
      </button>
      {isCollapsed && (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1.5 px-1.5 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onCollapsedChange(false)}
                className="h-8 w-8 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis"
                aria-label="Show project files"
                aria-expanded={false}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Show project files</TooltipContent>
          </Tooltip>
          {projectNewMenu}
        </div>
      )}
      <div className={cn(
        "h-11 shrink-0 items-center justify-between gap-2 border-b border-border-color px-3 pr-4",
        isCollapsed ? "hidden" : "flex",
      )}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-text-secondary">
            Files
          </span>
          <span
            className="rounded-sm bg-editor-bg px-1.5 py-0.5 text-[0.6875rem] font-medium tabular-nums leading-none text-text-secondary"
            aria-label={`${fileIds.length} project ${fileIds.length === 1 ? "file" : "files"}`}
          >
            {fileIds.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {projectNewMenu}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onCollapsedChange(true)}
                className="h-7 w-7 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis"
                aria-label="Hide project files"
                aria-expanded={true}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Hide project files</TooltipContent>
          </Tooltip>
        </div>
      </div>
      <div className={cn(
        "min-h-0 flex-1 overflow-auto p-1.5 pr-2.5",
        isCollapsed ? "hidden" : "block",
      )}>
        {fileIds.map((fileId) => {
          const isActive = fileId === activeFileId;
          const isEntry = fileId === entryFileId;
          return (
            <div key={fileId} className="group relative mb-0.5 rounded-md focus-within:bg-accent/70">
              <div
                aria-current={isActive ? "page" : undefined}
                onClick={(event) => {
                  if ((event.target as HTMLElement).closest("input")) return;
                  onOpenProjectFile(fileId);
                }}
                className={cn(
                  "flex min-h-10 w-full min-w-0 cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-1 text-[0.8125rem] text-text-primary transition-colors",
                  "hover:bg-accent hover:text-text-emphasis",
                  isActive && "bg-accent text-text-emphasis shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--accent-blue)_22%,transparent)]",
                )}
                title={fileId}
              >
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenProjectFile(fileId);
                      }}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-editor-bg hover:text-text-emphasis focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg"
                      aria-label={`Open ${fileId}`}
                    >
                      <FileText className={cn(
                        "h-3.5 w-3.5",
                        isActive || isEntry ? "text-accent-blue" : "text-text-secondary",
                      )} />
                      {isActive && <span className="sr-only">Current file</span>}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Open file</TooltipContent>
                </Tooltip>
                <EditableTitle
                  title={fileId}
                  onTitleChange={(nextName) => onRenameProjectFile(fileId, nextName)}
                  editTrigger="double-click"
                  editRequestKey={inlineRenameRequest?.fileId === fileId ? inlineRenameRequest.key : undefined}
                  ariaLabel={`Rename ${fileId}`}
                  placeholder="File path..."
                  fallbackTitle={fileId}
                  normalizeValue={(value) => value.trim() || fileId}
                  showEditIcon={false}
                  className="h-8 min-w-0 flex-1 justify-start px-1 hover:bg-transparent focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg md:px-1"
                  inputClassName="h-8 font-mono text-[0.8125rem]"
                  textClassName={cn("font-mono text-[0.8125rem] leading-5", isActive && "font-medium")}
                />
                {isEntry && (
                  <span className="shrink-0 rounded-sm bg-accent-blue/15 px-1.5 py-0.5 text-[0.625rem] font-medium leading-none text-accent-blue">
                    entry
                  </span>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      onClick={(event) => event.stopPropagation()}
                      className={cn(
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded text-text-secondary transition-colors hover:bg-editor-bg hover:text-text-emphasis",
                        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg",
                        "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(pointer:coarse)]:opacity-100",
                        isActive && "opacity-100",
                      )}
                      aria-label={`More actions for ${fileId}`}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    align="end"
                    className="w-44 border-border-color bg-panel-bg"
                    onCloseAutoFocus={(event) => {
                      if (!suppressMenuRestoreFocusRef.current) return;
                      suppressMenuRestoreFocusRef.current = false;
                      event.preventDefault();
                    }}
                  >
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        suppressMenuRestoreFocusRef.current = true;
                        onRequestRenameProjectFile(fileId);
                      }}
                      className="cursor-pointer"
                    >
                      <FileText className="h-4 w-4" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        void onDuplicateProjectFile(fileId);
                      }}
                      className="cursor-pointer"
                    >
                      <Copy className="h-4 w-4" />
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(event) => {
                        event.stopPropagation();
                        onRequestDeleteProjectFile(fileId);
                      }}
                      className="cursor-pointer text-error focus:text-error"
                      disabled={isEntry}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          );
        })}
      </div>
    </aside>
  );
}
