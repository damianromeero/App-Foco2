-- Foco Mente · reembolso o cancelación que llega antes que su compra (migración 20261024130000).
-- Qué es: una fila por transacción de Hotmart cuyo reembolso o cancelación llegó ANTES que el aviso de la compra. Cuando la
-- compra llega, nace con ese estado final y no vuelve a «aprobada» (supabase/functions/hotmart-aviso/handler.ts). Sin esta
-- tabla, el reembolso se perdía y la compra quedaba con acceso.
-- Datos: solo el identificador de la transacción, el estado final, la fecha del aviso y el evento. Sin correo ni datos de pago.
-- Estado: no se aplica desde aquí. La persona la ejecuta a mano en su proyecto, después de 20261024120000_accesos.sql (docs/CONECTAR.md).
-- Modelo de acceso: solo la escribe la función hotmart-aviso, con la clave de servicio (que salta RLS). RLS activo y ningún
-- permiso para anon ni authenticated: nadie la lee ni la cambia desde el navegador.

create table if not exists public.compras_finales_previas (
  id_hotmart text primary key check (char_length(id_hotmart) between 1 and 120),
  estado text not null check (estado in ('reembolsada', 'cancelada')),
  -- Fecha de creación del aviso que fijó el estado. Un aviso más antiguo no lo cambia.
  fecha_aviso timestamptz not null,
  -- Evento de Hotmart que lo trajo (por ejemplo PURCHASE_REFUNDED).
  origen text not null check (char_length(origen) between 1 and 80),
  recibido_en timestamptz not null default now()
);

alter table public.compras_finales_previas enable row level security;
revoke all on public.compras_finales_previas from anon, authenticated;

-- Suscripciones: el plan puede faltar. Si la cancelación de una suscripción llega antes que su primer cobro, la fila guarda
-- solo la cancelación (sin plan), y el primer cobro no la reactiva (supabase/functions/hotmart-aviso/handler.ts).
alter table public.suscripciones_hotmart alter column plan drop not null;
