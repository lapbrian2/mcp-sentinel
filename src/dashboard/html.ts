export function getDashboardHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>MCP Sentinel Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0a;--surface:#141414;--surface2:#1a1a1a;--border:#262626;
  --text:#fafafa;--muted:#a1a1aa;--allow:#22c55e;--deny:#ef4444;
  --warn:#f59e0b;--info:#3b82f6;--font:'Inter',sans-serif;--mono:'JetBrains Mono',monospace;
}
html{height:100%}
body{background:var(--bg);color:var(--text);font-family:var(--font);font-size:14px;line-height:1.5;display:flex;height:100%}

/* Sidebar */
#sidebar{width:200px;flex-shrink:0;background:var(--surface);border-right:1px solid var(--border);display:flex;flex-direction:column;padding:0}
#sidebar header{padding:20px 16px 16px;border-bottom:1px solid var(--border)}
#sidebar header h1{font-size:13px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:var(--muted)}
#sidebar header p{font-size:12px;color:var(--muted);margin-top:2px}
#sidebar nav{flex:1;padding:8px 0}
.nav-item{display:flex;align-items:center;gap:8px;padding:8px 16px;cursor:pointer;color:var(--muted);font-size:13px;border-left:2px solid transparent;transition:all .1s}
.nav-item:hover{color:var(--text);background:var(--surface2)}
.nav-item.active{color:var(--text);border-left-color:var(--info);background:var(--surface2)}
.nav-item svg{width:14px;height:14px;flex-shrink:0}
#sidebar footer{padding:12px 16px;border-top:1px solid var(--border);font-size:11px;color:var(--muted)}
#status-dot{display:inline-block;width:6px;height:6px;border-radius:50%;background:var(--allow);margin-right:6px;vertical-align:middle}

/* Main */
#main{flex:1;overflow-y:auto;display:flex;flex-direction:column}
.page{display:none;padding:24px;flex:1}
.page.active{display:block}
.page-title{font-size:18px;font-weight:600;margin-bottom:20px}

/* Stat cards */
.stats-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:12px;margin-bottom:24px}
.stat-card{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:16px}
.stat-card .label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:8px}
.stat-card .value{font-size:24px;font-weight:600}
.stat-card .value.allow{color:var(--allow)}
.stat-card .value.deny{color:var(--deny)}
.stat-card .value.warn{color:var(--warn)}
.stat-card .sub{font-size:11px;color:var(--muted);margin-top:4px}

/* Tables */
.table-wrap{background:var(--surface);border:1px solid var(--border);border-radius:4px;overflow:hidden;margin-bottom:20px}
.table-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border)}
.table-header h3{font-size:13px;font-weight:500}
table{width:100%;border-collapse:collapse}
th{text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);padding:8px 16px;border-bottom:1px solid var(--border);font-weight:500;white-space:nowrap}
td{padding:8px 16px;font-size:13px;border-bottom:1px solid var(--border);vertical-align:middle}
tr:last-child td{border-bottom:none}
tr:hover td{background:var(--surface2)}
.mono{font-family:var(--mono);font-size:12px}

