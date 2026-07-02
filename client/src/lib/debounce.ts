export interface DebouncedFunction<TArgs extends unknown[]> {
  (...args: TArgs): void;
  cancel: () => void;
  flush: () => void;
}

export function debounce<TArgs extends unknown[]>(
  callback: (...args: TArgs) => unknown,
  waitMs: number,
): DebouncedFunction<TArgs> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let pendingArgs: TArgs | null = null;

  const invoke = () => {
    if (!pendingArgs) {
      timeoutId = null;
      return;
    }

    const args = pendingArgs;
    pendingArgs = null;
    timeoutId = null;
    void callback(...args);
  };

  const debounced = ((...args: TArgs) => {
    pendingArgs = args;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(invoke, waitMs);
  }) as DebouncedFunction<TArgs>;

  debounced.cancel = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = null;
    pendingArgs = null;
  };

  debounced.flush = () => {
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    invoke();
  };

  return debounced;
}
