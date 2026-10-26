import { GARANTIA, plantilla } from '../config/plantilla';

/**
 * Textos legales en BORRADOR. No son asesoramiento jurídico y deben revisarlos un abogado
 * antes de publicar. Los marcadores [COMPLETAR: …] son datos del responsable que aún faltan.
 */
export const LEGAL_DRAFT_NOTICE =
  'Borrador. Pendiente de revisión por un abogado antes de publicar. Los marcadores [COMPLETAR: …] deben completarse.';

export interface LegalSection {
  heading: string;
  paragraphs: string[];
}

export interface LegalDocument {
  slug: 'privacidad' | 'terminos' | 'cookies' | 'aviso-salud' | 'desistimiento';
  title: string;
  description: string;
  sections: LegalSection[];
}

/**
 * Párrafos de la medición anónima. Solo aparecen si `plantilla.medicionAnonima` está encendida (el interruptor del servidor
 * debe valer lo mismo, docs/INFRAESTRUCTURA.md). Mientras esté apagada, la app no envía ni guarda nada y estos textos
 * no se muestran. Al encenderla, revisa con tu abogado qué aviso o consentimiento exige tu país para esta medición
 * (docs/INFRAESTRUCTURA.md, paso 14).
 */
const MEDICION_PRIVACIDAD: string[] = plantilla.medicionAnonima
  ? [
      'Medimos de forma anónima cómo se usa la app, por ejemplo qué pantallas se visitan o si se termina una sesión. Cada evento lleva solo un tipo de una lista cerrada, un identificador aleatorio del dispositivo que se renueva cada 30 días y, a veces, el nombre de un juego o de un paso. No incluye tu nombre, tu correo ni textos que escribas.',
    ]
  : [];

const MEDICION_ALMACENAMIENTO: string[] = plantilla.medicionAnonima
  ? [
      'Otra entrada con un identificador aleatorio del dispositivo para la medición anónima. Se renueva cada 30 días y no está unido a tu cuenta.',
    ]
  : [];

