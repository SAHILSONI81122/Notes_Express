import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Share, Alert, InteractionManager } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import { getMe, refreshInviteCode } from '../api/api';
import { useTheme } from '../context/ThemeContext';
import Constants from 'expo-constants';

const AddMembersScreen = ({ route, navigation }) => {
    const { role = 'student', initialUser } = route.params || {};
    const [user, setUser] = useState(initialUser || null);
    const [loading, setLoading] = useState(!initialUser);
    const [refreshing, setRefreshing] = useState(false);
    const { isDarkMode, colors } = useTheme();

    const [isTransitionReady, setIsTransitionReady] = useState(false);

    const fetchUser = () => {
        getMe().then(res => {
            setUser(res.data);
            setLoading(false);
        }).catch(err => {
            console.log(err);
            setLoading(false);
        });
    };

    useEffect(() => {
        fetchUser();
        const interactionPromise = InteractionManager.runAfterInteractions(() => {
            setIsTransitionReady(true);
        });
        return () => interactionPromise.cancel();
    }, []);

    const getInviteCode = () => {
        return role === 'teacher' ? user?.batch?.teacher_invite_code : user?.batch?.invite_code;
    };

    const onRefreshCode = async () => {
        try {
            setRefreshing(true);
            await refreshInviteCode(user.batch_id, role);
            fetchUser();
            Alert.alert("Success", "Invite code has been refreshed and is valid for the next 24 hours.");
        } catch (error) {
            Alert.alert("Error", "Could not refresh code.");
        } finally {
            setRefreshing(false);
        }
    };

    const getExpiryText = () => {
        const expiresAt = role === 'teacher' ? user?.batch?.teacher_invite_code_expires_at : user?.batch?.invite_code_expires_at;
        if (!expiresAt) return null;
        const expiry = new Date(expiresAt);
        const now = new Date();
        const diff = expiry - now;
        
        if (diff <= 0) return "Expired";
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        
        if (hours > 0) return `Expires in ${hours}h ${mins}m`;
        return `Expires in ${mins}m`;
    };

    const onShare = async () => {
        try {
            const codeText = getInviteCode();
            if (user && user.batch_id && codeText) {
                const appName = Constants.expoConfig?.name || 'NotesExpress';
                const shareMsg = role === 'teacher'
                    ? `Join our coaching group as a Teacher on ${appName}! Use Invite Code: ${codeText}`
                    : `Join our coaching group on ${appName}! Use Invite Code: ${codeText}`;
                await Share.share({
                    message: shareMsg,
                });
            }
        } catch (error) {
            alert(error.message);
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    if (!user || !user.batch_id) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card }]}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]}>Add Members</Text>
                </View>
                <View style={styles.center}>
                    <Ionicons name="alert-circle-outline" size={64} color={colors.subtext} />
                    <Text style={[styles.emptyText, { color: colors.subtext }]}>You are not part of any group yet.</Text>
                </View>
            </SafeAreaView>
        );
    }

    const currentInviteCode = getInviteCode();

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card }]}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text }]}>
                    {role === 'teacher' ? 'Invite Teacher' : 'Invite Student'}
                </Text>
            </View>

            <View style={styles.content}>
                <View style={[styles.qrCard, { backgroundColor: colors.card }]}>
                    <View style={[styles.qrWrapper, { backgroundColor: '#FFFFFF', borderColor: colors.border }]}>
                        {isTransitionReady ? (
                            <QRCode
                                value={currentInviteCode || ""}
                                size={200}
                                color="#111827"
                                backgroundColor="white"
                            />
                        ) : (
                            <View style={{ width: 200, height: 200, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color={colors.primary} />
                            </View>
                        )}
                    </View>
                    <Text style={[styles.inviteText, { color: colors.subtext }]}>
                        {role === 'teacher' ? 'Teacher Invite Code' : 'Student Invite Code'}
                    </Text>
                    <View style={[styles.codeContainer, { backgroundColor: isDarkMode ? '#312E81' : '#EEF2FF' }]}>
                        <Text style={[styles.codeText, { color: colors.primary }]}>{currentInviteCode}</Text>
                    </View>
                    
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
                        <Ionicons name="time-outline" size={16} color={colors.error} />
                        <Text style={{ marginLeft: 6, color: colors.error, fontWeight: 'bold' }}>
                            {getExpiryText()}
                        </Text>
                    </View>

                    <TouchableOpacity 
                        style={{ marginTop: 20, flexDirection: 'row', alignItems: 'center' }} 
                        onPress={onRefreshCode}
                        disabled={refreshing}
                    >
                        {refreshing ? (
                            <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                            <>
                                <Ionicons name="refresh" size={18} color={colors.primary} />
                                <Text style={{ color: colors.primary, fontWeight: 'bold', marginLeft: 8 }}>Refresh Code</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </View>

                <TouchableOpacity style={[styles.shareButton, { backgroundColor: colors.primary }]} onPress={onShare}>
                    <Ionicons name="share-social" size={24} color="#FFFFFF" />
                    <Text style={styles.shareButtonText}>Share Invite Code</Text>
                </TouchableOpacity>

                <View style={[styles.infoBox, { backgroundColor: colors.card }]}>
                    <Ionicons name="information-circle-outline" size={20} color={colors.subtext} />
                    <Text style={[styles.infoText, { color: colors.subtext }]}>
                        {role === 'teacher' 
                            ? "Teachers can join by scanning this QR or entering the code manually." 
                            : "Students can join by scanning this QR or entering the code manually."}
                    </Text>
                </View>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB', paddingHorizontal: 24 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 30 },
    backButton: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    title: { fontSize: 28, fontWeight: '800', color: '#111827' },
    content: { flex: 1, alignItems: 'center' },
    qrCard: { 
        backgroundColor: '#FFFFFF', padding: 32, borderRadius: 32, alignItems: 'center', width: '100%',
        shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 4,
        marginBottom: 32
    },
    qrWrapper: { padding: 16, backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: '#F3F4F6' },
    inviteText: { fontSize: 16, color: '#6B7280', marginTop: 24, fontWeight: '500' },
    codeContainer: { backgroundColor: '#EEF2FF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 16, marginTop: 8 },
    codeText: { fontSize: 32, fontWeight: '800', color: '#4F46E5', letterSpacing: 2 },
    shareButton: { 
        flexDirection: 'row', backgroundColor: '#4F46E5', borderRadius: 16, height: 60, width: '100%', justifyContent: 'center', alignItems: 'center',
        shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4,
        marginBottom: 24
    },
    shareButtonText: { color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginLeft: 12 },
    infoBox: { flexDirection: 'row', padding: 16, backgroundColor: '#FFFFFF', borderRadius: 16, alignItems: 'center' },
    infoText: { flex: 1, fontSize: 14, color: '#6B7280', marginLeft: 12, lineHeight: 20 },
    emptyText: { fontSize: 18, color: '#6B7280', marginTop: 16, textAlign: 'center' }
});

export default AddMembersScreen;
