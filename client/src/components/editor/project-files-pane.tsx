import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight, Copy, FilePlus2, FileText, Files, Lock, MoreHorizontal, Pencil, Plus, ScrollText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EditableTitle } from "@/components/ui/editable-title";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from "@/components/ui/context-menu";
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

export type SidebarTab = "files" | "snippets";

interface ProjectFilesPaneProps {
  fileIds: string[];
  activeFileId: string;
  entryFileId: string;
  isCollapsed: boolean;
  paneWidth: number;
  inlineRenameRequest: { fileId: string; key: number } | null;
  sidebarTab: SidebarTab;
  onSidebarTabChange: (tab: SidebarTab) => void;
  /** Rendered in the pane body while the Snippets tab is selected. */
  snippetsContent: ReactNode;
  onCreateCustomSnippet: () => void;
  onCollapsedChange: (collapsed: boolean) => void;
  onPaneWidthChange: (width: number) => void;
  onAddProjectFile: () => void;
  /** Unused here since "New project" lives in the top menu; kept for caller compatibility. */
  onNewProject?: () => void;
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
  sidebarTab,
  onSidebarTabChange,
  snippetsContent,
  onCreateCustomSnippet,
  onCollapsedChange,
  onPaneWidthChange,
  onAddProjectFile,
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

  /** Rename / Duplicate / Delete, shared by the row's "…" dropdown and its right-click menu. */
  const renderFileActions = (
    fileId: string,
    isEntry: boolean,
    Item: typeof DropdownMenuItem | typeof ContextMenuItem,
  ) => (
    <>
      <Item
        onClick={(event) => {
          event.stopPropagation();
          suppressMenuRestoreFocusRef.current = true;
          onRequestRenameProjectFile(fileId);
        }}
        className="cursor-pointer"
      >
        <Pencil className="h-4 w-4" />
        Rename
      </Item>
      <Item
        onClick={(event) => {
          event.stopPropagation();
          void onDuplicateProjectFile(fileId);
        }}
        className="cursor-pointer"
      >
        <Copy className="h-4 w-4" />
        Duplicate
      </Item>
      {isEntry ? (
        <Item
          disabled
          className="text-text-secondary opacity-100 data-[disabled]:opacity-100"
        >
          <Lock className="h-4 w-4" />
          Entry file cannot be deleted
        </Item>
      ) : (
        <Item
          onClick={(event) => {
            event.stopPropagation();
            onRequestDeleteProjectFile(fileId);
          }}
          className="cursor-pointer text-error focus:text-error"
        >
          <Trash2 className="h-4 w-4" />
          Delete
        </Item>
      )}
    </>
  );

  const iconButtonClass =
    "h-6 w-6 p-0 text-text-secondary hover:bg-accent hover:text-text-emphasis focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg";
  /* Header actions stay quiet until the pane is hovered or focused (always visible on touch). */
  const revealOnHoverClass =
    "opacity-0 transition-opacity duration-150 group-hover/pane:opacity-100 group-focus-within/pane:opacity-100 motion-reduce:transition-none [@media(pointer:coarse)]:opacity-100";

