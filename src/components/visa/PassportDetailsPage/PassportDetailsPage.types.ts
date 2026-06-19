export interface Passport {
  id:             string
  countryOfIssue: string   // maps to DB column issuing_country
  passportNumber: string
  nationality:    string
  issueDate:      string   // ISO date string YYYY-MM-DD
  expiryDate:     string   // ISO date string YYYY-MM-DD
  isPrimary:      boolean
  isExpired:      boolean  // computed server-side
}

export interface PassportDetailsState {
  passports:  Passport[]
  selectedId: string | null
  isLoading:  boolean
  modalOpen:  boolean
}

/** Shape returned by the API — snake_case columns from crew_passports table */
export interface PassportRow {
  id:              string
  crew_id:         string
  issuing_country: string
  passport_number: string
  nationality:     string
  issue_date:      string
  expiry_date:     string
  is_primary:      boolean
  is_expired:      boolean
  created_at:      string
  updated_at:      string
}

export function rowToPassport(r: PassportRow): Passport {
  return {
    id:             r.id,
    countryOfIssue: r.issuing_country,
    passportNumber: r.passport_number,
    nationality:    r.nationality,
    issueDate:      r.issue_date,
    expiryDate:     r.expiry_date,
    isPrimary:      r.is_primary,
    isExpired:      r.is_expired,
  }
}
