---
name: PSD text scaling fix
description: Why scaleXText/scaleYText must NOT be applied to Konva node width/height in Canvas.tsx or PreviewCanvas.tsx
---

## Rule
`layer.width` and `layer.height` from PSD import are already the VISUAL (post-transform) bounds in canvas pixel space. Do NOT multiply them by `scaleXText`/`scaleYText` before passing to Konva `<Text>`. Always render with `scaleX=1, scaleY=1` on the node.

## Why
`getPsdTextBounds()` in NewTemplateModal.tsx returns bounds that have already been transformed by `getPsdTextFrame()` (which applies the PSD transform matrix). `scaleXText` = `getPsdTextScale(style) * transformScale.sx` represents the combined font horizontal scale + layer transform, but the width is already computed from the transformed bounds.

If you do `renderWidth = layer.width * scaleXText`, you're applying the transform scale a second time → double-scaling. On every resize (onTransformEnd), Konva adds another scale factor, making the selection box grow exponentially.

## How to apply
- Canvas.tsx TextNode: `width={Math.max(1, layer.width)} height={Math.max(1, layer.height)}` — no scaleX/Y prop on the Konva node.
- onTransformEnd: `width = layer.width * Math.abs(sx)`, `height = layer.height * Math.abs(sy)` — direct multiplication, no division by textScaleX/Y.
- PreviewCanvas.tsx: same — remove `scaleX={t.scaleXText ?? 1}` from the Konva Text node, and use `(layer as any).width * Math.abs(sx)` in onTransformEnd.
