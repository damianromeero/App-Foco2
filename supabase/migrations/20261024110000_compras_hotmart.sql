-- Foco Mente · cobro con Hotmart (migración 20261024110000).
-- Qué es: las tres tablas que llena la función supabase/functions/hotmart-aviso cuando Hotmart avisa de una compra:
--   compras              una fila por transacción de Hotmart (una renovación de suscripción también es una compra nueva).
--   suscripciones_hotmart una fila por suscriptor de Hotmart: si la suscripción sigue activa o ya se canceló.
--   eventos_pago         una fila por aviso recibido, con su tipo y su resultado. Sirve para la idempotencia (un aviso
--                        repetido tiene la misma clave y no crea otra fila) y para dejar rastro de lo que no se procesó.
--                        NUNCA guarda correo, nombre ni datos de pago.
-- Requiere antes 20261024100000_panel_admin.sql (la función public.es_administrador()).
-- Estado: no se aplica desde aquí. La persona la ejecuta a mano en su proyecto de Supabase (docs/CONECTAR.md).
--
-- Modelo de acceso:
--  - Solo escribe la función hotmart-aviso, con la clave de servicio (que salta RLS). Ningún permiso de escritura para
--    anon ni para authenticated: nadie cambia estas tablas desde el navegador.
--  - Lectura: solo la administración del panel (public.es_administrador(): está en la lista de administradoras Y entró con
--    segundo factor, aal2). Cualquier otra persona, con sesión o sin ella, no ve filas. anon no tiene ningún permiso.
--  - Fecha del aviso (`fecha_aviso`): un estado solo cambia si el aviso nuevo es MÁS RECIENTE que el guardado. Así un aviso
--    repetido o fuera de orden no deshace un reembolso ni reactiva una suscripción cancelada.

-- Compras de Hotmart. Un aviso repetido no crea otra fila (la clave es el identificador de la transacción).
create table if not exists public.compras (
  id_hotmart text primary key check (char_length(id_hotmart) between 1 and 120),
  plan text not null check (plan in ('mensual', 'anual')),
  monto_usd numeric(10, 2) not null check (monto_usd >= 0),
  comision_usd numeric(10, 2) check (comision_usd is null or comision_usd >= 0),
  -- Identificador de la suscripción de Hotmart si la compra es parte de una; null en un cobro único.
  suscriptor text check (suscriptor is null or char_length(suscriptor) between 1 and 120),
  -- Correo del comprador, en minúsculas. Decide el acceso a la app (tabla accesos).
  correo text not null check (char_length(correo) between 3 and 254 and correo = lower(correo)),
  estado text not null check (estado in ('aprobada', 'reembolsada', 'cancelada')),
  -- Fecha de creación del último aviso que cambió el estado (creation_date del aviso de Hotmart).
  fecha_aviso timestamptz not null,
  creado_en timestamptz not null default now()
);
create index if not exists compras_correo_idx on public.compras (correo);
create index if not exists compras_suscriptor_idx on public.compras (suscriptor);
create index if not exists compras_creado_idx on public.compras (creado_en desc);

-- Suscripciones de Hotmart. Cada cobro aprobado es una fila nueva en compras; aquí solo se guarda si la suscripción sigue
-- activa o ya se canceló. «cancelada» es terminal: un cobro que llega después no la reactiva.
create table if not exists public.suscripciones_hotmart (
  suscriptor text primary key check (char_length(suscriptor) between 1 and 120),
  plan text not null check (plan in ('mensual', 'anual')),
  estado text not null check (estado in ('activa', 'cancelada')),
  fecha_aviso timestamptz not null,
  actualizada_en timestamptz not null default now()
);

-- Registro de avisos. Una fila por aviso, con el resultado que tuvo. Sin datos de la persona compradora.
--   aplicado        cambió una compra, una suscripción o el acceso.
--   duplicado       compra aprobada que ya existía (aviso repetido o transacción repetida).
--   obsoleto        reembolso, cancelación o suscripción más antiguos que lo guardado: no cambió nada.
--   registrado      tipo conocido sin efecto (por ejemplo PURCHASE_DELAYED).
--   no-procesado    tipo de evento que la plantilla no conoce.
--   rechazado       compra con datos incompletos.
--   sin-plan        la oferta no está en OFERTAS_HOTMART (supabase/functions/_shared/hotmart.ts).
--   divisa-no-usd   el precio no viene en dólares.
--   sin-compra      reembolso o cancelación de una compra que no existe en compras.
--   sin-suscripcion cancelación de suscripción sin identificador de suscriptor, o de una que no existe.
--   sin-correo      compra aprobada sin correo válido del comprador: no crea compra ni acceso.
--   sin-fecha       el aviso no trae una fecha de creación válida (la función responde 400 y no cambia nada).
--   formato-no-reconocido  al aviso le falta el tipo de evento.
-- Esta lista repite ESTADOS_EVENTO de supabase/functions/_shared/hotmart.ts; la prueba migraciones-compras.test.ts
-- comprueba que coinciden.
create table if not exists public.eventos_pago (
  -- Identificador del aviso que da Hotmart (o derivado de su contenido si no trae uno). Un aviso repetido no crea otra fila.
  id_evento text primary key check (char_length(id_evento) between 1 and 120),
  tipo text not null check (char_length(tipo) between 1 and 80),
  estado text not null check (estado in (
    'aplicado', 'duplicado', 'obsoleto', 'registrado', 'no-procesado', 'rechazado', 'sin-plan', 'divisa-no-usd',
    'sin-compra', 'sin-suscripcion', 'sin-correo', 'sin-fecha', 'formato-no-reconocido'
  )),
  -- Fecha de creación del aviso; null si el aviso no la trajo.
  fecha_aviso timestamptz,
  recibido_en timestamptz not null default now()
);
create index if not exists eventos_pago_recibido_idx on public.eventos_pago (recibido_en desc);

-- RLS activo en cada tabla, en este mismo archivo. Primero se quitan todos los permisos a anon y authenticated; después se
-- concede solo la lectura, con su política. Nada de INSERT, UPDATE ni DELETE: solo la clave de servicio, en la función.
alter table public.compras enable row level security;
alter table public.suscripciones_hotmart enable row level security;
alter table public.eventos_pago enable row level security;

revoke all on public.compras from anon, authenticated;
revoke all on public.suscripciones_hotmart from anon, authenticated;
revoke all on public.eventos_pago from anon, authenticated;

grant select on public.compras to authenticated;
grant select on public.suscripciones_hotmart to authenticated;
grant select on public.eventos_pago to authenticated;

drop policy if exists compras_leer on public.compras;
create policy compras_leer on public.compras for select to authenticated using ((select public.es_administrador()));

drop policy if exists suscripciones_hotmart_leer on public.suscripciones_hotmart;
create policy suscripciones_hotmart_leer on public.suscripciones_hotmart for select to authenticated
  using ((select public.es_administrador()));

drop policy if exists eventos_pago_leer on public.eventos_pago;
create policy eventos_pago_leer on public.eventos_pago for select to authenticated using ((select public.es_administrador()));
