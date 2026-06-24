---
name: Template local file store
description: File-based fallback storage for templates when Supabase tables don't exist
---

## Why it exists
Supabase migrations may not have been run (tables don't exist → PGRST205 error). Rather than blocking the admin, all template operations fall back to a JSON file store on the server.

## File location
`{cwd}/.local-db/templates.json` — created automatically on first write.

## Auto-seeding
When `localListTemplates()` finds an empty DB, it seeds 4 NRC templates:
- NIC Front (psd3) — bilingual English+Urdu, ai_instructions pre-set
- NIC Back (psd3)
- CNIC Front (ops2) — Urdu-primary
- CNIC Back (ops2)

All seeded at 1012×638 px (85.6×54mm @300 DPI) with blank canvas (`layers: []`).

## Error detection pattern
```ts
function isTableMissingError(e): boolean {
  return e.code === 'PGRST205' || e.message.includes('PGRST205') || e.message.includes('relation') || e.message.includes('does not exist');
}
```
Used in `templates.functions.ts` and `admin.functions.ts` handlers.

## When Supabase tables DO exist
The fallback is never triggered — all operations go to Supabase normally. Run migrations to unlock Supabase-backed storage.
