-- Foco Mente · pagos en otras monedas (migración 20261104120000).
-- Qué cambia: Hotmart cobra al comprador en su moneda aunque el producto esté en USD. Antes, un pago en otra moneda se
-- rechazaba. Ahora la compra se guarda con la moneda y el importe original; monto_usd solo se rellena si el pago fue en USD.
--  - monto_usd deja de ser obligatorio (queda null para pagos en otra moneda).
--  - moneda: código de 3 letras (USD por defecto, que es lo que tenían las compras anteriores).
--  - monto_original: el importe en la moneda del comprador.
-- El acceso no depende de la moneda: sigue dependiendo de la oferta y del estado de la compra.
-- Estado: no se aplica desde la app. Requiere antes 20261025120000_retencion_datos.sql.

alter table public.compras alter column monto_usd drop not null;

alter table public.compras
  add column if not exists moneda text not null default 'USD'
    check (char_length(moneda) = 3 and moneda = upper(moneda)),
  add column if not exists monto_original numeric(14, 2)
    check (monto_original is null or monto_original >= 0);
