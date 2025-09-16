/* =========================================================
   HubbFISCAL · Global site scripts
   - Mobile menu toggle
   - Active link sync
   - Quick search for module cards
   - Theme toggle (persisted)
   ========================================================= */
(function () {
  'use strict';

  // Mobile nav
  const nav = document.querySelector('.main-nav');
  const toggle = document.querySelector('.nav-toggle');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      const expanded = nav.getAttribute('aria-expanded') === 'true';
      nav.setAttribute('aria-expanded', String(!expanded));
      toggle.setAttribute('aria-expanded', String(!expanded));
    });
  }

  // Active link highlighting
  try {
    const here = location.pathname.split('/').filter(Boolean).pop() || 'index.html';
    document.querySelectorAll('.main-nav a').forEach(a => {
      const hrefLast = (a.getAttribute('href') || '').split('/').filter(Boolean).pop();
      if (hrefLast === here) a.classList.add('active');
    });
  } catch (e) { /* noop */ }

  // Quick search (for a grid of .card under #moduleGrid, if present)
  const search = document.getElementById('quickSearch');
  const grid = document.getElementById('moduleGrid');
  if (search && grid) {
    const cards = Array.from(grid.querySelectorAll('.card'));
    const filter = q => {
      const needle = q.trim().toLowerCase();
      cards.forEach(card => {
        const hay = (card.innerText + ' ' + (card.dataset.tags || '')).toLowerCase();
        card.style.display = hay.includes(needle) ? '' : 'none';
      });
    };
    search.addEventListener('input', e => filter(e.target.value));
  }

  // Theme toggle (dark default, persisted)
  const themeToggle = document.getElementById('themeToggle');
  if (themeToggle) {
    const KEY = 'hubbfiscal-theme';
    const root = document.documentElement;
    const apply = mode => {
      root.dataset.theme = mode;
      themeToggle.setAttribute('aria-pressed', String(mode === 'light'));
      themeToggle.textContent = mode === 'light' ? 'Dark' : 'Light';
      if (mode === 'light') {
        root.style.setProperty('--bg', '#f5faf7');
        root.style.setProperty('--panel', '#ffffff');
        root.style.setProperty('--card', '#ffffff');
        root.style.setProperty('--ink', '#14271e');
        root.style.setProperty('--muted', '#476457');
      } else {
        root.style.removeProperty('--bg');
        root.style.removeProperty('--panel');
        root.style.removeProperty('--card');
        root.style.removeProperty('--ink');
        root.style.removeProperty('--muted');
      }
      localStorage.setItem(KEY, mode);
    };
    const saved = localStorage.getItem(KEY);
    apply(saved === 'light' ? 'light' : 'dark');
    themeToggle.addEventListener('click', () => {
      const next = (root.dataset.theme === 'light') ? 'dark' : 'light';
      apply(next);
    });
  }
})();

/* =========================================================
   HubbTIME Module (runs only on pages that include #hubbtimeContainer)
   ========================================================= */
