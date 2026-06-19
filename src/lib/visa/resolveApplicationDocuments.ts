/**
 * resolveApplicationDocuments
 *
 * Returns the four fixed document slots for a UAE visa application.
 * Slots 1–3 are always required. Slot 4 is conditional:
 *   - If the passport has a Seaman's Book → show it as pre-filled
 *   - If no_seamans_book is true → letter will be issued; show informational state
 *   - Otherwise → upload button for Seaman's Book
 *
 * Non-UAE applications fall back to the country config's requiredDocuments list.
 */

import type { CrewPassport } from '@/lib/visa/crewMatching'

export type DocumentSlotSource = 'passport' | 'upload' | 'letter_pending'

export interface DocumentSlot {
  key:      string
  label:    string
  url:      string | null
  source:   DocumentSlotSource | null
  required: boolean
  /** Slot 4 only — true when no Seaman's Book and letter not yet generated */
  letterPending?: boolean
}

export function resolveApplicationDocuments(passport: CrewPassport | null): DocumentSlot[] {
  return [
    {
      key:      'passport_copy',
      label:    'Passport copy (colour, all pages)',
      url:      passport?.document_url ?? null,
      source:   passport?.document_url ? 'passport' : null,
      required: true,
    },
    {
      key:      'passport_external_cover',
      label:    'Passport external cover',
      url:      passport?.cover_url ?? null,
      source:   passport?.cover_url ? 'passport' : null,
      required: true,
    },
    {
      key:      'passport_photo',
      label:    'Passport photo (white background)',
      url:      passport?.headshot_url ?? null,
      source:   passport?.headshot_url ? 'passport' : null,
      required: true,
    },
    resolveSlot4(passport),
  ]
}

function resolveSlot4(passport: CrewPassport | null): DocumentSlot {
  // Has Seaman's Book on the passport record
  if (passport?.seamans_book_url) {
    return {
      key:      'seamans_book_or_letter',
      label:    "Seaman's Book",
      url:      passport.seamans_book_url,
      source:   'passport',
      required: true,
    }
  }

  // Crew declared no Seaman's Book — a JLS Crew Verification Letter will be issued
  if (passport?.no_seamans_book) {
    return {
      key:           'seamans_book_or_letter',
      label:         'JLS Crew Verification Letter',
      url:           null,
      source:        'letter_pending',
      required:      true,
      letterPending: true,
    }
  }

  // Default: upload Seaman's Book
  return {
    key:      'seamans_book_or_letter',
    label:    "Seaman's Book",
    url:      null,
    source:   null,
    required: true,
  }
}

/** True when the slot is satisfied — has a URL or is letter_pending (will be issued). */
export function slotComplete(slot: DocumentSlot, uploadedDocs: Record<string, string>): boolean {
  if (uploadedDocs[slot.key]) return true
  if (slot.url) return true
  if (slot.letterPending) return true
  return false
}
