/**
 * Normalize a layer name (any language, mixed case) to a canonical AI field key.
 * Used by AI auto-fill to map incoming data (in any language/format) to the
 * correct layer on the canvas.
 */

const ALIASES: Record<string, string> = {
  // English
  name: "name", "full name": "name", "applicant name": "name",
  father: "father_name", "father name": "father_name", "father's name": "father_name", "f name": "father_name",
  cnic: "cnic", id: "cnic", "id number": "cnic", "id no": "cnic", "nic": "cnic",
  photo: "photo", picture: "photo", pic: "photo", image: "photo",
  signature: "signature", sign: "signature", sig: "signature",
  thumb: "thumb", thumbprint: "thumb", "thumb impression": "thumb",
  address: "address", addr: "address",
  dob: "dob", "date of birth": "dob", birthdate: "dob", "birth date": "dob",
  doi: "doi", "date of issue": "doi",
  phone: "phone", mobile: "phone", contact: "phone", "phone number": "phone",
  relation: "relation", relationship: "relation",
  email: "email", mail: "email",
  // Urdu
  "نام": "name",
  "ولدیت": "father_name", "والد": "father_name", "والد کا نام": "father_name",
  "شناختی": "cnic", "شناختی کارڈ": "cnic", "شناختی نمبر": "cnic",
  "تصویر": "photo",
  "دستخط": "signature",
  "انگوٹھا": "thumb", "انگوٹھے کا نشان": "thumb",
  "پتہ": "address", "ایڈریس": "address",
  "تاریخ پیدائش": "dob",
  "موبائل": "phone", "فون": "phone", "رابطہ": "phone",
  "ای میل": "email",
};

/** Lowercase, trim, collapse whitespace, strip punctuation. */
function clean(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, " ")
    .replace(/[^\p{L}\p{N} ]+/gu, "")
    .replace(/\s+/g, " ");
}

/** Snake-case any string for use as a key. */
function toSnake(raw: string): string {
  return clean(raw).replace(/\s+/g, "_");
}

/**
 * Map a free-form layer name to a canonical AI field key.
 * Returns the alias if matched, else snake_case of the cleaned name.
 */
export function nameToFieldKey(layerName: string): string {
  const c = clean(layerName);
  if (!c) return "";
  if (ALIASES[c]) return ALIASES[c];
  // try a few partial matches
  for (const key of Object.keys(ALIASES)) {
    if (c.includes(key)) return ALIASES[key];
  }
  return toSnake(c);
}

/** Build a name → fieldKey map for all canvas layers. */
export function buildLayerFieldMap(
  layers: Array<{ id: string; name: string; fieldKey?: string }>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const l of layers) {
    out[l.id] = l.fieldKey || nameToFieldKey(l.name);
  }
  return out;
}

/**
 * AI auto-fill payload contract — describes what an AI/data source must produce
 * to fill this template. Shape:
 *
 *   {
 *     members: [
 *       { key: "member_1", fields: { name, father_name, cnic, photo, signature, ... } },
 *       { key: "member_2", fields: { ... } }
 *     ],
 *     static: { title, form_no, ... }
 *   }
 *
 * - Each layer's `fieldKey` (auto-derived from its name via nameToFieldKey) is
 *   the field name inside its member's `fields`.
 * - Layers with `slotIndex === 0` (or undefined) go into `static`.
 * - Member key = snake_case of `memberNames[slot]` (default "Member 1" → "member_1").
 */
export interface MemberPayload {
  key: string;
  fields: Record<string, string>;
}
export interface FillPayload {
  members: MemberPayload[];
  static: Record<string, string>;
}

export function buildMemberShape(
  layers: Array<{ name: string; fieldKey?: string; slotIndex?: number }>,
  memberNames: Record<number, string>,
): FillPayload {
  const groups = new Map<number, Record<string, string>>();
  const stat: Record<string, string> = {};
  for (const l of layers) {
    const k = l.fieldKey || nameToFieldKey(l.name);
    if (!k) continue;
    const slot = l.slotIndex ?? 0;
    if (slot === 0) stat[k] = "";
    else {
      if (!groups.has(slot)) groups.set(slot, {});
      groups.get(slot)![k] = "";
    }
  }
  const members: MemberPayload[] = Array.from(groups.entries())
    .sort(([a], [b]) => a - b)
    .map(([slot, fields]) => ({
      key: nameToFieldKey(memberNames[slot] || `Member ${slot}`),
      fields,
    }));
  return { members, static: stat };
}
