import type { APIRoute } from 'astro';
import { createCalendarWeekApiResponse, loadCalendarApiContext } from '~/lib/aletheia-calendar-api';

export const GET: APIRoute = async ({ request }) => {
  const context = await loadCalendarApiContext();
  return createCalendarWeekApiResponse(new URL(request.url).searchParams, context);
};
