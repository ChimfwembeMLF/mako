import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
};

type ConfirmState = ConfirmOptions & {
  isOpen: boolean;
  resolve: (value: boolean) => void;
};

let confirmFn: ((options: ConfirmOptions) => Promise<boolean>) | null = null;

export const confirmModal = async (
  message: string,
  title?: string,
  confirmText?: string,
  cancelText?: string
): Promise<boolean> => {
  if (!confirmFn) {
    console.warn("ConfirmModalProvider not mounted, falling back to window.confirm");
    return window.confirm(message);
  }
  return confirmFn({ message, title, confirmText, cancelText });
};

export function ConfirmModalProvider() {
  const [state, setState] = useState<ConfirmState | null>(null);

  useEffect(() => {
    confirmFn = (options: ConfirmOptions) => {
      return new Promise<boolean>((resolve) => {
        setState({ ...options, isOpen: true, resolve });
      });
    };
    return () => {
      confirmFn = null;
    };
  }, []);

  const handleClose = (value: boolean) => {
    if (state) {
      state.resolve(value);
      setState({ ...state, isOpen: false });
    }
  };

  return (
    <AlertDialog open={state?.isOpen} onOpenChange={(open) => !open && handleClose(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{state?.title || "Please confirm"}</AlertDialogTitle>
          <AlertDialogDescription className="whitespace-pre-wrap">
            {state?.message}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => handleClose(false)}>
            {state?.cancelText || "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => handleClose(true)}>
            {state?.confirmText || "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
