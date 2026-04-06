// AdmitGuard — audit.js
// Enhanced with PII masking, data visualization, and Remote API support

let allSubmissions = [];
let piiMaskingEnabled = true;
let RULES = {};
let socket = null;
let TOKEN = null;


document.addEventListener('DOMContentLoaded', async () => {
  // Load Auth Token for secure fetch
  const authData = await chrome.storage.local.get(['counselor_token']);
  TOKEN = authData.counselor_token;

  await loadRules();

  await loadSubmissions(); // Initial load

  // Set up real-time sync via WebSockets
  initSocket();

  // Instant refresh when user switches back to this tab (fallback)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !socket?.connected) {
      console.log('🛡️ Tab visible & Socket disconnected: Triggering refresh...');
      loadSubmissions();
    }
  });


  document.getElementById('searchInput').addEventListener('input', renderTable);

  document.getElementById('filterSelect').addEventListener('change', renderTable);
  document.getElementById('exportBtn').addEventListener('click', exportCSV);
  document.getElementById('clearBtn').addEventListener('click', clearAll);
  document.getElementById('syncBtn').addEventListener('click', manualSync);
  
  const piiToggle = document.getElementById('piiToggle');
  piiToggle.classList.toggle('on', piiMaskingEnabled);
  document.getElementById('piiToggleGroup').addEventListener('click', () => {
    piiMaskingEnabled = !piiMaskingEnabled;
    piiToggle.classList.toggle('on', piiMaskingEnabled);
    renderTable();
  });

  document.getElementById('modalClose').addEventListener('click', () => {
    document.getElementById('detailModal').classList.remove('show');
  });
});

function initSocket() {
  if (!RULES.api_url || RULES.api_url === 'YOUR_DEPLOYED_BACKEND_URL_HERE') return;
  
  socket = io(RULES.api_url);

  socket.on('connect', () => {
    console.log('🛡️ Socket Connected: Real-time sync ACTIVE');
    
    // Authenticate to join the counselor-specific room
    if (TOKEN) {
      socket.emit('authenticate', { token: TOKEN, type: 'counselor' });
    }

    const badge = document.getElementById('liveBadge');
    if (badge) badge.style.display = 'flex';
  });

  socket.on('disconnect', () => {
    console.log('🛡️ Socket Disconnected');
    const badge = document.getElementById('liveBadge');
    if (badge) badge.style.display = 'none';
  });

  socket.on('new_submission', (sub) => {
    console.log('🛡️ Real-time Update: New submission received');
    // Normalize fields 
    const normalizedSub = {
      id: (sub.candidate_id || sub.id).toString(),
      timestamp: sub.timestamp,
      flagged: sub.flagged,
      exceptions_used: sub.exceptions_used || [],
      fields: typeof sub.fields === 'string' ? JSON.parse(sub.fields) : sub.fields,
      rationale: typeof sub.rationale === 'string' ? JSON.parse(sub.rationale) : sub.rationale,
      decision: sub.decision || 'pending'
    };
    
    // Check if ID already exists to avoid duplicates
    if (!allSubmissions.some(s => s.id === normalizedSub.id)) {
      allSubmissions.push(normalizedSub);
      updateDashboard();
    }
  });

  socket.on('decision_updated', (data) => {
    console.log('🛡️ Real-time Update: Decision updated', data);
    const sub = allSubmissions.find(s => s.id === data.candidate_id.toString());
    if (sub) {
      sub.decision = data.decision;
      updateDashboard();
    }
  });
}



async function loadRules() {
  try {
    const res = await fetch(chrome.runtime.getURL('rules.json'));
    RULES = await res.json();
  } catch (e) { console.error('Failed to load rules in audit.'); }
}

async function loadSubmissions() {
  const syncStatus = document.getElementById('syncStatus');
  if (syncStatus) syncStatus.textContent = 'Syncing...';

  if (RULES.api_url && RULES.api_url !== 'YOUR_DEPLOYED_BACKEND_URL_HERE') {
    try {
      const headers = TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {};
      const res = await fetch(`${RULES.api_url}/api/submissions`, { headers });
      if (res.ok) {
        const remoteData = await res.json();

        allSubmissions = remoteData.map(row => ({
          id: (row.candidate_id || row.id).toString(),
          timestamp: row.timestamp,
          flagged: row.flagged,
          exceptions_used: row.exceptions_used || [],
          fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
          rationale: typeof row.rationale === 'string' ? JSON.parse(row.rationale) : row.rationale,
          decision: row.decision || 'pending'
        }));
        updateDashboard();
        if (syncStatus) syncStatus.textContent = `Last synced: ${new Date().toLocaleTimeString()}`;
        return;
      }
    } catch (e) { 
      console.warn('Remote fetch failed.');
      if (syncStatus) syncStatus.textContent = 'Sync failed. Using local cache.';
    }
  }

  try {
    chrome.storage.local.get(['admitguard_submissions'], (result) => {
      allSubmissions = (result.admitguard_submissions || []).map(s => ({...s, decision: s.decision || 'pending'}));
      updateDashboard();
      if (syncStatus && !syncStatus.textContent.includes('Synced')) {
        syncStatus.textContent = 'Offline Mode';
      }
    });
  } catch (_) { updateDashboard(); }
}


function updateDashboard() {
  updateStats();
  updateComplianceBar();
  renderTable();
}

