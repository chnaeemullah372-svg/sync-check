import type { Layer } from "./types";

export const DEFAULT_MEMBERS_PER_PAGE = 10;
export const MAX_TEMPLATE_MEMBERS = 20;

export function clampMemberCount(value: unknown, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(MAX_TEMPLATE_MEMBERS, Math.round(n)));
}

export function maxSlotIndex(layers: Layer[] | undefined) {
  return (layers ?? []).reduce((max, layer) => Math.max(max, Number(layer.slotIndex ?? 0) || 0), 0);
}

export function maxMemberNameIndex(memberNames: Record<number, string> | Record<string, string> | undefined) {
  return Object.keys(memberNames ?? {})
    .map(Number)
    .filter((n) => Number.isFinite(n) && n > 0)
    .reduce((a, b) => Math.max(a, b), 0);
}

export function inferMemberCountFromName(name?: string | null) {
  const match = /(?:^|\b)([1-9]|1\d|20)\s*(?:members?|ممبر)/i.exec(name ?? "");
  return match ? clampMemberCount(match[1]) : 0;
}

export function inferTemplateMemberCount(options: {
  snapshot?: any;
  templateName?: string | null;
  savedMemberCount?: number;
}) {
  const snapshot = options.snapshot ?? {};
  return clampMemberCount(
    Math.max(
      Number(snapshot.memberCount ?? 0) || 0,
      maxMemberNameIndex(snapshot.memberNames),
      maxSlotIndex(snapshot.layers),
      Number(options.savedMemberCount ?? 0) || 0,
      inferMemberCountFromName(options.templateName),
      1,
    ),
  );
}

export function inferMembersPerPage(snapshot?: any, saved?: number | null) {
  const slotCount = maxSlotIndex(snapshot?.layers);
  return clampMemberCount(saved ?? snapshot?.membersPerPage ?? Math.min(DEFAULT_MEMBERS_PER_PAGE, slotCount || DEFAULT_MEMBERS_PER_PAGE));
}

export function withMemberTemplateMeta(snapshot: any, templateName?: string | null, membersPerPage?: number | null) {
  const memberCount = inferTemplateMemberCount({ snapshot, templateName });
  const perPage = Math.min(DEFAULT_MEMBERS_PER_PAGE, inferMembersPerPage(snapshot, membersPerPage));
  const memberNames = { ...(snapshot?.memberNames ?? {}) } as Record<number, string>;
  for (let i = 1; i <= memberCount; i++) memberNames[i] = memberNames[i] ?? `Member ${i}`;
  return { ...(snapshot ?? {}), memberCount, membersPerPage: perPage, memberNames };
}

export function expandSingleSlotMemberLayers(snapshot: any, totalMembers: number, membersPerPage = DEFAULT_MEMBERS_PER_PAGE) {
  const layers = (snapshot?.layers ?? []) as Layer[];
  const slotCount = maxSlotIndex(layers);
  const perPage = Math.min(DEFAULT_MEMBERS_PER_PAGE, clampMemberCount(membersPerPage));
  const targetSlots = Math.min(perPage, clampMemberCount(totalMembers));
  if (slotCount !== 1 || targetSlots <= 1) return withMemberTemplateMeta(snapshot, undefined, perPage);

  const slotLayers = layers.filter((layer) => layer.slotIndex === 1);
  if (slotLayers.length === 0) return withMemberTemplateMeta(snapshot, undefined, perPage);

  const minY = Math.min(...slotLayers.map((layer) => layer.y));
  const maxY = Math.max(...slotLayers.map((layer) => layer.y + layer.height));
  const rowHeight = Math.max(1, maxY - minY);
  const canvasHeight = Number(snapshot?.canvasHeight ?? snapshot?.background?.height ?? 1123) || 1123;
  const available = Math.max(rowHeight, canvasHeight - minY - 18);
  const step = Math.max(rowHeight, Math.min(rowHeight + 10, available / targetSlots));

  const expanded = [...layers];
  for (let slot = 2; slot <= targetSlots; slot++) {
    for (const layer of slotLayers) {
      const copy: Layer = {
        ...layer,
        id: `${layer.id}__slot_${slot}`,
        name: layer.name.replace(/\b1\b/g, String(slot)),
        y: layer.y + step * (slot - 1),
        slotIndex: slot,
      } as Layer;
      if (copy.type === "text" && copy.fieldKey === "relation" && /self/i.test(copy.text)) {
        copy.text = "Relation";
      }
      expanded.push(copy);
    }
  }

  return withMemberTemplateMeta({ ...(snapshot ?? {}), layers: expanded }, undefined, perPage);
}