-- Foco Mente · eliminar la propia cuenta desde la app (migración 20261025110000).
-- Qué es: una función que borra la fila de auth.users de la persona que llama, es decir, la suya. Sus filas guardadas
-- (perfil, sesiones, suscripciones de la app) se borran en cascada porque referencian auth.users con on delete cascade.
-- Por qué existe: la función de Edge «delete-account» usaba la clave de servicio. Con esta función el navegador llama a
-- la base con su propia sesión y la clave de servicio deja de necesitarse para borrar cuentas.
-- NO cancela la suscripción de Hotmart (la cancela la persona compradora en Hotmart) y NO toca compras, accesos ni
-- eventos de pago: esos registros son el historial del cobro y no dependen de la cuenta de la app.
-- Estado: no se aplica desde aquí. La persona la ejecuta a mano en su proyecto de Supabase (docs/CONECTAR.md).
-- Requiere antes 20261024130000_compras_finales_previas.sql (no depende de sus tablas, pero es el orden de la guía).

create or replace function public.borrar_mi_cuenta()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  usuario uuid := auth.uid();
begin
  -- Sin sesión no hay cuenta que borrar. El error no revela si el correo tiene compra.
  if usuario is null then
    raise exception 'Necesitas iniciar sesión.' using errcode = '28000';
  end if;
  delete from auth.users where id = usuario;
end;
$$;

-- Solo una persona con sesión puede llamarla, y solo borra su propia cuenta (auth.uid()). anon no tiene ningún permiso.
revoke all on function public.borrar_mi_cuenta() from public, anon;
grant execute on function public.borrar_mi_cuenta() to authenticated;
