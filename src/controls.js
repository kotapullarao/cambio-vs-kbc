const NUMERIC_FIELD_IDS = ['hours', 'nightHours', 'km', 'trips', 'months'];

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

export function initControls(state, rerender) {
  const chipContainer = document.getElementById('classChips');
  chipContainer.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    chipContainer.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
    state.cls = chip.dataset.class;
    rerender();
  });

  NUMERIC_FIELD_IDS.forEach((id) => {
    const numberInput = document.getElementById(id);
    const rangeInput = document.getElementById(id + 'Range');

    numberInput.addEventListener('input', () => {
      const min = parseInt(numberInput.min, 10);
      const max = parseInt(numberInput.max, 10);
      let v = parseInt(numberInput.value, 10);
      if (isNaN(v)) v = min;
      v = clamp(v, min, max);
      numberInput.value = v;
      if (rangeInput) rangeInput.value = v;
      state[id] = v;
      rerender();
    });

    if (rangeInput) {
      rangeInput.addEventListener('input', () => {
        numberInput.value = rangeInput.value;
        numberInput.dispatchEvent(new Event('input'));
      });
    }
  });

  document.querySelectorAll('.stepper button').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.dataset.target;
      const step = parseInt(btn.dataset.step, 10);
      const input = document.getElementById(target);
      const min = parseInt(input.min, 10);
      const max = parseInt(input.max, 10);
      let v = parseInt(input.value, 10) || 0;
      v = clamp(v + step, min, max);
      input.value = v;
      input.dispatchEvent(new Event('input'));
    });
  });

  const toggleStateKeys = {
    kbcInsurance: 'kbcIns',
    safetyPack: 'safetyPack',
    partnerCard: 'partnerCard',
    digitalInvoice: 'digitalInvoice',
  };
  Object.keys(toggleStateKeys).forEach((id) => {
    document.getElementById(id).addEventListener('change', (e) => {
      state[toggleStateKeys[id]] = e.target.checked;
      rerender();
    });
  });
}
