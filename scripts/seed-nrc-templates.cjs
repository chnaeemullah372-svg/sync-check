/**
 * Seed NRC card templates: psd3 (newer Pakistan NIC) + ops2 (older CNIC).
 * Inserts via Supabase REST API — no DB connection required.
 *
 * Usage (after running migrations in Supabase dashboard):
 *   node scripts/seed-nrc-templates.cjs
 *
 * Env vars (auto-loaded from artifacts/sync-check/.env if present):
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

"use strict";
const fs = require("fs");
const path = require("path");

// ── Load .env if vars not already set ────────────────────────────────────────
const envPath = path.join(__dirname, "../artifacts/sync-check/.env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("❌  SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set");
  process.exit(1);
}

const headers = {
  "Content-Type": "application/json",
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  Prefer: "return=representation",
};

// ── tiny uuid-like id generator ───────────────────────────────────────────────
let _c = 0;
function mkid() {
  return `s${++_c}${Date.now().toString(36)}`;
}

// ── Layer helpers ─────────────────────────────────────────────────────────────
function txt(id, name, text, x, y, w, h, opts = {}) {
  const { fieldKey = "", fontSize = 14, fontFamily = "Arial", fill = "#0d0d0d",
    align = "left", fontStyle = "normal", rtl = false, ...rest } = opts;
  return { id, name, type: "text", text, x, y, width: w, height: h,
    rotation: 0, opacity: 1, visible: true, locked: false,
    fontSize, fontFamily, fill, align, fontStyle, rtl, fieldKey, ...rest };
}

function img(id, name, x, y, w, h, opts = {}) {
  const { fieldKey = "", fit = "cover", subtype = "photo",
    shareGroup = "", faceCrop = "none", ...rest } = opts;
  return { id, name, type: "image", src: null, x, y, width: w, height: h,
    rotation: 0, opacity: 1, visible: true, locked: false,
    fit, subtype, fieldKey, shareGroup, faceCrop, ...rest };
}

function box(id, name, x, y, w, h, opts = {}) {
  const { fill = "transparent", stroke = "#cccccc", strokeWidth = 1 } = opts;
  return { id, name, type: "box", fill, stroke, strokeWidth,
    x, y, width: w, height: h, rotation: 0, opacity: 1, visible: true, locked: true };
}

// ── Standard ID card canvas: 1012 × 638 (85.6 × 54 mm @ 300 DPI) ─────────────
const W = 1012;
const H = 638;

const URD_NASK = "Noto Nastaliq Urdu";   // newer / digital Urdu
const URD_NAST = "Jameel Noori Nastaleeq"; // calligraphic Urdu (ops2)
const EN       = "Arial";

// ══════════════════════════════════════════════════════════════════════════════
//  TEMPLATE 1: psd3 — Pakistan NIC FRONT (English + Urdu bilingual)
// ══════════════════════════════════════════════════════════════════════════════
const psd3FrontLayers = [
  // ── static header text (comes from card background PSD, added for fallback) ──
  txt(mkid(), "Header: PAKISTAN", "PAKISTAN", 180, 14, 440, 30,
    { fontSize: 22, fontStyle: "bold", fontFamily: EN, align: "center" }),
  txt(mkid(), "Header: National Identity Card", "National Identity Card", 180, 44, 440, 22,
    { fontSize: 14, fontFamily: EN, align: "center", fill: "#111" }),
  txt(mkid(), "Header: Islamic Republic", "ISLAMIC REPUBLIC OF PAKISTAN", 180, 64, 440, 16,
    { fontSize: 9, fontFamily: EN, align: "center", fill: "#444" }),

  // ── field labels (small gray) ──────────────────────────────────────────────
  txt(mkid(), "Label: Name",            "Name",            122, 152, 90,  14, { fontSize: 9, fill: "#666" }),
  txt(mkid(), "Label: Father Name",     "Father Name",     122, 210, 140, 14, { fontSize: 9, fill: "#666" }),
  txt(mkid(), "Label: Gender",          "Gender",          122, 272, 80,  13, { fontSize: 9, fill: "#666" }),
  txt(mkid(), "Label: Country of Stay", "Country of Stay", 248, 272, 150, 13, { fontSize: 9, fill: "#666" }),
  txt(mkid(), "Label: Identity Number", "Identity Number", 122, 330, 140, 13, { fontSize: 9, fill: "#666" }),
  txt(mkid(), "Label: Date of Birth",   "Date of Birth",   394, 330, 130, 13, { fontSize: 9, fill: "#666" }),
  txt(mkid(), "Label: Date of Issue",   "Date of Issue",   122, 390, 130, 13, { fontSize: 9, fill: "#666" }),
  txt(mkid(), "Label: Date of Expiry",  "Date of Expiry",  394, 390, 135, 13, { fontSize: 9, fill: "#666" }),
  txt(mkid(), "Label: Holder Signature","Holder's Signature", 652, 576, 248, 16,
    { fontSize: 9, fill: "#666", align: "center" }),

  // ── variable fields — English ──────────────────────────────────────────────
  txt(mkid(), "Name (English)", "Fahad Ali", 122, 168, 358, 28,
    { fontSize: 16, fontStyle: "bold", fontFamily: EN, fieldKey: "name" }),

  txt(mkid(), "Father Name (English)", "Muhammad Akram", 122, 226, 358, 26,
    { fontSize: 14, fontFamily: EN, fieldKey: "father_name" }),

  txt(mkid(), "Gender", "M", 122, 288, 90, 24,
    { fontSize: 14, fontFamily: EN, fieldKey: "custom_1" }),
  txt(mkid(), "Country (static)", "Pakistan", 248, 288, 165, 24,
    { fontSize: 14, fontFamily: EN }),

  txt(mkid(), "CNIC", "35501-2724176-7", 122, 346, 255, 26,
    { fontSize: 14, fontStyle: "bold", fontFamily: EN, fieldKey: "cnic" }),
  txt(mkid(), "Date of Birth", "30-10-1998", 394, 346, 188, 26,
    { fontSize: 14, fontFamily: EN, fieldKey: "dob" }),

  txt(mkid(), "Date of Issue", "03-02-2018", 122, 406, 222, 26,
    { fontSize: 14, fontFamily: EN, fieldKey: "doi" }),
  txt(mkid(), "Date of Expiry", "03-02-2028", 394, 406, 222, 26,
    { fontSize: 14, fontFamily: EN }),

  // ── variable fields — Urdu (RTL, right-aligned) ───────────────────────────
  txt(mkid(), "Name (Urdu)", "فہاد علی", 638, 150, 220, 36,
    { fontSize: 16, fontFamily: URD_NASK, rtl: true, align: "right", fieldKey: "name" }),

  txt(mkid(), "Father Name (Urdu)", "محمد اکرم", 638, 208, 220, 32,
    { fontSize: 15, fontFamily: URD_NASK, rtl: true, align: "right", fieldKey: "father_name" }),

  // ── image placeholders ─────────────────────────────────────────────────────
  img(mkid(), "Photo (main)",     730, 58,  245, 302, { subtype: "photo",     fit: "cover",    faceCrop: "passport", fieldKey: "photo" }),
  img(mkid(), "Photo (small)",     18, 355,  88, 108, { subtype: "photo",     fit: "cover",    faceCrop: "passport", shareGroup: "photo_main", fieldKey: "photo" }),
  img(mkid(), "Signature",        648, 490, 268,  80, { subtype: "signature", fit: "contain", fieldKey: "signature" }),
];

// ══════════════════════════════════════════════════════════════════════════════
//  TEMPLATE 2: psd3 — Pakistan NIC BACK
// ══════════════════════════════════════════════════════════════════════════════
const psd3BackLayers = [
  // ── CNIC top-right ─────────────────────────────────────────────────────────
  txt(mkid(), "CNIC (top right)", "35501-2724176-7", 630, 14, 368, 28,
    { fontSize: 16, fontStyle: "bold", fontFamily: EN, align: "right", fieldKey: "cnic" }),

  // ── small photo top-left ───────────────────────────────────────────────────
  img(mkid(), "Photo (small back)", 14, 12, 108, 138,
    { subtype: "photo", fit: "cover", faceCrop: "passport", shareGroup: "photo_main", fieldKey: "photo" }),

  // ── present address ─────────────────────────────────────────────────────────
  txt(mkid(), "Label: موجودہ پتہ", "موجودہ پتہ :", 838, 62, 158, 26,
    { fontSize: 13, fontFamily: URD_NASK, rtl: true, align: "right", fill: "#333" }),
  txt(mkid(), "Present Address", "گلی کا پتہ - 516 بلاک فیزو وی ڈی ایچ\nاے موجودہ ضلع لاہور",
    138, 62, 680, 68,
    { fontSize: 13, fontFamily: URD_NASK, rtl: true, align: "right", fieldKey: "address" }),

  // ── divider line ───────────────────────────────────────────────────────────
  box(mkid(), "Divider", 14, 136, 984, 1, { stroke: "#aaa", strokeWidth: 1 }),

  // ── permanent address ───────────────────────────────────────────────────────
  txt(mkid(), "Label: مستقل پتہ", "مستقل پتہ :", 838, 148, 158, 26,
    { fontSize: 13, fontFamily: URD_NASK, rtl: true, align: "right", fill: "#333" }),
  txt(mkid(), "Permanent Address", "گلی کا پتہ - 516 بلاک فیزو وی ڈی ایچ\nاے موجودہ ضلع لاہور",
    138, 148, 680, 68,
    { fontSize: 13, fontFamily: URD_NASK, rtl: true, align: "right", fieldKey: "custom_2" }),

  // ── QR code (right side) ───────────────────────────────────────────────────
  img(mkid(), "QR Code", 840, 56, 158, 160,
    { subtype: "asset", fit: "contain" }),

  // ── household / second number ──────────────────────────────────────────────
  txt(mkid(), "Household Number", "104141554210", 695, 344, 305, 28,
    { fontSize: 16, fontStyle: "bold", fontFamily: EN, align: "right", fieldKey: "custom_1" }),

  // ── registrar general ──────────────────────────────────────────────────────
  img(mkid(), "Registrar Signature (asset)", 18, 340, 235, 88,
    { subtype: "asset", fit: "contain" }),
  txt(mkid(), "Registrar General of Pakistan", "Registrar General of Pakistan",
    15, 432, 255, 20, { fontSize: 10, fontFamily: EN, fill: "#333" }),

  // ── lost-card notice (bottom Urdu text) ────────────────────────────────────
  txt(mkid(), "Lost Card Notice", "گمشدہ کارڈ ملنے پر قریبی لیٹر بکس میں ڈال دیں",
    90, 570, 840, 52,
    { fontSize: 26, fontFamily: URD_NASK, rtl: true, align: "center", fill: "#111" }),
];

// ══════════════════════════════════════════════════════════════════════════════
//  TEMPLATE 3: ops2 — Old CNIC FRONT (Urdu / Nastaleeq)
// ══════════════════════════════════════════════════════════════════════════════
const ops2FrontLayers = [
  // ── static headers (center, RTL) ───────────────────────────────────────────
  txt(mkid(), "Header: حکومت پاکستان", "حکومت پاکستان", 220, 12, 575, 36,
    { fontSize: 26, fontStyle: "bold", fontFamily: URD_NAST, rtl: true, align: "center", fill: "#0a0a0a" }),
  txt(mkid(), "Header: قومی شناختی کارڈ", "قومی شناختی کارڈ", 220, 48, 575, 28,
    { fontSize: 18, fontFamily: URD_NAST, rtl: true, align: "center", fill: "#111" }),

  // ── CNIC number (center, bold) ─────────────────────────────────────────────
  txt(mkid(), "CNIC Number", "56101-2150790-7", 226, 84, 560, 30,
    { fontSize: 18, fontStyle: "bold", fontFamily: EN, align: "center", fieldKey: "cnic" }),

  box(mkid(), "Divider Top", 14, 122, 984, 1, { stroke: "#888", strokeWidth: 1 }),

  // ── photo top-left ─────────────────────────────────────────────────────────
  img(mkid(), "Photo", 16, 38, 190, 240,
    { subtype: "photo", fit: "cover", faceCrop: "passport", fieldKey: "photo" }),

  // ── data rows (RTL: label on right, value fills left) ─────────────────────
  // نام  (Name)
  txt(mkid(), "Label: نام", "نام :", 860, 135, 130, 26,
    { fontSize: 16, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "Name", "بی بی گلہ", 238, 135, 600, 30,
    { fontSize: 18, fontFamily: URD_NAST, rtl: true, align: "right", fieldKey: "name" }),

  // جنس  (Gender)
  txt(mkid(), "Label: جنس", "جنس :", 860, 178, 130, 26,
    { fontSize: 16, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "Gender", "عورت", 238, 178, 300, 28,
    { fontSize: 17, fontFamily: URD_NAST, rtl: true, align: "right", fieldKey: "custom_1" }),

  // والد/شوہر کانام (Father/Husband Name)
  txt(mkid(), "Label: والد/شوہر کانام", "والد/شوہر کانام :", 860, 222, 150, 26,
    { fontSize: 14, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "Father/Husband Name", "عبد الکریم", 238, 222, 600, 30,
    { fontSize: 17, fontFamily: URD_NAST, rtl: true, align: "right", fieldKey: "father_name" }),

  // شناختی علامت (Distinguishing Mark)
  txt(mkid(), "Label: شناختی علامت", "شناختی علامت :", 860, 265, 150, 26,
    { fontSize: 14, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "Distinguishing Mark", "کوئی نہیں", 238, 265, 600, 28,
    { fontSize: 16, fontFamily: URD_NAST, rtl: true, align: "right", fieldKey: "custom_2" }),

  box(mkid(), "Divider Mid", 14, 302, 984, 1, { stroke: "#aaa", strokeWidth: 1 }),

  // امتیاز  (Special Designator / Title row)
  txt(mkid(), "Special Designator", "امتیاز تاجور", 500, 315, 480, 38,
    { fontSize: 24, fontStyle: "bold", fontFamily: URD_NAST, rtl: true, align: "right", fieldKey: "custom_3" }),

  // تاریخ پیدائش (Date of Birth)
  txt(mkid(), "Label: تاریخ پیدائش", "تاریخ پیدائش :", 640, 368, 225, 26,
    { fontSize: 14, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "Date of Birth", "01/07/1962", 238, 368, 375, 30,
    { fontSize: 17, fontFamily: EN, align: "left", fieldKey: "dob" }),

  // ── fingerprint / thumb (bottom-left) ────────────────────────────────────
  img(mkid(), "Thumb (fingerprint)", 16, 402, 172, 200,
    { subtype: "thumb", fit: "contain", fieldKey: "thumb" }),

  // ── holder signature (bottom) ─────────────────────────────────────────────
  txt(mkid(), "Label: دستخط حامل کارڈ", "دستخط حامل کارڈ", 14, 614, 200, 20,
    { fontSize: 10, fontFamily: URD_NAST, rtl: true, fill: "#333" }),
  img(mkid(), "Holder Signature", 15, 535, 195, 78,
    { subtype: "signature", fit: "contain", fieldKey: "signature" }),

  // ── registrar general (bottom-right) ──────────────────────────────────────
  txt(mkid(), "Label: دستخط رجسٹرار جنرل", "دستخط رجسٹرار جنرل", 800, 614, 210, 20,
    { fontSize: 10, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#333" }),
];

// ══════════════════════════════════════════════════════════════════════════════
//  TEMPLATE 4: ops2 — Old CNIC BACK (Urdu)
// ══════════════════════════════════════════════════════════════════════════════
const ops2BackLayers = [
  // ── top row: CNIC + Family number ─────────────────────────────────────────
  txt(mkid(), "Label: شناختی نمبر", "شناختی نمبر :", 1000, 14, 160, 26,
    { fontSize: 13, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "CNIC", "56101-2150790-7", 500, 14, 480, 26,
    { fontSize: 15, fontStyle: "bold", fontFamily: EN, align: "right", fieldKey: "cnic" }),

  txt(mkid(), "Label: خاندان نمبر", "خاندان نمبر :", 480, 14, 150, 26,
    { fontSize: 13, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "Family Number", "R8X37M", 14, 14, 305, 26,
    { fontSize: 15, fontStyle: "bold", fontFamily: EN, fieldKey: "custom_1" }),

  box(mkid(), "Divider Top", 14, 48, 984, 1, { stroke: "#888", strokeWidth: 1 }),

  // ── small photo top-left ───────────────────────────────────────────────────
  img(mkid(), "Photo (small back)", 14, 56, 105, 135,
    { subtype: "photo", fit: "cover", faceCrop: "passport", shareGroup: "photo_main", fieldKey: "photo" }),

  // ── present address ─────────────────────────────────────────────────────────
  txt(mkid(), "Label: موجودہ پتہ", "موجودہ پتہ :", 998, 64, 155, 26,
    { fontSize: 13, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "Present Address", "محلہ گلی شیطان رئیسانی کوئٹہ", 138, 64, 838, 62,
    { fontSize: 14, fontFamily: URD_NAST, rtl: true, align: "right", fieldKey: "address" }),

  box(mkid(), "Divider 2", 14, 135, 984, 1, { stroke: "#bbb", strokeWidth: 1 }),

  // ── permanent address ───────────────────────────────────────────────────────
  txt(mkid(), "Label: مستقل پتہ", "مستقل پتہ :", 998, 148, 155, 26,
    { fontSize: 13, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "Permanent Address", "کچہ روڈ نصر اللہ خان چوک پشتون آباد کوئٹہ", 138, 148, 838, 62,
    { fontSize: 14, fontFamily: URD_NAST, rtl: true, align: "right", fieldKey: "custom_2" }),

  // ── fingerprint (large, right area) ──────────────────────────────────────
  img(mkid(), "Thumb (large)", 700, 210, 295, 340,
    { subtype: "thumb", fit: "contain", fieldKey: "thumb" }),

  // ── مستقل: Signature / sign area ─────────────────────────────────────────
  txt(mkid(), "Label: مستقلی پتہ دستخط", "مستقلی پتہ دستخط :", 660, 222, 220, 22,
    { fontSize: 12, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  img(mkid(), "Permanent Address Signature", 14, 220, 220, 90,
    { subtype: "signature", fit: "contain" }),

  // ── dates bottom ──────────────────────────────────────────────────────────
  txt(mkid(), "Label: تاریخ اجراء", "تاریخ اجراء :", 450, 555, 200, 26,
    { fontSize: 13, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "Date of Issue", "19/04/2019", 14, 555, 225, 26,
    { fontSize: 15, fontFamily: EN, fieldKey: "doi" }),

  txt(mkid(), "Label: تاریخ تنسیخ", "تاریخ تنسیخ :", 850, 555, 200, 26,
    { fontSize: 13, fontFamily: URD_NAST, rtl: true, align: "right", fill: "#444" }),
  txt(mkid(), "Date of Expiry", "تاحیات", 455, 555, 380, 26,
    { fontSize: 14, fontFamily: URD_NAST, rtl: true, align: "right" }),

  // ── lost-card notice ──────────────────────────────────────────────────────
  txt(mkid(), "Lost Card Notice", "گمشدہ کارڈ ملنے پر قریبی لیٹر بکس میں ڈال دیں",
    90, 592, 840, 38,
    { fontSize: 24, fontFamily: URD_NAST, rtl: true, align: "center", fill: "#111" }),

  // ── barcode (bottom) ──────────────────────────────────────────────────────
  img(mkid(), "Barcode", 14, 630, 984, 8,
    { subtype: "asset", fit: "stretch" }),
];

// ── Template definitions ──────────────────────────────────────────────────────
const TEMPLATES = [
  {
    name: "NIC Front (psd3)",
    page_size: "custom",
    width: W,
    height: H,
    category: "nrc",
    ai_instructions: "Pakistan National Identity Card — newer bilingual design. Auto-fill: name (English + Urdu), father_name (English + Urdu), cnic, dob, doi, gender (custom_1). Photo, signature image layers present.",
    layers: psd3FrontLayers,
  },
  {
    name: "NIC Back (psd3)",
    page_size: "custom",
    width: W,
    height: H,
    category: "nrc",
    ai_instructions: "Pakistan NIC back — newer design. Auto-fill: cnic, address (present), custom_2 (permanent address), custom_1 (household number). QR code, photo, registrar signature placeholders present.",
    layers: psd3BackLayers,
  },
  {
    name: "CNIC Front (ops2)",
    page_size: "custom",
    width: W,
    height: H,
    category: "nrc",
    ai_instructions: "Pakistan old CNIC front — Urdu Nastaleeq design. Auto-fill: cnic, name, father_name, dob, gender (custom_1), distinguishing mark (custom_2), special title (custom_3). Photo and thumb fingerprint placeholders present.",
    layers: ops2FrontLayers,
  },
  {
    name: "CNIC Back (ops2)",
    page_size: "custom",
    width: W,
    height: H,
    category: "nrc",
    ai_instructions: "Pakistan old CNIC back — Urdu design. Auto-fill: cnic, address (present), custom_2 (permanent address), custom_1 (family number), doi. Thumb fingerprint, barcode placeholders present.",
    layers: ops2BackLayers,
  },
];

// ── Supabase REST helpers ─────────────────────────────────────────────────────
async function supaPost(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function supaGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "GET",
    headers: { ...headers, Prefer: "return=representation" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${text}`);
  return JSON.parse(text);
}

async function supaDelete(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: "DELETE",
    headers: { ...headers, Prefer: "return=representation" },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`DELETE ${path} → ${res.status}: ${t}`);
  }
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n🚀  Seeding NRC templates → ${SUPABASE_URL}\n`);

  // 1. Check table exists
  try {
    await supaGet("/templates?select=id&limit=1");
  } catch (e) {
    console.error("❌  templates table not found. Run migrations first:\n");
    console.error("   Supabase Dashboard → SQL Editor → paste all_migrations_combined.txt\n");
    process.exit(1);
  }

  // 2. Remove old seed templates (by category = 'nrc') to allow re-running
  console.log("🧹  Removing old nrc-category templates ...");
  try {
    const old = await supaGet("/templates?category=eq.nrc&select=id");
    for (const row of old) {
      await supaDelete(`/template_objects?template_id=eq.${row.id}`);
      await supaDelete(`/templates?id=eq.${row.id}`);
      console.log(`   Deleted ${row.id}`);
    }
  } catch (e) {
    console.warn("   (cleanup skipped — tables may be empty):", e.message);
  }

  // 3. Insert each template
  for (const tpl of TEMPLATES) {
    console.log(`\n📄  Inserting: ${tpl.name}`);

    const snapshot = {
      background: { src: null, width: tpl.width, height: tpl.height },
      canvasWidth: tpl.width,
      canvasHeight: tpl.height,
      layers: tpl.layers,
      memberNames: {},
    };

    let inserted;
    try {
      const rows = await supaPost("/templates", {
        name: tpl.name,
        page_size: tpl.page_size,
        width: tpl.width,
        height: tpl.height,
        background_url: null,
        category: tpl.category,
        ai_instructions: tpl.ai_instructions,
        members_per_page: null,
        status: "active",
      });
      inserted = Array.isArray(rows) ? rows[0] : rows;
    } catch (e) {
      // Retry without ai_instructions if column missing
      if (e.message.includes("ai_instructions")) {
        const rows = await supaPost("/templates", {
          name: tpl.name, page_size: tpl.page_size,
          width: tpl.width, height: tpl.height,
          background_url: null, category: tpl.category,
          members_per_page: null, status: "active",
        });
        inserted = Array.isArray(rows) ? rows[0] : rows;
      } else throw e;
    }

    console.log(`   template id: ${inserted.id}`);

    await supaPost("/template_objects", {
      template_id: inserted.id,
      objects: snapshot,
      version: 1,
    });

    console.log(`   ✅  ${tpl.name} saved (${tpl.layers.length} layers)`);
  }

  console.log("\n🎉  Done! 4 templates created: NIC Front/Back (psd3) + CNIC Front/Back (ops2)\n");
}

main().catch((e) => { console.error("❌  Fatal:", e.message); process.exit(1); });
