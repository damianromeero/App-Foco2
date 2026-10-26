# Despliegue paso a paso

Foco Mente funciona **sin backend** en modo local. Esta guía resume cómo desplegar la base de datos, las funciones y el sitio para que quien compre en Hotmart entre con el correo de su compra. Ningún paso exige que la app esté publicada para probar la parte local.

El detalle de cada paso (qué pulsar, qué debe salir y qué hacer si falla) está en [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md). Esta página es el resumen técnico del despliegue.

> Las funciones de `supabase/functions/` no se comprueban con el build de la app. Pruébalas de punta a punta, con compras de prueba, antes de cobrar con dinero real.

## 0. Requisitos

- Cuenta de Supabase y un proyecto nuevo (elige la región más cercana a tus compradores y anótala para la política de privacidad).
- Cuenta de Hotmart con tu producto, sus dos ofertas (mensual y anual) en dólares y su webhook.
- Cuenta en un hosting estático (por ejemplo Vercel).
- Un servicio de correo (por ejemplo Resend) para los enlaces de entrada, con tu dominio verificado.
- La herramienta de línea de comandos de Supabase para desplegar las funciones. `[VERIFICAR: instalación vigente]`
- Una app de autenticación en tu teléfono para el segundo factor del panel.

## 1. Base de datos y autenticación (Supabase)

1. Crea el proyecto en Supabase.
2. Aplica las migraciones **a mano, una por una y en este orden**, pegando cada archivo de `supabase/migrations/` en el editor SQL y pulsando **Run**:
   1. `20261016120000_init.sql` (base de la app: perfiles y sesiones diarias).
   2. `20261024100000_panel_admin.sql` (administradores y medición).
   3. `20261024100001_limite_eventos.sql` (límites de la medición).
   4. `20261024110000_compras_hotmart.sql` (compras, suscripciones y avisos).
   5. `20261024120000_accesos.sql` (acceso de los compradores).
   6. `20261024130000_compras_finales_previas.sql` (reembolsos y cancelaciones que llegan antes que su compra).
   7. `20261025100000_acceso_regla_hotmart.sql` (acceso según la regla de Hotmart y la vista `accesos_vigentes`).
   8. `20261025110000_borrar_mi_cuenta.sql` (eliminar la propia cuenta sin clave de servicio).
   9. `20261025120000_retencion_datos.sql` (borrado nocturno de avisos, medición y contadores viejos; plazos en `retencion_config`, `[VERIFICAR: con tu asesor]`).

   Nunca cambies una migración ya aplicada: un cambio nuevo va en una migración nueva con fecha posterior.

3. En **Authentication → URL Configuration**:
   - _Site URL_: la URL pública de la app, por ejemplo `https://tu-dominio.com`.
   - _Redirect URLs_: `https://tu-dominio.com/entrar/confirmar` y `https://tu-dominio.com/admin/confirmar`. Para desarrollo, `http://localhost:5173/entrar/confirmar` y `http://localhost:5173/admin/confirmar`; quítalas antes de vender.
4. **Apaga el registro público** (_Allow new users to sign up_). Las cuentas de compradores las crea la función de Hotmart al aprobar la compra, y la de administración la creas tú en Authentication → Users.
5. Revisa la plantilla del correo del enlace («Magic Link») en **Authentication → Email Templates**: en español, con el enlace de confirmación y sin textos de marca que no sean tuyos.
6. Conecta tu servicio de correo en el SMTP de Supabase. El correo por defecto es para pruebas.
7. En **Advisors** comprueba que no hay avisos de seguridad sobre las tablas. RLS debe estar activo en todas.
8. Crea tu usuario de administradora y dala de alta en `administradores` (INFRAESTRUCTURA.md, paso 12).

## 2. Cobro con Hotmart

Con Hotmart, la compra, la prueba, la garantía y el reembolso van por Hotmart. La app no recibe ni guarda datos de pago.

