/** Frozen v1 data shapes (mirror of src/content/frozen/*.json). */

export type AxisId =
  | 'V1' | 'V2' | 'V3' | 'V4' | 'V5' | 'V6'
  | 'V7' | 'V8' | 'V9' | 'V10' | 'V11' | 'V12'
  | 'X1' | 'X2' | 'X3' | 'M1';

export const CORE_AXES: AxisId[] = [
  'V1', 'V2', 'V3', 'V4', 'V5', 'V6', 'V7', 'V8', 'V9', 'V10', 'V11', 'V12',
];
export const EXTENDED_AXES: AxisId[] = ['X1', 'X2', 'X3'];
export const META_AXES: AxisId[] = ['M1'];
export const ALL_AXES: AxisId[] = [...CORE_AXES, ...EXTENDED_AXES, ...META_AXES];

export interface CoreOption {
  label: string;
  score: number; // -2..+2, already direction-coded
}
export interface CoreItem {
  id: string;
  axis: AxisId;
  prompt: string;
  note?: string;
  type?: string;
  agree_direction?: number;
  /** Optional scenario setup shown above the question. */
  scenario?: string;
  options: CoreOption[];
  version?: string;
  scoring_note?: string;
  v1_revision?: string;
}

export interface AdaptiveOption {
  label: string;
  position: number;
  evidence_a: number;
  evidence_b: number;
}
export interface AdaptiveItem {
  id: string;
  target_a: string; // ideology Chinese name
  target_b: string;
  /** Optional scenario setup shown above the question. */
  scenario?: string;
  prompt: string;
  options: AdaptiveOption[];
  version?: string;
  scoring_note?: string;
}

export interface HiddenOption {
  label: string;
  score: number;
}
export interface HiddenItem {
  id: string;
  hidden_id: string;
  /** Optional scenario setup shown above the question. */
  scenario?: string;
  prompt: string;
  options: HiddenOption[];
}

export interface Dimension {
  id: AxisId;
  name: string;
  left: string;
  right: string;
}

export type HallmarkCondition =
  | { type: 'axis'; axis: AxisId; op: '>=' | '<='; value: number; label: string }
  | { type: 'axis_range'; axis: AxisId; min: number; max?: number; label: string }
  | { type: 'count_item'; items: string[]; score_op: '>=' | '<='; score: number; count: number; label: string }
  | { type: 'item_any'; items: string[]; scores: number[]; label: string }
  | { type: 'adaptive_required'; items: string[]; favor: 'self' | 'opponent'; threshold: number; label: string }
  | { type: 'adaptive_optional'; items: string[]; favor: 'self' | 'opponent'; threshold: number; label: string };

export type ContradictionCondition =
  | { type: 'axis'; axis: AxisId; op: '>=' | '<='; value: number; severity: 'medium' | 'strong'; label: string }
  | { type: 'adaptive'; items: string[]; favor: 'self' | 'opponent'; threshold: number; severity: 'medium' | 'strong'; label: string }
  | { type: 'axis_pair'; conditions: [AxisId, '>=' | '<=', number][]; severity: 'medium' | 'strong'; label: string };

export interface PrototypeRule {
  id: string;
  name: string;
  en: string;
  family: string;
  axis_targets: Partial<Record<AxisId, number>>;
  hallmarks: HallmarkCondition[];
  contradictions: ContradictionCondition[];
  neighbors: string[];
  adaptive_items: string[];
  special_policy?: string;
  notes?: string;
  version?: string;
  hallmark_policy?: {
    minimum_independent_sources: number;
    middle_score_zero_counts: boolean;
    common_item_guard: string;
    adaptive_required: string;
  };
  v1_rule?: string;
}

export interface HiddenRule {
  id: string;
  name: string;
  prerequisites: {
    [axis: string]: { min?: number; max?: number } | { axis: AxisId; min_raw_abs: number; direction: string; count: number } | string;
  } & { prototype?: string; prototype_fit_min?: number };
  items: string[];
  trigger: string;
  false_positive_guard: string;
  score_orientation?: string;
  version?: string;
}

/* ---------- presentation layer (editable copy) ---------- */

export interface IdeologyCopy {
  id: number;
  slug: string;
  code: string;
  nameZh: string;
  nameShort: string;
  nickname: string;
  nameEn: string;
  family: string;
  color: string;
  fg: string;
  motif: string;
  manifestoZh: string;
  manifestoEn: string;
  summary: string;
  worldview: string;
  keywords: string[];
}

export interface HiddenCopy {
  id: string;
  nameZh: string;
  nameEn: string;
  summary: string;
  keywords: string[];
}

export interface Family {
  key: string;
  zh: string;
  en: string;
}
