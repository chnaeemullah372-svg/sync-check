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
  { family: "Poppins", label: "Poppins", category: "sans" },
  { family: "Montserrat", label: "Montserrat", category: "sans" },
  { family: "Raleway", label: "Raleway", category: "sans" },
  { family: "Nunito", label: "Nunito", category: "sans" },
  { family: "Source Sans 3", label: "Source Sans", category: "sans" },
  { family: "Archivo", label: "Archivo", category: "sans" },
  { family: "Space Grotesk", label: "Space Grotesk", category: "sans" },
  { family: "DM Sans", label: "DM Sans", category: "sans" },
  { family: "Roboto Condensed", label: "Roboto Condensed", category: "sans" },

  // English — Serif
  { family: "Playfair Display", label: "Playfair Display", category: "serif" },
  { family: "Lora", label: "Lora", category: "serif" },
  { family: "Merriweather", label: "Merriweather", category: "serif" },

  // English — Display
  { family: "Bebas Neue", label: "Bebas Neue", category: "display" },
  { family: "Oswald", label: "Oswald", category: "display" },

  // Urdu / Arabic
  { family: "Noto Nastaliq Urdu", label: "نوٹو نستعلیق", category: "urdu", preview: "نمونہ متن", rtl: true },
  { family: "Mirza", label: "میرزا", category: "urdu", preview: "نمونہ متن", rtl: true },
  { family: "Gulzar", label: "گلزار", category: "urdu", preview: "نمونہ متن", rtl: true },
  { family: "Noto Naskh Arabic", label: "نسخ عربي", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Amiri", label: "أميري", category: "arabic", preview: "نموذج النص", rtl: true },
  { family: "Scheherazade New", label: "شهرزاد", category: "arabic", preview: "نموذج النص", rtl: true },
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
