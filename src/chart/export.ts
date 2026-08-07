// Figure export: self-contained SVG, and high-resolution PNG rasterized from
// it. Interactive-only elements are tagged data-noexport and stripped.

export function serializeSVG(svg: SVGSVGElement): string {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.querySelectorAll("[data-noexport]").forEach((el) => el.remove());
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.removeAttribute("style");
  const vb = svg.viewBox.baseVal;
  clone.setAttribute("width", String(vb.width));
  clone.setAttribute("height", String(vb.height));
  return new XMLSerializer().serializeToString(clone);
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function downloadSVG(svg: SVGSVGElement, filename: string) {
  const text = serializeSVG(svg);
  download(new Blob([text], { type: "image/svg+xml" }), filename);
}

/** Rasterize at `scale`x the logical size (use 3-4 for print, ~300 dpi). */
export async function downloadPNG(svg: SVGSVGElement, filename: string, scale = 3): Promise<void> {
  const text = serializeSVG(svg);
  const vb = svg.viewBox.baseVal;
  const url = URL.createObjectURL(new Blob([text], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Could not rasterize the SVG."));
      img.src = url;
    });
    const canvas = document.createElement("canvas");
    canvas.width = vb.width * scale;
    canvas.height = vb.height * scale;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable.");
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG encoding failed.");
    download(blob, filename);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadText(text: string, filename: string, mime = "text/csv") {
  download(new Blob([text], { type: mime }), filename);
}
