import { emptyCompany } from '../application/editing/model';
import { $, dom } from './dom';
import { downloadBackup } from './companyMenu';
import { closeOverlays, run, showConfig, showHub, switchTo } from './controller';
import { scene } from './sceneHost';
import { persist } from './services';
import { state } from './state';

/** Los botones de la barra superior y los atajos de teclado. */
export function bindToolbar() {
  $('simulate').addEventListener('click', () => run());
  $('configure').addEventListener('click', () => showConfig());
  $('processes').addEventListener('click', showHub);
  $('preview-exit').addEventListener('click', () => run());

  // «Limpiar todo»: con base de datos crea una empresa nueva en blanco; sin ella, borra lo guardado en el navegador
  $('reset-all').addEventListener('click', () => {
    const inDb = persist.online;
    const warn = inDb
      ? 'Se crea una empresa NUEVA en blanco para que cargues la tuya. Las empresas que ya tienes siguen guardadas en la base de datos (puedes cambiar entre ellas o borrarlas con ⋯).\n\n¿Continuar?'
      : 'Esto borra TODO lo guardado en este navegador: empresa, áreas, personas, procesos, procedimientos (con sus capturas) y preferencias. Queda una empresa en blanco para que cargues la tuya.\n\n¿Continuar?';
    if (!confirm(warn)) return;
    if (!inDb && confirm('¿Quieres descargar antes una copia (.yaml) de la empresa actual?\n\nAceptar = descargar la copia. Cancelar = no descargar.')) downloadBackup();
    if (!inDb) {
      try {
        for (const k of Object.keys(localStorage)) if (k.startsWith('office-pixel.')) localStorage.removeItem(k);
      } catch {
        /* sin almacenamiento: solo se limpia lo que hay en pantalla */
      }
    }
    dom.seed.value = '1';
    dom.days.value = state.mode === 'explain' ? '2' : '5';
    if (inDb) void switchTo(() => persist.create(emptyCompany()));
    else {
      closeOverlays();
      scene.playing = false;
      run(emptyCompany());
    }
  });

  window.addEventListener('keydown', (e) => {
    // con un diálogo abierto (decorar sala, quitar área…) Esc es suyo: no cierra toda la configuración
    if (e.key === 'Escape' && dom.configRoot.classList.contains('open') && !document.querySelector('.modal-back')) closeOverlays();
  });

  $('restart').addEventListener('click', () => {
    scene.seek(0);
    scene.playing = true;
  });
  $('fit').addEventListener('click', () => {
    scene.fit();
    dom.chips.querySelectorAll('button').forEach((x) => x.classList.toggle('on', (x as HTMLElement).dataset.f === '-1'));
  });
  dom.play.addEventListener('click', () => {
    if (scene.simT >= Number(dom.timeline.max)) scene.seek(0);
    scene.playing = !scene.playing;
  });
  dom.speed.addEventListener('change', () => (scene.speed = Number(dom.speed.value)));
  dom.step.addEventListener('click', () => {
    if (scene.simT >= Number(dom.timeline.max) - 1) scene.seek(0);
    scene.stepNext();
  });
  dom.timeline.addEventListener('input', () => {
    scene.playing = false;
    scene.seek(Number(dom.timeline.value));
  });
}
