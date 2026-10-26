# Foco Mente · instrucciones para la IA de tu copia

Esta es una plantilla web (Vite + React) para entrenar la atención en cinco minutos al día: juegos breves, progreso y lecciones. La persona que la compra la personaliza con su marca, conecta sus servicios y la vende.

## Qué hace hoy y qué no

- **En esta copia no hay ningún servicio conectado.** Sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` todo funciona en modo local con datos del navegador: sin acceso, sin cobros y sin correo. Progreso, ajustes y onboarding se guardan en `localStorage` (clave `foco5`, interna: no la cambies sin migrar los datos). El bloque `conexiones` de `src/config/plantilla.ts` está en `false`.
- **Cobro: Hotmart.** La compra, el cobro, la prueba de 7 días, la Garantía de 7 días (`garantiaDias`) y el reembolso los gestiona Hotmart; la app los anuncia pero no los controla. El aviso de compra llega a la función `supabase/functions/hotmart-aviso`:
  - El token `HOTMART_HOTTOK` es un secreto de Supabase. Llega solo en la cabecera `x-hotmart-hottok` (sin ella, 401) y se compara en tiempo constante.
  - La fecha `creation_date` y el `id` son obligatorios: sin ellos responde 400 (sin `id` no guarda nada). Un estado solo cambia si el aviso es más reciente que lo guardado, y la comparación es una sola sentencia de base.
  - Las reglas de acceso (estados, cancelación voluntaria o por impago, reembolso, reactivación) están en `docs/GUIA-ALUMNO.md`, sección «Reglas de acceso». Pedir un reembolso no quita el acceso; lo quitan REFUNDED o CHARGEBACK.
  - Un reembolso o una cancelación de una compra no quita el acceso si otra compra del mismo correo sigue activa.
  - Los códigos de oferta están en `OFERTAS_HOTMART` (`supabase/functions/_shared/hotmart.ts`) como marcadores `[COMPLETAR: …]`. Sin ellos, los avisos quedan como `sin-plan`.
  - Los nombres de cabecera, campo y evento no están confirmados contra la documentación oficial: están marcados `[VERIFICAR: …]`. Se confirman con el envío de prueba (`docs/INFRAESTRUCTURA.md`, paso 10).
- **Stripe: opción avanzada, sin conectar.** Las funciones `stripe-webhook`, `create-checkout-session`, `create-portal-session`, `cancel-subscription`, `withdraw-subscription` siguen en el repositorio, pero **no se usan con Hotmart**: no las despliegues, no las conectes y no las describas como activas. La eliminación de cuenta no usa Stripe: el botón «Eliminar mi cuenta» de `/cuenta` pide escribir ELIMINAR y llama a la función de base `borrar_mi_cuenta()` (migración `20261025110000`). El comprador cancela su suscripción en Hotmart. Ver `docs/CONECTAR.md`.
- **Acceso.** `/entrar` pide el correo de la compra y envía el enlace de Supabase (`shouldCreateUser: false`, redirección a `/entrar/confirmar`). `/entrar/confirmar` espera la sesión: con acceso va a `/hoy`; sin acceso, a `/sin-compra`. La app exige sesión **y** una fila de la vista `accesos_vigentes` (activo y no vencido; RLS por el correo de la sesión). `/login` redirige a `/entrar`. «Cerrar sesión» está en `/cuenta`.
- **Panel `/admin`.** Es de **solo lectura**. Secciones: Hoy, Ventas, Uso de la app y Seguridad. Exige estar en la tabla `administradores` y haber entrado con segundo factor (`aal2`, TOTP en `/admin/seguridad`). No usa la clave de servicio. No hay correos, costos, auditoría ni ajustes. Ver `docs/PANEL-ADMIN.md`.
- **Medición anónima: apagada.** Hay dos interruptores que deben coincidir: `medicionAnonima` en `src/config/plantilla.ts` y `medicionAnonima` en `supabase/functions/_shared/eventos.ts`. Lista cerrada de 13 eventos, sin nombres, correos ni texto libre.
- La portada, la FAQ y los textos legales no pueden prometer cobros, cuentas, avisos ni garantías que la app no haga.
- `npm run verificar` separa los **errores reales** (bloquean, salida con código 1) de los **pendientes** (te dicen qué falta y no bloquean).

## Reglas

1. Sigue `docs/INFRAESTRUCTURA.md` (pasos 1 a 18) con la persona presente, un paso a la vez y en su orden. `docs/CONECTAR.md` describe el código de cada servicio. Pide confirmación antes de cada paso que cree cuentas, cobre, envíe correos o despliegue.
2. Nunca prometas en pantalla lo que la app no hace. Si añades publicidad, analítica o un servicio que reciba datos (el píxel de Meta, por ejemplo), quita las frases «Sin cookies de terceros» y «sin rastreo» donde aparezcan y actualiza `src/content/legal.ts`. Encender la medición anónima también obliga a revisar la política de privacidad y la de cookies.
3. Claves: nunca en el código, en git ni en `.env.example`, que solo lleva nombres de variables. No leas ni escribas `.env.local`; lo crea la persona. Las claves secretas (`HOTMART_HOTTOK`, la clave de servicio de Supabase, Stripe, Resend, Anthropic) **no llevan prefijo `VITE_` y nunca llegan al cliente**: `src/` no las nombra. Solo la clave anon de Supabase puede estar en el navegador.
4. La clave de servicio de Supabase la usa solo `supabase/functions/hotmart-aviso` (a través de `_shared/rest.ts`), después de comprobar el token. El panel, la medición y el borrado de cuenta (función de base `borrar_mi_cuenta`, sin clave) no la usan, y `supabase/tests/contrato.test.ts` lo comprueba para la medición. Las funciones de Stripe, sin conectar, todavía la nombran: no las despliegues ni las conectes. Una función nueva que la necesite se añade de forma explícita y se explica en `docs/PANEL-ADMIN.md`. Nunca amplíes esa lista para que el gate pase.
5. **No cambies migraciones ya aplicadas ni reglas RLS sin confirmación explícita.** Un cambio nuevo va en una migración nueva con fecha posterior en `supabase/migrations/`, y toda tabla nueva lleva RLS activo. Una tabla que lee la administradora lleva política `to authenticated` con `es_administrador()`. Ninguna política va a `anon`; la única escritura anónima permitida es la función validada `registrar_evento_app`. Las migraciones las ejecuta la persona a mano en el editor SQL de Supabase; la app nunca las aplica. Orden: `20261016120000_init.sql`, `20261024100000_panel_admin.sql`, `20261024100001_limite_eventos.sql`, `20261024110000_compras_hotmart.sql`, `20261024120000_accesos.sql`, `20261024130000_compras_finales_previas.sql`, `20261025100000_acceso_regla_hotmart.sql`, `20261025110000_borrar_mi_cuenta.sql` y `20261025120000_retencion_datos.sql`.
6. Los cambios de producto van en `src/config/plantilla.ts` (nombre, eslogan, promesas, correo de contacto e interruptores), no en textos sueltos. Los precios van en `src/domain/pricing.ts`.
7. Pon un interruptor de `conexiones` en `true` solo cuando su implementación esté escrita, probada y configurada, y la prueba de compra con acceso (`docs/INFRAESTRUCTURA.md`, paso 13) haya salido bien. Nunca lo cambies para que el gate pase.
8. **Medición: dos interruptores.** `medicionAnonima` en `src/config/plantilla.ts` y en `supabase/functions/_shared/eventos.ts` deben valer lo mismo (`contrato.test.ts` lo comprueba). Salen apagados. Si añades un evento o un valor, cámbialo en los tres sitios: `src/config/medicion.ts`, `supabase/functions/_shared/eventos.ts` y la función `registrar_evento_app` de la migración de límites. Encenderla exige revisar la política de privacidad.
9. **El panel es solo lectura.** No añadas escrituras, correos, costos, auditoría ni ajustes sin confirmación explícita. El panel lee con la sesión de la administradora y la base decide con `es_administrador()`; nunca con la clave de servicio.
10. `[COMPLETAR: …]` y `[VERIFICAR: …]` son datos de la persona o datos por confirmar en la documentación oficial. No los inventes ni los rellenes con datos de otro producto.
11. Antes de decir que algo está listo, corre los comandos de verificación (abajo). El gate debe pasar antes de publicar: no lo saltes ni lo debilites. Revisa las pantallas a 390 px.
12. Los textos de `src/content/legal.ts` son borradores. No cites leyes, autoridades ni cifras nuevas, y recuerda que la persona debe revisarlos con un abogado de su país.
13. La app es para adultos que quieren entrenar su atención. Nunca diagnostiques, no des consejo médico y no uses la culpa para retener o cobrar. Si una persona menciona un problema de salud, recomienda consultar a un profesional.
14. **Paso siguiente.** Antes de responder sobre publicar, vender, conectar un servicio o cambiar configuración, lee `docs/INFRAESTRUCTURA.md`. Al terminar un paso, di cuál es el siguiente y por qué importa, y no lo saltes. No des un paso por terminado sin su «Debe salir»: si no puedes comprobarlo, pide a la persona el resultado. Si pide saltar un paso marcado «bloquea publicar» o «bloquea vender», explícalo en una frase y no lo hagas.
15. Nunca escribas claves reales, correos reales ni tokens en un archivo, ni se los pidas a la persona en el chat. Si aparece uno, pide que lo retire y lo cambie en el servicio donde lo creó. Los ejemplos usan `correo@example.com`, `tu-dominio.com` y `<tu-proyecto>`.

## Dónde se personaliza

- Marca, correo de contacto y de soporte (`soporteEmail`, para el aviso de «Eliminar tu cuenta»), e interruptores: `src/config/plantilla.ts`.
- Textos de la app: `src/content/copy.ts`. Lecciones: `src/content/lessons.ts`. Referencias: `src/content/science.ts`, solo con fuentes comprobadas.
- Textos legales y datos del titular: `src/content/legal.ts`.
- Precios y prueba: `src/domain/pricing.ts`.
- Códigos de oferta de Hotmart: `supabase/functions/_shared/hotmart.ts`.
- Colores y tipografías: `src/index.css`.

Escribe en español neutro, con tuteo y sin voseo.

## Recomendaciones técnicas y de calidad

**Stack actual** (según `package.json`; antes de instalar algo nuevo, verifica la versión con `npm view`):

- Vite 8 con `@vitejs/plugin-react` y `vite-plugin-pwa`.
- React 19.3 y TypeScript 6.0 (`~6.0.3`). No subas a una versión mayor sin comprobar `npm run lint`.
- Tailwind CSS 4.3 con `@tailwindcss/vite`. Los tokens de color están en `src/index.css`.
- Zustand 5 para el estado, Zod 4 para validar lo que llega del almacenamiento y de la base, Motion 13 para animaciones. Supabase se usa con `@supabase/supabase-js`.
- Vitest 5 para pruebas unitarias (`src/**/*.test.ts` y `supabase/**/*.test.ts`). `@electric-sql/pglite` (versión exacta, solo desarrollo) da PostgreSQL en memoria para probar las migraciones y las reglas por fila. Playwright 1.64 para e2e (`e2e/`).
- Node 24 (`.nvmrc`). Mínimo `>=22` (`engines`).

**Comandos de verificación, en este orden:**

1. `npm ci` (instala desde `package-lock.json`).
2. `npm run typecheck`
3. `npm run lint`
4. `npm run format:check`
5. `npm test` (incluye las pruebas del servidor de `supabase/tests`).
6. `npm run build` (ya incluye `tsc`).
7. `deno check supabase/functions/hotmart-aviso/index.ts` y `deno check supabase/functions/eventos/index.ts`.
8. `npm run e2e` (modo demostración; la primera vez: `npx playwright install chromium`).
9. `npm run e2e:nube` (con la nube simulada; no llama a servicios reales).
10. `npm run barrido`: busca claves, tokens y datos personales en lo que se publica.
11. `npm run verificar`: gate de publicación. Sale con código 1 solo por errores reales; los pendientes se listan y no bloquean.

**Conectar servicios:** sigue `docs/INFRAESTRUCTURA.md` en su orden y de uno en uno. Verifica cada paso antes del siguiente. Pon un interruptor de `conexiones` en `true` solo cuando esté implementado, probado y configurado.

**Seguridad:**

- Ninguna clave en el cliente, en git ni en `.env.example`. Los secretos del servidor se definen en Supabase (`supabase secrets set`).
- `.env.local` lo escribe la persona. No lo leas ni lo modifiques.
- RLS activo en toda tabla expuesta, y ningún permiso para el rol `anon`, salvo la función validada `registrar_evento_app`.
- Webhook de Hotmart: comprueba el token de la cabecera `X-HOTMART-HOTTOK` antes de guardar nada (401 sin token o incorrecto), compáralo en tiempo constante, sé idempotente (un aviso repetido no hace nada dos veces), responde 400 sin `creation_date` o sin `id`, 503 si falta configuración y 5xx si falla el guardado, para que Hotmart reintente. Nunca respondas 200 sin haber guardado. Si usas Stripe (opción avanzada), verifica la firma del evento antes de procesar nada.
- Acceso: la base decide con la fila de `accesos` leída con la sesión de la persona (RLS), pero la guarda de pantalla corre en el navegador y el código de la app es público. No lo presentes como protección del contenido.
- **Sesión del comprador (servidor).** Los tokens de Supabase no llegan al navegador: `/api/sesion` los fija en la cookie httpOnly `foco_sesion` (SameSite=Lax; Secure en https) y los lee en cada petición. `/api/sincronizacion` y `/api/cuenta` van con ese mismo token. El navegador solo llama a `/api/…` y nunca guarda tokens de comprador. El panel de administración usa la misma cookie httpOnly (`foco_admin`, `/api/admin/sesion`, `/api/admin/mfa`, `/api/admin/datos`): sin supabase-js ni localStorage para la sesión. Nada de esto está probado contra Supabase real ni en Vercel (ver docs/INFRAESTRUCTURA.md, «Pendiente de verdad»). Las rutas de `/api` solo funcionan desplegadas (Vercel) con `SUPABASE_URL` y `SUPABASE_ANON_KEY` del servidor, no `VITE_`.

**Migraciones:** no cambies una migración ya aplicada. Los cambios van en una migración nueva dentro de `supabase/migrations/`, con fecha posterior. Cada tabla nueva lleva RLS activo.

**UX y UI:** respeta la identidad visual de `src/index.css`. El texto de cuerpo mide al menos 16 px; el botón principal mide al menos 44 px de alto (`min-h-11`); el foco visible es claro; respeta el movimiento reducido (`prefers-reduced-motion`). Revisa cada pantalla a 390 px.

**Datos y legal:** no inventes datos del titular, precios, garantías ni cifras. Los marcadores `[COMPLETAR: …]` y `[VERIFICAR: …]` los resuelve la persona o se confirman en la documentación oficial. Las referencias científicas solo se añaden si se comprueban en Crossref o en la fuente primaria. Ningún archivo publicado lleva claves, tokens ni correos reales: los ejemplos usan dominios reservados.

**Si algo falla:** lee el error completo, identifica la prueba que falla y corrige la causa. No borres ni saltes pruebas para que pasen, no apagues reglas de lint sin justificarlo y no cambies un interruptor a `true` para que el gate pase. Dile a la persona qué falló, cuál es la causa probable y cuál es el paso siguiente, en lenguaje sencillo.
