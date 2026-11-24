import { authorize } from './auth';
import type { Day, DayStore } from './store';
import { MAX_BODY_BYTES, isDate, parseDayValues } from './validate';

export interface Deps {
  token: string | undefined;
  store: DayStore;
}

const PAGES_ORIGIN = 'https://bennji030.github.io';
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1):\d{1,5}$/;

function corsHeaders(origin: string | null): Record<string, string> {
  if (origin === null || (origin !== PAGES_ORIGIN && !LOCAL_ORIGIN.test(origin))) return {};
  return { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' };
}

function json(status: number, body: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors },
  });
}

function empty(status: number, headers: Record<string, string>): Response {
  return new Response(null, { status, headers: { 'Cache-Control': 'no-store', ...headers } });
}

/** Builds the response object with a fixed field order and without missing fields. */
function dayJson(day: Day): Day {
  const out: Day = { date: day.date };
  if (day.steps !== undefined) out.steps = day.steps;
  if (day.kcal !== undefined) out.kcal = day.kcal;
  if (day.proteinG !== undefined) out.proteinG = day.proteinG;
  return out;
}

type Route = { kind: 'days' } | { kind: 'day'; date: string };

function route(pathname: string): Route | null {
  if (pathname === '/v1/days') return { kind: 'days' };
  const match = /^\/v1\/days\/([^/]+)$/.exec(pathname);
  return match ? { kind: 'day', date: match[1] } : null;
}

export async function handle(request: Request, deps: Deps): Promise<Response> {
  const url = new URL(request.url);
  const cors = corsHeaders(request.headers.get('Origin'));
  const target = route(url.pathname);

  if (request.method === 'OPTIONS') {
    if (!target) return json(404, { error: 'not found' }, cors);
    if (!cors['Access-Control-Allow-Origin']) return empty(204, {});
    return empty(204, {
      ...cors,
      'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type',
      'Access-Control-Max-Age': '86400',
    });
  }

  const auth = await authorize(request.headers.get('Authorization'), deps.token);
  if (auth === 'misconfigured') return json(500, { error: 'server not configured' }, cors);
  if (auth === 'unauthorized') return json(401, { error: 'unauthorized' }, cors);

  if (!target) return json(404, { error: 'not found' }, cors);

  if (target.kind === 'day') {
    if (request.method !== 'PUT') return json(405, { error: 'method not allowed' }, cors);
    if (!isDate(target.date)) return json(400, { error: 'invalid date' }, cors);
    const length = Number(request.headers.get('Content-Length') ?? 0);
    if (length > MAX_BODY_BYTES) return json(400, { error: 'body too large' }, cors);
    const values = parseDayValues(await request.text());
    if (!values) return json(400, { error: 'invalid body' }, cors);
    await deps.store.put(target.date, values);
    return empty(204, cors);
  }

  if (request.method === 'GET') {
    const since = url.searchParams.get('since');
    if (!isDate(since)) return json(400, { error: 'invalid since' }, cors);
    const days = await deps.store.since(since);
    return json(200, { days: days.map(dayJson) }, cors);
  }
  if (request.method === 'DELETE') {
    const until = url.searchParams.get('until');
    if (!isDate(until)) return json(400, { error: 'invalid until' }, cors);
    await deps.store.deleteUntil(until);
    return empty(204, cors);
  }
  return json(405, { error: 'method not allowed' }, cors);
}
