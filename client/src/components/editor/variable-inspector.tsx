import { List, Hash, Tag, XCircle } from "lucide-react";
import { isListVariableValue, type ListVariableValue } from "@/lib/ink-variable-utils";

interface InkVariable {
  name: string;
  value: any;
  type: 'string' | 'number' | 'boolean' | 'list';
}

interface VariableInspectorProps {
  variables: InkVariable[];
  showHeader?: boolean;
  compileFailed?: boolean;
}

const MAX_LIST_ITEMS = 3;
const VALUE_CLASS = "min-w-0 truncate font-mono text-[0.8125rem] leading-5";

function formatListItems(items: string[]): string {
  if (items.length <= MAX_LIST_ITEMS) return items.join(', ');
  const visible = items.slice(0, MAX_LIST_ITEMS - 1);
  return `${visible.join(', ')} +${items.length - visible.length}`;
}

function ListValue({ value }: { value: ListVariableValue | any }) {
  if (!isListVariableValue(value)) {
    return <span className={`${VALUE_CLASS} text-text-secondary`}>(empty)</span>;
  }

  const { active, possible } = value;

  if (active.length > 0) {
    return <span className={`${VALUE_CLASS} text-text-primary`} title={active.join(', ')}>{formatListItems(active)}</span>;
  }

  if (possible.length > 0) {
    return (
      <span className={`${VALUE_CLASS} text-text-secondary`} title={possible.join(', ')}>
        ({formatListItems(possible)})
      </span>
    );
  }

  return <span className={`${VALUE_CLASS} text-text-secondary`}>(empty)</span>;
}

function getVariableIcon(type: string) {
  const iconClass = "h-3.5 w-3.5 shrink-0";
  switch (type) {
    case 'number':
      return <Hash className={`${iconClass} text-syntax-number`} aria-hidden="true" />;
    case 'list':
      return <List className={`${iconClass} text-accent-blue`} aria-hidden="true" />;
    case 'string':
    case 'boolean':
    default:
      return <Tag className={`${iconClass} text-syntax-keyword`} aria-hidden="true" />;
  }
}

function formatValue(value: any, type: string): string {
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
}

function getValueClass(type: string): string {
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
}

export function VariableInspector({ variables, showHeader = true, compileFailed = false }: VariableInspectorProps) {
  return (
    <div className="flex flex-col h-full">
      {showHeader && (
        <div className="bg-panel-bg px-4 h-11 shrink-0 border-b border-border-color flex items-center gap-2">
          <List className="shrink-0 text-sm text-accent-blue" />
          <span className="text-[0.875rem] font-medium tracking-[0.01em] text-text-emphasis">Variables</span>
          {variables.length > 0 && (
            <span className="text-[0.75rem] tabular-nums text-text-secondary">{variables.length}</span>
          )}
        </div>
      )}

      <div className="flex-1 overflow-auto bg-editor-bg">
        {variables.length === 0 ? (
          <div className="flex h-full min-h-[6rem] items-center justify-center gap-2 p-4 text-center text-[0.875rem] text-text-secondary">
            {compileFailed && <XCircle className="h-4 w-4 shrink-0 text-error" aria-hidden="true" />}
            {compileFailed ? "Unavailable until errors are fixed" : "No variables declared"}
          </div>
        ) : (
          <dl
            className="grid grid-cols-[minmax(0,max-content)_minmax(0,1fr)] p-2"
            aria-label="Story variables"
          >
            {variables.map((variable) => (
              <div
                key={variable.name}
                className="col-span-2 grid grid-cols-subgrid items-center gap-x-4 rounded px-2 py-1.5 transition-colors hover:bg-accent"
              >
                <dt className="flex min-w-0 max-w-[16rem] items-center gap-2">
                  {getVariableIcon(variable.type)}
                  <span className="truncate font-mono text-[0.8125rem] leading-5 text-text-emphasis" title={variable.name}>
                    {variable.name}
                  </span>
                </dt>
                <dd className="flex min-w-0">
                  {variable.type === 'list'
                    ? <ListValue value={variable.value} />
                    : (
                      <span className={`${VALUE_CLASS} tabular-nums ${getValueClass(variable.type)}`}>
                        {formatValue(variable.value, variable.type)}
                      </span>
                    )
                  }
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}
