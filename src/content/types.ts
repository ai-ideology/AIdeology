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
  /** `L5` stance item or `S5` single-variable degree item (v1.1). */
  type?: string;
  agree_direction?: number;
  /** Optional scenario setup shown above the question. */
  scenario?: string;
  options: CoreOption[];
  version?: string;
  scoring_note?: string;
  v1_revision?: string;
  /** v1.1: the one variable an S5 ladder moves along. */
  ordinal_variable?: string;
  ordinal_audit?: string;
  dataset_version?: string;
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
  /** v1.1: the single discriminating variable and its relation type. */
  degree_variable?: string;
  relation_type?: string;
  dataset_version?: string;
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

/* ---------- result explanation layer (editable copy) ---------- */

export interface AxisCopy {
  /** Technical name from the frozen dimensions. */
  name: string;
  /** Plain-language label shown to users. */
  plain: string;
  question: string;
  left: { label: string; definition: string };
  right: { label: string; definition: string };
  bands: {
    strong_left: string;
    left: string;
    center: string;
    right: string;
    strong_right: string;
  };
}

export type AxisBand = keyof AxisCopy['bands'];

export interface IdeologyProfile {
  core: string;
  cares: string;
  worry: string;
  future: string;
}

/**
 * How two ideologies actually differ (v1.1 relation-type system). Deciding the
 * type first stops the copy from inventing a head-on conflict where there is
 * only a difference of priority.
 */
export type RelationType =
  | 'opposite_direction'      // R1 同一根问题站在两端
  | 'same_direction_degree'   // R2 方向一致，一方走得更远
  | 'threshold_difference'    // R3 原则接近，跨线条件不同
  | 'motive_difference'       // R4 选择相近，理由不同
  | 'priority_difference'     // R5 不互相反对，只是优先项不同
  | 'scope_difference';       // 适用范围不同（personal vs public）

export const RELATION_TYPE_LABEL: Record<RelationType, string> = {
  opposite_direction: '方向相反',
  same_direction_degree: '同向·程度不同',
  threshold_difference: '阈值不同',
  motive_difference: '动机不同',
  priority_difference: '关注重心不同',
  scope_difference: '适用范围不同',
};

/** Hand-written two-ideology relation copy; `pair` is stored sorted. */
export interface RelationPair {
  pair: [string, string];
  relationType: RelationType;
  relationTypeAlt?: RelationType;
  /** Canonical axis the relation turns on, when the doc names one. */
  keyAxis?: AxisId;
  /** 共鸣点 — what the two share. May be absent for pure priority splits. */
  shared?: string;
  /** 程度差 / 阈值差 / 动机差 / 差异 — the v1.1 "who is further" clause. */
  degree?: string;
  oneLine: string;
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
  nickname?: string;
  summary: string;
  keywords: string[];
  /** Presentation identity. Hidden stances ship without character art, so they
   *  carry an emblem (motif + colour) instead of a photo. */
  color?: string;
  fg?: string;
  motif?: string;
}

export interface Family {
  key: string;
  zh: string;
  en: string;
}
