export type BuildingMatch = {
  object_number: string | null;
  matched_label: string | null;
  score: number | null;
};

export type Confidence = {
  doc_type: number;
  vendor: number;
  amount: number;
  building: number;
};

export type ProcessResult = {
  file_id: string;
  doc_type: string;
  vendor: string;
  amount: number | null;
  currency: string;
  date: string | null;
  building_match: BuildingMatch;
  suggested_filename: string;
  confidence: Confidence;
  debug?: {
    text_length?: number;
    build_sha?: string;
    head?: string;
    [k: string]: unknown;
  };
};
