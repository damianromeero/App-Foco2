/* Aplica preferencias de accesibilidad y de tema antes de que React se monte.
 * Lee el mismo almacenamiento que la app (clave "foco5") y falla en silencio si no existe. */
(function () {
  try {
    var raw = window.localStorage.getItem('foco5');
    var settings = raw ? JSON.parse(raw).state.settings : null;
    var root = document.documentElement;
    var theme = (settings && settings.theme) || 'sistema';
    var text = settings && settings.textSize === 'grande' ? 'grande' : 'normal';
    var motion = settings && settings.reduceMotion ? settings.reduceMotion : 'sistema';
    root.setAttribute('data-theme', theme);
    root.setAttribute('data-text', text);
    root.setAttribute('data-motion', motion);
  } catch (error) {
    /* Sin preferencias guardadas o almacenamiento bloqueado: se usan los valores por defecto. */
  }
})();
