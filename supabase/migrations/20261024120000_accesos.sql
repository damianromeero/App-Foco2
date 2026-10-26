-- Foco Mente · acceso de compradores a la app (migración 20261024120000).
-- Qué es: una fila por correo con el estado de su acceso (activo o inactivo), qué evento lo cambió y cuándo. La decide la
-- función hotmart-aviso a partir de las compras y las suscripciones (supabase/functions/_shared/acceso.ts): hay acceso si
-- existe al menos una compra aprobada cuya suscripción, si la tiene, no está cancelada. La app comprueba el acceso leyendo
-- SU fila con la sesión de la persona: RLS deja ver solo la fila de quien entra.
-- Estado: no se aplica desde aquí. La persona la ejecuta a mano en su proyecto de Supabase (docs/CONECTAR.md).
--
-- Modelo de acceso:
--  - anon no tiene ningún permiso.
--  - authenticated solo LEE su propia fila: el correo sale del token ya validado por Supabase (auth.jwt()), en minúsculas.
--  - Nadie escribe desde el navegador: solo la función hotmart-aviso, con la clave de servicio (que salta RLS).

create table if not exists public.accesos (
  -- Correo en minúsculas y sin espacios, el mismo que se guarda en compras.
  correo text primary key check (char_length(correo) between 3 and 254 and correo = lower(correo)),
  estado text not null check (estado in ('activo', 'inactivo')),
  -- Evento de Hotmart que cambió el estado por última vez (por ejemplo PURCHASE_APPROVED). Sin datos de la persona.
  origen text not null check (char_length(origen) between 1 and 80),
  cambiado_en timestamptz not null default now()
);

alter table public.accesos enable row level security;
revoke all on public.accesos from anon, authenticated;
grant select on public.accesos to authenticated;

-- Cada persona lee solo su propia fila. (select …) hace que la base evalúe el token una vez por consulta, no por fila.
drop policy if exists accesos_leer_propio on public.accesos;
create policy accesos_leer_propio on public.accesos for select to authenticated
  using (correo = lower(coalesce((select auth.jwt() ->> 'email'), '')));
