import { useEffect, useRef } from 'react';
import { toast } from '@/hooks/use-toast';
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
        toast({
          title: "Save Failed",
          description: `Could not save "${fileName}". Please export your work to avoid data loss.`,
          variant: "destructive",
          duration: 10000, // Show longer for errors
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