1. **Producto y ofertas**, en dólares (USD):
   - Oferta mensual y oferta anual, con renovación automática. Los importes sugeridos están en `src/domain/pricing.ts` (US$4,99 y US$39,90). Precios sugeridos: confirma tu oferta en Hotmart antes de vender.
   - La prueba de 7 días la configuras en Hotmart (`TRIAL_DAYS` en `src/domain/pricing.ts`). La app la anuncia pero no la controla.
   - La garantía de 15 días la configuras en Hotmart (`garantiaDias` en `src/config/plantilla.ts`).
   - Copia el código de cada oferta y pégalo en `OFERTAS_HOTMART`, en `supabase/functions/_shared/hotmart.ts`. Sin ellos, los avisos quedan como `sin-plan`.
2. **Impuestos**: configura el IVA o el impuesto de tu país en Hotmart y comprueba que el precio mostrado coincide con lo que se cobra. Ver [LEGAL.md](LEGAL.md).
3. **Variables del servidor** (no llevan `VITE_`): `SUPABASE_URL` y `SUPABASE_ANON_KEY` para las rutas `/api` (sesión, sincronización y cuenta). Solo la clave anon; la de servicio no se usa aquí. `[VERIFICAR: que Vercel las entrega a las funciones de api/ en tu despliegue]`
4. **Enlace de compra**: copia el enlace de la oferta. Va en la variable `VITE_ENLACE_COMPRA` del hosting. La plantilla usa un solo enlace para los dos planes.
5. **Webhook** (en la configuración de Hotmart):
   - URL: `https://<tu-proyecto>.supabase.co/functions/v1/hotmart-aviso`
   - Eventos: compra aprobada, compra cancelada, reembolso, contracargo, cancelación de suscripción y cobros atrasados. La plantilla espera `PURCHASE_APPROVED`, `PURCHASE_CANCELED`, `PURCHASE_REFUNDED`, `PURCHASE_CHARGEBACK`, `PURCHASE_DELAYED`, `PURCHASE_PROTEST` y `SUBSCRIPTION_CANCELLATION`. `[VERIFICAR: nombres exactos en la pantalla de Hotmart]`
   - Copia el token («hottok»). Va como secreto de Supabase (sección 3). La función lo lee solo de la cabecera `X-HOTMART-HOTTOK`.

## 3. Secretos y funciones (Supabase)

Define el secreto. Nunca va en el código ni en el repositorio:

```bash
supabase secrets set HOTMART_HOTTOK=<token-de-hotmart>
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` y la clave de servicio de Supabase las inyecta Supabase en las funciones. No las definas tú. `[VERIFICAR: que Supabase las inyecta en tu proyecto]`

Despliega la función del aviso:

```bash
supabase link --project-ref <tu-proyecto>
supabase functions deploy hotmart-aviso --no-verify-jwt
```

`[VERIFICAR: nombre exacto de los comandos y los flags en tu versión del CLI]`

`hotmart-aviso` no lleva JWT porque la llama Hotmart. Su seguridad es el token `HOTMART_HOTTOK`, que llega en la cabecera `X-HOTMART-HOTTOK` y que la función comprueba antes de guardar nada. Cada vez que cambies `supabase/functions/_shared/hotmart.ts`, vuelve a desplegarla.

Comprueba que responde y que no guarda nada sin token (debe dar 401 `token-no-valido` una vez definido el secreto, y 503 `sin-configuracion` antes):

```bash
curl -i -X POST "https://<tu-proyecto>.supabase.co/functions/v1/hotmart-aviso" -H "content-type: application/json" -d '{}'
```

Solo si enciendes la medición anónima (INFRAESTRUCTURA.md, paso 14), define también `APP_URL` y despliega `eventos`:

```bash
supabase secrets set APP_URL=https://tu-dominio.com
supabase functions deploy eventos --no-verify-jwt
```

Las funciones de Stripe no se despliegan en esta ruta (ver «Opción avanzada: Stripe»).

