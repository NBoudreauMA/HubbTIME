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

  // ---- Helper functions for supplemental actions ----
  const hhmmToMin = (hhmm) => {
    if (!hhmm) return null;
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + m;
  };

  const minToHHMM = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
  };

  const getLastRow = () => {
    const tbody = document.getElementById('timeBody');
    return tbody ? tbody.lastElementChild : null;
  };

  // ---- Data (complete roster with FY26 official rates) ----
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
    {"name":"TRAVIS BROWN","department":"Public Works","payType":"hourly","rate":45.37,"isAdmin":false,"position":"DPW Director"},
    {"name":"MICHAEL CAPPS","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"TROY CASEY","department":"Fire","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"ROBERT CHAMPAGNE","department":"Police","payType":"hourly","rate":null,"isAdmin":false,"position":null},
    {"name":"SAMANTHA CHATTERTON","department":"Accounting","payType":"salary","rate":65000,"isAdmin":true,"position":"Town Accountant"},
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
    {"name":"MELODY GREEN","department":"Town Clerk","payType":"salary","rate":67000,"isAdmin":true,"position":"Town Clerk"},
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
    {"name":"ROBERT LANCIANI","department":"Building","payType":"hourly","rate":41.09,"isAdmin":true,"position":"Building Commissioner"},
    {"name":"SHONNA LARSON","department":"Town Clerk","payType":"hourly","rate":null,"isAdmin":true,"position":null},
    {"name":"MARY LEROUX","department":"Treasurer/Collector","payType":"salary","rate":71000,"isAdmin":true,"position":"Treasurer/Collector"},
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
    {"name":"CLAUDIA PROVENCAL","department":"Senior Center","payType":"hourly","rate":25.00,"isAdmin":false,"position":"COA Director"},
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

  // ---- Department-level Personnel GLs (for defaults) ----
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

  // Position-level mappings
  const POSITION_GLS = {
    "Town Administrator": "1000-129-5100-0000",
    "Executive Assistant / Cable Clerk": "1000-122-5100-0000",
    "Town Accountant": "1000-129-5100-0000",
    "Treasurer/Collector": "1000-149-5100-0000",
    "Assistant Treasurer": "1000-149-5100-0000",
    "Chief of Police": "1000-210-5100-0000",
    "Fire Chief": "1000-220-5100-0000",
    "DPW Director": "1000-420-5100-0000",
    "Library Assistant": "1000-610-5100-0000",
    "Inspectional Services Coordinator": "1000-241-5100-0000",
    "COA Director": "1000-541-5100-0000",
    "Building Commissioner": "1000-241-5100-0000",
    "Police Admin / BOH Clerk": "1000-210-5100-0000",
    "MART Driver": "1000-129-5100-0000",
    "MART Supervisor": "1000-129-5100-0000",
    "Call Firefighter": "1000-220-5100-0000",
    "Call LT/EMT": "1000-220-5100-0000",
    "Call LT/Paramedic": "1000-220-5100-0000",
    "Firefighter/AEMT": "1000-220-5100-0000",
    "Firefighter/Paramedic": "1000-220-5100-0000",
    "Call Firefighter/EMT": "1000-220-5100-0000",
    "Call Firefighter/Paramedic": "1000-220-5100-0000",
    "DPW Seasonal": "1000-420-5100-0000",
    "Facilities Maintenance": "1000-192-5100-0000",
    "Administrative Services Coordinator": "1000-141-5100-0000"
  };

  // Employee-specific overrides
  const EMPLOYEE_GLS = {};

  // Multi-position choices per employee (Patricia: 26 town/10 library, LeeAnn: 37 land use/31 assessor)
  const EMPLOYEE_POSITIONS = {
    "PATRICIA LOWE": [
      { title: "Executive Assistant (Select Board)", gl: "1000-122-5100-0000", rate: 23.38, proportion: 26 },
      { title: "Library Assistant", gl: "1000-610-5100-0000", rate: 17.57, proportion: 10 }
    ],
    "LEEANN E MOSES": [
      { title: "Land Use Administrative", gl: "1000-241-5100-0000", proportion: 37 },
      { title: "Assessor Administrative", gl: "1000-141-5100-0000", proportion: 31 }
    ]
  };

  // Auto-allocation targets for Town Hall Hours button
  const AUTO_SPLITS = {
    "PATRICIA LOWE": {
      mode: "weekly",
      targets: [
        { gl: "1000-610-5100-0000", hours: 8.00, label: "Library" },
        { gl: "1000-122-5100-0000", hours: 26.00, label: "Select Board" }
      ]
    },
    "LEEANN E MOSES": {
      mode: "biweekly", 
      targets: [
        { gl: "1000-241-5100-0000", hours: 37.00, label: "Land Use" },
        { gl: "1000-141-5100-0000", hours: 31.00, label: "Assessors" }
      ]
    }
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
    
    if (emp) {
      const choices = getEmployeeGLChoices(emp);
      choices.forEach(choice => {
        const option = document.createElement('option');
        option.value = choice.value;
        option.label = choice.label;
        dl.appendChild(option);
      });
      dl.appendChild(document.createComment('--- General Town GL Codes ---'));
    }
    
    const townGLCodes = [
      { code: '1000-114-5100-0000', desc: 'Personnel – Moderator' },
      { code: '1000-122-5100-0000', desc: 'Personnel – Select Board' },
      { code: '1000-129-5100-0000', desc: 'Personnel – Town Administrator' },
      { code: '1000-141-5100-0000', desc: 'Personnel – Assessor' },
      { code: '1000-149-5100-0000', desc: 'Personnel – Treasurer/Collector' },
      { code: '1000-161-5100-0000', desc: 'Personnel – Town Clerk' },
      { code: '1000-192-5100-0000', desc: 'Personnel – Building & Maintenance' },
      { code: '1000-210-5100-0000', desc: 'Personnel – Police' },
      { code: '1000-220-5100-0000', desc: 'Personnel – Fire' },
      { code: '1000-241-5100-0000', desc: 'Personnel – Land Use' },
      { code: '1000-291-5100-0000', desc: 'Personnel – Emergency Management' },
      { code: '1000-420-5100-0000', desc: 'Personnel – DPW' },
      { code: '1000-423-5100-0000', desc: 'Personnel – Snow & Ice' },
      { code: '1000-541-5100-0000', desc: 'Personnel – Senior Center' },
      { code: '1000-610-5100-0000', desc: 'Personnel – Library' }
    ];

    const existingValues = new Set(Array.from(dl.querySelectorAll('option')).map(opt => opt.value));
    townGLCodes.forEach(({ code, desc }) => {
      if (!existingValues.has(code)) {
        const option = document.createElement('option');
        option.value = code;
        option.label = `${code} — ${desc}`;
        dl.appendChild(option);
      }
    });
  }

  // Enhanced GL input creation with multi-position support
  function createGLInput(initialGL = '', emp = null) {
    const hasMulti = emp && EMPLOYEE_POSITIONS[emp.name] && EMPLOYEE_POSITIONS[emp.name].length;
    
    const glDiv = document.createElement('div');
    glDiv.className = 'gl-cell';
    
    const glInput = document.createElement('input');
    glInput.type = 'text';
    glInput.setAttribute('list', 'glList');
    glInput.className = 'gl-input input';
    glInput.placeholder = 'Type GL code or search...';
    glInput.value = initialGL || getDefaultGL(emp);
    glInput.style.minWidth = '15ch';
    glInput.setAttribute('autocomplete', 'off');
    
    glInput.addEventListener('input', function() {
      const query = this.value.toLowerCase();
      const datalist = document.getElementById('glList');
      if (!datalist) return;
      Array.from(datalist.options).forEach(option => {
        const matches = option.value.toLowerCase().includes(query) || 
                       (option.label && option.label.toLowerCase().includes(query));
        option.style.display = matches ? '' : 'none';
      });
    });
    
    glDiv.appendChild(glInput);
    
    // Add multi-position dropdown for Patricia Lowe & LeeAnn Moses
    if (hasMulti) {
      const glChooser = document.createElement('select');
      glChooser.className = 'gl-chooser input';
      glChooser.style.marginTop = '4px';
      glChooser.style.fontSize = '12px';
      
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = '↓ Quick select role';
      glChooser.appendChild(defaultOption);
      
      EMPLOYEE_POSITIONS[emp.name].forEach(position => {
        const option = document.createElement('option');
        option.value = position.gl;
        const rateText = position.rate ? ` @ $${position.rate}/hr` : '';
        const proportionText = position.proportion ? ` (${position.proportion} parts)` : '';
        option.textContent = `${position.title}${rateText}${proportionText}`;
        glChooser.appendChild(option);
      });
      
      glChooser.addEventListener('change', function() {
        if (this.value) {
          glInput.value = this.value;
          glInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
      });
      
      glDiv.appendChild(glChooser);
    }
    
    return glDiv;
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
    const showEmployeeDetails = () => {
      const details = $('#employeeDetails');
      if (details && currentEmployee) {
        details.style.display = 'block';
      }
    };

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

    // Bind events
    const es = $('#employeeSearch');    
    if (es) es.addEventListener('input', (e) => {
      handleEmployee(e);
      showEmployeeDetails();
    });
    const ceb = $('#clearEmployeeBtn'); 
    if (ceb) ceb.addEventListener('click', () => {
      clearEmployee();
      const details = $('#employeeDetails');
      if (details) details.style.display = 'none';
    });
    if (wsel) wsel.addEventListener('change', handleWarrant);
    const add = $('#addRowBtn');        if (add) add.addEventListener('click', () => addTimeRow());
    const clr = $('#clearAllBtn');      if (clr) clr.addEventListener('click', clearAllRows);
    const th  = $('#townHallBtn');      if (th)  th.addEventListener('click', addTownHallHours);
    const form= $('#timesheetForm');    if (form)form.addEventListener('submit', handleSubmit);

    // Supplemental action buttons
    const split = $('#splitShiftBtn');  if (split) split.addEventListener('click', addSplitShift);
    const ot    = $('#overtimeBtn');    if (ot)    ot.addEventListener('click', addOvertimeDay);
    const sick  = $('#sickBtn');        if (sick)  sick.addEventListener('click', addSickDay);
    const vac   = $('#vacationBtn');    if (vac)   vac.addEventListener('click', addVacationDay);
    const pers  = $('#personalBtn');    if (pers)  pers.addEventListener('click', () => addQuickDay('Personal', 'Personal Day', '8.00'));
    const hol   = $('#holidayBtn');     if (hol)   hol.addEventListener('click', () => addQuickDay('Holiday', 'Holiday', '8.00'));

    // Enter key advances through table fields
    document.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && ev.target && ev.target.matches && ev.target.matches('#timeBody input, #timeBody select')) {
        ev.preventDefault();
        const fields = Array.from(document.querySelectorAll('#timeBody input, #timeBody select'));
        const idx = fields.indexOf(ev.target);
        if (idx >= 0 && idx < fields.length - 1) fields[idx + 1].focus();
      }
    });

    // Initial calculation
    calculateTotals();
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
    const dep = $('#department'); if (dep) dep.textContent = emp.department || '—';
    const pty = $('#payType');    if (pty) pty.textContent = emp.payType ? (emp.payType[0].toUpperCase() + emp.payType.slice(1)) : '—';
    const rate= $('#rate');
    if (rate) {
      rate.textContent = emp.payType === 'salary'
        ? (emp.rate ? (currency(emp.rate) + ' annually') : '—')
        : (emp.rate ? (currency(emp.rate) + ' per hour') : '—');
    }

    rebuildGLDatalistFor(emp);
    reseedBlankGLs();
    calculateTotals();
    
    // Show message about multi-position functionality
    if (EMPLOYEE_POSITIONS[emp.name]) {
      const positions = EMPLOYEE_POSITIONS[emp.name];
      const positionText = positions.map(p => `${p.title} (${p.proportion} parts)`).join(' & ');
      setMsg(`${emp.name} has multiple positions: ${positionText}. Quick day buttons will auto-split hours.`, 'info', true);
    }
  }

  function clearEmployee() {
    currentEmployee = null;
    ['employeeIndex','employeeSearch'].forEach(id => { 
      const el = document.getElementById(id); 
      if (el) el.value = ''; 
    });
    ['department','payType','rate'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = '—';
    });
    const dl = document.getElementById('glList'); 
    if (dl) dl.innerHTML = '';
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
    const tbody = $('#timeBody'); 
    if (!tbody) return;

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

    // Insert the custom GL cell with multi-position support
    const glCell = tr.children[5]; // 6th cell (0-indexed)
    const glInput = createGLInput(glCode || getDefaultGL(currentEmployee), currentEmployee);
    glCell.appendChild(glInput);

    tbody.appendChild(tr);

    if (start && end && type === 'Regular') {
      tr.querySelector('.time-hours').value = timeDiffHours(start, end).toFixed(2);
    }

    wireRowEvents(tr);
    return tr;
  }

  // Helper function to wire events for dynamically created rows
  function wireRowEvents(tr) {
    tr.querySelector('.remove-row').addEventListener('click', () => { 
      tr.remove(); 
      calculateTotals(); 
    });

    tr.querySelector('.insert-above').addEventListener('click', () => {
      const newRow = document.createElement('tr');
      newRow.innerHTML = tr.innerHTML;
      
      newRow.querySelectorAll('input').forEach(input => {
        if (input.type === 'date') {
          input.value = tr.querySelector('.date-cell').value;
        } else if (input.classList.contains('gl-input')) {
          input.value = tr.querySelector('.gl-input').value;
        } else {
          input.value = '';
        }
      });
      newRow.querySelectorAll('select').forEach(select => {
        if (select.classList.contains('time-type')) {
          select.value = tr.querySelector('.time-type').value;
        } else {
          select.selectedIndex = 0;
        }
      });

      const glCell = newRow.children[5];
      glCell.innerHTML = '';
      const glInput = createGLInput(tr.querySelector('.gl-input').value, currentEmployee);
      glCell.appendChild(glInput);

      tr.parentNode.insertBefore(newRow, tr);
      wireRowEvents(newRow);
      calculateTotals();
    });

    tr.querySelector('.insert-below').addEventListener('click', () => {
      const newRow = document.createElement('tr');
      newRow.innerHTML = tr.innerHTML;
      
      newRow.querySelectorAll('input').forEach(input => {
        if (input.type === 'date') {
          input.value = tr.querySelector('.date-cell').value;
        } else if (input.classList.contains('gl-input')) {
          input.value = tr.querySelector('.gl-input').value;
        } else {
          input.value = '';
        }
      });
      newRow.querySelectorAll('select').forEach(select => {
        if (select.classList.contains('time-type')) {
          select.value = tr.querySelector('.time-type').value;
        } else {
          select.selectedIndex = 0;
        }
      });

      const glCell = newRow.children[5];
      glCell.innerHTML = '';
      const glInput = createGLInput(tr.querySelector('.gl-input').value, currentEmployee);
      glCell.appendChild(glInput);

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
    const tb = $('#timeBody'); 
    if (tb) tb.innerHTML = '';
    calculateTotals();
  }

  // ---- Enhanced Supplemental Actions ----
  function addSplitShift() {
    const tbody = document.getElementById('timeBody');
    if (!tbody || tbody.children.length === 0) {
      setMsg('Add a time entry first before splitting shifts.', 'error', true);
      return;
    }

    const lastRow = tbody.children[tbody.children.length - 1];
    const dateInput = lastRow.querySelector('.date-cell');
    const startInput = lastRow.querySelector('.time-start');
    const endInput = lastRow.querySelector('.time-end');
    const glInput = lastRow.querySelector('.gl-input');
    const typeSelect = lastRow.querySelector('.time-type');
    const descInput = lastRow.children[6]?.querySelector('input');
    
    if (!dateInput || !startInput || !endInput) {
      setMsg('Could not find required fields in the last row.', 'error', true);
      return;
    }

    const date = dateInput.value;
    const start = startInput.value;
    const end = endInput.value;
    const gl = glInput ? glInput.value : getDefaultGL(currentEmployee);
    const type = typeSelect ? typeSelect.value : 'Regular';
    const desc = descInput ? descInput.value : '';
    
    if (!date || !start || !end) {
      setMsg('Please complete the date, start time, and end time in the last row before splitting shifts.', 'error', true);
      return;
    }

    if (type !== 'Regular') {
      setMsg('Split Shift only works with Regular time entries.', 'error', true);
      return;
    }

    const s = hhmmToMin(start);
    const e = hhmmToMin(end);
    
    if (s == null || e == null || e <= s) {
      setMsg('Invalid time range. End time must be after start time.', 'error', true);
      return;
    }

    const mid = Math.floor((s + e) / 2);
    const midTime = minToHHMM(mid);

    // Remove the last row
    lastRow.remove();

    // Add two new split rows
    addTimeRowWith(date, start, midTime, '', 'Regular', gl, `${desc} (Split 1/2)`.trim());
    addTimeRowWith(date, midTime, end, '', 'Regular', gl, `${desc} (Split 2/2)`.trim());

    calculateTotals();
    setMsg(`Shift split successfully: ${start}-${midTime} and ${midTime}-${end}`, 'success', true);
  }

  function addQuickDay(kind, label, defaultHours = '8.00') {
    if (!currentEmployee) {
      setMsg('Please select an employee first.', 'error', true);
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    
    // Auto-split hours for multi-position employees based on their weekly proportions
    if (EMPLOYEE_POSITIONS[currentEmployee.name]) {
      const positions = EMPLOYEE_POSITIONS[currentEmployee.name];
      const totalParts = positions.reduce((sum, pos) => sum + pos.proportion, 0);
      const totalHours = parseFloat(defaultHours);
      
      positions.forEach((position) => {
        const proportionalHours = (totalHours * position.proportion / totalParts).toFixed(2);
        const positionLabel = `${label} (${position.title})`;
        addTimeRowWith(today, '', '', proportionalHours, kind, position.gl, positionLabel);
      });
      
      calculateTotals();
      setMsg(`${label} split: ${positions.map(p => `${(parseFloat(defaultHours) * p.proportion / totalParts).toFixed(2)}h ${p.title}`).join(' + ')}`, 'success', true);
    } else {
      // Regular single-position employee
      const gl = getDefaultGL(currentEmployee);
      addTimeRowWith(today, '', '', defaultHours, kind, gl, label);
      calculateTotals();
      setMsg(`${label} added successfully.`, 'success', true);
    }
  }

  function addOvertimeDay() { addQuickDay('Regular', 'Overtime Day', '10.00'); }
  function addSickDay()     { addQuickDay('Sick', 'Sick Day', '8.00'); }
  function addVacationDay() { addQuickDay('Vacation', 'Vacation Day', '8.00'); }

  // Allocate hours across GL targets, splitting days as needed
  function allocateHoursToTargets(rows, targets) {
    if (!rows.length || !targets.length) return;
    
    let currentTargetIndex = 0;
    let remainingHours = targets[currentTargetIndex].hours;
    const tbody = document.getElementById('timeBody');
    
    // Process rows in order, potentially splitting days that cross target boundaries
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const hoursInput = row.querySelector('.time-hours');
      const rowHours = parseFloat(hoursInput?.value || 0);
      
      if (rowHours <= 0) continue;
      
      if (currentTargetIndex >= targets.length) {
        // All targets fulfilled, keep original GL for remaining rows
        continue;
      }
      
      const currentTarget = targets[currentTargetIndex];
      
      if (rowHours <= remainingHours) {
        // Row fits entirely in current target
        const glInput = row.querySelector('.gl-input');
        if (glInput) glInput.value = currentTarget.gl;
        remainingHours -= rowHours;
        
        if (remainingHours <= 0.01) { // Close to zero, move to next target
          currentTargetIndex++;
          if (currentTargetIndex < targets.length) {
            remainingHours = targets[currentTargetIndex].hours;
          }
        }
      } else {
        // Row exceeds remaining hours, need to split this day
        const date = row.querySelector('.date-cell')?.value || '';
        const type = row.querySelector('.time-type')?.value || 'Regular';
        const desc = row.children[6]?.querySelector('input')?.value || '';
        
        // Modify current row: exact remaining hours for current target
        const glInput = row.querySelector('.gl-input');
        if (glInput) glInput.value = currentTarget.gl;
        hoursInput.value = remainingHours.toFixed(2);
        
        // Clear start/end times for precise hour control
        const startInput = row.querySelector('.time-start');
        const endInput = row.querySelector('.time-end');
        if (startInput) startInput.value = '';
        if (endInput) endInput.value = '';
        
        // Calculate leftover hours for next target
        const leftoverHours = rowHours - remainingHours;
        
        // Move to next target
        currentTargetIndex++;
        
        if (currentTargetIndex < targets.length) {
          const nextTarget = targets[currentTargetIndex];
          
          // Create new row for leftover hours
          const newRow = addTimeRowWith(date, '', '', leftoverHours.toFixed(2), type, nextTarget.gl, desc);
          
          // Insert after current row
          if (row.nextSibling) {
            tbody.insertBefore(newRow, row.nextSibling);
          } else {
            tbody.appendChild(newRow);
          }
          
          // Update remaining hours for current target
          remainingHours = targets[currentTargetIndex].hours - leftoverHours;
          if (remainingHours <= 0.01) {
            currentTargetIndex++;
            if (currentTargetIndex < targets.length) {
              remainingHours = targets[currentTargetIndex].hours;
            }
          }
        } else {
          // No more targets, use default GL for leftover
          const defaultGL = getDefaultGL(currentEmployee);
          const newRow = addTimeRowWith(date, '', '', leftoverHours.toFixed(2), type, defaultGL, desc);
          
          if (row.nextSibling) {
            tbody.insertBefore(newRow, row.nextSibling);
          } else {
            tbody.appendChild(newRow);
          }
        }
      }
    }
  }

  // Town Hall default hours per warrant (bi-weekly schedule)
  function addTownHallHours() {
    if (!currentWarrant) { 
      setMsg("Select a pay period first.", "info", true); 
      return; 
    }
    clearAllRows();
    const start = new Date(currentWarrant.start + 'T00:00:00');
    const end   = new Date(currentWarrant.end   + 'T00:00:00');

    // Mon/Wed/Thu 8-4, Tuesday 8-6
    const schedule = {
      1: { start: "08:00", end: "16:00" }, // Monday
      2: { start: "08:00", end: "18:00" }, // Tuesday
      3: { start: "08:00", end: "16:00" }, // Wednesday
      4: { start: "08:00", end: "16:00" }  // Thursday
    };

    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dow = d.getDay();
      if (schedule[dow]) {
        const iso = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        addTimeRowWith(iso, schedule[dow].start, schedule[dow].end, '', 'Regular', getDefaultGL(currentEmployee), 'Town Hall hours');
      }
    }
    calculateTotals();
    setMsg(`Town Hall hours template applied for ${currentWarrant.start} to ${currentWarrant.end} (M/W/Th 8-4, Tu 8-6).`, "success", true);

    // Auto-allocation for specific employees
    if (currentEmployee && AUTO_SPLITS[currentEmployee.name]) {
      const splitConfig = AUTO_SPLITS[currentEmployee.name];
      const allRows = Array.from(document.querySelectorAll('#timeBody tr'));
      const regularRows = allRows.filter(row => {
        const type = row.querySelector('.time-type')?.value || 'Regular';
        return type === 'Regular';
      });
      
      if (splitConfig.mode === "weekly") {
        // Patricia: Apply targets separately to each week
        const week1Rows = regularRows.filter(row => {
          const date = row.querySelector('.date-cell')?.value || '';
          return getWeekIndex(date) === 1;
        });
        const week2Rows = regularRows.filter(row => {
          const date = row.querySelector('.date-cell')?.value || '';
          return getWeekIndex(date) === 2;
        });
        
        allocateHoursToTargets(week1Rows, splitConfig.targets);
        allocateHoursToTargets(week2Rows, splitConfig.targets);
      } else if (splitConfig.mode === "biweekly") {
        // LeeAnn: Apply targets across entire pay period
        allocateHoursToTargets(regularRows, splitConfig.targets);
      }
      
      calculateTotals();
      const targetSummary = splitConfig.targets.map(t => `${t.hours}h ${t.label}`).join(' + ');
      setMsg(`Town Hall hours allocated for ${currentEmployee.name}: ${targetSummary} ${splitConfig.mode === 'weekly' ? 'per week' : 'total'}.`, "success", true);
    }
  }

  // ---- GL Review & Cost Allocation ----
  function updateGLReview() {
    const glBreakdown = {};
    const rows = Array.from(document.querySelectorAll('#timeBody tr'));
    
    rows.forEach(row => {
      const hours = parseFloat(row.querySelector('.time-hours')?.value || 0) || 0;
      const type = row.querySelector('.time-type')?.value || 'Regular';
      const gl = row.querySelector('.gl-input')?.value || '';
      
      if (hours > 0 && gl) {
        if (!glBreakdown[gl]) {
          glBreakdown[gl] = { regular: 0, sick: 0, personal: 0, vacation: 0, holiday: 0, total: 0 };
        }
        glBreakdown[gl][type.toLowerCase()] += hours;
        glBreakdown[gl].total += hours;
      }
    });

    const reviewWrap = $('#glReviewWrap');
    if (!reviewWrap) return;

    if (Object.keys(glBreakdown).length === 0) {
      reviewWrap.innerHTML = `
        <p class="text-center text-muted" style="padding:var(--space-xl);">
          Enter time entries above to see GL code breakdown and cost allocation
        </p>`;
      return;
    }

    let costCalculation = '';
    if (currentEmployee && currentEmployee.rate) {
      costCalculation = currentEmployee.payType === 'hourly' 
        ? `<th>Regular Cost</th><th>Overtime Cost</th><th>Leave Cost</th><th>Total Cost</th>`
        : `<th>Salary Allocation</th>`;
    }

    let tableHTML = `
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

    Object.entries(glBreakdown).forEach(([gl, breakdown]) => {
      let costCells = '';
      if (currentEmployee && currentEmployee.rate) {
        if (currentEmployee.payType === 'hourly') {
          let rate = currentEmployee.rate;
          // Check for position-specific rates (Patricia Lowe has different rates for different roles)
          if (currentEmployee.name && EMPLOYEE_POSITIONS[currentEmployee.name]) {
            const position = EMPLOYEE_POSITIONS[currentEmployee.name].find(pos => pos.gl === gl && pos.rate);
            if (position) rate = position.rate;
          }
          const regularCost = breakdown.regular * rate;
          const overtimeCost = 0; // requires weekly split per GL to be exact
          const leaveCost = (breakdown.sick + breakdown.personal + breakdown.vacation + breakdown.holiday) * rate;
          const totalCost = regularCost + overtimeCost + leaveCost;
          costCells = `
            <td>${currency(regularCost)}</td>
            <td>${currency(overtimeCost)}</td>
            <td>${currency(leaveCost)}</td>
            <td><strong>${currency(totalCost)}</strong></td>`;
        } else {
          const totalHours = Object.values(glBreakdown).reduce((sum, b) => sum + b.total, 0);
          const allocation = totalHours > 0 ? (breakdown.total / totalHours) * (currentEmployee.rate / 26) : 0;
          costCells = `<td><strong>${currency(allocation)}</strong></td>`;
        }
      }

      tableHTML += `
        <tr>
          <td><strong>${gl}</strong></td>
          <td>${breakdown.regular.toFixed(2)}</td>
          <td>${breakdown.sick.toFixed(2)}</td>
          <td>${breakdown.personal.toFixed(2)}</td>
          <td>${breakdown.vacation.toFixed(2)}</td>
          <td>${breakdown.holiday.toFixed(2)}</td>
          <td><strong>${breakdown.total.toFixed(2)}</strong></td>
          ${costCells}
        </tr>`;
    });

    tableHTML += `
          </tbody>
        </table>
      </div>`;

    reviewWrap.innerHTML = tableHTML;
  }

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

    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v.toFixed(2); };
    setTxt('totalHours', totalHours);
    setTxt('sumRegular', regPayable);
    setTxt('sumSick', sick);
    setTxt('sumPersonal', pers);
    setTxt('sumVacation', vac);
    setTxt('sumHoliday', hol);

    // Pay calculation with multi-position rate support
    let gross = 0;
    if (currentEmployee && currentEmployee.rate) {
      if (currentEmployee.payType === 'hourly') {
        const hasPositionRates = currentEmployee.name && EMPLOYEE_POSITIONS[currentEmployee.name] && 
                                EMPLOYEE_POSITIONS[currentEmployee.name].some(pos => pos.rate);
        if (hasPositionRates) {
          // Calculate pay per GL code with position-specific rates (Patricia Lowe)
          let totalPay = 0;
          rows.forEach(row => {
            const hours = parseFloat(row.querySelector('.time-hours')?.value || 0) || 0;
            const type = row.querySelector('.time-type')?.value || 'Regular';
            const gl = row.querySelector('.gl-input')?.value || '';
            if (hours > 0) {
              const position = EMPLOYEE_POSITIONS[currentEmployee.name].find(pos => pos.gl === gl);
              const rate = position && position.rate ? position.rate : currentEmployee.rate;
              totalPay += hours * rate; // (OT not split per-GL in this simple model)
            }
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
    const gp = document.getElementById('grossPay'); 
    if (gp) gp.textContent = currency(gross);
    
    updateGLReview();
  }

  // ---- Submit ----
  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentEmployee) { setMsg("Please select an employee.", "error", true); return; }
    if (!currentWarrant)  { setMsg("Please select a pay period.", "error", true); return; }

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

      // Check if response includes a redirect URL for prefilled form
      let data;
      try {
        data = await res.json();
      } catch (jsonErr) {
        // If response isn't JSON, treat as successful basic submission
        data = null;
      }

      if (data && data.prefillUrl) {
        // Redirect to prefilled form
        setMsg('Timesheet submitted successfully. Redirecting to form...', 'success', true);
        window.location.href = data.prefillUrl;
      } else {
        // Standard success message
        setMsg('Timesheet submitted successfully.', 'success', true);
        if (status) status.textContent = 'Submitted ✔';
      }

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
  api.addSplitShift = addSplitShift;
  api.addOvertimeDay = addOvertimeDay;
  api.addSickDay = addSickDay;
  api.addVacationDay = addVacationDay;
  api.updateGLReview = updateGLReview;
  api.removeEntry = (entryId) => { 
    // For compatibility with supplemental scripts - remove by row if needed
    const rows = Array.from(document.querySelectorAll('#timeBody tr'));
    if (entryId && rows[entryId]) {
      rows[entryId].remove();
      calculateTotals();
    }
  };

  return api;
})();
