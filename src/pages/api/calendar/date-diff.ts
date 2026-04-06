import type { APIRoute } from 'astro';
import { createCalendarDateDiffApiResponse } from '~/lib/aletheia-calendar-api';

export const GET: APIRoute = async ({ request }) => {
  return createCalendarDateDiffApiResponse(new URL(request.url).searchParams);
};
