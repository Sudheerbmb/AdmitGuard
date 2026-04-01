// AdmitGuard — popup.js
// Enhanced with Verhoeff validation, debounced auto-save, and modular logic

let RULES = {};
const exceptionStates = {}; // { fieldId: { active: bool, rationaleValid: bool } }
let autoSaveTimer = null;

// ── BOOT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Load Local Defaults (Bootstrap)
  try {
    const localRes = await fetch(chrome.runtime.getURL('rules.json'));
    RULES = await localRes.json();
  } catch (e) {
    console.error('Local rules load failed');
  }

  // 2. Try to sync with Live Backend
  if (RULES.api_url && RULES.api_url !== 'https://admitguard.onrender.com') {
    try {
      const remoteRes = await fetch(`${RULES.api_url}/api/rules`);
      if (remoteRes.ok) {
        const remoteRules = await remoteRes.json();
        // Merge but keep the api_url which is extension-specific
        RULES = { ...remoteRules, api_url: RULES.api_url };
        console.log('🛡️ Live Rules Synced from Backend');
      }
    } catch (err) {
      console.warn('🛡️ Backend Sync Failed. Using offline rules.');
    }
  }

  document.getElementById('excLimit').textContent = RULES.exception_limit;

  // Init sections
  initSoftFields();
  initListeners();
  
  // Load Draft if it exists
  if (RULES.auto_save_draft) {
    loadDraft();
  }
});

function initSoftFields() {
  const softFields = ['age', 'grad_year', 'percentage', 'screening_score'];
  softFields.forEach(field => {
    // Chips 
    const container = document.getElementById(`${field}-chips`);
    if (container) {
      container.innerHTML = ''; // clear
      RULES.exception_keywords.forEach(kw => {
        const chip = document.createElement('div');
        chip.className = 'chip';
        chip.dataset.kw = kw;
        chip.textContent = kw;
        container.appendChild(chip);
      });
    }

    // Toggle & Logic
    exceptionStates[field] = { active: false, rationaleValid: false };
    const toggle = document.getElementById(`${field}-exc-toggle`);
    const sw = document.getElementById(`${field}-toggle-sw`);
    const rationaleArea = document.getElementById(`${field}-rationale-area`);
    const rationaleInput = document.getElementById(`${field}-rationale`);

    toggle.addEventListener('click', () => {
      exceptionStates[field].active = !exceptionStates[field].active;
      sw.classList.toggle('on', exceptionStates[field].active);
      rationaleArea.classList.toggle('show', exceptionStates[field].active);
      if (!exceptionStates[field].active) {
        exceptionStates[field].rationaleValid = false;
        rationaleInput.value = '';
        clearRationaleError(field);
        updateChips(field, '');
      }
      updateExceptionCounter();
      updateFlagIndicator();
      triggerAutoSave();
    });

    rationaleInput.addEventListener('input', () => {
      validateRationale(field);
      updateExceptionCounter();
      updateFlagIndicator();
      triggerAutoSave();
    });
  });
}

function initListeners() {
  // Common listeners
  const inputs = document.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    input.addEventListener('input', () => {
      triggerAutoSave();
      // Debounce complex validation if needed?
    });
  });

  // Specific field validation on blur/change
  const mapping = {
    'name': validateName,
    'email': validateEmail,
    'phone': validatePhone,
    'aadhaar': validateAadhaar,
    'age': () => validateSoftField('age'),
    'grad_year': () => validateSoftField('grad_year'),
    'percentage': () => validateSoftField('percentage'),
    'screening_score': () => validateSoftField('screening_score'),
    'qualification': validateQualification,
    'interview_status': () => { validateInterviewStatus(); handleInterviewLogic(); },
    'offer_letter': validateOfferLetter
  };

  Object.entries(mapping).forEach(([id, fn]) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('blur', fn);
  });

  document.getElementById('submitBtn').addEventListener('click', handleSubmit);
  document.getElementById('newEntryBtn').addEventListener('click', resetForm);
  document.getElementById('openAuditBtn').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('audit.html') });
  });
}

function handleInterviewLogic() {
  const val = document.getElementById('interview_status').value;
  document.getElementById('offer-field').style.display = val === 'Cleared' ? 'block' : 'none';
  if (val !== 'Cleared') document.getElementById('offer_letter').value = '';

  if (val === 'Rejected') {
    showBlocked('Candidate has been Rejected at Interview stage. Submission is not allowed.');
  } else {
    hideBlocked();
  }
}

// ── VERHOEFF ALGORITHM ───────────────────────────────────────────────────────
const d = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];
const p = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];
const inv = [0, 4, 3, 2, 1, 5, 6, 7, 8, 9];

