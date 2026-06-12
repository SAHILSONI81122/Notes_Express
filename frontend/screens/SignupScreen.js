import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import { signup, login, getMe, setSessionToken, clearSession } from '../api/api';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';

const SignupScreen = ({ navigation }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { isDarkMode, colors } = useTheme();

    const handleSignup = async () => {
        const normalizedEmail = email.trim().toLowerCase();
        const normalizedName = name.trim();

        if (!normalizedName || !normalizedEmail || !password) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Please fill all fields");
            return;
        }

        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsLoading(true);
        try {
            await signup({ name: normalizedName, email: normalizedEmail, password, role: 'student' });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Clear old cache before logging in
            await clearSession();

            // Automatically login
            const loginRes = await login(normalizedEmail, password);
            if (!loginRes.data || !loginRes.data.access_token) {
                throw new Error("Could not log in automatically");
            }
            await setSessionToken(loginRes.data.access_token);
            
            try {
                const userRes = await getMe();
                if (userRes.data.batch_id) {
                    navigation.dispatch(
                        CommonActions.reset({
                            index: 0,
                            routes: [{ name: 'MainApp' }],
                        })
                    );
                } else {
                    navigation.dispatch(
                        CommonActions.reset({
                            index: 0,
                            routes: [{ name: 'CoachingSelectionScreen' }],
                        })
                    );
                }
            } catch (e) {
                navigation.dispatch(
                    CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'CoachingSelectionScreen' }],
                    })
                );
            }
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const errorMsg = error.response?.data?.detail || error.message || "Could not create account";
            Alert.alert("Signup Failed", errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()} 
                    style={[styles.backButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                >
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.header}>
                    <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>Create Account</Text>
                    <Text style={[styles.subtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Join {Constants.expoConfig?.name || 'Notes Express'} today</Text>
                </View>

                <View style={styles.form}>
                    <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="person-outline" size={20} color={colors.subtext} style={styles.icon} />
                        <TextInput 
                            style={[styles.input, { color: colors.text, fontFamily: 'Inter-Medium' }]}
                            placeholder="Full Name" 
                            placeholderTextColor={colors.subtext}
                            value={name}
                            onChangeText={setName}
                        />
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="mail-outline" size={20} color={colors.subtext} style={styles.icon} />
                        <TextInput 
                            style={[styles.input, { color: colors.text, fontFamily: 'Inter-Medium' }]}
                            placeholder="Email address" 
                            placeholderTextColor={colors.subtext}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />
                    </View>

                    <View style={[styles.inputContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="lock-closed-outline" size={20} color={colors.subtext} style={styles.icon} />
                        <TextInput 
                            style={[styles.input, { color: colors.text, fontFamily: 'Inter-Medium' }]}
                            placeholder="Password" 
                            placeholderTextColor={colors.subtext}
                            secureTextEntry={!showPassword}
                            value={password}
                            onChangeText={setPassword}
                        />
                        <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeBtn}>
                            <Ionicons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={colors.subtext} />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity 
                        activeOpacity={0.8}
                        style={[styles.signupButton, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]} 
                        onPress={handleSignup}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={[styles.signupButtonText, { fontFamily: 'Inter-Bold' }]}>Sign Up</Text>
                        )}
                    </TouchableOpacity>
                </View>
                
                <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkContainer}>
                    <Text style={[styles.linkText, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                        Already have an account? <Text style={[styles.linkTextBold, { color: colors.primary, fontFamily: 'Inter-Bold' }]}>Log in</Text>
                    </Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, padding: 24, paddingTop: 10 },
    backButton: { 
        width: 44, height: 44, borderRadius: 22, 
        justifyContent: 'center', alignItems: 'center', 
        marginBottom: 24, borderWidth: 1,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 
    },
    header: { marginBottom: 36 },
    title: { fontSize: 32, letterSpacing: -1 },
    subtitle: { fontSize: 16, marginTop: 8 },
    form: { width: '100%' },
    inputContainer: { 
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderRadius: 16, marginBottom: 16, paddingHorizontal: 16, height: 60,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 2
    },
    icon: { marginRight: 12 },
    eyeBtn: { padding: 4 },
    input: { flex: 1, fontSize: 16, height: '100%' },
    signupButton: { 
        borderRadius: 16, height: 60, justifyContent: 'center', alignItems: 'center', marginTop: 8,
        shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5
    },
    signupButtonText: { color: '#FFFFFF', fontSize: 18 },
    linkContainer: { marginTop: 32, alignItems: 'center' },
    linkText: { fontSize: 15 },
    linkTextBold: { }
});

export default SignupScreen;