export const LEGAL_DOCUMENTS: LegalDocument[] = [
  {
    slug: 'privacidad',
    title: 'Política de privacidad',
    description: 'Qué datos tratamos, para qué, durante cuánto tiempo y cómo ejercer tus derechos.',
    sections: [
      {
        heading: '1. Responsable',
        paragraphs: [
          `Razón social: [COMPLETAR: titular]. Identificador fiscal: [COMPLETAR: identificador fiscal]. Domicilio: [COMPLETAR: domicilio]. Contacto: ${plantilla.contactoEmail}. Ley aplicable: [COMPLETAR: ley aplicable].`,
        ],
      },
      {
        heading: '2. Qué datos tratamos',
        paragraphs: [
          plantilla.medicionAnonima
            ? 'Sin cuenta, la app guarda en tu propio dispositivo tus preferencias, tus sesiones y tus resultados. No enviamos esos datos a ningún servidor; solo se envía la medición anónima que se describe más abajo.'
            : 'Sin cuenta, la app guarda en tu propio dispositivo tus preferencias, tus sesiones y tus resultados. No los enviamos a ningún servidor.',
          'Tu cuenta se crea cuando compras, con el correo de la compra. Con cuenta, tratamos tu correo electrónico, tus sesiones y tus resultados para darte acceso y sincronizarlos entre tus dispositivos.',
          'Cuando compras, Hotmart nos avisa y guardamos el correo de la compra, el plan, el importe, los identificadores de la transacción y de la suscripción, y el estado de la compra (aprobada, reembolsada o cancelada). Los datos de tu medio de pago los gestiona Hotmart y no los guardamos.',
          ...MEDICION_PRIVACIDAD,
          'No tratamos datos para publicidad ni elaboramos perfiles para terceros.',
        ],
      },
      {
        heading: '3. Para qué y con qué base legal',
        paragraphs: [
          'Para prestarte el servicio que pides (base: ejecución del contrato) y para mantener la seguridad de la aplicación (base: interés legítimo).',
          'Los recordatorios de correo, si los activas, se basan en tu consentimiento, que puedes retirar en cualquier momento.',
        ],
      },
      {
        heading: '4. Proveedores',
        paragraphs: [
          'Hotmart para la compra, el cobro y los reembolsos. Supabase para la base de datos, las cuentas y el acceso. Un servicio de correo para enviarte el enlace de entrada: [COMPLETAR: proveedor del correo de entrada]. Alojamiento estático del sitio. [COMPLETAR: región de alojamiento y acuerdos de tratamiento de datos].',
        ],
      },
      {
        heading: '5. Cuánto tiempo los guardamos',
        paragraphs: [
          'Mientras mantengas tu cuenta. Puedes pedir que la eliminemos escribiendo al contacto del apartado 1, y borraremos tus datos de la aplicación. Los datos de facturación se conservan los plazos que exige la normativa fiscal.',
        ],
      },
      {
        heading: '6. Tus derechos',
        paragraphs: [
          'Puedes acceder, rectificar, borrar, limitar, oponerte y pedir la portabilidad de tus datos. La exportación en JSON está disponible en Ajustes y es gratuita.',
          'Si consideras que no tratamos tus datos correctamente, puedes presentar una reclamación ante la Agencia Española de Protección de Datos (aepd.es).',
        ],
      },
    ],
  },
  {
    slug: 'terminos',
    title: 'Condiciones de uso',
    description: `Qué incluye el servicio, cómo se compra con Hotmart, la ${GARANTIA} y tus derechos como consumidor.`,
    sections: [
      {
        heading: '1. El servicio',
        paragraphs: [
          `${plantilla.nombre} es una aplicación de entrenamiento de la atención con juegos breves. No es un servicio sanitario ni sustituye a ningún tratamiento.`,
        ],
      },
      {
        heading: '2. Compra y cobro',
        paragraphs: [
          'Los planes se compran y se cobran a través de Hotmart, según la modalidad que aparezca en su página de compra.',
          `${GARANTIA}: si no te convence, puedes pedir el reembolso dentro de ese plazo. Lo gestiona Hotmart.`,
          '[VERIFICAR: modalidad (pago único o suscripción), renovación y plazos del reembolso en tu producto de Hotmart.]',
        ],
      },
      {
        heading: '3. Reembolso',
        paragraphs: [
          'Los detalles para pedir el reembolso están en la página Reembolso, dentro de esta sección legal.',
        ],
      },
      {
        heading: '4. Uso aceptable',
        paragraphs: [
          'No intentes vulnerar la seguridad de la aplicación, ni revender el acceso, ni extraer el contenido para redistribuirlo.',
        ],
      },
      {
        heading: '5. Responsabilidad',
        paragraphs: [
          'La app no garantiza mejoras concretas en tu vida diaria. Las mejoras que se muestran son las que se miden dentro de la aplicación. Nuestra responsabilidad se limita a lo que exige la ley.',
        ],
      },
      {
        heading: '6. Legislación',
        paragraphs: [
          'Estas condiciones se rigen por la legislación española. Si eres consumidor, mantienes los derechos que te reconoce la normativa de tu país de residencia.',
        ],
      },
    ],
  },
  {
    slug: 'cookies',
    title: 'Política de cookies y almacenamiento',
    description: 'Qué guardamos en tu navegador y para qué.',
    sections: [
      {
        heading: 'Sin cookies de publicidad ni de terceros',
        paragraphs: [
          'No usamos cookies de publicidad, de seguimiento ni de analítica de terceros. La app no carga ningún script de otra empresa.',
        ],
      },
      {
        heading: 'Lo que sí se guarda',
        paragraphs: [
          'Una entrada en el almacenamiento local de tu navegador con tus preferencias, tu progreso y tus sesiones. Es necesaria para que la app funcione tal como la usas.',
          'Si entras con el correo de tu compra, el servicio de cuentas (Supabase) guarda tu sesión en el almacenamiento de tu navegador para que sigas conectado. Al cerrar sesión, se borra.',
          ...MEDICION_ALMACENAMIENTO,
        ],
      },
    ],
  },
  {
    slug: 'aviso-salud',
    title: 'Aviso sobre salud',
    description: `Qué no es ${plantilla.nombre} y cuándo consultar a un profesional.`,
    sections: [
      {
        heading: 'No es un dispositivo médico',
        paragraphs: [
          `${plantilla.nombre} no diagnostica, trata ni previene ninguna enfermedad ni trastorno, incluido el TDAH, el deterioro cognitivo o la demencia.`,
          'Una aplicación en el móvil no estimula el cerebro. Los juegos entrenan tareas de atención dentro de la aplicación.',
        ],
      },
      {
        heading: 'Cuándo consultar a un profesional',
        paragraphs: [
          'Si te preocupa tu atención, tu memoria o tu bienestar, habla con un profesional de salud. No dejes un tratamiento por usar la aplicación.',
        ],
      },
    ],
  },
  {
    slug: 'desistimiento',
    title: 'Reembolso',
    description: `${GARANTIA}, con el reembolso gestionado por Hotmart.`,
    sections: [
      {
        heading: 'Plazo',
        paragraphs: [
          `${GARANTIA}, desde la fecha de compra.`,
          '[VERIFICAR: fecha exacta en la que empieza el plazo y condiciones en la configuración de tu producto de Hotmart.]',
        ],
      },
      {
        heading: 'Cómo pedir el reembolso',
        paragraphs: [
          'La solicitud dentro de ese plazo se gestiona con Hotmart. Esta app no tiene un proceso propio de reembolso.',
        ],
      },
      {
        heading: 'Derecho legal de desistimiento',
        paragraphs: [
          `[VERIFICAR: si tu venta incluye además el plazo legal de desistimiento de 14 días para contratos a distancia, y cómo encaja con ${GARANTIA}. Confírmalo con tu abogado.]`,
        ],
      },
    ],
  },
];

export function legalDocument(slug: string): LegalDocument | undefined {
  return LEGAL_DOCUMENTS.find((document) => document.slug === slug);
}
