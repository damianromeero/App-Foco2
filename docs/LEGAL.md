# Cumplimiento legal: lista para revisar antes de publicar

**Esto no es asesoramiento jurídico.** Es la lista de lo que la plantilla ya hace, de lo que debes completar y de lo que debe revisar un abogado especializado en consumo y protección de datos. Va con el paso 15 de [INFRAESTRUCTURA.md](INFRAESTRUCTURA.md).

## 1. Lo que trae la plantilla

- **Textos legales en borrador.** Cada página lo indica. Complétalos y revísalos antes de publicar (`src/content/legal.ts`). El titular, el identificador fiscal, el domicilio, la ley aplicable y la región de alojamiento son marcadores `[COMPLETAR: …]` que debes rellenar con tus datos.
- **Datos mínimos.** Sin cuenta, los datos se quedan en el dispositivo y no se envían a ningún servidor. Con cuenta se guardan el correo, las sesiones y los resultados, para darte acceso y sincronizarlos.
- **Datos de la compra.** Cuando Hotmart avisa de una compra, la función `hotmart-aviso` guarda el correo de la compra, el plan, el importe, los identificadores de la transacción y de la suscripción y el estado (`compras`, `suscripciones_hotmart` y `accesos`). Los avisos recibidos quedan en `eventos_pago` sin correo ni nombre. La app no recibe ni guarda datos de tarjeta ni de otro medio de pago.
- **Acceso.** La app exige sesión y una compra activa. La decisión la toma la base de datos con reglas por fila: cada persona lee solo su propia fila de `accesos`. La guarda de pantalla corre en el navegador y el código de la app es público: no es una protección de contenido.
- **Sin terceros en la carga.** La portada no hace peticiones fuera del propio dominio. Las pruebas end-to-end lo comprueban. Para entrar, la app se conecta a tu proyecto de Supabase.
- **Medición anónima apagada.** Por defecto la app no envía ni guarda ninguna medición. Si la enciendes, cambia lo que debes contar en la política de privacidad y en la de cookies (ver abajo).
- **Portabilidad.** Exportación en JSON legible, gratuita, desde Ajustes y desde Cuenta.
- **Supresión.** Borrado local con confirmación desde Ajustes, que también borra las sesiones de la nube. El botón «Eliminar mi cuenta» de Cuenta pide escribir ELIMINAR y llama a la función de base `borrar_mi_cuenta()`, que no usa Stripe: la suscripción de Hotmart la cancela el comprador en Hotmart, porque la app no puede hacerlo. Los datos de compra se atienden como se indica abajo.
- **Garantía y reembolso.** La Garantía de 15 días y el reembolso los gestiona Hotmart. La app no tiene un proceso propio de reembolso. La función `withdraw-subscription` de Stripe no se usa con Hotmart.
- **Cancelación.** La gestiona Hotmart. Cuando Hotmart avisa de la cancelación de una suscripción, la plantilla quita el acceso en ese momento.
- **Aviso antes del cobro.** Con Hotmart, la app no avisa de cobros. Si añades avisos de renovación, revisa la normativa de tu país.
- **Seguridad por fila (RLS)** en todas las tablas. Los avisos de Hotmart se aceptan solo con el token `HOTMART_HOTTOK`, que se compara en tiempo constante antes de guardar nada. Los eventos de Stripe (opción avanzada) se verifican con su firma.
- **Redirecciones controladas.** Los enlaces de entrada solo llevan a las direcciones que tú declaras en Supabase (_Redirect URLs_).

## 2. Lo que debe revisar tu abogado

### Contratación y consumo

- **Botón de desistimiento europeo.** Confirma en EUR-Lex y en el BOE si la directiva (UE) 2023/2673 te afecta y desde cuándo en tu país, y cómo se combina con la Garantía de 15 días.
- **Renovación automática.** Confirma si la normativa de consumo española exige avisar antes de cada renovación y con cuánta antelación. Hasta confirmarlo, el aviso depende de la configuración de Hotmart.
- **Prueba gratuita.** La app no ofrece prueba propia. Si la ofreces en Hotmart con cobro automático, exige información previa y revisa que la pantalla de precios la cumple en el momento de la contratación.
- **Inicio del servicio durante el desistimiento.** Si el servicio empieza antes de que acabe el plazo de desistimiento, la persona debe pedirlo de forma expresa. La plantilla no pide esa aceptación en el pago: decide si añadir la casilla y su texto.
- **Precio e IVA.** Indica si el precio incluye el IVA según el país de cada persona y comprueba que coincide con la configuración fiscal de Hotmart.
- **Responsable.** Completa razón social, NIF y domicilio, y revisa las cláusulas de responsabilidad.
- **Qué ofreces gratis.** La portada y `/precios` hablan de empezar gratis, pero con Supabase conectado la app diaria exige compra. Los textos deben decir lo que de verdad ofreces.