## 4. Sitio (hosting estático)

1. Importa el repositorio privado en tu hosting. El `vercel.json` del proyecto define el build, la reescritura para la aplicación de una sola página y las cabeceras de seguridad (CSP, HSTS y otras). Si usas otro proveedor, traslada esas cabeceras. La CSP solo permite conexiones a `*.supabase.co`: si usas un dominio propio para Supabase, edítala.
2. Variables de entorno (_Production_ y _Preview_):

| Variable                 | Valor                            | Notas                                                                                   |
| ------------------------ | -------------------------------- | --------------------------------------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | `https://<proyecto>.supabase.co` | Pública                                                                                 |
| `VITE_SUPABASE_ANON_KEY` | clave pública (anon)             | Pública: la seguridad la dan las reglas por fila (RLS)                                  |
| `VITE_APP_URL`           | `https://tu-dominio.com`         | Con él se arman los enlaces de los correos. Debe coincidir con las _Redirect URLs_      |
| `VITE_ENLACE_COMPRA`     | enlace `https` de Hotmart        | Vacío: el botón de compra lleva a la app sin cobrar y no aparece «Comprar»              |
| `VITE_SUPPORT_EMAIL`     | correo de soporte                | Opcional. Que coincida con `contactoEmail`                                              |
| `VITE_BILLING_MODE`      | `off`                            | Es el valor para Hotmart. `demo` no llega a producción y `stripe` es la opción avanzada |

Las variables `VITE_` se incorporan al construir el sitio: si las cambias, vuelve a desplegar. Ningún secreto lleva ese prefijo.

3. Conecta tu dominio propio. El HTTPS suele ser automático.

## 5. Prueba antes de abrir

Lista mínima con compras de prueba (Hotmart) y un correo tuyo. El detalle está en INFRAESTRUCTURA.md, paso 13.

- [ ] Una petición sin token a la función da 401, sin guardar nada.
- [ ] El envío de prueba del webhook de Hotmart da 200 y deja una fila en `eventos_pago`.
- [ ] Una compra de prueba queda `aprobada` en `compras`, crea la cuenta y deja el acceso `activo`.
- [ ] Con el correo de la compra, `/entrar` envía el enlace, `/entrar/confirmar` te lleva a `/hoy`.
- [ ] Un reembolso con otra compra vigente mantiene el acceso; el de la última compra vigente lo quita.
- [ ] Pedir un reembolso no quita el acceso: solo lo quita el aviso REFUNDED o CHARGEBACK.
- [ ] Un correo sin compra termina en `/sin-compra`; uno que no existe no recibe ningún correo.
- [ ] «Cerrar sesión» devuelve a `/entrar`.
- [ ] Un aviso repetido no duplica nada (tablas `compras` y `eventos_pago`).
- [ ] Una persona no puede leer la fila de `accesos` de otra (prueba con dos cuentas).
- [ ] `/admin` pide segundo factor, y una cuenta que no es administradora ve «No hay nada aquí».

Solo después de revisarlo todo, abre la oferta a la venta.

## 6. Límites conocidos

- Las notificaciones push en segundo plano no están incluidas. Necesitan claves VAPID y un servicio de envío.
- La app no controla la prueba, la garantía ni los avisos de renovación: los gestiona Hotmart.
- Un contracargo o una expiración no cambian el acceso: quedan como `no-procesado` y los revisas tú en el panel.
- Cancelar voluntariamente una suscripción mantiene el acceso hasta `date_next_charge`; por impago, lo quita en el aviso. `[VERIFICAR: cuándo lo envía Hotmart y si distingue ambos casos]`
- Los correos de entrada que envíes quedan en tu servicio de correo. Decide tu política de retención.
- El botón «Eliminar mi cuenta» de `/cuenta` llama a la función de base `borrar_mi_cuenta()` (migración 8), que no usa Stripe ni Hotmart. Si no ejecutaste esa migración, atiende los borrados a mano (INFRAESTRUCTURA.md, paso 15). Antes, el comprador cancela su suscripción en Hotmart.
- La decisión de acceso la toma la base de datos, pero la guarda de pantalla corre en el navegador y el código de la app es público. No es protección de contenido.

