-- Foco 5: esquema inicial.
-- Todas las tablas tienen seguridad por fila (RLS). Cada persona solo ve sus propios datos.
-- Las escrituras de facturación las hacen las Edge Functions con la clave de servicio.

-- ---------------------------------------------------------------------------
-- Perfiles: uno por usuario, creado automáticamente al registrarse.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  stripe_customer_id text unique,
  timezone text not null default 'Europe/Madrid',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Suscripciones: espejo de Stripe. Solo lo escribe el webhook.
-- ---------------------------------------------------------------------------
create table public.subscriptions (
  id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  stripe_customer_id text not null,
  status text not null check (
    status in (
      'trialing', 'active', 'past_due', 'canceled', 'incomplete',
      'incomplete_expired', 'unpaid', 'paused'
    )
  ),
  plan text check (plan in ('monthly', 'annual')),
  price_id text,
  trial_end timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  first_paid_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Eventos de Stripe ya procesados: evita aplicar dos veces el mismo evento.
-- ---------------------------------------------------------------------------
create table public.billing_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Sesiones diarias para la sincronización entre dispositivos.
-- Una sola sesión por día y persona.
-- ---------------------------------------------------------------------------
create table public.daily_sessions (
  user_id uuid not null references auth.users (id) on delete cascade,
  date_key date not null,
  completed_at timestamptz not null,
  duration_sec integer not null check (duration_sec >= 0 and duration_sec <= 86400),
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, date_key)
);

-- ---------------------------------------------------------------------------
-- Actualización automática de updated_at.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions
  for each row execute function public.touch_updated_at();
create trigger daily_sessions_touch before update on public.daily_sessions
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Perfil automático al crear un usuario.
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Seguridad por fila.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.billing_events enable row level security;
alter table public.daily_sessions enable row level security;

-- Perfiles: leer y editar solo el propio. No se crean ni se borran desde el cliente.
create policy "perfil: leer propio" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = id);

create policy "perfil: editar propio" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Suscripciones: solo lectura de las propias. Las escribe el webhook.
create policy "suscripcion: leer propia" on public.subscriptions
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- billing_events no tiene políticas: nadie desde el cliente puede leerla ni escribirla.
revoke all on public.billing_events from anon, authenticated;
revoke all on public.subscriptions from anon;
revoke insert, update, delete on public.subscriptions from authenticated;

-- Sesiones diarias: cada persona gestiona solo las suyas.
create policy "sesion: leer propia" on public.daily_sessions
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "sesion: crear propia" on public.daily_sessions
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "sesion: actualizar propia" on public.daily_sessions
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "sesion: borrar propia" on public.daily_sessions
  for delete to authenticated
  using ((select auth.uid()) = user_id);
