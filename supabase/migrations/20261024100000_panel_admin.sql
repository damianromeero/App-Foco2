-- Foco Mente · panel de administración y medición anónima (migración 20261024100000).
-- Qué crea: la lista de administradores, las dos funciones que dicen si quien llama es administrador, y la tabla de
-- eventos anónimos de la app (eventos_app) con sus permisos y su seguridad por fila.
-- Estado: INACTIVA hasta configurar Supabase (docs/CONECTAR.md). Este archivo no se aplica desde la app: la persona lo ejecuta
-- a mano en su proyecto de Supabase cuando lo decida. NO añade a nadie como administrador: eso lo haces tú después, con tu
-- propio usuario, en el editor SQL de Supabase (docs/CONECTAR.md).
--
-- Modelo de acceso:
--  - El panel lee con la SESIÓN de la persona que administra (rol authenticated). Cada tabla tiene RLS activo y su política
--    exige public.es_administrador(): fuera de la lista, o sin segundo factor (aal2), la base no devuelve ninguna fila.
--  - El rol anon no tiene ningún permiso sobre las tablas. Su única puerta es registrar_evento_app() (migración
--    20261024100001), que valida la entrada, aplica un límite y solo puede insertar en eventos_app.
--  - Nadie escribe en eventos_app directamente: ni anon ni authenticated tienen permiso de insertar, cambiar o borrar.
--  - La clave service_role no aparece en este archivo.
-- Datos personales: eventos_app no guarda nombres, correos, textos ni direcciones. El dispositivo es un UUID aleatorio que
-- la app renueva cada 30 días.

-- Quién puede entrar al panel. Una fila por administrador.
create table if not exists public.administradores (
  usuario_id uuid primary key references auth.users (id) on delete cascade,
  creado_en timestamptz not null default now()
);

-- Uso anónimo de la app. El tipo y el valor los valida registrar_evento_app contra la lista cerrada de la app; aquí solo
-- se limita su forma, por si alguien con la clave de servicio insertara a mano.
create table if not exists public.eventos_app (
  id bigint generated always as identity primary key,
  tipo text not null check (char_length(tipo) between 1 and 40 and tipo ~ '^[a-z][a-z0-9_]*$'),
  dispositivo uuid not null,
  valor text check (valor is null or (char_length(valor) between 1 and 60 and valor ~ '^[a-z0-9][a-z0-9-]*$')),
  creado_en timestamptz not null default now()
);
create index if not exists eventos_app_creado_idx on public.eventos_app (creado_en);
create index if not exists eventos_app_tipo_creado_idx on public.eventos_app (tipo, creado_en);

-- RLS activo y, antes de conceder nada, se quitan todos los permisos a anon y authenticated.
alter table public.administradores enable row level security;
alter table public.eventos_app enable row level security;
revoke all on public.administradores from anon, authenticated;
revoke all on public.eventos_app from anon, authenticated;

-- Quien llama es administrador, con cualquier nivel de sesión. Lo usa el panel para dejar entrar a quien tiene el segundo
-- factor pendiente. Se ejecuta con el dueño de la función para poder leer la lista aunque la tabla esté cerrada.
create or replace function public.soy_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.administradores a where a.usuario_id = auth.uid());
$$;

-- Quien llama es administrador Y entró con segundo factor (aal2). Es la comprobación que protege los datos.
create or replace function public.es_administrador()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.soy_administrador() and (auth.jwt() ->> 'aal') = 'aal2';
$$;

-- Solo quien tiene sesión puede preguntarlo. anon no.
revoke all on function public.soy_administrador() from public, anon, authenticated;
revoke all on function public.es_administrador() from public, anon, authenticated;
grant execute on function public.soy_administrador() to authenticated;
grant execute on function public.es_administrador() to authenticated;

-- La lista de administradores se puede leer, con segundo factor. Se cambia en la base, no desde la app.
grant select on public.administradores to authenticated;
drop policy if exists administradores_leer on public.administradores;
create policy administradores_leer on public.administradores for select to authenticated
  using (public.es_administrador());

-- Los eventos se pueden leer, con segundo factor. Se escriben solo con registrar_evento_app.
grant select on public.eventos_app to authenticated;
drop policy if exists eventos_app_leer on public.eventos_app;
create policy eventos_app_leer on public.eventos_app for select to authenticated
  using (public.es_administrador());
