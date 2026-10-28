# Guía de infraestructura

Esta guía te lleva de la copia de la plantilla a una app publicada donde quien compra en Hotmart entra con el correo de su compra, y tú ves las ventas en un panel privado. Cada paso dice qué hacer, cómo comprobar que quedó bien y si bloquea publicar o vender.

**En esta copia no hay nada conectado.** Tú creas cada cuenta y pegas cada clave. La plantilla no necesita tus claves en el repositorio y nunca debe llevarlas.

Si prefieres una versión en lenguaje llano, lee [GUIA-ALUMNO.md](GUIA-ALUMNO.md). Cuando termines un paso, pasa al siguiente: no saltes ninguno.

## Cómo leer cada paso

Cada paso tiene estas partes:

- **Qué hacer**: pasos numerados.
- **Dónde**: la pantalla o el menú. Los servicios cambian sus menús: confía más en el nombre del botón que en la ruta.
- **Debe salir**: lo que confirma que el paso quedó bien. No sigas sin verlo.
- **Si falla**: el error típico y cómo se arregla.

El encabezado de cada paso lleva una marca cuando bloquea algo:

- **bloquea publicar**: no abras el sitio al público sin esto.
- **bloquea vender**: no cobres a nadie sin esto.

Una copia sin Supabase configurado funciona como demostración local: sin acceso, sin cobros y abierta a cualquiera. Por eso el sitio no se abre al público hasta el paso 17.

Los marcadores funcionan así:

- `[COMPLETAR: …]`: un dato tuyo. Sustitúyelo por tu dato real. No dejes el marcador.
- `[VERIFICAR: …]`: algo que no se pudo confirmar al escribir esta guía. Compáralo con la pantalla real del servicio o con su documentación oficial antes de seguir.

Reglas de oro:

- Ninguna clave va al chat, a GitHub, al código ni a un archivo que se suba. Solo al hosting, a los secretos de Supabase o a `.env.local` en tu computadora.
- En esta guía, `<tu-proyecto>` es el identificador de tu proyecto de Supabase y `tu-dominio.com` es tu dominio. Sustitúyelos por los tuyos, y al pegar un comando quita también los signos `<` y `>`.
- Si un paso no sale como se describe, para y pregunta antes de improvisar.

## Cómo funciona cada capa

Esto es lo que ocurre desde que alguien compra hasta que entra:

