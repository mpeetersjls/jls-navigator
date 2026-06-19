/**
 * Packages raw search form values into clean API params.
 * Passes the full name string as-is — the API handles all matching logic.
 * POLARIS-SEARCH-007
 */
export interface CrewSearchParams {
  name: string
  dob:  string
}

export function parseCrewSearchInput(
  fullName:    string,
  dateOfBirth: string,
): CrewSearchParams {
  return {
    name: fullName.trim(),
    dob:  dateOfBirth.trim(),
  }
}