### Protección de datos

- **Responsable y encargados.** Completa los datos del responsable. Firma los acuerdos de tratamiento de datos (DPA) con Hotmart, Supabase, el servicio de correo que envía los enlaces de entrada y el proveedor de alojamiento. Si usas Stripe (opción avanzada), también con Stripe.
- **Región de datos.** Elige la región del proyecto de Supabase y refléjala en la política de privacidad.
- **Correo.** Los enlaces de entrada son correos que necesita el servicio. Los recordatorios por correo, si algún día los añades, requieren consentimiento: revisa el texto antes de enviarlos.
- **Datos de compra y plazos de conservación.** Confirma durante cuánto tiempo conservas las compras, los avisos y los accesos, y los plazos fiscales aplicables a los datos de facturación. Ningún proceso de la plantilla borra `compras`, `eventos_pago`, `accesos` ni `eventos_app`: los plazos los aplicas tú.
- **Borrado de cuentas.** Define el procedimiento para atender una petición de borrado: borrar el usuario en Authentication → Users elimina en cascada `profiles`, `daily_sessions` y `subscriptions`, pero `accesos` y `compras` se identifican por correo y se borran a mano. Decide con tu abogado qué datos de compra debes conservar por obligación fiscal.
- **Medición anónima.** Si la enciendes, revisa qué aviso o consentimiento exige tu país. `src/content/legal.ts` añade un párrafo de privacidad y otro de almacenamiento cuando `medicionAnonima` vale `true`, pero siguen siendo borradores. Cada evento lleva un tipo de una lista cerrada, un identificador aleatorio del dispositivo (se renueva cada 30 días) y, a veces, un valor de lista; nunca nombres, correos ni textos libres.
- **Panel de administración.** La administradora lee los correos completos de las compras con la sesión de su cuenta; el panel los enmascara en pantalla. Limita quién es administradora y protege su segundo factor.
- **Datos de salud.** Los datos de rendimiento cognitivo pueden considerarse datos de salud en algunos casos. La app los trata con criterios de minimización; el abogado debe confirmar su clasificación.
- **Edad mínima.** Confirma la edad mínima para consentir el tratamiento de datos en tu país.
- **Cookies y almacenamiento local.** La app usa almacenamiento local necesario para el servicio, y la librería de acceso de Supabase guarda en el navegador la sesión de quien entra (no son datos de la app, pero sí un almacenamiento del navegador). Con la medición encendida se guarda además un identificador de dispositivo. Confirma que no necesitas banner de consentimiento en tu caso.

### Salud y publicidad

- **Afirmaciones de salud.** Ningún texto debe prometer prevención, tratamiento ni mejora de una condición. La portada, la pestaña de ciencia y el aviso de salud lo cubren; el abogado debe validar el conjunto.
- **Publicidad.** Cualquier contenido patrocinado debe identificarse como publicidad.
- **Comparaciones.** Evita comparaciones con competidores que no puedas verificar.

### Técnico

- **IVA por país.** La configuración fiscal de Hotmart o un asesor fiscal.
- **Cabeceras de seguridad.** Revisa la CSP de `vercel.json` con tu proveedor de alojamiento.
- **Accesibilidad.** Las pruebas automáticas no sustituyen las pruebas manuales con lector de pantalla. Verifica si la normativa europea de accesibilidad te exige una declaración.

## 3. Dónde verificar

| Tema                                           | Fuente oficial                                    |
| ---------------------------------------------- | ------------------------------------------------- |
| Desistimiento a distancia, directiva 2023/2673 | EUR-Lex (eur-lex.europa.eu) y BOE (boe.es)        |
| Normativa española de consumo                  | BOE (boe.es)                                      |
| Compra, cobro, garantía y reembolso            | Documentación de Hotmart (hotmart.com)            |
| Acceso, sesiones y segundo factor              | Documentación de Supabase (supabase.com/docs)     |
| Protección de datos                            | Agencia Española de Protección de Datos (aepd.es) |
