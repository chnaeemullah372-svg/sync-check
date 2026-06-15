# Phase 1.5 — Designer Upgrades

## 1. New "Blank Template" import option

Add a **"Blank Template"** card to `NewTemplateModal` (alongside Card, One-Page, Member, FRC, PSD).

**Flow:**

- User clicks → file picker opens (PNG/JPG/WebP only — PSD is separate)
- After file pick → small dialog asks: **[Auto → fit A4]** or **[Custom → keep image's own size]**
- **Auto**: image becomes background, canvas = A4 portrait (595×842), image fits proportionally (centered, no crop)
- **Custom**: image becomes background, canvas = image's natural width × height
- No layer extraction — pure background

**PSD remains untouched:** opens at original PSD size with all layers as-is (current behavior is correct per user).

## 2. Canva-style grouping & locking

**Grouping** (two ways — both work):

- **From Layers Panel**: shift/cmd-click multiple layers → "Group" button at top of LayersSheet
- **From Canvas**: shift-click on canvas OR marquee-drag empty area → multiple selected → floating toolbar shows "Group" button
- Grouped layers move/rotate/scale together; double-click to enter group; "Ungroup" button when group is selected
- Implementation: add `groupId?: string` to Layer type; selection of any group member selects whole group

**Locking** (Canva-style):

- Lock icon on each layer row in LayersSheet (already exists — polish visuals)
- Lock icon also in floating canvas toolbar (already exists)
- Locked layer: `listening=false` (taps pass through), shows subtle lock badge on canvas when selected, can't be dragged/resized
- Click locked layer in LayersSheet → unlocks with single tap

**Selection visuals polish:**

- Canva-blue (#00C4CC) selection border, 1.5px, with crisp corner/edge handles
- Smaller handles (8px) for text, larger (12px) for images/shapes
- Rotation handle above top-center with circular arrow icon

## 3. Photoshop-style Toolbar (Phase A)

Add a **vertical toolbar** on the left edge of the canvas (collapsible, mobile-friendly):


| Tool                  | Behavior                                                                      |
| --------------------- | ----------------------------------------------------------------------------- |
| **Select** (V)        | Default arrow — current selection behavior                                    |
| **Rectangle Box** (R) | Click-drag on canvas → creates filled rectangle layer with current fill color |
| **Paint Bucket** (G)  | Tap on any shape/text layer → fills with current color from ColorSheet        |
| **Eyedropper** (I)    | Tap anywhere on canvas → picks pixel color, sets as current fill color        |


**Color state:** small swatch at bottom of toolbar shows current fill (tap → opens ColorSheet).

Tool selection lives in `dockState` (new `activeTool` field). Canvas reads `activeTool` and switches Stage event handlers accordingly.

## Technical notes

- **Files to edit:**
  - `NewTemplateModal.tsx` — add Blank Template option + auto/custom dialog
  - `lib/designer/types.ts` — add `groupId?: string` to Layer
  - `lib/designer/store.ts` — add `groupLayers()`, `ungroupLayers()`, `selectGroup()` actions
  - `canva/dockState.tsx` — add `activeTool` state + setter
  - `designer/Canvas.tsx` — wire activeTool to Stage handlers (rect-drag, fill-click, eyedropper-click), polish Transformer styles, group-aware selection
  - `canva/Sheets.tsx` (LayersSheet) — multi-select + Group/Ungroup buttons
  - `canva/BottomDock.tsx` — show Group/Ungroup in multi-select mode (already partially there)
  - **New file:** `components/designer/canva/LeftToolbar.tsx` — Select/Rect/Fill/Eyedropper buttons
  - `routes/_authenticated/designer.tsx` — mount `<LeftToolbar />`
- **Out of scope this turn** (next phases):
  - Ellipse/Line/Arrow shapes
  - Marquee/Lasso pixel selection
  - AI integration testing
  - PSD DPI tuning

## Deliverable

After approval I'll implement all three sections in parallel, then verify the preview loads cleanly.

&nbsp;

ٹھیک ہے ڈن کوئی چینجنگ مزید بھی اگر اپ کو کرنی پڑی تو اپ ٹینشن نہیں ہے اپ کے پاس اپروول ہے ٹھیک ہے اپ کو اپروول لینے کی ضرورت نہیں ہے اپ کے پاس اپروول ہے 100 پرسنٹ کوئی چیز چینجنگ کرنی پڑی مطلب اپ کو لگے گا کہ یہ بیٹر نہیں ہے تو اپ چینج کر سکتے ہو ٹھیک ہے 100 پرسنٹ اپروول ہے اپ کے پاس