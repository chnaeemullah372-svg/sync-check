import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";

const DB_DIR = path.join(process.cwd(), ".local-db");
const DB_FILE = path.join(DB_DIR, "templates.json");

export interface LocalTemplate {
  id: string;
  name: string;
  page_size: string;
  width: number;
  height: number;
  background_url: string | null;
  category: string | null;
  ai_instructions: string | null;
  members_per_page: number | null;
  status: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
}

export interface LocalTemplateObject {
  id: string;
  template_id: string;
  objects: unknown;
  version: number;
  updated_at: string;
}

interface LocalDb {
  templates: LocalTemplate[];
  template_objects: LocalTemplateObject[];
}

function loadDb(): LocalDb {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as LocalDb;
    }
  } catch {}
  return { templates: [], template_objects: [] };
}

function saveDb(db: LocalDb): void {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), "utf8");
}

export function localListTemplates(): LocalTemplate[] {
  const db = loadDb();
  seedNrcIfEmpty(db);
  return db.templates;
}

export function localGetTemplate(id: string): LocalTemplate | null {
  return loadDb().templates.find((t) => t.id === id) ?? null;
}

export function localGetTemplateObjects(templateId: string): LocalTemplateObject | null {
  return loadDb().template_objects.find((o) => o.template_id === templateId) ?? null;
}

export function localSaveTemplate(data: {
  templateId?: string;
  name: string;
  pageSize: string;
  width: number;
  height: number;
  backgroundUrl?: string | null;
  category?: string | null;
  aiInstructions?: string | null;
  membersPerPage?: number | null;
  snapshot: unknown;
  createdBy?: string | null;
}): string {
  const db = loadDb();
  const now = new Date().toISOString();

  if (data.templateId) {
    const idx = db.templates.findIndex((t) => t.id === data.templateId);
    if (idx >= 0) {
      db.templates[idx] = {
        ...db.templates[idx],
        name: data.name,
        page_size: data.pageSize,
        width: data.width,
        height: data.height,
        background_url: data.backgroundUrl ?? null,
        category: data.category ?? null,
        ai_instructions: data.aiInstructions ?? null,
        members_per_page: data.membersPerPage ?? null,
        updated_at: now,
      };
    }
    const oidx = db.template_objects.findIndex((o) => o.template_id === data.templateId);
    if (oidx >= 0) {
      db.template_objects[oidx] = {
        ...db.template_objects[oidx],
        objects: data.snapshot,
        version: (db.template_objects[oidx].version ?? 1) + 1,
        updated_at: now,
      };
    } else {
      db.template_objects.push({ id: randomUUID(), template_id: data.templateId, objects: data.snapshot, version: 1, updated_at: now });
    }
    saveDb(db);
    return data.templateId;
  }

  const id = randomUUID();
  db.templates.push({
    id,
    name: data.name,
    page_size: data.pageSize,
    width: data.width,
    height: data.height,
    background_url: data.backgroundUrl ?? null,
    category: data.category ?? null,
    ai_instructions: data.aiInstructions ?? null,
    members_per_page: data.membersPerPage ?? null,
    status: "active",
    created_by: data.createdBy ?? null,
    created_at: now,
    updated_at: now,
    archived_at: null,
  });
  db.template_objects.push({ id: randomUUID(), template_id: id, objects: data.snapshot, version: 1, updated_at: now });
  saveDb(db);
  return id;
}

export function localArchiveTemplate(templateId: string, archived: boolean): void {
  const db = loadDb();
  const idx = db.templates.findIndex((t) => t.id === templateId);
  if (idx >= 0) {
    db.templates[idx].archived_at = archived ? new Date().toISOString() : null;
    db.templates[idx].updated_at = new Date().toISOString();
    saveDb(db);
  }
}

export function localDeleteTemplate(templateId: string): void {
  const db = loadDb();
  db.templates = db.templates.filter((t) => t.id !== templateId);
  db.template_objects = db.template_objects.filter((o) => o.template_id !== templateId);
  saveDb(db);
}

export function localDuplicateTemplate(templateId: string): string {
  const db = loadDb();
  const src = db.templates.find((t) => t.id === templateId);
  if (!src) throw new Error("Template not found");
  const obj = db.template_objects.find((o) => o.template_id === templateId);
  const now = new Date().toISOString();
  const newId = randomUUID();
  db.templates.push({ ...src, id: newId, name: `${src.name} (copy)`, created_at: now, updated_at: now });
  if (obj) db.template_objects.push({ ...obj, id: randomUUID(), template_id: newId, updated_at: now });
  saveDb(db);
  return newId;
}

function seedNrcIfEmpty(db: LocalDb): void {
  if (db.templates.length > 0) return;

  const now = new Date().toISOString();
  const W = 1012, H = 638;

  const seeds = [
    { name: "NIC Front (psd3)", category: "nic-front", ai: "Pakistan National ID Card – Front side. Bilingual (English+Urdu). Fields: name_en (English name), name_ur (Urdu name), father_en, father_ur, gender, country_of_stay, identity_number (CNIC 13-digit), date_of_birth, date_of_issue, date_of_expiry. Photo placeholder: top-right. Signature placeholder: bottom-left." },
    { name: "NIC Back (psd3)", category: "nic-back", ai: "Pakistan National ID Card – Back side. Bilingual (English+Urdu). Fields: address_en, address_ur. Thumb placeholder: left side." },
    { name: "CNIC Front (ops2)", category: "cnic-front", ai: "Old-format Pakistan CNIC – Front side. Urdu-primary. Fields: name_ur (Urdu name), father_ur, identity_number, date_of_birth, date_of_issue, date_of_expiry. Photo placeholder: right side." },
    { name: "CNIC Back (ops2)", category: "cnic-back", ai: "Old-format Pakistan CNIC – Back side. Urdu-primary. Fields: address_ur. Thumb placeholder." },
  ];

  for (const s of seeds) {
    const id = randomUUID();
    db.templates.push({
      id,
      name: s.name,
      page_size: "custom",
      width: W,
      height: H,
      background_url: null,
      category: s.category,
      ai_instructions: s.ai,
      members_per_page: 1,
      status: "active",
      created_by: "system",
      created_at: now,
      updated_at: now,
      archived_at: null,
    });
    db.template_objects.push({
      id: randomUUID(),
      template_id: id,
      objects: { background: null, canvasWidth: W, canvasHeight: H, layers: [], memberNames: {} },
      version: 1,
      updated_at: now,
    });
  }

  saveDb(db);
}
