/**
 * Referencias científicas y grado de verificación.
 * Autores, año, revista, volumen, páginas y DOI comprobados en Crossref (octubre de 2026).
 * Los hallazgos se resumen de los resúmenes publicados o de la fuente primaria cuando fue accesible.
 * Lo que no se pudo confirmar no se muestra en la app.
 */
export interface Reference {
  id: string;
  /** Etiqueta corta para las listas de fuentes de las lecciones, p. ej. "Simons et al. (2016)". */
  label: string;
  citation: string;
  finding: string;
  url?: string;
  doi?: string;
  verification: 'verificada' | 'parcial';
  note?: string;
}

export const REFERENCES: Reference[] = [
  {
    id: 'simons-2016',
    label: 'Simons et al. (2016)',
    citation:
      'Simons, D. J., Boot, W. R., Charness, N., Gathercole, S. E., Chabris, C. F., Hambrick, D. Z. y Stine-Morrow, E. A. L. (2016). Do "Brain-Training" Programs Work? Psychological Science in the Public Interest, 17(3), 103–186.',
    finding:
      'Los juegos mejoran el rendimiento en las tareas que se entrenan. Hay poca evidencia de que esa mejora llegue a la vida diaria. Los autores señalan también problemas de diseño en muchos estudios del sector.',
    doi: '10.1177/1529100616661983',
    verification: 'verificada',
  },
  {
    id: 'meta-2021',
    label: 'Nguyen et al. (2021)',
    citation:
      'Nguyen, L., Murphy, K. y Andrews, G. (2021). A Game a Day Keeps Cognitive Decline Away? A Systematic Review and Meta-Analysis of Commercially-Available Brain Training Programs in Healthy and Cognitively Impaired Older Adults. Neuropsychology Review, 32(3), 601–630.',
    finding:
      'Revisión de 43 estudios con 2 636 participantes, adultos mayores sanos y con deterioro cognitivo leve. Hubo efectos pequeños en tareas parecidas a las entrenadas. En adultos sanos apareció transferencia a funciones ejecutivas, memoria y velocidad de procesamiento, pero solo la velocidad se mantuvo al corregir por sesgo de publicación. En deterioro cognitivo leve no hubo transferencia a tareas distintas.',
    doi: '10.1007/s11065-021-09515-2',
    verification: 'verificada',
  },
  {
    id: 'leroy-2009',
    label: 'Leroy (2009)',
    citation:
      'Leroy, S. (2009). Why is it so hard to do my work? The challenge of attention residue when switching between work tasks. Organizational Behavior and Human Decision Processes, 109(2), 168–181.',
    finding:
      'Describe el «residuo de atención»: al cambiar entre tareas de trabajo, parte de la atención se queda en la tarea anterior.',
    doi: '10.1016/j.obhdp.2009.04.002',
    verification: 'verificada',
  },
  {
    id: 'rubinstein-2001',
    label: 'Rubinstein et al. (2001)',
    citation:
      'Rubinstein, J. S., Meyer, D. E. y Evans, J. E. (2001). Executive control of cognitive processes in task switching. Journal of Experimental Psychology: Human Perception and Performance, 27(4), 763–797.',
    finding:
      'Cambiar de una tarea a otra tiene un coste de tiempo medible. El coste aumenta con la complejidad de las reglas y con lo poco familiar que resulta la nueva tarea.',
    doi: '10.1037/0096-1523.27.4.763',
    verification: 'verificada',
  },
  {
    id: 'ophir-2009',
    label: 'Ophir et al. (2009)',
    citation:
      'Ophir, E., Nass, C. y Wagner, A. D. (2009). Cognitive control in media multitaskers. PNAS, 106(37), 15583–15587.',
    finding:
      'Quienes usan muchos medios a la vez tuvieron más dificultades para filtrar distracciones en el laboratorio.',
    doi: '10.1073/pnas.0903620106',
    verification: 'verificada',
    note: 'Replicaciones posteriores no encontraron siempre esa relación: Wiradhany y Nieuwenstein (2017), "Cognitive control in media multitaskers: Two replication studies and a meta-analysis", Attention, Perception, & Psychophysics, 79(8), 2620–2641.',
  },
  {
    id: 'mark-2008',
    label: 'Mark et al. (2008)',
    citation:
      'Mark, G., Gudith, D. y Klocke, U. (2008). The cost of interrupted work: More speed and stress. En CHI 2008: Proceedings of the SIGCHI Conference on Human Factors in Computing Systems, pp. 107–110.',
    finding:
      'Las tareas interrumpidas se terminan antes, pero se hacen con más prisa y con más estrés, frustración y esfuerzo.',
    doi: '10.1145/1357054.1357072',
    verification: 'verificada',
  },
  {
    id: 'ftc-lumosity-2016',
    label: 'FTC (2016)',
    citation:
      'Federal Trade Commission (2016). Lumosity to pay $2 million to settle FTC deceptive advertising charges for its brain training program. Comunicado de prensa, 5 de enero de 2016.',
    finding:
      'La FTC consideró sin respaldo científico suficiente las promesas de mejorar el rendimiento diario, frenar el deterioro cognitivo y prevenir enfermedades de la memoria. La empresa acordó pagar 2 millones de dólares.',
    url: 'https://www.ftc.gov/news-events/press-releases/2016/01/lumosity-pay-2-million-settle-ftc-deceptive-advertising-charges',
    verification: 'verificada',
  },
];

