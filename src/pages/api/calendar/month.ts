import type { APIRoute } from 'astro';
import { createCalendarMonthApiResponse, loadCalendarApiContext } from '~/lib/aletheia-calendar-api';

export const GET: APIRoute = async ({ request }) => {
  const context = await loadCalendarApiContext();
  return createCalendarMonthApiResponse(new URL(request.url).searchParams, context);
};
