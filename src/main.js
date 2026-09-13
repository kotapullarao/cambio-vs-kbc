import { render } from './render.js';
import { initControls } from './controls.js';
import { initTheme } from './theme.js';

const state = {
  cls: 'S',
  hours: 48,
  nightHours: 0,
  km: 300,
  trips: 1,
  months: 3,
  kbcIns: false,
  safetyPack: false,
  partnerCard: false,
  digitalInvoice: false,
  tripDetailsOpen: false,
  totalDetailsOpen: false,
};

function rerender() {
  render(state);
}

function initCollapsible(toggleId, contentId) {
  const btn = document.getElementById(toggleId);
  const content = document.getElementById(contentId);
  btn.addEventListener('click', () => {
    const isOpen = content.style.display === 'block';
    content.style.display = isOpen ? 'none' : 'block';
    btn.setAttribute('aria-expanded', String(!isOpen));
    btn.querySelector('.chevron').classList.toggle('open', !isOpen);
  });
}

function initOptionInfoToggles() {
  document.querySelectorAll('.info-btn').forEach((btn) => {
    const note = btn.closest('.option-info').querySelector('.option-note');
    btn.addEventListener('click', () => {
      const isOpen = !note.hidden;
      note.hidden = isOpen;
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });
}

function initPrint() {
  document.getElementById('printBtn').addEventListener('click', () => window.print());
}

initTheme();
initControls(state, rerender);
initCollapsible('referenceToggle', 'referenceContent');
initCollapsible('notesToggle', 'notesContent');
initCollapsible('sourcesToggle', 'sourcesContent');
initOptionInfoToggles();
initPrint();
render(state);