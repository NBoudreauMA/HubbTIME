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
  const api = { addTownHallHours: () => {} };
  if (!container) return api;

  // ---- Config ----
  const FLOW_URL = "https://prod-58.usgovtexas.logic.azure.us:443/workflows/ceefc1e6e256421c9a5a83416ff6c167/triggers/manual/paths/invoke?api-version=2016-06-01&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=lh1qRrhhVYUZ3ZhxuPpHYJPsdhdMmZDRSDndshkjiB0";
  const NOTIFY   = ["admin@hubbardstonma.gov", "accountant@hubbardstonma.gov"];

  // ---- State ----
  let currentEmployee = null;
  let currentWarrant = null;

  // ---- Utils ----
  const $ = s => document.querySelector(s);
  const currency = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(Number(n || 0));
  const setMsg = (text, type, show) => {
    const el = $('#systemMsg'); if (!el) return;
    if (!show) { el.style.display = 'none'; return; }
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

  // ---- Data (complete roster you provided) ----
  const EMPLOYEES = [
    {"name":"ALBERT AFONSO","department":"School / Regional Assessment","payType":"hourly","rate":16.13,"isAdmin":false,"position":"MART Driver"},
    {"name":"NANCY AFONSO","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"RICHARD J ANDERSON","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ERIK ARES","department":"Fire","payType":"hourly","rate":23.12,"isAdmin":false,"position":"Call LT/Paramedic"},
    {"name":"JAMES ARES","department":"Fire","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"CHRISTINE BARBERA","department":"Library","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"BETTY BEGIN","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"DONALD BLOOD","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"NATHAN BOUDREAU","department":"Administration","payType":"salary","rate":115000,"isAdmin":true,"position":"Town Administrator"},
    {"name":"DANIEL BOURGEOIS","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"DAVID BOWLEY","department":"School / Regional Assessment","payType":"hourly","rate":16.13,"isAdmin":false,"position":"MART Driver"},
    {"name":"ROBERT BRADY","department":"Public Works","payType":"hourly","rate":16.89,"isAdmin":false,"position":"DPW Seasonal"},
    {"name":"RICHARD BREAGY","department":"School / Regional Assessment","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"SUSAN BREAGY","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ANDREW BRESCIANI","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"TRAVIS BROWN","department":"Public Works","payType":"salary","rate":94369,"isAdmin":false,"position":"DPW Director"},
    {"name":"MICHAEL CAPPS","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"TROY CASEY","department":"Fire","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ROBERT CHAMPAGNE","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"SAMANTHA CHATTERTON","department":"Accounting","payType":"salary","rate":33800,"isAdmin":true,"position":"Town Accountant"},
    {"name":"BRYAN COLWELL","department":"Fire","payType":"hourly","rate":17.84,"isAdmin":false,"position":"Call Firefighter"},
    {"name":"JEANNINE COMO","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"JULIA CONNERY","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ANTHONY T. COPPOLA","department":"School Transportation","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ELIZABETH CORMIER","department":"Cable / PEG Access","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"RYAN COUTURE","department":"Police","payType":"salary","rate":105000,"isAdmin":true,"position":"Chief of Police"},
    {"name":"BRIAN CUNNINGHAM","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"JOHN DEMALIA","department":"Fire","payType":"hourly","rate":18.84,"isAdmin":false,"position":"Call Firefighter/EMT"},
    {"name":"TREVOR DION","department":"Fire","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"TINA DIXSON","department":"Fire","payType":"hourly","rate":22.22,"isAdmin":false,"position":"Firefighter/AEMT"},
    {"name":"JAMES F DIXSON","department":"Fire","payType":"hourly","rate":24.67,"isAdmin":false,"position":"Call LT/EMT"},
    {"name":"WILLIAM DOANE","department":"Cable / PEG Access","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"KAYLA FONTAINE","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ROBERT FORTE","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"EDWARD GALLANT","department":"School / Regional Assessment","payType":"hourly","rate":16.13,"isAdmin":false,"position":"MART Driver"},
    {"name":"ERIC GEMBORYS","department":"IT / Communications","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ANNE GOEWEY","department":"Library","payType":"hourly","rate":17.57,"isAdmin":true,"position":"Library Assistant"},
    {"name":"NEIL GOGUEN","department":"Public Works","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"GREGORY GOLDSMITH","department":"School Debt/Capital","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"IZAIAH GONZALEZ","department":"Fire","payType":"hourly","rate":15.93,"isAdmin":false,"position":"Call Firefighter"},
    {"name":"JEREMY GOSCILA","department":"Fire","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"EDWARD GOSSON","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"WENDY GOSSON","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"JOYCE GREEN","department":"Elections","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"RICHARD GREEN","department":"Facilities / Building & Grounds","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"MELODY GREEN","department":"Town Clerk","payType":"salary","rate":56610,"isAdmin":true,"position":"Town Clerk"},
    {"name":"JAMES HALKOLA","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"DENNIS HAMEL","department":"Fire","payType":"hourly","rate":23.30,"isAdmin":false,"position":"Firefighter/Paramedic"},
    {"name":"SHARON HARDAKER","department":"School / Regional Assessment","payType":"hourly","rate":18.92,"isAdmin":false,"position":"MART Supervisor"},
    {"name":"LEROY HAWKINS","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ROBERT HAYES","department":"Fire","payType":"salary","rate":100500,"isAdmin":false,"position":"Fire Chief"},
    {"name":"KENNETH HORVATH","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"JOHN HULETTE","department":"Fire","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"WENDY ISGRO","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"LINDA JENESKI","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"STANLEY JOHNSON","department":"School / Regional Assessment","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ROBERT JOHNSON","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"BELLA KALDERA","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"WILLIAM KAMATARIS","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"BEVERLY KOHLSTROM","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"MICHAEL LABELLE","department":"Public Works","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"RENE LAFAYETTE","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"PATRICIA LAMOUREUX","department":"Cable / PEG Access","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ROBERT LANCIANI","department":"Building","payType":"salary","rate":42734,"isAdmin":true,"position":"Building Commissioner"},
    {"name":"SHONNA LARSON","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"MARY LEROUX","department":"Treasurer/Collector","payType":"salary","rate":70914,"isAdmin":true,"position":"Treasurer/Collector"},
    {"name":"CYNTHIA LISTOVITCH","department":"Cable / PEG Access","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"PATRICIA LOWE","department":"Select Board","payType":"hourly","rate":23.38,"isAdmin":true,"position":"Executive Assistant / Cable Clerk"},
    {"name":"MITCHELL MABARDY","department":"Fire","payType":"hourly","rate":20.82,"isAdmin":false,"position":"Call Firefighter/Paramedic"},
    {"name":"EVONNE MALCOMSON","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"NICHOLAS MALNATI","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ISAIAH MCDANIEL","department":"Public Works","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"LORRAINE MICHALS","department":"Cable / PEG Access","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"LEEANN E MOSES","department":"Assessors/Land Use","payType":"hourly","rate":23.38,"isAdmin":true,"position":"Administrative Services Coordinator"},
    {"name":"JUDITH L O'DONNELL","department":"Recreation (Grant)","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"DEBORAH PAGE","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"MICHAEL PARKER","department":"Fire","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"JAMES PAYSON","department":"Public Works","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"NANCY PERRON","department":"Police/Health","payType":"hourly","rate":22.03,"isAdmin":false,"position":"Police Admin / BOH Clerk"},
    {"name":"FLORENCE PERVIER","department":"Cable / PEG Access","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"PAUL PERVIER","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"MICHAEL PIERCE","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"CLAUDIA PROVENCAL","department":"Senior Center","payType":"hourly","rate":25,"isAdmin":false,"position":"COA Director"},
    {"name":"SARA RISH","department":"Treasurer/Collector","payType":"hourly","rate":24.01,"isAdmin":true,"position":"Assistant Treasurer"},
    {"name":"NANCY ROGAN","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"SADIE SAINT","department":"Land Use","payType":"hourly","rate":22,"isAdmin":true,"position":"Inspectional Services Coordinator"},
    {"name":"SAMUEL SCARPATO","department":"Fire","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"BENJAMIN SEITZ","department":"Public Works","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"JEFFREY SHAMPINE","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"MARY ELLEN SHAUGHNESSY","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"BRIAN SICILIANO","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"SHAUN SIEQUIST","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"DARRELL SWEENEY","department":"School Debt/Capital","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"PAUL SWEENEY","department":"Public Works","payType":"hourly","rate":17.57,"isAdmin":false,"position":"DPW Seasonal"},
    {"name":"PHILLIP THERIAULT","department":"Fire","payType":"hourly","rate":17.80,"isAdmin":false,"position":"Call Firefighter"},
    {"name":"EDWARD TONET","department":"School Transportation","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"LOIS TYLER","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"KATHLEEN VINCENT","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"JAMES VINCENT","department":"Facilities / Building & Grounds","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ALEXANDER WADE","department":"Facilities / Building & Grounds","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"TINA WHITE","department":"Public Works","payType":"hourly","rate":22.03,"isAdmin":true,"position":"DPW Assistant"},
    {"name":"CAROL WHITNEY","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"BRIANNA WHITNEY","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"LYNN WILKINSON","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"TAYLOR WILKINSON","department":"Fire","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"LORRAINE WILLIAMS","department":"Senior Center / COA","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"KENNETH WINCHESTER","department":"Public Works","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"WILLIAM WITHYCOMBE","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"KAREN WOLFE","department":"Cable / PEG Access","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ANDREW WOODARD","department":"Public Works","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"PATRICIA WOODWARD","department":"Cable / PEG Access","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"LAUREN WRIGHT","department":"Senior Center / COA (Grant)","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"HUNTER YOUNG","department":"Building & Maintenance","payType":"hourly","rate":17.57,"isAdmin":false,"position":"Facilities Maintenance"}
  ];

  const WARRANTS = [
    { number: 5, start: "2025-08-24", end: "2025-09-06", due: "2025-09-08", check: "2025-09-11" },
    { number: 6, start: "2025-09-07", end: "2025-09-20", due: "2025-09-22", check: "2025-09-25" },
    { number: 7, start: "2025-09-21", end: "2025-10-04", due: "2025-10-06", check: "2025-10-09" },
    { number: 8, start: "2025-10-05", end: "2025-10-18", due: "2025-10-20", check: "2025-10-23" }
  ];

  /* =========================================================
     Personnel GL Directory + Helpers
     ---------------------------------------------------------
     Auto-fill order:
       1) EMPLOYEE_GLS[name] (if set)
       2) POSITION_GLS[position]
       3) DEPT_GLS[department]
     Multi-position staff can expose a row chooser via EMPLOYEE_POSITIONS.
     ========================================================= */

  // Department-level Personnel GLs (fill with your authoritative set)
  const DEPT_GLS = {
    "Administration": "01-5100-5110",
    "Accounting": "01-5100-5120",
    "Treasurer/Collector": "01-5100-5130",
    "Select Board": "01-5100-5140",
    "Town Clerk": "01-5100-5150",
    "Assessors/Land Use": "01-5100-5160",
    "Land Use": "01-5100-5160",
    "Facilities / Building & Grounds": "01-5100-5170",
    "Building & Maintenance": "01-5100-5170",

    "IT / Communications": "01-1550-5100",
    "IT/Communications": "01-1550-5100",
    "Cable / PEG Access": "01-1551-5100",
    "Elections": "01-162A-5100",

    "Public Works": "01-4200-5100",
    "Police": "01-2100-5100",
    "Police/Health": "01-2100-5100",
    "Fire": "01-2200-5100",
    "Building": "01-2410-5100",

    "Library": "01-6100-5100",
    "Recreation (Grant)": "01-6301-5100",

    "Senior Center / COA": "01-5410-5100",
    "Senior Center": "01-5410-5100",
    "Senior Center / COA (Grant)": "01-5411-5100",

    "School / Regional Assessment": "01-3000-5100",
    "School Debt/Capital": "01-3001-5100",
    "School Transportation": "01-3002-5100"
  };

  // Position-level mappings (optional; include where you have a specific GL)
  const POSITION_GLS = {
    "Town Administrator": "01-5100-5110",
    "Executive Assistant / Cable Clerk": "01-5100-5140",
    "Town Accountant": "01-5100-5120",
    "Treasurer/Collector": "01-5100-5130",
    "Assistant Treasurer": "01-5100-5130",
    "Chief of Police": "01-2100-5100",
    "Fire Chief": "01-2200-5100",
    "DPW Director": "01-4200-5100",
    "Library Assistant": "01-6100-5100",
    "Inspectional Services Coordinator": "01-5100-5160",
    "COA Director": "01-5410-5100",
    "Building Commissioner": "01-2410-5100",
    "Police Admin / BOH Clerk": "01-2100-5100",
    "MART Driver": "01-3002-5100",
    "MART Supervisor": "01-3002-5100",
    "Call Firefighter": "01-2200-5100",
    "Call LT/EMT": "01-2200-5100",
    "Call LT/Paramedic": "01-2200-5100",
    "Firefighter/AEMT": "01-2200-5100",
    "Firefighter/Paramedic": "01-2200-5100",
    "Call Firefighter/EMT": "01-2200-5100",
    "Call Firefighter/Paramedic": "01-2200-5100",
    "DPW Seasonal": "01-4200-5100",
    "Facilities Maintenance": "01-5100-5170",
    "Administrative Services Coordinator": "01-5100-5160"
  };

  // Employee-specific overrides (only if an individual must hit a unique GL)
  const EMPLOYEE_GLS = {
    // "FIRST LAST": "XX-XXXX-XXXX"
    // e.g., "NATHAN BOUDREAU": "01-5100-5110"
  };

  // Multi-position choices per employee (shows a role picker per row)
  const EMPLOYEE_POSITIONS = {
    // Example:
    // "NANCY PERRON": [
    //   { title: "Police Admin", gl: "01-2100-5100" },
    //   { title: "BOH Clerk",    gl: "01-5100-5190" }
    // ]
  };

  // ---- Helpers for GL resolution & UI ----
  function getEmployeeGLChoices(emp) {
    if (!emp) return [];
    const choices = (EMPLOYEE_POSITIONS[emp.name] || []).map(x => ({ label: `${x.title} — ${x.gl}`, value: x.gl }));

    const empGL = EMPLOYEE_GLS[emp.name];
    if (empGL) choices.push({ label: `Employee-specific — ${empGL}`, value: empGL });

    if (emp.position && POSITION_GLS[emp.position]) {
      const gl = POSITION_GLS[emp.position];
      if (!choices.some(c => c.value === gl)) choices.push({ label: `Position (${emp.position}) — ${gl}`, value: gl });
    }

    const deptGL = DEPT_GLS[emp.department];
    if (deptGL && !choices.some(c => c.value === deptGL)) {
      choices.push({ label: `Department (${emp.department}) — ${deptGL}`, value: deptGL });
    }

    const seen = new Set();
    return choices.filter(c => (seen.has(c.value) ? false : seen.add(c.value)));
  }

  function getDefaultGL(emp) {
    if (!emp) return "";
    if (EMPLOYEE_GLS[emp.name]) return EMPLOYEE_GLS[emp.name];
    if (emp.position && POSITION_GLS[emp.position]) return POSITION_GLS[emp.position];
    if (DEPT_GLS[emp.department]) return DEPT_GLS[emp.department];
    return "";
  }

  function rebuildGLDatalistFor(emp) {
    let dl = document.getElementById('glList');
    if (!dl) {
      dl = document.createElement('datalist');
      dl.id = 'glList';
      document.body.appendChild(dl);
    }
    dl.innerHTML = '';
    const opts = getEmployeeGLChoices(emp);
    opts.forEach(o => {
      const el = document.createElement('option');
      el.value = o.value;
      el.label = o.label;
      dl.appendChild(el);
    });
    const def = getDefaultGL(emp);
    if (def && !opts.some(o => o.value === def)) {
      const el = document.createElement('option');
      el.value = def;
      el.label = `Default — ${def}`;
      dl.appendChild(el);
    }
  }

  function reseedBlankGLs() {
    const rows = Array.from(document.querySelectorAll('#timeBody tr'));
    const def = getDefaultGL(currentEmployee);
    rows.forEach(r => {
      const glIn = r.querySelector('.gl-input');
      if (glIn && !glIn.value && def) glIn.value = def;
    });
  }

  // ---- DOM init ----
  window.addEventListener('DOMContentLoaded', () => {
    // Employees <datalist>
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

    // Warrant <select>
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

    // Bind
    const es = $('#employeeSearch');    if (es)  es.addEventListener('input', handleEmployee);
    const ceb = $('#clearEmployeeBtn'); if (ceb) ceb.addEventListener('click', clearEmployee);
    if (wsel) wsel.addEventListener('change', handleWarrant);
    const add = $('#addRowBtn');        if (add) add.addEventListener('click', () => addTimeRow());
    const clr = $('#clearAllBtn');      if (clr) clr.addEventListener('click', clearAllRows);
    const th  = $('#townHallBtn');      if (th)  th.addEventListener('click', addTownHallHours);
    const form= $('#timesheetForm');    if (form)form.addEventListener('submit', handleSubmit);

    // Enter key advances through table fields
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target && ev.target.matches && ev.target.matches('#timeBody input, #timeBody select')) {
        ev.preventDefault();
        const fields = Array.from(document.querySelectorAll('#timeBody input, #timeBody select'));
        const idx = fields.indexOf(ev.target);
        if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus();
      }
    });

    setMsg("System loaded successfully. Select an employee to begin.", "info", true);
  });

  // ---- Handlers ----
  function handleEmployee(e) {
    const name = (e.target.value || '').trim();
    const emp = EMPLOYEES.find(x => x.name.toLowerCase() === name.toLowerCase());
    if (!emp) return;
    currentEmployee = emp;

    const idxEl = $('#employeeIndex');
    if (idxEl) idxEl.value = String(EMPLOYEES.indexOf(emp));
    const dep = $('#department'); if (dep) dep.value = emp.department || '';
    const pty = $('#payType');    if (pty) pty.value = emp.payType ? (emp.payType[0].toUpperCase() + emp.payType.slice(1)) : '';
    const rate= $('#rate');
    if (rate) {
      rate.value = emp.payType === 'salary'
        ? (emp.rate ? (currency(emp.rate) + ' annually') : '—')
        : (emp.rate ? (currency(emp.rate) + ' per hour') : '—');
    }

    // Build GL choices and seed any blank GL inputs
    rebuildGLDatalistFor(emp);
    reseedBlankGLs();

    calculateTotals();
  }

  function clearEmployee() {
    currentEmployee = null;
    ['employeeIndex','employeeSearch','department','payType','rate'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    // Clear GL list since no active employee
    const dl = document.getElementById('glList'); if (dl) dl.innerHTML = '';
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

    const initialGL = glCode || getDefaultGL(currentEmployee);
    const hasMulti = currentEmployee && EMPLOYEE_POSITIONS[currentEmployee.name] && EMPLOYEE_POSITIONS[currentEmployee.name].length;

    const tr = document.createElement('tr');
    tr.innerHTML =
      `<td><input type="date" class="date-cell" value="${date || ''}"></td>
       <td><input type="time" class="time-start" value="${start || ''}"></td>
       <td><input type="time" class="time-end" value="${end || ''}"></td>
       <td><input type="number" step="0.25" min="0" placeholder="0.00" class="time-hours" value="${hours || ''}"></td>
       <td>
         <select class="time-type">
           <option${type==='Regular'?' selected':''}>Regular</option>
           <option${type==='Sick'?' selected':''}>Sick</option>
           <option${type==='Personal'?' selected':''}>Personal</option>
           <option${type==='Vacation'?' selected':''}>Vacation</option>
           <option${type==='Holiday'?' selected':''}>Holiday</option>
         </select>
       </td>
       <td>
         <div class="gl-cell" style="display:flex; gap:.5rem; align-items:center;">
           <input type="text" list="glList" class="gl-input" placeholder="GL Code" value="${initialGL || ''}" style="min-width:12ch;">
           ${hasMulti ? `
             <select class="gl-chooser">
               <option value="">Choose role…</option>
               ${EMPLOYEE_POSITIONS[currentEmployee.name].map(p => (
                 `<option value="${p.gl}">${p.title} — ${p.gl}</option>`
               )).join('')}
             </select>` : ''}
         </div>
       </td>
       <td><input type="text" placeholder="Describe work or leave" value="${description || ''}"></td>
       <td><button type="button" class="btn danger remove-row">Remove</button></td>`;

    tbody.appendChild(tr);

    // Pre-compute if regular + start/end provided
    if (start && end && type === 'Regular') {
      tr.querySelector('.time-hours').value = timeDiffHours(start, end).toFixed(2);
    }

    // Wire events
    tr.querySelector('.remove-row').addEventListener('click', () => { tr.remove(); calculateTotals(); });
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

    const chooser = tr.querySelector('.gl-chooser');
    const glInput = tr.querySelector('.gl-input');
    if (chooser && glInput) {
      chooser.addEventListener('change', () => {
        if (chooser.value) glInput.value = chooser.value;
        calculateTotals();
      });
    }
  }

  function clearAllRows() {
    const tb = $('#timeBody'); if (tb) tb.innerHTML = '';
    calculateTotals();
  }

  // Town Hall default hours per warrant
  function addTownHallHours() {
    if (!currentWarrant) { setMsg("Select a pay period first.", "info", true); return; }
    clearAllRows();
    const start = new Date(currentWarrant.start + 'T00:00:00');
    const end   = new Date(currentWarrant.end   + 'T00:00:00');

    // Schedule template (Mon–Fri)
    const schedule = {
      1: { start: "08:00", end: "16:00" }, // Mon
      2: { start: "08:00", end: "18:00" }, // Tue
      3: { start: "08:00", end: "16:00" }, // Wed
      4: { start: "08:00", end: "16:00" }, // Thu
      5: { start: "08:00", end: "16:00" }  // Fri
    };

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (schedule[dow]) {
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        addTimeRowWith(iso, schedule[dow].start, schedule[dow].end, '', 'Regular', getDefaultGL(currentEmployee), 'Town Hall hours');
      }
    }
    calculateTotals();
    setMsg(`Town Hall hours template applied for ${currentWarrant.start} to ${currentWarrant.end}.`, "success", true);
  }
  api.addTownHallHours = addTownHallHours;

  // ---- Totals & Pay ----
  function calculateTotals() {
    let totalHours = 0, reg = 0, sick = 0, pers = 0, vac = 0, hol = 0;
    let w1Reg = 0, w2Reg = 0;

    const rows = Array.from(document.querySelectorAll('#timeBody tr'));
    rows.forEach(row => {
      const date = row.querySelector('.date-cell')?.value || '';
      const hours = parseFloat(row.querySelector('.time-hours')?.value || 0) || 0;
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

    // Render hour totals
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v.toFixed(2); };
    setTxt('totalHours', totalHours);
    setTxt('sumRegular', regPayable);
    setTxt('sumSick', sick);
    setTxt('sumPersonal', pers);
    setTxt('sumVacation', vac);
    setTxt('sumHoliday', hol);

    // Pay
    let gross = 0;
    if (currentEmployee && currentEmployee.rate) {
      if (currentEmployee.payType === 'hourly') {
        const r = currentEmployee.rate;
        const regPay = regPayable * r;
        const otPay  = overtime * r * 1.5;
        const leavePay = (sick + pers + vac + hol) * r;
        gross = regPay + otPay + leavePay;
      } else if (currentEmployee.payType === 'salary') {
        gross = currentEmployee.rate / 26; // biweekly
      }
    }
    const gp = document.getElementById('grossPay'); if (gp) gp.textContent = currency(gross);
  }

  // ---- Submit ----
  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentEmployee) { setMsg("Please select an employee.", "error", true); return; }
    if (!currentWarrant)  { setMsg("Please select a pay period.", "error", true); return; }

    // Collect rows
    const entries = [];
    const rows = Array.from(document.querySelectorAll('#timeBody tr'));
    rows.forEach(row => {
      const date = row.querySelector('.date-cell')?.value || '';
      const start= row.querySelector('.time-start')?.value || '';
      const end  = row.querySelector('.time-end')?.value || '';
      const hours= parseFloat(row.querySelector('.time-hours')?.value || 0) || 0;
      const type = row.querySelector('.time-type')?.value || 'Regular';
      const gl   = row.querySelector('.gl-input')?.value || '';
      const desc = row.children[6]?.querySelector('input')?.value || '';
      if (date && hours > 0) {
        entries.push({ date, start, end, hours, type, gl, description: desc });
      }
    });

    if (!entries.length) { setMsg("Add at least one time entry.", "error", true); return; }

    const totals = {
      totalHours: parseFloat(document.getElementById('totalHours')?.textContent || 0),
      regularHours: parseFloat(document.getElementById('sumRegular')?.textContent || 0),
      sickHours: parseFloat(document.getElementById('sumSick')?.textContent || 0),
      personalHours: parseFloat(document.getElementById('sumPersonal')?.textContent || 0),
      vacationHours: parseFloat(document.getElementById('sumVacation')?.textContent || 0),
      holidayHours: parseFloat(document.getElementById('sumHoliday')?.textContent || 0),
      grossPay: document.getElementById('grossPay')?.textContent || "$0.00"
    };

    const payload = {
      meta: {
        submittedAt: new Date().toISOString(),
        notify: NOTIFY,
        source: "HubbTIME (HubbFISCAL)"
      },
      employee: {
        name: currentEmployee.name,
        department: currentEmployee.department,
        payType: currentEmployee.payType,
        rate: currentEmployee.rate,
        position: currentEmployee.position || null
      },
      warrant: currentWarrant,
      entries,
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

  // expose API
  return api;
})();
