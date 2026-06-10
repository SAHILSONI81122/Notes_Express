import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, ActivityIndicator, Modal, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { getMe, API_URL, updateBatch, getBatchMembers, uploadFile, updateInstitute } from '../api/api';
import { useTheme } from '../context/ThemeContext';

const CoachingInfoScreen = ({ navigation }) => {
    const [batch, setBatch] = useState(null);
    const [user, setUser] = useState(null);
    const [staff, setStaff] = useState([]);
    const [totalMembers, setTotalMembers] = useState(0);
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);

    // Single unified fields — same logo/name saved to both batch and institute
    const [editName, setEditName] = useState('');
    const [editAddress, setEditAddress] = useState('');
    const [editLogoUri, setEditLogoUri] = useState(null);   // local preview URI
    const [editLogoUrl, setEditLogoUrl] = useState('');     // uploaded server path
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [saving, setSaving] = useState(false);
    const { colors, isDarkMode } = useTheme();

    useEffect(() => {
        const fetchInfo = async () => {
            try {
                const res = await getMe();
                setUser(res.data);
                setBatch(res.data.batch);

                // Prefer institute name/logo for display (white-label source of truth)
                const displayName = res.data.institute?.name || res.data.batch?.name || '';
                const displayLogoUrl = res.data.institute?.logo_url || res.data.batch?.logo_url || '';

                setEditName(displayName);
                setEditAddress(res.data.batch?.address || '');
                setEditLogoUrl(displayLogoUrl);
                setEditLogoUri(displayLogoUrl ? `${displayLogoUrl?.startsWith('http') ? displayLogoUrl : `\${API_URL}\${displayLogoUrl}`}` : null);

                const targetBatchId = res.data.batch_id || res.data.batch?.id || (res.data.all_batches && res.data.all_batches.length > 0 ? res.data.all_batches[0].id : null);
                
                if (targetBatchId) {
                    const membersRes = await getBatchMembers(targetBatchId);
                    setTotalMembers(membersRes.data.length);
                    const staffMembers = membersRes.data.filter(m => m.role === 'admin' || m.role === 'teacher');
                    setStaff(staffMembers);
                }
            } catch (err) {
                console.log(err);
            } finally {
                setLoading(false);
            }
        };
        fetchInfo();
    }, []);

    useEffect(() => {
        if (isEditing && batch) {
            const displayName = user?.institute?.name || batch.name || '';
            const displayLogoUrl = user?.institute?.logo_url || batch.logo_url || '';
            setEditName(displayName);
            setEditAddress(batch.address || '');
            setEditLogoUrl(displayLogoUrl);
            setEditLogoUri(displayLogoUrl ? `${displayLogoUrl?.startsWith('http') ? displayLogoUrl : `\${API_URL}\${displayLogoUrl}`}` : null);
        }
    }, [isEditing, batch]);

    const pickImage = async () => {
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                alert('Permission to access camera roll is required!');
                return;
            }
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.5,
            });
            if (!result.canceled) {
                const selectedUri = result.assets[0].uri;
                setEditLogoUri(selectedUri);
                setIsUploadingLogo(true);
                try {
                    const formData = new FormData();
                    formData.append('file', { uri: selectedUri, name: 'coaching_logo.jpg', type: 'image/jpeg' });
                    const res = await uploadFile(formData);
                    setEditLogoUrl(res.data.file_url);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                } catch (error) {
                    console.log(error);
                    alert('Failed to upload logo image');
                } finally {
                    setIsUploadingLogo(false);
                }
            }
        } catch (error) {
            console.log(error);
        }
    };

    const handleSave = async () => {
        if (!editName.trim()) return;
        if (isUploadingLogo) {
            alert('Please wait for the logo to finish uploading.');
            return;
        }
        setSaving(true);
        try {
            // Save to batch
            const batchRes = await updateBatch(batch.id, {
                name: editName,
                address: editAddress,
                logo_url: editLogoUrl,
            });
            setBatch(batchRes.data);

            // Also save to institute for white-label branding (drawer sidebar)
            if (user?.institute_id) {
                await updateInstitute({ name: editName, logo_url: editLogoUrl });
                setUser(prev => prev ? {
                    ...prev,
                    institute: { ...prev.institute, name: editName, logo_url: editLogoUrl }
                } : prev);
            }

            setIsEditing(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            console.log(err);
        } finally {
            setSaving(false);
        }
    };

    // Unified display values — institute is the white-label source of truth
    const displayName = user?.institute?.name || batch?.name || 'My Coaching';
    const displayLogoUrl = user?.institute?.logo_url || batch?.logo_url || null;

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: colors.background }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: colors.card }]}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold', flex: 1 }]}>Coaching Info</Text>

                {user?.role === 'admin' && (
                    <TouchableOpacity
                        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsEditing(true); }}
                        style={[styles.editBtn, { backgroundColor: colors.primary + '1A' }]}
                    >
                        <Ionicons name="create-outline" size={20} color={colors.primary} />
                        <Text style={{ color: colors.primary, fontFamily: 'Inter-Bold', marginLeft: 6 }}>Edit</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                <View style={[styles.infoCard, { backgroundColor: colors.card }]}>
                    <View style={[styles.logoContainer, { backgroundColor: colors.primary + '1A' }]}>
                        {displayLogoUrl ? (
                            <Image source={{ uri: `${displayLogoUrl?.startsWith('http') ? displayLogoUrl : `\${API_URL}\${displayLogoUrl}`}` }} style={styles.logo} />
                        ) : (
                            <Ionicons name="business" size={40} color={colors.primary} />
                        )}
                    </View>

                    <Text style={[styles.batchName, { color: colors.text, fontFamily: 'Inter-Bold' }]}>{displayName}</Text>
                    <View style={styles.tagRow}>
                        <View style={[styles.tag, { backgroundColor: colors.primary + '15' }]}>
                            <Text style={[styles.tagText, { color: colors.primary, fontFamily: 'Inter-Bold' }]}>Verified Center</Text>
                        </View>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    <View style={styles.detailRow}>
                        <View style={[styles.iconBox, { backgroundColor: colors.primary + '10' }]}>
                            <Ionicons name="location" size={20} color={colors.primary} />
                        </View>
                        <View style={styles.detailText}>
                            <Text style={[styles.detailLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Address</Text>
                            <Text style={[styles.detailValue, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>
                                {batch?.address || 'Not specified'}
                            </Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={[styles.iconBox, { backgroundColor: '#F59E0B' + '10' }]}>
                            <Ionicons name="people" size={20} color="#F59E0B" />
                        </View>
                        <View style={styles.detailText}>
                            <Text style={[styles.detailLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Community Size</Text>
                            <Text style={[styles.detailValue, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>
                                {totalMembers} Total ({totalMembers - staff.length} Students, {staff.length} Staff)
                            </Text>
                        </View>
                    </View>

                    <View style={styles.detailRow}>
                        <View style={[styles.iconBox, { backgroundColor: '#8B5CF6' + '10' }]}>
                            <Ionicons name="key" size={20} color="#8B5CF6" />
                        </View>
                        <View style={styles.detailText}>
                            <Text style={[styles.detailLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                                {user?.role === 'admin' || user?.role === 'teacher' ? 'Student Invite Code' : 'Invite Code'}
                            </Text>
                            <Text style={[styles.detailValue, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>
                                {batch?.invite_code || 'N/A'}
                            </Text>
                        </View>
                    </View>

                    {(user?.role === 'admin' || user?.role === 'teacher') && (
                        <View style={styles.detailRow}>
                            <View style={[styles.iconBox, { backgroundColor: '#10B981' + '10' }]}>
                                <Ionicons name="ribbon" size={20} color="#10B981" />
                            </View>
                            <View style={styles.detailText}>
                                <Text style={[styles.detailLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Teacher Invite Code</Text>
                                <Text style={[styles.detailValue, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>
                                    {batch?.teacher_invite_code || 'N/A'}
                                </Text>
                            </View>
                        </View>
                    )}

                    <View style={styles.detailRow}>
                        <View style={[styles.iconBox, { backgroundColor: colors.success + '10' }]}>
                            <Ionicons name="calendar" size={20} color={colors.success} />
                        </View>
                        <View style={styles.detailText}>
                            <Text style={[styles.detailLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Active Since</Text>
                            <Text style={[styles.detailValue, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>
                                {new Date(batch?.created_at || Date.now()).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                            </Text>
                        </View>
                    </View>
                </View>

                <View style={styles.staffSection}>
                    <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Staff & Administration</Text>
                    {staff.map(member => (
                        <View key={member.id} style={[styles.staffCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={[styles.staffAvatar, { backgroundColor: member.role === 'admin' ? '#8B5CF6' + '20' : colors.primary + '20' }]}>
                                <Text style={{ color: member.role === 'admin' ? '#8B5CF6' : colors.primary, fontFamily: 'Inter-Bold' }}>
                                    {member.name.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.staffName, { color: colors.text, fontFamily: 'Inter-Bold' }]}>{member.name}</Text>
                                <Text style={[styles.staffRole, { color: member.role === 'admin' ? '#8B5CF6' : colors.primary, fontFamily: 'Inter-Bold' }]}>
                                    {member.role.toUpperCase()}
                                </Text>
                            </View>
                            <View style={[styles.roleDot, { backgroundColor: member.role === 'admin' ? '#8B5CF6' : colors.primary }]} />
                        </View>
                    ))}
                </View>

                <View style={[styles.helpCard, { backgroundColor: colors.primary + '0A', borderColor: colors.primary + '20' }]}>
                    <Ionicons name="information-circle" size={24} color={colors.primary} />
                    <Text style={[styles.helpText, { color: colors.text, fontFamily: 'Inter-Medium' }]}>
                        This information is managed by your administration. If you notice any incorrect details, please contact your teacher.
                    </Text>
                </View>
            </ScrollView>

            {/* Edit Modal */}
            <Modal visible={isEditing} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => !saving && setIsEditing(false)}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Edit Coaching Details</Text>

                        {/* Logo — used for both the coaching card and app sidebar branding */}
                        <View style={styles.modalLogoContainer}>
                            <TouchableOpacity
                                style={[styles.modalLogoCircle, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6', borderColor: colors.border }]}
                                onPress={pickImage}
                                disabled={isUploadingLogo}
                            >
                                {isUploadingLogo ? (
                                    <ActivityIndicator size="small" color={colors.primary} />
                                ) : editLogoUri ? (
                                    <>
                                        <View style={styles.modalLogoWrapper}>
                                            <Image source={{ uri: editLogoUri }} style={styles.modalLogoImage} />
                                        </View>
                                        <View style={[styles.modalPlusBadge, { backgroundColor: colors.primary }]}>
                                            <Ionicons name="pencil" size={12} color="#FFF" />
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        <Ionicons name="camera-outline" size={32} color={colors.primary} />
                                        <View style={[styles.modalPlusBadge, { backgroundColor: colors.primary }]}>
                                            <Ionicons name="add" size={14} color="#FFF" />
                                        </View>
                                    </>
                                )}
                            </TouchableOpacity>
                            <Text style={[styles.modalLogoText, { color: colors.primary, fontFamily: 'Inter-Bold' }]}>
                                {editLogoUri ? 'Change Logo' : 'Add Coaching Logo'}
                            </Text>
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { color: colors.subtext, fontFamily: 'Inter-Bold' }]}>COACHING NAME</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background }]}
                                value={editName}
                                onChangeText={setEditName}
                                placeholder="Enter coaching name"
                                placeholderTextColor={colors.subtext}
                            />
                        </View>

                        <View style={styles.inputContainer}>
                            <Text style={[styles.label, { color: colors.subtext, fontFamily: 'Inter-Bold' }]}>ADDRESS</Text>
                            <TextInput
                                style={[styles.input, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, height: 80 }]}
                                value={editAddress}
                                onChangeText={setEditAddress}
                                placeholder="Enter center address"
                                placeholderTextColor={colors.subtext}
                                multiline
                            />
                        </View>

                        <View style={styles.modalButtons}>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.border }]}
                                onPress={() => setIsEditing(false)}
                                disabled={saving}
                            >
                                <Text style={[styles.modalBtnText, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalBtn, { backgroundColor: colors.primary }]}
                                onPress={handleSave}
                                disabled={saving || !editName.trim()}
                            >
                                {saving ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : (
                                    <Text style={[styles.modalBtnText, { color: '#FFF', fontFamily: 'Inter-Bold' }]}>Save Changes</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 24 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 25 },
    backBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    editBtn: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
    title: { fontSize: 22 },
    scrollContent: { paddingBottom: 30 },
    infoCard: { borderRadius: 28, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 3 },
    logoContainer: { width: 80, height: 80, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    logo: { width: 80, height: 80, borderRadius: 24 },
    batchName: { fontSize: 24, textAlign: 'center', marginBottom: 8 },
    tagRow: { flexDirection: 'row', marginBottom: 24 },
    tag: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
    tagText: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    divider: { width: '100%', height: 1, marginBottom: 24, opacity: 0.5 },
    detailRow: { flexDirection: 'row', width: '100%', alignItems: 'center', marginBottom: 20 },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 15 },
    detailText: { flex: 1 },
    detailLabel: { fontSize: 12, marginBottom: 2 },
    detailValue: { fontSize: 15 },
    helpCard: { marginTop: 20, padding: 16, borderRadius: 20, flexDirection: 'row', borderWidth: 1, gap: 12 },
    helpText: { flex: 1, fontSize: 13, lineHeight: 18 },
    staffSection: { marginTop: 32 },
    sectionTitle: { fontSize: 18, marginBottom: 16 },
    staffCard: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, marginBottom: 10, borderWidth: 1, gap: 12 },
    staffAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    staffName: { fontSize: 15 },
    staffRole: { fontSize: 10, marginTop: 2, letterSpacing: 0.5 },
    roleDot: { width: 8, height: 8, borderRadius: 4 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { width: '100%', padding: 24, borderRadius: 32, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    modalTitle: { fontSize: 20, marginBottom: 24, textAlign: 'center' },
    modalLogoContainer: { alignItems: 'center', marginBottom: 20 },
    modalLogoCircle: { width: 90, height: 90, borderRadius: 45, justifyContent: 'center', alignItems: 'center', marginBottom: 8, borderWidth: 2, borderStyle: 'dashed', position: 'relative' },
    modalLogoWrapper: { width: '100%', height: '100%', borderRadius: 45, overflow: 'hidden' },
    modalLogoImage: { width: '100%', height: '100%' },
    modalPlusBadge: { position: 'absolute', bottom: 2, right: 2, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#FFF', zIndex: 10 },
    modalLogoText: { fontSize: 13 },
    inputContainer: { marginBottom: 20 },
    label: { fontSize: 10, letterSpacing: 1, marginBottom: 8 },
    input: { borderWidth: 1, borderRadius: 16, padding: 16, fontSize: 15, fontFamily: 'Inter-Medium' },
    modalButtons: { flexDirection: 'row', gap: 12, marginTop: 12 },
    modalBtn: { flex: 1, height: 54, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    modalBtnText: { fontSize: 15 },
});

export default CoachingInfoScreen;