window.HubbTIME = (function () {
  'use strict';

  const container = document.getElementById('hubbtimeContainer');
  const api = {};
  if (!container) return api;

  // ---- Config ----
  const FLOW_URL = "https://prod-58.usgovtexas.logic.azure.us:443/workflows/ceefc1e6e256421c9a5a83416ff6c167/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=lh1qRrhhVYUZ3ZhxuPpHYJPsdhdMmZDRSDndshkjiB0";
  const NOTIFY   = ["admin@hubbardstonma.gov", "accountant@hubbardstonma.gov"];

  // ---- State ----
  let currentEmployee = null;
  let currentWarrant = null;

  // ---- Utils ----
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const currency = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
  const toNum = v => {
    const n = parseFloat(String(v).replace(/,/g, ''));
    return Number.isFinite(n) ? n : 0;
  };
  const fmtHrs = n => (Math.round(n * 100) / 100).toFixed(2);
  const setMsg = (text, type='info', show=true) => {
    const el = $('#systemMsg'); if (!el) return;
    if (!show || !text) { el.style.display = 'none'; return; }
    el.className = 'alert ' + (type || 'info');
    el.textContent = text;
    el.style.display = 'block';
  };
  const timeDiffHours = (start, end) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let s = sh * 60 + sm, e = eh * 60 + em;
    if (e < s) e += 24 * 60; // overnight
    return Math.round(((e - s) / 60) * 100) / 100;
  };
  const getWeekIndex = (dateStr) => {
    if (!currentWarrant || !dateStr) return 1;
    const start = new Date(currentWarrant.start + 'T00:00:00');
    const d = new Date(dateStr + 'T00:00:00');
    const diffDays = Math.floor((d - start) / 86400000);
    return diffDays < 7 ? 1 : 2;
  };

  // ---- Data (subset shown; keep your full list) ----
  const EMPLOYEES = [
    {"name":"NATHAN BOUDREAU","department":"Administration","payType":"salary","rate":115000,"isAdmin":true,"position":"Town Administrator"},
    {"name":"PATRICIA LOWE","department":"Select Board","payType":"hourly","rate":23.38,"isAdmin":true,"position":"Executive Assistant / Cable Clerk"},
    {"name":"LEEANN E MOSES","department":"Assessors/Land Use","payType":"hourly","rate":23.38,"isAdmin":true,"position":"Administrative Services Coordinator"},
    // ... keep rest of your employees here (unchanged) ...
  ];

  const WARRANTS = [
    { number: 5, start: "2025-08-24", end: "2025-09-06", due: "2025-09-08", check: "2025-09-11" },
    { number: 6, start: "2025-09-07", end: "2025-09-20", due: "2025-09-22", check: "2025-09-25" },
    { number: 7, start: "2025-09-21", end: "2025-10-04", due: "2025-10-06", check: "2025-10-09" },
    { number: 8, start: "2025-10-05", end: "2025-10-18", due: "2025-10-20", check: "2025-10-23" }
  ];

  const DEPT_GLS = {
    "Administration": "1000-129-5100-0000",
    "Accounting": "1000-129-5100-0000",
    "Treasurer/Collector": "1000-149-5100-0000",
    "Select Board": "1000-122-5100-0000",
    "Town Clerk": "1000-161-5100-0000",
    "Assessors/Land Use": "1000-141-5100-0000",
    "Land Use": "1000-241-5100-0000",
    "Facilities / Building & Grounds": "1000-192-5100-0000",
    "Building & Maintenance": "1000-192-5100-0000",
    "IT / Communications": "1000-129-5100-0000",
    "IT/Communications": "1000-129-5100-0000",
    "Cable / PEG Access": "1000-129-5100-0000",
    "Elections": "1000-161-5100-0000",
    "Public Works": "1000-420-5100-0000",
    "Police": "1000-210-5100-0000",
    "Police/Health": "1000-210-5100-0000",
    "Fire": "1000-220-5100-0000",
    "Building": "1000-241-5100-0000",
    "Library": "1000-610-5100-0000",
    "Recreation (Grant)": "1000-129-5100-0000",
    "Senior Center / COA": "1000-541-5100-0000",
    "Senior Center": "1000-541-5100-0000",
    "Senior Center / COA (Grant)": "1000-541-5100-0000",
    "School / Regional Assessment": "1000-129-5100-0000",
    "School Debt/Capital": "1000-129-5100-0000",
    "School Transportation": "1000-129-5100-0000"
  };

  const POSITION_GLS = {
    "Town Administrator": "1000-129-5100-0000",
    "Executive Assistant / Cable Clerk": "1000-122-5100-0000",
    "Administrative Services Coordinator": "1000-141-5100-0000",
    // ... keep remaining mappings as in your file ...
  };

  const EMPLOYEE_POSITIONS = {
    "PATRICIA LOWE": [
      { title: "Executive Assistant (Select Board)", gl: "1000-122-5100-0000", rate: 23.38 },
      { title: "Library Assistant", gl: "1000-610-5100-0000", rate: 17.57 }
    ],
    "LEEANTHONY PLACEHOLDER": [], // keep structure safe if typos occur
    "LEEANN E MOSES": [
      { title: "Assessor Administrative", gl: "1000-141-5100-0000" },
      { title: "Land Use Administrative", gl: "1000-241-5100-0000" }
    ]
    // ... add others as needed ...
  };

  // ---- Bottom GL Allocation defaults (per your request) ----
  const DEFAULT_SPLITS = {
    'PATRICIA LOWE': [
      { gl: '1000-122-5100-0000', hours: 26 }, // Executive (Select Board)
      { gl: '1000-610-5100-0000', hours: 10 }  // Library
    ],
    'LEEANN E MOSES': [
      { gl: '1000-241-5100-0000', hours: 40 }, // Land Use
      { gl: '1000-141-5100-0000', hours: 32 }  // Assessing
    ]
  };

  // Employees who must ONLY use the bottom GL allocation
  const BOTTOM_GL_ONLY = new Set(['PATRICIA LOWE', 'LEEANN E MOSES']);
  const isBottomGLOnly = () =>
    currentEmployee && BOTTOM_GL_ONLY.has((currentEmployee.name || '').toUpperCase());

  // ---- Helpers for GL resolution & UI ----
  function getDefaultGL(emp) {
    if (!emp) return "";
    if (emp.position && POSITION_GLS[emp.position]) return POSITION_GLS[emp.position];
    if (DEPT_GLS[emp.department]) return DEPT_GLS[emp.department];
    return "";
  }

  function createGLInput(initialGL = '', emp = null) {
    const glDiv = document.createElement('div');
    glDiv.className = 'gl-cell';
    const glInput = document.createElement('input');
    glInput.type = 'text';
    glInput.className = 'gl-input input';
    glInput.placeholder = 'GL code';
    glInput.value = initialGL || getDefaultGL(emp);
    glInput.autocomplete = 'off';
    glDiv.appendChild(glInput);

    if (emp && EMPLOYEE_POSITIONS[emp.name] && EMPLOYEE_POSITIONS[emp.name].length) {
      const glChooser = document.createElement('select');
      glChooser.className = 'gl-chooser input';
      glChooser.style.marginTop = 'var(--space-xs)';
      const def = document.createElement('option');
      def.value = ''; def.textContent = 'Quick select role...';
      glChooser.appendChild(def);
      EMPLOYEE_POSITIONS[emp.name].forEach(p => {
        const o = document.createElement('option');
        o.value = p.gl; o.textContent = p.title;
        glChooser.appendChild(o);
      });
      glChooser.addEventListener('change', function () {
        if (this.value) glInput.value = this.value;
      });
      glDiv.appendChild(glChooser);
    }
    return glDiv;
  }

  function reseedBlankRowGLs() {
    if (isBottomGLOnly()) return; // DO NOT seed per-row GL for Patricia/Leeanne
    const rows = Array.from(document.querySelectorAll('#timeBody tr'));
    const def = getDefaultGL(currentEmployee);
    rows.forEach(r => {
      const glIn = r.querySelector('.gl-input');
      if (glIn && !glIn.value && def) glIn.value = def;
    });
  }

  // ---- Bottom GL Allocation module (reads/writes table with IDs) ----
  const glAllocation = (function(){
    const body = document.getElementById('glSplitBody');
    const addBtn = document.getElementById('addGLSplitBtn');
    const fill100Btn = document.getElementById('fill100Btn');
    const allocatedHoursEl = document.getElementById('allocatedHours');
    const allocatedPctEl = document.getElementById('allocatedPct');
    const totalHoursEl = document.getElementById('totalHours');

    let glSplits = []; // [{gl, hours, pct}]

    const render = () => {
      if (!body) return;
      body.innerHTML = '';
      glSplits.forEach((row, i) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><input class="gl-code input" placeholder="GL code" value="${row.gl || ''}"></td>
          <td><input class="gl-hours input" type="number" min="0" step="0.01" value="${row.hours ?? ''}"></td>
          <td><input class="gl-pct input" type="number" min="0" step="0.01" value="${row.pct ?? ''}"></td>
          <td><button type="button" class="btn link danger gl-del">Remove</button></td>
        `;
        body.appendChild(tr);

        const syncAndRecalc = (src) => {
          const hoursEl = tr.querySelector('.gl-hours');
          const pctEl = tr.querySelector('.gl-pct');
          const codeEl = tr.querySelector('.gl-code');
          const total = toNum(totalHoursEl?.textContent || 0);

          let hoursVal = toNum(hoursEl.value);
          let pctVal = toNum(pctEl.value);

          if (src === 'hrs') {
            pctVal = total > 0 ? (hoursVal / total) * 100 : 0;
            pctEl.value = fmtHrs(pctVal);
          } else if (src === 'pct') {
            hoursVal = (pctVal / 100) * total;
            hoursEl.value = fmtHrs(hoursVal);
          }

          glSplits[i] = { gl: codeEl.value.trim(), hours: toNum(hoursEl.value), pct: toNum(pctEl.value) };
          recalcAllocated();
        };

        tr.querySelector('.gl-hours').addEventListener('input', () => syncAndRecalc('hrs'));
        tr.querySelector('.gl-pct').addEventListener('input', () => syncAndRecalc('pct'));
        tr.querySelector('.gl-code').addEventListener('input', () => syncAndRecalc());
        tr.querySelector('.gl-del').addEventListener('click', () => { glSplits.splice(i,1); render(); recalcAllocated(); });
      });
      recalcAllocated();
    };

    const recalcAllocated = () => {
      const total = toNum(totalHoursEl?.textContent || 0);
      const hours = glSplits.reduce((a,b)=> a + toNum(b.hours), 0);
      const pct = total > 0 ? (hours / total) * 100 : 0;
      if (allocatedHoursEl) allocatedHoursEl.textContent = fmtHrs(hours);
      if (allocatedPctEl) allocatedPctEl.textContent = Math.round(pct) + '%';
    };

    const addRow = (row = { gl:'', hours:'', pct:'' }) => { glSplits.push(row); render(); };
    const setRows = (rows) => { glSplits = rows.map(r => ({ gl:r.gl, hours:toNum(r.hours), pct:toNum(r.pct) })); render(); };
    const updateFromTotal = () => {
      const total = toNum(totalHoursEl?.textContent || 0);
      glSplits = glSplits.map(r => {
        if ((r.pct || r.pct === 0) && (r.hours === '' || r.hours == null) && total) {
          return { ...r, hours: (toNum(r.pct) / 100) * total };
        }
        if ((r.hours || r.hours === 0) && (r.pct === '' || r.pct == null) && total) {
          return { ...r, pct: total ? (toNum(r.hours) / total) * 100 : 0 };
        }
        return r;
      });
      render();
    };

    addBtn?.addEventListener('click', () => addRow());
    fill100Btn?.addEventListener('click', () => {
      const total = toNum(totalHoursEl?.textContent || 0);
      if (!total) { setMsg('Enter time rows first so we know total hours.', 'warn', true); return; }
      if (!glSplits.length) addRow();
      glSplits[0] = { gl: glSplits[0].gl || '', hours: total, pct: 100 };
      render();
    });

    return {
      setRows, addRow, updateFromTotal,
      getRows: () => glSplits.slice(),
      isBalanced: () => Math.abs(toNum(allocatedHoursEl?.textContent || 0) - toNum(totalHoursEl?.textContent || 0)) < 0.01
    };
  })();

  // Keep bottom allocation synced when totals change
  const totalHoursElObserverTarget = document.getElementById('totalHours');
  if (totalHoursElObserverTarget) {
    const observer = new MutationObserver(() => glAllocation.updateFromTotal());
    observer.observe(totalHoursElObserverTarget, { childList: true });
  }

  // ---- DOM init ----
  window.addEventListener('DOMContentLoaded', () => {
    // Employees datalist
    const dl = $('#employeeList');
    if (dl) {
      dl.innerHTML = '';
      EMPLOYEES.forEach((emp, i) => {
        const o = document.createElement('option');
        o.value = emp.name;
        o.setAttribute('data-index', String(i));
        dl.appendChild(o);
      });
    }

    // Warrant select
    const wsel = $('#warrant');
    if (wsel) {
      wsel.innerHTML = '<option value="">Select Pay Period…</option>';
      WARRANTS.forEach((w, i) => {
        const o = document.createElement('option');
        o.value = String(i);
        o.textContent = `Warrant #${w.number} — ${w.start} to ${w.end} — Due ${w.due}`;
        wsel.appendChild(o);
      });
    }

    // Bind events
    $('#employeeSearch')?.addEventListener('change', (e) => {
      handleEmployee(e);

      // === Auto-seed bottom GL for everyone ===
      const nameU = (e.target.value || '').trim().toUpperCase();
      if (DEFAULT_SPLITS[nameU]) {
        // Use predefined hour splits for Patty/Leeanne
        glAllocation.setRows(DEFAULT_SPLITS[nameU]);
      } else {
        // Seed single 100% row with their default GL
        const gl = getDefaultGL(currentEmployee);
        glAllocation.setRows([{ gl, pct: 100, hours: '' }]);
      }
      glAllocation.updateFromTotal();

      const details = $('#employeeDetails');
      if (details && currentEmployee) details.style.display = 'block';
    });

    $('#clearEmployeeBtn')?.addEventListener('click', () => {
      clearEmployee();
      const details = $('#employeeDetails');
      if (details) details.style.display = 'none';
    });

    $('#warrant')?.addEventListener('change', handleWarrant);
    $('#addRowBtn')?.addEventListener('click', () => addTimeRow());
    $('#clearAllBtn')?.addEventListener('click', clearAllRows);
    $('#townHallBtn')?.addEventListener('click', addTownHallHours);
    $('#splitShiftBtn')?.addEventListener('click', () => { addTimeRow(); setMsg('New row added for split shift.', 'success', true); });
    $('#overtimeBtn')?.addEventListener('click', addOvertimeDay);
    $('#sickBtn')?.addEventListener('click', addSickDay);
    $('#vacationBtn')?.addEventListener('click', addVacationDay);
    $('#personalBtn')?.addEventListener('click', () => addQuickDay('Personal', 'Personal Day', '8.00'));
    $('#holidayBtn')?.addEventListener('click', () => addQuickDay('Holiday', 'Holiday', '8.00'));
    $('#timesheetForm')?.addEventListener('submit', handleSubmit);

    // Enter advances fields in the table
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target && ev.target.matches && ev.target.matches('#timeBody input, #timeBody select')) {
        ev.preventDefault();
        const fields = Array.from(document.querySelectorAll('#timeBody input, #timeBody select'));
        const idx = fields.indexOf(ev.target);
        if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus();
      }
    });

    // Initial state
    calculateTotals();
    setMsg("System loaded. Select an employee to begin.", "info", true);
  });

  // ---- Handlers ----
  function handleEmployee(e) {
    const name = (e.target.value || '').trim();
    const emp = EMPLOYEES.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!emp) return;
    currentEmployee = emp;

    const idxEl = $('#employeeIndex'); if (idxEl) idxEl.value = String(EMPLOYEES.indexOf(emp));
    $('#department') && ($('#department').textContent = emp.department || '—');
    $('#payType') && ($('#payType').textContent = emp.payType ? (emp.payType[0].toUpperCase() + emp.payType.slice(1)) : '—');
    const rate = $('#rate');
    if (rate) {
      rate.textContent = emp.payType === 'salary'
        ? (emp.rate ? (currency(emp.rate) + ' annually') : '—')
        : (emp.rate ? (currency(emp.rate) + ' per hour') : '—');
    }
    reseedBlankRowGLs();
    calculateTotals();
  }

  function clearEmployee() {
    currentEmployee = null;
    ['employeeIndex','employeeSearch'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    ['department','payType','rate'].forEach(id => { const el = document.getElementById(id); if (el) el.textContent = '—'; });
    glAllocation.setRows([]); // clear bottom splits
    calculateTotals();
  }

  function handleWarrant(e) {
    const idx = e.target.value;
    currentWarrant = (idx === '') ? null : WARRANTS[Number(idx)];
    calculateTotals();
  }

  // ---- Table rows ----
  function addTimeRow() {
    const seedGL = getDefaultGL(currentEmployee);
    addTimeRowWith('', '', '', '', 'Regular', seedGL, '');
  }

  function addTimeRowWith(date, start, end, hours, type, glCode, description) {
    const tbody = $('#timeBody'); if (!tbody) return;

    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><input type="date" class="date-cell input" value="${date || ''}"></td>
       <td><input type="time" class="time-start input" value="${start || ''}"></td>
       <td><input type="time" class="time-end input" value="${end || ''}"></td>
       <td><input type="number" step="0.25" min="0" placeholder="0.00" class="time-hours input" value="${hours || ''}"></td>
       <td>
         <select class="time-type input">
           <option${type==='Regular'?' selected':''}>Regular</option>
           <option${type==='Sick'?' selected':''}>Sick</option>
           <option${type==='Personal'?' selected':''}>Personal</option>
           <option${type==='Vacation'?' selected':''}>Vacation</option>
           <option${type==='Holiday'?' selected':''}>Holiday</option>
         </select>
       </td>
       <td></td>
       <td><input type="text" class="input" placeholder="Describe work or leave" value="${description || ''}"></td>
       <td>
         <div style="display:flex; gap:4px; flex-wrap:wrap;">
           <button type="button" class="btn secondary insert-above" style="font-size:12px; padding:2px 6px;">↑ Above</button>
           <button type="button" class="btn secondary insert-below" style="font-size:12px; padding:2px 6px;">↓ Below</button>
           <button type="button" class="btn danger remove-row" style="font-size:12px; padding:2px 6px;">Remove</button>
         </div>
       </td>`;

    // Per-row GL hidden/ignored for Patricia & Leeanne
    const glCell = tr.children[5];
    if (isBottomGLOnly()) {
      glCell.innerHTML = '<span class="text-muted">Bottom allocation</span>';
      glCell.dataset.ignoreGl = 'true';
    } else {
      const glInput = createGLInput(glCode || getDefaultGL(currentEmployee), currentEmployee);
      glCell.appendChild(glInput);
    }

    tbody.appendChild(tr);

    if (start && end && type === 'Regular') {
      tr.querySelector('.time-hours').value = timeDiffHours(start, end).toFixed(2);
    }

    wireRowEvents(tr);
    return tr;
  }

  function wireRowEvents(tr) {
    tr.querySelector('.remove-row').addEventListener('click', () => { tr.remove(); calculateTotals(); });

    tr.querySelector('.insert-above').addEventListener('click', () => {
      const newRow = document.createElement('tr');
      newRow.innerHTML = tr.innerHTML;

      // Rebuild GL cell properly
      const glCell = newRow.children[5];
      glCell.innerHTML = '';
      if (isBottomGLOnly()) {
        glCell.innerHTML = '<span class="text-muted">Bottom allocation</span>';
        glCell.dataset.ignoreGl = 'true';
      } else {
        const priorGL = tr.querySelector('.gl-input')?.value || getDefaultGL(currentEmployee);
        const glInput = createGLInput(priorGL, currentEmployee);
        glCell.appendChild(glInput);
      }

      tr.parentNode.insertBefore(newRow, tr);
      wireRowEvents(newRow);
      calculateTotals();
    });

    tr.querySelector('.insert-below').addEventListener('click', () => {
      const newRow = document.createElement('tr');
      newRow.innerHTML = tr.innerHTML;

      const glCell = newRow.children[5];
      glCell.innerHTML = '';
      if (isBottomGLOnly()) {
        glCell.innerHTML = '<span class="text-muted">Bottom allocation</span>';
        glCell.dataset.ignoreGl = 'true';
      } else {
        const priorGL = tr.querySelector('.gl-input')?.value || getDefaultGL(currentEmployee);
        const glInput = createGLInput(priorGL, currentEmployee);
        glCell.appendChild(glInput);
      }

      tr.parentNode.insertBefore(newRow, tr.nextSibling);
      wireRowEvents(newRow);
      calculateTotals();
    });

    tr.querySelectorAll('input, select').forEach(inp => {
      inp.addEventListener('input', function () {
        const rowType = tr.querySelector('.time-type')?.value || 'Regular';
        if ((this.classList.contains('time-start') || this.classList.contains('time-end')) && rowType === 'Regular') {
          const s = tr.querySelector('.time-start')?.value || '';
          const e = tr.querySelector('.time-end')?.value || '';
          if (s && e) tr.querySelector('.time-hours').value = timeDiffHours(s, e).toFixed(2);
        }
        calculateTotals();
      });
    });
  }

  function clearAllRows() {
    const tb = $('#timeBody'); if (tb) tb.innerHTML = '';
    calculateTotals();
  }

  // ---- Supplemental Quick Buttons ----
  function addQuickDay(kind, label, defaultHours = '8.00') {
    if (!currentEmployee) { setMsg('Please select an employee first.', 'error', true); return; }
    const today = new Date().toISOString().slice(0, 10);
    const gl = getDefaultGL(currentEmployee);
    addTimeRowWith(today, '', '', defaultHours, kind, gl, label);
    calculateTotals();
    setMsg(`${label} added.`, 'success', true);
  }
  function addOvertimeDay() { addQuickDay('Regular', 'Overtime Day', '10.00'); }
  function addSickDay()     { addQuickDay('Sick', 'Sick Day', '8.00'); }
  function addVacationDay() { addQuickDay('Vacation', 'Vacation Day', '8.00'); }

  function addTownHallHours() {
    if (!currentWarrant) { setMsg("Select a pay period first.", "info", true); return; }
    clearAllRows();
    const start = new Date(currentWarrant.start + 'T00:00:00');
    const end   = new Date(currentWarrant.end   + 'T00:00:00');
    const schedule = { 1:{start:"08:00",end:"16:00"}, 2:{start:"08:00",end:"18:00"}, 3:{start:"08:00",end:"16:00"}, 4:{start:"08:00",end:"16:00"} };
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (schedule[dow]) {
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        addTimeRowWith(iso, schedule[dow].start, schedule[dow].end, '', 'Regular', getDefaultGL(currentEmployee), 'Town Hall hours');
      }
    }
    calculateTotals();
    setMsg(`Town Hall hours applied for ${currentWarrant.start} to ${currentWarrant.end}.`, "success", true);
  }

  // ---- GL Review: prefer bottom allocation if balanced; else per-row ----
  function updateGLReview() {
    const reviewWrap = $('#glReviewWrap');
    if (!reviewWrap) return;

    const useBottom = glAllocation.getRows().length && glAllocation.isBalanced();

    let glBreakdown = {};
    if (useBottom) {
      glAllocation.getRows().forEach(r => {
        const gl = r.gl || '';
        const h = toNum(r.hours);
        if (!gl || !h) return;
        if (!glBreakdown[gl]) glBreakdown[gl] = { regular: 0, sick: 0, personal: 0, vacation: 0, holiday: 0, total: 0 };
        glBreakdown[gl].regular += h; // treat as overall total
        glBreakdown[gl].total += h;
      });
    } else {
      const rows = Array.from(document.querySelectorAll('#timeBody tr'));
      rows.forEach(row => {
        const hours = toNum(row.querySelector('.time-hours')?.value || 0);
        const type = row.querySelector('.time-type')?.value || 'Regular';
        const glCell = row.children[5];
        const ignore = glCell && glCell.dataset && glCell.dataset.ignoreGl === 'true';
        const gl = ignore ? '' : (row.querySelector('.gl-input')?.value || '');
        if (hours > 0 && gl) {
          if (!glBreakdown[gl]) glBreakdown[gl] = { regular: 0, sick: 0, personal: 0, vacation: 0, holiday: 0, total: 0 };
          glBreakdown[gl][type.toLowerCase()] += hours;
          glBreakdown[gl].total += hours;
        }
      });
    }

    if (!Object.keys(glBreakdown).length) {
      reviewWrap.innerHTML = `<p class="text-center text-muted" style="padding:var(--space-xl);">Enter time entries (and/or GL allocation below) to see cost allocation.</p>`;
      return;
    }

    let costCalculation = '';
    if (currentEmployee && currentEmployee.rate) {
      costCalculation = currentEmployee.payType === 'hourly' 
        ? `<th>Regular Cost</th><th>Overtime Cost</th><th>Leave Cost</th><th>Total Cost</th>`
        : `<th>Salary Allocation</th>`;
    }

    let html = `
      <div class="tableWrap">
        <table>
          <thead>
            <tr>
              <th>GL Code</th>
              <th>Regular</th>
              <th>Sick</th>
              <th>Personal</th>
              <th>Vacation</th>
              <th>Holiday</th>
              <th>Total Hours</th>
              ${costCalculation}
            </tr>
          </thead>
          <tbody>`;

    Object.entries(glBreakdown).forEach(([gl, b]) => {
      let costCells = '';
      if (currentEmployee && currentEmployee.rate) {
        if (currentEmployee.payType === 'hourly') {
          let rate = currentEmployee.rate;
          if (currentEmployee.name && EMPLOYEE_POSITIONS[currentEmployee.name]) {
            const role = EMPLOYEE_POSITIONS[currentEmployee.name].find(pos => pos.gl === gl && pos.rate);
            if (role) rate = role.rate;
          }
          const regularCost = b.regular * rate;
          const overtimeCost = 0; // weekly OT split not modeled
          const leaveCost = (b.sick + b.personal + b.vacation + b.holiday) * rate;
          const totalCost = regularCost + overtimeCost + leaveCost;
          costCells = `
            <td>${currency(regularCost)}</td>
            <td>${currency(overtimeCost)}</td>
            <td>${currency(leaveCost)}</td>
            <td><strong>${currency(totalCost)}</strong></td>`;
        } else {
          const total = Object.values(glBreakdown).reduce((sum, x) => sum + x.total, 0);
          const allocation = total > 0 ? (b.total / total) * (currentEmployee.rate / 26) : 0;
          costCells = `<td><strong>${currency(allocation)}</strong></td>`;
        }
      }

      html += `
        <tr>
          <td><strong>${gl}</strong></td>
          <td>${fmtHrs(b.regular)}</td>
          <td>${fmtHrs(b.sick)}</td>
          <td>${fmtHrs(b.personal)}</td>
          <td>${fmtHrs(b.vacation)}</td>
          <td>${fmtHrs(b.holiday)}</td>
          <td><strong>${fmtHrs(b.total)}</strong></td>
          ${costCells}
        </tr>`;
    });

    html += `</tbody></table></div>`;
    reviewWrap.innerHTML = html;
  }

  // ---- Totals & Pay ----
  function calculateTotals() {
    let totalHours = 0, reg = 0, sick = 0, pers = 0, vac = 0, hol = 0;
    let w1Reg = 0, w2Reg = 0;

    const rows = Array.from(document.querySelectorAll('#timeBody tr'));
    rows.forEach(row => {
      const date = row.querySelector('.date-cell')?.value || '';
      const hours = toNum(row.querySelector('.time-hours')?.value || 0);
      const type = row.querySelector('.time-type')?.value || 'Regular';
      if (!hours) return;
      totalHours += hours;
      if (type === 'Regular') {
        reg += hours;
        const wk = getWeekIndex(date);
        if (wk === 1) w1Reg += hours; else w2Reg += hours;
      } else if (type === 'Sick') sick += hours;
      else if (type === 'Personal') pers += hours;
      else if (type === 'Vacation') vac += hours;
      else if (type === 'Holiday') hol += hours;
    });

    // Overtime (hourly only): weekly Regular > 40 within warrant
    let overtime = 0;
    let regPayable = reg;
    if (currentEmployee && currentEmployee.payType === 'hourly') {
      const w1OT = Math.max(0, w1Reg - 40);
      const w2OT = Math.max(0, w2Reg - 40);
      overtime = w1OT + w2OT;
      regPayable = Math.max(0, reg - overtime);
    }

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = fmtHrs(v); };
    setTxt('totalHours', totalHours);
    setTxt('sumRegular', regPayable);
    setTxt('sumSick', sick);
    setTxt('sumPersonal', pers);
    setTxt('sumVacation', vac);
    setTxt('sumHoliday', hol);

    // Pay calculation
    let gross = 0;
    if (currentEmployee && currentEmployee.rate) {
      if (currentEmployee.payType === 'hourly') {
        const hasRoleRates = currentEmployee.name && EMPLOYEE_POSITIONS[currentEmployee.name] && EMPLOYEE_POSITIONS[currentEmployee.name].some(p => p.rate);
        if (hasRoleRates) {
          let totalPay = 0;
          rows.forEach(row => {
            const hours = toNum(row.querySelector('.time-hours')?.value || 0);
            const glCell = row.children[5];
            const ignore = glCell && glCell.dataset && glCell.dataset.ignoreGl === 'true';
            const gl = ignore ? '' : (row.querySelector('.gl-input')?.value || '');
            if (!hours) return;
            const role = EMPLOYEE_POSITIONS[currentEmployee.name].find(p => p.gl === gl);
            const rate = role && role.rate ? role.rate : currentEmployee.rate;
            totalPay += hours * rate; // OT not computed per-GL here
          });
          gross = totalPay;
        } else {
          const r = currentEmployee.rate;
          const regPay = regPayable * r;
          const otPay  = overtime * r * 1.5;
          const leavePay = (sick + pers + vac + hol) * r;
          gross = regPay + otPay + leavePay;
        }
      } else if (currentEmployee.payType === 'salary') {
        gross = currentEmployee.rate / 26; // biweekly
      }
    }
    $('#grossPay') && ($('#grossPay').textContent = currency(gross));

    glAllocation.updateFromTotal();
    updateGLReview();
  }

  // ---- Submit ----
  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentEmployee) { setMsg("Please select an employee.", "error", true); return; }
    if (!currentWarrant)  { setMsg("Please select a pay period.", "error", true); return; }

    // Require bottom GL only for Patricia/Leeanne
    if (isBottomGLOnly() && !glAllocation.isBalanced()) {
      setMsg('Use the GL Allocation at the bottom and make it equal to Total Hours for this employee.', 'danger', true);
      return;
    }

    // Build entries from rows
    const entries = [];
    const rows = Array.from(document.querySelectorAll('#timeBody tr'));
    rows.forEach(row => {
      const date = row.querySelector('.date-cell')?.value || '';
      const start= row.querySelector('.time-start')?.value || '';
      const end  = row.querySelector('.time-end')?.value || '';
      const hours= toNum(row.querySelector('.time-hours')?.value || 0);
      const type = row.querySelector('.time-type')?.value || 'Regular';
      const glCell = row.children[5];
      const ignore = glCell && glCell.dataset && glCell.dataset.ignoreGl === 'true';
      const gl   = ignore ? '' : (row.querySelector('.gl-input')?.value || '');
      const desc = row.children[6]?.querySelector('input')?.value || '';
      if (date && hours > 0) {
        entries.push({ date, start, end, hours, type, gl, description: desc });
      }
    });
    if (!entries.length) { setMsg("Add at least one time entry.", "error", true); return; }

    // Totals
    const totals = {
      totalHours: toNum(document.getElementById('totalHours')?.textContent || 0),
      regularHours: toNum(document.getElementById('sumRegular')?.textContent || 0),
      sickHours: toNum(document.getElementById('sumSick')?.textContent || 0),
      personalHours: toNum(document.getElementById('sumPersonal')?.textContent || 0),
      vacationHours: toNum(document.getElementById('sumVacation')?.textContent || 0),
      holidayHours: toNum(document.getElementById('sumHoliday')?.textContent || 0),
      grossPay: document.getElementById('grossPay')?.textContent || "$0.00"
    };

    // Prefer bottom GL allocation if present & balanced; else roll up per-row GLs
    let gl_allocation = [];
    if (glAllocation.getRows().length && glAllocation.isBalanced()) {
      gl_allocation = glAllocation.getRows()
        .filter(r => r.gl && toNum(r.hours) > 0)
        .map(r => ({ gl: r.gl, hours: toNum(r.hours), pct: toNum(r.pct) }));
    } else {
      // fallback: per-row rollup (works for everyone else)
      const roll = {};
      entries.forEach(en => {
        if (!en.gl) return;
        roll[en.gl] = (roll[en.gl] || 0) + en.hours;
      });
      gl_allocation = Object.entries(roll).map(([gl, hours]) => ({
        gl, hours, pct: totals.totalHours ? (hours / totals.totalHours) * 100 : 0
      }));
    }

    const payload = {
      meta: { submittedAt: new Date().toISOString(), notify: NOTIFY, source: "HubbTIME (HubbFISCAL)" },
      employee: {
        name: currentEmployee.name,
        department: currentEmployee.department,
        payType: currentEmployee.payType,
        rate: currentEmployee.rate,
        position: currentEmployee.position || null
      },
      warrant: currentWarrant,
      entries,
      gl_allocation,
      totals
    };

    const btn = document.getElementById('submitBtn');
    const status = document.getElementById('submitStatus');
    try {
      if (btn) btn.disabled = true;
      if (status) status.textContent = 'Sending to payroll…';
      setMsg('Submitting timesheet…', 'info', true);

      const res = await fetch(FLOW_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error('Submission failed with status ' + res.status);

      setMsg('Timesheet submitted successfully.', 'success', true);
      if (status) status.textContent = 'Submitted ✔';
    } catch (err) {
      console.error(err);
      setMsg('Error submitting timesheet: ' + err.message, 'error', true);
      if (status) status.textContent = 'There was a problem submitting. Please try again.';
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  // ---- Public API ----
  api.addRow = addTimeRow;
  api.addRowWith = addTimeRowWith;
  api.recalc = calculateTotals;
  api.defaultGL = getDefaultGL;
  api.getCurrentEmployee = () => currentEmployee;
  api.addTownHallHours = addTownHallHours;
  api.addOvertimeDay = addOvertimeDay;
  api.addSickDay = addSickDay;
  api.addVacationDay = addVacationDay;
  api.updateGLReview = updateGLReview;

  return api;
})();
