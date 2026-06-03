import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Modal, Animated, Easing } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, Path, Rect, G, Ellipse } from 'react-native-svg';
import { getChestsStatus, claimChest, getMe } from '../api/api';
import { useTheme } from '../context/ThemeContext';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);

// --- Consistent Gamified Chest SVG ---
const chestThemes = {
    normal: {
        body: '#8B4513', bodyStroke: '#5C2E0B',
        band: '#9CA3AF', bandStroke: '#4B5563',
        lock: '#D1D5DB', lockStroke: '#374151',
        glow: '#FBBF24'
    },
    rare: {
        body: '#06B6D4', bodyStroke: '#0891B2',
        band: '#E2E8F0', bandStroke: '#94A3B8',
        lock: '#FFFFFF', lockStroke: '#64748B',
        glow: '#A5F3FC'
    },
    epic: {
        body: '#5B21B6', bodyStroke: '#4C1D95',
        band: '#FBBF24', bandStroke: '#D97706',
        lock: '#FCD34D', lockStroke: '#B45309',
        glow: '#E879F9'
    },
    legendary: {
        body: '#F59E0B', bodyStroke: '#B45309',
        band: '#FEF08A', bandStroke: '#D97706',
        lock: '#FFFFFF', lockStroke: '#FBBF24',
        glow: '#FEF08A'
    }
};

const ConsistentChestSvg = ({ type, isOpened, size = 120 }) => {
    const t = chestThemes[type] || chestThemes.normal;
    const openProgress = useRef(new Animated.Value(isOpened ? 1 : 0)).current;

    useEffect(() => {
        Animated.spring(openProgress, {
            toValue: isOpened ? 1 : 0,
            friction: 6,
            tension: 40,
            useNativeDriver: true
        }).start();
    }, [isOpened]);

    const lidTranslateX = openProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 4] // Keep centered: 50 * (1 - 0.92) = 4
    });

    const lidTranslateY = openProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 7.5] // Hinge at back: 45 * (1 - 0.5) - 15 = 7.5
    });

    const lidScaleY = openProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.5]
    });

    const lidScaleX = openProgress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 0.92]
    });

    const glowOpacity = openProgress.interpolate({
        inputRange: [0, 0.5, 1],
        outputRange: [0, 0, 1]
    });

    return (
        <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
            {/* Background Shadow */}
            <Ellipse cx="50" cy="90" rx="40" ry="8" fill="rgba(0,0,0,0.2)" />

            {/* Inside back wall (visible when opened) */}
            <Rect x="15" y="30" width="70" height="20" fill="#1A1A1A" />
            
            {/* Glowing Treasure inside */}
            <AnimatedEllipse cx="50" cy="45" rx="25" ry="12" fill={t.glow} opacity={glowOpacity} />

            {/* Side Handles (Behind body) */}
            <Path d="M15 55 H6 V70 H15" fill="none" stroke={t.bandStroke} strokeWidth="4" />
            <Path d="M15 55 H6 V70 H15" fill="none" stroke={t.band} strokeWidth="2.5" />
            
            <Path d="M85 55 H94 V70 H85" fill="none" stroke={t.bandStroke} strokeWidth="4" />
            <Path d="M85 55 H94 V70 H85" fill="none" stroke={t.band} strokeWidth="2.5" />

            {/* --- Front Body --- */}
            <Rect x="15" y="45" width="70" height="42" rx="6" fill={t.body} stroke={t.bodyStroke} strokeWidth="3" />
            
            {/* Vertical Band on Body */}
            <Rect x="40" y="45" width="20" height="42" fill={t.band} stroke={t.bandStroke} strokeWidth="3" />
            
            {/* Horizontal Band on Body */}
            <Rect x="12" y="42" width="76" height="12" rx="3" fill={t.band} stroke={t.bandStroke} strokeWidth="3" />
            
            {/* Corner Brackets */}
            <Path d="M15 67 V81 C15 84.3 17.7 87 21 87 H32 V73 H25 V67 Z" fill={t.band} stroke={t.bandStroke} strokeWidth="3" />
            <Path d="M85 67 V81 C85 84.3 82.3 87 79 87 H68 V73 H75 V67 Z" fill={t.band} stroke={t.bandStroke} strokeWidth="3" />

            {/* --- Animated Lid --- */}
            <AnimatedG style={{
                transform: [
                    { translateX: lidTranslateX },
                    { translateY: lidTranslateY },
                    { scaleY: lidScaleY },
                    { scaleX: lidScaleX }
                ]
            }}>
                {/* Lid Arch */}
                <Path d="M15 45 V35 C15 10, 85 10, 85 35 V45 Z" fill={t.body} stroke={t.bodyStroke} strokeWidth="3" />
                
                {/* Lid Vertical Band */}
                <Path d="M40 45 V35 C40 18, 60 18, 60 35 V45 Z" fill={t.band} stroke={t.bandStroke} strokeWidth="3" />
                
                {/* Lid Horizontal Band */}
                <Rect x="12" y="38" width="76" height="10" rx="3" fill={t.band} stroke={t.bandStroke} strokeWidth="3" />
                
                {/* Lock */}
                <Rect x="36" y="30" width="28" height="34" rx="10" fill={t.lock} stroke={t.lockStroke} strokeWidth="3" />
                <Circle cx="50" cy="42" r="3.5" fill={t.lockStroke} />
                <Path d="M48.5 42 L47 52 H53 L51.5 42 Z" fill={t.lockStroke} />
            </AnimatedG>
        </Svg>
    );
};

