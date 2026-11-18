import { treaty } from '@elysiajs/eden'
import type { App } from '../../api/src/index'
import type { FilingsPage, SummaryResponse } from '../../api/src/schemas'

export type FilingsResult = typeof FilingsPage.static
export type SummaryResult = typeof SummaryResponse.static

// The Vite dev proxy forwards /api to the API on :3000, so there is no CORS.
// Treaty needs a full URL, so we use the page's origin.
// parseDate is off because Treaty would turn "YYYY-MM-DD" strings into Date objects, which React can't render
export const api = treaty<App>(window.location.origin + '/api', { parseDate: false })

type ApiFailure = { status: number; value: unknown }

// 404 and 502 send { code, message }; 422 is Elysia's validation error
export function errorMessage(error: ApiFailure): string {
  if (error.status === 422) return 'Invalid input'
  const value = error.value
  if (value && typeof value === 'object' && 'message' in value && typeof value.message === 'string') {
    return value.message
  }
  return `Request failed (${error.status})`
}
