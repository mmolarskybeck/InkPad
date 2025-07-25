import { useState } from "react";
import { AlertTriangle, ChevronDown, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface InkError {
  line: number;
  column?: number;
  message: string;
  type?: 'error' | 'warning';
}

interface ErrorPanelProps {
  errors: InkError[];
  onErrorClick: (line: number) => void;
}

export function ErrorPanel({ errors, onErrorClick }: ErrorPanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);

  const errorCount = errors.filter(e => e.type !== 'warning').length;
  const warningCount = errors.filter(e => e.type === 'warning').length;

  return (
    <div className="flex flex-col h-full">
      <Collapsible open={!isCollapsed} onOpenChange={setIsCollapsed}>
        <CollapsibleTrigger asChild>
          <div className="bg-panel-bg px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-border-color transition-colors">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="text-error text-sm" />
              <span className="text-xs font-medium text-error">Problems</span>
              {errorCount > 0 && (
                <span className="bg-error text-editor-bg text-xs px-1.5 py-0.5 rounded font-medium">
                  {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="bg-warning text-editor-bg text-xs px-1.5 py-0.5 rounded font-medium">
                  {warningCount}
                </span>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-text-secondary hover:text-text-primary p-1"
            >
              <ChevronDown className={`w-3 h-3 transition-transform ${isCollapsed ? 'rotate-180' : ''}`} />
            </Button>
          </div>
        </CollapsibleTrigger>
        
        <CollapsibleContent className="flex-1 overflow-auto">
          <div className="p-2 space-y-1">
            {errors.length === 0 ? (
              <div className="p-4 text-center text-text-secondary text-xs">
                No problems detected
              </div>
            ) : (
              errors.map((error, index) => (
                <div
                  key={index}
                  onClick={() => onErrorClick(error.line)}
                  className="flex items-start space-x-3 p-2 hover:bg-border-color rounded cursor-pointer"
                >
                  <XCircle className="text-error text-sm mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-text-emphasis font-mono">
                      <span className="text-text-secondary">
                        line {error.line}{error.column ? `:${error.column}` : ''}
                      </span>
                      {' - '}
                      <span>{error.message}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