export function referenceById(id: string): Reference | undefined {
  return REFERENCES.find((reference) => reference.id === id);
}

export type ClaimStatus = 'respaldado' | 'parcial' | 'no-respaldado' | 'sin-demostrar';

export interface Claim {
  claim: string;
  status: ClaimStatus;
  explanation: string;
  refs: string[];
}

/** Lo que se dice sobre el entrenamiento de la atención, con el grado de evidencia de cada afirmación. */
export const CLAIMS: Claim[] = [
  {
    claim: 'Mejoras en los juegos que entrenas',
    status: 'respaldado',
    explanation: 'Hay evidencia consistente de que el rendimiento en la tarea entrenada mejora.',
    refs: ['simons-2016'],
  },
  {
    claim: 'Mejoras en tareas parecidas a las entrenadas',
    status: 'parcial',
    explanation: 'La evidencia es más débil y depende del tipo de tarea.',
    refs: ['simons-2016', 'meta-2021'],
  },
  {
    claim: 'Mejoras en la memoria o en la inteligencia general',
    status: 'no-respaldado',
    explanation:
      'Las revisiones no encuentran evidencia sólida. En adultos mayores sanos aparece algo de transferencia a la memoria, pero no se mantiene al corregir por sesgo de publicación. Por eso no lo prometemos.',
    refs: ['simons-2016', 'meta-2021'],
  },
  {
    claim: 'Cinco minutos al día mejoran tu atención en la vida real',
    status: 'sin-demostrar',
    explanation:
      'No lo sabemos todavía. Medimos tu rendimiento dentro de la app, y esa es la única mejora que te podemos enseñar con datos.',
    refs: [],
  },
  {
    claim: 'La multitarea hace más difícil filtrar distracciones',
    status: 'parcial',
    explanation: 'El efecto aparece en algunos estudios y no en todos.',
    refs: ['ophir-2009'],
  },
  {
    claim: 'Cambiar de tarea y las interrupciones tienen coste',
    status: 'respaldado',
    explanation: 'Se observa un coste de tiempo y de estrés en varios estudios independientes.',
    refs: ['rubinstein-2001', 'mark-2008'],
  },
  {
    claim: 'La atención humana dura "8 segundos" (cifras virales de la atención)',
    status: 'no-respaldado',
    explanation:
      'Esa cifra circula en redes, pero no tiene una fuente científica verificable. No la usamos.',
    refs: [],
  },
];

export const CLAIM_LABEL: Record<ClaimStatus, string> = {
  respaldado: 'Respaldado por la evidencia',
  parcial: 'Evidencia parcial',
  'no-respaldado': 'Sin respaldo suficiente',
  'sin-demostrar': 'Todavía sin demostrar',
};