1. La persona compra en la página de Hotmart (el enlace sale de `VITE_ENLACE_COMPRA`). Hotmart cobra y gestiona la prueba, la garantía y el reembolso.
2. Hotmart avisa a la función `hotmart-aviso` de Supabase (`https://<tu-proyecto>.supabase.co/functions/v1/hotmart-aviso`).
3. La función comprueba el token del aviso (`HOTMART_HOTTOK`) antes de tocar nada. Después guarda el aviso en `eventos_pago`, la compra en `compras`, la suscripción en `suscripciones_hotmart`, crea la cuenta de acceso de esa persona y recalcula su fila de `accesos`.
4. La persona abre `/entrar`, escribe el correo de la compra y recibe un enlace de Supabase (sin contraseñas). Al abrirlo llega a `/entrar/confirmar`.
5. La app lee su acceso en la vista `accesos_vigentes` (RLS: solo ve su propia fila y solo si el acceso sigue vigente). Si hay fila, la lleva a `/hoy`. Si no, a `/sin-compra`.
6. Un reembolso, una cancelación o un cobro atrasado vuelven a avisar a la función, que recalcula el acceso según [las reglas de acceso](GUIA-ALUMNO.md#reglas-de-acceso).

| Capa                    | Qué hace                                                                                                                               | Dónde vive                                           |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| Sitio                   | La app (Vite y React). Son archivos estáticos. Lo que lleva `VITE_` se incorpora al construir y lo puede leer cualquiera.              | Tu hosting (Vercel, `vercel.json`)                   |
| Acceso (Supabase Auth)  | Envía el enlace al correo. El registro público está apagado: solo existen las cuentas que crea la compra o que creas tú.               | Tu proyecto de Supabase                              |
| Base de datos           | Guarda compras, accesos, administradores y medición. Cada tabla tiene reglas por fila (RLS) que dicen quién puede leer qué.            | Tu proyecto de Supabase (editor SQL)                 |
| Función `hotmart-aviso` | Recibe los avisos de Hotmart. Es el único código del cobro con Hotmart que usa la clave de servicio, que se salta las reglas por fila. | `supabase/functions/hotmart-aviso`                   |
| Función `eventos`       | Recibe la medición anónima. Está apagada. Solo usa la clave pública.                                                                   | `supabase/functions/eventos`                         |
| Hotmart                 | Cobra, avisa de cada compra y gestiona prueba, garantía y reembolsos.                                                                  | Tu cuenta de Hotmart                                 |
| Panel `/admin`          | Muestra ventas y uso. Solo lectura. Exige estar en `administradores` y haber entrado con segundo factor.                               | `src/pages/admin` ([PANEL-ADMIN.md](PANEL-ADMIN.md)) |

Las funciones de Stripe que siguen en `supabase/functions/` (`stripe-webhook`, `create-checkout-session`, `create-portal-session`, `cancel-subscription` y `withdraw-subscription`) son una opción avanzada que esta guía no usa ni despliega. Ver [CONECTAR.md](CONECTAR.md).

## Variables

Aquí solo están los nombres y dónde se define cada una. Los valores van en el hosting, en los secretos de Supabase o en `.env.local`, nunca en esta guía ni en el repositorio.

| Variable                            | Dónde se define                       | ¿Pública? | Para qué sirve                                                                                                               | Paso  |
| ----------------------------------- | ------------------------------------- | --------- | ---------------------------------------------------------------------------------------------------------------------------- | ----- |
| `VITE_SUPABASE_URL`                 | Hosting y `.env.local`                | Sí        | Dirección de tu proyecto de Supabase. Sin ella (o sin la clave) la app queda en demostración local.                          | 11    |
| `VITE_SUPABASE_ANON_KEY`            | Hosting y `.env.local`                | Sí        | Clave pública de Supabase. La seguridad la dan las reglas por fila, no el secreto de esta clave.                             | 11    |
| `VITE_APP_URL`                      | Hosting y `.env.local`                | Sí        | Tu dominio con `https://`. Con él se arman los enlaces de los correos. Sin él se usa el dominio desde el que se abre la app. | 11    |
| `VITE_ENLACE_COMPRA`                | Hosting y `.env.local`                | Sí        | Enlace `https` de compra de Hotmart. Vacío: el botón de compra lleva a la app sin cobrar y no aparece «Comprar».             | 11    |
| `VITE_SUPPORT_EMAIL`                | Hosting y `.env.local`                | Sí        | Correo de soporte visible. Vacío: no se muestra.                                                                             | 2, 11 |
| `VITE_BILLING_MODE`                 | Hosting y `.env.local`                | Sí        | `off` por defecto y para Hotmart. `stripe` es solo la opción avanzada. `demo` se ignora en producción.                       | 11    |
| `HOTMART_HOTTOK`                    | Secreto de Supabase                   | No        | Token que Hotmart envía con cada aviso. Sin él, la función responde 503.                                                     | 9     |
| `APP_URL`                           | Secreto de Supabase                   | No        | Solo para la medición: la función `eventos` solo acepta llamadas del navegador desde este origen.                            | 14    |
| Clave de servicio de Supabase       | La inyecta Supabase en las funciones  | No        | Se salta las reglas por fila. Solo la usa `hotmart-aviso`. No la definas tú ni la copies a ningún sitio.                     | -     |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | Las inyecta Supabase en las funciones | -         | Dirección y clave pública que usan las funciones. No las definas tú. [VERIFICAR: que Supabase las inyecta en tu proyecto]    | -     |

Reglas:

- Una variable secreta nunca empieza por `VITE_`: todo lo que empieza así acaba dentro de los archivos públicos del sitio.
- Cambiar una variable `VITE_` exige volver a construir y desplegar el sitio.
- La clave de servicio nunca va al navegador. El gate aplica la regla a todo el repo salvo `supabase/functions/`: fuera de esa carpeta no puede aparecer el nombre de la variable de la clave de servicio.

## Los pasos de un vistazo

| Paso | Qué haces                                                        | Marca            |
| ---- | ---------------------------------------------------------------- | ---------------- |
| 1    | Datos de tu marca y de tu oferta                                 | bloquea publicar |
| 2    | Datos legales del titular                                        | bloquea publicar |
| 3    | Crear el proyecto de Supabase                                    | bloquea vender   |
| 4    | Configurar el acceso: registro apagado, URLs y correo del enlace | bloquea vender   |
| 5    | Correo de entrada propio (SMTP)                                  | bloquea vender   |
| 6    | Ejecutar las migraciones, en orden                               | bloquea vender   |
| 7    | Hotmart: producto, ofertas y códigos de oferta                   | bloquea vender   |
| 8    | Desplegar las funciones de Supabase                              | bloquea vender   |
| 9    | Webhook de Hotmart y secreto `HOTMART_HOTTOK`                    | bloquea vender   |
| 10   | Envío de prueba y comprobación de los nombres de campo           | bloquea vender   |
| 11   | Hosting y variables `VITE_`                                      | bloquea publicar |
| 12   | Administradora y segundo factor                                  | bloquea vender   |
| 13   | Prueba de compra con acceso                                      | bloquea vender   |
| 14   | Medición anónima (opcional, apagada)                             | sin marca        |
| 15   | Revisión legal con un profesional                                | bloquea vender   |
| 16   | Gate y pruebas                                                   | bloquea publicar |
| 17   | Publicar y abrir la venta                                        | bloquea vender   |
| 18   | Después de vender                                                | sin marca        |

---

## Paso 1 · Datos de tu marca y de tu oferta (bloquea publicar)

**Qué es:** fijar nombre, eslogan, precios, días de prueba y de garantía, y tu dominio, antes de conectar nada. Todo lo demás de la guía los usa.

**Qué hacer:**

1. Decide y anota fuera del repositorio: nombre de la marca, dominio (sin `https://` ni barra final), correo de contacto y de soporte, precios en dólares, días de prueba y días de garantía.
2. Abre `src/config/plantilla.ts` y cambia `nombre`, `eslogan`, `promesas`, `minutosSesion`, `garantiaDias` y `contactoEmail`. `correo@example.com` es solo un ejemplo.
3. Abre `src/domain/pricing.ts` y revisa los precios (`PLANS`, en centavos de dólar) y `TRIAL_DAYS`. Los importes de la plantilla (US$4,99 al mes y US$39,90 al año) son sugeridos: confirma tu oferta en Hotmart antes de vender. Si cambias un precio, cámbialo también en Hotmart.
4. Si cambias el nombre, también aparece en `index.html` (título y etiquetas para compartir) y en el manifiesto de `vite.config.ts` (`name` y `short_name`). Los iconos se regeneran con `scripts/generate-icons.py`. Los colores y las tipografías están en `src/index.css`.
5. Los textos de la portada, las promesas y las preguntas frecuentes están en `src/content/copy.ts`. Léelos enteros: no deben prometer nada que tu oferta no cumpla (prueba, garantía, cancelación).
6. Decide si tu app tendrá versión gratuita. Con Supabase conectado, la app de `/hoy` en adelante exige una compra activa; el inicio guiado (`/onboarding`) no la exige. La portada y `/precios` hablan de «Empezar gratis» y de un plan «Gratuito». Es una decisión tuya: adapta esos textos a lo que de verdad ofreces (`src/content/copy.ts`, `src/content/pact.ts` y `src/pages/marketing/Pricing.tsx`).

**Dónde:** tu copia, en `src/config/plantilla.ts`, `src/domain/pricing.ts`, `src/content/copy.ts`, `index.html` y `vite.config.ts`.

**Debe salir:** `npm run dev` abre `http://localhost:5173` con tu nombre y tus precios, y no hay textos que prometan algo que no vas a cumplir.

**Si falla:** si `npm run dev` no arranca, ejecuta `npm ci` y revisa que usas Node 24 (`.nvmrc`; el mínimo es la versión 22).

---

## Paso 2 · Datos legales del titular (bloquea publicar)

**Qué es:** completar quién es el responsable de la app. Los textos legales son borradores: no sustituyen la revisión de un profesional (paso 15).

**Qué hacer:**

1. Lista los marcadores que faltan:

   ```bash
   grep -rn "\[COMPLETAR" src supabase/functions
   ```

2. Ignora los resultados con `[COMPLETAR: …]` (con puntos suspensivos): son ejemplos dentro de los textos. En `src/content/legal.ts`, sustituye cada `[COMPLETAR: …]` real por tu dato: titular, identificador fiscal, domicilio, ley aplicable, proveedor del correo de entrada, y región de alojamiento y acuerdos de tratamiento de datos. No copies datos de otra empresa.
3. Pon tu correo de contacto en `contactoEmail` (`src/config/plantilla.ts`) y el mismo en `VITE_SUPPORT_EMAIL`, para que coincidan.
4. Revisa que los textos describen lo que de verdad conectas: Hotmart, Supabase, un servicio de correo para el enlace de entrada y tu hosting.

**Dónde:** `src/content/legal.ts` y `src/config/plantilla.ts`.

**Debe salir:** el comando del punto 1 ya no muestra marcadores del titular. Quedan los códigos de oferta de `supabase/functions/_shared/hotmart.ts` (paso 7) y los `[VERIFICAR: …]` que resolverá tu abogado (paso 15).

**Si falla:** si el gate sigue listando un marcador, usa el archivo y la línea que indica.

---

## Paso 3 · Crear el proyecto de Supabase (bloquea vender)

**Qué es:** la base de datos y el servicio de acceso de tu app. Lo creas tú, en tu cuenta.

**Qué hacer:**

1. Crea una cuenta en supabase.com y un proyecto nuevo.
2. Elige la región más cercana a tus compradores y anótala: la necesitarás en la política de privacidad.
3. Guarda la contraseña de la base de datos en un lugar seguro, fuera del repositorio.
4. Cuando el proyecto termine de iniciarse, anota tres datos fuera del repositorio: el identificador del proyecto (`<tu-proyecto>`, aparece en la dirección `https://<tu-proyecto>.supabase.co`), la URL del proyecto y la clave pública. `[VERIFICAR: nombre actual de la clave pública en Project Settings → API; puede llamarse «anon» o «publishable»]`
5. No copies la clave de servicio (`service_role`, o «secret») a ningún sitio. La función la recibe sola.

**Dónde:** Supabase → tu proyecto → Project Settings → API.

**Debe salir:** el proyecto activo y los tres datos anotados.

**Si falla:** si el proyecto tarda, espera unos minutos. No borres un proyecto para reintentar sin anotar antes sus datos.

---

## Paso 4 · Configurar el acceso: registro apagado, URLs y correo del enlace (bloquea vender)

**Qué es:** dejar que solo entren las cuentas que existen, y que el enlace del correo vuelva a tu app.

**Qué hacer:**

1. Apaga el registro público. En Authentication → Sign In / Providers (o Providers → Email), desactiva la opción que permite que nuevas personas se registren («Allow new users to sign up»). `[VERIFICAR: nombre y ubicación exactos en tu panel]` Así solo existen las cuentas que crea la compra aprobada (la función de Hotmart) y las que creas tú.
2. En Authentication → URL Configuration:
   - _Site URL_: `https://tu-dominio.com`
   - _Redirect URLs_: añade las dos direcciones exactas:
     - `https://tu-dominio.com/entrar/confirmar` (compradores)
     - `https://tu-dominio.com/admin/confirmar` (administradora)

   Si todavía no tienes dominio, usa la dirección de prueba que te dé el hosting en el paso 11 y vuelve aquí. Supabase solo lleva a las direcciones de esta lista. Para probar en tu computadora puedes añadir `http://localhost:5173/entrar/confirmar` y `http://localhost:5173/admin/confirmar`; quítalas antes de vender.

3. En Authentication → Email Templates, abre la plantilla del enlace de acceso («Magic Link») y comprueba que lleva el enlace de confirmación (`{{ .ConfirmationURL }}`). Tradúcela al español y quita cualquier texto de marca que no sea tuyo. `[VERIFICAR: nombre exacto de la plantilla en tu panel]`
4. Comprueba que el segundo factor con app de autenticación (TOTP) está permitido en tu proyecto. `[VERIFICAR: Authentication → Multi-Factor; en proyectos nuevos suele venir activo]`

**Dónde:** Supabase → Authentication.

**Debe salir:** registro público apagado; _Site URL_ y las dos _Redirect URLs_ con tu dominio; la plantilla del enlace en español con el enlace de confirmación.

**Si falla:**

- Si el enlace del correo te lleva a otra página o a un error, la dirección no está en la lista de _Redirect URLs_ o no es idéntica a la que usa la app. Corrígela y pide un enlace nuevo.
- Cada enlace sirve una sola vez y caduca. `[VERIFICAR: duración del enlace en tu proyecto]` Ábrelo en el mismo navegador donde lo pediste: la app usa un intercambio de código (PKCE) que se guarda en ese navegador.

---

## Paso 5 · Correo de entrada propio, SMTP (bloquea vender)

**Qué es:** el servicio que envía los enlaces de entrada de tus compradores y de la administradora. El envío por defecto de Supabase es para pruebas y tiene límites bajos. `[VERIFICAR: límites actuales del correo por defecto de Supabase]`

**Qué hacer:**

1. Elige un servicio de correo (por ejemplo, Resend u otro) y crea tu cuenta.
2. Verifica tu dominio en ese servicio: te mostrará registros DNS (SPF y DKIM) que debes añadir en el panel DNS de tu proveedor de dominio. Espera a que el servicio lo marque como verificado.
3. Crea una clave o contraseña de envío y guárdala fuera del repositorio.
4. En Supabase, abre Project Settings → Authentication → SMTP Settings (o Authentication → Emails → SMTP Settings), activa el SMTP propio y rellena servidor, puerto, usuario, contraseña, correo remitente (una dirección de tu dominio verificado) y nombre del remitente. `[VERIFICAR: ruta exacta del menú y valores que pide tu servicio de correo]`
5. Pega la clave o contraseña solo en ese campo de Supabase.

**Dónde:** el servicio de correo, el panel DNS de tu dominio y Supabase → Project Settings → Authentication.

**Debe salir:** el SMTP guardado sin error. La prueba real del correo se hace en el paso 12 (enlace del panel) y en el paso 13 (enlace de un comprador): revisa también la carpeta de spam.

**Si falla:** si Supabase muestra un error de SMTP, revisa servidor, puerto y usuario. Si el correo no llega, revisa que el remitente es de tu dominio verificado. Los registros DNS pueden tardar en propagarse: espera y vuelve a verificar en vez de añadir duplicados.

---

## Paso 6 · Ejecutar las migraciones, en orden (bloquea vender)

**Qué es:** crear las tablas y las reglas de seguridad. Las ejecutas tú, a mano, en el editor SQL de Supabase. La app no aplica ninguna migración.

**Qué hacer:** ejecuta estos archivos de `supabase/migrations/` en este orden exacto y uno cada vez. Para cada uno: ábrelo en tu copia, copia todo su contenido, pégalo en el editor SQL y pulsa **Run**.

| Orden | Archivo                                      | Qué crea                                                                                                                                                                                                                                                                                               |
| ----- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1     | `20261016120000_init.sql`                    | Base de la app: perfiles y sesiones diarias para sincronizar. También crea tablas de la opción Stripe (`subscriptions`, `billing_events`) que con Hotmart quedan vacías.                                                                                                                               |
| 2     | `20261024100000_panel_admin.sql`             | `administradores`, las funciones `soy_administrador()` y `es_administrador()` y `eventos_app`.                                                                                                                                                                                                         |
| 3     | `20261024100001_limite_eventos.sql`          | `limite_eventos_app` y la función `registrar_evento_app` (medición con límites).                                                                                                                                                                                                                       |
| 4     | `20261024110000_compras_hotmart.sql`         | `compras`, `suscripciones_hotmart` y `eventos_pago`.                                                                                                                                                                                                                                                   |
| 5     | `20261024120000_accesos.sql`                 | `accesos`: una fila por correo con su estado (`activo` o `inactivo`).                                                                                                                                                                                                                                  |
| 6     | `20261024130000_compras_finales_previas.sql` | `compras_finales_previas`: el reembolso o la cancelación que llega antes que su compra. Hace que el plan de una suscripción pueda faltar si la cancelación llega antes del primer cobro.                                                                                                               |
| 7     | `20261025100000_acceso_regla_hotmart.sql`    | Acceso según la regla de Hotmart: estado «mantenida» (cobro atrasado), motivo y fin de la cancelación, fecha del aviso en `accesos` y la vista `accesos_vigentes`, que es la que lee la app.                                                                                                           |
| 8     | `20261025110000_borrar_mi_cuenta.sql`        | Función `borrar_mi_cuenta()`: la persona con sesión borra su propia cuenta. Sustituye a la función Edge `delete-account`, que usaba la clave de servicio.                                                                                                                                              |
| 9     | `20261025120000_retencion_datos.sql`         | Retención: `retencion_config` (plazos) y `purgar_retencion()`, que borra cada noche los avisos, la medición y los contadores más viejos que su plazo, con pg_cron si está habilitada. `[VERIFICAR: plazos con tu asesor antes de vender]` `[COMPLETAR: plazos de compras y accesos, que no se purgan]` |

Reglas:

- No cambies una migración ya aplicada. Un cambio nuevo va en una migración nueva con fecha posterior, y toda tabla nueva lleva RLS activo.
- Si la primera dice que algo «ya existe», esa migración ya estaba aplicada: pasa a la siguiente. Las otras cuatro se pueden repetir sin daño.
- Si hay otro error, no ejecutes el siguiente archivo: copia el error completo y pide ayuda.

**Dónde:** Supabase → SQL Editor.

**Debe salir:** «Success» tras cada archivo. Después, estas dos consultas:

```sql
select table_name from information_schema.tables where table_schema = 'public' order by table_name;
select tablename, rowsecurity from pg_tables where schemaname = 'public' order by tablename;
```

La primera lista once tablas: `accesos`, `administradores`, `billing_events`, `compras`, `daily_sessions`, `eventos_app`, `eventos_pago`, `limite_eventos_app`, `profiles`, `subscriptions` y `suscripciones_hotmart`. En la segunda, `rowsecurity` debe ser `true` en todas.

**Si falla:** si una migración falla a medias, no la repitas a ciegas. Copia el mensaje completo y pide ayuda.

---

## Paso 7 · Hotmart: producto, ofertas y códigos de oferta (bloquea vender)

**Qué es:** la plataforma que cobra. La app no cobra por sí sola: Hotmart cobra, gestiona la prueba, la garantía y el reembolso, y avisa a tu función de cada compra.

**Qué hacer:**

1. Crea tu cuenta de productor en Hotmart y tu producto como suscripción. `[VERIFICAR: nombres de los menús y del tipo de producto en tu cuenta]`
2. Crea dos ofertas o planes: **mensual** y **anual**, con renovación automática y precio en dólares (USD). Los importes sugeridos están en `src/domain/pricing.ts`. La función solo registra compras en USD: un aviso en otra divisa queda como `divisa-no-usd`. `[VERIFICAR: que el aviso de tu oferta trae la divisa USD en data.purchase.price.currency_code]`
3. Configura en Hotmart la **prueba de 7 días** (`TRIAL_DAYS` en `src/domain/pricing.ts`) y la **garantía de 15 días** (`garantiaDias` en `src/config/plantilla.ts`). La portada, los precios y las preguntas frecuentes las anuncian, pero la app no las controla. `[VERIFICAR: que Hotmart ofrece una prueba gratuita y una garantía de 15 días para tu producto, y cómo se llaman esas opciones]` Si Hotmart no las ofrece, no las anuncies: cambia los textos.
4. Copia el **código de cada oferta** (busca «código de oferta» u «offer code» en la ficha de la oferta). `[VERIFICAR: dónde lo muestra tu cuenta]`
5. Abre `supabase/functions/_shared/hotmart.ts`, busca `OFERTAS_HOTMART` y sustituye los dos marcadores por esos códigos:

   ```ts
   export const OFERTAS_HOTMART = {
     mensual: '<código de tu oferta mensual>',
     anual: '<código de tu oferta anual>',
   } as const;
   ```

   Pega cada código entre las comillas, sin los signos `<` y `>`.

6. Copia el **enlace de compra** de la oferta y guárdalo para el paso 11 (`VITE_ENLACE_COMPRA`). No lo pongas en el código. La plantilla usa **un solo enlace de compra** para los dos planes: el selector mensual y anual de `/precios` muestra el precio pero no cambia el enlace. Usa una página de compra de Hotmart que deje elegir el plan, o vende un solo plan. `[VERIFICAR: si tu producto puede mostrar los dos planes en una misma página de compra]`

**Dónde:** Hotmart → tu producto → ofertas; y `supabase/functions/_shared/hotmart.ts` en tu copia.

**Debe salir:** un producto con dos ofertas (mensual y anual) en USD, la prueba y la garantía configuradas, y `OFERTAS_HOTMART` sin marcadores.

**Si falla:** una oferta que no esté en `OFERTAS_HOTMART` no crea compra ni acceso: el aviso queda como `sin-plan` (paso 10). Si un plan no permite renovación automática, no lo uses para la suscripción.

---

## Paso 8 · Desplegar las funciones de Supabase (bloquea vender)

**Qué es:** publicar en tu proyecto la función que recibe los avisos de Hotmart. Se despliega con la herramienta de línea de comandos de Supabase.

**Qué hacer:**

1. Instala la herramienta de línea de comandos de Supabase y comprueba que responde. `[VERIFICAR: método de instalación vigente en la documentación de Supabase]`

   ```bash
   supabase --version
   ```

2. Entra con tu cuenta y enlaza la carpeta con tu proyecto:

   ```bash
   supabase login
   supabase link --project-ref <tu-proyecto>
   ```

3. Despliega la función del aviso. Hotmart no envía sesión de Supabase, así que se despliega sin verificación de JWT (`supabase/config.toml` ya lo declara):

   ```bash
   supabase functions deploy hotmart-aviso --no-verify-jwt
   ```

   `[VERIFICAR: nombre exacto de los comandos y de los flags en tu versión del CLI, con «supabase functions deploy --help»; algunas versiones piden Docker]`

4. Cada vez que cambies `supabase/functions/_shared/hotmart.ts` (por ejemplo, los códigos de oferta), vuelve a desplegar la función.
5. No despliegues las funciones de Stripe. Esta guía no las usa.

**Dónde:** tu terminal, en la carpeta de tu copia.

**Debe salir:** el despliegue termina sin error. Comprueba que la función responde y que **no** guarda nada:

```bash
curl -i -X POST "https://<tu-proyecto>.supabase.co/functions/v1/hotmart-aviso" -H "content-type: application/json" -d '{}'
```

Todavía no has definido el token (paso 9), así que debe responder **503** con `"error":"sin-configuracion"`.

**Si falla:**

- Si la respuesta dice «Missing authorization header» o «Invalid JWT», la función quedó con verificación de JWT: despliega de nuevo con `--no-verify-jwt`.
- Si el comando no encuentra el proyecto, repite `supabase link` con el identificador correcto.
- Una petición `GET` a la función debe responder **405**.

---

## Paso 9 · Webhook de Hotmart y secreto `HOTMART_HOTTOK` (bloquea vender)

**Qué es:** decirle a Hotmart a dónde avisar, y darle a tu función el token con el que reconoce los avisos de Hotmart.

**Qué hacer:**

1. En tu cuenta de Hotmart abre la configuración de webhooks y crea una notificación. `[VERIFICAR: ruta del menú; suele ser Herramientas → Webhook (API y notificaciones)]`
2. Rellena:
   - **URL**: `https://<tu-proyecto>.supabase.co/functions/v1/hotmart-aviso`
   - **Producto**: el de tu oferta.
   - **Versión**: la 2.0.0 o la vigente en la pantalla. `[VERIFICAR: versión vigente]`
   - **Eventos**: compra aprobada, compra cancelada, reembolso, contracargo (`PURCHASE_CHARGEBACK`), cancelación de suscripción (`SUBSCRIPTION_CANCELLATION`) y, para los cobros atrasados, `PURCHASE_DELAYED` y `PURCHASE_PROTEST`. El estado que trae la compra (`data.purchase.status`) manda sobre el nombre del evento. `[VERIFICAR: copia los nombres exactos de la pantalla. Un nombre distinto se guarda como no-procesado y no cambia accesos]`
3. Copia el **token** de Hotmart (se llama «hottok»). La función lo lee **solo de la cabecera `X-HOTMART-HOTTOK`**; un token en el cuerpo del aviso no sirve. `[VERIFICAR: dónde lo muestra tu cuenta y que Hotmart envía el token en esa cabecera]`
4. Guárdalo como secreto de Supabase. En la terminal:

   ```bash
   supabase secrets set HOTMART_HOTTOK=<token-de-hotmart>
   ```

   o en Supabase → Edge Functions → Secrets. `[VERIFICAR: flags del comando y ruta del menú]` Nunca lo pongas con prefijo `VITE_`, en el repositorio ni en el chat. Si la función sigue respondiendo 503 tras definirlo, vuelve a desplegarla. `[VERIFICAR: si hace falta volver a desplegar tras definir un secreto]`

5. Guarda la notificación en Hotmart.

**Dónde:** Hotmart (webhooks) y tu terminal (o Supabase → Edge Functions → Secrets).

**Debe salir:** la notificación guardada en Hotmart con URL, producto y eventos, y el secreto definido. Comprueba que la función ya rechaza lo que no trae token (sin token debe responder **401** con `"error":"token-no-valido"`):

```bash
curl -i -X POST "https://<tu-proyecto>.supabase.co/functions/v1/hotmart-aviso" -H "content-type: application/json" -d '{}'
```

**Si falla:** sin la cabecera `X-HOTMART-HOTTOK`, o con un valor distinto del secreto, la función responde 401 y no guarda nada. `[VERIFICAR: compáralo con el envío de prueba del paso 10]` Si la URL devuelve errores, Hotmart puede desactivar la notificación sola: revisa en su pantalla si quedó desactivada y reactívala cuando la función responda bien. `[VERIFICAR: comportamiento de Hotmart ante errores]`

---

## Paso 10 · Envío de prueba y comprobación de los nombres de campo (bloquea vender)

**Qué es:** el paso que decide si la función entiende los avisos reales de Hotmart. Los nombres de campo y de evento de la función **no se pudieron confirmar** contra la documentación oficial de Hotmart al escribirla (`supabase/functions/_shared/hotmart.ts`). No vendas hasta que este paso salga bien.

**Qué hacer:**

1. En la pantalla del webhook de Hotmart, envía **una** prueba. Abre su historial y mira qué datos envió y qué respuesta recibió.
2. En Supabase → SQL Editor ejecuta:

   ```sql
   select id_evento, tipo, estado, fecha_aviso, recibido_en from public.eventos_pago order by recibido_en desc limit 5;
   ```

3. Compara el aviso que envió Hotmart con esta lista, que es lo que lee la función. `[VERIFICAR: cada uno de estos campos contra el envío de prueba y la documentación oficial de Hotmart]`

   | Qué lee la función                             | Dónde                                               |
   | ---------------------------------------------- | --------------------------------------------------- |
   | Fecha del aviso, en milisegundos (obligatoria) | `creation_date`, primer nivel                       |
   | Identificador del aviso                        | `id`                                                |
   | Tipo de evento                                 | `event`                                             |
   | Identificador de la transacción                | `data.purchase.transaction`                         |
   | Código de la oferta                            | `data.purchase.offer.code`                          |
   | Importe y divisa                               | `data.purchase.price.value` y `.currency_code`      |
   | Correo de quien compra                         | `data.buyer.email`                                  |
   | Código de suscriptor                           | `data.subscription.subscriber.code`                 |
   | Comisión del productor (opcional)              | `data.commissions[]` con `commission_as` `PRODUCER` |
   | Token                                          | cabecera `X-HOTMART-HOTTOK` (la única que se lee)   |

**Dónde:** Hotmart (envío de prueba e historial) y Supabase → SQL Editor.

**Debe salir:** Hotmart recibió **200** y el aviso aparece **una sola vez** en `eventos_pago`. El estado puede ser `sin-plan` u otro de la tabla «Estados de los avisos», porque los datos de prueba de Hotmart no son de tu oferta: no es un fallo. Lo que importa es que haya fila y respuesta 200, y que los campos de la lista coincidan con lo que envió Hotmart.

**Si falla:**

- **400 `aviso-sin-fecha`:** el aviso no trae `creation_date` válida. **Para y no vendas.** La función no cambia nada sin fecha, y Hotmart puede desactivar el webhook si todos los avisos devuelven error. Hay que ajustar `CAMPO_FECHA_AVISO` en `supabase/functions/_shared/hotmart.ts`, sus pruebas y volver a desplegar: pide ayuda.
- **401:** falta la cabecera `X-HOTMART-HOTTOK` o no coincide con `HOTMART_HOTTOK`. Cópialo otra vez, sin espacios. Un token en el campo del cuerpo no sirve.
- **400 `aviso-sin-id`:** el aviso no trae `id`. No se guarda nada; Hotmart debe reenviarlo con su identificador.
- **503:** falta `HOTMART_HOTTOK`. Es un error de configuración, no del aviso.
- **500:** la base no guardó el aviso. Hotmart lo reintenta. Mira los registros de la función (Supabase → Edge Functions → `hotmart-aviso` → Logs).
- **200 sin `aplicado`:** mira el estado en la tabla «Estados de los avisos» más abajo.

---

## Paso 11 · Hosting y variables `VITE_` (bloquea publicar)

**Qué es:** publicar el sitio y darle las variables públicas. El `vercel.json` de la plantilla configura la compilación y las cabeceras de seguridad para Vercel; con otro proveedor, traslada esas cabeceras.

**Qué hacer:**

1. Sube tu copia a un repositorio **privado**. Antes comprueba que no subes tus claves:

   ```bash
   git ls-files | grep -E '(^|/)\.env'
   ```

   Solo debe aparecer `.env.example`. Si aparece `.env.local`, no subas nada y quítalo del repositorio.

2. En tu hosting, importa el repositorio. Para Vercel: _Add New → Project_; el marco es Vite, el comando es `npm run build` y la carpeta de salida es `dist` (ya están en `vercel.json`). `[VERIFICAR: versión de Node del proyecto en el hosting; la plantilla usa Node 24 y exige al menos la 22]`
3. En las variables de entorno (_Production_ y _Preview_) añade, con **tus** valores:
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`
   - `VITE_APP_URL` (`https://tu-dominio.com`)
   - `VITE_ENLACE_COMPRA` (el enlace del paso 7)
   - `VITE_SUPPORT_EMAIL`
   - `VITE_BILLING_MODE` con el valor `off` (o no la definas)
4. Para trabajar en tu computadora copia `.env.example` a `.env.local` y rellena las mismas variables. `.env.local` no se sube a git.
5. Despliega. Conecta tu dominio en el hosting y copia los registros DNS que te pida en el panel de tu proveedor de dominio.
6. Si cambiaste una variable después de desplegar, vuelve a desplegar: las variables `VITE_` se incorporan al construir.
7. Si usas un dominio propio para Supabase, edita la política de seguridad (CSP) de `vercel.json`: hoy solo permite conexiones a `*.supabase.co`.
8. Vuelve al paso 4 y confirma que _Site URL_ y las _Redirect URLs_ usan tu dominio final.

**Dónde:** tu hosting, el panel DNS de tu dominio y `.env.local`.

**Debe salir:** el despliegue en estado listo y estas comprobaciones en tu dominio:

- `https://tu-dominio.com/` abre la portada.
- `https://tu-dominio.com/entrar` muestra el formulario del correo (y **no** te lleva directo a la app).
- El botón «Empezar prueba de 7 días» de `/paywall` y `/precios` lleva a tu página de Hotmart.

**Si falla:**

- Si `/entrar` te lleva directo a la app sin pedir el correo, faltan `VITE_SUPABASE_URL` o `VITE_SUPABASE_ANON_KEY`, o no volviste a desplegar después de definirlas.
- Si el botón de `/precios` dice «Empezar a entrenar» (o «Entrar con mi correo») en vez de «Empezar prueba de 7 días», o `/entrar` no muestra «Comprar», `VITE_ENLACE_COMPRA` está vacía o no empieza por `https://`. Las pantallas no lo avisan a tus clientes: `npm run verificar` lo lista en pendientes.
- Si el despliegue falla, el primer error del registro es el que importa.

---

## Paso 12 · Administradora y segundo factor (bloquea vender)

**Qué es:** crear la cuenta que entra al panel `/admin` y asegurarla con un código de una app de autenticación. Sin esto no ves ventas ni avisos.

**Qué hacer:**

1. En Supabase → Authentication → Users, crea un usuario con tu correo de administradora y márcalo como confirmado («Auto Confirm User»). `[VERIFICAR: nombre exacto del botón y de la opción]` El panel envía el enlace solo a cuentas que ya existen: no crea cuentas.
2. Copia su identificador (`uuid`), que tiene este formato: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`.
3. En Supabase → SQL Editor, dala de alta como administradora:

   ```sql
   insert into public.administradores (usuario_id)
   values ('<uuid-de-tu-usuario>');
   ```

   Compruébalo con:

   ```sql
   select usuario_id, creado_en from public.administradores;
   ```

4. Abre `https://tu-dominio.com/admin/entrar`, escribe tu correo y abre el enlace que llega, en el mismo navegador.
5. Llegarás a **Seguridad**. Pulsa «Mostrar el código QR» y escanéalo con una app de autenticación (Google Authenticator, 1Password u otra). **Escanéalo con dos teléfonos o apps a la vez antes de escribir el código**: la pantalla no permite añadir un segundo factor después.
6. Escribe el código de 6 dígitos. Si es correcto, entras al panel (**Hoy**).

**Dónde:** Supabase → Authentication → Users y SQL Editor; tu dominio en `/admin/entrar`.

**Debe salir:** el panel con sus cuatro secciones (Hoy, Ventas, Uso de la app y Seguridad). Con pocos datos al principio. Cada entrada nueva pide el enlace y el código.

**Si falla:**

- **«No hay nada aquí»** en `/admin`: tu usuario no está en `administradores`. Revisa el punto 3.
- **El enlace no llega:** el usuario no existe en Authentication (punto 1) o el SMTP no funciona (paso 5). La pantalla responde igual exista o no el correo.
- **«El código no es correcto»:** usa el código actual de la app; revisa la hora de tu teléfono.
- **Perdiste el teléfono:** en Supabase → Authentication → Users, abre tu usuario y quita el factor para registrar uno nuevo. `[VERIFICAR: opción exacta en el panel de Supabase]`
- No compartas el enlace ni el código con nadie.

---

## Paso 13 · Prueba de compra con acceso (bloquea vender)

**Qué es:** la prueba de punta a punta con tu dominio, tu función y tu Hotmart. Es la única que demuestra que alguien que paga puede entrar, que alguien sin compra no, y que un reembolso quita el acceso solo cuando corresponde. Usa siempre una compra de prueba y un correo tuyo, nunca el de un cliente.

Antes de empezar debes haber pasado los pasos 4 a 12.

**A. Compra de prueba, acceso**

1. Haz una compra de prueba con el enlace de tu oferta y con un correo tuyo al que tengas acceso. `[VERIFICAR: modo de prueba de tu cuenta de Hotmart (puede llamarse sandbox) y sus condiciones]`
2. En Supabase → SQL Editor:

   ```sql
   select id_evento, tipo, estado, recibido_en from public.eventos_pago order by recibido_en desc limit 5;
   select id_hotmart, plan, monto_usd, estado, creado_en from public.compras order by creado_en desc limit 5;
   select suscriptor, plan, estado, actualizada_en from public.suscripciones_hotmart order by actualizada_en desc limit 5;
   select correo, estado, origen, cambiado_en from public.accesos order by cambiado_en desc limit 5;
   ```

   Debe aparecer un aviso `aplicado`, una compra `aprobada`, una suscripción `activa` (si la compra es de suscripción) y un acceso `activo` con origen `PURCHASE_APPROVED`. Con prueba gratuita, un importe 0 es válido. `[VERIFICAR: si durante la prueba de 7 días Hotmart envía PURCHASE_APPROVED al empezar la prueba o solo al primer cobro; si solo llega al primer cobro, la persona no tendrá acceso durante la prueba]`

3. En Authentication → Users debe existir una cuenta con ese correo: la creó la función.
4. Desde tu teléfono abre `https://tu-dominio.com/entrar`, escribe el correo de la compra y abre el enlace del correo **en el mismo navegador**. Pasas por `/entrar/confirmar` y llegas a `/hoy` (la primera vez, la app te lleva antes por `/onboarding`).

**B. Reembolso con otra compra activa**

1. Con el mismo correo, haz una segunda compra de prueba (por ejemplo, del otro plan). Comprueba que hay dos compras `aprobada`.
2. Reembolsa o cancela la primera. `[VERIFICAR: que tu cuenta de Hotmart permite reembolsar una compra de prueba]`
3. Repite la consulta de `accesos`: debe seguir `activo`, porque la otra compra sigue vigente. En `compras`, la primera aparece como `reembolsada` (o `cancelada`).
4. Reembolsa la segunda. El acceso pasa a `inactivo` con origen `PURCHASE_REFUNDED`.
5. Recarga `/hoy`: debe llevarte a `/sin-compra`. La app vuelve a comprobar el acceso al abrirse o recargarse; una pestaña que ya estaba abierta lo notará al recargar.

Si Hotmart no te deja reembolsar una compra de prueba, las reglas de este punto están cubiertas por las pruebas automáticas de `supabase/tests/acceso-escenarios.test.ts`, pero no habrás comprobado el aviso real de reembolso: anótalo como pendiente y no vendas hasta comprobarlo.

**C. Sin compra**

1. En `/entrar`, escribe el correo de la administradora (existe en Authentication pero no tiene compra) y abre el enlace: debe llevarte a `/sin-compra` y decir «No encontramos una compra activa con este correo.»
2. En `/entrar`, escribe un correo que **no** existe: la pantalla dice «Si hay una compra con ese correo, te hemos enviado un enlace», pero no llega ningún correo. Es lo esperado: la respuesta es la misma para todos.

**D. Cerrar sesión**

1. Con acceso activo, abre `/cuenta` y pulsa «Cerrar sesión»: vuelves a `/entrar`.
2. Abre `/hoy`: te lleva a `/entrar`.
3. En `/sin-compra` también hay «Cerrar sesión» y «Usar otro correo».

**Dónde:** Hotmart, Supabase → SQL Editor y tu teléfono.

**Debe salir:** las cuatro partes (A a D) como se describen. Solo entonces pon `supabase` y `pagos` en `true` en el bloque `conexiones` de `src/config/plantilla.ts` (paso 17).

**Si falla:**

- **El comprador pagó y no entra:** mira `eventos_pago` (tabla de estados) y `accesos`. Lo más común es que la oferta no esté en `OFERTAS_HOTMART` (`sin-plan`), que el aviso no trajera correo (`sin-correo`) o que entre con un correo distinto al de la compra.
- **El enlace vuelve a `/entrar` con «no es válido o ya caducó»:** pídelo de nuevo y ábrelo en el mismo navegador. Revisa las _Redirect URLs_ (paso 4).
- **«No pudimos comprobar tu acceso»:** falla la lectura de `accesos`. Revisa que la migración 5 está aplicada y las variables `VITE_` del paso 11. La app nunca concede acceso por un fallo.
- **No quedó nada en `eventos_pago`:** el aviso no llegó. Mira el historial del webhook en Hotmart y repasa los pasos 9 y 10.

**Limpieza:** las compras de prueba aparecen en el panel como ventas e ingresos. Cuando termines, elimínalas con cuidado (solo las tuyas) en el editor SQL, y borra el usuario de prueba en Authentication → Users:

```sql
delete from public.compras where id_hotmart in ('<transaccion-de-prueba-1>', '<transaccion-de-prueba-2>');
delete from public.suscripciones_hotmart where suscriptor = '<suscriptor-de-prueba>';
delete from public.accesos where correo = 'correo@example.com';
```

Sustituye cada marcador por el valor de tu prueba y revisa antes qué filas borras con un `select`.

---

## Paso 14 · Medición anónima (opcional, apagada)

**Qué es:** contar qué pantallas se ven y cuántas sesiones se terminan, sin nombres, correos ni textos libres. Está **apagada**: con ella apagada la app no envía nada y no guarda nada en el navegador. No necesitas encenderla para vender; sin ella, las secciones **Uso de la app** y parte de **Hoy** del panel quedan vacías.

**Qué se mide:** una lista cerrada de 13 eventos (`src/config/medicion.ts`): portada vista, precios vistos, clic en comprar, enlace de acceso pedido, acceso confirmado, aviso de «sin compra» visto, paso del inicio guiado, inicio terminado, sesión iniciada, juego terminado, sesión completada, sesión abandonada y bloque de foco iniciado. Cada evento lleva su tipo, un identificador aleatorio del dispositivo (se renueva cada 30 días) y, a veces, un valor de una lista cerrada (el juego, el paso o la pantalla).

**Qué hacer para encenderla:**

1. Habla con tu abogado: la política de privacidad y la de cookies deben contarla, y tu país puede exigir un aviso o un consentimiento. `src/content/legal.ts` añade por sí solo un párrafo cuando `medicionAnonima` vale `true`, pero es un borrador.
2. Define el secreto `APP_URL` con tu dominio. Sin él, el navegador no puede llamar a la función:

   ```bash
   supabase secrets set APP_URL=https://tu-dominio.com
   ```

3. Despliega la función:

   ```bash
   supabase functions deploy eventos --no-verify-jwt
   ```

4. Enciende **los dos interruptores**, que deben valer lo mismo:
   - `medicionAnonima` en `src/config/plantilla.ts` (lado del navegador).
   - `medicionAnonima` en `supabase/functions/_shared/eventos.ts` (lado del servidor).

   `supabase/tests/contrato.test.ts` falla si no coinciden. Además tiene una prueba («en la plantilla que se vende, la medición sale apagada») que fallará a propósito al encenderla: cámbiala a conciencia.

5. Vuelve a desplegar el sitio (cambió `plantilla.ts`) y la función `eventos` (cambió `eventos.ts`).

**Cómo comprobarla:** envía un evento de prueba a la función y mira qué responde.

```bash
curl -i -X POST "https://<tu-proyecto>.supabase.co/functions/v1/eventos" -H "content-type: application/json" -d '{"tipo":"portada_vista","dispositivo":"11111111-1111-4111-8111-111111111111"}'
```

| Respuesta | Qué significa                                                                                                                                                                                                                    |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 204       | Con la medición **apagada**: no se leyó ni se guardó nada. Con la medición **encendida**: el evento se guardó.                                                                                                                   |
| 400       | El evento no está en la lista cerrada, trae datos de más o el cuerpo no es JSON o pesa más de 2 KB.                                                                                                                              |
| 405       | No era un POST.                                                                                                                                                                                                                  |
| 429       | Demasiados eventos seguidos: 60 por minuto y por dirección en la función, o 30 por dispositivo y 600 en total, por minuto, en la base.                                                                                           |
| 502       | La función no pudo guardar el evento en la base.                                                                                                                                                                                 |
| 503       | «La medición no está conectada»: la función no tiene `SUPABASE_URL` o `SUPABASE_ANON_KEY`. Supabase las inyecta; si ves este código en tu proyecto, revisa el despliegue. `[VERIFICAR: que Supabase las inyecta en tu proyecto]` |

Para distinguir el 204 de «apagada» del de «guardó», mira la tabla:

```sql
select tipo, valor, creado_en from public.eventos_app order by creado_en desc limit 5;
```

Apagada: no hay fila nueva. Encendida: aparece. Prueba también un evento inválido (`{"tipo":"cualquier_cosa","dispositivo":"11111111-1111-4111-8111-111111111111"}`): debe dar 400 con la medición encendida.

El 503 (medición encendida pero sin Supabase) no se puede provocar en tu proyecto desplegado, porque Supabase da a la función sus variables. Está cubierto por `supabase/tests/medicion-servidor.test.ts`, que lo comprueba junto con el 204 de «apagada». Si lo ves en producción, la función perdió sus variables: vuelve a desplegarla.

Para borrar tus eventos de prueba:

```sql
delete from public.eventos_app where dispositivo = '11111111-1111-4111-8111-111111111111';
```

**Debe salir:** con los dos interruptores en `true`, un 204 y una fila nueva en `eventos_app`; en la app, las visitas aparecen en **Uso de la app** del panel.

**Si falla:** si el navegador no logra enviar eventos, mira la consola: un error de CORS indica que falta `APP_URL` o no coincide con tu dominio. Si la portada no genera eventos, comprueba que reconstruiste y desplegaste el sitio con `medicionAnonima` en `true`.

---

## Paso 15 · Revisión legal con un profesional (bloquea vender)

**Qué es:** que un abogado de tu país revise lo que prometes y cómo tratas los datos. La plantilla no es asesoramiento jurídico.

**Qué hacer:**

1. Lleva a tu abogado `src/content/legal.ts` y [LEGAL.md](LEGAL.md).
2. Resuelve con él cada `[VERIFICAR: …]` de `src/content/legal.ts`: modalidad de la venta, renovación, plazos de reembolso y su relación con el desistimiento legal.
3. Define cómo atenderás una petición de borrado de cuenta y de datos. El botón «Eliminar mi cuenta» de `/cuenta` llama a la función de base `borrar_mi_cuenta()` (migración `20261025110000`), que borra la cuenta con la sesión de la persona **sin usar Stripe ni Hotmart**. Antes, el comprador cancela su suscripción en Hotmart: la app no puede hacerlo. Si no la has desplegado, el borrado se atiende a mano: borrar el usuario en Authentication → Users elimina en cascada sus filas de `profiles`, `daily_sessions` y `subscriptions`, pero `accesos` y `compras` se identifican por correo y hay que borrarlas a mano. `[VERIFICAR: con tu abogado el procedimiento y los plazos de conservación de los datos de compra]`
4. Comprueba que la política de privacidad y la de cookies describen los servicios que usas: Hotmart, Supabase, el servicio de correo, tu hosting y, si la enciendes, la medición.

**Debe salir:** los textos revisados y sin `[VERIFICAR]` pendientes.

**Si falla:** no publiques textos legales con marcadores sin resolver.

---

## Paso 16 · Gate y pruebas (bloquea publicar)

**Qué es:** las comprobaciones automáticas antes de publicar. El gate separa los **errores reales** (bloquean y salen con código 1) de los **pendientes** (te dicen qué falta y no bloquean).

**Qué hacer:** ejecuta en este orden, desde la carpeta de tu copia:

```bash
npm ci
npm run check
npx vitest run supabase
deno check supabase/functions/hotmart-aviso/index.ts
deno check supabase/functions/eventos/index.ts
npm run e2e
npm run e2e:nube
npm run barrido
npm run verificar
```

| Comando                   | Qué comprueba                                                                                                                      |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                  | Instala las dependencias exactas de `package-lock.json`.                                                                           |
| `npm run check`           | Formato, tipos, lint, pruebas unitarias y de servidor, y la compilación.                                                           |
| `npx vitest run supabase` | Solo las pruebas del servidor: funciones, migraciones y reglas por fila con PostgreSQL real en memoria (PGlite).                   |
| `deno check …`            | Que las funciones compilan como código de Deno. Necesita Deno instalado.                                                           |
| `npm run e2e`             | Recorrido en el navegador en modo demostración, sin Supabase. La primera vez: `npx playwright install chromium`.                   |
| `npm run e2e:nube`        | Recorrido en el navegador con la nube simulada: todas las peticiones a Supabase se interceptan y ninguna llega a un servicio real. |
| `npm run barrido`         | Busca claves, tokens y datos personales en los archivos que se publican (`scripts/barrido-secretos.mjs`).                          |
| `npm run verificar`       | El gate: marcadores, conexiones, variables, frontera cliente y servidor, migraciones y secretos.                                   |

**Debe salir:** todo en verde y, en `npm run verificar`, «errores reales» en cero. Para vender, además, los pendientes deben quedar en cero o explicados.

**Si falla:** lee el primer error completo y corrige la causa. No borres ni saltes pruebas, no debilites el gate y no cambies un interruptor a `true` para que pase.

---

## Paso 17 · Publicar y abrir la venta (bloquea vender)

**Qué es:** el último paso. Abrir el sitio al público y empezar a vender.

**Qué hacer:**

1. Comprueba que están hechos los pasos 1 a 16, con su «Debe salir».
2. Pon `supabase: true` y `pagos: true` en el bloque `conexiones` de `src/config/plantilla.ts` solo si la prueba del paso 13 salió bien. Nunca los cambies para que el gate pase.
3. Ejecuta de nuevo `npm run check` y `npm run verificar`.
4. Sube el cambio a la rama que despliega tu hosting y confirma que el despliegue termina en estado listo. El flujo de integración de `.github/workflows/ci.yml` ejecuta `npm run check` y `npm run e2e` en cada cambio de la rama principal.
5. Abre la oferta a la venta en Hotmart. `[VERIFICAR: cómo se activa la oferta en tu cuenta]`
6. Desde tu teléfono real, recorre `https://tu-dominio.com`: portada, precios, compra, `/entrar`, `/hoy` y `/admin`.
7. Haz tú una compra real con tu propia tarjeta y pide el reembolso dentro de la garantía, o vigila de cerca las primeras ventas en el panel (**Hoy** → «Requiere atención»).

**Debe salir:** el sitio abierto, la primera compra registrada y con acceso, y el panel sin avisos por revisar.

**Si falla:** si algo falla con una compra real, para las ventas (pausa la oferta en Hotmart) antes de investigar.

---

## Paso 18 · Después de vender

**Qué hacer cada semana:**

1. Entra al panel (`/admin`) con tu segundo factor.
2. En **Hoy**, mira «Requiere atención»: avisos de Hotmart que la función no pudo aplicar. Cada uno es una persona que pudo pagar y no tener acceso.
3. En **Ventas**, revisa compras, reembolsos y el estado de los avisos.
4. Comprueba en Hotmart que la notificación sigue activa.
5. Revisa en Supabase el uso y los límites de tu plan. `[VERIFICAR: límites y copias de seguridad de tu plan de Supabase]`

**Cómo cambiar una clave si se filtra:**

1. Revoca la clave en el servicio donde se creó y crea otra. `[VERIFICAR: nombre exacto del botón en cada servicio]`
2. Para el token de Hotmart: genera uno nuevo en Hotmart y ejecuta `supabase secrets set HOTMART_HOTTOK=<token-nuevo>`. Para la clave del correo: cámbiala en Supabase (paso 5).
3. Haz un envío de prueba del webhook (paso 10).
4. Anota la fecha y qué cambiaste, fuera del repositorio.

---

## Cómo se decide el acceso

El acceso de un correo se recalcula desde sus compras cada vez que llega un aviso que las toca. No depende del orden en que lleguen los avisos.

| Situación                                                         | Acceso                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Estado de Hotmart                                                 | Acceso                                                                                                  |
| ----------------------------------------------------------------  | ------------------------------------------------------------------------------------------------------- |
| APPROVED o COMPLETE                                               | `activo`.                                                                                               |
| OVERDUE, DELAYED, PURCHASE_PROTEST o PARTIALLY_REFUNDED           | Se **mantiene** mientras Hotmart reintenta el cobro. Cuando se regulariza, sigue `activo`.              |
| REFUNDED o CHARGEBACK                                             | `inactivo`, de forma definitiva.                                                                        |
| CANCELLED sin pago previo, EXPIRED o NO_FUNDS                     | `inactivo`. `[VERIFICAR: NO_FUNDS con reintento pendiente]`                                             |
| Pedir el reembolso (solicitud, sin REFUNDED)                      | No quita el acceso. Si la solicitud se cancela y vuelve APPROVED, el acceso vuelve.                     |
| Cancelación voluntaria de la suscripción                          | `activo` hasta `data.date_next_charge`. Después, `inactivo`. `[VERIFICAR: motivo que envía Hotmart]`    |
| Cancelación por impago (último cobro OVERDUE, DELAYED o NO_FUNDS) | `inactivo` desde el aviso. La cuenta y los datos se conservan.                                          |
| Cobro aprobado posterior a una cancelación                        | Reactiva la suscripción y restaura el acceso.                                                           |
| Aviso repetido o más antiguo que lo guardado                      | No cambia nada.                                                                                         |

Un aviso que no se pudo guardar responde 500 y Hotmart lo reintenta: nunca se responde 200 sin haber guardado.

## Estados de los avisos

Cada aviso queda registrado en `eventos_pago` con su resultado. El panel marca con «requiere atención» los siete que van con asterisco.

| Estado                     | Qué significa                                                                                                          | Qué hacer                                                                                                                    |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `aplicado`                 | Cambió una compra, una suscripción o un acceso.                                                                        | Nada: es lo esperado.                                                                                                        |
| `duplicado`                | Compra aprobada que ya existía.                                                                                        | Nada.                                                                                                                        |
| `obsoleto`                 | Reembolso o cancelación más antiguos que lo guardado.                                                                  | Nada. El acceso se recalcula igualmente.                                                                                     |
| `registrado`               | Tipo conocido sin efecto (por ejemplo, compra retrasada).                                                              | Nada.                                                                                                                        |
| `no-procesado` \*          | Evento que la plantilla no conoce.                                                                                     | Compara el nombre con tu pantalla de Hotmart (paso 9). Decide a mano si afecta al acceso.                                    |
| `rechazado` \*             | Compra con datos incompletos (sin transacción, oferta o importe).                                                      | Compara la forma del aviso con el paso 10.                                                                                   |
| `sin-plan` \*              | La oferta no está en `OFERTAS_HOTMART`.                                                                                | Corrige el código (paso 7) y vuelve a desplegar. Reenvía el aviso desde Hotmart si puedes.                                   |
| `divisa-no-usd` \*         | El precio no viene en dólares.                                                                                         | La plantilla solo registra compras en USD.                                                                                   |
| `sin-compra`               | Reembolso o cancelación de una compra que todavía no está en `compras`. Se guarda y se aplica cuando llegue la compra. | Nada si la compra llega después. Si nunca llega, mira si esa compra es anterior a configurar el aviso. El panel no la marca. |
| `sin-suscripcion`          | Cancelación sin código de suscriptor.                                                                                  | Revisa el campo del suscriptor (paso 10). El panel no la marca.                                                              |
| `sin-correo` \*            | Compra aprobada sin correo válido: no crea compra ni acceso.                                                           | Revisa `data.buyer.email` (paso 10). Esa persona pagó y no puede entrar.                                                     |
| `sin-fecha` \*             | Aviso sin `creation_date` válida: responde 400 y no cambia nada.                                                       | Revisa el paso 10.                                                                                                           |
| `formato-no-reconocido` \* | Al aviso le falta el tipo de evento.                                                                                   | Compara con la pantalla de Hotmart.                                                                                          |

## Pendiente de verdad (sesión y servidor)

Lo que sigue sin comprobar y lo que queda por hacer antes de vender. Nada de la sesión por cookie se ha probado contra Supabase real ni en Vercel: las pruebas usan un Supabase falso con `Request` y `Response` (`servidor/falso-supabase.ts`).

- **Rutas `/api` frente al rewrite.** `vercel.json` reescribe `/(.*)` a `index.html`. Vercel aplica por defecto las funciones antes que los rewrites, así que `/api/*` debería responder JSON. `[VERIFICAR: en un despliegue de prueba, GET /api/sesion debe devolver JSON y no HTML]`
- **Desarrollo local.** `npm run dev` (Vite) no sirve `/api`. Para probar la compra o el panel en tu equipo hace falta `vercel dev`. `[VERIFICAR: comando y puerto en tu versión de Vercel CLI]`
- **Cookie `Secure`.** Solo viaja con https. `[VERIFICAR: en tu dominio real, la cookie foco_sesion y foco_admin llevan Secure]`
- **Formas de respuesta de MFA.** El alta, el reto y la verificación del segundo factor, y el listado de factores (en `GET /auth/v1/user`), se han escrito según la documentación de GoTrue. `[VERIFICAR: con una cuenta de administración de prueba, de punta a punta]`
- **RLS del panel.** Las consultas van por `/api/admin/datos` con el token de la persona. `[VERIFICAR: con dos cuentas, que una no administradora no lee nada y una administradora sin segundo factor no lee nada]`
- **Pruebas de extremo a extremo con cuenta.** `e2e/admin.spec.ts` (bloque `@nube`) siembra la sesión en localStorage y no se ha ejecutado: hay que reescribirlo para la cookie antes de usarlo.
- **Modo de cobro Stripe** (no conectado): `src/services/billing.ts` sigue con el cliente de supabase-js. No funciona con la sesión por cookie.
- **Premium.** Un acceso vigente da premium, pero qué desbloquea el plan lo decides tú. `[VERIFICAR: lista de funciones premium del plan de Hotmart]`
- **Retención.** Los plazos de `retencion_config` son de partida. `[VERIFICAR: plazos con tu asesor]` y `[VERIFICAR: que pg_cron está habilitada en tu proyecto, o purgar a mano]`.
- **Migraciones sin aplicar:** `20261025100000`, `20261025110000` y `20261025120000`, en ese orden, a mano en el editor SQL.
- **Datos que faltan:** `soporteEmail` en `src/config/plantilla.ts` `[COMPLETAR]`.

## Lo que esta plantilla no hace

- **No oculta el código de la app.** La decisión de acceso la toma la base de datos (la persona solo lee su fila de `accesos`), pero la pantalla que bloquea corre en el navegador y la app entera viaja en archivos públicos. Es una guarda de acceso, no una protección del contenido.
- **No tiene un enlace de compra por plan.** `VITE_ENLACE_COMPRA` es uno para los dos planes (paso 7).
- **No controla la prueba ni la garantía.** Las anuncia; las gestiona Hotmart.
- **No procesa contracargos ni expiraciones** (tabla «Cómo se decide el acceso»).
- **Envía sus correos con Resend.** El enlace de entrada lo envía Supabase por SMTP; los avisos de compra, cobro atrasado, reembolso y cancelación los envía `hotmart-aviso` (`supabase/functions/_shared/correos.ts`). Ver la sección de correos de la guía.
- **Borra cuentas desde la app** con la función de base `borrar_mi_cuenta()`, solo si ejecutaste su migración (paso 3). No usa Stripe, no usa la clave de servicio y no cancela la suscripción de Hotmart.
- **No deja entrar sin conexión.** Para entrar, la app comprueba el acceso con internet; una vez dentro, la sesión diaria sigue funcionando aunque se pierda la señal.
- **No ofrece cambios en el panel.** Es de solo lectura ([PANEL-ADMIN.md](PANEL-ADMIN.md)).
