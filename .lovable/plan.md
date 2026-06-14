## مقصد

آپ کی fresh zip (`http-punjab-case-management-live-main-2.zip`) کا مکمل کوڈ اِس Lovable پروجیکٹ میں ڈالنا، deps install کرنا، اور live publish کر کے آپ کو URLs دینا تاکہ آپ admin/user دونوں چیک کر سکیں۔

---

## اہم نوٹ (پہلے پڑھیں)

zip کی `.env` ایک **پہلے سے موجود Supabase project** (`gyjwsrddzqcmeovmzgur`) کی طرف اشارہ کر رہی ہے — یعنی اصل database، users، اور admin account پہلے ہی اُس Supabase میں محفوظ ہیں۔ میں وہی `.env` رکھوں گا، لہٰذا آپ کا **پرانا admin login اور تمام data ویسے کا ویسا کام کرے گا** — صرف hosting/preview Lovable کے اِس نئے پروجیکٹ سے ہوگا۔

⚠️ ایک ضروری کام آپ کو خود کرنا ہوگا: اُس Supabase project کے **Auth → URL Configuration** میں اِس نئے Lovable preview/published URL کو **Redirect URLs** میں add کرنا ہوگا، ورنہ login پر redirect fail ہوگا۔ Publish کے بعد میں آپ کو exact URLs دوں گا تاکہ آپ paste کر سکیں۔

---

## ویب سائٹ کیا ہے (مختصر تجزیہ)

- **Stack:** TanStack Start + React 19 + Tailwind v4 + Supabase + Konva (canvas designer) + jsPDF + pdfjs
- **Routes:**
  - `/` — landing/index
  - `/auth` — login/signup
  - `/_authenticated/user.*` — user dashboard, history, templates, entries
  - `/_authenticated/designer` — Konva-based template designer (admin)
  - `/_authenticated/card.admin` — main admin panel (بڑی فائل ~41KB)
  - `/_authenticated/admin.ai-settings` — AI provider settings (صرف status، keys نہیں)
- **Backend:** Supabase Auth + RLS، roles `user_roles` table میں، AI keys صرف server secrets میں

---

## Plan (steps)

1. **Backup فولڈر صاف کریں:** موجودہ blank `src/routes/index.tsx` placeholder اور `routeTree.gen.ts` ہٹا کر zip کا مکمل `src/` overwrite کریں۔
2. **Files extract & copy:** zip کو `/tmp` میں extract، پھر `.git` کے بغیر سب کچھ `/dev-server/` پر copy:
  - `src/` (پورا)
  - `package.json`, `bun.lock`, `bunfig.toml`, `components.json`, `eslint.config.js`, `vite.config.ts`, `tsconfig.json`, `.prettierrc`, `.prettierignore`
  - `.env` (وہی Supabase credentials)
  - `.lovable/plan.md` (reference کے لیے)
3. **Install deps:** `bun install` چلائیں تاکہ Konva, jsPDF, pdfjs-dist, zustand, ag-psd, idb-keyval وغیرہ آ جائیں۔
4. **Build verify:** auto build چلے گا — اگر کوئی error آئی تو fix کروں گا (مثلاً missing import یا route gen)۔
5. **Preview چیک:** preview میں `/auth` کھول کر confirm کروں گا کہ login screen آ رہی ہے۔
6. **Security scan:** publish سے پہلے `security--get_scan_results` چلاؤں گا۔
7. **SEO metadata:** `__root.tsx` کا title/description پہلے سے "Punjab Case Management" پر set ہے یا نہیں check کر کے update کروں گا۔
8. **Publish:** `preview_ui--publish` سے live کروں گا۔
9. **URLs آپ کو دوں گا:**
  - Preview URL (development)
  - Published URL (live)
  - Admin route: `<published-url>/auth` → login → `/card/admin` یا `/admin/ai-settings`
  - User route: `<published-url>/auth` → login → `/user`
   (یعنی "admin domain" الگ نہیں ہے — same site پر login کے بعد role کے مطابق admin panel کھلتا ہے۔)
10. **Supabase Redirect URL ہدایات:** آپ کو step-by-step بتاؤں گا کہ نئے URL کو پرانے Supabase dashboard میں کہاں paste کرنا ہے۔

---

## آپ سے ایک confirmation چاہیے

`.env` میں موجود Supabase keys **دوسرے Lovable اکاؤنٹ کے Cloud** کی ہیں۔ Best practice ہے کہ یہ keys اِس پروجیکٹ کے Lovable Cloud secrets میں رکھوں (تاکہ git history میں نہ جائیں)، لیکن یہ صرف اسی صورت میں ممکن ہے جب میں اِس پروجیکٹ کا اپنا Lovable Cloud enable کروں — اور وہ ایک **نیا خالی Supabase** بنا دے گا جسے ہمیں استعمال نہیں کرنا۔

اِس لیے میرا plan ہے: **Lovable Cloud enable نہیں کروں گا**، بس zip کی `.env` ویسے ہی استعمال ہوگی (publishable key public-safe ہے، service role key zip میں شامل نہیں)۔ یہ ٹھیک ہے؟

approve کریں تو شروع کرتا ہوں۔

&nbsp;

&nbsp;

"Yes, the plan is perfect. Please proceed without enabling a new Lovable Cloud database. Use the existing .env from the zip file as planned so that my existing Supabase data and admin accounts remain intact. Let me know once it's published and share the exact URLs