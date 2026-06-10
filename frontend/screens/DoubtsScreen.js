import React, { useState, useCallback, useRef } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity,
    ActivityIndicator, Animated, Image, ScrollView, RefreshControl, Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useFocusEffect } from '@react-navigation/native';
import { getConversations, getAvailableTeachers, getMe, API_URL, deleteConversation } from '../api/api';
import { useTheme } from '../context/ThemeContext';

const DoubtsScreen = ({ navigation }) => {
    const [conversations, setConversations] = useState([]);
    const [teachers, setTeachers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [user, setUser] = useState(null);
    const [error, setError] = useState(null);
    const { isDarkMode, colors } = useTheme();

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const headerScale = useRef(new Animated.Value(0.95)).current;
    // Track whether the initial load + entrance animation has already run
    const hasLoadedOnce = useRef(false);

    const fetchData = async (isRefresh = false) => {
        try {
            setError(null);
            const [convRes, meRes] = await Promise.all([getConversations(), getMe()]);
            setConversations(convRes.data || []);
            setUser(meRes.data);

            if (meRes.data?.role === 'student') {
                try {
                    const teacherRes = await getAvailableTeachers();
                    setTeachers(teacherRes.data || []);
                } catch (e) {
                    console.log('Teachers fetch error:', e);
                    setTeachers([]);
                }
            }
        } catch (err) {
            console.log('DoubtsScreen error:', err);
            setError('Could not load conversations. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => {
        if (!hasLoadedOnce.current) {
            // ── First mount: show loading state + run entrance animation ──
            hasLoadedOnce.current = true;
            fadeAnim.setValue(0);
            headerScale.setValue(0.95);
            setLoading(true);
            fetchData();
            Animated.parallel([
                Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
                Animated.spring(headerScale, { toValue: 1, friction: 8, tension: 60, useNativeDriver: true }),
            ]).start();
        } else {
            // ── Re-focus (returning from ChatScreen etc): silent refresh only ──
            // Keep existing content visible, just refresh data in background
            fetchData();
        }
    }, []));

    const onRefresh = () => {
        setRefreshing(true);
        fetchData(true);
    };

    const formatTime = (dateStr) => {
        if (!dateStr) return '';
        const diff = Date.now() - new Date(dateStr);
        const mins = Math.floor(diff / 60000);
        const hrs = Math.floor(diff / 3600000);
        const days = Math.floor(diff / 86400000);
        if (mins < 1) return 'Now';
        if (mins < 60) return `${mins}m`;
        if (hrs < 24) return `${hrs}h`;
        if (days < 7) return `${days}d`;
        return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    const getInitials = (name) =>
        name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

    const getRoleColor = (role) => {
        if (role === 'admin') return '#818CF8';
        if (role === 'teacher') return '#34D399';
        return colors.primary;
    };

    const getPreviewText = (msg) => {
        if (!msg) return '';
        if (msg === '📷' || msg === 'Photo') return 'Photo';
        return msg;
    };

    const isPhotoMessage = (msg) => msg === '📷' || msg === 'Photo';

    const openChat = (userId, userName, isOnline) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate('ChatScreen', { otherUserId: userId, otherUserName: userName, isOnline });
    };

    const handleLongPressConv = (userId, userName) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        Alert.alert(
            "Delete Conversation",
            `Are you sure you want to delete your conversation with ${userName}?`,
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Delete", 
                    style: "destructive",
                    onPress: async () => {
                        try {
                            setLoading(true);
                            await deleteConversation(userId);
                            fetchData(true);
                            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        } catch (e) {
                            Alert.alert("Error", "Could not delete conversation");
                            setLoading(false);
                        }
                    }
                }
            ]
        );
    };

    // Derive isStudent only after user is loaded
    const isStudent = user?.role === 'student';
    const screenTitle = user ? (isStudent ? 'Ask Doubts' : 'Doubts') : '';

    if (loading) return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                    Loading...
                </Text>
            </View>
        </SafeAreaView>
    );

    const hasContent = conversations.length > 0 || (isStudent && teachers.length > 0);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <Animated.View style={[styles.header, { transform: [{ scale: headerScale }] }]}>
                <View style={styles.headerRow}>
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={[styles.backBtn, { backgroundColor: colors.card, borderColor: colors.border }]}
                    >
                        <Ionicons name="chevron-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTextContainer}>
                        <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>
                            {screenTitle}
                        </Text>
                        {!isStudent && conversations.length > 0 && (
                            <Text style={[styles.subtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                                {`${conversations.length} conversation${conversations.length !== 1 ? 's' : ''}`}
                            </Text>
                        )}
                    </View>
                    {conversations.length > 0 && (
                        <View style={[styles.countBadge, { backgroundColor: colors.primary + '18' }]}>
                            <Text style={[styles.countText, { color: colors.primary, fontFamily: 'Inter-ExtraBold' }]}>
                                {conversations.length}
                            </Text>
                        </View>
                    )}
                </View>
            </Animated.View>

            {/* Content */}
            <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 30, flexGrow: 1 }}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={onRefresh}
                            tintColor={colors.primary}
                            colors={[colors.primary]}
                        />
                    }
                >
                    {/* Error state */}
                    {error && (
                        <View style={[styles.errorBanner, { backgroundColor: colors.error + '15', borderColor: colors.error + '30' }]}>
                            <Ionicons name="alert-circle-outline" size={18} color={colors.error} />
                            <Text style={[styles.errorText, { color: colors.error, fontFamily: 'Inter-Medium' }]}>{error}</Text>
                        </View>
                    )}

                    {!hasContent && !error ? (
                        /* Empty state */
                        <View style={styles.emptyContainer}>
                            <View style={[styles.emptyOuter, { backgroundColor: colors.primary + '08' }]}>
                                <View style={[styles.emptyInner, { backgroundColor: colors.primary + '15' }]}>
                                    <Ionicons name="chatbubbles" size={48} color={colors.primary} />
                                </View>
                            </View>
                            <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>
                                {isStudent ? 'No teachers in your group yet' : 'No queries yet'}
                            </Text>
                            <Text style={[styles.emptySub, { color: colors.subtext, fontFamily: 'Inter-Regular' }]}>
                                {isStudent
                                    ? 'Your admin needs to add teachers\nto the coaching group first.'
                                    : 'Students will appear here\nwhen they send questions.'}
                            </Text>
                        </View>
                    ) : (
                        <View>
                            {/* ── Teachers Section (Students only) ── */}
                            {isStudent && teachers.length > 0 && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <View style={[styles.sectionIcon, { backgroundColor: '#34D399' + '15' }]}>
                                            <Ionicons name="people" size={16} color="#34D399" />
                                        </View>
                                        <View style={styles.sectionHeaderText}>
                                            <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>
                                                Your Teachers
                                            </Text>
                                            <Text style={[styles.sectionSub, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                                                Tap to start asking doubts
                                            </Text>
                                        </View>
                                        <View style={[styles.sectionCount, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
                                            <Text style={[styles.sectionCountText, { color: colors.text, fontFamily: 'Inter-Bold' }]}>
                                                {teachers.length}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={{ marginTop: 12 }}>
                                        {teachers.map((teacher) => {
                                            const roleColor = getRoleColor(teacher.role);
                                            const hasConvo = conversations.some(c => c.user_id === teacher.id);
                                            return (
                                                <TouchableOpacity
                                                    key={teacher.id}
                                                    style={[styles.teacherCard, {
                                                        backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                                        borderColor: colors.border,
                                                    }]}
                                                    onPress={() => openChat(teacher.id, teacher.name, teacher.is_online)}
                                                    activeOpacity={0.7}
                                                >
                                                    {/* Avatar container — online dot is SIBLING not child */}
                                                    <View style={styles.teacherAvWrapper}>
                                                        <View style={[styles.teacherAv, { backgroundColor: roleColor + '18' }]}>
                                                            {teacher.avatar_url ? (
                                                                <Image
                                                                    source={{ uri: `${teacher.avatar_url?.startsWith('http') ? teacher.avatar_url : `\${API_URL}\${teacher.avatar_url}`}` }}
                                                                    style={styles.teacherAvImg}
                                                                />
                                                            ) : (
                                                                <Text style={[styles.teacherAvText, { color: roleColor, fontFamily: 'Inter-Bold' }]}>
                                                                    {getInitials(teacher.name)}
                                                                </Text>
                                                            )}
                                                        </View>
                                                        {/* Online dot is outside the clipping avatar */}
                                                        {teacher.is_online && (
                                                            <View style={[styles.teacherOnline, {
                                                                backgroundColor: roleColor,
                                                                borderColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                                                            }]} />
                                                        )}
                                                    </View>

                                                    <View style={{ flex: 1 }}>
                                                        <Text style={[styles.teacherName, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>
                                                            {teacher.name}
                                                        </Text>
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                                                            <View style={[styles.teacherDot, { backgroundColor: roleColor }]} />
                                                            <Text style={[styles.teacherRole, { color: roleColor, fontFamily: 'Inter-Medium' }]}>
                                                                {teacher.role.charAt(0).toUpperCase() + teacher.role.slice(1)}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <View style={[styles.chatBtn, {
                                                        backgroundColor: hasConvo ? colors.primary : colors.primary + 'CC',
                                                    }]}>
                                                        <Ionicons
                                                            name={hasConvo ? 'chatbubble' : 'chatbubble-outline'}
                                                            size={16}
                                                            color="#FFFFFF"
                                                        />
                                                    </View>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}

                            {/* ── Conversations Section ── */}
                            {conversations.length > 0 && (
                                <View style={[styles.section, isStudent && teachers.length > 0 ? { marginTop: 24 } : {}]}>
                                    <View style={styles.sectionHeader}>
                                        <View style={[styles.sectionIcon, { backgroundColor: colors.primary + '18' }]}>
                                            <Ionicons name="chatbubble-ellipses" size={15} color={colors.primary} />
                                        </View>
                                        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>
                                            Recent Conversations
                                        </Text>
                                    </View>
                                    <View style={{ marginTop: 10 }}>
                                        {conversations.map((item, idx) => {
                                            const roleColor = getRoleColor(item.user_role);
                                            const hasUnread = item.unread_count > 0;
                                            const isPhoto = isPhotoMessage(item.last_message);
                                            return (
                                                <TouchableOpacity
                                                    key={item.user_id}
                                                    activeOpacity={0.7}
                                                    style={[
                                                        styles.convCard,
                                                        {
                                                            backgroundColor: colors.card,
                                                            borderColor: hasUnread ? roleColor + '40' : 'transparent',
                                                            borderWidth: hasUnread ? 1.5 : 0,
                                                            marginBottom: idx < conversations.length - 1 ? 10 : 0,
                                                        }
                                                    ]}
                                                    onPress={() => openChat(item.user_id, item.user_name, item.is_online)}
                                                    onLongPress={() => handleLongPressConv(item.user_id, item.user_name)}
                                                >
                                                    {/* Avatar with ring */}
                                                    <View style={styles.avWrapper}>
                                                        <View style={[styles.avRing, { borderColor: roleColor + '40' }]}>
                                                            <View style={[styles.av, { backgroundColor: roleColor + '18' }]}>
                                                                {item.avatar_url ? (
                                                                    <Image source={{ uri: `${item.avatar_url?.startsWith('http') ? item.avatar_url : `\${API_URL}\${item.avatar_url}`}` }} style={styles.avImg} />
                                                                ) : (
                                                                    <Text style={[styles.avText, { color: roleColor, fontFamily: 'Inter-Bold' }]}>
                                                                        {getInitials(item.user_name)}
                                                                    </Text>
                                                                )}
                                                            </View>
                                                        </View>
                                                        {/* Role indicator dot */}
                                                        <View style={[styles.roleInd, { backgroundColor: roleColor, borderColor: colors.card }]} />
                                                        {/* Unread badge */}
                                                        {hasUnread && (
                                                            <View style={[styles.unreadBadge, { backgroundColor: colors.error }]}>
                                                                <Text style={styles.unreadText}>
                                                                    {item.unread_count > 99 ? '99+' : item.unread_count}
                                                                </Text>
                                                            </View>
                                                        )}
                                                    </View>

                                                    {/* Content */}
                                                    <View style={{ flex: 1 }}>
                                                        <View style={styles.convTopRow}>
                                                            <Text style={[styles.convName, {
                                                                color: colors.text,
                                                                fontFamily: hasUnread ? 'Inter-ExtraBold' : 'Inter-SemiBold',
                                                            }]} numberOfLines={1}>
                                                                {item.user_name}
                                                            </Text>
                                                            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                                                {hasUnread && <View style={[styles.timeDot, { backgroundColor: colors.error }]} />}
                                                                <Text style={[styles.convTime, {
                                                                    color: hasUnread ? colors.error : colors.subtext,
                                                                    fontFamily: hasUnread ? 'Inter-Bold' : 'Inter-Medium',
                                                                }]}>
                                                                    {formatTime(item.last_message_at)}
                                                                </Text>
                                                            </View>
                                                        </View>

                                                        {/* Message preview */}
                                                        <View style={styles.previewRow}>
                                                            {isPhoto && (
                                                                <Ionicons
                                                                    name="image"
                                                                    size={13}
                                                                    color={hasUnread ? colors.text : colors.subtext}
                                                                    style={{ marginRight: 4 }}
                                                                />
                                                            )}
                                                            <Text style={[styles.convPreview, {
                                                                color: hasUnread ? colors.text : colors.subtext,
                                                                fontFamily: hasUnread ? 'Inter-Medium' : 'Inter-Regular',
                                                            }]} numberOfLines={1}>
                                                                {getPreviewText(item.last_message)}
                                                            </Text>
                                                        </View>

                                                        {/* Chips */}
                                                        <View style={styles.chipsRow}>
                                                            <View style={[styles.chip, { backgroundColor: roleColor + '12' }]}>
                                                                <View style={[styles.chipDot, { backgroundColor: roleColor }]} />
                                                                <Text style={[styles.chipText, { color: roleColor, fontFamily: 'Inter-Bold' }]}>
                                                                    {item.user_role.charAt(0).toUpperCase() + item.user_role.slice(1)}
                                                                </Text>
                                                            </View>
                                                            {item.class_group_name && (
                                                                <View style={[styles.chip, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
                                                                    <Ionicons name="school-outline" size={10} color={colors.subtext} style={{ marginRight: 4 }} />
                                                                    <Text style={[styles.chipText, { color: colors.subtext, fontFamily: 'Inter-SemiBold' }]}>
                                                                        {item.class_group_name}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                    </View>

                                                    <Ionicons name="chevron-forward" size={16} color={colors.border} style={{ marginLeft: 4 }} />
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>
                                </View>
                            )}
                        </View>
                    )}
                </ScrollView>
            </Animated.View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
    loadingText: { fontSize: 14 },
    // Header
    header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center' },
    backBtn: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center', marginRight: 16,
        borderWidth: 1,
    },
    headerTextContainer: { flex: 1 },
    title: { fontSize: 24, letterSpacing: -0.5 },
    subtitle: { fontSize: 13, marginTop: 4 },
    countBadge: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginLeft: 10 },
    countText: { fontSize: 15 },
    // Error
    errorBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: 12, borderRadius: 12, borderWidth: 1, marginBottom: 16,
    },
    errorText: { fontSize: 13, flex: 1 },
    // Section
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center' },
    sectionIcon: { width: 34, height: 34, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    sectionHeaderText: { flex: 1, justifyContent: 'center' },
    sectionTitle: { fontSize: 16, marginBottom: 2 },
    sectionSub: { fontSize: 12 },
    sectionCount: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginLeft: 8 },
    sectionCountText: { fontSize: 13 },
    // Teacher Card
    teacherCard: {
        flexDirection: 'row', alignItems: 'center',
        padding: 12, borderRadius: 16, marginBottom: 8, borderWidth: 1,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
    },
    teacherAvWrapper: {
        width: 44, height: 44, marginRight: 12, position: 'relative',
    },
    teacherAv: {
        width: 44, height: 44, borderRadius: 22,
        justifyContent: 'center', alignItems: 'center',
        overflow: 'hidden',
    },
    teacherAvImg: { width: 44, height: 44, borderRadius: 22 },
    teacherAvText: { fontSize: 15 },
    teacherOnline: {
        position: 'absolute', bottom: 0, right: 0,
        width: 13, height: 13, borderRadius: 6.5, borderWidth: 2.5,
    },
    teacherName: { fontSize: 15 },
    teacherDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
    teacherRole: { fontSize: 11 },
    chatBtn: {
        width: 36, height: 36, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2, shadowRadius: 6, elevation: 3,
    },
    // Conversation Card
    convCard: {
        flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04, shadowRadius: 10, elevation: 2,
    },
    avWrapper: { position: 'relative', marginRight: 14 },
    avRing: { width: 54, height: 54, borderRadius: 27, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
    av: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
    avImg: { width: '100%', height: '100%', borderRadius: 23 },
    avText: { fontSize: 16 },
    roleInd: {
        position: 'absolute', bottom: 0, right: 0,
        width: 14, height: 14, borderRadius: 7, borderWidth: 2.5,
    },
    unreadBadge: {
        position: 'absolute', top: -4, right: -4,
        minWidth: 20, height: 20, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4,
    },
    unreadText: { color: '#FFF', fontSize: 10, fontFamily: 'Inter-Bold' },
    convTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 },
    convName: { fontSize: 15, flex: 1, marginRight: 8 },
    timeDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
    convTime: { fontSize: 12 },
    previewRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
    convPreview: { fontSize: 13, lineHeight: 18, flex: 1 },
    chipsRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 },
    chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    chipDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
    chipText: { fontSize: 10, letterSpacing: 0.3, textTransform: 'uppercase' },
    // Empty
    emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingTop: 80 },
    emptyOuter: { width: 130, height: 130, borderRadius: 65, justifyContent: 'center', alignItems: 'center', marginBottom: 8 },
    emptyInner: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center' },
    emptyTitle: { fontSize: 20, marginBottom: 8, marginTop: 8, textAlign: 'center' },
    emptySub: { fontSize: 14, textAlign: 'center', lineHeight: 22 },
});

export default DoubtsScreen;
