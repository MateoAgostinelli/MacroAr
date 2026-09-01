// Pestañas de /laboratorio (Correlaciones / Gráficos). Va en un archivo
// aparte (no inline en el HTML) porque el sitio tiene Content-Security-Policy
// con script-src 'self' — un <script> suelto en el HTML queda bloqueado en
// producción (funciona en un server local sin CSP, por eso el bug no se veía
// en las pruebas).
//
// Se carga ANTES que laboratorio.js/editor.js a propósito: la detección de
// pestaña inicial tiene que fijar window.__labTabActiva y mostrar/ocultar los
// paneles antes de que esos dos scripts creen sus gráficos, para que el que
// va a quedar visible arranque con su canvas ya destapado.
(function () {
  var p = new URLSearchParams(location.hash.slice(1));
  var inicial = p.has('s') ? 'graficos' : 'correlaciones';
  window.__labTabActiva = inicial;

  var panelCorrelaciones = document.getElementById('tab-correlaciones');
  var panelGraficos = document.getElementById('tab-graficos');
  if (panelCorrelaciones) panelCorrelaciones.hidden = (inicial !== 'correlaciones');
  if (panelGraficos) panelGraficos.hidden = (inicial !== 'graficos');

  document.querySelectorAll('.lab-tab').forEach(function (btn) {
    btn.classList.toggle('active', btn.dataset.tab === inicial);
    btn.addEventListener('click', function () {
      var tab = btn.dataset.tab;
      window.__labTabActiva = tab;
      document.querySelectorAll('.lab-tab').forEach(function (b) { b.classList.toggle('active', b === btn); });
      if (panelCorrelaciones) panelCorrelaciones.hidden = (tab !== 'correlaciones');
      if (panelGraficos) panelGraficos.hidden = (tab !== 'graficos');
      // Chart.js no redibuja bien un canvas que estaba oculto (display:none)
      // al momento de crearse — el resize fuerza a que recalcule su tamaño.
      window.dispatchEvent(new Event('resize'));
      // Fuerza a que la pestaña recién activada actualice el link compartible
      // con su propio estado (hasta ahora bloqueado por el guard de
      // window.__labTabActiva mientras estaba inactiva).
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
  });
})();
