# Panel de administración

El panel es una zona privada, de solo lectura, donde la persona que vende ve sus ventas, los avisos de Hotmart que necesitan revisión y el uso de la app. Vive en `/admin`. Solo entra quien está en la lista de administradoras de la base de datos y ha pasado el segundo factor.

Para activarlo paso a paso con tus cuentas, sigue [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md), paso 12. Este documento explica qué muestra, cómo se protege y qué no hace.

## Estado al entregar

- El código está escrito y probado con datos simulados y con PostgreSQL en memoria (PGlite) para las reglas por fila.
- **No está conectado** en esta copia. Sin Supabase configurado, `/admin` muestra «El panel necesita Supabase configurado» y no hace ninguna petición ni muestra datos.
- Nada se ha probado contra un Supabase ni un Hotmart reales. Antes de usarlo, haz las pruebas del paso 13 de la guía de infraestructura.

## Qué ve la administradora

Cuatro secciones. Los importes son dólares (USD) y los días se cuentan en la zona horaria del panel. Por defecto es `America/Bogota`; para cambiarla, escribe tu zona en `ADMIN_APP.zonaHoraria` (`src/admin/config.ts`), con su nombre IANA (por ejemplo `Europe/Madrid`). Lo usan a la vez los periodos, las gráficas, los días de retención y los formatos, y el horario de verano se aplica solo (`src/admin/zona.ts`). `[VERIFICAR: confirma que tu negocio usa esta zona]`

| Sección           | Qué muestra                                                                                                                                                                                                       |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hoy**           | Los últimos 7 días. «Requiere atención» (avisos de Hotmart que la función no pudo aplicar, con su referencia y su hora), ingresos, compras aprobadas y el último día con actividad de la app.                     |
| **Ventas**        | Un periodo a elegir (7, 30 o 90 días, o todo; empieza en 30). Ingresos, compras aprobadas por plan, el embudo de compra, la tabla de compras y el resumen de avisos de Hotmart.                                   |
| **Uso de la app** | Personas activas (dispositivos distintos), eventos registrados, eventos por día, eventos por tipo y cuántas personas vuelven al día siguiente y a los 7 días. Solo tiene datos si encendiste la medición anónima. |
| **Seguridad**     | El nivel de tu sesión (solo enlace o con segundo factor), cerrar sesión, el alta del segundo factor con un código QR y la lista de factores registrados.                                                          |

### Cómo se calculan las cifras

- **Ingresos**: la suma de `monto_usd` de las compras aprobadas. Las reembolsadas y canceladas no cuentan. Es el importe que trae el aviso de Hotmart. `[VERIFICAR: si data.purchase.price.value es el precio de la oferta o incluye impuestos o comisiones]`
- **Embudo**: portada vista, precios vistos, clic en comprar y compra aprobada. Un dispositivo cuenta en una etapa solo si también contó en la anterior. La compra aprobada viene de Hotmart, no de un dispositivo, así que puede superar a los clics. Los tres primeros pasos dependen de la medición anónima.
- **Retención**: de los dispositivos cuya primera actividad cae en el periodo, cuántos volvieron el día siguiente y a los 7 días. Es una cifra orientativa: quien ya usaba la app antes del periodo parece nuevo.
- **Límite de lectura**: el panel lee hasta 5.000 filas por tabla y periodo. Si hay más, muestra un error y pide un periodo más corto. Nunca muestra cifras parciales.
- **Máscaras**: el correo sale como `c***@dominio.com` y las referencias, con los últimos 6 caracteres del identificador. Ver «Lo que protege y lo que no» para su alcance.

### Los avisos que piden revisión

El panel marca como «requiere atención» siete estados de los avisos de Hotmart (la tabla completa está en [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md), «Estados de los avisos»):

| Lo que dice el panel                  | Estado                  |
| ------------------------------------- | ----------------------- |
| Falta el correo del comprador         | `sin-correo`            |
| Falta la fecha del aviso              | `sin-fecha`             |
| Formato del aviso no reconocido       | `formato-no-reconocido` |
| Aviso rechazado por datos incompletos | `rechazado`             |
| Aviso recibido sin procesar           | `no-procesado`          |
| La oferta no tiene plan asignado      | `sin-plan`              |
| El precio no está en dólares          | `divisa-no-usd`         |

Cada uno puede ser una persona que pagó y no tiene acceso. Los estados `sin-compra` y `sin-suscripcion` no se marcan: míralos en la tabla `eventos_pago` si algo no cuadra.

## Cómo se entra

1. Abre `/admin/entrar` y escribe tu correo. La pantalla responde igual exista o no el correo. Solo llega un enlace si ya existe esa cuenta: el panel no crea cuentas.
2. Abre el enlace en el mismo navegador. Llegas a `/admin/confirmar` y de ahí a `/admin`.
3. Si tu sesión aún no tiene segundo factor, el panel te lleva a **Seguridad**, donde escribes el código de 6 dígitos de tu app de autenticación. Hasta entonces no puedes ver otra sección.
4. Si tu correo no está en la lista de administradoras, `/admin` muestra «No hay nada aquí».

## Modelo de seguridad

El panel **no usa la clave de servicio**. Todo se hace con la clave pública de Supabase y la sesión de la propia administradora, y la base de datos decide qué filas devuelve.

