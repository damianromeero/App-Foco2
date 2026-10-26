# Conectar tus servicios

Esta página describe el código de cada servicio, sus interruptores y lo que todavía hay que confirmar. El cobro por defecto es **Hotmart**; **Stripe** queda como opción avanzada, sin conectar. Para el paso a paso con tus cuentas (qué pulsar, qué debe salir y qué hacer si falla), sigue [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md).

Conecta **un servicio a la vez**, en el orden de esa guía, y verifica cada paso antes de seguir. En esta copia no hay nada conectado.

## Antes de empezar

- Ten cuentas de Supabase, Hotmart, un servicio de correo para los enlaces de entrada y el hosting donde publiques la app. La compra, el cobro, la prueba, la garantía y el reembolso van por Hotmart, no por la app.
- Toda clave va en `.env.local` (en tu computadora), en las variables del hosting o en los secretos de Supabase. **Nunca** en el código ni en un archivo que subas a GitHub. `.env.local` ya está en `.gitignore`.
- Copia `.env.example` a `.env.local`. Mientras una variable esté vacía o comentada, esa parte sigue en modo local.

| Servicio                               | Para qué                                     | Dónde se conecta                                                              | Variables                                                                       |
| -------------------------------------- | -------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Hosting estático                       | Publicar la app                              | `vercel.json` y tu proveedor                                                  | `VITE_APP_URL` (tu dominio)                                                     |
| Supabase                               | Enlace de entrada, compras, accesos y panel  | `src/services/acceso.ts`, `src/services/supabase.ts` y `supabase/migrations/` | `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (navegador)                       |
| Hotmart (cobro por defecto)            | Compra, prueba, garantía, reembolso y avisos | `supabase/functions/hotmart-aviso` y `supabase/functions/_shared/hotmart.ts`  | `VITE_ENLACE_COMPRA` (navegador); `HOTMART_HOTTOK` (secreto de Supabase)        |
| Correo de entrada                      | Enviar los enlaces de acceso                 | Supabase → Authentication (SMTP)                                              | Las credenciales viven solo en Supabase                                         |
| Medición anónima (apagada)             | Uso de la app en el panel                    | `src/services/medicion.ts` y `supabase/functions/eventos`                     | `APP_URL` (secreto de Supabase)                                                 |
| Stripe (opción avanzada, sin conectar) | Cobros dentro de la app                      | `src/services/billing.ts` y `supabase/functions/`                             | `VITE_BILLING_MODE=stripe`; secretos de Stripe y Resend en Supabase (ver abajo) |

El orden importa: primero la base y el acceso, después Hotmart y sus avisos, después el sitio publicado y al final la prueba de compra. Un cobro necesita una cuenta de acceso a la que asociar la compra.

## Bloque `conexiones`

En `src/config/plantilla.ts` está el bloque que indica qué servicio real está conectado:

```ts
conexiones: { supabase: false, pagos: false, correo: false, ia: false } as Conexiones,
```

| Clave      | Servicio                | Ponla en `true` cuando                                                                                                    |
| ---------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `supabase` | Acceso y datos          | Las migraciones estén aplicadas, el acceso funcione y la prueba de compra de la guía (paso 13) haya salido bien.          |
| `pagos`    | Cobro con Hotmart       | El aviso de compra esté probado de punta a punta (pasos 7 a 10 y 13). Con Hotmart, `VITE_BILLING_MODE` se queda en `off`. |
| `correo`   | Correo propio de la app | Hayas escrito un envío de correo propio. La plantilla no lo trae: los enlaces de entrada los envía Supabase.              |
| `ia`       | IA                      | Hayas implementado y revisado una función de IA. La plantilla no trae ninguna.                                            |

Pon un valor en `true` solo cuando su conexión esté escrita, probada y configurada. Nunca lo cambies para que el gate pase. `npm run verificar` lee este bloque y comprueba las variables `VITE_` del servicio.

## Qué cambia al conectar

- Con Supabase configurado, la app de `/hoy` en adelante exige sesión **y** una fila `activo` en `accesos`. Sin compra, la persona ve `/sin-compra`. El inicio guiado (`/onboarding`) no lo exige.
- `/entrar` muestra el formulario del correo. Sin Supabase, `/entrar`, `/entrar/confirmar` y `/sin-compra` llevan directo a la app gratuita, sin avisos a tus clientes (`npm run verificar` te recuerda lo que falta).
- Los textos legales deben describir los proveedores que reciben datos: revisa `src/content/legal.ts` con tu abogado.
- La garantía (`garantiaDias`) y la prueba (`TRIAL_DAYS`) deben coincidir con tu producto de Hotmart.

## 1 · Supabase: acceso y datos

Lo que ya está escrito:

- `src/services/acceso.ts` pide el enlace de entrada con `signInWithOtp` y `shouldCreateUser: false`, con redirección a `${VITE_APP_URL}/entrar/confirmar`. Sin compra no llega ningún correo y la pantalla responde igual, para no revelar qué correos tienen compra.
- `src/app/RequireAcceso.tsx` protege la zona de la app. Lee la fila de `accesos` con la sesión de la propia persona (RLS la limita a su correo). Ante cualquier error muestra «No pudimos comprobar tu acceso» y nunca concede acceso.
- Las pantallas `/entrar`, `/entrar/confirmar` y `/sin-compra`, y el botón «Cerrar sesión» de `/cuenta`.
- Las migraciones de `supabase/migrations/`, con RLS en cada tabla, y `supabase/config.toml` (registro apagado y funciones sin verificación de JWT). Ese archivo describe el entorno local: en tu proyecto en la nube, el registro y las direcciones de retorno se configuran en el panel de Supabase (paso 4 de la guía) y la verificación de JWT se declara al desplegar (paso 8).
- Sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, la app sigue en demostración local: sin acceso, sin cobros y sin peticiones a Supabase.

Qué hacer: pasos 3 a 6 y 12 de [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md).

**Verifica:** pide un enlace desde `/entrar` con una cuenta que tenga compra, ábrelo en el mismo navegador y comprueba que llegas a `/hoy`. Sin sesión, `/hoy` te lleva a `/entrar`.

## 2 · Cobros con Hotmart (por defecto)

Con Hotmart, la compra, el cobro, la prueba, la garantía y el reembolso los gestiona Hotmart. La app no recibe ni guarda datos de pago: solo guarda lo que el aviso trae (correo, plan, importe, identificadores y estado).

Lo que ya está escrito:

- **El enlace de compra.** `VITE_ENLACE_COMPRA` es un enlace `https` de Hotmart. Lo usan «Empezar prueba de 7 días» en `/paywall` y `/precios`, y «Comprar» en `/entrar` y `/sin-compra`. Vacío, ese botón se llama «Empezar a entrenar» y lleva a la app sin cobrar (o a `/entrar`, con Supabase), y «Comprar» no aparece. Ninguna pantalla avisa de que falta: lo lista `npm run verificar`. Es **un solo enlace para los dos planes**.
- **La función `hotmart-aviso`.** Recibe los avisos y es el único código con la clave de servicio. Responde, en este orden:
  - `405` si no es un POST.
  - `503` si falta `HOTMART_HOTTOK`, `SUPABASE_URL` o la clave de servicio de Supabase. No procesa nada.
  - `413` si el aviso pesa más de 200 KB, y `400` si el cuerpo no es JSON.
  - `401` si el token falta o no coincide. La comparación es en tiempo constante.
  - `400` (`aviso-sin-fecha`) si el aviso no trae una fecha de creación válida. Lo registra y no cambia nada.
  - `500` si la base no guardó, para que Hotmart reintente.
  - `200` en el resto, incluidos los avisos que no reconoce, que quedan registrados. Nunca responde 200 sin haber guardado.
- **Reglas del negocio.**
  - Un estado solo cambia si el aviso es más reciente que lo guardado (`creation_date`). Un aviso repetido o antiguo no cambia nada.
  - Una compra aprobada es idempotente. Una compra reembolsada o cancelada nunca vuelve a «aprobada».
  - Un reembolso o una cancelación de una compra no quita el acceso si otra compra del mismo correo sigue vigente.
  - Una suscripción cancelada es definitiva: un cobro posterior no la reactiva.
  - La cuenta de acceso se crea con la primera compra aprobada, con el correo confirmado y sin enviar ningún correo.
  - El acceso se recalcula desde las compras tras cada aviso que las toca.
- **Códigos de oferta.** `OFERTAS_HOTMART` en `supabase/functions/_shared/hotmart.ts`. Mientras valgan los marcadores, todos los avisos de compra quedan como `sin-plan`.

Qué hacer: pasos 7 a 10 de [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md).

**Verifica:** el envío de prueba de Hotmart responde 200 y deja una fila en `eventos_pago`; la prueba de compra del paso 13 deja una compra `aprobada` y un acceso `activo`.

### Lo que sigue exigiendo [VERIFICAR]

No se pudo confirmar contra la documentación oficial de Hotmart al escribir la plantilla. Cópialo de la pantalla de webhooks de tu cuenta, compáralo con el envío de prueba y, solo entonces, quita el marcador. Cada punto indica dónde está en el código:

- [VERIFICAR: nombre de la cabecera y del campo del cuerpo donde Hotmart envía el token] en `CABECERA_TOKEN_HOTMART` y `CAMPO_TOKEN_CUERPO`, `supabase/functions/_shared/hotmart.ts`.
- [VERIFICAR: que el aviso trae `creation_date` de primer nivel, en milisegundos] en `CAMPO_FECHA_AVISO`, mismo archivo. Sin fecha válida, ningún aviso cambia nada y la función responde 400.
- [VERIFICAR: nombres exactos de los eventos de compra aprobada, cancelada, reembolso y cancelación de suscripción] en `EVENTOS_DE_COMPRA` y `EVENTO_CANCELACION_SUSCRIPCION`, mismo archivo.
- [VERIFICAR: rutas de los datos del aviso] `data.purchase.transaction`, `data.purchase.offer.code`, `data.purchase.price.value`, `data.purchase.price.currency_code`, `data.buyer.email` y `data.subscription.subscriber.code`, en `analizarAviso`, mismo archivo.
- [VERIFICAR: cuándo envía Hotmart el evento de cancelación de suscripción, si al cancelar o al terminar el periodo pagado] porque la plantilla quita el acceso en cuanto llega.
- [VERIFICAR: si durante la prueba gratuita Hotmart envía la compra aprobada al empezar la prueba o solo al primer cobro] porque el acceso nace con la compra aprobada.
- [VERIFICAR: qué ocurre en Hotmart cuando alguien reactiva una suscripción cancelada, y qué código de suscriptor recibe] porque la cancelación es definitiva en la plantilla.
- [VERIFICAR: que el aviso de tus ofertas llega en dólares (USD)] porque cualquier otra divisa queda como `divisa-no-usd`.
- [VERIFICAR: que Hotmart ofrece prueba gratuita y garantía de 15 días en tu producto, y si una misma página de compra puede ofrecer los dos planes] en tu cuenta de Hotmart.
- [VERIFICAR: códigos de error de Supabase para «registro no permitido»] en `CODIGOS_SIN_REGISTRO`, `src/services/acceso.ts`. Se confirman con una respuesta real.

## 3 · Hosting y variables

La app es un sitio estático (`npm run build` genera `dist/`). `vercel.json` define la compilación, la reescritura para la aplicación de una sola página y las cabeceras de seguridad (política de contenido, HSTS y otras). Con otro proveedor, traslada esas cabeceras.

La política de contenido solo permite conexiones a `*.supabase.co`. Si usas un dominio propio para Supabase, edítala.

Las variables `VITE_` se incorporan al construir el sitio: si las cambias, vuelve a desplegar. Nunca pongas un secreto con ese prefijo. Qué hacer: paso 11 de [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md).

## 4 · Panel de administración

Vive en `/admin`, es de solo lectura y exige estar en `administradores` y haber entrado con segundo factor. Qué hace, qué no hace y cómo se protege: [PANEL-ADMIN.md](PANEL-ADMIN.md). Qué hacer: paso 12 de la guía.

## 5 · Medición anónima (opcional, apagada)

La medición cuenta visitas y sesiones sin nombres, correos ni textos libres. Hay **dos interruptores** y deben valer lo mismo:

- `medicionAnonima` en `src/config/plantilla.ts` (el navegador no envía nada si vale `false`).
- `medicionAnonima` en `supabase/functions/_shared/eventos.ts` (la función `eventos` responde 204 sin guardar si vale `false`).

La lista cerrada de 13 eventos está en `src/config/medicion.ts`, en `supabase/functions/_shared/eventos.ts` y en la función `registrar_evento_app` de la migración `20261024100001_limite_eventos.sql`. `supabase/tests/contrato.test.ts` falla si alguna se queda atrás. Encenderla exige revisar la política de privacidad y la de cookies. Qué hacer: paso 14 de la guía.

## Stripe: opción avanzada, sin conectar

El código de Stripe sigue en la plantilla y **no se usa con Hotmart**. No lo despliegues ni lo conectes junto a Hotmart.

Qué hay:

- Cliente: `src/services/billing.ts` (modos `off`, `demo` y `stripe`) y las pantallas Cuenta, Hoy y Pago, que muestran textos de Stripe cuando `VITE_BILLING_MODE` es `stripe` o `demo`.
- Funciones de Supabase: `stripe-webhook`, `create-checkout-session`, `create-portal-session`, `cancel-subscription`, `withdraw-subscription`, y los ayudantes `_shared/context.ts` y `_shared/email.ts`.
- Datos: las tablas `subscriptions`, `billing_events` y la columna `stripe_customer_id` de `profiles`, de la migración `20261016120000_init.sql`. Con Hotmart quedan vacías.
- Variables y secretos: `VITE_BILLING_MODE=stripe` en el navegador; `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_ANNUAL`, `RESEND_API_KEY`, `EMAIL_FROM` y `APP_URL` en los secretos de Supabase. El correo transaccional (`_shared/email.ts`) lo usan solo las funciones de Stripe.

Estado: sin conectar y sin probar en esta versión del kit. Antes de usarlo debes tener en cuenta:

- **Choca con el acceso.** `RequireAcceso` solo deja entrar a quien tiene una fila `activo` en `accesos`, y esa tabla solo la escribe `hotmart-aviso`. Si activaras Stripe, nadie entraría hasta que adaptes el acceso a las suscripciones de Stripe.
- **`borrar_mi_cuenta()`** (función de base, migración `20261025110000`) no usa Stripe ni la clave de servicio. Borra la cuenta de quien llama y, en cascada, su perfil, sus sesiones y sus suscripciones guardadas. Con Hotmart, el comprador cancela antes su suscripción en Hotmart.
- La guía de despliegue de Stripe, conservada para quien la necesite, está en [DEPLOY.md](DEPLOY.md).

Puedes borrar el código de Stripe o mantenerlo; si lo borras, no borres las tablas de la migración inicial que usa la sincronización (`profiles` y `daily_sessions`).

## Anuncios de Meta (píxel)

La portada tiene cinco llamadas a la acción con la misma acción (`/onboarding`). Cada una tiene un `id` estable y `data-evento="inicio-gratis"`:

| `id`           | Dónde                                         |
| -------------- | --------------------------------------------- |
| `cta-cabecera` | Cabecera (en escritorio)                      |
| `cta-portada`  | Primer bloque, bajo el titular                |
| `cta-medio`    | Mitad de la portada, tras los precios         |
| `cta-final`    | Final de la portada                           |
| `cta-barra`    | Barra inferior en móvil, tras el primer botón |

Los enlaces de compra («Empezar prueba de 7 días» en `/paywall` y `/precios`, y «Comprar» en `/entrar` y `/sin-compra`) todavía no llevan `data-evento`. Si quieres medir el inicio de compra en Meta, añade `data-evento="inicio-compra"` a esos enlaces. Mapa de eventos para Meta:

- **ViewContent**: al cargar la portada (`/`).
- **InitiateCheckout**: al pulsar un elemento con `data-evento="inicio-compra"`. No lo asocies a `inicio-gratis`: esos clics llevan al inicio guiado y falsearían la medición.

La plantilla no carga el píxel de Meta. Si lo añades, hazlo tú, con tu gestor de etiquetas o en tu hosting, y pide el consentimiento que exija tu país. Ejemplo de la conexión de la compra:

```js
document.addEventListener('click', (event) => {
  if (event.target.closest('[data-evento="inicio-compra"]')) {
    fbq('track', 'InitiateCheckout');
  }
});
```

Añadir el píxel carga un script de otra empresa: la política de contenido de `vercel.json`, la política de cookies de `src/content/legal.ts` y las pruebas que comprueban que la portada no hace peticiones externas deben cambiar con él.

## Decisiones pendientes

- **Un enlace de compra para los dos planes.** El selector mensual y anual de `/precios` no cambia el enlace. Usa una página de compra de Hotmart que deje elegir el plan, o vende un solo plan.
- **Versión gratuita.** Con Supabase conectado, la app de `/hoy` en adelante exige compra. La portada, `/precios` (plan «Gratuito») y `src/content/pact.ts` («Empiezas sin cuenta») todavía hablan de empezar gratis. Decide qué ofreces de verdad y adapta esos textos.
- **«Eliminar mi cuenta».** El botón de `/cuenta` abre un aviso y exige escribir ELIMINAR; después llama a `borrar_mi_cuenta()`, que no usa Stripe. Si no ejecutaste su migración, atiende los borrados a mano (INFRAESTRUCTURA.md, paso 15).
- **Contracargos y expiraciones.** No cambian el acceso: quedan como `no-procesado`.
- **Cancelación de suscripción.** Quita el acceso en cuanto llega el aviso, no al terminar el periodo pagado.
- **Código de Stripe.** Decide si lo retiras (ver arriba).
- **Plazo legal de desistimiento.** Confirma con tu abogado cómo se combina con la Garantía de 15 días (ver `src/content/legal.ts` y [LEGAL.md](LEGAL.md)).

## Antes de publicar

- [ ] `npm run verificar` no tiene errores reales y los pendientes que quedan los conoces y los has explicado.
- [ ] Los pasos 1 a 13 de [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md) tienen su «Debe salir», incluida la prueba de compra con acceso.
- [ ] `OFERTAS_HOTMART` lleva tus códigos de oferta, sin marcadores, y la función está desplegada con ellos.
- [ ] Confirmaste en tu cuenta de Hotmart los puntos de «Lo que sigue exigiendo [VERIFICAR]» y quitaste los marcadores resueltos.
- [ ] Los datos del responsable en `src/content/legal.ts` están completos y revisados por un abogado de tu país.
- [ ] Nombre, eslogan, precios en dólares, prueba de 7 días, garantía de 15 días y correo de contacto coinciden con tu oferta (`src/config/plantilla.ts`, `src/domain/pricing.ts` y tu producto de Hotmart).
- [ ] Ninguna clave en el código: `git status` no muestra `.env.local`, y `npm run barrido` pasa.
- [ ] `npm run check`, `npm run e2e` y `npm run e2e:nube` pasan.
- [ ] Probaste el recorrido completo en tu teléfono real.
