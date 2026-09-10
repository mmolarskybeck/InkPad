import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { SaveState } from '@/hooks/use-autosave';

interface UseSaveErrorToastOptions {
  saveState: SaveState;
  fileName: string;
}

export function useSaveErrorToast({ saveState, fileName }: UseSaveErrorToastOptions) {
  const lastErrorRef = useRef<number>(0);
  const errorShownRef = useRef<boolean>(false);

  useEffect(() => {
    if (saveState === "error") {
      const now = Date.now();
      // Only show error toast once per minute to avoid spam
      if (!errorShownRef.current || now - lastErrorRef.current > 60000) {
        toast.error("Save failed", {
          id: "save-error",
          description: `Could not save "${fileName}". Export your work to avoid data loss.`,
          duration: 10000,
        });
        
        lastErrorRef.current = now;
        errorShownRef.current = true;
      }
    } else if (saveState === "saved" && errorShownRef.current) {
      // Reset error flag when successfully saved
      errorShownRef.current = false;
    }
  }, [saveState, fileName]);
}
