export type FitMode = "fit" | "fill" | "stretch" | "crop" | "cover" | "contain";

export type ImageSubtype =
  | "photo"
  | "thumb"
  | "signature"
  | "cnic_copy"
  | "document"
  | "asset";

export type FaceCropMode =
  | "none"
  | "passport"
  | "face_center"
  | "head_visible"
  | "shoulders_visible"
  | "keep_inside";

// Common field keys admins can bind to layers (used for AI auto-fill mapping)
export const FIELD_KEYS = [
  "",
  "name",
  "father_name",
  "mother_name",
  "cnic",
  "dob",
  "doi",
  "address",
  "relation",
  "phone",
  "photo",
  "thumb",
  "signature",
  "custom_1",
  "custom_2",
  "custom_3",
] as const;
export type FieldKey = (typeof FIELD_KEYS)[number];

export interface BaseLayer {
  id: string;
  name: string;
  type: "text" | "image" | "box" | "line";
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
  visible: boolean;
  locked: boolean;
  fieldKey?: FieldKey;
  /** Member slot index. 0 / undefined = static (not part of any slot). 1..N = slot number */
  slotIndex?: number;
  /** Per-layer AI / image instruction. Applied during user-side auto-fill or image upload. */
  aiInstruction?: string;
}

export interface TextLayer extends BaseLayer {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  fill: string;
  align: "left" | "center" | "right";
  fontStyle: string;
  rtl?: boolean;
}

export interface ImageLayer extends BaseLayer {
  type: "image";
  src: string | null;
  fit: FitMode;
  subtype: ImageSubtype;
  /**
   * Optional shared upload group. Image layers with the same non-empty
   * shareGroup tag (within a member slot, or globally for static layers)
   * receive the same uploaded image. Leave empty for separate uploads.
   */
  shareGroup?: string;
  /** Face / content crop preset applied to uploaded photos. */
  faceCrop?: FaceCropMode;
}

export interface BoxLayer extends BaseLayer {
  type: "box";
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface LineLayer extends BaseLayer {
  type: "line";
  stroke: string;
  strokeWidth: number;
}

export type Layer = TextLayer | ImageLayer | BoxLayer | LineLayer;

export interface Background {
  src: string | null;
  width: number;
  height: number;
}

export type SizePreset = "a4p" | "a4l" | "custom" | "original";
