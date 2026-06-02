export type StoryStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "APPROVED"
  | "PUBLISHED"
  | "REJECTED";

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
  charges: string[];
  booking_number?: string;
  municipality?: string;
  admin_notes?: string;
}