// --- Icons ---
const CoinIcon = ({ size = 24 }) => (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Defs>
            <SvgGradient id="goldOuter" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFE082" />
                <Stop offset="50%" stopColor="#FFA000" />
                <Stop offset="100%" stopColor="#FF6F00" />
            </SvgGradient>
            <SvgGradient id="goldInner" x1="0%" y1="0%" x2="100%" y2="100%">
                <Stop offset="0%" stopColor="#FFF8E1" />
                <Stop offset="40%" stopColor="#FFD54F" />
                <Stop offset="80%" stopColor="#FFB300" />
                <Stop offset="100%" stopColor="#FF8F00" />
            </SvgGradient>
            <SvgGradient id="goldRim" x1="0%" y1="100%" x2="100%" y2="0%">
                <Stop offset="0%" stopColor="#FF8F00" />
                <Stop offset="50%" stopColor="#FFD54F" />
                <Stop offset="100%" stopColor="#FFF8E1" />
            </SvgGradient>
        </Defs>
        <Circle cx="12" cy="12" r="11" fill="url(#goldOuter)" stroke="url(#goldRim)" strokeWidth="1" />
        <Circle cx="12" cy="12" r="7.5" fill="url(#goldInner)" stroke="#FF8F00" strokeWidth="0.5" />
        <Circle cx="12" cy="12" r="4.5" stroke="#FFE082" strokeWidth="1" strokeDasharray="3 2" opacity={0.8} />
        <Circle cx="12" cy="12" r="2.5" fill="#FFC107" />
    </Svg>
);