/* Badges */
.badge{display:inline-flex;align-items:center;padding:2px 8px;border-radius:2px;font-size:11px;font-weight:500;text-transform:uppercase;letter-spacing:.05em}
.badge.allow{background:rgba(34,197,94,.15);color:var(--allow)}
.badge.deny{background:rgba(239,68,68,.15);color:var(--deny)}
.badge.warn{background:rgba(245,158,11,.15);color:var(--warn)}
.badge.info{background:rgba(59,130,246,.15);color:var(--info)}
.badge.low{background:rgba(113,113,122,.15);color:var(--muted)}
.badge.medium{background:rgba(245,158,11,.15);color:var(--warn)}
.badge.high{background:rgba(239,68,68,.15);color:var(--deny)}
.badge.critical{background:rgba(239,68,68,.25);color:#ff6b6b}

/* Filters */
.filters{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap}
.filters select,.filters input{background:var(--surface);border:1px solid var(--border);color:var(--text);padding:6px 10px;border-radius:3px;font-size:13px;font-family:var(--font)}
.filters select:focus,.filters input:focus{outline:none;border-color:var(--info)}
.btn{background:var(--surface2);border:1px solid var(--border);color:var(--text);padding:6px 14px;border-radius:3px;font-size:13px;cursor:pointer;font-family:var(--font)}
.btn:hover{border-color:var(--info);color:var(--info)}
.btn.primary{background:var(--info);border-color:var(--info);color:#fff}
.btn.primary:hover{background:#2563eb}
.btn.danger{color:var(--deny);border-color:var(--deny)}
.btn.danger:hover{background:rgba(239,68,68,.1)}

/* Modal */
#modal-overlay{display:none;position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:100;align-items:center;justify-content:center}
#modal-overlay.open{display:flex}
.modal{background:var(--surface);border:1px solid var(--border);border-radius:4px;padding:24px;width:400px;max-width:90vw}
.modal h3{font-size:15px;font-weight:600;margin-bottom:16px}
.form-field{margin-bottom:12px}
.form-field label{display:block;font-size:12px;color:var(--muted);margin-bottom:4px}
.form-field input,.form-field select{width:100%;background:var(--bg);border:1px solid var(--border);color:var(--text);padding:8px 10px;border-radius:3px;font-size:13px;font-family:var(--font)}
.form-field input:focus,.form-field select:focus{outline:none;border-color:var(--info)}
.modal-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:20px}
.key-reveal{background:var(--bg);border:1px solid var(--allow);border-radius:3px;padding:10px;margin:12px 0;font-family:var(--mono);font-size:12px;word-break:break-all;color:var(--allow)}
.key-notice{font-size:12px;color:var(--warn);margin-bottom:4px}

/* Empty/loading */
.empty{padding:32px;text-align:center;color:var(--muted);font-size:13px}
.loading{padding:32px;text-align:center;color:var(--muted);font-size:13px}

/* Pagination */
.pagination{display:flex;align-items:center;gap:8px;padding:12px 16px;border-top:1px solid var(--border);justify-content:flex-end}
.pagination span{font-size:12px;color:var(--muted)}

/* Top lists */
.top-list{display:flex;flex-direction:column;gap:4px}
.top-item{display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px}
.top-item:last-child{border-bottom:none}
.top-item .name{font-family:var(--mono);color:var(--muted)}
.top-item .count{color:var(--text);font-weight:500}
.top-bar{height:3px;background:var(--info);border-radius:1px;margin-top:3px}

.two-col{display:grid;grid-template-columns:1fr 1fr;gap:16px}
@media(max-width:700px){.two-col{grid-template-columns:1fr}.sidebar-toggle{display:block}}
</style>
</head>
<body>

<nav id="sidebar">
  <header>
    <h1>MCP Sentinel</h1>
    <p id="sentinel-version">v0.1.0</p>
  </header>
  <nav>
    <div class="nav-item active" data-page="overview">
      <svg viewBox="0 0 16 16" fill="currentColor"><path d="M1 2h6v6H1V2zm0 8h6v5H1v-5zm8-8h6v5H9V2zm0 7h6v6H9V9z"/></svg>
      Overview
    </div>
    <div class="nav-item" data-page="audit">
      <svg viewBox="0 0 16 16" fill="currentColor"><path d="M2 2h12v1H2V2zm0 3h12v1H2V5zm0 3h8v1H2V8zm0 3h10v1H2v-1z"/></svg>
      Audit Log
    </div>
    <div class="nav-item" data-page="violations">
      <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L1 14h14L8 1zm0 2.3L13.2 13H2.8L8 3.3zM7.5 7h1v3h-1V7zm0 4h1v1h-1v-1z"/></svg>
      Violations
    </div>
    <div class="nav-item" data-page="policies">
      <svg viewBox="0 0 16 16" fill="currentColor"><path d="M8 1L2 3v5c0 3.3 2.5 6.4 6 7.4 3.5-1 6-4.1 6-7.4V3L8 1zm0 1.7l5 1.7V8c0 2.6-2 5-5 5.9-3-1-5-3.3-5-5.9V4.4l5-1.7z"/></svg>
      Policies
    </div>
    <div class="nav-item" data-page="keys">
      <svg viewBox="0 0 16 16" fill="currentColor"><path d="M10 1a5 5 0 0 1 2 9.6V14h-2v2H8v-2H6v-2h4V10.6A5 5 0 0 1 10 1zm0 1.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zm0 1.5a2 2 0 1 1 0 4 2 2 0 0 1 0-4z"/></svg>
      API Keys
    </div>
  </nav>
  <footer>
    <span id="status-dot"></span>
    <span id="status-label">Connected</span>
  </footer>
</nav>

<main id="main">

  <!-- Overview -->
  <div class="page active" id="page-overview">
    <div class="page-title">Overview</div>
    <div class="stats-grid">
      <div class="stat-card">
        <div class="label">Total Calls</div>
        <div class="value" id="stat-total">—</div>
        <div class="sub" id="stat-lasthour">— last hour</div>
      </div>
      <div class="stat-card">
        <div class="label">Allowed</div>
        <div class="value allow" id="stat-allowed">—</div>
      </div>
      <div class="stat-card">
        <div class="label">Denied</div>
        <div class="value deny" id="stat-denied">—</div>
      </div>
      <div class="stat-card">
        <div class="label">Violations</div>
        <div class="value warn" id="stat-violations">—</div>
      </div>
      <div class="stat-card">
        <div class="label">Avg Latency</div>
        <div class="value" id="stat-latency">—</div>
        <div class="sub">milliseconds</div>
      </div>
    </div>
    <div class="two-col">
      <div class="table-wrap">
        <div class="table-header"><h3>Top Tools</h3></div>
        <div style="padding:16px" id="top-tools"><div class="loading">Loading...</div></div>
      </div>
      <div class="table-wrap">
        <div class="table-header"><h3>Top Callers</h3></div>
        <div style="padding:16px" id="top-callers"><div class="loading">Loading...</div></div>
      </div>
    </div>
    <div class="table-wrap">
      <div class="table-header"><h3>Recent Activity</h3></div>
      <table>
        <thead><tr><th>Time</th><th>Caller</th><th>Method</th><th>Tool</th><th>Decision</th><th>Latency</th></tr></thead>
        <tbody id="recent-table"><tr><td colspan="6" class="loading">Loading...</td></tr></tbody>
      </table>
    </div>
  </div>

  <!-- Audit Log -->
  <div class="page" id="page-audit">
    <div class="page-title">Audit Log</div>
    <div class="filters">
      <input type="text" id="audit-caller" placeholder="Caller ID" style="width:140px">
      <input type="text" id="audit-tool" placeholder="Tool name" style="width:140px">
      <select id="audit-decision">
        <option value="">All decisions</option>
        <option value="allow">Allow</option>
        <option value="deny">Deny</option>
      </select>
      <button class="btn primary" onclick="loadAudit()">Filter</button>
      <button class="btn" onclick="exportAudit('json')">Export JSON</button>
      <button class="btn" onclick="exportAudit('csv')">Export CSV</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Caller</th><th>Role</th><th>Method</th><th>Tool</th><th>Decision</th><th>Rule</th><th>Latency</th></tr></thead>
        <tbody id="audit-table"><tr><td colspan="8" class="loading">Loading...</td></tr></tbody>
      </table>
      <div class="pagination">
        <span id="audit-page-info">—</span>
        <button class="btn" id="audit-prev" onclick="auditPage(-1)">Prev</button>
        <button class="btn" id="audit-next" onclick="auditPage(1)">Next</button>
      </div>
    </div>
  </div>

  <!-- Violations -->
  <div class="page" id="page-violations">
    <div class="page-title">Violations</div>
    <div class="filters">
      <select id="viol-severity">
        <option value="">All severities</option>
        <option value="critical">Critical</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select id="viol-type">
        <option value="">All types</option>
        <option value="policy_deny">Policy Deny</option>
        <option value="scan_alert">Scan Alert</option>
      </select>
      <button class="btn primary" onclick="loadViolations()">Filter</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Time</th><th>Type</th><th>Severity</th><th>Rule</th><th>Detail</th><th>Audit ID</th></tr></thead>
        <tbody id="violations-table"><tr><td colspan="6" class="loading">Loading...</td></tr></tbody>
      </table>
      <div class="pagination">
        <span id="viol-page-info">—</span>
        <button class="btn" id="viol-prev" onclick="violPage(-1)">Prev</button>
        <button class="btn" id="viol-next" onclick="violPage(1)">Next</button>
      </div>
    </div>
  </div>

  <!-- Policies -->
  <div class="page" id="page-policies">
    <div class="page-title">Policies</div>
    <div id="policies-content"><div class="loading">Loading...</div></div>
  </div>

  <!-- API Keys -->
  <div class="page" id="page-keys">
    <div class="page-title">API Keys</div>
    <div style="margin-bottom:16px">
      <button class="btn primary" onclick="openCreateKey()">+ Create Key</button>
    </div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Name</th><th>Role</th><th>Created</th><th>Last Used</th><th>Status</th><th></th></tr></thead>
        <tbody id="keys-table"><tr><td colspan="6" class="loading">Loading...</td></tr></tbody>
      </table>
    </div>
  </div>

</main>

<!-- Modal: create key -->
<div id="modal-overlay">
  <div class="modal" id="modal-content">
    <div id="modal-create">
      <h3>Create API Key</h3>
      <div class="form-field">
        <label>Name</label>
        <input type="text" id="key-name" placeholder="e.g. analytics-agent">
      </div>
      <div class="form-field">
        <label>Role</label>
        <select id="key-role">
          <option value="analyst">analyst</option>
          <option value="engineer">engineer</option>
          <option value="admin">admin</option>
        </select>
      </div>
      <div class="modal-actions">
        <button class="btn" onclick="closeModal()">Cancel</button>
        <button class="btn primary" onclick="submitCreateKey()">Create</button>
      </div>
    </div>
    <div id="modal-reveal" style="display:none">
      <h3>Key Created</h3>
      <div class="key-notice">Copy this key now — it won't be shown again.</div>
      <div class="key-reveal" id="new-key-value"></div>
      <div class="modal-actions">
        <button class="btn primary" onclick="closeModal()">Done</button>
      </div>
    </div>
  </div>
</div>

<script>
const API = '';

// State
let auditOffset = 0;
let violOffset = 0;
const PAGE_SIZE = 50;

// Nav
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    item.classList.add('active');
    document.getElementById('page-' + item.dataset.page).classList.add('active');
    if (item.dataset.page === 'audit') loadAudit();
    if (item.dataset.page === 'violations') loadViolations();
    if (item.dataset.page === 'policies') loadPolicies();
    if (item.dataset.page === 'keys') loadKeys();
  });
});

