import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Alert, KeyboardAvoidingView, Platform, Modal, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { joinBatch, getInviteInfo } from '../api/api';
import { useTheme } from '../context/ThemeContext';

const JoinCoachingScreen = ({ navigation }) => {
    const [showInput, setShowInput] = useState(false);
    const [code, setCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const { isDarkMode, colors } = useTheme();
    
    // Class Group Selection States
    const [showClassModal, setShowClassModal] = useState(false);
    const [batchInfo, setBatchInfo] = useState(null);

    const handleVerifyCode = async () => {
        if (!code.trim()) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Code Required", "Please enter the invite code provided by your teacher.");
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsLoading(true);
        try {
            const res = await getInviteInfo(code);
            const info = res.data;
            if (info.role !== 'teacher' && info.class_groups && info.class_groups.length > 0) {
                setBatchInfo(info);
                setShowClassModal(true);
            } else {
                await processJoin(null);
            }
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Invalid Code", "We couldn't find any group with that code. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    const processJoin = async (classGroupId) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsLoading(true);
        try {
            await joinBatch(code, classGroupId);
            await AsyncStorage.removeItem('selectedClassGroupId');
            await AsyncStorage.removeItem('selectedClassName');
            await AsyncStorage.removeItem('cached_user_profile');
            await AsyncStorage.removeItem('cached_user_batch_id');
            await AsyncStorage.removeItem('cached_user_role');
            await AsyncStorage.removeItem('recent_notes_v1');
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setShowClassModal(false);
            Alert.alert("Joined!", "Welcome to the group. You can now access all class notes.");
            navigation.dispatch(
                CommonActions.reset({
                    index: 0,
                    routes: [{ name: 'MainApp' }],
                })
            );
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Join Failed", "Something went wrong while joining. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
                <View style={styles.header}>
                    <TouchableOpacity 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.goBack();
                        }} 
                        style={[styles.backButton, { backgroundColor: colors.card }]}
                    >
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>Join Group</Text>
                </View>

                <View style={styles.content}>
                    <Text style={[styles.subtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                        Connect with your institute to access study materials and practice problems.
                    </Text>

                    <TouchableOpacity 
                        activeOpacity={0.8}
                        style={[styles.optionCard, { backgroundColor: colors.card }]} 
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('QRScanner');
                        }}
                    >
                        <View style={[styles.iconBox, { backgroundColor: colors.primary + '1A' }]}>
                            <Ionicons name="qr-code" size={32} color={colors.primary} />
                        </View>
                        <View style={styles.cardText}>
                            <Text style={[styles.cardTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Scan QR Code</Text>
                            <Text style={[styles.cardSubtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Use your camera to join instantly</Text>
                        </View>
                        <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
                    </TouchableOpacity>

                    <View style={styles.dividerBox}>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                        <Text style={[styles.dividerLabel, { color: colors.subtext, fontFamily: 'Inter-Bold' }]}>OR</Text>
                        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
                    </View>

                    {!showInput ? (
                        <TouchableOpacity 
                            activeOpacity={0.8}
                            style={[styles.optionCard, { backgroundColor: colors.card }]} 
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                setShowInput(true);
                            }}
                        >
                            <View style={[styles.iconBox, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
                                <Ionicons name="keypad" size={32} color={colors.text} />
                            </View>
                            <View style={styles.cardText}>
                                <Text style={[styles.cardTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Invite Code</Text>
                                <Text style={[styles.cardSubtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Enter a 6-digit alphanumeric code</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color={colors.subtext} />
                        </TouchableOpacity>
                    ) : (
                        <View style={styles.inputSection}>
                            <TextInput 
                                style={[styles.codeInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.primary, fontFamily: 'Inter-Bold' }]}
                                placeholder="CODE"
                                placeholderTextColor={colors.subtext}
                                value={code}
                                onChangeText={(val) => setCode(val.toUpperCase())}
                                autoCapitalize="characters"
                                maxLength={10}
                                autoFocus
                            />
                            <TouchableOpacity 
                                disabled={isLoading}
                                style={[styles.submitBtn, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]} 
                                onPress={handleVerifyCode}
                            >
                                {isLoading ? (
                                    <ActivityIndicator color="#FFFFFF" />
                                ) : (
                                    <Text style={[styles.submitBtnText, { fontFamily: 'Inter-Bold' }]}>Validate Code</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </KeyboardAvoidingView>

            {/* Class Group Selection Modal */}
            <Modal visible={showClassModal} transparent animationType="slide">
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setShowClassModal(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHandle} />
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Pick Your Class</Text>
                                <Text style={[styles.modalSubtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                                    {batchInfo?.name}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowClassModal(false)} style={[styles.closeBtn, { backgroundColor: isDarkMode ? '#374151' : '#F3F4F6' }]}>
                                <Ionicons name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        
                        <FlatList
                            data={batchInfo?.class_groups || []}
                            keyExtractor={item => item.id.toString()}
                            contentContainerStyle={{ paddingBottom: 40 }}
                            renderItem={({ item }) => (
                                <TouchableOpacity 
                                    activeOpacity={0.7}
                                    style={[styles.classItem, { backgroundColor: isDarkMode ? '#374151' : '#F9FAFB' }]}
                                    onPress={() => processJoin(item.id)}
                                >
                                    <View style={[styles.classIcon, { backgroundColor: colors.primary + '1A' }]}>
                                        <Ionicons name="school-outline" size={22} color={colors.primary} />
                                    </View>
                                    <Text style={[styles.classText, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>{item.name}</Text>
                                    <Ionicons name="chevron-forward" size={18} color={colors.primary} />
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </TouchableOpacity>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', marginTop: 15, marginBottom: 32, paddingHorizontal: 24 },
    backButton: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    title: { fontSize: 28 },
    content: { flex: 1, paddingHorizontal: 24 },
    subtitle: { fontSize: 16, marginBottom: 40, lineHeight: 24 },
    optionCard: { 
        flexDirection: 'row', alignItems: 'center', padding: 22, borderRadius: 28, 
        shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 3
    },
    iconBox: { width: 64, height: 64, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 18 },
    cardText: { flex: 1 },
    cardTitle: { fontSize: 19, marginBottom: 4 },
    cardSubtitle: { fontSize: 13 },
    dividerBox: { flexDirection: 'row', alignItems: 'center', marginVertical: 32 },
    dividerLine: { flex: 1, height: 1 },
    dividerLabel: { marginHorizontal: 20, fontSize: 13, letterSpacing: 1 },
    inputSection: { marginTop: 10 },
    codeInput: { 
        borderWidth: 2, borderRadius: 24, 
        height: 72, fontSize: 24, marginBottom: 20,
        textAlign: 'center', letterSpacing: 8,
        shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 2
    },
    submitBtn: { 
        borderRadius: 20, height: 60, justifyContent: 'center', alignItems: 'center',
        shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 5
    },
    submitBtnText: { color: '#FFFFFF', fontSize: 18 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, maxHeight: '80%' },
    modalHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#D1D5DB', alignSelf: 'center', marginBottom: 20 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 22 },
    modalSubtitle: { fontSize: 15, marginTop: 4 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
    classItem: { flexDirection: 'row', alignItems: 'center', padding: 20, borderRadius: 20, marginBottom: 12 },
    classIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginRight: 16 },
    classText: { flex: 1, fontSize: 17 }
});

export default JoinCoachingScreen;