const BoosterIcon = ({ type, size = 48 }) => {
    if (type === '10m') {
        return (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Defs>
                    <SvgGradient id="grad10m" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#22D3EE" />
                        <Stop offset="100%" stopColor="#0EA5E9" />
                    </SvgGradient>
                    <SvgGradient id="border10m" x1="0%" y1="100%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#0891B2" />
                        <Stop offset="100%" stopColor="#67E8F9" />
                    </SvgGradient>
                </Defs>
                <Path d="M12 2L21 12L12 22L3 12Z" fill="url(#grad10m)" fillOpacity={0.15} stroke="url(#border10m)" strokeWidth={1.5} strokeLinejoin="round" />
                <Path d="M11.5 5L6.5 13h5v6l5-8.5h-5z" fill="url(#grad10m)" stroke="#0284C7" strokeWidth="0.5" />
            </Svg>
        );
    }
    if (type === '30m') {
        return (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Defs>
                    <SvgGradient id="grad30m" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#34D399" />
                        <Stop offset="100%" stopColor="#059669" />
                    </SvgGradient>
                    <SvgGradient id="border30m" x1="0%" y1="100%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#047857" />
                        <Stop offset="100%" stopColor="#6EE7B7" />
                    </SvgGradient>
                </Defs>
                <Path d="M12 2C7 2 7 8 7 14C7 20 12 22 12 22C12 22 17 20 17 14C17 8 17 2 12 2Z" fill="url(#grad30m)" fillOpacity={0.15} stroke="url(#border30m)" strokeWidth={1.5} strokeLinejoin="round" />
                <Path d="M12 5c-1.5 2-2 4-2 7h4c0-3-.5-5-2-7z" fill="url(#grad30m)" stroke="#047857" strokeWidth="0.5" />
                <Path d="M10 12v3l-1.5 1.5v1h7v-1L14 15v-3H10z" fill="url(#grad30m)" stroke="#047857" strokeWidth="0.5" />
                <Path d="M11 18.5l1 2 1-2z" fill="#EF4444" />
            </Svg>
        );
    }
    if (type === '1h') {
        return (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Defs>
                    <SvgGradient id="grad1h" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#A78BFA" />
                        <Stop offset="100%" stopColor="#7C3AED" />
                    </SvgGradient>
                    <SvgGradient id="border1h" x1="0%" y1="100%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#6D28D9" />
                        <Stop offset="100%" stopColor="#C4B5FD" />
                    </SvgGradient>
                </Defs>
                <Path d="M12 2L21 7V17L12 22L3 17V7Z" fill="url(#grad1h)" fillOpacity={0.15} stroke="url(#border1h)" strokeWidth={1.5} strokeLinejoin="round" />
                <Path d="M7.5 6h9v2L13 11.5l3.5 3.5v2h-9v-2l3.5-3.5L7.5 8V6z" fill="url(#grad1h)" stroke="#6D28D9" strokeWidth="0.5" />
                <Circle cx="12" cy="11" r="0.8" fill="#FFF" />
                <Circle cx="12" cy="13" r="0.8" fill="#FFF" />
                <Path d="M9.5 15h5l-2.5-2.5z" fill="#FFF" opacity={0.6} />
            </Svg>
        );
    }
    // 3h
    return (
        <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
            <Defs>
                <SvgGradient id="grad3h" x1="0%" y1="0%" x2="100%" y2="100%">
                    <Stop offset="0%" stopColor="#FBBF24" />
                    <Stop offset="100%" stopColor="#EA580C" />
                </SvgGradient>
                <SvgGradient id="border3h" x1="0%" y1="100%" x2="100%" y2="0%">
                    <Stop offset="0%" stopColor="#C2410C" />
                    <Stop offset="100%" stopColor="#FDE68A" />
                </SvgGradient>
            </Defs>
            <Path d="M12 2L20 5V12C20 17.5 16.5 21 12 22C7.5 21 4 17.5 4 12V5L12 2Z" fill="url(#grad3h)" fillOpacity={0.15} stroke="url(#border3h)" strokeWidth={1.5} strokeLinejoin="round" />
            <Path d="M6 13h12v2H6v-2zm0-5l3 2.5 3-4.5 3 4.5 3-2.5v4H6V8z" fill="url(#grad3h)" stroke="#C2410C" strokeWidth="0.5" />
            <Circle cx="6" cy="7.5" r="0.8" fill="#FFF" />
            <Circle cx="12" cy="5.5" r="1" fill="#FFF" />
            <Circle cx="18" cy="7.5" r="0.8" fill="#FFF" />
        </Svg>
    );
};

// --- Sunburst Glow Background ---
const Sunburst = ({ size = 300, color = 'rgba(251, 191, 36, 0.15)' }) => {
    const rays = 16;
    const angleStep = 360 / rays;
    const paths = [];
    for (let i = 0; i < rays; i++) {
        if (i % 2 === 0) {
            const radStart = (i * angleStep * Math.PI) / 180;
            const radEnd = ((i + 1) * angleStep * Math.PI) / 180;
            const x1 = 150 + 180 * Math.cos(radStart);
            const y1 = 150 + 180 * Math.sin(radStart);
            const x2 = 150 + 180 * Math.cos(radEnd);
            const y2 = 150 + 180 * Math.sin(radEnd);
            paths.push(
                <Path key={i} d={`M150 150 L${x1} ${y1} L${x2} ${y2} Z`} fill={color} />
            );
        }
    }
    return (
        <Svg width={size} height={size} viewBox="0 0 300 300">
            {paths}
        </Svg>
    );
};

