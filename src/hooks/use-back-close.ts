import { useEffect, useRef } from "react";

/**
 * Push a history entry while an overlay (dialog/sheet) is open so that
 * the device/browser Back button closes the overlay instead of navigating
 * away from the page.
 */
export function useBackButtonClose(open: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    window.history.pushState(
      { ...(window.history.state ?? {}), __overlay: Date.now() },
      "",
      window.location.href,
    );
    const handler = () => {
      onCloseRef.current();
    };
    window.addEventListener("popstate", handler);
    return () => {
      window.removeEventListener("popstate", handler);
    };
  }, [open]);
}
