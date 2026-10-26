# Foco Mente · plantilla

Entrena tu atención en cinco minutos al día con juegos breves: sin culpa, sin trampas, sin prisa.

> Es una herramienta de entrenamiento de la atención y de bienestar. **No es un tratamiento ni da consejo médico**: no diagnostica ni trata ninguna enfermedad y **no sustituye la consulta médica**. Lo que está demostrado y lo que no, en la pestaña _Ciencia_ de la app.

Aplicación web (PWA) en español, instalable y con uso sin conexión para la sesión diaria. Vite 8 · React 19 · TypeScript · Tailwind 4 · Motion · Zustand · Zod · Vitest · Playwright.

## Estado de los servicios

**En esta copia no hay ningún servicio conectado.** Sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`, la app funciona en modo local: sin acceso, sin cobros y sin correo. El progreso se guarda en el navegador de cada dispositivo. El bloque `conexiones` de `src/config/plantilla.ts` está todo en `false`.

La plantilla ya incluye las piezas para venderla con **Hotmart**. Se activan cuando tú las configuras:

- **Acceso con compra.** La persona escribe en `/entrar` el correo de su compra y recibe un enlace de Supabase, sin contraseñas. La app exige sesión **y** una compra activa; sin compra, lleva a `/sin-compra`.
- **Aviso de compra.** Una función de Supabase (`supabase/functions/hotmart-aviso`) recibe los avisos de Hotmart, guarda compras y reembolsos, crea la cuenta de quien compra y calcula su acceso.
- **Base de datos.** Migraciones en `supabase/migrations/`, con reglas por fila (RLS) en cada tabla. Las ejecutas tú a mano.
- **Panel `/admin`.** Solo lectura: ventas, avisos de Hotmart y uso. Exige estar en la lista de administradoras y entrar con segundo factor.
- **Medición anónima.** Apagada. Se enciende con dos interruptores.

La compra, la prueba de 7 días, el cobro y el reembolso con Garantía de 7 días los gestiona Hotmart: la app los anuncia pero no los controla. Las funciones de Stripe que siguen en `supabase/functions/` son una opción avanzada que **no se usa con Hotmart y no está conectada**.

El paso a paso para conectarlo todo está en [docs/INFRAESTRUCTURA.md](docs/INFRAESTRUCTURA.md). Si prefieres una versión en lenguaje llano, lee [docs/GUIA-ALUMNO.md](docs/GUIA-ALUMNO.md).

## Cliente ideal y momento «ajá»

- **Cliente ideal:** alguien que trabaja o estudia con el móvil al alcance, se distrae sin darse cuenta y quiere volver al foco sin culpa ni rutinas largas.
- **Momento «ajá»:** al terminar su primera sesión de cinco minutos y ver en _Hoy_ cómo ha ido, con sus propios resultados.

## Pantallas

- **Públicas:** `/` (portada), `/precios`, `/ciencia`, `/pacto` y `/legal/:slug`.
- **Acceso de compradores:** `/entrar` (correo de la compra), `/entrar/confirmar` (destino del enlace del correo) y `/sin-compra` (correo sin compra activa). `/login` redirige a `/entrar`.
- **Embudo:** portada `/` → `/onboarding` (objetivo, ajustes, test base y tu plan) → `/paywall` (planes, prueba y compra en Hotmart). `/empezar` redirige a `/onboarding`.
- **Aplicación** (con Supabase conectado exige sesión y compra activa): `/hoy`, `/sesion`, `/resultado`, `/progreso`, `/biblioteca`, `/practica/:gameId`, `/retos`, `/enfoque`, `/lecciones`, `/lecciones/:id`, `/ajustes`, `/cuenta` y `/checkout`.
- **Administración:** `/admin/entrar`, `/admin/confirmar` y `/admin` con sus secciones Hoy, Ventas (`/admin/ventas`), Uso de la app (`/admin/uso`) y Seguridad (`/admin/seguridad`). Ver [docs/PANEL-ADMIN.md](docs/PANEL-ADMIN.md).

Las rutas están en `src/App.tsx`.

## Comandos

```bash
npm ci              # instala desde package-lock.json (Node 24, ver .nvmrc)
npm run dev         # desarrollo en http://localhost:5173
npm run build       # comprobación de tipos y build de producción con PWA
npm run typecheck   # solo los tipos
npm run lint        # ESLint
npm run format      # Prettier, escribe los cambios (format:check solo comprueba)
npm test            # pruebas unitarias y de componentes (Vitest), incluidas las del servidor
npm run e2e         # recorrido en el navegador en modo demostración, móvil y escritorio (Playwright)
npm run e2e:nube    # recorrido en el navegador con la nube simulada
npm run check       # formato, tipos, lint, pruebas y build
npm run barrido     # busca claves, tokens y datos personales en lo que se publica
npm run verificar   # gate antes de publicar: marcadores, servicios, variables y secretos
```

Las pruebas de las funciones de Supabase (con PostgreSQL en memoria para las reglas por fila) se pueden ejecutar solas con `npx vitest run supabase`. Las funciones se comprueban como código de Deno con `deno check supabase/functions/hotmart-aviso/index.ts` y `deno check supabase/functions/eventos/index.ts`.

La primera vez, las pruebas e2e necesitan Chromium: `npx playwright install chromium`, o usa un Chrome que ya tengas con `PLAYWRIGHT_CHROMIUM_PATH=/ruta/al/chrome npm run e2e`.

## Qué personalizar

| Qué                                                                                     | Dónde                                                                          |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Nombre, eslogan, promesas, minutos de sesión, correo de contacto y servicios conectados | `src/config/plantilla.ts`                                                      |
| Textos de la app: portada, promesas y preguntas frecuentes                              | `src/content/copy.ts`                                                          |
| Lecciones                                                                               | `src/content/lessons.ts`                                                       |
| Referencias científicas (solo fuentes comprobadas)                                      | `src/content/science.ts`                                                       |
| Textos legales y datos del titular (modelos en borrador)                                | `src/content/legal.ts`                                                         |
| Precios en dólares y prueba de 7 días (`TRIAL_DAYS`)                                    | `src/domain/pricing.ts`                                                        |
| Códigos de oferta de Hotmart                                                            | `supabase/functions/_shared/hotmart.ts` (`OFERTAS_HOTMART`)                    |
| Dirección de Supabase, dominio, enlace de compra y correo de soporte                    | Variables `VITE_` en `.env.local` y en tu hosting (ver `.env.example`)         |
| Token de Hotmart                                                                        | Secreto `HOTMART_HOTTOK` en Supabase, nunca en el código                       |
| Medición anónima (apagada)                                                              | Dos interruptores `medicionAnonima` (ver [docs/CONECTAR.md](docs/CONECTAR.md)) |
| Nombre en el título, las etiquetas para compartir y el manifiesto                       | `index.html` y `vite.config.ts`                                                |
| Juegos (registro en `registry.ts`, con pruebas)                                         | `src/domain/games/`                                                            |
| Colores y tipografías                                                                   | `src/index.css`                                                                |
| Icono e imagen para compartir                                                           | `scripts/generate-icons.py` (regenera `public/`)                               |

## Datos de ejemplo que debes cambiar

- **Correo de contacto:** `correo@example.com` es solo un ejemplo. Cámbialo en `src/config/plantilla.ts` y en `VITE_SUPPORT_EMAIL` (`.env.local`) para que sea el mismo. El gate no lo bloquea.
- **Precios en dólares:** US$5,99 al mes y US$59,90 al año, en `src/domain/pricing.ts`. Precios sugeridos: confirma tu oferta en Hotmart antes de vender.
- **Prueba de 7 días:** `TRIAL_DAYS = 7` en `src/domain/pricing.ts`. La portada, los precios y las preguntas frecuentes la anuncian. La prueba la configuras en tu producto de Hotmart; la app no la controla.
- **Garantía de 7 días:** `garantiaDias: 7` en `src/config/plantilla.ts`. Cada mención dice «Garantía de 7 días». Confírmala en tu producto de Hotmart antes de vender.
- **Responsable:** los datos del titular en `src/content/legal.ts` son marcadores `[COMPLETAR: …]` (titular, identificador fiscal, domicilio, ley aplicable, proveedor del correo de entrada y región de alojamiento). Complétalos con tus datos y revísalos con un abogado de tu país.
- **Códigos de oferta de Hotmart:** `OFERTAS_HOTMART` en `supabase/functions/_shared/hotmart.ts` trae marcadores. Sin tus códigos, ninguna compra se reconoce.
- **Eslogan y promesas:** en `src/config/plantilla.ts`.

## Conectar tus servicios

Mientras no conectes nada, la app funciona en modo local. Para activar el acceso, los cobros y el panel, sigue [docs/INFRAESTRUCTURA.md](docs/INFRAESTRUCTURA.md), un paso cada vez y en su orden. Cada paso dice si bloquea publicar o vender.

1. Copia `.env.example` a `.env.local` y completa solo las variables de los servicios que conectes. `.env.local` no se sube a git.
2. Las claves secretas (el token de Hotmart, la clave de servicio de Supabase) nunca van en el navegador ni en variables `VITE_`: el token se define en los secretos de Supabase y la clave de servicio la inyecta Supabase en las funciones.
3. Pon un interruptor de `conexiones` en `true` solo cuando su servicio esté probado. Luego ejecuta `npm run verificar`.

## Licencia

Uso comercial según [LICENSE](LICENSE). Puedes adaptar y vender tu propia app; no puedes revender ni publicar la plantilla como tal.

## Límites

Sin acceso conectado, el progreso queda en el navegador: borrar los datos del navegador lo borra. Los cobros solo funcionan cuando conectas Hotmart y su aviso. La decisión de acceso la toma la base de datos, pero la guarda de pantalla corre en el navegador y el código de la app es público: no es una protección del contenido. Más límites en [docs/INFRAESTRUCTURA.md](docs/INFRAESTRUCTURA.md), «Lo que esta plantilla no hace».

## Documentación

- [docs/INFRAESTRUCTURA.md](docs/INFRAESTRUCTURA.md): la guía de pasos, con las variables, las marcas «bloquea publicar» y «bloquea vender» y la prueba de compra.
- [docs/GUIA-ALUMNO.md](docs/GUIA-ALUMNO.md): la misma secuencia en lenguaje llano.
- [docs/PANEL-ADMIN.md](docs/PANEL-ADMIN.md): qué muestra el panel, cómo se protege y qué no hace.
- [docs/CONECTAR.md](docs/CONECTAR.md): el código de cada servicio, Hotmart y Stripe (opción avanzada), y lo que falta por verificar.
- [docs/DEPLOY.md](docs/DEPLOY.md): resumen técnico del despliegue, secretos y prueba antes de abrir.
- [docs/LEGAL.md](docs/LEGAL.md): revisión legal y lo que sigue abierto.
- [AGENTS.md](AGENTS.md): instrucciones para la IA que trabaje en tu copia.
