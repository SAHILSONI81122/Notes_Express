import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useTheme } from '../context/ThemeContext';

const CoachingSelectionScreen = ({ navigation }) => {
    const { isDarkMode, colors } = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
            })
        ]).start();
    }, []);

    const handlePress = (screen) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        navigation.navigate(screen);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <Animated.View style={[styles.header, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>Connect to Group</Text>
                <Text style={[styles.subtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>Choose how you'd like to get started with {Constants.expoConfig?.name || 'NotesExpress'}.</Text>
            </Animated.View>

            <Animated.View style={[styles.optionsContainer, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.primary, borderWidth: 1.5 }]}
                    onPress={() => handlePress('CreateCoaching')}
                >
                    <View style={[styles.iconContainer, { backgroundColor: colors.primary + '1A' }]}>
                        <Ionicons name="business" size={32} color={colors.primary} />
                    </View>
                    <View style={styles.cardContent}>
                        <Text style={[styles.cardTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Create Coaching</Text>
                        <Text style={[styles.cardSubtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>For Admins & Teachers to manage students</Text>
                    </View>
                    <View style={[styles.arrowCircle, { backgroundColor: colors.primary }]}>
                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    activeOpacity={0.8}
                    style={[styles.card, { backgroundColor: colors.card, borderColor: colors.success, borderWidth: 1.5, marginTop: 24 }]}
                    onPress={() => handlePress('JoinCoaching')}
                >
                    <View style={[styles.iconContainer, { backgroundColor: colors.success + '1A' }]}>
                        <Ionicons name="people" size={32} color={colors.success} />
                    </View>
                    <View style={styles.cardContent}>
                        <Text style={[styles.cardTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Join Coaching</Text>
                        <Text style={[styles.cardSubtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>For Students to access class notes & DPPs</Text>
                    </View>
                    <View style={[styles.arrowCircle, { backgroundColor: colors.success }]}>
                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                    </View>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.skipButton}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.navigate('MainApp');
                    }}
                >
                    <Text style={[styles.skipText, { color: colors.subtext, fontFamily: 'Inter-SemiBold' }]}>Skip for now</Text>
                    <Ionicons name="chevron-forward" size={16} color={colors.subtext} />
                </TouchableOpacity>
            </Animated.View>

            <View style={styles.footer}>
                <Text style={[styles.footerText, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                    Powered by <Text style={{ fontFamily: 'Inter-ExtraBold', color: colors.primary }}>{Constants.expoConfig?.name || 'NotesExpress'}</Text>
                </Text>
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 24 },
    header: { marginTop: 40, marginBottom: 20 },
    title: { fontSize: 34 },
    subtitle: { fontSize: 16, marginTop: 10, lineHeight: 24 },
    optionsContainer: { flex: 1, justifyContent: 'center' },
    card: {
        flexDirection: 'row', alignItems: 'center', padding: 24, borderRadius: 28,
        shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5
    },
    iconContainer: { width: 68, height: 68, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 18 },
    cardContent: { flex: 1, marginRight: 8 },
    cardTitle: { fontSize: 19, marginBottom: 6 },
    cardSubtitle: { fontSize: 14, lineHeight: 18 },
    arrowCircle: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
    skipButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 48,
        padding: 12
    },
    skipText: { fontSize: 16, marginRight: 4 },
    footer: { paddingBottom: 24, alignItems: 'center' },
    footerText: { fontSize: 13, opacity: 0.7 }
});

export default CoachingSelectionScreen;
