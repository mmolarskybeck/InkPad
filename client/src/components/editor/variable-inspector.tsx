import { List, RefreshCw, Hash, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";

interface InkVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'list';
}

interface VariableInspectorProps {
  variables: InkVariable[];
}

export function VariableInspector({ variables }: VariableInspectorProps) {
  const getVariableIcon = (type: string) => {
    switch (type) {
      case 'number':
        return <Hash className="text-syntax-number text-xs" />;
      case 'string':
        return <Tag className="text-syntax-keyword text-xs" />;
      case 'boolean':
        return <Tag className="text-syntax-keyword text-xs" />;
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
      <div className="bg-panel-bg px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <List className="text-accent-blue text-sm" />
          <span className="text-xs font-medium text-text-emphasis">Variables</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="text-xs text-text-secondary hover:text-text-primary p-1"
        >
          <RefreshCw className="w-3 h-3" />
        </Button>
      </div>
      
      <div className="flex-1 overflow-auto">
        <div className="p-2 space-y-1">
          {variables.length === 0 ? (
            <div className="p-4 text-center text-text-secondary text-xs">
              No variables found
            </div>
          ) : (
            variables.map((variable) => (
              <div key={variable.name} className="flex items-center justify-between p-2 hover:bg-border-color rounded">
                <div className="flex items-center space-x-2">
                  {getVariableIcon(variable.type)}
                  <span className="text-xs font-mono text-text-emphasis">
                    {variable.name}
                  </span>
                </div>
                <span className={`text-xs font-mono ${getValueClass(variable.type)}`}>
                  {formatValue(variable.value, variable.type)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