const ChestScreen = ({ navigation }) => {
    const { isDarkMode, colors } = useTheme();
    const [user, setUser] = useState(null);
    const [chests, setChests] = useState([]);
    const [weeklyActivityCount, setWeeklyActivityCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const [claimingType, setClaimingType] = useState(null);
    const claimingRef = useRef(false);

    // Opening popup modal details
    const [rewardModalVisible, setRewardModalVisible] = useState(false);
    const [claimedCoins, setClaimedCoins] = useState(0);
    const [claimedBooster, setClaimedBooster] = useState(null);
    const [claimedChestType, setClaimedChestType] = useState('normal');
    
    // Interactive Animation States
    const [isOpened, setIsOpened] = useState(false);
    const [isShaking, setIsShaking] = useState(false);

    // Animation Drivers
    const floatAnim = useRef(new Animated.Value(0)).current;
    const shakeAnim = useRef(new Animated.Value(0)).current;
    const rewardPopY = useRef(new Animated.Value(0)).current;
    const rewardPopScale = useRef(new Animated.Value(0)).current;
    const sunburstRotate = useRef(new Animated.Value(0)).current;
    const awesomeOpacity = useRef(new Animated.Value(0)).current;
    const textPulse = useRef(new Animated.Value(1)).current;

    const fetchChestData = async () => {
        try {
            const statusRes = await getChestsStatus();
            setChests(statusRes.data.chests);
            setWeeklyActivityCount(statusRes.data.weekly_activity_count);

            const userRes = await getMe();
            setUser(userRes.data);
        } catch (e) {
            console.log("Failed fetching chest stats", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchChestData();
    }, []);

    // Setup presentation animations when modal opens
    useEffect(() => {
        if (rewardModalVisible) {
            setIsOpened(false);
            setIsShaking(false);
            shakeAnim.setValue(0);
            rewardPopY.setValue(0);
            rewardPopScale.setValue(0);
            awesomeOpacity.setValue(0);
            sunburstRotate.setValue(0);
            floatAnim.setValue(0);

            Animated.loop(
                Animated.timing(sunburstRotate, {
                    toValue: 1,
                    duration: 20000,
                    easing: Easing.linear,
                    useNativeDriver: true
                })
            ).start();

            Animated.loop(
                Animated.sequence([
                    Animated.timing(floatAnim, { toValue: -12, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(floatAnim, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
                ])
            ).start();

            textPulse.setValue(0.4);
            Animated.loop(
                Animated.sequence([
                    Animated.timing(textPulse, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
                    Animated.timing(textPulse, { toValue: 0.4, duration: 800, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
                ])
            ).start();
        }
    }, [rewardModalVisible]);

    const handleClaimChestInit = async (chestType) => {
        if (claimingRef.current) return;
        claimingRef.current = true;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setClaimingType(chestType);

        try {
            const res = await claimChest(chestType);
            const { coins_rewarded, booster_rewarded_type } = res.data;

            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Open interactive rewards popup (chest is closed initially)
            setClaimedChestType(chestType);
            setClaimedCoins(coins_rewarded);
            setClaimedBooster(booster_rewarded_type);
            setRewardModalVisible(true);
        } catch (err) {
            const msg = err.response?.data?.detail || "Could not claim chest right now.";
            Alert.alert("Claim Failed", msg);
        } finally {
            setClaimingType(null);
            claimingRef.current = false;
            fetchChestData();
        }
    };

    const handleTapToOpen = () => {
        if (isOpened || isShaking) return;
        setIsShaking(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

        // Shake Sequence
        Animated.sequence([
            Animated.timing(shakeAnim, { toValue: -15, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 15, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -5, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 5, duration: 50, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
        ]).start(() => {
            setIsShaking(false);
            setIsOpened(true); // Triggers internal SVG lid spring animation
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            // Pop out rewards and accelerate sunburst
            Animated.parallel([
                Animated.timing(rewardPopY, { toValue: -95, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
                Animated.timing(rewardPopScale, { toValue: 1, duration: 600, easing: Easing.out(Easing.back(1.5)), useNativeDriver: true }),
                Animated.loop(
                    Animated.timing(sunburstRotate, { toValue: 1, duration: 3500, easing: Easing.linear, useNativeDriver: true })
                ),
                Animated.timing(awesomeOpacity, { toValue: 1, duration: 400, easing: Easing.inOut(Easing.ease), useNativeDriver: true })
            ]).start();
        });
    };

    const getChestSubLabel = (chest) => {
        if (chest.chest_type === 'normal') return "Claimable every 24 hours";
        if (chest.chest_type === 'rare') return "Requires 2 completed weekly activities";
        if (chest.chest_type === 'epic') return "Requires 5 activities + booster chances";
        return "Requires 10 activities + massive booster chance";
    };

    const getChestBgGradient = (type) => {
        if (type === 'normal') return isDarkMode ? ['#2D1F10', '#1C120A'] : ['#FFFBEB', '#FDF2F2'];
        if (type === 'rare') return isDarkMode ? ['#111E2E', '#0A111A'] : ['#F0F9FF', '#EFF6FF'];
        if (type === 'epic') return isDarkMode ? ['#25153C', '#130A21'] : ['#FAF5FF', '#F3E8FF'];
        return isDarkMode ? ['#352008', '#1F1003'] : ['#FFFDF5', '#FFFBEB'];
    };

    const getChestBorderColor = (type, isUnlocked) => {
        if (!isUnlocked) return colors.border;
        if (type === 'normal') return '#A16207';
        if (type === 'rare') return '#3B82F6';
        if (type === 'epic') return '#8B5CF6';
        return '#F59E0B';
    };

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

    const sunburstSpin = sunburstRotate.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg']
    });

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.goBack();
                    }}
                    style={[styles.backBtn, { backgroundColor: colors.card }]}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>Treasure Chests</Text>
                
                <View style={[styles.coinDisplay, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFBEB', borderColor: isDarkMode ? '#334155' : '#FDE68A' }]}>
                    <CoinIcon size={18} />
                    <Text style={[styles.coinText, { color: isDarkMode ? '#FBBF24' : '#D97706', fontFamily: 'Inter-Bold' }]}>
                        {user?.coins || 0}
                    </Text>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Stats Panel */}
                <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Ionicons name="calendar-outline" size={24} color={colors.primary} />
                    <View style={styles.statsMeta}>
                        <Text style={[styles.statsTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Weekly Completions</Text>
                        <Text style={[styles.statsDesc, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                            You have completed {weeklyActivityCount} activities (notes + DPPs) this week!
                        </Text>
                    </View>
                </View>

                {/* Chests list */}
                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>Available Chests</Text>

                <View style={styles.chestList}>
                    {chests.map((chest) => {
                        const isClaimed = chest.status === 'claimed';
                        const isReady = chest.status === 'ready_to_claim';
                        const isLocked = chest.status === 'locked';
                        const isPurchasing = claimingType === chest.chest_type;

                        const progressPercent = chest.target > 0 ? (chest.progress / chest.target) * 100 : 100;

                        return (
                            <View
                                key={chest.chest_type}
                                style={[
                                    styles.chestCard,
                                    {
                                        backgroundColor: getChestBgGradient(chest.chest_type)[0],
                                        borderColor: getChestBorderColor(chest.chest_type, !isLocked),
                                        opacity: isClaimed ? 0.75 : 1
                                    }
                                ]}
                            >
                                <View style={styles.cardHeaderRow}>
                                    <View style={styles.cardInfo}>
                                        <Text style={[styles.chestLabel, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>
                                            {chest.label}
                                        </Text>
                                        <Text style={[styles.chestSubLabel, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                                            {getChestSubLabel(chest)}
                                        </Text>
                                    </View>
                                    <View style={styles.svgWrapper}>
                                        {/* Pure Gamified SVG instead of raster images */}
                                        <ConsistentChestSvg type={chest.chest_type} isOpened={isClaimed} size={88} />
                                    </View>
                                </View>

                                {/* Progress bar for weekly chests */}
                                {chest.chest_type !== 'normal' && (
                                    <View style={styles.progressRow}>
                                        <View style={styles.progressHeader}>
                                            <Text style={[styles.progressText, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                                                Progress: {chest.progress}/{chest.target} completed
                                            </Text>
                                            {isReady && <Text style={styles.unlockedTag}>Ready to Claim!</Text>}
                                        </View>
                                        <View style={[styles.barBg, { backgroundColor: isDarkMode ? '#1E293B' : '#E2E8F0' }]}>
                                            <View 
                                                style={[
                                                    styles.barFill, 
                                                    { 
                                                        width: `${progressPercent}%`, 
                                                        backgroundColor: getChestBorderColor(chest.chest_type, true) 
                                                    }
                                                ]} 
                                            />
                                        </View>
                                    </View>
                                )}

                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    disabled={!isReady || isPurchasing}
                                    onPress={() => handleClaimChestInit(chest.chest_type)}
                                    style={[
                                        styles.claimButton,
                                        {
                                            backgroundColor: isClaimed 
                                                ? (isDarkMode ? '#1E293B' : '#E2E8F0') 
                                                : isReady 
                                                    ? getChestBorderColor(chest.chest_type, true)
                                                    : (isDarkMode ? '#334155' : '#CBD5E1')
                                        }
                                    ]}
                                >
                                    {isPurchasing ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <Text 
                                            style={[
                                                styles.claimButtonText, 
                                                { 
                                                    color: isClaimed 
                                                        ? (isDarkMode ? '#64748B' : '#94A3B8') 
                                                        : isReady 
                                                            ? '#FFF' 
                                                            : (isDarkMode ? '#94A3B8' : '#475569'),
                                                    fontFamily: 'Inter-Bold'
                                                }
                                            ]}
                                        >
                                            {isClaimed ? 'CLAIMED' : isReady ? 'CLAIM CHEST' : 'LOCKED'}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Interactive Gamified Claim Modal (Small Window Card) */}
            <Modal visible={rewardModalVisible} transparent animationType="fade">
                <View style={styles.modalOverlay}>
                    {/* Backdrop touch to close (only if already opened) */}
                    <TouchableOpacity 
                        activeOpacity={1} 
                        style={StyleSheet.absoluteFillObject} 
                        onPress={() => {
                            if (isOpened) setRewardModalVisible(false);
                        }}
                    />

                    {/* Small Window Card Container */}
                    <View style={[
                        styles.modalCard, 
                        { 
                            backgroundColor: colors.card, 
                            borderColor: getChestBorderColor(claimedChestType, true) 
                        }
                    ]}>
                        {/* Spinning Sunburst Effect inside the card */}
                        <Animated.View style={[styles.modalCardSunburst, { transform: [{ rotate: sunburstSpin }] }]}>
                            <Sunburst size={400} color={isOpened ? 'rgba(251, 191, 36, 0.3)' : 'rgba(251, 191, 36, 0.08)'} />
                        </Animated.View>

                        {/* Card Title */}
                        <Text style={[styles.modalCardTitle, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>
                            {claimedChestType === 'normal' ? 'Daily Chest' : claimedChestType.toUpperCase() + ' CHEST'}
                        </Text>

                        <Animated.View 
                            style={[
                                styles.modalInteractiveArea, 
                                { transform: [{ translateY: floatAnim }, { translateX: shakeAnim }] }
                            ]}
                        >
                            <TouchableOpacity activeOpacity={1} onPress={handleTapToOpen} style={{ alignItems: 'center', marginVertical: 20 }}>
                                <View style={{ zIndex: 2 }}>
                                    <ConsistentChestSvg type={claimedChestType} isOpened={isOpened} size={150} />
                                </View>

                                {/* Popping Rewards */}
                                {isOpened && (
                                    <Animated.View 
                                        style={[
                                            styles.rewardsPopout, 
                                            { 
                                                opacity: rewardPopScale,
                                                transform: [{ translateY: rewardPopY }, { scale: rewardPopScale }] 
                                            }
                                        ]}
                                    >
                                        <View style={styles.rewardBubble}>
                                            <CoinIcon size={24} />
                                            <Text style={[styles.rewardBubbleText, { color: '#000', fontSize: 18 }]}>+{claimedCoins}</Text>
                                        </View>
                                        {claimedBooster && (
                                            <View style={[styles.rewardBubble, { marginTop: -4 }]}>
                                                <BoosterIcon type={claimedBooster} size={24} />
                                                <Text style={[styles.rewardBubbleText, { color: '#000', fontSize: 18 }]}>{claimedBooster}</Text>
                                            </View>
                                        )}
                                    </Animated.View>
                                )}
                            </TouchableOpacity>

                            {!isOpened ? (
                                <Animated.Text style={[styles.tapToOpenText, { color: colors.text, opacity: textPulse, fontSize: 18, marginTop: 10 }]}>
                                    TAP TO OPEN
                                </Animated.Text>
                            ) : (
                                <Animated.Text style={[styles.youGotText, { opacity: awesomeOpacity, fontSize: 18, marginTop: 10 }]}>
                                    CHEST OPENED!
                                </Animated.Text>
                            )}
                        </Animated.View>

                        {/* Footer Close Button inside the Card */}
                        {isOpened && (
                            <Animated.View style={[styles.modalCardBtnWrapper, { opacity: awesomeOpacity }]}>
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    onPress={() => setRewardModalVisible(false)}
                                    style={[
                                        styles.awesomeButton, 
                                        { 
                                            backgroundColor: getChestBorderColor(claimedChestType, true),
                                            marginTop: 20,
                                            height: 48,
                                            borderRadius: 24
                                        }
                                    ]}
                                >
                                    <Text style={styles.awesomeButtonText}>AWESOME</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 24 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 20 },
    backBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    title: { fontSize: 20, flex: 1, marginLeft: 16 },
    coinDisplay: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, borderWidth: 1, gap: 6 },
    coinText: { fontSize: 16 },
    statsCard: { flexDirection: 'row', padding: 20, borderRadius: 24, borderWidth: 1, alignItems: 'center', gap: 14, marginBottom: 28 },
    statsMeta: { flex: 1 },
    statsTitle: { fontSize: 15 },
    statsDesc: { fontSize: 12, lineHeight: 18, marginTop: 2 },
    sectionTitle: { fontSize: 18, marginBottom: 16 },
    chestList: { gap: 16 },
    chestCard: { padding: 20, borderRadius: 28, borderWidth: 1.5 },
    cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cardInfo: { flex: 1, marginRight: 12 },
    chestLabel: { fontSize: 18 },
    chestSubLabel: { fontSize: 12, marginTop: 4 },
    svgWrapper: { width: 90, height: 72, justifyContent: 'center', alignItems: 'center' },
    progressRow: { marginTop: 16, marginBottom: 4 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    progressText: { fontSize: 11 },
    unlockedTag: { fontSize: 11, color: '#10B981', fontFamily: 'Inter-Bold' },
    barBg: { height: 6, borderRadius: 3, overflow: 'hidden' },
    barFill: { height: '100%', borderRadius: 3 },
    claimButton: { width: '100%', height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginTop: 16 },
    claimButtonText: { fontSize: 14 },
    
    // Gamified Modal Styles
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
    modalCard: {
        width: '85%',
        borderRadius: 28,
        borderWidth: 2,
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.2,
        shadowRadius: 15,
        elevation: 8,
    },
    modalCardTitle: {
        fontSize: 22,
        marginBottom: 10,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    modalCardSunburst: {
        position: 'absolute',
        opacity: 0.6,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 0,
    },
    modalCardBtnWrapper: {
        width: '100%',
        paddingHorizontal: 10,
    },
    sunburstWrapper: { position: 'absolute', opacity: 0.8 },
    modalInteractiveArea: { alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    tapToOpenText: { color: '#FFF', fontSize: 24, fontFamily: 'Inter-Black', marginTop: 40, letterSpacing: 1.5 },
    youGotText: { color: '#FCD34D', fontSize: 24, fontFamily: 'Inter-Black', marginTop: 40, letterSpacing: 1, textShadowColor: 'rgba(0,0,0,0.5)', textShadowOffset: {width: 0, height: 2}, textShadowRadius: 4 },
    rewardsPopout: { position: 'absolute', top: '50%', zIndex: 1, alignItems: 'center' },
    rewardBubble: { flexDirection: 'row', backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, alignItems: 'center', gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 },
    rewardBubbleText: { fontSize: 22, fontFamily: 'Inter-Black' },
    awesomeBtnWrapper: { position: 'absolute', bottom: 50, width: '100%', paddingHorizontal: 30 },
    awesomeButton: { backgroundColor: '#10B981', width: '100%', height: 56, borderRadius: 28, justifyContent: 'center', alignItems: 'center', shadowColor: '#000', shadowOffset: {width:0, height: 4}, shadowOpacity: 0.3, shadowRadius: 5 },
    awesomeButtonText: { color: '#FFF', fontSize: 18, fontFamily: 'Inter-Black', letterSpacing: 1 },
});

export default ChestScreen;
