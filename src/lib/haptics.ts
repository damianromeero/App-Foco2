/** Vibración breve en móviles compatibles. En escritorio y en navegadores sin soporte no hace nada. */
export function buzz(pattern: number | number[] = 30): void {
  const nav: Partial<Navigator> = navigator;
  if (!nav.vibrate) return;
  // Sin ningún gesto de la persona, el navegador bloquea la vibración y avisa en consola: no se intenta.
  const activation: Partial<UserActivation> | undefined = nav.userActivation;
  if (activation && !activation.hasBeenActive) return;
  nav.vibrate(pattern);
}