  const newFileButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onAddProjectFile}
          className={iconButtonClass}
          aria-label="New ink file"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">New ink file</TooltipContent>
    </Tooltip>
  );

  const newSnippetButton = (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onCreateCustomSnippet}
          className={iconButtonClass}
          aria-label="New custom snippet"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">New custom snippet</TooltipContent>
    </Tooltip>
  );

  const sidebarTabs: { tab: SidebarTab; label: string; Icon: typeof Files }[] = [
    { tab: "files", label: "Files", Icon: Files },
    { tab: "snippets", label: "Snippets", Icon: ScrollText },
  ];

  const renderSidebarTabButton = (
    { tab, label, Icon }: { tab: SidebarTab; label: string; Icon: typeof Files },
    options: { size: "sm" | "lg"; tooltipSide: "bottom" | "right"; expandOnClick?: boolean },
  ) => {
    const isActive = sidebarTab === tab;
    return (
      <Tooltip key={tab}>
        <TooltipTrigger asChild>
          <button
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-pressed={isActive}
            aria-label={label}
            title={label}
            onClick={() => {
              onSidebarTabChange(tab);
              if (options.expandOnClick) onCollapsedChange(false);
            }}
            className={cn(
              "flex items-center justify-center rounded text-text-secondary hover:bg-accent hover:text-text-emphasis",
              "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg",
              options.size === "lg" ? "h-8 w-8" : "h-7 w-7",
              isActive && "bg-accent text-text-emphasis",
            )}
          >
            <Icon className={options.size === "lg" ? "h-4 w-4" : "h-3.5 w-3.5"} aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side={options.tooltipSide}>{label}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <aside
      className="group/pane relative flex shrink-0 flex-col bg-panel-bg"
      style={{ width: isCollapsed ? PROJECT_FILES_COLLAPSED_WIDTH : paneWidth }}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
            onMouseDown={handleMouseDown}
            onClick={handleHandleClick}
            aria-label={isCollapsed ? "Sidebar divider: drag or click to show sidebar" : "Sidebar divider: drag to resize or click to hide sidebar"}
            aria-expanded={!isCollapsed}
            className="group absolute inset-y-0 -right-1.5 z-20 flex w-3 touch-none cursor-col-resize items-stretch justify-center bg-transparent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg"
          >
            <span className="h-full w-px bg-border-color transition-all group-hover:w-0.5 group-hover:bg-accent-blue group-focus-visible:w-0.5 group-focus-visible:bg-accent-blue" aria-hidden="true" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">
          {isCollapsed ? "Drag or click to show sidebar" : "Drag to resize; click to hide sidebar"}
        </TooltipContent>
      </Tooltip>

      {isCollapsed ? (
        <div className="flex min-h-0 flex-1 flex-col items-center gap-1 px-1.5 py-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onCollapsedChange(false)}
                className={cn(iconButtonClass, "h-8 w-8")}
                aria-label="Show sidebar"
                aria-expanded={false}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Show sidebar</TooltipContent>
          </Tooltip>
          <div role="tablist" aria-label="Sidebar" className="flex flex-col items-center gap-0.5">
            {sidebarTabs.map((entry) => renderSidebarTabButton(entry, {
              size: "lg",
              tooltipSide: "right",
              expandOnClick: true,
            }))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex h-9 shrink-0 items-center justify-between pl-1.5 pr-2">
            <div role="tablist" aria-label="Sidebar" className="flex items-center gap-0.5">
              {sidebarTabs.map((entry) => renderSidebarTabButton(entry, {
                size: "sm",
                tooltipSide: "bottom",
              }))}
            </div>
            <div className={cn("flex items-center gap-0.5", revealOnHoverClass)}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onCollapsedChange(true)}
                    className={iconButtonClass}
                    aria-label="Hide sidebar"
                    aria-expanded={true}
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">Hide sidebar</TooltipContent>
              </Tooltip>
            </div>
          </div>

          <div className="flex h-8 shrink-0 items-center justify-between pl-3 pr-2">
            <span className="text-[0.6875rem] font-semibold uppercase leading-4 tracking-[0.06em] text-text-secondary">
              {sidebarTab === "files" ? "Files" : "Snippets"}
            </span>
            {sidebarTab === "files" ? newFileButton : newSnippetButton}
          </div>

          {sidebarTab === "snippets" ? (
            <div className="min-h-0 flex-1">{snippetsContent}</div>
          ) : (
          <div
            role="list"
            aria-label="Project files"
            className="min-h-0 flex-1 overflow-auto pb-2"
          >
            {fileIds.map((fileId) => {
              const isActive = fileId === activeFileId;
              const isEntry = fileId === entryFileId;
              return (
                <div
                  key={fileId}
                  role="listitem"
                  className="group relative [&:has(:focus-visible)]:bg-accent/60"
                  onKeyDownCapture={(event) => {
                    if (event.key !== "F2" || (event.target as HTMLElement).closest("input")) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onRequestRenameProjectFile(fileId);
                  }}
                >
                  <ContextMenu>
                  <ContextMenuTrigger asChild>
                  <div
                    aria-current={isActive ? "page" : undefined}
                    onClick={(event) => {
                      if ((event.target as HTMLElement).closest("input")) return;
                      onOpenProjectFile(fileId);
                    }}
                    className={cn(
                      "flex h-7 w-full min-w-0 cursor-pointer items-center gap-2 pl-3 pr-1.5 text-[0.8125rem] text-text-primary transition-colors duration-150 motion-reduce:transition-none",
                      "hover:bg-accent/60 hover:text-text-emphasis",
                      isActive && "bg-accent text-text-emphasis hover:bg-accent",
                    )}
                    title={fileId}
                  >
                    <FileText
                      aria-hidden="true"
                      className={cn("h-3.5 w-3.5 shrink-0", isActive ? "text-accent-blue" : "text-text-secondary")}
                    />
                    {isActive && <span className="sr-only">Current file</span>}
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
                      className="h-7 min-w-0 flex-1 cursor-pointer justify-start px-0 hover:bg-transparent focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg md:px-0"
                      inputClassName="h-6 font-sans text-[0.8125rem]"
                      textClassName={cn(
                        "font-sans text-[0.8125rem] leading-5 text-text-primary",
                        isActive && "text-text-emphasis",
                      )}
                    />
                    {isEntry && fileIds.length > 1 && (
                      <span className="shrink-0 text-[0.6875rem] leading-none text-text-secondary" aria-label="Entry file">
                        entry
                      </span>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          onClick={(event) => event.stopPropagation()}
                          className={cn(
                            "flex h-6 w-6 shrink-0 items-center justify-center rounded-sm text-text-secondary transition-colors hover:bg-editor-bg hover:text-text-emphasis",
                            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-panel-bg",
                            "opacity-0 focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100 [@media(pointer:coarse)]:opacity-100",
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
                        {renderFileActions(fileId, isEntry, DropdownMenuItem)}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                  </ContextMenuTrigger>
                  <ContextMenuContent
                    className="w-44 border-border-color bg-panel-bg"
                    onCloseAutoFocus={(event) => {
                      if (!suppressMenuRestoreFocusRef.current) return;
                      suppressMenuRestoreFocusRef.current = false;
                      event.preventDefault();
                    }}
                  >
                    {renderFileActions(fileId, isEntry, ContextMenuItem)}
                  </ContextMenuContent>
                  </ContextMenu>
                </div>
              );
            })}
          </div>
          )}
        </>
      )}
    </aside>
  );
}