function validateVerhoeff(array) {
  let c = 0;
  let invertedArray = array.reverse();
  for (let i = 0; i < invertedArray.length; i++) {
    c = d[c][p[i % 8][invertedArray[i]]];
  }
  return c === 0;
}

// ── STRICT VALIDATORS ─────────────────────────────────────────────────────────

function validateName() {
  const val = document.getElementById('name').value.trim();
  if (val.length < 2) return setError('name', 'Name must be at least 2 characters.');
  if (/\d/.test(val)) return setError('name', 'Name must not contain numbers.');
  return clearError('name');
}

function validateEmail() {
  const val = document.getElementById('email').value.trim();
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(val)) return setError('email', 'Enter a valid email address.');
  
  // Whitelist check if configured
  if (RULES.email_whitelist && RULES.email_whitelist.length > 0) {
    const domain = val.split('@')[1];
    if (!RULES.email_whitelist.includes(domain)) {
      return setError('email', `Only ${RULES.email_whitelist.join(', ')} domains allowed.`);
    }
  }

  // Uniqueness check
  const subs = getSubmissions();
  if (subs.some(s => s.fields.email === val)) return setError('email', 'This email is already registered.');
  return clearError('email');
}

function validatePhone() {
  const val = document.getElementById('phone').value.trim();
  if (!/^[6-9]\d{9}$/.test(val)) return setError('phone', 'Phone must be 10 digits starting with 6, 7, 8, or 9.');
  return clearError('phone');
}

function validateAadhaar() {
  const val = document.getElementById('aadhaar').value.trim();
  if (!/^\d{12}$/.test(val)) return setError('aadhaar', 'Aadhaar must be exactly 12 digits.');
  
  if (RULES.aadhaar_checksum) {
    const digits = val.split('').map(Number);
    if (!validateVerhoeff(digits)) {
      return setError('aadhaar', 'Invalid Aadhaar number (checksum failed).');
    }
  }
  return clearError('aadhaar');
}

function validateQualification() {
  const val = document.getElementById('qualification').value;
  if (!val) return setError('qualification', 'Please select a qualification.');
  return clearError('qualification');
}

function validateInterviewStatus() {
  const val = document.getElementById('interview_status').value;
  if (!val) return setError('interview_status', 'Please select interview status.');
  if (val === 'Rejected') return setError('interview_status', 'Rejected candidates cannot be submitted.');
  return clearError('interview_status');
}

function validateOfferLetter() {
  const status = document.getElementById('interview_status').value;
  if (status !== 'Cleared') return true;
  const val = document.getElementById('offer_letter').value;
  if (!val) return setError('offer_letter', 'Please select offer letter status.');
  return clearError('offer_letter');
}

// ── SOFT VALIDATORS ───────────────────────────────────────────────────────────

function validateSoftField(field) {
  const input = document.getElementById(field);
  const val = parseFloat(input.value);
  let violated = false;
  let message = '';

  const config = {
    'age': { val: val, min: RULES.age.min, max: RULES.age.max, label: 'Age' },
    'grad_year': { val: val, min: RULES.graduation_year.min, max: RULES.graduation_year.max, label: 'Graduation year' },
    'percentage': { val: val, isScore: true },
    'screening_score': { val: val, min: RULES.screening_score.min, max: RULES.screening_score.max, label: 'Score' }
  };

  const f = config[field];
  if (isNaN(f.val)) { setError(field, `${f.label || field} is required.`); return; }

  if (field === 'percentage') {
    const isCGPA = f.val <= 10;
    if (isCGPA && f.val < RULES.cgpa.min) { violated = true; message = `CGPA must be ≥ ${RULES.cgpa.min}.`; }
    else if (!isCGPA && f.val < RULES.percentage.min) { violated = true; message = `Percentage must be ≥ ${RULES.percentage.min}%.`; }
  } else {
    if (f.val < f.min || f.val > f.max) { violated = true; message = `${f.label} must be between ${f.min} and ${f.max}.`; }
  }

  if (violated) {
    setError(field, message);
    document.getElementById(`${field}-exc`).classList.add('show');
  } else {
    clearError(field);
    document.getElementById(`${field}-exc`).classList.remove('show');
    resetException(field);
  }

  updateExceptionCounter();
  updateFlagIndicator();
}

function resetException(field) {
  exceptionStates[field].active = false;
  exceptionStates[field].rationaleValid = false;
  const sw = document.getElementById(`${field}-toggle-sw`);
  if (sw) sw.classList.remove('on');
  const ra = document.getElementById(`${field}-rationale-area`);
  if (ra) ra.classList.remove('show');
}

