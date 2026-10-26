-- Foco Mente · acceso según la regla de Hotmart (migración 20261025100000).
-- Qué cambia (solo añade o amplía; no reescribe las migraciones anteriores):
--  - compras.estado admite «mantenida»: Hotmart reintenta el cobro (OVERDUE, DELAYED, PURCHASE_PROTEST,
--    PARTIALLY_REFUNDED). El acceso se conserva. Reembolsada (REFUNDED, CHARGEBACK) y cancelada (CANCELLED, EXPIRED,
--    NO_FUNDS) siguen siendo finales.
--  - suscripciones_hotmart guarda hasta cuándo sigue el acceso (acceso_hasta = date_next_charge), el último cobro y su
--    fecha. La columna motivo existe pero el código ya no la escribe: el motivo se deriva de ultimo_cobro (impago = sin
--    acceso; cualquier otro = voluntaria, con acceso hasta acceso_hasta). Un cobro aprobado posterior a la cancelación
--    reactiva la suscripción.
--  - accesos guarda la fecha del aviso que fijó el estado (fecha_aviso: un aviso más antiguo no lo cambia) y hasta cuándo
--    cuenta (acceso_hasta).
--  - Vista public.accesos_vigentes: solo las filas activas cuyo acceso_hasta no ha pasado. La app lee esta vista.
-- Estado: no se aplica desde aquí. La persona la ejecuta a mano en su proyecto de Supabase, después de
-- 20261024130000_compras_finales_previas.sql (docs/CONECTAR.md).
-- Modelo de acceso: sin cambios en RLS. accesos sigue leyéndose solo por su propio correo; la vista hereda esa regla
-- (security_invoker). anon no tiene ningún permiso. Nadie escribe desde el navegador.

-- 1. compras: nuevo estado «mantenida». El nombre de la restricción es el que Postgres pone a la de la columna
--    (compras_estado_check). Se quita si existe y se vuelve a poner con la lista nueva.
alter table public.compras drop constraint if exists compras_estado_check;
alter table public.compras add constraint compras_estado_check
  check (estado in ('aprobada', 'mantenida', 'reembolsada', 'cancelada'));

-- 2. suscripciones_hotmart: motivo, fecha de fin del acceso y último cobro. Sin fila de cobro, la fecha es la del origen
--    (1970), para que cualquier aviso real sea más reciente.
alter table public.suscripciones_hotmart
  add column if not exists motivo text check (motivo in ('voluntaria', 'impago')),
  add column if not exists acceso_hasta timestamptz,
  add column if not exists ultimo_cobro text check (ultimo_cobro in ('aprobado', 'impago', 'otro')),
  add column if not exists fecha_cobro timestamptz not null default '1970-01-01T00:00:00Z';

-- 3. accesos: fecha del aviso que fijó el estado y hasta cuándo cuenta. Las filas que ya existían quedan con la fecha de
--    origen: el primer aviso nuevo las actualiza.
alter table public.accesos
  add column if not exists fecha_aviso timestamptz not null default '1970-01-01T00:00:00Z',
  add column if not exists acceso_hasta timestamptz;

-- 4. Vista de lectura: solo acceso vigente. security_invoker hace que la vista aplique la RLS de accesos (cada persona ve
--    solo su fila). Un acceso con fin ya pasado no aparece aunque su estado siga en «activo».
create or replace view public.accesos_vigentes with (security_invoker = true) as
  select correo, estado, origen, cambiado_en
  from public.accesos
  where estado = 'activo' and (acceso_hasta is null or acceso_hasta > now());

-- Primero se quitan todos los permisos a anon y authenticated; después se concede solo la lectura a authenticated.
revoke all on public.accesos_vigentes from anon, authenticated;
grant select on public.accesos_vigentes to authenticated;
