// Font library for the Canva-style designer.
// All fonts are loaded via <link> in src/routes/__root.tsx.

export interface FontDef {
  family: string;
  label: string;
  category: "sans" | "serif" | "display" | "mono" | "urdu" | "arabic";
  preview?: string; // sample text override
  rtl?: boolean;
}

export const FONT_LIBRARY: FontDef[] = [
  // English — Sans
  { family: "Inter", label: "Inter", category: "sans" },
  { family: "Roboto", label: "Roboto", category: "sans" },
  { family: "Open Sans", label: "Open Sans", category: "sans" },
  { family: "Lato", label: "Lato", category: "sans" },
  { family: "Poppins", label: "Poppins", category: "sans" },
  { family: "Montserrat", label: "Montserrat", category: "sans" },
  { family: "Arial", label: "Arial", category: "sans" },
  { family: "Arial Rounded MT Bold", label: "Arial Rounded MT Bold", category: "sans" },
  { family: "Raleway", label: "Raleway", category: "sans" },
  { family: "Nunito", label: "Nunito", category: "sans" },
  { family: "Source Sans 3", label: "Source Sans", category: "sans" },
  { family: "Archivo", label: "Archivo", category: "sans" },
  { family: "Space Grotesk", label: "Space Grotesk", category: "sans" },
  { family: "DM Sans", label: "DM Sans", category: "sans" },
  { family: "Roboto Condensed", label: "Roboto Condensed", category: "sans" },
  { family: "Work Sans", label: "Work Sans", category: "sans" },
  { family: "Manrope", label: "Manrope", category: "sans" },
  { family: "Outfit", label: "Outfit", category: "sans" },
  { family: "Plus Jakarta Sans", label: "Plus Jakarta Sans", category: "sans" },

  // English — Serif
  { family: "Playfair Display", label: "Playfair Display", category: "serif" },
  { family: "Lora", label: "Lora", category: "serif" },
  { family: "Merriweather", label: "Merriweather", category: "serif" },
  { family: "EB Garamond", label: "EB Garamond", category: "serif" },
  { family: "Cormorant Garamond", label: "Cormorant", category: "serif" },
  { family: "PT Serif", label: "PT Serif", category: "serif" },

  // English — Display
  { family: "Bebas Neue", label: "Bebas Neue", category: "display" },
  { family: "Oswald", label: "Oswald", category: "display" },
  { family: "Anton", label: "Anton", category: "display" },
  { family: "Righteous", label: "Righteous", category: "display" },
  { family: "Pacifico", label: "Pacifico", category: "display" },
  { family: "Caveat", label: "Caveat", category: "display" },
  { family: "Dancing Script", label: "Dancing Script", category: "display" },

  // Urdu (Nastaliq / Naskh style)
  { family: "Noto Nastaliq Urdu", label: "Noto Nastaliq Urdu", category: "urdu", preview: "نمونہ متن اردو", rtl: true },
  { family: "Gulzar", label: "Gulzar", category: "urdu", preview: "نمونہ متن اردو", rtl: true },
  { family: "Mirza", label: "Mirza", category: "urdu", preview: "نمونہ متن اردو", rtl: true },
  { family: "Jameel Noori Nastaleeq", label: "Jameel Noori Nastaleeq", category: "urdu", preview: "نمونہ متن اردو", rtl: true },
  { family: "Alvi Nastaleeq", label: "Alvi Nastaleeq", category: "urdu", preview: "نمونہ متن اردو", rtl: true },

  // Arabic
  { family: "Noto Sans Arabic", label: "Noto Sans Arabic", category: "arabic", preview: "نموذج 12345", rtl: true },
  { family: "Noto Naskh Arabic", label: "Noto Naskh Arabic", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Amiri", label: "Amiri", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Scheherazade New", label: "Scheherazade New", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Aref Ruqaa", label: "Aref Ruqaa", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Reem Kufi", label: "Reem Kufi", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Markazi Text", label: "Markazi Text", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Lateef", label: "Lateef", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Vibes", label: "Vibes Arabic", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Cairo", label: "Cairo", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Tajawal", label: "Tajawal", category: "arabic", preview: "نموذج النص", rtl: true },
];

export const FONT_CATEGORIES: Array<{ id: FontDef["category"]; label: string }> = [
  { id: "sans", label: "Sans" },
  { id: "serif", label: "Serif" },
  { id: "display", label: "Display" },
  { id: "urdu", label: "Urdu" },
  { id: "arabic", label: "Arabic" },
];

export const DEFAULT_COLORS = [
  "#000000", "#FFFFFF", "#374151", "#6B7280", "#9CA3AF", "#D1D5DB",
  "#EF4444", "#F97316", "#F59E0B", "#EAB308", "#84CC16", "#22C55E",
  "#10B981", "#14B8A6", "#06B6D4", "#0EA5E9", "#3B82F6", "#6366F1",
  "#8B5CF6", "#A855F7", "#D946EF", "#EC4899", "#F43F5E", "#0B6E3F",
];