// ── RATIONALE ─────────────────────────────────────────────────────────────────

function validateRationale(field) {
  const input = document.getElementById(`${field}-rationale`);
  if (!input) return;
  const val = input.value.trim().toLowerCase();
  const minLen = RULES.rationale_min_length || 30;

  updateChips(field, val);

  if (val.length < minLen) {
    setRationaleError(field, `Rationale must be at least ${minLen} characters.`);
    exceptionStates[field].rationaleValid = false;
    return;
  }

  const hasKeyword = RULES.exception_keywords.some(kw => val.includes(kw.toLowerCase()));
  if (!hasKeyword) {
    setRationaleError(field, 'Rationale must include one of the required keywords.');
    exceptionStates[field].rationaleValid = false;
    return;
  }

  clearRationaleError(field);
  exceptionStates[field].rationaleValid = true;
}

function updateChips(field, val) {
  const chips = document.querySelectorAll(`#${field}-chips .chip`);
  chips.forEach(chip => {
    chip.classList.toggle('matched', val.toLowerCase().includes(chip.dataset.kw.toLowerCase()));
  });
}

function setRationaleError(field, msg) {
  const el = document.getElementById(`${field}-rationale-err`);
  if (el) { el.textContent = msg; el.classList.add('show'); }
}
function clearRationaleError(field) {
  const el = document.getElementById(`${field}-rationale-err`);
  if (el) { el.textContent = ''; el.classList.remove('show'); }
}

// ── COUNTER & FLAG ────────────────────────────────────────────────────────────

function countActiveExceptions() {
  return Object.values(exceptionStates).filter(s => s.active).length;
}

function updateExceptionCounter() {
  document.getElementById('excCount').textContent = countActiveExceptions();
}

function updateFlagIndicator() {
  const count = countActiveExceptions();
  document.getElementById('flagIndicator').classList.toggle('show', count > RULES.exception_limit);
}

// ── BLOCKED ───────────────────────────────────────────────────────────────────

function showBlocked(msg) {
  const banner = document.getElementById('blockedBanner');
  document.getElementById('blockedMsg').textContent = msg;
  banner.classList.add('show');
  document.getElementById('submitBtn').disabled = true;
}
function hideBlocked() {
  document.getElementById('blockedBanner').classList.remove('show');
  document.getElementById('submitBtn').disabled = false;
}

// ── ERROR HELPERS ─────────────────────────────────────────────────────────────

function setError(field, msg) {
  const input = document.getElementById(field);
  const errEl = document.getElementById(`${field}-err`);
  if (input) { input.classList.add('error'); input.classList.remove('valid'); }
  if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
  return false;
}

function clearError(field) {
  const input = document.getElementById(field);
  const errEl = document.getElementById(`${field}-err`);
  if (input) { input.classList.remove('error'); input.classList.add('valid'); }
  if (errEl) { errEl.textContent = ''; errEl.classList.remove('show'); }
  return true;
}

// ── AUTO-SAVE DRAFTS ──────────────────────────────────────────────────────────

function triggerAutoSave() {
  if (!RULES.auto_save_draft) return;
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(saveDraft, RULES.auto_save_interval_ms || 2000);
}

function saveDraft() {
  const data = {};
  document.querySelectorAll('input, select, textarea').forEach(el => {
    if (el.id) data[el.id] = el.value;
  });
  // Save toggle states
  data.exception_states = exceptionStates;
  
  chrome.storage.local.set({ 'admitguard_draft': data });
  console.log('Draft saved.');
}

async function loadDraft() {
  chrome.storage.local.get(['admitguard_draft'], (result) => {
    const draft = result.admitguard_draft;
    if (!draft) return;

    Object.entries(draft).forEach(([id, val]) => {
      if (id === 'exception_states') return;
      const el = document.getElementById(id);
      if (el) el.value = val;
    });

    // Restore exception states
    if (draft.exception_states) {
      Object.entries(draft.exception_states).forEach(([field, state]) => {
        if (state.active) {
          exceptionStates[field] = state;
          const sw = document.getElementById(`${field}-toggle-sw`);
          if (sw) sw.classList.add('on');
          const ra = document.getElementById(`${field}-rationale-area`);
          if (ra) ra.classList.add('show');
          const eb = document.getElementById(`${field}-exc`);
          if (eb) eb.classList.add('show');
          validateRationale(field);
        }
      });
    }
    
    updateExceptionCounter();
    updateFlagIndicator();
    handleInterviewLogic();
  });
}

function clearDraft() {
  chrome.storage.local.remove('admitguard_draft');
}

