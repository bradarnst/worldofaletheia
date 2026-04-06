import type { APIRoute } from 'astro';
import { createCalendarYearApiResponse, loadCalendarApiContext } from '~/lib/aletheia-calendar-api';

export const GET: APIRoute = async ({ request }) => {
  const context = await loadCalendarApiContext();
  return createCalendarYearApiResponse(new URL(request.url).searchParams, context);
};
