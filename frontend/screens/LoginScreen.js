import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, Image, ActivityIndicator, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CommonActions } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { login, getMe, setSessionToken, clearSession } from '../api/api';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';

const LoginScreen = ({ navigation }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const { isDarkMode, colors } = useTheme();

    // Prevent Android back button from navigating to stale account screens.
    // After a navigation reset to Login, pressing back should exit the app.
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            BackHandler.exitApp();
            return true;
        });
        return () => backHandler.remove();
    }, []);

    const handleLogin = async () => {
        if (!email.trim() || !password) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Required", "Please enter both email and password.");
            return;
        }
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setIsLoading(true);
        const normalizedEmail = email.trim().toLowerCase();
        try {
            const response = await login(normalizedEmail, password);
            if (!response.data || !response.data.access_token) {
                throw new Error("Invalid response from server");
            }
            const { access_token } = response.data;
            
            // Clear old cache before saving new token
            try {
                await clearSession();
            } catch (cacheErr) {
                console.log("Error clearing session on login:", cacheErr);
            }

            await setSessionToken(access_token);
            
            try {
                const userRes = await getMe();
                if (userRes.data.batch_id) {
                    // Reset the entire navigation tree to ensure no stale
                    // screens from a previous account remain mounted.
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
            let errorMsg = "An unexpected error occurred.";
            
            if (error.response) {
                // Server responded with an error (e.g. 401, 400)
                errorMsg = error.response.data?.detail || "Invalid email or password.";
            } else if (error.request) {
                // Request was made but no response received (e.g. network timeout)
                errorMsg = "Cannot connect to server. Please check your internet and if the server is running.";
            } else {
                errorMsg = error.message;
            }
            
            Alert.alert("Login Failed", errorMsg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.inner}>
                <View style={styles.header}>
                    <View style={[
                        styles.logoContainer, 
                        { 
                            backgroundColor: '#111827',
                            shadowColor: colors.primary
                        }
                    ]}>
                        <Image 
                            source={require('../assets/logo.png')}
                            style={styles.logo}
                            resizeMode="cover"
                        />
                    </View>
                    <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>{Constants.expoConfig?.name || 'Notes Express'}</Text>
                    <Text style={[styles.subtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Continue your learning journey</Text>
                </View>

                <View style={styles.form}>
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
                        style={[styles.loginButton, { backgroundColor: colors.primary, opacity: isLoading ? 0.7 : 1 }]} 
                        onPress={handleLogin}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator color="#FFFFFF" />
                        ) : (
                            <Text style={[styles.loginButtonText, { fontFamily: 'Inter-Bold' }]}>Log In</Text>
                        )}
                    </TouchableOpacity>
                </View>
                
                <TouchableOpacity onPress={() => navigation.navigate('Signup')} style={styles.linkContainer}>
                    <Text style={[styles.linkText, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                        New to {Constants.expoConfig?.name || 'Notes Express'}? <Text style={[styles.linkTextBold, { color: colors.primary, fontFamily: 'Inter-Bold' }]}>Create Account</Text>
                    </Text>
                </TouchableOpacity>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    inner: { flex: 1, justifyContent: 'center', padding: 24 },
    header: { alignItems: 'center', marginBottom: 40 },
    logoContainer: { 
        width: 80, height: 80, borderRadius: 24, 
        justifyContent: 'center', alignItems: 'center',
        shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.15, shadowRadius: 15, elevation: 6,
        overflow: 'hidden'
    },
    logo: { width: '100%', height: '100%' },
    title: { fontSize: 32, letterSpacing: -1.5, marginTop: 16 },
    subtitle: { fontSize: 15, marginTop: 6 },
    form: { width: '100%' },
    inputContainer: { 
        flexDirection: 'row', alignItems: 'center',
        borderWidth: 1, borderRadius: 16, marginBottom: 16, paddingHorizontal: 16, height: 58,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 1
    },
    icon: { marginRight: 12 },
    eyeBtn: { padding: 4 },
    input: { flex: 1, fontSize: 16, height: '100%' },
    loginButton: { 
        borderRadius: 16, height: 58, justifyContent: 'center', alignItems: 'center', marginTop: 8,
        shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10, elevation: 4
    },
    loginButtonText: { color: '#FFFFFF', fontSize: 18 },
    linkContainer: { marginTop: 32, alignItems: 'center' },
    linkText: { fontSize: 14 },
    linkTextBold: { textDecorationLine: 'underline' }
});

export default LoginScreen;
