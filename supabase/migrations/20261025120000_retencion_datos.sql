-- Foco Mente · retención de datos dentro de la base (migración 20261025120000).
-- Qué hace: borra cada noche los registros técnicos y de medición más viejos que su plazo. Los plazos están en
-- public.retencion_config, configurables sin tocar código. Los valores de partida son CONSERVADORES y no son un consejo
-- legal: [VERIFICAR: plazos con tu abogado antes de vender].
-- Qué NO toca: compras, accesos, compras_finales_previas y suscripciones (registros de cobro por correo; su plazo lo
-- decide la persona compradora con su asesor, [COMPLETAR]), ni los datos de cada usuario (perfil y sesiones diarias), que
-- se borran con la cuenta (borrar_mi_cuenta, migración 20261025110000).
-- Estado: no se aplica desde aquí. La persona la ejecuta a mano en su proyecto de Supabase, después de
-- 20261025110000_borrar_mi_cuenta.sql. El planificador con pg_cron solo se crea si la extensión está habilitada.
--
-- Modelo de acceso: ninguna tabla ni función es accesible para anon ni authenticated. La ejecuta el planificador (pg_cron,
-- como postgres) o la persona desde el editor SQL. anon no recibe ningún permiso.

-- 1. Plazos configurables. Una fila por tabla que se purga.
create table if not exists public.retencion_config (
  tabla text primary key check (tabla in ('eventos_pago', 'eventos_app', 'limite_eventos_app')),
  dias integer not null check (dias between 1 and 3650),
  motivo text not null check (char_length(motivo) between 1 and 200)
);

alter table public.retencion_config enable row level security;
revoke all on public.retencion_config from anon, authenticated;

insert into public.retencion_config (tabla, dias, motivo) values
  ('eventos_pago', 730, 'Avisos de Hotmart sin datos de la persona. [VERIFICAR: plazo con tu asesor]'),
  ('eventos_app', 395, 'Medición anónima (13 meses). [VERIFICAR: plazo con tu abogado]'),
  ('limite_eventos_app', 2, 'Contadores de límite de la medición. Solo hacen falta minutos u horas.')
on conflict (tabla) do nothing;

-- 2. Purga. Borra por la fecha de cada tabla y devuelve cuántas filas quitó. Idempotente: una segunda ejecución no
--    borra nada más si nada ha vencido.
create or replace function public.purgar_retencion()
returns table (tabla text, filas_borradas bigint)
language plpgsql
set search_path = ''
as $$
declare
  dias_pagos integer := (select dias from public.retencion_config where retencion_config.tabla = 'eventos_pago');
  dias_medicion integer := (select dias from public.retencion_config where retencion_config.tabla = 'eventos_app');
  dias_limite integer := (select dias from public.retencion_config where retencion_config.tabla = 'limite_eventos_app');
  n_pagos bigint;
  n_medicion bigint;
  n_limite bigint;
begin
  delete from public.eventos_pago
    where recibido_en < now() - make_interval(days => dias_pagos);
  get diagnostics n_pagos = row_count;

  delete from public.eventos_app
    where creado_en < now() - make_interval(days => dias_medicion);
  get diagnostics n_medicion = row_count;

  delete from public.limite_eventos_app
    where minuto < now() - make_interval(days => dias_limite);
  get diagnostics n_limite = row_count;

  return query values
    ('eventos_pago'::text, n_pagos),
    ('eventos_app'::text, n_medicion),
    ('limite_eventos_app'::text, n_limite);
end;
$$;

revoke all on function public.purgar_retencion() from public, anon, authenticated;

-- 3. Planificador: cada noche a las 03:17 (hora del servidor). Solo si pg_cron está habilitada en el proyecto
--    (Supabase → Database → Extensions). Si no lo está, este bloque no hace nada y la retención se ejecuta a mano:
--    select * from public.purgar_retencion();
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    execute $cron$
      select cron.schedule('foco-mente-retencion', '17 3 * * *', 'select public.purgar_retencion()')
    $cron$;
  end if;
end;
$$;
