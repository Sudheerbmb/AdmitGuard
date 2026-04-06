// ── VERHOEFF ALGORITHM ───────────────────────────────────────────
// Exact port from popup.js — detects fake Aadhaar numbers
const d = [
  [0,1,2,3,4,5,6,7,8,9],[1,2,3,4,0,6,7,8,9,5],[2,3,4,0,1,7,8,9,5,6],
  [3,4,0,1,2,8,9,5,6,7],[4,0,1,2,3,9,5,6,7,8],[5,9,8,7,6,0,4,3,2,1],
  [6,5,9,8,7,1,0,4,3,2],[7,6,5,9,8,2,1,0,4,3],[8,7,6,5,9,3,2,1,0,4],
  [9,8,7,6,5,4,3,2,1,0],
];
const p = [
  [0,1,2,3,4,5,6,7,8,9],[1,5,7,6,2,8,3,0,9,4],[5,8,0,3,7,9,6,1,4,2],
  [8,9,1,6,0,4,3,5,2,7],[9,4,5,3,1,2,6,8,7,0],[4,2,8,6,5,7,3,9,0,1],
  [2,7,9,3,8,0,6,4,1,5],[7,0,4,6,9,1,3,2,5,8],
];

export const validateVerhoeff = (array) => {
  let c = 0;
  const invertedArray = [...array].reverse(); // spread to avoid mutation
  for (let i = 0; i < invertedArray.length; i++) {
    c = d[c][p[i % 8][invertedArray[i]]];
  }
  return c === 0;
};

// ── HARD VALIDATORS ───────────────────────────────────────────────
export const validateName = (val) => {
  if (!val || val.trim().length < 2) return 'Name must be at least 2 characters.';
  if (/\d/.test(val)) return 'Name must not contain numbers.';
  return null;
};

export const validateEmail = (val) => {
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRe.test(val)) return 'Enter a valid email address.';
  return null;
};

export const validatePhone = (val) => {
  if (!/^[6-9]\d{9}$/.test(val)) return 'Phone must be 10 digits starting with 6, 7, 8, or 9.';
  return null;
};

export const validateAadhaar = (val, checksumEnabled = true) => {
  if (!/^\d{12}$/.test(val)) return 'Aadhaar must be exactly 12 digits.';
  if (checksumEnabled) {
    const digits = val.split('').map(Number);
    if (!validateVerhoeff(digits)) return 'Invalid Aadhaar number (checksum failed).';
  }
  return null;
};

export const validateQualification = (val) => {
  if (!val) return 'Please select a qualification.';
  return null;
};

export const validateInterviewStatus = (val) => {
  if (!val) return 'Please select interview status.';
  if (val === 'Rejected') return 'Rejected candidates cannot be submitted.';
  return null;
};

export const validateOfferLetter = (status, val) => {
  if (status !== 'Cleared') return null;
  if (!val) return 'Please select offer letter status.';
  return null;
};

// ── SOFT VALIDATORS ───────────────────────────────────────────────
export const validateSoftField = (field, val, rules) => {
  const num = parseFloat(val);
  if (isNaN(num)) return { error: `${field} is required.`, violated: false };

  let violated = false;
  let error = '';

  if (field === 'age') {
    if (num < rules.age.min || num > rules.age.max) {
      violated = true;
      error = `Age must be between ${rules.age.min} and ${rules.age.max}.`;
    }
  } else if (field === 'grad_year') {
    if (num < rules.graduation_year.min || num > rules.graduation_year.max) {
      violated = true;
      error = `Graduation year must be between ${rules.graduation_year.min} and ${rules.graduation_year.max}.`;
    }
  } else if (field === 'percentage') {
    const isCGPA = num <= 10;
    if (isCGPA && num < rules.cgpa.min) {
      violated = true; error = `CGPA must be ≥ ${rules.cgpa.min}.`;
    } else if (!isCGPA && num < rules.percentage.min) {
      violated = true; error = `Percentage must be ≥ ${rules.percentage.min}%.`;
    }
  } else if (field === 'screening_score') {
    if (num < rules.screening_score.min || num > rules.screening_score.max) {
      violated = true;
      error = `Score must be between ${rules.screening_score.min} and ${rules.screening_score.max}.`;
    }
  }

  return { error: violated ? error : null, violated };
};

// ── RATIONALE VALIDATOR ───────────────────────────────────────────
export const validateRationale = (text, rules) => {
  const val = text.trim().toLowerCase();
  const minLen = rules.rationale_min_length || 30;
  if (val.length < minLen) return `Rationale must be at least ${minLen} characters.`;
  const hasKeyword = (rules.exception_keywords || []).some(kw => val.includes(kw.toLowerCase()));
  if (!hasKeyword) return 'Rationale must include one of the required keywords.';
  return null;
};
