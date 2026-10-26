/** Cabeceras CORS: solo se permite el origen de la app configurado en APP_URL. */
export function corsHeaders(origin: string | null): Record<string, string> {
  const allowed = Deno.env.get('APP_URL') ?? '';
  const allowedOrigin = allowed ? new URL(allowed).origin : '';
  return {
    'Access-Control-Allow-Origin': origin && origin === allowedOrigin ? origin : allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

export function json(body: unknown, status = 200, origin: string | null = null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  });
}

export function preflight(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

/** Comprueba que una URL de retorno pertenece a la app. Evita redirecciones a sitios ajenos. */
export function isAllowedReturnUrl(candidate: string): boolean {
  const allowed = Deno.env.get('APP_URL');
  if (!allowed) return false;
  try {
    return new URL(candidate).origin === new URL(allowed).origin;
  } catch {
    return false;
  }
}
