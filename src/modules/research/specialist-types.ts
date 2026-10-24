export type SpecialistStatus = 'not_configured' | 'needs_input' | 'unavailable' | 'record_found' | 'record_matched' | 'record_mismatch' | 'not_found' | 'valid_number' | 'invalid_number' | 'possible_matches' | 'location_found';
export type SpecialistCheck = {
  kind: 'phone' | 'business' | 'property' | 'job'; provider: string; status: SpecialistStatus;
  checked_at: string | null; summary: string; facts: { label: string; value: string }[]; source_url: string;
};
export type VerificationInput = {
  business_name?: string; registration_number?: string; country_code?: string;
  jurisdiction_code?: string; address?: string; employer_name?: string; official_website?: string;
};