// ── SUBMIT ────────────────────────────────────────────────────────────────────

function handleSubmit() {
  const strictPassed = [
    validateName(),
    validateEmail(),
    validatePhone(),
    validateAadhaar(),
    validateQualification(),
    validateInterviewStatus(),
    validateOfferLetter()
  ].every(Boolean);

  ['age', 'grad_year', 'percentage', 'screening_score'].forEach(f => validateSoftField(f));

  const interviewVal = document.getElementById('interview_status').value;
  if (interviewVal === 'Rejected') return;

  if (!strictPassed) return;

  for (const [field, state] of Object.entries(exceptionStates)) {
    const excBlock = document.getElementById(`${field}-exc`);
    if (excBlock && excBlock.classList.contains('show')) {
      if (state.active && !state.rationaleValid) {
        setRationaleError(field, 'Please provide a valid rationale before submitting.');
        return;
      }
      if (!state.active) {
        setError(field, 'This field violates a soft rule. Toggle "Request Exception" to proceed.');
        return;
      }
    }
  }

  const exceptionsUsed = Object.entries(exceptionStates)
    .filter(([, s]) => s.active)
    .map(([field]) => field);

  const isFlagged = exceptionsUsed.length > RULES.exception_limit;

  const submission = {
    id: Date.now(),
    timestamp: new Date().toISOString(),
    flagged: isFlagged,
    exceptions_used: exceptionsUsed,
    fields: {
      name: document.getElementById('name').value.trim(),
      email: document.getElementById('email').value.trim(),
      phone: document.getElementById('phone').value.trim(),
      aadhaar: document.getElementById('aadhaar').value.trim(),
      age: document.getElementById('age').value,
      qualification: document.getElementById('qualification').value,
      grad_year: document.getElementById('grad_year').value,
      percentage: document.getElementById('percentage').value,
      screening_score: document.getElementById('screening_score').value,
      interview_status: document.getElementById('interview_status').value,
      offer_letter: document.getElementById('offer_letter').value || 'N/A'
    },
    rationale: {
      age: document.getElementById('age-rationale')?.value || '',
      grad_year: document.getElementById('grad_year-rationale')?.value || '',
      percentage: document.getElementById('percentage-rationale')?.value || '',
      screening_score: document.getElementById('screening_score-rationale')?.value || ''
    }
  };

  saveSubmission(submission);
  clearDraft();
  showSuccess(submission);
}

// ── STORAGE ───────────────────────────────────────────────────────────────────

function getSubmissions() {
  try {
    return JSON.parse(localStorage.getItem('admitguard_submissions') || '[]');
  } catch { return []; }
}

function saveSubmission(sub) {
  const all = getSubmissions();
  all.push(sub);
  localStorage.setItem('admitguard_submissions', JSON.stringify(all));
  try {
    chrome.storage.local.set({ admitguard_submissions: all });
  } catch (_) {}

  // NEW: Push to Remote Backend if URL is set
  if (RULES.api_url && RULES.api_url !== 'YOUR_DEPLOYED_BACKEND_URL_HERE') {
    fetch(`${RULES.api_url}/api/submissions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(sub)
    })
    .then(r => console.log('Remote Sync: Success'))
    .catch(e => console.error('Remote Sync Error:', e));
  }
}

// ── SUCCESS ───────────────────────────────────────────────────────────────────

function showSuccess(sub) {
  document.getElementById('successName').textContent = sub.fields.name;
  document.getElementById('successTime').textContent = new Date(sub.timestamp).toLocaleString();
  document.getElementById('successFlag').style.display = sub.flagged ? 'block' : 'none';
  document.getElementById('successOverlay').classList.add('show');
}

function resetForm() {
  document.getElementById('successOverlay').classList.remove('show');
  document.querySelector('form') && document.querySelector('form').reset();
  ['name','email','phone','aadhaar','age','qualification','grad_year',
   'percentage','screening_score','interview_status','offer_letter'].forEach(id => {
    const el = document.getElementById(id);
    if (el) { el.value = ''; el.classList.remove('error','valid'); }
  });
  document.querySelectorAll('.err-msg').forEach(e => { e.textContent=''; e.classList.remove('show'); });
  ['age','grad_year','percentage','screening_score'].forEach(f => {
    resetException(f);
    document.getElementById(`${f}-exc`)?.classList.remove('show');
    const ri = document.getElementById(`${f}-rationale`);
    if (ri) ri.value = '';
    updateChips(f, '');
  });
  document.getElementById('offer-field').style.display = 'none';
  hideBlocked();
  updateExceptionCounter();
  updateFlagIndicator();
  clearDraft();
}