1. **Sesión de Auth.** Entras con un enlace de un solo uso. El envío usa `shouldCreateUser: false`: solo reciben el enlace las cuentas que ya existen. El registro público de Supabase está apagado.
2. **Lista de administradoras.** La tabla `administradores` tiene una fila por persona. La función `soy_administrador()` dice si quien llama está en ella. La migración no añade a nadie: tú te das de alta con una instrucción SQL.
3. **Segundo factor.** La función `es_administrador()` exige estar en la lista **y** que el token de la sesión sea de nivel `aal2` (entró con segundo factor). Sin eso devuelve falso.
4. **Reglas por fila (RLS).** Cada tabla del panel (`administradores`, `eventos_app`, `compras`, `suscripciones_hotmart` y `eventos_pago`) tiene una única política: leer, para el rol `authenticated`, solo si `es_administrador()` es verdadero. Ni `authenticated` ni `anon` tienen permiso para insertar, cambiar ni borrar en ellas.
5. **Contadores de la medición.** `limite_eventos_app` no da permisos a nadie: solo la función `registrar_evento_app` la escribe.
6. **Acceso de compradores.** `accesos` no la lee el panel: cada persona solo puede leer su propia fila.
7. **La clave de servicio de Supabase** (la que se salta las reglas por fila) la usa únicamente la función `hotmart-aviso`, en el servidor, después de comprobar el token del aviso. El navegador y el panel nunca la ven.

La pantalla también redirige (por ejemplo, a **Seguridad** mientras falte el segundo factor), pero eso es comodidad. Lo que protege los datos es la base: sin `aal2`, la base no devuelve filas aunque alguien manipule la pantalla.

### Lo que protege y lo que no

- La base entrega a la administradora los **correos completos** de las compras. El enmascarado (`c***@dominio.com`) lo hace la interfaz, no la base. Una administradora autorizada puede verlos con las herramientas del navegador. Tómalo como una ayuda para no exponerlos en pantalla, no como una protección frente a la propia administradora.
- El panel no guarda cifras ni datos de compradores en el navegador: se piden en cada visita y viven solo en memoria mientras la página está abierta.
- **La sesión de la administradora va en una cookie httpOnly `foco_admin`** (SameSite=Lax; Secure en https), que fija y lee el servidor en `/api/admin/sesion`, `/api/admin/mfa` y `/api/admin/datos`. El navegador no recibe ni guarda tokens de Supabase: ni `localStorage` ni la librería de Supabase en el panel. Aun así: entra desde un dispositivo de confianza, cierra la sesión en dispositivos compartidos y no instales extensiones que no necesites. La política de seguridad de `vercel.json` limita los scripts a los propios del sitio, pero ninguna política sustituye a esa precaución.
- La duración de la sesión y los tiempos de inactividad los define tu proyecto de Supabase, no el código de la plantilla. `[VERIFICAR: opciones de duración de sesión disponibles en tu plan de Supabase]`
- Las pantallas del panel llevan `noindex`, pero `robots.txt` no las menciona. Quien conozca la dirección verá la pantalla de entrada; los datos siguen protegidos por la base.

## Lo que el panel NO hace

- **No escribe nada.** Es de solo lectura: no cambia compras, accesos ni avisos, no reembolsa y no cobra. Los reembolsos y los cobros se gestionan en Hotmart.
- **No envía ni recibe correos.** No hay bandeja ni plantillas.
- **No muestra costos** de Supabase, del hosting ni del correo.
- **No guarda auditoría** de lo que hace la administradora, ni tiene sección de ajustes.
- **No exporta datos** ni permite buscar a una persona concreta.
- **No gestiona accesos a mano.** Si necesitas dar o quitar un acceso, se hace en el editor SQL de Supabase y bajo tu responsabilidad.
- **No muestra el estado de `accesos`**, solo compras y avisos.

## Pruebas que lo cubren

- `supabase/tests/migraciones-compras.test.ts` y `migraciones-medicion.test.ts`: ejecutan las migraciones en PostgreSQL real en memoria (PGlite) y comprueban que sin sesión, sin segundo factor y con una cuenta que no es administradora no se lee ni se escribe ninguna fila.
- `supabase/tests/hotmart-*.test.ts` y `acceso-*.test.ts`: el análisis de los avisos, el orden de los avisos, las respuestas de la función y las reglas del acceso.
- `supabase/tests/medicion-*.test.ts` y `contrato.test.ts`: la medición y que las dos listas y los dos interruptores coinciden.
- `src/pages/admin/*.test.tsx` y `src/admin/*.test.ts`: el panel, la sesión, las consultas, el enmascarado y las cifras.

## Pendiente antes de usarlo en serio

- Probarlo contra tu Supabase y tu Hotmart reales (paso 13 de la guía).
- Confirmar los endpoints de Auth y de segundo factor (`mfa.enroll`, `mfa.challenge`, `mfa.verify`) con tu proyecto. Varios están marcados `[VERIFICAR]` en `src/pages/admin/Seguridad.tsx`.
- Poner tus códigos de oferta en `supabase/functions/_shared/hotmart.ts`. Sin ellos, ninguna compra se guarda y los avisos quedan como `sin-plan`.
- Encender la medición anónima si quieres ver el uso de la app (paso 14).
