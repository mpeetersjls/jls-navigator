export type FieldState = 'ocr_auto' | 'ocr_confirmed' | 'ocr_edited' | 'manual'

export interface AdditionalInfoField {
  value: string
  state: FieldState
}

export interface AdditionalInfoFields {
  nationalityCitizenship: AdditionalInfoField
  countryOfBirth:         AdditionalInfoField
  gender:                 AdditionalInfoField
  placeOfBirth:           AdditionalInfoField
  occupation:             AdditionalInfoField
  maritalStatus:          AdditionalInfoField
  nativeLanguage:         AdditionalInfoField
  mothersMaidenName:      AdditionalInfoField
  fathersFullName:        AdditionalInfoField
  religion:               AdditionalInfoField
  religionOther:          AdditionalInfoField  // free text when religion === 'Other'
}

export const EMPTY_FIELDS: AdditionalInfoFields = {
  nationalityCitizenship: { value: '', state: 'manual' },
  countryOfBirth:         { value: '', state: 'manual' },
  gender:                 { value: '', state: 'manual' },
  placeOfBirth:           { value: '', state: 'manual' },
  occupation:             { value: '', state: 'manual' },
  maritalStatus:          { value: '', state: 'manual' },
  nativeLanguage:         { value: '', state: 'manual' },
  mothersMaidenName:      { value: '', state: 'manual' },
  fathersFullName:        { value: '', state: 'manual' },
  religion:               { value: '', state: 'manual' },
  religionOther:          { value: '', state: 'manual' },
}

export interface PersonalInfoApiResponse {
  nationalityCitizenship:  string | null
  placeOfBirth:            string | null
  countryOfBirth:          string | null
  gender:                  string | null
  maritalStatus:           string | null
  nativeLanguage:          string | null
  occupation:              string | null
  mothersMaidenName:       string | null
  fathersFullName:         string | null
  religion:                string | null
  ocrPopulatedFields:      string[]
  ocrConfirmedFields:      string[]
  personalInfoCompletedAt: string | null
}

export interface OcrApiResponse {
  nationality:    string | null
  countryOfBirth: string | null
  gender:         string | null
  placeOfBirth:   string | null
  ocrCompletedAt: string | null
  ocrFields:      string[]
}

export const TOTAL_FIELDS = 10

export function computeProgress(f: AdditionalInfoFields): number {
  let filled = 0
  if (f.nationalityCitizenship.value)                                         filled++
  if (f.countryOfBirth.value)                                                 filled++
  if (f.gender.value)                                                         filled++
  if (f.placeOfBirth.state === 'ocr_confirmed' || f.placeOfBirth.value)      filled++
  if (f.occupation.state === 'ocr_confirmed'   || f.occupation.value)        filled++
  if (f.maritalStatus.value)                                                  filled++
  if (f.nativeLanguage.value)                                                 filled++
  if (f.mothersMaidenName.value)                                              filled++
  if (f.fathersFullName.value)                                                filled++
  if (f.religion.value)                                                       filled++
  return Math.round((filled / TOTAL_FIELDS) * 100)
}
