import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Platform, Alert,
  Modal, Animated,
} from 'react-native';
import { COLORS } from '../constants';
import { getRules, submitCandidate } from '../utils/api';
import {
  validateName, validateEmail, validatePhone, validateAadhaar,
  validateQualification, validateInterviewStatus, validateOfferLetter,
  validateSoftField, validateRationale,
} from '../utils/validation';

const SOFT_FIELDS = ['age', 'grad_year', 'percentage', 'screening_score'];
const SOFT_LABELS = {
  age: 'Age', grad_year: 'Graduation Year',
  percentage: 'Percentage / CGPA', screening_score: 'Screening Score',
};

const defaultRules = {
  age: { min: 18, max: 35 }, graduation_year: { min: 2015, max: 2025 },
  percentage: { min: 60 }, cgpa: { min: 6.0 },
  screening_score: { min: 40, max: 100 }, exception_limit: 2,
  exception_keywords: ['approved by', 'special case', 'documentation pending', 'waiver granted'],
  rationale_min_length: 30, aadhaar_checksum: true,
};

export default function FormScreen({ user }) {
  const [rules, setRules] = useState(defaultRules);
  const [serverOnline, setServerOnline] = useState(null);

  // Form fields
  const [fields, setFields] = useState({
    name: '', email: '', phone: '', aadhaar: '',
    age: '', qualification: '', grad_year: '', percentage: '',
    screening_score: '', interview_status: '', offer_letter: '',
  });
  const [errors, setErrors] = useState({});

  // Soft rule states — per field: { violated, excActive, rationale, rationaleError }
  const [softState, setSoftState] = useState({
    age: { violated: false, excActive: false, rationale: '', rationaleError: null },
    grad_year: { violated: false, excActive: false, rationale: '', rationaleError: null },
    percentage: { violated: false, excActive: false, rationale: '', rationaleError: null },
    screening_score: { violated: false, excActive: false, rationale: '', rationaleError: null },
  });

  const [submitting, setSubmitting] = useState(false);
  const [blocked, setBlocked] = useState(null); // message string or null
  const [successModal, setSuccessModal] = useState(null); // submission object or null
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchRules();
  }, []);

  const fetchRules = async () => {
    try {
      const res = await getRules();
      setRules({ ...defaultRules, ...res.data });
      setServerOnline(true);
    } catch {
      setServerOnline(false);
    }
  };

  // ── FIELD HELPERS ──────────────────────────────────────────────
  const setField = (key, val) => setFields(prev => ({ ...prev, [key]: val }));

  const setError = (key, msg) => setErrors(prev => ({ ...prev, [key]: msg }));
  const clearError = (key) => setErrors(prev => ({ ...prev, [key]: null }));

  const updateSoft = (field, patch) =>
    setSoftState(prev => ({ ...prev, [field]: { ...prev[field], ...patch } }));

  // ── VALIDATORS ────────────────────────────────────────────────
  const runHardValidation = (key, val) => {
    let err = null;
    if (key === 'name') err = validateName(val);
    else if (key === 'email') err = validateEmail(val);
    else if (key === 'phone') err = validatePhone(val);
    else if (key === 'aadhaar') err = validateAadhaar(val, rules.aadhaar_checksum);
    else if (key === 'qualification') err = validateQualification(val);
    else if (key === 'interview_status') {
      err = validateInterviewStatus(val);
      setBlocked(val === 'Rejected' ? 'Candidate was Rejected at interview stage. Submission not allowed.' : null);
    }
    else if (key === 'offer_letter') err = validateOfferLetter(fields.interview_status, val);

    if (err) setError(key, err);
    else clearError(key);
  };

  const runSoftValidation = (field, val) => {
    const { error, violated } = validateSoftField(field, val, rules);
    if (error) setError(field, error);
    else clearError(field);
    updateSoft(field, { violated });
    if (!violated) updateSoft(field, { excActive: false, rationale: '', rationaleError: null });
  };

  const runRationaleValidation = (field, text) => {
    const err = validateRationale(text, rules);
    updateSoft(field, { rationale: text, rationaleError: err });
  };

  // ── ACTIVE EXCEPTIONS ─────────────────────────────────────────
  const activeExceptions = SOFT_FIELDS.filter(f => softState[f].excActive);
  const isFlagged = activeExceptions.length > rules.exception_limit;

  // ── SUBMIT ────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (blocked) return;

    // Run all hard validators
    const hardKeys = ['name', 'email', 'phone', 'aadhaar', 'qualification', 'interview_status', 'offer_letter'];
    let hasHardError = false;
    hardKeys.forEach(key => {
      runHardValidation(key, fields[key]);
      let err = null;
      if (key === 'name') err = validateName(fields[key]);
      else if (key === 'email') err = validateEmail(fields[key]);
      else if (key === 'phone') err = validatePhone(fields[key]);
      else if (key === 'aadhaar') err = validateAadhaar(fields[key], rules.aadhaar_checksum);
      else if (key === 'qualification') err = validateQualification(fields[key]);
      else if (key === 'interview_status') err = validateInterviewStatus(fields[key]);
      else if (key === 'offer_letter') err = validateOfferLetter(fields.interview_status, fields[key]);
      if (err) hasHardError = true;
    });

    if (fields.interview_status === 'Rejected') return;
    if (hasHardError) {
      Alert.alert('Validation Error', 'Please fix all highlighted fields before submitting.');
      return;
    }

    // Run all soft validators and check exceptions
    SOFT_FIELDS.forEach(f => runSoftValidation(f, fields[f]));

    for (const field of SOFT_FIELDS) {
      const s = softState[field];
      const { violated } = validateSoftField(field, fields[field], rules);
      if (violated) {
        if (!s.excActive) {
          Alert.alert('Exception Required', `${SOFT_LABELS[field]} violates a soft rule. Please toggle "Request Exception" to proceed.`);
          return;
        }
        if (validateRationale(s.rationale, rules)) {
          Alert.alert('Rationale Required', `Please provide a valid rationale for ${SOFT_LABELS[field]} exception before submitting.`);
          return;
        }
      }
    }

    const rationale = {};
    SOFT_FIELDS.forEach(f => { if (softState[f].excActive) rationale[f] = softState[f].rationale; });

    const submission = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      flagged: isFlagged,
      exceptions_used: activeExceptions,
      fields: { ...fields },
      rationale,
    };

    setSubmitting(true);
    try {
      await submitCandidate(submission);
      setSuccessModal(submission);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    } catch (err) {
      if (err.response?.status === 409) {
        Alert.alert('Duplicate', 'This candidate ID already exists in the system.');
      } else {
        Alert.alert('Submission Failed', err.response?.data?.error || 'Could not reach backend. Check your connection.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setFields({ name: '', email: '', phone: '', aadhaar: '', age: '', qualification: '', grad_year: '', percentage: '', screening_score: '', interview_status: '', offer_letter: '' });
    setErrors({});
    setBlocked(null);
    setSoftState({
      age: { violated: false, excActive: false, rationale: '', rationaleError: null },
      grad_year: { violated: false, excActive: false, rationale: '', rationaleError: null },
      percentage: { violated: false, excActive: false, rationale: '', rationaleError: null },
      screening_score: { violated: false, excActive: false, rationale: '', rationaleError: null },
    });
    setSuccessModal(null);
    fadeAnim.setValue(0);
  };

  // ── RENDER HELPERS ─────────────────────────────────────────────
  const renderField = (label, key, opts = {}) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}{opts.required && <Text style={styles.req}> *</Text>}</Text>
      <TextInput
        style={[styles.input, errors[key] && styles.inputError]}
        value={fields[key]}
        onChangeText={val => setField(key, val)}
        onBlur={() => runHardValidation(key, fields[key])}
        placeholder={opts.placeholder || ''}
        placeholderTextColor={COLORS.muted}
        keyboardType={opts.keyboardType || 'default'}
        maxLength={opts.maxLength}
        secureTextEntry={opts.secure}
        autoCapitalize={opts.autoCapitalize || 'sentences'}
      />
      {errors[key] && <Text style={styles.errMsg}>{errors[key]}</Text>}
    </View>
  );

  const renderPickerField = (label, key, options, opts = {}) => (
    <View style={styles.field} key={key}>
      <Text style={styles.label}>{label}{opts.required && <Text style={styles.req}> *</Text>}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }}>
        {options.map(opt => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optionChip, fields[key] === opt.value && styles.optionChipSelected]}
            onPress={() => {
              setField(key, opt.value);
              runHardValidation(key, opt.value);
            }}
          >
            <Text style={[styles.optionChipText, fields[key] === opt.value && styles.optionChipTextSelected]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      {errors[key] && <Text style={styles.errMsg}>{errors[key]}</Text>}
    </View>
  );

  const renderSoftField = (label, key, opts = {}) => {
    const s = softState[key];
    return (
      <View style={styles.field} key={key}>
        <View style={styles.labelRow}>
          <Text style={styles.label}>{label}<Text style={styles.req}> *</Text></Text>
          <View style={styles.softTag}><Text style={styles.softTagText}>SOFT</Text></View>
        </View>
        <TextInput
          style={[styles.input, errors[key] && styles.inputError]}
          value={fields[key]}
          onChangeText={val => setField(key, val)}
          onBlur={() => runSoftValidation(key, fields[key])}
          placeholder={opts.placeholder || ''}
          placeholderTextColor={COLORS.muted}
          keyboardType="numeric"
        />
        {errors[key] && <Text style={styles.errMsg}>{errors[key]}</Text>}

        {/* Exception Block */}
        {s.violated && (
          <View style={styles.exceptionBlock}>
            <TouchableOpacity
              style={styles.exceptionToggle}
              onPress={() => updateSoft(key, { excActive: !s.excActive })}
            >
              <View style={[styles.toggleTrack, s.excActive && styles.toggleTrackOn]}>
                <View style={[styles.toggleThumb, s.excActive && styles.toggleThumbOn]} />
              </View>
              <Text style={styles.exceptionLabel}>Request Exception for {SOFT_LABELS[key]}</Text>
            </TouchableOpacity>

            {s.excActive && (
              <View style={styles.rationaleArea}>
                <Text style={styles.rationaleHint}>
                  Min {rules.rationale_min_length} chars · Include a keyword:
                </Text>
                {/* Keyword chips */}
                <View style={styles.chipsRow}>
                  {(rules.exception_keywords || []).map(kw => {
                    const matched = s.rationale.toLowerCase().includes(kw.toLowerCase());
                    return (
                      <View key={kw} style={[styles.chip, matched && styles.chipMatched]}>
                        <Text style={[styles.chipText, matched && styles.chipTextMatched]}>{kw}</Text>
                      </View>
                    );
                  })}
                </View>
                <TextInput
                  style={[styles.input, styles.rationaleInput, s.rationaleError && styles.inputError]}
                  value={s.rationale}
                  onChangeText={text => runRationaleValidation(key, text)}
                  placeholder="Provide exception rationale..."
                  placeholderTextColor={COLORS.muted}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
                {s.rationaleError && <Text style={styles.errMsg}>{s.rationaleError}</Text>}
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">

        {/* Status bar */}
        <View style={styles.statusBar}>
          <View style={[styles.statusDot, { backgroundColor: serverOnline ? COLORS.success : serverOnline === false ? COLORS.error : COLORS.muted }]} />
          <Text style={styles.statusText}>
            {serverOnline === null ? 'Checking Connection...' : serverOnline ? '🛡️ SYSTEM ONLINE' : '⚠️ BACKEND OFFLINE'}
          </Text>
          <Text style={styles.staffBadge}>👤 {user?.name || 'Staff'}</Text>
        </View>

        {/* Blocked Banner */}
        {blocked && (
          <View style={styles.blockedBanner}>
            <Text style={styles.blockedText}>⛔ {blocked}</Text>
          </View>
        )}

        {/* Flagged Indicator */}
        {isFlagged && (
          <View style={styles.flagBanner}>
            <Text style={styles.flagText}>⚑ This submission will be FLAGGED for manager review (exceptions &gt; limit)</Text>
          </View>
        )}

        {/* Exception counter */}
        <View style={styles.counterRow}>
          <Text style={styles.counterText}>EXCEPTIONS: <Text style={{ color: COLORS.warn }}>{activeExceptions.length}</Text> / {rules.exception_limit}</Text>
        </View>

        {/* ── PERSONAL INFO ── */}
        <Text style={styles.sectionLabel}>Personal Information</Text>
        {renderField('Full Name', 'name', { required: true, placeholder: 'e.g. Rahul Sharma' })}
        {renderField('Email', 'email', { required: true, placeholder: 'e.g. rahul@example.com', keyboardType: 'email-address', autoCapitalize: 'none' })}
        {renderField('Phone', 'phone', { required: true, placeholder: '10-digit number', keyboardType: 'phone-pad', maxLength: 10 })}
        {renderField('Aadhaar Number', 'aadhaar', { required: true, placeholder: '12-digit Aadhaar', keyboardType: 'numeric', maxLength: 12 })}
        {renderSoftField('Age', 'age', { placeholder: 'e.g. 24' })}

        {/* ── ACADEMIC INFO ── */}
        <Text style={styles.sectionLabel}>Academic Information</Text>
        {renderPickerField('Qualification', 'qualification', [
          { label: 'BTech', value: 'BTech' }, { label: 'MBA', value: 'MBA' },
          { label: 'MCA', value: 'MCA' }, { label: 'BSc', value: 'BSc' }, { label: 'Other', value: 'Other' },
        ], { required: true })}
        {renderSoftField('Graduation Year', 'grad_year', { placeholder: 'e.g. 2022' })}
        {renderSoftField('Percentage / CGPA', 'percentage', { placeholder: 'e.g. 72 or 7.5' })}

        {/* ── ASSESSMENT ── */}
        <Text style={styles.sectionLabel}>Assessment & Interview</Text>
        {renderSoftField('Screening Test Score', 'screening_score', { placeholder: 'Score out of 100' })}
        {renderPickerField('Interview Status', 'interview_status', [
          { label: 'Cleared', value: 'Cleared' }, { label: 'Rejected', value: 'Rejected' },
        ], { required: true })}

        {fields.interview_status === 'Cleared' && renderPickerField('Offer Letter Received', 'offer_letter', [
          { label: 'Yes', value: 'yes' }, { label: 'No', value: 'no' },
        ], { required: true })}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Submit Button — Floating Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, (blocked || submitting) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!!blocked || submitting}
        >
          {submitting
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.submitBtnText}>SUBMIT CANDIDATE</Text>
          }
        </TouchableOpacity>
      </View>

      {/* ── SUCCESS MODAL ── */}
      <Modal visible={!!successModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <Animated.View style={[styles.successCard, { opacity: fadeAnim }]}>
            <View style={styles.successIcon}><Text style={{ fontSize: 28 }}>✓</Text></View>
            <Text style={styles.successTitle}>SUBMITTED</Text>
            <Text style={styles.successName}>{successModal?.fields?.name}</Text>
            <Text style={styles.successTime}>{successModal && new Date(successModal.timestamp).toLocaleString()}</Text>
            {successModal?.flagged && (
              <View style={styles.flaggedWarning}>
                <Text style={styles.flaggedWarningText}>⚑ Flagged for manager review — exceptions exceeded limit</Text>
              </View>
            )}
            <TouchableOpacity style={styles.newEntryBtn} onPress={resetForm}>
              <Text style={styles.newEntryBtnText}>+ NEW ENTRY</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 120 },

  statusBar: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { color: COLORS.muted, fontSize: 10, flex: 1, letterSpacing: 1 },
  staffBadge: { color: COLORS.accent, fontSize: 10, borderWidth: 1, borderColor: COLORS.accent, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },

  blockedBanner: { backgroundColor: 'rgba(255,75,110,0.1)', borderWidth: 1, borderColor: 'rgba(255,75,110,0.3)', borderRadius: 8, padding: 12, marginBottom: 12 },
  blockedText: { color: COLORS.error, fontSize: 12, fontWeight: '500' },

  flagBanner: { backgroundColor: 'rgba(255,179,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)', borderRadius: 8, padding: 10, marginBottom: 12 },
  flagText: { color: COLORS.warn, fontSize: 11 },

  counterRow: { marginBottom: 16 },
  counterText: { color: COLORS.muted, fontSize: 10, letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  sectionLabel: {
    color: COLORS.muted, fontSize: 10, letterSpacing: 2, textTransform: 'uppercase',
    marginTop: 20, marginBottom: 12, paddingBottom: 6,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },

  field: { marginBottom: 14 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  label: { color: COLORS.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  req: { color: COLORS.accent2 },
  softTag: { backgroundColor: 'rgba(255,179,0,0.15)', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 3 },
  softTagText: { color: COLORS.warn, fontSize: 8, letterSpacing: 0.5 },

  input: {
    backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border,
    borderRadius: 8, color: COLORS.text, fontSize: 14, padding: 12,
  },
  inputError: { borderColor: COLORS.error, backgroundColor: 'rgba(255,75,110,0.06)' },
  rationaleInput: { height: 80, marginTop: 8 },
  errMsg: { color: COLORS.error, fontSize: 10, marginTop: 4 },

  optionChip: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 8, marginRight: 8, backgroundColor: COLORS.surface2,
  },
  optionChipSelected: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  optionChipText: { color: COLORS.muted, fontSize: 13 },
  optionChipTextSelected: { color: '#000', fontWeight: '700' },

  exceptionBlock: {
    backgroundColor: 'rgba(255,179,0,0.06)', borderWidth: 1,
    borderColor: 'rgba(255,179,0,0.25)', borderRadius: 8, padding: 12, marginTop: 8,
  },
  exceptionToggle: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  toggleTrack: {
    width: 36, height: 20, borderRadius: 10, backgroundColor: COLORS.border,
    justifyContent: 'center', paddingHorizontal: 2,
  },
  toggleTrackOn: { backgroundColor: 'rgba(255,179,0,0.3)' },
  toggleThumb: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.muted },
  toggleThumbOn: { backgroundColor: COLORS.warn, alignSelf: 'flex-end' },
  exceptionLabel: { color: COLORS.warn, fontSize: 12, fontWeight: '500', flex: 1 },

  rationaleArea: { marginTop: 10 },
  rationaleHint: { color: COLORS.muted, fontSize: 10, marginBottom: 6, lineHeight: 14 },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: COLORS.surface },
  chipMatched: { borderColor: COLORS.success, backgroundColor: 'rgba(0,230,118,0.08)' },
  chipText: { color: COLORS.muted, fontSize: 9, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  chipTextMatched: { color: COLORS.success },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: 16, backgroundColor: COLORS.surface, borderTopWidth: 1, borderTopColor: COLORS.border,
  },
  submitBtn: {
    backgroundColor: COLORS.accent, borderRadius: 10,
    padding: 16, alignItems: 'center',
  },
  submitBtnDisabled: { backgroundColor: COLORS.border },
  submitBtnText: { color: '#000', fontWeight: '700', fontSize: 13, letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  successCard: { backgroundColor: COLORS.bg, borderRadius: 24, padding: 36, alignItems: 'center', width: '100%', borderWidth: 1, borderColor: COLORS.border },
  successIcon: { width: 70, height: 70, borderRadius: 35, backgroundColor: 'rgba(0,230,118,0.1)', borderWidth: 2, borderColor: COLORS.success, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  successTitle: { color: COLORS.success, fontSize: 20, fontWeight: '700', letterSpacing: 3, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace', marginBottom: 8 },
  successName: { color: COLORS.text, fontSize: 16, fontWeight: '600', marginBottom: 4 },
  successTime: { color: COLORS.muted, fontSize: 12, marginBottom: 16 },
  flaggedWarning: { backgroundColor: 'rgba(255,179,0,0.1)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)', borderRadius: 8, padding: 10, marginBottom: 16, width: '100%' },
  flaggedWarningText: { color: COLORS.warn, fontSize: 11, textAlign: 'center' },
  newEntryBtn: { borderWidth: 1, borderColor: COLORS.accent, borderRadius: 8, paddingHorizontal: 32, paddingVertical: 12 },
  newEntryBtnText: { color: COLORS.accent, fontWeight: '700', fontSize: 11, letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
});
