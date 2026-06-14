import type Konva from "konva";

/**
 * Render a Konva stage at full resolution to JPEG dataURL.
 * Temporarily resets the stage scale to 1 so the export is at native size.
 */
export async function stageToJpegDataUrl(
  stage: Konva.Stage,
  pixelRatio = 2,
  quality = 0.92,
): Promise<string> {
  const sx = stage.scaleX() || 1;
  const sy = stage.scaleY() || 1;
  const w = stage.width();
  const h = stage.height();

  // Set to native resolution (unscaled)
  stage.scale({ x: 1, y: 1 });
  stage.width(w / sx);
  stage.height(h / sy);
  
  // Force immediate synchronous redraw
  stage.draw();
  
  try {
    const url = stage.toDataURL({ pixelRatio, mimeType: "image/jpeg", quality });
    return url;
  } finally {
    // Always restore original view
    stage.scale({ x: sx, y: sy });
    stage.width(w);
    stage.height(h);
    stage.draw();
  }
}

export function downloadDataUrl(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Build a multipage PDF from an array of JPEG data URLs.
 * Uses mm units with explicit page size derived from px @ 96dpi.
 */
export async function pdfFromJpegPages(
  pages: { dataUrl: string; widthPx: number; heightPx: number }[],
  filename: string,
) {
  const { jsPDF } = await import("jspdf");
  if (pages.length === 0) throw new Error("Nothing to export");
  
  const PX_TO_MM = 25.4 / 96;
  const toPage = (p: { widthPx: number; heightPx: number }) => {
    // Ensure we have valid positive integers for dimensions
    const wp = Math.max(1, Math.round(Number(p.widthPx) || 794));
    const hp = Math.max(1, Math.round(Number(p.heightPx) || 1123));
    const w = wp * PX_TO_MM;
    const h = hp * PX_TO_MM;
    
    if (isNaN(w) || isNaN(h)) {
      console.error("[PDF Export] NaN dimension encountered", { wp, hp, w, h });
    }

    return { 
      w, 
      h, 
      orientation: (w >= h ? "landscape" : "portrait") as "landscape" | "portrait" 
    };
  };

  const first = toPage(pages[0]);
  
  // Diagnostic logging to catch NaN/0 issues in console
  console.log(`[PDF Export] Creating PDF: ${filename}`, {
    pageCount: pages.length,
    firstPageDimensions: `${first.w.toFixed(2)}x${first.h.toFixed(2)}mm`,
    orientation: first.orientation
  });

  const pdf = new jsPDF({
    orientation: first.orientation,
    unit: "mm",
    format: [first.w, first.h],
  });

  pages.forEach((p, i) => {
    try {
      const page = toPage(p);
      if (i > 0) {
        pdf.addPage([page.w, page.h], page.orientation);
      }
      
      if (!p.dataUrl || !p.dataUrl.startsWith("data:image")) {
        console.warn(`[PDF Export] Skip page ${i}: invalid dataURL`);
        return;
      }

      pdf.addImage(p.dataUrl, "JPEG", 0, 0, page.w, page.h, undefined, "FAST");
    } catch (err) {
      console.error(`[PDF Export] Error adding page ${i}:`, err);
    }
  });

  pdf.save(filename);
}