## Opción avanzada: Stripe (sin conectar)

> Solo si decides cobrar con Stripe **en lugar de** Hotmart. No se usa con Hotmart, no está probada en esta versión del kit y choca con el acceso: `RequireAcceso` solo deja entrar a quien tiene una fila `activo` en `accesos`, que solo escribe `hotmart-aviso`. Antes de usarla, adapta el acceso a las suscripciones de Stripe. Ver [CONECTAR.md](CONECTAR.md).

1. **Productos y precios** (en modo de pruebas primero):
   - Producto «Foco Mente Premium».
   - Moneda de todos los precios: dólares (USD).
   - Precio recurrente mensual: US$4,99. Debe coincidir con `src/domain/pricing.ts`.
   - Precio recurrente anual: US$39,90. Debe coincidir con `src/domain/pricing.ts`.
   - La prueba de 7 días la fija la función `create-checkout-session` (`trial_period_days: 7`). Debe coincidir con `TRIAL_DAYS` en `src/domain/pricing.ts`.
   - Copia los dos identificadores `price_...`.
2. **Impuestos**: configura el IVA según tu país y comprueba que el precio mostrado coincide con lo que se cobra.
3. **Portal de cliente** (_Billing → Customer portal_): permite cambiar el método de pago, ver facturas y cancelar al final del periodo. Activa solo lo que la app ofrece.
4. **Avisos de factura próxima**: activa el aviso de factura próxima para las renovaciones anuales. La app avisa por su cuenta antes del primer cobro, a partir del evento `customer.subscription.trial_will_end`.
5. **Webhook** (_Developers → Webhooks_):
   - URL: `https://<tu-proyecto>.supabase.co/functions/v1/stripe-webhook`
   - Eventos: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `customer.subscription.trial_will_end` e `invoice.paid`. Son los que procesa la función.
   - Copia el _signing secret_.
6. **Secretos** en Supabase (nunca en el código): `APP_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `RESEND_API_KEY` y `EMAIL_FROM` (con un remitente verificado). Se definen con `supabase secrets set`.
7. **Funciones**:

   ```bash
   supabase functions deploy create-checkout-session
   supabase functions deploy create-portal-session
   supabase functions deploy cancel-subscription
   supabase functions deploy withdraw-subscription
   supabase functions deploy stripe-webhook --no-verify-jwt
   ```

   `stripe-webhook` no lleva JWT porque lo llama Stripe. Su seguridad es la firma del evento (`stripe-signature`). Para probarlo en local, usa la CLI de Stripe: `stripe listen --forward-to https://<tu-proyecto>.supabase.co/functions/v1/stripe-webhook`.

8. Variable del hosting: `VITE_BILLING_MODE=stripe` (sin Supabase vuelve a `off`).

Lista mínima con Stripe en modo de pruebas:

- [ ] Empezar la prueba: Stripe pide tarjeta y, al volver, Cuenta muestra «Prueba».
- [ ] Cancelar: Cuenta muestra «Cancelada» y mantiene el acceso hasta la fecha.
- [ ] Reactivar mientras el periodo siga abierto.
- [ ] Desistir dentro de 14 días: se cancela, se devuelve el importe y llega el correo.
- [ ] Eliminar cuenta: desaparecen las suscripciones y los datos de la nube.
- [ ] Un evento de webhook repetido no duplica nada (tabla `billing_events`).
- [ ] Una firma inválida del webhook devuelve 400.

Solo después, cambia a las claves de producción de Stripe y repite la lista con una tarjeta real y un importe mínimo. El aviso de renovación anual depende de la configuración de Stripe (punto 4). Los correos guardados en Resend no se borran al eliminar una cuenta.
