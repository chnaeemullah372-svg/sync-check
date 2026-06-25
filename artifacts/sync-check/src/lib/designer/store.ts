import { create } from "zustand";
import type { Background, Layer, SizePreset } from "./types";

interface Snapshot {
  background: Background;
  canvasWidth: number;
  canvasHeight: number;
  layers: Layer[];
  memberNames: Record<number, string>;
}

interface DesignerState extends Snapshot {
  sizePreset: SizePreset;
  selectedId: string | null;
  selectedIds: string[];
  userZoom: number;
  history: Snapshot[];
  future: Snapshot[];

  setBackground: (bg: Partial<Background>) => void;
  setSize: (preset: SizePreset, w?: number, h?: number) => void;
  addLayer: (layer: Layer) => void;
  updateLayer: (id: string, patch: Partial<Layer>) => void;
  deleteLayer: (id: string) => void;
  duplicateLayer: (id: string) => void;
  selectLayer: (id: string | null, additive?: boolean) => void;
  selectIds: (ids: string[]) => void;
  moveLayer: (id: string, direction: "up" | "down" | "front" | "back") => void;
  duplicateSlot: (srcSlot: number) => void;

  /** Group the currently selected layers into a new member slot. */
  groupAsMember: () => void;
  /** Ungroup a slot back to static (slotIndex=0). */
  ungroupSlot: (slot: number) => void;
  /** Delete every layer with the given slotIndex. */
  deleteSlot: (slot: number) => void;
  /** Rename a slot (display only). */
  renameSlot: (slot: number, name: string) => void;
  /** Select all layers of a slot. */
  selectSlot: (slot: number) => void;

  /** Move (translate) every layer of a slot by dx/dy. Used for group drag. */
  translateSlot: (slot: number, dx: number, dy: number) => void;

  zoomIn: () => void;
  zoomOut: () => void;
  zoomReset: () => void;
  setUserZoom: (z: number) => void;

  undo: () => void;
  redo: () => void;

  saveTemplateLocal: (name?: string) => string | null;
  loadTemplateLocal: (key: string) => boolean;
  listTemplatesLocal: () => Array<{ key: string; name: string; savedAt: number }>;

  saveMemberLocal: (slot: number) => string | null;

  loadState: (s: Partial<Snapshot>) => void;
}

export const A4_PORTRAIT = { w: 794, h: 1123 };
export const A4_LANDSCAPE = { w: 1123, h: 794 };
const LS_TEMPLATE_PREFIX = "designer.template.";
const LS_MEMBER_PREFIX = "designer.member.";
const HISTORY_LIMIT = 50;

function snap(s: DesignerState): Snapshot {
  return {
    background: { ...s.background },
    canvasWidth: s.canvasWidth,
    canvasHeight: s.canvasHeight,
    layers: s.layers.map((l) => ({ ...l })),
    memberNames: { ...s.memberNames },
  };
}

