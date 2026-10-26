-- Foco Mente · registro de eventos con límite (migración 20261024100001).
-- Qué crea: los contadores del límite (limite_eventos_app) y la función registrar_evento_app, la ÚNICA puerta por la que el
-- rol anon puede escribir en eventos_app.
-- Qué hace la función: valida tipo, dispositivo y valor contra la lista cerrada de la app, cuenta los eventos por
-- dispositivo y por minuto, y por total de la app y minuto. Si un dispositivo pasa de 30 eventos en el mismo minuto, o el
-- total pasa de 600, NO guarda el evento y devuelve false. Así quien llame a la función directamente con la clave pública
-- no puede inflar las cifras del panel.
-- Por qué devuelve false y no lanza un error: si la función lanzara, Postgres deshace también el contador de ese intento y
-- el límite nunca se alcanzaría. Por eso el rechazo es un valor de retorno y la función `eventos` lo traduce a 429.
-- Limpieza: al llamar a la función se borran los contadores de más de una hora.
-- La lista de eventos y de valores es la de supabase/functions/_shared/eventos.ts y src/config/medicion.ts. La prueba
-- supabase/tests/contrato.test.ts falla si alguna de las tres se queda atrás. Los límites (30 y 600) son los de abajo.
-- Estado: no se aplica desde la app. La persona la ejecuta a mano en su proyecto (docs/CONECTAR.md), después de
-- 20261024100000_panel_admin.sql.

-- Contadores del límite. Una fila por (clave, minuto). Las claves son «dispositivo:<uuid>» y «total».
create table if not exists public.limite_eventos_app (
  clave text not null check (char_length(clave) between 1 and 80),
  minuto timestamptz not null,
  usos integer not null default 0 check (usos >= 0),
  primary key (clave, minuto)
);
create index if not exists limite_eventos_app_minuto_idx on public.limite_eventos_app (minuto);

-- RLS activo y ningún permiso para anon ni authenticated. Solo la función (security definer) escribe aquí.
alter table public.limite_eventos_app enable row level security;
revoke all on public.limite_eventos_app from anon, authenticated;

-- Registra un evento anónimo de la app. Devuelve true si lo guardó y false si lo rechazó por frecuencia (entonces no
-- guarda nada en eventos_app). Una entrada no válida (tipo, dispositivo o valor) lanza un error y no cuenta para el límite.
create or replace function public.registrar_evento_app(p_tipo text, p_dispositivo uuid, p_valor text default null)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo_valor text;
  v_minuto timestamptz := date_trunc('minute', now());
  v_usos integer;
begin
  if p_tipo is null or p_tipo not in (
    'portada_vista', 'precios_vista', 'compra_clic', 'acceso_enlace_pedido', 'acceso_confirmado',
    'sin_compra_visto', 'onboarding_paso', 'onboarding_completado', 'sesion_iniciada', 'juego_terminado',
    'sesion_completada', 'sesion_abandonada', 'enfoque_iniciado'
  ) then
    raise exception 'tipo-de-evento-no-valido' using errcode = '22023';
  end if;
  if p_dispositivo is null then
    raise exception 'dispositivo-no-valido' using errcode = '22023';
  end if;

  -- Qué lista de valores acompaña a cada tipo. Los demás tipos no llevan valor.
  v_tipo_valor := case p_tipo
    when 'onboarding_paso' then 'paso'
    when 'juego_terminado' then 'juego'
    when 'sesion_abandonada' then 'pantalla'
    else null
  end;

  if v_tipo_valor is null then
    if p_valor is not null then
      raise exception 'evento-sin-valor' using errcode = '22023';
    end if;
  elsif p_valor is null then
    raise exception 'falta-el-valor' using errcode = '22023';
  elsif not (
       (v_tipo_valor = 'pantalla' and p_valor in ('respiracion', 'juego', 'reflexion', 'leccion'))
    or (v_tipo_valor = 'juego' and p_valor in (
         'vigilancia', 'semaforo', 'secuencia', 'busqueda', 'stroop', 'cambio', 'reflejo', 'espera-la-senal',
         'casilla-iluminada', 'diferencia-cuadricula', 'cual-no-encaja', 'siguiente-figura', 'espejo-o-giro',
         'simetria', 'mismo-tono', 'contar-pitidos', 'agudo-o-grave', 'seguir-puntos', 'busqueda-formas'))
    or (v_tipo_valor = 'paso' and p_valor in ('objetivo', 'ajustes', 'base', 'listo'))
  ) then
    raise exception 'valor-de-evento-no-valido' using errcode = '22023';
  end if;

  -- Limpieza: contadores de más de una hora. Va antes del límite para que la tabla nunca crezca.
  delete from public.limite_eventos_app where minuto < now() - interval '1 hour';

  -- Límite por dispositivo: 30 intentos por minuto. El intento cuenta aunque se rechace.
  insert into public.limite_eventos_app (clave, minuto, usos)
    values ('dispositivo:' || p_dispositivo::text, v_minuto, 1)
    on conflict (clave, minuto) do update set usos = public.limite_eventos_app.usos + 1
    returning usos into v_usos;
  if v_usos > 30 then
    return false;
  end if;

  -- Límite total de la app: 600 eventos por minuto.
  insert into public.limite_eventos_app (clave, minuto, usos)
    values ('total', v_minuto, 1)
    on conflict (clave, minuto) do update set usos = public.limite_eventos_app.usos + 1
    returning usos into v_usos;
  if v_usos > 600 then
    return false;
  end if;

  insert into public.eventos_app (tipo, dispositivo, valor) values (p_tipo, p_dispositivo, p_valor);
  return true;
end;
$$;

-- Solo anon puede llamarla: es la puerta de la medición (la función eventos usa la clave pública). authenticated no la
-- necesita. Es lo único que anon puede ejecutar de todo el panel.
revoke all on function public.registrar_evento_app(text, uuid, text) from public;
grant execute on function public.registrar_evento_app(text, uuid, text) to anon;
