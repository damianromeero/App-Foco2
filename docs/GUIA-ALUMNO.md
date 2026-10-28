# Guía para quien compra la plantilla

Al terminar esta guía tendrás tu propia app publicada. Quien compre tu plan en Hotmart entrará con el correo de su compra, sin contraseñas. Pedir el reembolso no le quita el acceso: lo pierde cuando Hotmart confirma el reembolso (ver [Reglas de acceso](#reglas-de-acceso)). Y tú verás las ventas en un panel privado.

Esta página cuenta lo mismo que [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md), en palabras sencillas y sin los detalles técnicos. Cuando necesites un comando o un dato exacto, ve a esa guía. Los pasos llevan el mismo número en las dos.

**En esta copia no hay nada conectado.** Tú creas cada cuenta y tú pegas cada clave. Nadie más las necesita.

## Antes de empezar

Necesitas:

- Un dominio propio (la dirección de tu web, por ejemplo `tu-dominio.com`).
- Una cuenta de **Supabase**: guarda las compras y decide quién puede entrar.
- Una cuenta de **Hotmart**: cobra, devuelve el dinero y avisa a tu app de cada compra.
- Un **hosting** para publicar la web. La plantilla viene preparada para Vercel.
- Un servicio de **correo** para enviar los enlaces de entrada (por ejemplo, Resend).
- Una cuenta de **GitHub** con un repositorio privado.
- Una **app de autenticación** en tu teléfono (Google Authenticator, 1Password u otra). Sirve para entrar a tu panel.
- Una computadora con **Node 24** y una terminal.
- Un **abogado o asesor** de tu país que revise los textos legales.

Revisa el precio de cada servicio en su web antes de contratarlo. Esta guía no da precios.

## Palabras que vas a ver

| Palabra               | Qué significa                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase              | El servicio donde guardas los datos de tu app y que envía el enlace de entrada.                                                        |
| Hotmart               | La plataforma de cobro. Tu app no cobra por sí sola.                                                                                   |
| Aviso (webhook)       | El mensaje que Hotmart manda a tu app cuando alguien compra, reembolsa, cancela o tiene un cobro atrasado.                             |
| Función de Supabase   | Un pequeño programa que vive en Supabase. La tuya recibe los avisos de Hotmart.                                                        |
| Token                 | Una contraseña larga que solo conocen Hotmart y tu función, para que la función sepa que el aviso es de verdad.                        |
| Secreto               | Un dato que no se puede publicar (como el token). Se guarda en Supabase, nunca en el código.                                           |
| Variable de entorno   | Un dato de configuración que le das al hosting. Las que empiezan por `VITE_` acaban en archivos públicos: nunca pongas ahí un secreto. |
| Migración             | Un archivo SQL que crea las tablas de tu base de datos. Tú lo pegas y lo ejecutas a mano.                                              |
| Reglas por fila (RLS) | Las reglas de la base de datos que dicen qué filas puede leer cada persona. Cada comprador solo ve su propia fila de acceso.           |
| Segundo factor        | Un código de 6 dígitos de tu app de autenticación. Se pide además del enlace del correo para entrar al panel.                          |
| Gate                  | La comprobación automática (`npm run verificar`) que te dice qué falta antes de publicar.                                              |

## Reglas de oro

1. Ninguna clave va al chat, a GitHub ni a un archivo que subas. Solo al hosting, a los secretos de Supabase o a tu archivo `.env.local`, que no se sube.
2. Si una clave aparece en un sitio donde no debía, cámbiala en el servicio donde la creaste.
3. Si un paso no sale como dice la guía, para y pide ayuda antes de improvisar.
4. **Haz los pasos en orden y no te saltes ninguno.** Al terminar uno, pasa al siguiente.
5. Un paso marcado **bloquea publicar** o **bloquea vender** no se salta, ni con prisa.

## Los pasos, en orden

| Paso | Qué haces                                                          | Marca            |
| ---- | ------------------------------------------------------------------ | ---------------- |
| 1    | Pones el nombre, los precios y los datos de tu oferta              | bloquea publicar |
| 2    | Completas los datos legales de quien vende                         | bloquea publicar |
| 3    | Creas tu proyecto en Supabase                                      | bloquea vender   |
| 4    | Configuras cómo se entra: sin registro libre y con tus direcciones | bloquea vender   |
| 5    | Configuras el correo que envía los enlaces de entrada              | bloquea vender   |
| 6    | Creas las tablas pegando cinco archivos SQL, en orden              | bloquea vender   |
| 7    | Creas el producto y los dos planes en Hotmart                      | bloquea vender   |
| 8    | Publicas la función que recibe los avisos                          | bloquea vender   |
| 9    | Dices a Hotmart a dónde avisar y guardas el token                  | bloquea vender   |
| 10   | Haces un envío de prueba y revisas que se entienden los datos      | bloquea vender   |
| 11   | Publicas el sitio en tu hosting con sus variables                  | bloquea publicar |
| 12   | Te das de alta como administradora y activas el segundo factor     | bloquea vender   |
| 13   | Haces la prueba de compra con acceso                               | bloquea vender   |
| 14   | Decides si enciendes la medición anónima (opcional)                | sin marca        |
| 15   | Un abogado revisa los textos legales                               | bloquea vender   |
| 16   | Pasas las comprobaciones automáticas                               | bloquea publicar |
| 17   | Abres el sitio y empiezas a vender                                 | bloquea vender   |
| 18   | Revisas las ventas y los avisos cada semana                        | sin marca        |

**Bloquea publicar** significa que no debes abrir el sitio al público sin ese paso. **Bloquea vender** significa que no debes cobrar a nadie sin él. Una copia sin Supabase configurado es una demostración abierta a cualquiera, así que no la publiques antes del paso 17.

## Cada paso en pocas palabras

### Pasos 1 y 2 · Tu marca y tus datos legales

Cambias el nombre, el eslogan, los precios y los días de prueba y de garantía. Los precios que trae la plantilla son solo una sugerencia: pon los de tu oferta en Hotmart. Después completas los datos de quien vende en los textos legales (titular, identificador fiscal, domicilio, ley aplicable). Verás marcadores con la forma `[COMPLETAR: …]`, con el dato que falta dentro: son huecos que debes rellenar con tus datos reales, nunca con los de otra empresa.

Una decisión que te toca a ti: con Supabase conectado, la app de uso diario exige una compra activa. La portada y la página de precios todavía hablan de «Empezar gratis» y de un plan «Gratuito». Adáptalas a lo que de verdad ofreces.

**Sabrás que salió bien cuando** la web abre en tu computadora con tu nombre y tus precios.

### Paso 3 · Tu proyecto en Supabase

Creas el proyecto, eliges la región y anotas tres datos: el identificador del proyecto, su dirección y la clave pública. La clave secreta («de servicio») no la copies a ningún sitio.

**Sabrás que salió bien cuando** tienes el proyecto activo y esos tres datos anotados fuera del repositorio.

### Paso 4 · Cómo se entra

Apagas el registro libre: así nadie crea una cuenta por su cuenta. Las cuentas nacen cuando alguien compra, o las creas tú. Después le dices a Supabase a qué direcciones puede llevar el enlace del correo: `https://tu-dominio.com/entrar/confirmar` para los compradores y `https://tu-dominio.com/admin/confirmar` para ti.

**Sabrás que salió bien cuando** el registro libre está apagado y las dos direcciones están en la lista.

### Paso 5 · El correo de los enlaces

Supabase envía por correo el enlace con el que la gente entra. Su servicio por defecto es para pruebas y tiene límites bajos, así que conectas un servicio de correo propio con tu dominio.

**Sabrás que salió bien cuando** Supabase guarda la configuración sin error. La prueba real llega en los pasos 12 y 13.

### Paso 6 · Las tablas

Abres cada uno de los cinco archivos de la carpeta `supabase/migrations/`, copias todo su contenido, lo pegas en el editor SQL de Supabase y pulsas **Run**. Se hace uno a uno y en el orden de la guía. Nunca cambies un archivo que ya ejecutaste.

**Sabrás que salió bien cuando** cada archivo termina en «Success» y la lista de tablas tiene once.

### Pasos 7 a 10 · Hotmart y el aviso de compra

Esta es la parte que hace que la app sepa quién pagó.

1. **Paso 7.** En Hotmart creas el producto con dos planes (mensual y anual, en dólares), configuras la prueba de 7 días y la garantía de 15 días, y copias el código de cada plan. Esos dos códigos los pegas en `supabase/functions/_shared/hotmart.ts`. Si no los pegas, la app no reconocerá ninguna compra.
2. **Paso 8.** Instalas la herramienta de Supabase en tu terminal y publicas la función que recibe los avisos.
3. **Paso 9.** En Hotmart pones la dirección de tu función (`https://<tu-proyecto>.supabase.co/functions/v1/hotmart-aviso`), eliges los eventos y copias el token. Ese token lo guardas como secreto en Supabase.
4. **Paso 10.** Envías un aviso de prueba desde Hotmart y compruebas que tu función lo recibe y lo guarda.

El paso 10 es el más importante de los cuatro. Los nombres de los datos que lee tu función no se pudieron confirmar con la documentación oficial de Hotmart cuando se escribió la plantilla. El envío de prueba es lo que lo confirma. **Si la función responde «aviso-sin-fecha», no vendas**: pide ayuda.

**Sabrás que salió bien cuando** Hotmart recibe un 200 y el aviso aparece una vez en la tabla `eventos_pago`.

### Paso 11 · Publicar el sitio

Subes tu copia a un repositorio privado, la conectas a tu hosting, le das las variables (la dirección de Supabase, la clave pública, tu dominio, el enlace de compra de Hotmart y tu correo de soporte) y conectas tu dominio. Si cambias una variable después, vuelve a publicar el sitio.

La plantilla usa **un solo enlace de compra** para los dos planes. Usa una página de compra de Hotmart que deje elegir el plan, o vende un solo plan.

**Sabrás que salió bien cuando** tu dominio abre la portada, `/entrar` muestra el formulario del correo y el botón «Empezar prueba de 7 días» de `/precios` lleva a Hotmart.

### Paso 12 · Tu panel

Creas tu usuario en Supabase, lo das de alta como administradora con una instrucción SQL, abres `https://tu-dominio.com/admin/entrar`, usas el enlace del correo y activas el segundo factor escaneando un código QR con tu app de autenticación. **Escanéalo con dos teléfonos a la vez**: después no se puede añadir otro.

**Sabrás que salió bien cuando** ves el panel con sus cuatro secciones: Hoy, Ventas, Uso de la app y Seguridad.

### Paso 13 · La prueba de compra

Es la prueba que demuestra que todo funciona junto. Se explica abajo.

### Paso 14 · Medición anónima (opcional)

La plantilla puede contar visitas y sesiones terminadas, sin nombres ni correos. Viene **apagada**, y para vender no la necesitas. Si la quieres, hay que encender **dos** interruptores que deben valer lo mismo y revisarlo con tu abogado. Sin ella, la sección «Uso de la app» del panel queda vacía.

### Paso 15 · Tu abogado

Llévale los textos de `src/content/legal.ts` y el documento [LEGAL.md](LEGAL.md). Los textos de la plantilla son borradores. Pregúntale también cómo atender a quien pida borrar su cuenta, porque el botón «Eliminar mi cuenta» de la app no funciona con Hotmart (usa una función de otra pasarela que esta guía no despliega).

### Paso 16 · Las comprobaciones

En tu terminal ejecutas los comandos de la guía (`npm run check`, `npm run e2e`, `npm run barrido`, `npm run verificar`). Los **errores reales** bloquean y los **pendientes** solo te dicen qué falta. No cambies nada para que una comprobación pase: arregla la causa.

### Paso 17 · Abrir la venta

Solo si la prueba del paso 13 salió bien, marcas `supabase` y `pagos` como conectados en `src/config/plantilla.ts`, vuelves a pasar las comprobaciones, publicas y abres la oferta en Hotmart.

### Paso 18 · Cada semana

Entras a tu panel y miras «Requiere atención». Cada aviso ahí puede ser una persona que pagó y no puede entrar.

## La prueba de compra con acceso

Haz esta prueba con **un correo tuyo**, nunca con el de un cliente. Necesitas haber hecho los pasos 4 a 12.

**1. Una compra de prueba da acceso**

1. Compra tu plan con el enlace de Hotmart y tu correo de prueba.
2. En el editor SQL de Supabase, mira las tablas `eventos_pago`, `compras` y `accesos` (la guía trae las consultas). Debe haber un aviso `aplicado`, una compra `aprobada` y un acceso `activo`.
3. En tu teléfono, abre `https://tu-dominio.com/entrar`, escribe el correo de la compra y abre el enlace que llega **en el mismo navegador**. Debes llegar a la app.

**2. Un reembolso no quita el acceso si hay otra compra activa**

1. Con el mismo correo, haz una segunda compra de prueba.
2. Reembolsa la primera. El acceso debe seguir `activo`.
3. Reembolsa la segunda. El acceso pasa a `inactivo`. Recarga la app: te lleva a «No encontramos una compra activa con este correo».

**3. Sin compra no hay acceso**

1. En `/entrar`, escribe tu correo de administradora (existe en Supabase, pero no tiene compra) y abre el enlace: llegas a la pantalla «No encontramos una compra activa con este correo».
2. En `/entrar`, escribe un correo que no existe: la pantalla dice «Si hay una compra con ese correo, te hemos enviado un enlace», pero no llega nada. Es lo normal: nadie puede averiguar qué correos tienen compra.

**4. Cerrar sesión**

1. Con acceso activo, entra en tu cuenta y pulsa «Cerrar sesión».
2. Abre la app: te lleva de nuevo a `/entrar`.

**Si no puedes reembolsar una compra de prueba** en Hotmart, no hay problema para seguir probando, pero anota que el aviso real de reembolso queda sin comprobar y no vendas hasta comprobarlo.

Al terminar, borra las compras de prueba: aparecen en tu panel como ventas.

## Reglas de acceso

La base de datos decide el acceso de cada correo según el **último estado** que Hotmart envió para su compra. Cada aviso lleva su fecha de creación: un aviso repetido o más antiguo que lo guardado no cambia nada. El navegador no decide nada.

| Estado de Hotmart                                       | Acceso                                                                                   |
| ------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| APPROVED o COMPLETE (pagada)                            | **Activo.**                                                                              |
| OVERDUE, DELAYED, PURCHASE_PROTEST o PARTIALLY_REFUNDED | **Se mantiene** mientras Hotmart reintenta el cobro. Cuando se regulariza, sigue activo. |
| REFUNDED o CHARGEBACK                                   | **Se quita**, de forma definitiva.                                                       |
| CANCELLED sin pago previo, EXPIRED o NO_FUNDS           | **Se quita.** `[VERIFICAR: con NO_FUNDS no sabemos si Hotmart aún reintenta el cobro]`   |

**Cancelar la suscripción:**

- **Cancelación voluntaria** (la persona la cancela en Hotmart): mantiene el acceso **hasta la fecha de su próximo cobro**, que es la que indica Hotmart. Después, sin acceso.
- **Cancelación por impago** (el último cobro falló y Hotmart la cancela): sin acceso desde ese momento. Su cuenta y sus datos se conservan.
- Si Hotmart no dice el motivo, se trata como voluntaria. `[VERIFICAR: si SUBSCRIPTION_CANCELLATION distingue ambos casos]`

**Pedir el reembolso:**

- Pedirlo **no quita el acceso**. Solo lo quita el estado REFUNDED (o CHARGEBACK).
- La solicitud puede tardar **hasta 7 días** en aprobarse y en llegar al banco. No son 24 a 72 horas. `[VERIFICAR: plazo en tu cuenta de Hotmart]`
- Si la persona cancela la solicitud antes de que se procese, el acceso vuelve de inmediato, sin pagar otra vez. `[VERIFICAR: qué aviso envía Hotmart en ese caso]`
- Si Hotmart ya muestra la compra como «Reembolsada», la solicitud ya no se puede cancelar.

**Reactivar:** cualquier cobro aprobado posterior (una compra nueva o un cobro de la misma suscripción) restaura el acceso.

**Cuentas y datos:** cancelar, quedar en impago, reembolsar o un contracargo **nunca borra la cuenta ni sus datos**; solo cambia el acceso.

**Cómo cancela la persona compradora su suscripción en Hotmart:**

1. Entra en `consumer.hotmart.com`.
2. Abre **Minhas compras** y elige tu producto.
3. Pulsa **Configurar pagamento**.
4. Pulsa **Cancelar sua assinatura** y confirma con **Sim**.

`[VERIFICAR: nombres de los menús en la versión vigente de Hotmart, que está en portugués]`

**Eliminar su cuenta en la app no cancela la suscripción.** La persona debe cancelarla antes en Hotmart, como arriba.

## Qué pasa cuando alguien compra

1. La persona paga en Hotmart.
2. Hotmart avisa a tu función.
3. Tu función comprueba el token, guarda la compra y crea la cuenta de esa persona.
4. La persona abre `/entrar`, escribe el mismo correo y recibe un enlace.
5. Al abrirlo, la app mira si tiene un acceso activo. Si lo tiene, entra. Si no, ve la pantalla «Sin compra».
6. Si pide el reembolso, Hotmart avisa otra vez. Sigue con acceso hasta que el reembolso se complete (ver [Reglas de acceso](#reglas-de-acceso)).

## Lo que queda pendiente

- La sesión (compradora y del panel) va en cookie httpOnly, pero **nada se ha probado contra tu Supabase ni en Vercel**. Antes de vender, haz la compra de prueba (ver «La prueba de compra con acceso»). `[VERIFICAR]`
- Las rutas `/api` deben responder JSON en tu dominio, no la página principal. `[VERIFICAR]`
- Las migraciones `20261025100000`, `20261025110000` y `20261025120000` no están aplicadas: aplícalas tú, en ese orden, después de `20261024130000`.
- El plazo de borrado de datos (retención) y la lista de funciones premium del plan son decisiones tuyas. `[VERIFICAR]`

## Lo que la plantilla no hace

- **No oculta el código de la app.** Quien no tiene compra no puede entrar desde la pantalla, pero los archivos de la app son públicos. Es un control de acceso, no una caja fuerte.
- **No quita el acceso por un contracargo o una expiración.** Esos avisos quedan registrados y los ves en el panel, pero tienes que actuar tú.
- **Cancelar una suscripción quita el acceso en ese momento**, no al final del periodo pagado, según cuándo avise Hotmart. Compruébalo en tu cuenta antes de vender.
- **No controla la prueba ni la garantía.** Las anuncia; las gestiona Hotmart.
- **Envía sus correos con Resend.** El enlace de entrada y los avisos de compra, cobro atrasado, reembolso y cancelación. Hotmart también envía los suyos, según tu configuración en Hotmart.
- **No deja entrar sin internet.** Una vez dentro, la sesión diaria sigue funcionando aunque se pierda la señal.
- **El panel es solo de lectura.** No cambia nada. Los reembolsos y los cobros se hacen en Hotmart.

## Si algo sale mal

| Qué ves                                              | Qué mirar                                                                                                                                                                                             |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alguien pagó y no puede entrar                       | La tabla `eventos_pago`: si el aviso está como `sin-plan`, el código de oferta no está bien pegado. Si está `sin-correo`, falta el correo en el aviso. Que no use un correo distinto al de la compra. |
| `/entrar` lleva directo a la app sin pedir el correo | Faltan las variables de Supabase en el hosting, o no volviste a publicar después de ponerlas.                                                                                                         |
| El enlace del correo dice «no es válido o ya caducó» | Pide uno nuevo y ábrelo en el mismo navegador donde lo pediste. Revisa las direcciones del paso 4.                                                                                                    |
| Tu panel dice «No hay nada aquí»                     | Tu usuario no está en la tabla `administradores` (paso 12).                                                                                                                                           |
| La función responde 401                              | El token no coincide. Cópialo otra vez, sin espacios.                                                                                                                                                 |
| La función responde 503                              | Falta el secreto `HOTMART_HOTTOK`.                                                                                                                                                                    |
| La función responde 400 «aviso-sin-fecha»            | Para y no vendas: Hotmart envía la fecha con otro nombre. Pide ayuda.                                                                                                                                 |
| Un comando falla                                     | Copia el primer error completo, sin claves, y pídelo con él.                                                                                                                                          |

## Cuándo pedir ayuda y qué enviar

Pide ayuda cuando un paso no salga como dice la guía, cuando el paso 10 falle, o antes de saltarte un paso que bloquea publicar o vender.

Envía: el número del paso, lo que esperabas, lo que ves y el texto completo del error. **Nunca envíes** claves, el token de Hotmart, el contenido de `.env.local` ni correos de clientes. Si algo así se te escapa en un mensaje, cámbialo en el servicio donde lo creaste.