function updateStats() {
  const total = allSubmissions.length;
  document.getElementById('statTotal').textContent = total;
  document.getElementById('statFlagged').textContent = allSubmissions.filter(s => s.flagged).length;
  document.getElementById('statExceptions').textContent = allSubmissions.filter(s => s.exceptions_used?.length > 0).length;
  document.getElementById('statToday').textContent = allSubmissions.filter(s => new Date(s.timestamp).toDateString() === new Date().toDateString()).length;
}

function updateComplianceBar() {
  const total = allSubmissions.length;
  if (total === 0) return;
  const flagged = allSubmissions.filter(s => s.flagged).length;
  const cleanPct = ((total - flagged) / total) * 100;
  document.getElementById('barClean').style.width = `${cleanPct}%`;
  document.getElementById('barFlagged').style.width = `${100 - cleanPct}%`;
  document.getElementById('compliancePct').textContent = `${Math.round(cleanPct)}% High Integrity`;
}

function sanitize(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function mask(str, type = 'phone') {
  if (!piiMaskingEnabled || !str) return str;
  if (type === 'phone') return str.slice(0, 3) + 'XXXX' + str.slice(7);
  if (type === 'aadhaar') return 'XXXX XXXX ' + str.slice(8);
  const parts = str.split('@');
  return parts.length < 2 ? str : parts[0][0] + '***@' + parts[1];
}

async function makeDecision(candidateId, status) {
  if (!RULES.api_url) return alert('Decision requires a live backend.');
  
  try {
    const res = await fetch(`${RULES.api_url}/api/submissions/${candidateId}/decision`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...(TOKEN ? { 'Authorization': `Bearer ${TOKEN}` } : {})
      },
      body: JSON.stringify({ decision: status })
    });
    if (res.ok) loadSubmissions();
    else if (res.status === 401 || res.status === 403) alert('Permission denied. Admin required.');
    else alert('Failed to update decision.');
  } catch (e) { alert('Failed to update decision. Check backend connection.'); }
}

function renderTable() {
  const search = document.getElementById('searchInput').value.toLowerCase();
  const filter = document.getElementById('filterSelect').value;
  let data = [...allSubmissions].reverse();

  if (search) data = data.filter(s => (s.fields?.name || '').toLowerCase().includes(search));
  if (filter === 'flagged') data = data.filter(s => s.flagged);

  const tbody = document.getElementById('auditBody');
  tbody.innerHTML = data.map(sub => {
    const excs = (sub.exceptions_used || []).map(e => `<span class="badge exception">${sanitize(e)}</span>`).join('');
    const statusBadge = sub.flagged ? `<span class="badge flagged">⚑ Flagged</span>` : `<span class="badge ok">✓ Clean</span>`;
    
    return `
      <tr data-id="${sub.id}" style="cursor:pointer" class="audit-row">
        <td style="font-size:10px; color:var(--muted)">#${sub.id.toString().slice(-4)}</td>

        <td>${new Date(sub.timestamp).toLocaleDateString()}</td>
        <td style="font-weight:600">${sanitize(sub.fields?.name)}</td>
        <td style="color:var(--muted)">${sanitize(mask(sub.fields?.email, 'email'))}</td>
        <td>${sanitize(mask(sub.fields?.phone, 'phone'))}</td>
        <td>${excs}</td>
        <td>${statusBadge}</td>
        <td><span class="badge ${sub.decision}">${sub.decision.toUpperCase()}</span></td>
        <td style="text-align:right">→</td>
      </tr>`;
  }).join('');

  // CSP-Friendly Event Delegation for row clicks
  tbody.onclick = (e) => {
    const row = e.target.closest('.audit-row');
    if (row) showDetail(row.dataset.id);
  };
}


function showDetail(id) {
  const idStr = id.toString();
  const sub = allSubmissions.find(s => s.id.toString() === idStr);
  if (!sub) return;
  const fields = [
    ['Name', sanitize(sub.fields.name)],
    ['Email', sanitize(mask(sub.fields.email, 'email'))],
    ['Decision', sub.decision.toUpperCase()],
    ['Submitted At', new Date(sub.timestamp).toLocaleString()],
    ['Exceptions', (sub.exceptions_used || []).join(', ') || 'None']
  ];
  document.getElementById('modalContent').innerHTML = fields.map(([k, v]) => `<div class="detail-row"><div class="detail-key">${k}</div><div class="detail-val">${v}</div></div>`).join('');
  document.getElementById('detailModal').classList.add('show');
}

async function manualSync() {
  const btn = document.getElementById('syncBtn');
  const originalText = btn.textContent;
  btn.textContent = 'Syncing...';
  btn.disabled = true;
  await loadSubmissions();
  btn.textContent = 'Sync Complete';
  btn.disabled = false;
  setTimeout(() => btn.textContent = originalText, 2000);
}


function exportCSV() {
  const headers = ['ID','Name','Email','Status','Decision'];
  const rows = allSubmissions.map(s => [s.id, s.fields.name, s.fields.email, s.flagged ? 'FLAGGED':'OK', s.decision]);
  const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'audit-log.csv';
  a.click();
}

async function clearAll() {
  if (!confirm('Clear all local data? (Backend data requires admin dashboard to delete.)')) return;
  // NOTE: DELETE /api/submissions requires Google Admin OAuth — use the admin dashboard instead.
  // We only clear local chrome storage here.
  try {
    await chrome.storage.local.remove('admitguard_submissions');
  } catch (_) {}
  allSubmissions = [];
  updateDashboard();
}
