import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Image, Switch, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { getMe, updateAvatar, API_URL, clearSession } from '../api/api';
import { useTheme } from '../context/ThemeContext';

const ProfileScreen = ({ navigation }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [showLogoutModal, setShowLogoutModal] = useState(false);
    const { isDarkMode, colors, toggleTheme } = useTheme();

    useEffect(() => {
        getMe().then(res => {
            setUser(res.data);
            setLoading(false);
        }).catch(err => {
            console.log(err);
            setLoading(false);
        });
    }, []);

    const handleLogout = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        
        // Clear all cached items except theme
        await clearSession();

        setShowLogoutModal(false);
        // Reset the entire navigation tree so all screens are destroyed.
        // This prevents stale data (profile, notes, DPPs, doubts, etc.)
        // from leaking into a different account after re-login.
        navigation.dispatch(
            CommonActions.reset({
                index: 0,
                routes: [{ name: 'Login' }],
            })
        );
    };

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
                uploadImage(result.assets[0].uri);
            }
        } catch (error) {
            console.log(error);
        }
    };

    const uploadImage = async (uri) => {
        setIsUpdating(true);
        try {
            const formData = new FormData();
            formData.append('avatar', {
                uri,
                name: 'avatar.jpg',
                type: 'image/jpeg',
            });

            const res = await updateAvatar(formData);
            setUser({ ...user, avatar_url: res.data.avatar_url });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.log(error);
            alert("Failed to upload image");
        } finally {
            setIsUpdating(false);
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

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backButton, { backgroundColor: colors.card }]}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-Bold' }]}>My Profile</Text>
            </View>

            <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
                <View style={styles.avatarContainer}>
                    <TouchableOpacity 
                        style={[styles.avatar, { backgroundColor: colors.primary, overflow: 'hidden' }]}
                        onPress={pickImage}
                    >
                        {user?.avatar_url ? (
                            <Image 
                                source={{ uri: `${user.avatar_url?.startsWith('http') ? user.avatar_url : `\${API_URL}\${user.avatar_url}`}` }} 
                                style={{ width: '100%', height: '100%' }} 
                            />
                        ) : (
                            <Text style={[styles.avatarText, { fontFamily: 'Inter-Bold' }]}>{user?.name?.charAt(0).toUpperCase()}</Text>
                        )}
                        {isUpdating && (
                            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }]}>
                                <ActivityIndicator color="#FFF" />
                            </View>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.editBadge, { backgroundColor: colors.text, borderColor: colors.card }]}
                        onPress={pickImage}
                    >
                        <Ionicons name="camera" size={20} color={colors.background} />
                    </TouchableOpacity>
                </View>

                <Text style={[styles.userName, { color: colors.text, fontFamily: 'Inter-Bold' }]}>{user?.name}</Text>
                <View style={[styles.roleBadge, { backgroundColor: user?.role === 'admin' ? (isDarkMode ? '#312E81' : '#EEF2FF') : user?.role === 'teacher' ? (isDarkMode ? '#064E3B' : '#ECFDF5') : (isDarkMode ? '#374151' : '#F3F4F6') }]}>
                    <Text style={[styles.roleText, { color: user?.role === 'admin' ? '#818CF8' : user?.role === 'teacher' ? '#34D399' : '#9CA3AF', fontFamily: 'Inter-ExtraBold' }]}>
                        {user?.role?.toUpperCase()}
                    </Text>
                </View>
            </View>

            <View style={[styles.infoSection, { backgroundColor: colors.card }]}>
                <View style={styles.infoRow}>
                    <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
                        <Ionicons name="mail-outline" size={22} color={colors.primary} />
                    </View>
                    <View style={styles.infoContent}>
                        <Text style={[styles.infoLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Email Address</Text>
                        <Text style={[styles.infoValue, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>{user?.email}</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.infoRow}>
                    <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
                        <Ionicons name="business-outline" size={22} color={colors.success} />
                    </View>
                    <View style={styles.infoContent}>
                        <Text style={[styles.infoLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Coaching ID</Text>
                        <Text style={[styles.infoValue, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>{user?.batch_id || 'Not Connected'}</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: colors.border }]} />

                <View style={styles.infoRow}>
                    <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
                        <Ionicons name="moon-outline" size={22} color="#F59E0B" />
                    </View>
                    <View style={styles.infoContent}>
                        <Text style={[styles.infoLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Dark Mode</Text>
                        <Text style={[styles.infoValue, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>{isDarkMode ? 'Enabled' : 'Disabled'}</Text>
                    </View>
                    <Switch 
                        value={isDarkMode} 
                        onValueChange={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            toggleTheme();
                        }}
                        trackColor={{ false: "#D1D5DB", true: colors.primary }}
                        thumbColor="#FFFFFF"
                    />
                </View>
            </View>

            <TouchableOpacity 
                style={[styles.logoutButton, { borderColor: isDarkMode ? '#4B5563' : '#FEE2E2' }]} 
                onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    setShowLogoutModal(true);
                }}
            >
                <Ionicons name="log-out-outline" size={22} color={colors.error} />
                <Text style={[styles.logoutText, { color: colors.error, fontFamily: 'Inter-Bold' }]}>Logout from Account</Text>
            </TouchableOpacity>

            {/* Logout Confirmation Modal */}
            <Modal visible={showLogoutModal} transparent animationType="fade">
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowLogoutModal(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={[styles.modalIcon, { backgroundColor: colors.error + '1A' }]}>
                            <Ionicons name="log-out" size={32} color={colors.error} />
                        </View>
                        <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Logout</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                            Are you sure you want to log out? You'll need to sign in again to access your notes.
                        </Text>
                        <View style={styles.modalActions}>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]} 
                                onPress={() => setShowLogoutModal(false)}
                            >
                                <Text style={[styles.modalBtnText, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: colors.error }]} 
                                onPress={handleLogout}
                            >
                                <Text style={[styles.modalBtnText, { color: '#FFFFFF', fontFamily: 'Inter-Bold' }]}>Logout</Text>
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
    header: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 30 },
    backButton: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    title: { fontSize: 28 },
    profileCard: { 
        padding: 32, borderRadius: 32, alignItems: 'center', width: '100%',
        shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 4,
        marginBottom: 32
    },
    avatarContainer: { position: 'relative', marginBottom: 20 },
    avatar: { width: 100, height: 100, borderRadius: 50, justifyContent: 'center', alignItems: 'center' },
    avatarText: { color: '#FFFFFF', fontSize: 40 },
    editBadge: { position: 'absolute', bottom: 0, right: 0, width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', borderWidth: 3 },
    userName: { fontSize: 24, marginBottom: 8 },
    roleBadge: { paddingHorizontal: 16, paddingVertical: 6, borderRadius: 20 },
    roleText: { fontSize: 12, letterSpacing: 1 },
    infoSection: { borderRadius: 24, padding: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    infoRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
    iconBox: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    infoContent: { flex: 1 },
    infoLabel: { fontSize: 13, marginBottom: 2 },
    infoValue: { fontSize: 16 },
    divider: { height: 1, width: '100%' },
    logoutButton: { 
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 'auto', marginBottom: 30,
        padding: 16, borderRadius: 20, borderWidth: 1
    },
    logoutText: { fontSize: 16, marginLeft: 10 },
    // Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { width: '100%', borderRadius: 32, padding: 32, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    modalIcon: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 24, marginBottom: 12 },
    modalSubtitle: { fontSize: 16, textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    modalActions: { flexDirection: 'row', gap: 12, width: '100%' },
    modalBtn: { flex: 1, height: 56, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    modalBtnText: { fontSize: 16 }
});

export default ProfileScreen;
