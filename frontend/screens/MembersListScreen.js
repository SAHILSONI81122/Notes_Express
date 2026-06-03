import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, Alert, Modal, TextInput, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { getBatchMembers, getMe, removeMember, getClassGroups, getStudentProgress } from '../api/api';
import { useTheme } from '../context/ThemeContext';

const { width, height } = Dimensions.get('window');

const ROLE_COLORS = {
    admin: { bg_light: '#EEF2FF', bg_dark: '#312E81', text: '#818CF8' },
    teacher: { bg_light: '#ECFDF5', bg_dark: '#064E3B', text: '#34D399' },
    student: { bg_light: '#F3F4F6', bg_dark: '#374151', text: '#9CA3AF' },
};

const MemberItem = React.memo(({ item, isMe, currentUser, isSelected, isSelectionMode, onToggle, onAction }) => {
    const { isDarkMode, colors } = useTheme();
    const memberClasses = item.class_groups?.map(cg => cg.name).join(', ') || '';
    const roleStyle = ROLE_COLORS[item.role] || ROLE_COLORS.student;
    const canManage = (currentUser?.role === 'admin' || currentUser?.role === 'teacher') && !isMe && item.role !== 'teacher';

    return (
        <TouchableOpacity 
            activeOpacity={canManage ? 0.7 : 1}
            onPress={() => {
                if (isSelectionMode && !isMe) {
                    onToggle(item.id);
                } else if (canManage) {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    onAction(item);
                }
            }}
            style={[
                styles.memberCard, 
                { backgroundColor: colors.card },
                isSelected && { borderColor: colors.primary, borderWidth: 1.5, backgroundColor: colors.primary + '0A' }
            ]}
        >
            <View style={[styles.avatar, { backgroundColor: isSelected ? colors.primary : colors.primary + '20' }]}>
                {isSelected ? (
                    <Ionicons name="checkmark" size={24} color="#FFF" />
                ) : (
                    <Text style={[styles.avatarText, { color: colors.primary, fontFamily: 'Inter-Bold' }]}>
                        {item.name.charAt(0).toUpperCase()}
                    </Text>
                )}
            </View>
            
            <View style={styles.memberInfo}>
                <View style={styles.memberNameRow}>
                    <Text style={[styles.memberName, { color: colors.text, fontFamily: 'Inter-Bold' }]} numberOfLines={1}>
                        {item.name}
                    </Text>
                    {isMe && <Text style={[styles.youBadge, { color: colors.primary, fontFamily: 'Inter-Bold' }]}> (You)</Text>}
                </View>
                <Text style={[styles.memberEmail, { color: colors.subtext, fontFamily: 'Inter-Medium' }]} numberOfLines={1}>
                    {item.email}
                </Text>
                {memberClasses ? (
                    <View style={styles.classBadge}>
                        <Ionicons name="school" size={10} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={[styles.memberClass, { color: colors.primary, fontFamily: 'Inter-Bold' }]} numberOfLines={1}>
                            {memberClasses}
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.rightSection}>
                <View style={[styles.roleBadge, { backgroundColor: isDarkMode ? roleStyle.bg_dark : roleStyle.bg_light }]}>
                    <Text style={[styles.roleText, { color: roleStyle.text, fontFamily: 'Inter-Bold' }]}>
                        {item.role.charAt(0).toUpperCase() + item.role.slice(1)}
                    </Text>
                </View>
            </View>
        </TouchableOpacity>
    );
});

const MembersListScreen = ({ route, navigation }) => {
    const { initialUser } = route.params || {};
    const [members, setMembers] = useState([]);
    const [classGroups, setClassGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentUser, setCurrentUser] = useState(initialUser || null);
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [actionMember, setActionMember] = useState(null);
    const [showGlobalMenu, setShowGlobalMenu] = useState(false);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [isBulkLoading, setIsBulkLoading] = useState(false);
    const [memberProgress, setMemberProgress] = useState(null);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(false);

    const { isDarkMode, colors } = useTheme();

    const fetchData = async () => {
        setLoading(true);
        try {
            const userToUse = currentUser || (await getMe()).data;
            if (!currentUser) setCurrentUser(userToUse);
            if (userToUse.batch_id) {
                const [membersRes, groupsRes] = await Promise.all([
                    getBatchMembers(userToUse.batch_id),
                    getClassGroups(userToUse.batch_id)
                ]);
                setMembers(membersRes.data);
                setClassGroups(groupsRes.data);
            }
        } catch (err) {
            console.log(err);
            Alert.alert("Error", "Could not fetch data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, []);

    const handleAction = async (member, action) => {
        setActionMember(null);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            if (action === 'remove') {
                await removeMember(currentUser.batch_id, member.id);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            } else if (action === 'view_progress') {
                setLoadingProgress(true);
                setShowProgressModal(true);
                try {
                    const res = await getStudentProgress(member.id);
                    setMemberProgress(res.data);
                } catch (e) {
                    console.log(e);
                } finally {
                    setLoadingProgress(false);
                }
                return;
            }
            fetchData();
        } catch (err) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Action failed. Make sure you have admin rights.");
        }
    };

    const toggleSelection = (id) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleBulkRemove = async () => {
        if (selectedIds.length === 0) return;
        
        Alert.alert(
            "Bulk Remove",
            `Are you sure you want to remove ${selectedIds.length} members?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Remove All", 
                    style: "destructive", 
                    onPress: async () => {
                        setIsBulkLoading(true);
                        try {
                            const { bulkRemoveMembers } = require('../api/api');
                            await bulkRemoveMembers(currentUser.batch_id, selectedIds);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                            setIsSelectionMode(false);
                            setSelectedIds([]);
                            fetchData();
                        } catch (err) {
                            Alert.alert("Error", "Bulk removal failed.");
                        } finally {
                            setIsBulkLoading(false);
                        }
                    }
                }
            ]
        );
    };

    const renderItem = React.useCallback(({ item }) => {
        const isMe = item.id === currentUser?.id;
        const isSelected = selectedIds.includes(item.id);
        
        return (
            <MemberItem 
                item={item} 
                isMe={isMe} 
                currentUser={currentUser} 
                isSelected={isSelected} 
                isSelectionMode={isSelectionMode}
                onToggle={toggleSelection}
                onAction={setActionMember}
            />
        );
    }, [currentUser, selectedIds, isSelectionMode]);

    const filteredMembers = selectedGroup === null
        ? members
        : members.filter(m => m.class_groups?.some(cg => cg.id === selectedGroup));

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card }]}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>
                        {isSelectionMode ? `${selectedIds.length} Selected` : 'Group Members'}
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                        {filteredMembers.length} member{filteredMembers.length !== 1 ? 's' : ''}
                    </Text>
                </View>

                {isSelectionMode ? (
                    <TouchableOpacity 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            if (selectedIds.length === filteredMembers.length - 1) {
                                setSelectedIds([]);
                            } else {
                                setSelectedIds(filteredMembers.filter(m => m.id !== currentUser.id).map(m => m.id));
                            }
                        }}
                        style={[styles.backButton, { backgroundColor: colors.primary + '20', marginRight: 12 }]}
                    >
                        <Ionicons name="checkbox-outline" size={22} color={colors.primary} />
                    </TouchableOpacity>
                ) : null}

                <TouchableOpacity 
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        if (isSelectionMode) {
                            setIsSelectionMode(false);
                            setSelectedIds([]);
                        } else {
                            setShowGlobalMenu(true);
                        }
                    }}
                    style={[styles.backButton, { backgroundColor: colors.card, marginRight: 0 }]}
                >
                    <Ionicons name={isSelectionMode ? "close" : "ellipsis-vertical"} size={22} color={colors.text} />
                </TouchableOpacity>
            </View>

            {/* Class Filter Chips - FIXED: No stretching */}
            <View style={styles.filterSection}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterScroll}>
                    <TouchableOpacity
                        style={[styles.filterChip, selectedGroup === null ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setSelectedGroup(null);
                        }}
                    >
                        <Text style={[styles.filterChipText, { color: selectedGroup === null ? '#FFF' : colors.text, fontFamily: 'Inter-Bold' }]}>All</Text>
                    </TouchableOpacity>
                    {classGroups.map(cg => (
                        <TouchableOpacity
                            key={cg.id}
                            style={[styles.filterChip, selectedGroup === cg.id ? { backgroundColor: colors.primary } : { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setSelectedGroup(cg.id);
                            }}
                        >
                            <Text style={[styles.filterChipText, { color: selectedGroup === cg.id ? '#FFF' : colors.text, fontFamily: 'Inter-Bold' }]}>{cg.name}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : filteredMembers.length === 0 ? (
                <View style={styles.center}>
                    <Ionicons name="people-outline" size={64} color={colors.subtext} />
                    <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>No Members Found</Text>
                    <Text style={[styles.emptyText, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                        {selectedGroup ? 'No members in this class group yet.' : 'This coaching group has no members yet.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredMembers}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 40 }}
                    showsVerticalScrollIndicator={false}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                    windowSize={5}
                    removeClippedSubviews={true}
                />
            )}

            {/* Action Sheet Modal */}
            <Modal visible={!!actionMember} transparent animationType="slide">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActionMember(null)}>
                    <View style={[styles.actionSheet, { backgroundColor: colors.card }]}>
                        <View style={styles.actionSheetHandle} />
                        <View style={styles.actionSheetHeader}>
                            <View style={[styles.actionAvatar, { backgroundColor: colors.primary }]}>
                                <Text style={[styles.avatarText, { color: '#FFF', fontFamily: 'Inter-Bold' }]}>
                                    {actionMember?.name?.charAt(0).toUpperCase()}
                                </Text>
                            </View>
                            <View>
                                <Text style={[styles.actionName, { color: colors.text, fontFamily: 'Inter-Bold' }]}>{actionMember?.name}</Text>
                                <Text style={[styles.actionRole, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>{actionMember?.role}</Text>
                            </View>
                        </View>
                        <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />



                        {actionMember?.role === 'student' && (
                            <TouchableOpacity
                                style={styles.actionItem}
                                onPress={() => handleAction(actionMember, 'view_progress')}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: colors.primary + '1A' }]}>
                                    <Ionicons name="bar-chart-outline" size={22} color={colors.primary} />
                                </View>
                                <Text style={[styles.actionText, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>View Learning Progress</Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                            </TouchableOpacity>
                        )}

                        {actionMember?.role !== 'teacher' && (
                            <TouchableOpacity
                                style={styles.actionItem}
                                onPress={() => Alert.alert(
                                    "Remove Member",
                                    `Remove ${actionMember?.name} from this group?`,
                                    [
                                        { text: "Cancel", style: "cancel" },
                                        { text: "Remove", style: "destructive", onPress: () => handleAction(actionMember, 'remove') }
                                    ]
                                )}
                            >
                                <View style={[styles.actionIcon, { backgroundColor: colors.error + '1A' }]}>
                                    <Ionicons name="person-remove-outline" size={22} color={colors.error} />
                                </View>
                                <Text style={[styles.actionText, { color: colors.error, fontFamily: 'Inter-SemiBold' }]}>Remove from Group</Text>
                                <Ionicons name="chevron-forward" size={18} color={colors.error} />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity 
                            style={[styles.cancelBtn, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]} 
                            onPress={() => setActionMember(null)}
                        >
                            <Text style={[styles.cancelText, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
            {/* Global Actions Modal */}
            <Modal visible={showGlobalMenu} transparent animationType="slide">
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowGlobalMenu(false)}
                >
                    <View style={[styles.actionSheet, { backgroundColor: colors.card }]}>
                        <View style={styles.actionSheetHandle} />
                        <View style={styles.actionSheetHeader}>
                            <View style={[styles.actionAvatar, { backgroundColor: colors.primary + '20' }]}>
                                <Ionicons name="settings-outline" size={26} color={colors.primary} />
                            </View>
                            <View>
                                <Text style={[styles.actionName, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Group Actions</Text>
                                <Text style={[styles.actionRole, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Manage group settings</Text>
                            </View>
                        </View>
                        <View style={[styles.actionDivider, { backgroundColor: colors.border }]} />

                        <TouchableOpacity
                            style={styles.actionItem}
                            onPress={() => {
                                setShowGlobalMenu(false);
                                setIsSelectionMode(true);
                            }}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: '#8B5CF6' + '1A' }]}>
                                <Ionicons name="list-outline" size={22} color="#8B5CF6" />
                            </View>
                            <Text style={[styles.actionText, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>Select Members</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionItem}
                            onPress={() => {
                                setShowGlobalMenu(false);
                                navigation.navigate('AddMembers', { role: 'student', initialUser: currentUser });
                            }}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: colors.primary + '1A' }]}>
                                <Ionicons name="person-add-outline" size={22} color={colors.primary} />
                            </View>
                            <Text style={[styles.actionText, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>Invite Student</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionItem}
                            onPress={() => {
                                setShowGlobalMenu(false);
                                navigation.navigate('AddMembers', { role: 'teacher', initialUser: currentUser });
                            }}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: colors.primary + '1A' }]}>
                                <Ionicons name="ribbon-outline" size={22} color={colors.primary} />
                            </View>
                            <Text style={[styles.actionText, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>Invite Teacher</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.actionItem}
                            onPress={() => {
                                setShowGlobalMenu(false);
                                fetchData();
                            }}
                        >
                            <View style={[styles.actionIcon, { backgroundColor: colors.success + '1A' }]}>
                                <Ionicons name="refresh-outline" size={22} color={colors.success} />
                            </View>
                            <Text style={[styles.actionText, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>Refresh Member List</Text>
                            <Ionicons name="chevron-forward" size={18} color={colors.subtext} />
                        </TouchableOpacity>

                        <TouchableOpacity 
                            style={[styles.cancelBtn, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]} 
                            onPress={() => setShowGlobalMenu(false)}
                        >
                            <Text style={[styles.cancelText, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Cancel</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </Modal>
            {/* Bulk Action Bar */}
            {isSelectionMode && selectedIds.length > 0 && (
                <View style={[styles.bulkBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
                    <Text style={[styles.bulkCount, { color: colors.text, fontFamily: 'Inter-Bold' }]}>
                        {selectedIds.length} Selected
                    </Text>
                    <TouchableOpacity 
                        style={[styles.bulkDeleteBtn, { backgroundColor: colors.error }]} 
                        onPress={handleBulkRemove}
                        disabled={isBulkLoading}
                    >
                        {isBulkLoading ? (
                            <ActivityIndicator color="#FFF" size="small" />
                        ) : (
                            <>
                                <Ionicons name="trash-outline" size={20} color="#FFF" style={{marginRight: 8}} />
                                <Text style={styles.bulkDeleteText}>Remove All</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* Progress Modal */}
            <Modal visible={showProgressModal} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowProgressModal(false)}>
                    <View style={[styles.progressModalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.progressHeaderRow}>
                            <Text style={[styles.progressModalTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>
                                Student Progress
                            </Text>
                            <TouchableOpacity onPress={() => setShowProgressModal(false)}>
                                <Ionicons name="close-circle" size={24} color={colors.subtext} />
                            </TouchableOpacity>
                        </View>

                        {loadingProgress ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 30 }} />
                        ) : memberProgress ? (
                            <View>
                                <View style={styles.progressUserCard}>
                                    <View style={[styles.progressAvatar, { backgroundColor: colors.primary + '20' }]}>
                                        <Text style={{ color: colors.primary, fontFamily: 'Inter-Bold', fontSize: 18 }}>
                                            {actionMember?.name.charAt(0).toUpperCase()}
                                        </Text>
                                    </View>
                                    <View>
                                        <Text style={[styles.progressUserName, { color: colors.text, fontFamily: 'Inter-Bold' }]}>{actionMember?.name}</Text>
                                        <Text style={{ color: colors.subtext, fontSize: 12 }}>Overall Completion: {memberProgress.overall_percentage}%</Text>
                                    </View>
                                </View>

                                <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                                    <View style={[styles.progressBarFill, { backgroundColor: colors.primary, width: `${memberProgress.overall_percentage}%` }]} />
                                </View>

                                <View style={styles.progressStatsGrid}>
                                    <View style={[styles.progressStatBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                        <Text style={[styles.progressStatValue, { color: colors.text, fontFamily: 'Inter-Bold' }]}>{memberProgress.notes_completed}/{memberProgress.total_notes}</Text>
                                        <Text style={[styles.progressStatLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Notes Finished</Text>
                                    </View>
                                    <View style={[styles.progressStatBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
                                        <Text style={[styles.progressStatValue, { color: colors.text, fontFamily: 'Inter-Bold' }]}>{memberProgress.dpps_solved}/{memberProgress.total_dpps}</Text>
                                        <Text style={[styles.progressStatLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>DPPs Solved</Text>
                                    </View>
                                </View>
                            </View>
                        ) : (
                            <Text style={{ color: colors.subtext, textAlign: 'center', marginVertical: 20 }}>No progress data found.</Text>
                        )}
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 24 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 24 },
    backButton: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    title: { fontSize: 22, fontFamily: 'Inter-ExtraBold' },
    subtitle: { fontSize: 12, fontFamily: 'Inter-Medium', marginTop: 1 },
    filterSection: { marginBottom: 16, height: 40 },
    filterScroll: { paddingRight: 24, alignItems: 'center' },
    filterChip: { 
        height: 34, paddingHorizontal: 16, borderRadius: 17, marginRight: 8, 
        justifyContent: 'center', alignItems: 'center',
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1
    },
    filterChipText: { fontSize: 12 },
    memberCard: { 
        flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 20, marginBottom: 10, 
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 
    },
    avatar: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { fontSize: 18 },
    memberInfo: { flex: 1, marginRight: 6 },
    memberNameRow: { flexDirection: 'row', alignItems: 'center' },
    memberName: { fontSize: 15 },
    youBadge: { fontSize: 12 },
    memberEmail: { fontSize: 12, marginTop: 1, opacity: 0.7 },
    classBadge: { flexDirection: 'row', alignItems: 'center', marginTop: 6, alignSelf: 'flex-start', backgroundColor: 'rgba(79, 70, 229, 0.08)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    memberClass: { fontSize: 10, letterSpacing: 0.2 },
    rightSection: { alignItems: 'flex-end', justifyContent: 'center' },
    roleBadge: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, marginBottom: 8 },
    roleText: { fontSize: 8.5, letterSpacing: 0.5, textTransform: 'uppercase' },
    moreBtn: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: { fontSize: 18, marginTop: 16, marginBottom: 6 },
    emptyText: { fontSize: 14, textAlign: 'center', paddingHorizontal: 20 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    actionSheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20, paddingTop: 12 },
    actionSheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 16 },
    actionSheetHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    actionAvatar: { width: 52, height: 52, borderRadius: 26, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    actionName: { fontSize: 18 },
    actionRole: { fontSize: 13, marginTop: 1, textTransform: 'capitalize' },
    actionDivider: { height: 1, marginBottom: 10, opacity: 0.5 },
    actionItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
    actionIcon: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    actionText: { flex: 1, fontSize: 15 },
    cancelBtn: { borderRadius: 14, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
    cancelText: { fontSize: 15 },
    // Bulk Bar
    bulkBar: { 
        position: 'absolute', bottom: 0, left: 0, right: 0, 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 24, paddingVertical: 20, borderTopWidth: 1,
        shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 20
    },
    bulkCount: { fontSize: 16 },
    bulkDeleteBtn: { 
        flexDirection: 'row', alignItems: 'center', 
        paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12,
        shadowColor: "#EF4444", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4
    },
    bulkDeleteText: { color: '#FFF', fontSize: 15, fontWeight: '700' },
    // Progress Modal Styles
    progressModalContent: { width: width * 0.85, padding: 24, borderRadius: 28, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10, alignSelf: 'center', marginBottom: height * 0.3 },
    progressHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    progressModalTitle: { fontSize: 18 },
    progressUserCard: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, gap: 12 },
    progressAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
    progressUserName: { fontSize: 16 },
    progressBarBg: { height: 8, borderRadius: 4, width: '100%', marginBottom: 20, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 4 },
    progressStatsGrid: { flexDirection: 'row', gap: 12 },
    progressStatBox: { flex: 1, padding: 12, borderRadius: 16, borderWidth: 1, alignItems: 'center' },
    progressStatValue: { fontSize: 16 },
    progressStatLabel: { fontSize: 10, marginTop: 2, opacity: 0.8 }
});

export default MembersListScreen;
