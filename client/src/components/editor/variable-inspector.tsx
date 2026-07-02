import { List, RefreshCw, Hash, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { isListVariableValue, type ListVariableValue } from "@/lib/ink-variable-utils";

interface InkVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'list';
}

interface VariableInspectorProps {
  variables: InkVariable[];
  showHeader?: boolean;
}

const MAX_LIST_ITEMS = 3;

function formatListItems(items: string[]): string {
  if (items.length <= MAX_LIST_ITEMS) return items.join(', ');
  const visible = items.slice(0, MAX_LIST_ITEMS - 1);
  return `${visible.join(', ')} +${items.length - visible.length}`;
}

function ListValue({ value }: { value: ListVariableValue | any }) {
  const baseClass = "text-[0.875rem] leading-6 font-mono";

  if (!isListVariableValue(value)) {
    return (
      <span className={`${baseClass} text-text-secondary`}>(empty)</span>
    );
  }

  const { active, possible } = value;

  if (active.length > 0) {
    return (
      <span className={`${baseClass} text-text-primary`}>
        {formatListItems(active)}
      </span>
    );
  }

  if (possible.length > 0) {
    return (
      <span className={`${baseClass} text-text-secondary`}>
        ({formatListItems(possible)})
      </span>
    );
  }

  return (
    <span className={`${baseClass} text-text-secondary`}>(empty)</span>
  );
}

export function VariableInspector({ variables, showHeader = true }: VariableInspectorProps) {
  const getVariableIcon = (type: string) => {
    switch (type) {
      case 'number':
        return <Hash className="text-syntax-number text-xs" />;
      case 'list':
        return <List className="text-accent-blue text-xs" />;
      case 'string':
      case 'boolean':
      default:
        return <Tag className="text-syntax-keyword text-xs" />;
    }
  };

  const formatValue = (value: any, type: string) => {
    switch (type) {
      case 'string':
        return `"${value}"`;
      case 'number':
        return value.toString();
      case 'boolean':
        return value ? 'true' : 'false';
      default:
        return JSON.stringify(value);
    }
  };

  const getValueClass = (type: string) => {
    switch (type) {
      case 'number':
        return 'text-syntax-number';
      case 'string':
        return 'text-syntax-string';
      case 'boolean':
        return 'text-syntax-keyword';
      default:
        return 'text-text-primary';
    }
  };

  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="bg-panel-bg px-4 h-11 shrink-0 border-b border-border-color flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <List className="text-accent-blue text-sm" />
            <span className="text-[0.875rem] font-semibold tracking-[0.01em] text-text-emphasis">Variables</span>
          </div>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-[0.8125rem] text-text-secondary hover:text-text-primary hover:bg-accent p-1 transition-colors"
                aria-label="Refresh variable list"
              >
                <RefreshCw className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Refresh variables</TooltipContent>
          </Tooltip>
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="p-2 space-y-1">
          {variables.length === 0 ? (
            <div className="p-4 text-center text-[0.875rem] text-text-secondary">
              No variables found
            </div>
          ) : (
            variables.map((variable) => (
              <div key={variable.name} className="flex items-center justify-between p-2 hover:bg-accent transition-colors rounded w-full">
                <div className="flex items-center space-x-2 min-w-0 shrink">
                  {getVariableIcon(variable.type)}
                  <span className="text-[0.875rem] leading-6 font-mono text-text-emphasis truncate">
                    {variable.name}
                  </span>
                </div>
                <div className="shrink-0 ml-2">
                  {variable.type === 'list'
                    ? <ListValue value={variable.value} />
                    : (
                      <span className={`text-[0.875rem] leading-6 font-mono tabular-nums ${getValueClass(variable.type)}`}>
                        {formatValue(variable.value, variable.type)}
                      </span>
                    )
                  }
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
