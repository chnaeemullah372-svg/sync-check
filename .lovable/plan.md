Phase 1 — Canva-Style Designer (Mobile-First, Bottom-Sheet UX)

&nbsp;

دو corrections مان لیں:

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

PSD text editable رہے گا — image میں convert نہیں۔ Font/size مسئلہ algorithmic mapping سے حل۔

&nbsp;

&nbsp;

&nbsp;

Mobile-first bottom-sheet UI — side panels نہیں۔ Desktop پر بھی وہی dock نیچے، wider canvas۔

&nbsp;

A. Layout (Canva-clone)

&nbsp;

┌──────────────────────────────────────────────┐

│  🏠  ↶  ↷    ⋯  💬  ⤢  ⬆  ✓                 │  Top bar (56px)

├──────────────────────────────────────────────┤

│                                              │

│         [ Canvas — pan / pinch zoom ]        │

│         selected: purple frame +             │

│         floating chip {✎AI ⎘ 🗑 ⋯}           │

│         circular handles: ↻ ⤡                │

│                                              │

├──────────────────────────────────────────────┤

│  Bottom Dock (context-aware, swipe-up=sheet) │

└──────────────────────────────────────────────┘

&nbsp;

Bottom Dock states (horizontal scrollable row)

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Context

&nbsp;

&nbsp;

&nbsp;

Dock items

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Nothing selected

&nbsp;

&nbsp;

&nbsp;

Templates · Elements · Text · Gallery · Uploads · AI · Layers · More

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Page selected (canvas frame)

&nbsp;

&nbsp;

&nbsp;

Replace · Page Size · Background · Color · AI Instructions · More

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Text layer selected

&nbsp;

&nbsp;

&nbsp;

Edit · Font · Size · Color · Align · Spacing · Effects · AI Field

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Image layer selected

&nbsp;

&nbsp;

&nbsp;

Replace · Crop · Filter · Opacity · Position · AI Field

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Shape selected

&nbsp;

&nbsp;

&nbsp;

Fill · Stroke · Radius · Opacity · Position · AI Field

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Multi-select

&nbsp;

&nbsp;

&nbsp;

Group · Align · Distribute · Lock · Delete

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Group / Member slot

&nbsp;

&nbsp;

&nbsp;

Ungroup · Rename · Duplicate Slot · Add to Group · AI Instructions

&nbsp;

ہر dock item پر tap → اوپر کی طرف bottom-sheet کھلتی ہے (Canva style، swipe-down to dismiss)۔

&nbsp;

Sheets

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Font sheet: search + family list with live preview (English + Urdu fonts)، favorites، recently used۔

&nbsp;

&nbsp;

&nbsp;

Size sheet: slider + numeric + +/- buttons۔

&nbsp;

&nbsp;

&nbsp;

Color sheet: swatches + custom hex + eyedropper-like recent colors۔

&nbsp;

&nbsp;

&nbsp;

Layers sheet: drag-reorder list + eye/lock + checkbox-to-add-to-group + group expand۔

&nbsp;

&nbsp;

&nbsp;

AI Field sheet (per-layer): "Field name" dropdown (name/father_name/cnic/photo/…) + "Custom instruction" textarea + "Test with AI" button۔

&nbsp;

&nbsp;

&nbsp;

AI Instructions sheet (template-level): big textarea + "Check with AI" → AI confirms understanding + lets user paste sample data to test fill۔

&nbsp;

B. Canvas / Selection Engine (bug-fix area)

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Konva stage stays۔ Selection rewrite:

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Background image listening={false} → tap on empty area = deselect۔

&nbsp;

&nbsp;

&nbsp;

Tap layer = select that layer only۔

&nbsp;

&nbsp;

&nbsp;

Long-press (mobile) / right-click (desktop) = context menu۔

&nbsp;

&nbsp;

&nbsp;

Two-finger drag = pan؛ pinch = zoom (50% – 400%)۔

&nbsp;

&nbsp;

&nbsp;

Drag-marquee on empty area = multi-select۔

&nbsp;

&nbsp;

&nbsp;

Transform handles: 4 corner + 4 mid + top rotate (circular, larger touch targets — 28×28 on mobile)۔

&nbsp;

&nbsp;

&nbsp;

Snap to siblings/page center/edges (Canva pink guides)۔

&nbsp;

&nbsp;

&nbsp;

Smart-spacing detection when 3+ items aligned۔

&nbsp;

C. Group / Member Slot

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Multi-select → dock shows Group → creates a "Member N" slot (slotIndex)۔

&nbsp;

&nbsp;

&nbsp;

Layers sheet shows groups as collapsible nodes with rename inline + duplicate-slot۔

&nbsp;

&nbsp;

&nbsp;

Checkbox on each layer row in Layers sheet = "add to currently focused group"۔

&nbsp;

&nbsp;

&nbsp;

Ungroup, delete-slot, rename-slot via group's dock۔

&nbsp;

D. PSD Import (text-editable, algorithmically correct)

&nbsp;

