import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated, Image, Dimensions, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../context/ThemeContext';
import { getMe, initializeAuthToken, clearSession, API_URL } from '../api/api';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SplashScreen = ({ navigation }) => {
    const { isDarkMode, colors } = useTheme();
    
    // Animation Values
    const logoOpacity = useRef(new Animated.Value(0)).current;
    const logoScale = useRef(new Animated.Value(0.5)).current;
    const textOpacity = useRef(new Animated.Value(0)).current;
    const textTranslateY = useRef(new Animated.Value(30)).current;

    // Cached Branding State
    const [cachedInstituteName, setCachedInstituteName] = React.useState(null);
    const [cachedInstituteLogoUrl, setCachedInstituteLogoUrl] = React.useState(null);

    const checkLogin = async () => {
        try {
            const token = await initializeAuthToken();
            if (token) {
                try {
                    const userRes = await getMe();
                    // Cache the successful response for offline use
                    await AsyncStorage.setItem('cached_user_profile', JSON.stringify(userRes.data));
                    
                    if (userRes.data.batch_id) {
                        navigation.replace('MainApp');
                    } else {
                        navigation.replace('CoachingSelectionScreen');
                    }
                } catch (e) {
                    if (e.response && e.response.status === 401) {
                        // Token is truly expired/invalid, do not use cache
                        console.log("Token expired, logging out.");
                        await clearSession();
                        navigation.replace('Login');
                        return;
                    }
                    console.log("SplashScreen network error, trying cache:", e);
                    // Network error! Let's check for a cached profile instead of logging out
                    const cachedProfileStr = await AsyncStorage.getItem('cached_user_profile');
                    if (cachedProfileStr) {
                        const cachedUser = JSON.parse(cachedProfileStr);
                        if (cachedUser.batch_id) {
                            navigation.replace('MainApp');
                        } else {
                            navigation.replace('CoachingSelectionScreen');
                        }
                    } else {
                        // No cache available, must log in again
                        await clearSession();
                        navigation.replace('Login');
                    }
                }
            } else {
                await clearSession();
                navigation.replace('Login');
            }
        } catch (e) {
            console.log("Critical boot error:", e);
            await clearSession();
            navigation.replace('Login');
        }
    };

    useEffect(() => {
        const loadCachedBranding = async () => {
            try {
                const token = await AsyncStorage.getItem('token');
                if (!token) return; // Do not show white-label branding if not logged in

                const savedName = await AsyncStorage.getItem('institute_name');
                const savedLogo = await AsyncStorage.getItem('institute_logo_url');
                if (savedName) setCachedInstituteName(savedName);
                if (savedLogo) setCachedInstituteLogoUrl(savedLogo);
            } catch (e) {
                console.log('Failed to load cached branding', e);
            }
        };
        loadCachedBranding();

        // Start Animation Sequence
        Animated.parallel([
            Animated.timing(logoOpacity, {
                toValue: 1,
                duration: 1000,
                useNativeDriver: true,
            }),
            Animated.spring(logoScale, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.sequence([
                Animated.delay(400),
                Animated.parallel([
                    Animated.timing(textOpacity, {
                        toValue: 1,
                        duration: 800,
                        useNativeDriver: true,
                    }),
                    Animated.timing(textTranslateY, {
                        toValue: 0,
                        duration: 800,
                        useNativeDriver: true,
                    })
                ])
            ])
        ]).start();

        // Navigate after animation finishes
        const timer = setTimeout(() => {
            checkLogin();
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <StatusBar barStyle={isDarkMode ? "light-content" : "dark-content"} />
            <View style={styles.content}>
                <Animated.View style={[
                    styles.logoContainer,
                    { 
                        opacity: logoOpacity,
                        transform: [{ scale: logoScale }],
                        // We use a fixed dark background for the logo container because the 
                        // logo image itself has a dark background. This ensures a seamless look.
                        backgroundColor: '#111827', 
                        shadowColor: colors.primary,
                    }
                ]}>
                    {cachedInstituteLogoUrl ? (
                        <Image 
                            source={{ uri: `${API_URL}${cachedInstituteLogoUrl}` }}
                            style={styles.logo}
                            resizeMode="cover"
                        />
                    ) : (
                        <Image 
                            source={require('../assets/logo.png')}
                            style={styles.logo}
                            resizeMode="cover"
                        />
                    )}
                </Animated.View>
                
                <Animated.View style={[styles.textContainer, {
                    opacity: textOpacity,
                    transform: [{ translateY: textTranslateY }]
                }]}>
                    <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold', textAlign: 'center', paddingHorizontal: 20 }]}>
                        {cachedInstituteName || Constants.expoConfig?.name || 'NotesExpress'}
                    </Text>
                    <View style={[styles.bar, { backgroundColor: colors.primary }]} />
                    <Text style={[styles.subtitle, { color: colors.subtext, fontFamily: 'Inter-Bold' }]}>
                        SPEED • SIMPLICITY • SUCCESS
                    </Text>
                </Animated.View>
            </View>
            
            <Animated.View style={[styles.footer, { opacity: textOpacity, flexDirection: 'row', alignItems: 'center' }]}>
                <Text style={[styles.version, { color: colors.subtext, fontFamily: 'Inter-Medium', marginRight: 6 }]}>Powered by</Text>
                <View style={{ width: 16, height: 16, borderRadius: 4, overflow: 'hidden', marginRight: 4, backgroundColor: '#111827' }}>
                    <Image source={require('../assets/notes_express_logo.png')} style={{ width: '100%', height: '100%' }} />
                </View>
                <Text style={[styles.version, { color: colors.text, fontFamily: 'Inter-Bold' }]}>NotesExpress</Text>
            </Animated.View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { alignItems: 'center', flex: 1, justifyContent: 'center' },
    logoContainer: {
        width: 140,
        height: 140,
        marginBottom: 40,
        borderRadius: 38,
        justifyContent: 'center',
        alignItems: 'center',
        shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 12,
        overflow: 'hidden' // Ensures the image follows the border radius
    },
    logo: { width: '100%', height: '100%' },
    textContainer: { alignItems: 'center' },
    title: { fontSize: 36, letterSpacing: -1.5 },
    bar: { width: 40, height: 4, borderRadius: 2, marginVertical: 16 },
    subtitle: { fontSize: 12, letterSpacing: 2.5, opacity: 0.8 },
    footer: { position: 'absolute', bottom: 40 },
    version: { fontSize: 12, opacity: 0.5 }
});

export default SplashScreen;
