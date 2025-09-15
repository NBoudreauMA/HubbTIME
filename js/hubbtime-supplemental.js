/* =========================================================
   HubbTIME · Supplemental actions (uses public hooks)
   - Requires the main HubbTIME script to load first
   ========================================================= */
(function () {
  'use strict';

  function $ (s) { return document.querySelector(s); }

  function getLastRow() {
    const tbody = document.getElementById('timeBody');
    return tbody ? tbody.lastElementChild : null;
  }

  function hhmmToMin(hhmm) {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  }
  function minToHHMM(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  }

  // Split the **last** row into two equal time blocks
  function addSplitShift() {
    const last = getLastRow();
    if (!last) return alert('No row to split.');

    const date  = last.querySelector('.date-cell')?.value || '';
    const start = last.querySelector('.time-start')?.value || '';
    const end   = last.querySelector('.time-end')?.value || '';
    const type  = last.querySelector('.time-type')?.value || 'Regular';
    if (!date || !start || !end) return alert('Select date/start/end on the last row first.');
    if (type !== 'Regular') return alert('Split Shift expects a Regular row.');

    const s = hhmmToMin(start), e = hhmmToMin(end);
    if (s == null || e == null || e <= s) return alert('Invalid time range.');

    const mid = Math.floor((s + e) / 2);
    const gl  = ($('datalist#glList option')?.value) || (window.HubbTIME?.defaultGL?.(null) || '');

    // Remove last row and add two rows in its place
    last.remove();
    window.HubbTIME.addRowWith(date, start, minToHHMM(mid), '', 'Regular', gl, 'Split Shift (1/2)');
    window.HubbTIME.addRowWith(date, minToHHMM(mid), end, '', 'Regular', gl, 'Split Shift (2/2)');
    window.HubbTIME.recalc();
  }

  function addDay(kind, label) {
    const today = new Date().toISOString().slice(0,10);
    const gl = ($('datalist#glList option')?.value) || (window.HubbTIME?.defaultGL?.(null) || '');
    const type = kind; // 'Regular' | 'Sick' | 'Vacation'
    const desc = label;
    const hours = (kind === 'Regular') ? '8.00' : '8.00'; // adjust if you use other defaults
    window.HubbTIME.addRowWith(today, '', '', hours, type, gl, desc);
    window.HubbTIME.recalc();
  }

  function addOvertimeDay() { addDay('Regular',  'Overtime Day'); }
  function addSickDay()     { addDay('Sick',     'Sick Day'); }
  function addVacationDay() { addDay('Vacation', 'Vacation Day'); }

  // Bind after DOM & main script are ready
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.HubbTIME || !window.HubbTIME.addRowWith) {
      console.error('HubbTIME hooks not found. Ensure main script exposes api.addRowWith, api.recalc, api.defaultGL.');
      return;
    }
    const split = $('#splitShiftBtn');  if (split) split.addEventListener('click', addSplitShift);
    const ot    = $('#overtimeBtn');    if (ot)    ot.addEventListener('click', addOvertimeDay);
    const sick  = $('#sickBtn');        if (sick)  sick.addEventListener('click', addSickDay);
    const vac   = $('#vacationBtn');    if (vac)   vac.addEventListener('click', addVacationDay);
  });
})();
