import { useState } from "react";
import { Download, FileArchive, FileText, Braces, MonitorPlay, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface StoryExportMenuProps {
  onExportInk: () => void | Promise<void>;
  onExportProject?: () => void | Promise<void>;
  onExportProjectZip?: () => void | Promise<void>;
  onExportJson: () => void | Promise<void>;
  onConfigureHtml: () => void;
  hasMultipleFiles?: boolean;
  isExporting?: boolean;
}

interface ExportMenuItemProps {
  icon: LucideIcon;
  title: string;
  description: string;
  disabled?: boolean;
  onSelect: () => void;
}

function ExportMenuItem({ icon: Icon, title, description, disabled, onSelect }: ExportMenuItemProps) {
  return (
    <DropdownMenuItem
      onSelect={onSelect}
      disabled={disabled}
      className="group flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 transition-colors focus:bg-accent focus:outline-none data-[disabled]:opacity-50"
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary transition-colors group-focus:text-text-emphasis" />
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="text-[0.875rem] font-medium leading-tight text-text-emphasis">{title}</span>
        <span className="text-[0.75rem] leading-snug text-text-secondary">{description}</span>
      </div>
    </DropdownMenuItem>
  );
}

function GroupLabel({ children }: { children: string }) {
  return (
    <DropdownMenuLabel className="px-2 pb-1 pt-2 text-[0.75rem] font-medium uppercase tracking-[0.05em] text-text-secondary">
      {children}
    </DropdownMenuLabel>
  );
}

export function StoryExportMenu({
  onExportInk,
  onExportProject,
  onExportProjectZip,
  onExportJson,
  onConfigureHtml,
  hasMultipleFiles = false,
  isExporting = false,
}: StoryExportMenuProps) {
  const [open, setOpen] = useState(false);
  const showProjectExports = hasMultipleFiles && Boolean(onExportProject);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 px-2.5 text-[0.8125rem] text-text-primary hover:bg-accent hover:text-text-emphasis data-[state=open]:bg-accent data-[state=open]:text-text-emphasis"
        >
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[288px] border-border-color bg-panel-bg p-1.5 shadow-md">
        <DropdownMenuGroup>
          <GroupLabel>Source</GroupLabel>
          <ExportMenuItem
            icon={FileText}
            title="Ink source (.ink)"
            description="This file, for editing in any Ink tool."
            disabled={isExporting}
            onSelect={() => void onExportInk()}
          />
          {showProjectExports && onExportProject && (
            <ExportMenuItem
              icon={FileArchive}
              title="InkPad project (.inkpad)"
              description="Every file in this project. Reopens in InkPad."
              disabled={isExporting}
              onSelect={() => void onExportProject()}
            />
          )}
          {showProjectExports && onExportProjectZip && (
            <ExportMenuItem
              icon={FileArchive}
              title="Project ZIP"
              description="The same files as a standard ZIP."
              disabled={isExporting}
              onSelect={() => void onExportProjectZip()}
            />
          )}
        </DropdownMenuGroup>

        <DropdownMenuSeparator className="my-1 bg-border-color/60" />

        <DropdownMenuGroup>
          <GroupLabel>Build</GroupLabel>
          <ExportMenuItem
            icon={Braces}
            title="Compiled JSON"
            description="Runtime story for inkjs or a custom engine."
            disabled={isExporting}
            onSelect={() => void onExportJson()}
          />
          <ExportMenuItem
            icon={MonitorPlay}
            title="Playable HTML…"
            description="Standalone web page with theme and typeface options."
            disabled={isExporting}
            onSelect={() => window.setTimeout(onConfigureHtml, 0)}
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