function fmt(ts) {
  return new Date(ts).toLocaleString();
}
function fmtAge(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return s + 's ago';
  if (s < 3600) return Math.floor(s/60) + 'm ago';
  return Math.floor(s/3600) + 'h ago';
}
function decision(d) {
  return '<span class="badge ' + d + '">' + d + '</span>';
}
function severity(s) {
  return '<span class="badge ' + s + '">' + s + '</span>';
}
function mono(v) {
  return v ? '<span class="mono">' + esc(v) + '</span>' : '<span style="color:var(--muted)">—</span>';
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// Overview
async function loadOverview() {
  try {
    const [stats, audit] = await Promise.all([
      fetch(API + '/api/stats').then(r => r.json()),
      fetch(API + '/api/audit?limit=20').then(r => r.json()),
    ]);

    document.getElementById('stat-total').textContent = stats.totalCalls ?? 0;
    document.getElementById('stat-lasthour').textContent = (stats.callsLastHour ?? 0) + ' last hour';
    document.getElementById('stat-allowed').textContent = stats.allowedCalls ?? 0;
    document.getElementById('stat-denied').textContent = stats.deniedCalls ?? 0;
    document.getElementById('stat-violations').textContent = stats.violationCount ?? 0;
    document.getElementById('stat-latency').textContent = (stats.avgLatencyMs ?? 0) + 'ms';

    const maxTool = stats.topTools?.[0]?.count || 1;
    document.getElementById('top-tools').innerHTML = stats.topTools?.length
      ? '<div class="top-list">' + stats.topTools.map(t =>
          '<div class="top-item"><div><div class="name">' + esc(t.toolName) + '</div><div class="top-bar" style="width:' + Math.round(t.count/maxTool*100) + '%"></div></div><div class="count">' + t.count + '</div></div>'
        ).join('') + '</div>'
      : '<div class="empty">No tool calls yet</div>';

    const maxCaller = stats.topCallers?.[0]?.count || 1;
    document.getElementById('top-callers').innerHTML = stats.topCallers?.length
      ? '<div class="top-list">' + stats.topCallers.map(c =>
          '<div class="top-item"><div><div class="name">' + esc(c.callerId) + '</div><div class="top-bar" style="width:' + Math.round(c.count/maxCaller*100) + '%"></div></div><div class="count">' + c.count + '</div></div>'
        ).join('') + '</div>'
      : '<div class="empty">No callers yet</div>';

    const entries = audit.entries || [];
    document.getElementById('recent-table').innerHTML = entries.length
      ? entries.map(e => '<tr><td>' + fmtAge(e.timestamp) + '</td><td>' + mono(e.caller_id || e.callerId) + '</td><td>' + mono(e.method) + '</td><td>' + mono(e.tool_name || e.toolName) + '</td><td>' + decision(e.policy_decision || e.policyDecision) + '</td><td class="mono">' + (e.latency_ms || e.latencyMs) + 'ms</td></tr>').join('')
      : '<tr><td colspan="6" class="empty">No calls logged yet</td></tr>';

    document.getElementById('status-dot').style.background = 'var(--allow)';
    document.getElementById('status-label').textContent = 'Connected';
  } catch (e) {
    document.getElementById('status-dot').style.background = 'var(--deny)';
    document.getElementById('status-label').textContent = 'Disconnected';
  }
}

// Audit
async function loadAudit() {
  const caller = document.getElementById('audit-caller').value.trim();
  const tool = document.getElementById('audit-tool').value.trim();
  const decision2 = document.getElementById('audit-decision').value;

  let url = API + '/api/audit?limit=' + PAGE_SIZE + '&offset=' + auditOffset;
  if (caller) url += '&caller=' + encodeURIComponent(caller);
  if (tool) url += '&tool=' + encodeURIComponent(tool);
  if (decision2) url += '&decision=' + decision2;

  document.getElementById('audit-table').innerHTML = '<tr><td colspan="8" class="loading">Loading...</td></tr>';
  try {
    const data = await fetch(url).then(r => r.json());
    const entries = data.entries || [];
    document.getElementById('audit-table').innerHTML = entries.length
      ? entries.map(e => {
          const d = e.policy_decision || e.policyDecision;
          const t = e.tool_name || e.toolName;
          const r = e.matched_rule || e.matchedRule;
          const l = e.latency_ms || e.latencyMs;
          return '<tr><td>' + fmt(e.timestamp) + '</td><td>' + mono(e.caller_id || e.callerId) + '</td><td>' + mono(e.caller_role || e.callerRole) + '</td><td>' + mono(e.method) + '</td><td>' + mono(t) + '</td><td>' + decision(d) + '</td><td>' + mono(r) + '</td><td class="mono">' + l + 'ms</td></tr>';
        }).join('')
      : '<tr><td colspan="8" class="empty">No entries</td></tr>';
    document.getElementById('audit-page-info').textContent = 'Showing ' + (auditOffset+1) + '–' + (auditOffset + entries.length);
    document.getElementById('audit-prev').disabled = auditOffset === 0;
    document.getElementById('audit-next').disabled = entries.length < PAGE_SIZE;
  } catch {
    document.getElementById('audit-table').innerHTML = '<tr><td colspan="8" class="empty">Error loading audit log</td></tr>';
  }
}

function auditPage(dir) {
  auditOffset = Math.max(0, auditOffset + dir * PAGE_SIZE);
  loadAudit();
}

function exportAudit(fmt2) {
  window.open(API + '/api/audit/export?format=' + fmt2, '_blank');
}

// Violations
async function loadViolations() {
  const severity2 = document.getElementById('viol-severity').value;
  const type = document.getElementById('viol-type').value;

  let url = API + '/api/violations?limit=' + PAGE_SIZE + '&offset=' + violOffset;
  if (severity2) url += '&severity=' + severity2;
  if (type) url += '&type=' + type;

  document.getElementById('violations-table').innerHTML = '<tr><td colspan="6" class="loading">Loading...</td></tr>';
  try {
    const data = await fetch(url).then(r => r.json());
    const violations = data.violations || [];
    document.getElementById('violations-table').innerHTML = violations.length
      ? violations.map(v => '<tr><td>' + fmt(v.timestamp) + '</td><td><span class="badge info">' + esc(v.type) + '</span></td><td>' + severity(v.severity) + '</td><td>' + mono(v.ruleId || v.rule_id) + '</td><td>' + esc(v.detail) + '</td><td>' + mono((v.auditLogId || v.audit_log_id || '').slice(0,8)) + '</td></tr>').join('')
      : '<tr><td colspan="6" class="empty">No violations</td></tr>';
    document.getElementById('viol-page-info').textContent = 'Showing ' + (violOffset+1) + '–' + (violOffset + violations.length);
    document.getElementById('viol-prev').disabled = violOffset === 0;
    document.getElementById('viol-next').disabled = violations.length < PAGE_SIZE;
  } catch {
    document.getElementById('violations-table').innerHTML = '<tr><td colspan="6" class="empty">Error loading violations</td></tr>';
  }
}

function violPage(dir) {
  violOffset = Math.max(0, violOffset + dir * PAGE_SIZE);
  loadViolations();
}

// Policies
async function loadPolicies() {
  try {
    const data = await fetch(API + '/api/policies').then(r => r.json());
    const roles = data.roles || {};
    let html = '<div style="margin-bottom:8px;font-size:12px;color:var(--muted)">Default role: <strong style="color:var(--text)">' + esc(data.defaultRole) + '</strong></div>';
    html += Object.entries(roles).map(([name, role]) => {
      const r = role;
      return '<div class="table-wrap" style="margin-bottom:12px"><div class="table-header"><h3>' + esc(name) + '</h3>' + (r.description ? '<span style="color:var(--muted);font-size:12px">' + esc(r.description) + '</span>' : '') + '</div><table><thead><tr><th>Effect</th><th>Pattern</th><th>Tools</th></tr></thead><tbody>' +
        (r.rules || []).map(rule => {
          const effect = rule.allow !== undefined ? 'allow' : 'deny';
          const pattern = rule.allow ?? rule.deny;
          const tools = rule.tools ? rule.tools.join(', ') : '—';
          return '<tr><td>' + decision(effect) + '</td><td>' + mono(Array.isArray(pattern) ? pattern.join(', ') : pattern) + '</td><td>' + mono(tools) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    }).join('');
    document.getElementById('policies-content').innerHTML = html || '<div class="empty">No policies loaded</div>';
  } catch {
    document.getElementById('policies-content').innerHTML = '<div class="empty">Error loading policies</div>';
  }
}

// API Keys
async function loadKeys() {
  try {
    const data = await fetch(API + '/api/keys').then(r => r.json());
    const keys = data.keys || [];
    document.getElementById('keys-table').innerHTML = keys.length
      ? keys.map(k => '<tr><td>' + esc(k.name) + '</td><td><span class="badge info">' + esc(k.role) + '</span></td><td>' + fmt(k.createdAt) + '</td><td>' + (k.lastUsed ? fmtAge(k.lastUsed) : '<span style="color:var(--muted)">Never</span>') + '</td><td><span class="badge allow">Active</span></td><td><button class="btn danger" onclick="revokeKey(\'' + esc(k.id) + '\')">Revoke</button></td></tr>').join('')
      : '<tr><td colspan="6" class="empty">No API keys — create one to enable authentication</td></tr>';
  } catch {
    document.getElementById('keys-table').innerHTML = '<tr><td colspan="6" class="empty">Error loading keys</td></tr>';
  }
}

function openCreateKey() {
  document.getElementById('modal-create').style.display = '';
  document.getElementById('modal-reveal').style.display = 'none';
  document.getElementById('key-name').value = '';
  document.getElementById('modal-overlay').classList.add('open');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('open');
  loadKeys();
}

async function submitCreateKey() {
  const name = document.getElementById('key-name').value.trim();
  const role = document.getElementById('key-role').value;
  if (!name) { document.getElementById('key-name').focus(); return; }

  try {
    const data = await fetch(API + '/api/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, role }),
    }).then(r => r.json());

    document.getElementById('new-key-value').textContent = data.key || data.id;
    document.getElementById('modal-create').style.display = 'none';
    document.getElementById('modal-reveal').style.display = '';
  } catch {
    alert('Failed to create key');
  }
}

async function revokeKey(id) {
  if (!confirm('Revoke this API key? This cannot be undone.')) return;
  try {
    await fetch(API + '/api/keys/' + id, { method: 'DELETE' });
    loadKeys();
  } catch {
    alert('Failed to revoke key');
  }
}

// Init
loadOverview();
setInterval(loadOverview, 10000);
</script>
</body>
</html>`;
}
