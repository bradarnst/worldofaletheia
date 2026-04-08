import type { APIRoute } from 'astro';
import { createCalendarDayApiResponse, loadCalendarApiContext } from '~/lib/aletheia-calendar-api';

export const GET: APIRoute = async ({ request }) => {
  const context = await loadCalendarApiContext();
  return createCalendarDayApiResponse(new URL(request.url).searchParams, context);
};
