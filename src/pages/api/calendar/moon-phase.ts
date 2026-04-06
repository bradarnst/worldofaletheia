import type { APIRoute } from 'astro';
import { createCalendarMoonPhaseApiResponse } from '~/lib/aletheia-calendar-api';

export const GET: APIRoute = async ({ request }) => {
  return createCalendarMoonPhaseApiResponse(new URL(request.url).searchParams);
};
