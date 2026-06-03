export type StoryStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED";

export type HeadlineType =
  | "STANDARD"
  | "CATCHY"
  | "ALLITERATIVE"
  | "RHYME"
  | "IDIOM"
  | "SHORT_MOBILE";

export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export type HeadlineStatus = "PENDING" | "APPROVED" | "REJECTED";

export type SensitiveCategory =
  | "SEX_CRIME"
  | "DOMESTIC_VIOLENCE"
  | "MINOR_INVOLVED"
  | "DEATH"
  | "SERIOUS_INJURY"
  | "HUMAN_TRAFFICKING"
  | "HATE_CRIME"
  | "MENTAL_HEALTH";

export interface StoryFormData {
  headline_standard: string;
  headline_catchy: string;
  headline_chosen?: string;
  editorial_tone: string;
  geography_focus: string;
  source_confidence_score: number;
  body: string;
  source_name: string;
  source_url?: string;
  incident_date?: string;
  arrest_date?: string;
  subject_name?: string;
  subject_descriptor?: string;
  charges: string[];
  booking_number?: string;
  municipality?: string;
  admin_notes?: string;
}

export interface HeadlineOption {
  id: string;
  story_id: string;
  headline_text: string;
  headline_type: HeadlineType;
  factual_safety_score: number;
  catchiness_score: number;
  risk_level: RiskLevel;
  reason_for_score: string;
  source_fields_used: string[];
  approval_status: HeadlineStatus;
  approved_by: string | null;
  approved_at: string | null;
  rejection_reason: string | null;
  is_selected: boolean;
  is_blocked: boolean;
  generation_batch: number;
  created_at: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}
