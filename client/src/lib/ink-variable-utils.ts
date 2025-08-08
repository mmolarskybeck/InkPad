export interface InkVariable {
  name: string;
  scope: "global" | "local" | "temp";
  initialValue: unknown;
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
 * Convert InkVariable to the format expected by the UI components
 */
export function convertToUIVariables(inkVariables: InkVariable[]) {
  return inkVariables.map(variable => {
    let type = getVariableType(variable.initialValue) as 'string' | 'number' | 'boolean' | 'list';
    let value = variable.initialValue ?? 'undefined';
    
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
  if (typeof value === 'number') {
    // In Ink, booleans are compiled to 0 (false) or 1 (true)
    // If it's 0 or 1, it might be a boolean, but we can't be sure without more context
    // For now, treat as number, but could be enhanced with variable name analysis
    return 'number';
  }
  if (typeof value === 'boolean') return 'boolean';
  if (Array.isArray(value)) return 'list';
  return 'string';
}

/**
 * Converts the live variablesState from an inkjs story into the UI format
 */
export function convertStateToUIVariables(variablesState: any, variableNames: string[]) {
  if (!variablesState) {
    console.log('No variablesState provided');
    return [];
  }

  console.log('variablesState object:', variablesState);
  console.log('variableNames:', variableNames);
  
  // Try different ways to access the variables
  console.log('Trying different access methods:');
  
  // Method 1: Direct property access
  if (variableNames && variableNames.length > 0) {
    console.log('Method 1 - Direct access:');
    variableNames.forEach(name => {
      console.log(`  ${name}: variablesState['${name}'] =`, variablesState[name]);
    });
  }
  
  // Method 2: Check for $ accessor (common in inkjs)
  if (variablesState.$) {
    console.log('Method 2 - $ accessor found');
    if (variableNames && variableNames.length > 0) {
      variableNames.forEach(name => {
        console.log(`  ${name}: variablesState.$('${name}') =`, variablesState.$(name));
      });
    }
  }
  
  // Method 3: Check _globalVariables or _defaultGlobalVariables
  if (variablesState._globalVariables) {
    console.log('Method 3 - _globalVariables found:', variablesState._globalVariables);
  }
  if (variablesState._defaultGlobalVariables) {
    console.log('Method 4 - _defaultGlobalVariables found:', variablesState._defaultGlobalVariables);
  }
  
  // Method 5: Iterate over all properties
  console.log('Method 5 - All properties:');
  for (const prop in variablesState) {
    if (prop && !prop.startsWith('_') && prop !== 'variableChangedEventCallbacks') {
      console.log(`  Property ${prop}:`, variablesState[prop]);
    }
  }

  // Try the most likely access method based on inkjs documentation
  const variables = [];
  
  // First, try direct property access (most common in inkjs)
  if (variableNames && variableNames.length > 0) {
    for (const name of variableNames) {
      const value = variablesState[name];
      if (value !== undefined) {
        variables.push({
          name,
          value,
          type: getVariableType(value)
        });
      }
    }
  }
  
  // If that didn't work and we have $ accessor, try that
  if (variables.length === 0 && variablesState.$ && variableNames && variableNames.length > 0) {
    for (const name of variableNames) {
      const value = variablesState.$(name);
      if (value !== undefined) {
        variables.push({
          name,
          value,
          type: getVariableType(value)
        });
      }
    }
  }
  
  console.log('Final extracted variables:', variables);
  return variables;
}


