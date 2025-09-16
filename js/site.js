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

  /* =========================================================
     Personnel GL Directory + Helpers
     ========================================================= */

  // All Municipal Personnel GL Accounts (searchable)
  const ALL_PERSONNEL_GLS = [
    // General Government
    { code: "01-5100-5110", desc: "Town Administrator" },
    { code: "01-5100-5120", desc: "Town Accountant" },
    { code: "01-5100-5130", desc: "Treasurer/Collector" },
    { code: "01-5100-5140", desc: "Select Board" },
    { code: "01-5100-5150", desc: "Town Clerk" },
    { code: "01-5100-5160", desc: "Assessors/Land Use" },
    { code: "01-5100-5170", desc: "Facilities / Building & Grounds" },
    { code: "01-5100-5180", desc: "Technology/IT" },
    { code: "01-5100-5190", desc: "General Administration" },
    
    // Communications
    { code: "01-1550-5100", desc: "IT / Communications" },
    { code: "01-1551-5100", desc: "Cable / PEG Access" },
    
    // Elections
    { code: "01-162A-5100", desc: "Elections" },
    
    // Public Safety - Police
    { code: "01-2100-5100", desc: "Police Department" },
    { code: "01-2100-5110", desc: "Police Chief" },
    { code: "01-2100-5120", desc: "Police Officers" },
    { code: "01-2100-5130", desc: "Police Administrative" },
    { code: "01-2100-5140", desc: "Police Overtime" },
    { code: "01-2100-5150", desc: "Police Details" },
    
    // Public Safety - Fire
    { code: "01-2200-5100", desc: "Fire Department" },
    { code: "01-2200-5110", desc: "Fire Chief" },
    { code: "01-2200-5120", desc: "Full-Time Firefighters" },
    { code: "01-2200-5130", desc: "Call Firefighters" },
    { code: "01-2200-5140", desc: "Fire Overtime" },
    { code: "01-2200-5150", desc: "EMT/Paramedic" },
    
    // Building & Inspections
    { code: "01-2410-5100", desc: "Building Commissioner" },
    { code: "01-2410-5110", desc: "Building Inspector" },
    { code: "01-2410-5120", desc: "Plumbing Inspector" },
    { code: "01-2410-5130", desc: "Electrical Inspector" },
    { code: "01-2410-5140", desc: "Gas Inspector" },
    
    // Education (Regional Assessment)
    { code: "01-3000-5100", desc: "School / Regional Assessment" },
    { code: "01-3001-5100", desc: "School Debt/Capital" },
    { code: "01-3002-5100", desc: "School Transportation" },
    
    // Public Works
    { code: "01-4200-5100", desc: "Public Works Department" },
    { code: "01-4200-5110", desc: "DPW Director" },
    { code: "01-4200-5120", desc: "DPW Workers" },
    { code: "01-4200-5130", desc: "DPW Seasonal" },
    { code: "01-4200-5140", desc: "DPW Administrative" },
    { code: "01-4200-5150", desc: "DPW Overtime" },
    
    // Highway Department
    { code: "01-4220-5100", desc: "Highway Department" },
    { code: "01-4220-5110", desc: "Highway Superintendent" },
    { code: "01-4220-5120", desc: "Highway Workers" },
    { code: "01-4220-5130", desc: "Highway Overtime" },
    
    // Snow & Ice
    { code: "01-4230-5100", desc: "Snow & Ice Removal" },
    { code: "01-4230-5110", desc: "Snow Overtime" },
    { code: "01-4230-5120", desc: "Snow Contractors" },
    
    // Transfer Station
    { code: "01-4330-5100", desc: "Transfer Station" },
    { code: "01-4330-5110", desc: "Transfer Station Attendant" },
    
    // Board of Health
    { code: "01-5120-5100", desc: "Board of Health" },
    { code: "01-5120-5110", desc: "Health Agent" },
    { code: "01-5120-5120", desc: "Health Inspector" },
    { code: "01-5120-5130", desc: "Health Administrative" },
    
    // Council on Aging
    { code: "01-5410-5100", desc: "Senior Center / COA" },
    { code: "01-5410-5110", desc: "COA Director" },
    { code: "01-5410-5120", desc: "COA Coordinator" },
    { code: "01-5410-5130", desc: "COA Driver" },
    { code: "01-5411-5100", desc: "Senior Center / COA (Grant)" },
    
    // Veterans Services
    { code: "01-5430-5100", desc: "Veterans Services" },
    { code: "01-5430-5110", desc: "Veterans Agent" },
    
    // Library
    { code: "01-6100-5100", desc: "Library" },
    { code: "01-6100-5110", desc: "Library Director" },
    { code: "01-6100-5120", desc: "Library Assistant" },
    { code: "01-6100-5130", desc: "Library Aide" },
    
    // Recreation
    { code: "01-6300-5100", desc: "Recreation" },
    { code: "01-6301-5100", desc: "Recreation (Grant)" },
    { code: "01-6300-5110", desc: "Recreation Director" },
    { code: "01-6300-5120", desc: "Recreation Coordinator" },
    
    // Cemetery
    { code: "01-4950-5100", desc: "Cemetery" },
    { code: "01-4950-5110", desc: "Cemetery Superintendent" },
    { code: "01-4950-5120", desc: "Cemetery Workers" },
    
    // Conservation
    { code: "01-1710-5100", desc: "Conservation Commission" },
    { code: "01-1710-5110", desc: "Conservation Agent" },
    
    // Planning Board
    { code: "01-1750-5100", desc: "Planning Board" },
    { code: "01-1750-5110", desc: "Town Planner" },
    
    // Zoning Board
    { code: "01-1760-5100", desc: "Zoning Board of Appeals" },
    
    // Historical Commission
    { code: "01-6920-5100", desc: "Historical Commission" },
    
    // Economic Development
    { code: "01-6950-5100", desc: "Economic Development" },
    
    // Emergency Management
    { code: "01-2920-5100", desc: "Emergency Management" },
    { code: "01-2920-5110", desc: "Emergency Management Director" }
  ];

  // Department-level Personnel GLs (for defaults) - Updated with actual Town codes
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

  // Position-level mappings - Updated with actual Town 
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

  // Multi-position choices per employee - Updated with actual Town codes
  const EMPLOYEE_POSITIONS = {
    "PATRICIA LOWE": [
      { title: "Executive Assistant (Select Board)", gl: "1000-122-5100-0000", rate: 23.38 },
      { title: "Library Assistant", gl: "1000-610-5100-0000", rate: 17.57 }
    ],
    "NANCY PERRON": [
      { title: "Police Administrative Assistant", gl: "1000-210-5100-0000" },
      { title: "Board of Health Clerk", gl: "1000-241-5100-0000" }
    ],
    "LEEANN E MOSES": [
      { title: "Assessor Administrative", gl: "1000-141-5100-0000" },
      { title: "Land Use Administrative", gl: "1000-241-5100-0000" }
    ]
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
      // Get all relevant GL choices for this employee
      const choices = getEmployeeGLChoices(emp);
      
      // Add employee-specific choices first (these are the most relevant)
      choices.forEach(choice => {
        const option = document.createElement('option');
        option.value = choice.value;
        option.label = choice.label; // This shows in the autocomplete dropdown
        dl.appendChild(option);
      });
      
      // Add a separator comment (not visible to user but helps in debugging)
      dl.appendChild(document.createComment('--- General Town GL Codes ---'));
    }
    
    // Add all Town of Hubbardston Personnel GL Accounts as fallback options
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
    
    // Only add town codes that aren't already in employee choices
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

  // Enhanced GL input creation with better autocomplete
  function createGLInput(initialGL = '', emp = null) {
    const hasMulti = emp && EMPLOYEE_POSITIONS[emp.name] && EMPLOYEE_POSITIONS[emp.name].length;
    
    const glDiv = document.createElement('div');
    glDiv.className = 'gl-cell';
    
    // Main GL input with datalist
    const glInput = document.createElement('input');
    glInput.type = 'text';
    glInput.setAttribute('list', 'glList');
    glInput.className = 'gl-input input';
    glInput.placeholder = 'Type GL code or search...';
    glInput.value = initialGL || getDefaultGL(emp);
    glInput.style.minWidth = '15ch';
    glInput.setAttribute('autocomplete', 'off');
    
    // Add search-as-you-type functionality
    glInput.addEventListener('input', function() {
      const query = this.value.toLowerCase();
      const datalist = document.getElementById('glList');
      if (!datalist) return;
      
      // Hide/show options based on search
      Array.from(datalist.options).forEach(option => {
        const matches = option.value.toLowerCase().includes(query) || 
                       (option.label && option.label.toLowerCase().includes(query));
        option.style.display = matches ? '' : 'none';
      });
    });
    
    glDiv.appendChild(glInput);
    
    // Quick select dropdown for multi-role employees
    if (hasMulti) {
      const glChooser = document.createElement('select');
      glChooser.className = 'gl-chooser input';
      glChooser.style.marginTop = 'var(--space-xs)';
      
      // Add default option
      const defaultOption = document.createElement('option');
      defaultOption.value = '';
      defaultOption.textContent = 'Quick select role...';
      glChooser.appendChild(defaultOption);
      
      // Add employee-specific positions
      EMPLOYEE_POSITIONS[emp.name].forEach(position => {
        const option = document.createElement('option');
        option.value = position.gl;
        option.textContent = position.title;
        glChooser.appendChild(option);
      });
      
      // Wire up the chooser to update the main input
      glChooser.addEventListener('change', function() {
        if (this.value) {
          glInput.value = this.value;
          // Trigger input event to recalculate totals
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
    // Show employee details section when populated
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

    // Supplemental action buttons - using direct function calls
    const split = $('#splitShiftBtn');  
    if (split) {
      split.addEventListener('click', () => {
        // Super simple split shift - just add a new row
        addTimeRow();
        setMsg('New row added for split shift.', 'success', true);
      });
    }
    const ot    = $('#overtimeBtn');    if (ot)    ot.addEventListener('click', addOvertimeDay);
    const sick  = $('#sickBtn');        if (sick)  sick.addEventListener('click', addSickDay);
    const vac   = $('#vacationBtn');    if (vac)   vac.addEventListener('click', addVacationDay);

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
    
    // Create all cells except GL cell
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

    // Insert the custom GL cell
    const glCell = tr.children[5]; // 6th cell (0-indexed)
    const glInput = createGLInput(glCode || getDefaultGL(currentEmployee), currentEmployee);
    glCell.appendChild(glInput);

    tbody.appendChild(tr);

    // Pre-compute if regular + start/end provided
    if (start && end && type === 'Regular') {
      tr.querySelector('.time-hours').value = timeDiffHours(start, end).toFixed(2);
    }

    // Wire up all the events
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
      
      // Clear the values in the new row but keep date and GL
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

      // Replace the GL cell with proper component
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
      
      // Clear the values in the new row but keep date and GL
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

      // Replace the GL cell with proper component
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

  // ---- Supplemental Actions (Integrated) ----
  
  // Split shift - add a new row for clocking back in after breaks
  function addSplitShift() {
    const tbody = document.getElementById('timeBody');
    if (!tbody || tbody.children.length === 0) {
      setMsg('Add a time entry first before splitting shifts.', 'error', true);
      return;
    }

    const lastRow = tbody.children[tbody.children.length - 1];
    const dateInput = lastRow.querySelector('.date-cell');
    const glInput = lastRow.querySelector('.gl-input');
    const typeSelect = lastRow.querySelector('.time-type');
    
    if (!dateInput) {
      setMsg('Could not find date in the last row.', 'error', true);
      return;
    }

    const date = dateInput.value;
    const gl = glInput ? glInput.value : getDefaultGL(currentEmployee);
    const type = typeSelect ? typeSelect.value : 'Regular';
    
    if (!date) {
      setMsg('Enter a date in the last row before splitting shifts.', 'error', true);
      return;
    }

    // Add a new blank row with same date and GL for clocking back in
    addTimeRowWith(date, '', '', '', type, gl, '');
    
    setMsg('New row added for clocking back in.', 'success', true);
  }

  function addQuickDay(kind, label, defaultHours = '8.00') {
    if (!currentEmployee) {
      setMsg('Please select an employee first.', 'error', true);
      return;
    }

    const today = new Date().toISOString().slice(0, 10);
    const gl = getDefaultGL(currentEmployee);
    
    addTimeRowWith(today, '', '', defaultHours, kind, gl, label);
    calculateTotals();
    setMsg(`${label} added successfully.`, 'success', true);
  }

  function addOvertimeDay() { 
    addQuickDay('Regular', 'Overtime Day', '10.00');
  }
  
  function addSickDay() { 
    addQuickDay('Sick', 'Sick Day', '8.00');
  }
  
  function addVacationDay() { 
    addQuickDay('Vacation', 'Vacation Day', '8.00');
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

    // Bi-weekly schedule: Mon/Wed/Thu 8-4, Tuesday 8-6
    const schedule = {
      1: { start: "08:00", end: "16:00" }, // Monday 8-4
      2: { start: "08:00", end: "18:00" }, // Tuesday 8-6  
      3: { start: "08:00", end: "16:00" }, // Wednesday 8-4
      4: { start: "08:00", end: "16:00" }  // Thursday 8-4
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
          glBreakdown[gl] = {
            regular: 0,
            sick: 0,
            personal: 0,
            vacation: 0,
            holiday: 0,
            total: 0
          };
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

    // Calculate costs if employee and rate are available
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
          // Check for position-specific rate
          let rate = currentEmployee.rate;
          if (currentEmployee.name && EMPLOYEE_POSITIONS[currentEmployee.name]) {
            const position = EMPLOYEE_POSITIONS[currentEmployee.name].find(pos => pos.gl === gl && pos.rate);
            if (position) rate = position.rate;
          }
          
          const regularCost = breakdown.regular * rate;
          const overtimeCost = 0; // Would need weekly calculation
          const leaveCost = (breakdown.sick + breakdown.personal + breakdown.vacation + breakdown.holiday) * rate;
          const totalCost = regularCost + overtimeCost + leaveCost;
          
          costCells = `
            <td>${currency(regularCost)}</td>
            <td>${currency(overtimeCost)}</td>
            <td>${currency(leaveCost)}</td>
            <td><strong>${currency(totalCost)}</strong></td>`;
        } else {
          // Salary allocation
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

    // Render hour totals
    const setTxt = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v.toFixed(2); };
    setTxt('totalHours', totalHours);
    setTxt('sumRegular', regPayable);
    setTxt('sumSick', sick);
    setTxt('sumPersonal', pers);
    setTxt('sumVacation', vac);
    setTxt('sumHoliday', hol);

    // Pay calculation - handle position-specific rates
    let gross = 0;
    if (currentEmployee && currentEmployee.rate) {
      if (currentEmployee.payType === 'hourly') {
        // Check if employee has position-specific rates
        const hasPositionRates = currentEmployee.name && EMPLOYEE_POSITIONS[currentEmployee.name] && 
                                EMPLOYEE_POSITIONS[currentEmployee.name].some(pos => pos.rate);
        
        if (hasPositionRates) {
          // Calculate pay by GL code for position-specific rates
          let totalPay = 0;
          rows.forEach(row => {
            const hours = parseFloat(row.querySelector('.time-hours')?.value || 0) || 0;
            const type = row.querySelector('.time-type')?.value || 'Regular';
            const gl = row.querySelector('.gl-input')?.value || '';
            
            if (hours > 0) {
              // Find rate for this GL code
              const position = EMPLOYEE_POSITIONS[currentEmployee.name].find(pos => pos.gl === gl);
              const rate = position && position.rate ? position.rate : currentEmployee.rate;
              
              if (type === 'Regular') {
                // Note: Overtime calculation with different rates would be complex
                totalPay += hours * rate;
              } else {
                // Leave pay at regular rate
                totalPay += hours * rate;
              }
            }
          });
          gross = totalPay;
        } else {
          // Standard single-rate calculation
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
    
    // Update GL review whenever totals change
    updateGLReview();
  }

  // ---- Submit ----
  async function handleSubmit(e) {
    e.preventDefault();
    if (!currentEmployee) { 
      setMsg("Please select an employee.", "error", true); 
      return; 
    }
    if (!currentWarrant)  { 
      setMsg("Please select a pay period.", "error", true); 
      return; 
    }

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

    if (!entries.length) { 
      setMsg("Add at least one time entry.", "error", true); 
      return; 
    }

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

  return api;
})();
