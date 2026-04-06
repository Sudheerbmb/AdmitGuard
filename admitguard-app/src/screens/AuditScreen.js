import React, { useState, useEffect } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet,
  RefreshControl, Modal, ScrollView, Alert, Platform,
} from 'react-native';
import { COLORS } from '../constants';
import { getSubmissions, patchDecision } from '../utils/api';

const maskEmail = (email) => {
  if (!email) return '';
  const parts = email.split('@');
  return parts[0][0] + '***@' + parts[1];
};
const maskName = (name) => {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length > 1) return parts[0] + ' ' + parts[1][0] + '***';
  return parts[0][0] + '***';
};

const STATUS_COLORS = {
  pending: COLORS.muted,
  approved: COLORS.success,
  rejected: COLORS.error,
  flagged: COLORS.warn,
};

export default function AuditScreen() {
  const [submissions, setSubmissions] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [piiMask, setPiiMask] = useState(true);
  const [selected, setSelected] = useState(null); // detail modal
  const [filter, setFilter] = useState('all'); // all | flagged | pending

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const res = await getSubmissions();
      setSubmissions(res.data.map(row => ({
        id: row.candidate_id || row.id,
        timestamp: row.timestamp,
        flagged: row.flagged,
        exceptions_used: row.exceptions_used || [],
        fields: typeof row.fields === 'string' ? JSON.parse(row.fields) : row.fields,
        rationale: typeof row.rationale === 'string' ? JSON.parse(row.rationale) : row.rationale,
        decision: row.decision || 'pending',
        counselor_name: row.counselor_name || null,
      })));
    } catch (err) {
      Alert.alert('Sync Error', 'Could not fetch submissions. Check backend connection.');
    } finally {
      setRefreshing(false);
    }
  };

  const handleDecision = async (candidateId, decision) => {
    Alert.alert(
      `${decision.toUpperCase()} Candidate`,
      `Are you sure you want to ${decision} this candidate?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: decision.toUpperCase(),
          style: decision === 'rejected' ? 'destructive' : 'default',
          onPress: async () => {
            try {
              await patchDecision(candidateId, decision);
              setSubmissions(prev =>
                prev.map(s => s.id === candidateId ? { ...s, decision } : s)
              );
              if (selected?.id === candidateId) setSelected(prev => ({ ...prev, decision }));
            } catch (err) {
              Alert.alert('Error', err.response?.data?.error || 'Failed to update decision.');
            }
          },
        },
      ]
    );
  };

  const filteredData = submissions.filter(s => {
    if (filter === 'flagged') return s.flagged;
    if (filter === 'pending') return s.decision === 'pending';
    return true;
  });

  const renderItem = ({ item: sub }) => {
    const name = piiMask ? maskName(sub.fields?.name) : sub.fields?.name;
    const email = piiMask ? maskEmail(sub.fields?.email) : sub.fields?.email;
    return (
      <TouchableOpacity style={styles.card} onPress={() => setSelected(sub)} activeOpacity={0.7}>
        <View style={styles.cardTop}>
          {/* Avatar */}
          <View style={[styles.avatar, { backgroundColor: sub.flagged ? 'rgba(255,179,0,0.2)' : 'rgba(0,229,255,0.15)' }]}>
            <Text style={[styles.avatarText, { color: sub.flagged ? COLORS.warn : COLORS.accent }]}>
              {(sub.fields?.name || 'U')[0].toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.candidateName}>{name}</Text>
            <Text style={styles.candidateEmail}>{email}</Text>
            {sub.counselor_name && (
              <Text style={styles.counselorTag}>👤 {sub.counselor_name}</Text>
            )}
          </View>
          <View style={styles.statusBadge}>
            <Text style={[styles.statusText, { color: STATUS_COLORS[sub.decision] || COLORS.muted }]}>
              {sub.decision.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.tagRow}>
            {sub.flagged && <View style={styles.flagTag}><Text style={styles.flagTagText}>⚑ FLAGGED</Text></View>}
            {sub.exceptions_used.map(e => (
              <View key={e} style={styles.excTag}>
                <Text style={styles.excTagText}>{e.replace('_', ' ')}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.timestamp}>{new Date(sub.timestamp).toLocaleDateString()}</Text>
        </View>

        {/* Action Buttons for pending */}
        {sub.decision === 'pending' && (
          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.approveBtn} onPress={() => handleDecision(sub.id, 'approved')}>
              <Text style={styles.approveBtnText}>✓ APPROVE</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.rejectBtn} onPress={() => handleDecision(sub.id, 'rejected')}>
              <Text style={styles.rejectBtnText}>✕ REJECT</Text>
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  // ── DETAIL MODAL ──────────────────────────────────────────────
  const DetailModal = () => {
    if (!selected) return null;
    const sub = selected;
    return (
      <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>CANDIDATE DETAIL</Text>
            <TouchableOpacity onPress={() => setSelected(null)} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} contentContainerStyle={{ padding: 20 }}>
            {/* Enrolled By Banner */}
            <View style={styles.enrolledBanner}>
              <View style={styles.enrolledAvatar}>
                <Text style={styles.enrolledAvatarText}>{(sub.counselor_name || 'S')[0].toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.enrolledLabel}>ENROLLED BY</Text>
                <Text style={styles.enrolledName}>{sub.counselor_name || 'System / Unknown'}</Text>
              </View>
              <View>
                <Text style={styles.enrolledLabel}>SUBMITTED</Text>
                <Text style={styles.enrolledDate}>{new Date(sub.timestamp).toLocaleDateString()}</Text>
              </View>
            </View>

            <Text style={styles.detailSection}>Identity</Text>
            {[['Name', sub.fields?.name], ['Email', sub.fields?.email], ['Phone', sub.fields?.phone], ['Aadhaar', sub.fields?.aadhaar]].map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={styles.detailKey}>{k}</Text>
                <Text style={styles.detailVal}>{v || '—'}</Text>
              </View>
            ))}

            <Text style={styles.detailSection}>Academics</Text>
            {[['Qualification', sub.fields?.qualification], ['Graduation Year', sub.fields?.grad_year], ['Percentage/CGPA', sub.fields?.percentage], ['Age', sub.fields?.age]].map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={styles.detailKey}>{k}</Text>
                <Text style={styles.detailVal}>{v || '—'}</Text>
              </View>
            ))}

            <Text style={styles.detailSection}>Assessment</Text>
            {[['Screening Score', sub.fields?.screening_score], ['Interview', sub.fields?.interview_status], ['Offer Letter', sub.fields?.offer_letter]].map(([k, v]) => (
              <View key={k} style={styles.detailRow}>
                <Text style={styles.detailKey}>{k}</Text>
                <Text style={styles.detailVal}>{v || '—'}</Text>
              </View>
            ))}

            <Text style={styles.detailSection}>Validation</Text>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Status</Text>
              <Text style={[styles.detailVal, { color: sub.flagged ? COLORS.warn : COLORS.success }]}>{sub.flagged ? '⚑ FLAGGED' : '✓ CLEAN'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Exceptions</Text>
              <Text style={styles.detailVal}>{sub.exceptions_used?.join(', ') || 'None'}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailKey}>Decision</Text>
              <Text style={[styles.detailVal, { color: STATUS_COLORS[sub.decision] }]}>{sub.decision.toUpperCase()}</Text>
            </View>

            {Object.entries(sub.rationale || {}).some(([, v]) => v) && (
              <>
                <Text style={styles.detailSection}>Staff Rationale</Text>
                {Object.entries(sub.rationale || {}).filter(([, v]) => v).map(([rule, text]) => (
                  <View key={rule} style={styles.rationaleBlock}>
                    <Text style={styles.rationaleRule}>{rule.replace('_', ' ').toUpperCase()}</Text>
                    <Text style={styles.rationaleText}>{text}</Text>
                  </View>
                ))}
              </>
            )}

            {sub.decision === 'pending' && (
              <View style={styles.modalActionRow}>
                <TouchableOpacity style={styles.approveBtn} onPress={() => handleDecision(sub.id, 'approved')}>
                  <Text style={styles.approveBtnText}>✓ APPROVE</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.rejectBtn} onPress={() => handleDecision(sub.id, 'rejected')}>
                  <Text style={styles.rejectBtnText}>✕ REJECT</Text>
                </TouchableOpacity>
              </View>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.bg }}>
      {/* Header controls */}
      <View style={styles.controls}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['all', 'pending', 'flagged'].map(f => (
            <TouchableOpacity
              key={f}
              style={[styles.filterChip, filter === f && styles.filterChipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.filterChipText, filter === f && styles.filterChipTextActive]}>
                {f.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.piiToggle} onPress={() => setPiiMask(p => !p)}>
          <Text style={[styles.piiToggleText, { color: piiMask ? COLORS.accent : COLORS.muted }]}>
            {piiMask ? '🔒 PII' : '🔓 PII'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats bar */}
      <View style={styles.statsRow}>
        {[
          ['Total', submissions.length, COLORS.accent],
          ['Pending', submissions.filter(s => s.decision === 'pending').length, COLORS.muted],
          ['Approved', submissions.filter(s => s.decision === 'approved').length, COLORS.success],
          ['Flagged', submissions.filter(s => s.flagged).length, COLORS.warn],
          ['Rejected', submissions.filter(s => s.decision === 'rejected').length, COLORS.error],
        ].map(([label, count, color]) => (
          <View key={label} style={styles.statItem}>
            <Text style={[styles.statCount, { color }]}>{count}</Text>
            <Text style={styles.statLabel}>{label}</Text>
          </View>
        ))}
      </View>

      <FlatList
        data={filteredData}
        keyExtractor={item => item.id?.toString()}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={fetchData} tintColor={COLORS.accent} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>📋</Text>
            <Text style={styles.emptyTitle}>No Submissions</Text>
            <Text style={styles.emptyText}>Pull down to refresh</Text>
          </View>
        }
      />

      <DetailModal />
    </View>
  );
}

const styles = StyleSheet.create({
  controls: { flexDirection: 'row', alignItems: 'center', padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, gap: 8 },
  filterChip: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 6, marginRight: 8, backgroundColor: COLORS.surface },
  filterChipActive: { backgroundColor: COLORS.accent, borderColor: COLORS.accent },
  filterChipText: { color: COLORS.muted, fontSize: 10, letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  filterChipTextActive: { color: '#000', fontWeight: '700' },
  piiToggle: { marginLeft: 'auto', padding: 6 },
  piiToggleText: { fontSize: 11, fontWeight: '600' },

  statsRow: { flexDirection: 'row', backgroundColor: COLORS.surface, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  statItem: { flex: 1, alignItems: 'center', padding: 10 },
  statCount: { fontSize: 18, fontWeight: '700', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  statLabel: { color: COLORS.muted, fontSize: 9, marginTop: 2, letterSpacing: 0.5 },

  card: { backgroundColor: COLORS.surface, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700' },
  candidateName: { color: COLORS.text, fontSize: 14, fontWeight: '600' },
  candidateEmail: { color: COLORS.muted, fontSize: 11, marginTop: 2 },
  counselorTag: { color: COLORS.accent, fontSize: 9, marginTop: 3, letterSpacing: 0.5 },
  statusBadge: { borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: '700', letterSpacing: 1, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingBottom: 12, justifyContent: 'space-between' },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, flex: 1 },
  flagTag: { backgroundColor: 'rgba(255,179,0,0.15)', borderWidth: 1, borderColor: 'rgba(255,179,0,0.3)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  flagTagText: { color: COLORS.warn, fontSize: 9, fontWeight: '700' },
  excTag: { backgroundColor: COLORS.surface2, borderWidth: 1, borderColor: COLORS.border, borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  excTagText: { color: COLORS.muted, fontSize: 9 },
  timestamp: { color: COLORS.muted, fontSize: 10 },
  actionRow: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: COLORS.border },
  modalActionRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  approveBtn: { flex: 1, backgroundColor: 'rgba(0,230,118,0.1)', borderWidth: 1, borderColor: COLORS.success, padding: 12, alignItems: 'center' },
  approveBtnText: { color: COLORS.success, fontWeight: '700', fontSize: 11, letterSpacing: 1 },
  rejectBtn: { flex: 1, backgroundColor: 'rgba(255,75,110,0.1)', borderWidth: 1, borderColor: COLORS.error, padding: 12, alignItems: 'center' },
  rejectBtnText: { color: COLORS.error, fontWeight: '700', fontSize: 11, letterSpacing: 1 },

  emptyState: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12, opacity: 0.4 },
  emptyTitle: { color: COLORS.muted, fontSize: 14, fontWeight: '600', letterSpacing: 2 },
  emptyText: { color: COLORS.muted, fontSize: 12, marginTop: 6 },

  modalContainer: { flex: 1, backgroundColor: COLORS.bg },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 20, paddingTop: 56, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.surface },
  modalTitle: { color: COLORS.accent, fontSize: 14, fontWeight: '700', letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  closeBtn: { padding: 4 },
  closeBtnText: { color: COLORS.muted, fontSize: 18 },
  modalBody: { flex: 1 },

  enrolledBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.surface, borderRadius: 12, padding: 14, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border, gap: 12 },
  enrolledAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.accent, alignItems: 'center', justifyContent: 'center' },
  enrolledAvatarText: { color: '#000', fontWeight: '700', fontSize: 16 },
  enrolledLabel: { color: COLORS.muted, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' },
  enrolledName: { color: COLORS.text, fontSize: 15, fontWeight: '700', marginTop: 2 },
  enrolledDate: { color: COLORS.text, fontSize: 12, marginTop: 2, textAlign: 'right' },

  detailSection: { color: COLORS.accent, fontSize: 11, fontWeight: '700', letterSpacing: 1, marginTop: 20, marginBottom: 10, textTransform: 'uppercase' },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  detailKey: { color: COLORS.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailVal: { color: COLORS.text, fontSize: 12, fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  rationaleBlock: { backgroundColor: COLORS.surface, borderRadius: 8, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: COLORS.border },
  rationaleRule: { color: COLORS.accent, fontSize: 9, fontWeight: '700', letterSpacing: 1, marginBottom: 4 },
  rationaleText: { color: COLORS.text, fontSize: 12, lineHeight: 18 },
});