export const useDesigner = create<DesignerState>((set, get) => {
  /** Wrap a mutation so the previous state is pushed to history. */
  const withHistory = <T extends Partial<DesignerState>>(
    mutate: (s: DesignerState) => T,
  ) =>
    set((s) => {
      const prev = snap(s);
      const next = mutate(s);
      const history = [...s.history, prev].slice(-HISTORY_LIMIT);
      return { ...next, history, future: [] } as Partial<DesignerState>;
    });

  return {
    background: { src: null, width: A4_PORTRAIT.w, height: A4_PORTRAIT.h },
    sizePreset: "a4p",
    canvasWidth: A4_PORTRAIT.w,
    canvasHeight: A4_PORTRAIT.h,
    layers: [],
    memberNames: {},
    selectedId: null,
    selectedIds: [],
    userZoom: 1,
    history: [],
    future: [],

    setBackground: (bg) =>
      withHistory((s) => ({ background: { ...s.background, ...bg } })),

    setSize: (preset, w, h) =>
      withHistory((s) => {
        if (preset === "a4p")
          return { sizePreset: preset, canvasWidth: A4_PORTRAIT.w, canvasHeight: A4_PORTRAIT.h };
        if (preset === "a4l")
          return { sizePreset: preset, canvasWidth: A4_LANDSCAPE.w, canvasHeight: A4_LANDSCAPE.h };
        if (preset === "original" && s.background.src)
          return { sizePreset: preset, canvasWidth: s.background.width, canvasHeight: s.background.height };
        if (preset === "custom" && w && h)
          return { sizePreset: preset, canvasWidth: w, canvasHeight: h };
        return {};
      }),

    addLayer: (layer) =>
      withHistory((s) => ({
        layers: [...s.layers, layer],
        selectedId: layer.id,
        selectedIds: [layer.id],
      })),

    updateLayer: (id, patch) =>
      withHistory((s) => ({
        layers: s.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as Layer) : l)),
      })),

    deleteLayer: (id) =>
      withHistory((s) => ({
        layers: s.layers.filter((l) => l.id !== id),
        selectedId: s.selectedId === id ? null : s.selectedId,
        selectedIds: s.selectedIds.filter((x) => x !== id),
      })),

    duplicateLayer: (id) =>
      withHistory((s) => {
        const src = s.layers.find((l) => l.id === id);
        if (!src) return {};
        const copy = {
          ...src,
          id: crypto.randomUUID(),
          name: src.name + " copy",
          x: src.x + 20,
          y: src.y + 20,
        } as Layer;
        return { layers: [...s.layers, copy], selectedId: copy.id, selectedIds: [copy.id] };
      }),

    selectLayer: (id, additive = false) =>
      set((s) => {
        if (id === null) return { selectedId: null, selectedIds: [] };
        if (additive) {
          const ids = s.selectedIds.includes(id)
            ? s.selectedIds.filter((x) => x !== id)
            : [...s.selectedIds, id];
          return { selectedId: ids[ids.length - 1] ?? null, selectedIds: ids };
        }
        return { selectedId: id, selectedIds: [id] };
      }),

    selectIds: (ids) =>
      set({ selectedIds: ids, selectedId: ids[ids.length - 1] ?? null }),

    moveLayer: (id, direction) =>
      withHistory((s) => {
        const idx = s.layers.findIndex((l) => l.id === id);
        if (idx === -1) return {};
        const arr = [...s.layers];
        const [item] = arr.splice(idx, 1);
        if (direction === "up") arr.splice(Math.min(arr.length, idx + 1), 0, item);
        else if (direction === "down") arr.splice(Math.max(0, idx - 1), 0, item);
        else if (direction === "front") arr.push(item);
        else arr.unshift(item);
        return { layers: arr };
      }),

    duplicateSlot: (srcSlot) =>
      withHistory((s) => {
        const slotLayers = s.layers.filter((l) => l.slotIndex === srcSlot);
        if (slotLayers.length === 0) return {};
        const maxSlot = s.layers.reduce((m, l) => Math.max(m, l.slotIndex ?? 0), 0);
        const newSlot = maxSlot + 1;
        const offset = 20;
        const copies = slotLayers.map((l) => ({
          ...l,
          id: crypto.randomUUID(),
          slotIndex: newSlot,
          x: l.x + offset,
          y: l.y + offset,
        })) as Layer[];
        const memberNames = {
          ...s.memberNames,
          [newSlot]: s.memberNames[srcSlot]
            ? `${s.memberNames[srcSlot]} copy`
            : `Member ${newSlot}`,
        };
        return {
          layers: [...s.layers, ...copies],
          selectedId: copies[0]?.id ?? null,
          selectedIds: copies.map((c) => c.id),
          memberNames,
        };
      }),

    groupAsMember: () =>
      withHistory((s) => {
        if (s.selectedIds.length === 0) return {};
        const maxSlot = s.layers.reduce((m, l) => Math.max(m, l.slotIndex ?? 0), 0);
        const newSlot = maxSlot + 1;
        // Pick next "Member N" not already used as a name
        const usedNums = new Set<number>();
        for (const v of Object.values(s.memberNames)) {
          const m = /^Member\s+(\d+)$/.exec(v || "");
          if (m) usedNums.add(Number(m[1]));
        }
        let n = 1;
        while (usedNums.has(n)) n++;
        const ids = new Set(s.selectedIds);
        return {
          layers: s.layers.map((l) =>
            ids.has(l.id) ? ({ ...l, slotIndex: newSlot } as Layer) : l,
          ),
          memberNames: { ...s.memberNames, [newSlot]: `Member ${n}` },
        };
      }),

    ungroupSlot: (slot) =>
      withHistory((s) => {
        const { [slot]: _, ...rest } = s.memberNames;
        return {
          layers: s.layers.map((l) =>
            l.slotIndex === slot ? ({ ...l, slotIndex: 0 } as Layer) : l,
          ),
          memberNames: rest,
        };
      }),

    deleteSlot: (slot) =>
      withHistory((s) => {
        const { [slot]: _, ...rest } = s.memberNames;
        return {
          layers: s.layers.filter((l) => l.slotIndex !== slot),
          memberNames: rest,
          selectedId: null,
          selectedIds: [],
        };
      }),

    renameSlot: (slot, name) =>
      set((s) => ({ memberNames: { ...s.memberNames, [slot]: name } })),

    selectSlot: (slot) =>
      set((s) => {
        const ids = s.layers.filter((l) => l.slotIndex === slot).map((l) => l.id);
        return { selectedIds: ids, selectedId: ids[ids.length - 1] ?? null };
      }),

    translateSlot: (slot, dx, dy) =>
      withHistory((s) => ({
        layers: s.layers.map((l) =>
          l.slotIndex === slot ? ({ ...l, x: l.x + dx, y: l.y + dy } as Layer) : l,
        ),
      })),

    zoomIn: () => set((s) => ({ userZoom: Math.min(4, +(s.userZoom + 0.1).toFixed(2)) })),
    zoomOut: () => set((s) => ({ userZoom: Math.max(0.1, +(s.userZoom - 0.1).toFixed(2)) })),
    zoomReset: () => set({ userZoom: 1 }),
    setUserZoom: (z) => set({ userZoom: Math.max(0.1, Math.min(4, z)) }),

    undo: () =>
      set((s) => {
        if (s.history.length === 0) return {};
        const prev = s.history[s.history.length - 1];
        const current = snap(s);
        return {
          ...prev,
          history: s.history.slice(0, -1),
          future: [...s.future, current].slice(-HISTORY_LIMIT),
          selectedId: null,
          selectedIds: [],
        };
      }),

    redo: () =>
      set((s) => {
        if (s.future.length === 0) return {};
        const next = s.future[s.future.length - 1];
        const current = snap(s);
        return {
          ...next,
          history: [...s.history, current].slice(-HISTORY_LIMIT),
          future: s.future.slice(0, -1),
          selectedId: null,
          selectedIds: [],
        };
      }),

    saveTemplateLocal: (name) => {
      const s = get();
      const ts = Date.now();
      const key = LS_TEMPLATE_PREFIX + ts;
      const payload = {
        name: name || `Template ${new Date(ts).toLocaleString()}`,
        savedAt: ts,
        background: s.background,
        canvasWidth: s.canvasWidth,
        canvasHeight: s.canvasHeight,
        layers: s.layers,
        memberNames: s.memberNames,
      };
      try {
        localStorage.setItem(key, JSON.stringify(payload));
      } catch (e) {
        console.error("Save failed", e);
        return null;
      }
      return key;
    },

    loadTemplateLocal: (key) => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return false;
        const p = JSON.parse(raw);
        set({
          background: p.background,
          canvasWidth: p.canvasWidth,
          canvasHeight: p.canvasHeight,
          layers: p.layers,
          memberNames: p.memberNames || {},
          selectedId: null,
          selectedIds: [],
          history: [],
          future: [],
        });
        return true;
      } catch {
        return false;
      }
    },

    listTemplatesLocal: () => {
      const out: Array<{ key: string; name: string; savedAt: number }> = [];
      if (typeof localStorage === "undefined") return out;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith(LS_TEMPLATE_PREFIX)) continue;
        try {
          const p = JSON.parse(localStorage.getItem(k) || "{}");
          out.push({ key: k, name: p.name || k, savedAt: p.savedAt || 0 });
        } catch (e) {
          console.warn("Skipped broken template", k, e);
        }
      }
      return out.sort((a, b) => b.savedAt - a.savedAt);
    },

    saveMemberLocal: (slot) => {
      const s = get();
      const slotLayers = s.layers.filter((l) => l.slotIndex === slot);
      if (slotLayers.length === 0) return null;
      const ts = Date.now();
      const key = LS_MEMBER_PREFIX + ts;
      const payload = {
        name: s.memberNames[slot] || `Member ${slot}`,
        slot,
        savedAt: ts,
        layers: slotLayers,
      };
      try {
        localStorage.setItem(key, JSON.stringify(payload));
      } catch (e) {
        console.error(e);
      }
      return key;
    },

    loadState: (st) =>
      set((s) => ({
        background: st.background ?? s.background,
        canvasWidth: st.canvasWidth ?? s.canvasWidth,
        canvasHeight: st.canvasHeight ?? s.canvasHeight,
        layers: st.layers ?? s.layers,
        memberNames: st.memberNames ?? s.memberNames,
        selectedId: null,
        selectedIds: [],
        history: [],
        future: [],
      })),
  };
});

export function makeId() {
  return crypto.randomUUID();
}
