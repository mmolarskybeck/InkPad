export interface InkVariable {
  name: string;
  scope: "global" | "local" | "temp";
  initialValue: unknown;
}

export interface ListVariableValue {
  active: string[];
  possible: string[];
}

export function isListVariableValue(value: any): value is ListVariableValue {
  return value !== null && typeof value === 'object' && 'active' in value && 'possible' in value;
}

/**
 * Extracts all Ink variables from compiled JSON output
 * Handles global declarations, local variables, and temporary variables
 */
export function extractInkVariables(json: any): InkVariable[] {
  if (!json || !json.root) {
    return [];
  }

  const variables = new Map<string, InkVariable>();
  const globalVariables: InkVariable[] = [];

  // Step 1: Extract global declarations
  try {
    // Look for global declarations in the root array
    for (const item of json.root) {
      if (item && typeof item === 'object' && item['global decl']) {
        const declarations = item['global decl'];

        // Parse the declarations array
        // The structure is: [value1, {'VAR=': 'name1'}, value2, {'VAR=': 'name2'}, ...]
        // For strings: ['str', '^value', '/str', {'VAR=': 'name'}]
        for (let i = 0; i < declarations.length; i++) {
          const current = declarations[i];

          if (current && typeof current === 'object' && current['VAR=']) {
            const varName = current['VAR='];
            let initialValue: unknown = null;

            // Check the immediate previous item first
            if (i > 0) {
              const previousItem = declarations[i - 1];

              // Handle direct values (numbers, booleans) - these come immediately before VAR=
              if (typeof previousItem === 'number' || typeof previousItem === 'boolean') {
                initialValue = previousItem;
              }
              // Handle string end token '/str' - need to look back for the actual string
              else if (typeof previousItem === 'string' && previousItem === '/str') {
                // Look backwards for the string value with ^ prefix
                for (let j = i - 2; j >= 0; j--) {
                  const candidate = declarations[j];
                  if (typeof candidate === 'string' && candidate.startsWith('^')) {
                    initialValue = candidate.substring(1);
                    break;
                  }
                }
              }
              // Handle direct string values (shouldn't happen based on structure, but just in case)
              else if (typeof previousItem === 'string' && previousItem.startsWith('^')) {
                initialValue = previousItem.substring(1);
              }
              // Handle InkList values from compiled JSON (object with "list" property)
              else if (typeof previousItem === 'object' && previousItem !== null && 'list' in previousItem) {
                initialValue = previousItem;
              }
            }

            const variable: InkVariable = {
              name: varName,
              scope: "global",
              initialValue
            };

            globalVariables.push(variable);
            variables.set(varName, variable);
          }
        }
      }
    }
  } catch (error) {
    console.warn('Error extracting global variables:', error);
  }

  // For now, only return global variables as they are the most reliable
  return globalVariables;
}

/**
 * Pulls the listDefs map from compiled JSON.
 * Shape: { deaths: { beaten: 1, drown: 2 }, ... }
 */
export function extractListDefs(json: any): Record<string, Record<string, number>> {
  return json?.listDefs ?? {};
}

/**
 * Convert InkVariable to the format expected by the UI components
 */
export function convertToUIVariables(
  inkVariables: InkVariable[],
  listDefs: Record<string, Record<string, number>> = {}
) {
  return inkVariables.map(variable => {
    let type = getVariableType(variable.initialValue) as 'string' | 'number' | 'boolean' | 'list';
    let value: any = variable.initialValue ?? 'undefined';

    if (type === 'list' && variable.initialValue !== null && typeof variable.initialValue === 'object' && 'list' in (variable.initialValue as any)) {
      const rawList = variable.initialValue as any;
      const listObj = rawList.list as Record<string, number>;
      const origins: string[] = rawList.origins ?? [variable.name];

      const active = Object.entries(listObj)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => a - b)
        .map(([k]) => k.split('.').pop() || k);

      const possible = origins.flatMap(origin => {
        const def = listDefs[origin];
        if (!def) return [];
        return Object.entries(def)
          .sort(([, a], [, b]) => a - b)
          .map(([name]) => name);
      });

      value = { active, possible } satisfies ListVariableValue;
    }

    // Heuristic: if it's a 0 or 1 and the variable name suggests boolean, treat as boolean
    if (typeof variable.initialValue === 'number' &&
        (variable.initialValue === 0 || variable.initialValue === 1) &&
        (variable.name.startsWith('has_') || variable.name.startsWith('is_') ||
         variable.name.startsWith('can_') || variable.name.includes('_is_') ||
         variable.name.endsWith('_flag') || variable.name.includes('passport'))) {
      type = 'boolean';
      value = variable.initialValue === 1;
    }

    return {
      name: variable.name,
      value,
      type
    };
  });
}

function getVariableType(value: unknown): 'string' | 'number' | 'boolean' | 'list' {
  if (typeof value === 'number') return 'number';
  if (typeof value === 'boolean') return 'boolean';
  // InkList at runtime is a Map subclass
  if (value instanceof Map) return 'list';
  // InkList from compiled JSON is an object with a "list" property
  if (value !== null && typeof value === 'object' && 'list' in (value as object)) return 'list';
  if (Array.isArray(value)) return 'list';
  return 'string';
}

function getPossibleItemsFromState(inkList: any, variablesState: any): string[] {
  try {
    // Fast path: origins already resolved (happens after list is pushed onto eval stack)
    if (inkList.origins?.length > 0) {
      const all = inkList.all;
      if (all.size > 0) {
        return all.orderedItems.map((kv: any) => kv.Key.itemName as string).filter(Boolean);
      }
    }

    // Fallback: look up from story's list definitions via the private field on VariablesState
    const originNames: string[] = inkList._originNames ?? inkList.originNames ?? [];
    const listDefsOrigin = (variablesState as any)._listDefsOrigin;
    if (originNames.length > 0 && listDefsOrigin) {
      return originNames.flatMap((originName: string) => {
        const defResult = listDefsOrigin.TryListGetDefinition(originName, null);
        if (!defResult?.exists || !defResult.result?._itemNameToValues) return [];
        const nameToValues = defResult.result._itemNameToValues as Map<string, number>;
        return Array.from(nameToValues.entries())
          .sort(([, a], [, b]) => a - b)
          .map(([name]) => name);
      });
    }
  } catch {
    // ignore
  }
  return [];
}

/**
 * Converts the live variablesState from an inkjs story into the UI format
 */
export function convertStateToUIVariables(variablesState: any, variableNames: string[]) {
  if (!variablesState || !variableNames || variableNames.length === 0) {
    return [];
  }

  const variables = [];

  for (const name of variableNames) {
    const value = variablesState[name];
    if (value === undefined) continue;

    const type = getVariableType(value);

    if (type === 'list' && value instanceof Map) {
      const active = (value as any).orderedItems
        .map((kv: any) => kv.Key.itemName as string)
        .filter(Boolean);
      const possible = getPossibleItemsFromState(value, variablesState);
      variables.push({ name, value: { active, possible } satisfies ListVariableValue, type });
    } else {
      variables.push({ name, value, type });
    }
  }

  return variables;
}
