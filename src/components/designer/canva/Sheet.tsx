import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Canva-style bottom sheet. Slides up from the bottom dock, has a swipe-down
 * grabber and a header. Used by all dock actions that need extra UI.
 */
export function CanvaSheet({
  open,
  onClose,
  title,
  children,
  height = "55vh",
  side = "bottom",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  height?: string;
  side?: "bottom" | "side";
}) {
  // Close on escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop — taps deselect / close */}
      <div
        className="fixed inset-0 z-40 bg-black/20 animate-in fade-in-0"
        onClick={onClose}
      />
      {/* Panel */}
      <div
        className={cn(
          "fixed z-50 bg-card border shadow-2xl flex flex-col",
          "animate-in slide-in-from-bottom-4 duration-200",
          side === "bottom"
            ? "inset-x-0 bottom-0 rounded-t-2xl border-b-0"
            : "right-0 top-0 bottom-0 w-[min(420px,90vw)] rounded-l-2xl border-r-0",
        )}
        style={side === "bottom" ? { maxHeight: height, height } : undefined}
        onClick={(e) => e.stopPropagation()}
      >
        {side === "bottom" && (
          <div className="flex justify-center pt-2 pb-1">
            <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-2 border-b">
          <div className="text-sm font-semibold">{title}</div>
          <button
            onClick={onClose}
            className="h-8 w-8 grid place-items-center rounded-full hover:bg-accent"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto overscroll-contain">{children}</div>
      </div>
    </>
  );
}