Existing PSD parser is the bug source. Fix instead of bypass:

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Use ag-psd (already in project) text-layer data: font.name, font.size is in PostScript points at 72dpi, but layers' bounds are in document pixels۔ Multiply size by psdDocResolution / 72 mapping when needed۔

&nbsp;

&nbsp;

&nbsp;

Read PSD resolution (DPI) — common cause of huge text۔

&nbsp;

&nbsp;

&nbsp;

For each text run: keep family if browser has it; else map to nearest available font + log warning in import-summary toast۔

&nbsp;

&nbsp;

&nbsp;

Keep raw text editable; preserve color, weight, italics, alignment from engineData۔

&nbsp;

&nbsp;

&nbsp;

Image/shape layers as-is۔

&nbsp;

&nbsp;

&nbsp;

After import: show "Import summary" sheet — list of layers + which fonts substituted، user can re-map۔

&nbsp;

E. Fonts Library

&nbsp;

Google Fonts via <link> in __root.tsx head (per project rule — no URL @import in CSS):

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

English: Inter, Roboto, Poppins, Montserrat, Playfair Display, Oswald, Bebas Neue, Lora, Merriweather, Source Sans 3, Raleway, Nunito, Archivo, DM Sans, Space Grotesk۔

&nbsp;

&nbsp;

&nbsp;

Urdu/Arabic: Noto Nastaliq Urdu, Noto Naskh Arabic, Amiri, Scheherazade New, Gulzar, Mirza۔

&nbsp;

&nbsp;

&nbsp;

Font picker sheet: family list with live "نام / Name" preview، search، RTL toggle۔

&nbsp;

F. New Template Modal (single screen, tabs)

&nbsp;

NewTemplateModal.tsx:

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Tabs: Blank | Image | PSD | Size Preset | Canva Project (.canva.zip)۔ (Canva-project import is best-effort: parses zip, extracts pages as PNG backgrounds۔)

&nbsp;

&nbsp;

&nbsp;

Common bottom: Members count quick-pick (1/4/8/12/Custom) + Template name input۔

&nbsp;

&nbsp;

&nbsp;

Submit → opens /designer with staged data۔

&nbsp;

G. AI Hooks (UI only Phase 1)

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Per-layer AI Field sheet stores fieldKey + aiInstruction on layer۔

&nbsp;

&nbsp;

&nbsp;

Template-level "AI Instructions" stored on store + autosave۔

&nbsp;

&nbsp;

&nbsp;

"Check with AI" / "Test fill" buttons present but call wired in Phase 2۔

&nbsp;

H. Files Touched (Phase 1)

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

src/components/designer/Canvas.tsx — selection/touch/zoom engine fix

&nbsp;

&nbsp;

&nbsp;

src/components/designer/Toolbar.tsx → repurpose as TopBar

&nbsp;

&nbsp;

&nbsp;

NEW src/components/designer/BottomDock.tsx — context-aware row

&nbsp;

&nbsp;

&nbsp;

NEW src/components/designer/sheets/ — FontSheet, SizeSheet, ColorSheet, LayersSheet, AIFieldSheet, AIInstructionsSheet, EffectsSheet, AlignSheet

&nbsp;

&nbsp;

&nbsp;

src/components/designer/NewTemplateModal.tsx — tabbed

&nbsp;

&nbsp;

&nbsp;

src/lib/designer/store.ts — selection helpers, marquee, snap, group ops (most already exist)

&nbsp;

&nbsp;

&nbsp;

src/lib/designer/psd-staging.ts — fix DPI/font scaling

&nbsp;

&nbsp;

&nbsp;

src/routes/__root.tsx — Google Fonts link tags

&nbsp;

&nbsp;

&nbsp;

DELETE / hide old LeftTools.tsx, RightTools.tsx, LayerPanel.tsx, PropertiesPanel.tsx, NudgePad.tsx (replaced by sheets — keep code, remove from render)

&nbsp;

&nbsp;

&nbsp;

src/routes/_authenticated/designer.tsx — new layout shell

&nbsp;

Out of Scope (Phase 2+)

&nbsp;

&nbsp;

&nbsp;

&nbsp;

&nbsp;

Templates DB save/load polish, Admin Manage-Templates

&nbsp;

&nbsp;

&nbsp;

AI execution endpoint and real auto-fill

&nbsp;

&nbsp;

&nbsp;

Card vs FRC mode switch

&nbsp;

&nbsp;

&nbsp;

Export pipeline polish

&nbsp;

&nbsp;

&nbsp;

Approve کریں تو میں Phase 1 شروع کر دیتا ہوں۔ کام بہت ہے — تقریباً 12-15 files۔ پہلے structure (TopBar + BottomDock + sheet framework + canvas selection fix)، پھر sheets 

&nbsp;

فیز ون کمپلیٹ کر کے نا پھر اپ مجھے ننا اس کا ٹیسٹ کروا دینا تاکہ میں ڈائریکشن کنفرم کر پہلے اپ ٹیسٹ کر لینا پھر مجھے د