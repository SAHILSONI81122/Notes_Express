import React, { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Alert, ActivityIndicator, Image, Modal, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { buyBooster, buyStreakFreezer, activateBooster, getMe } from '../api/api';
import { useTheme } from '../context/ThemeContext';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop, Path } from 'react-native-svg';

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

const BoosterIcon = ({ type, size = 56 }) => {
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
    if (type === 'streak_freezer') {
        return (
            <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
                <Defs>
                    <SvgGradient id="gradSF" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#93C5FD" />
                        <Stop offset="100%" stopColor="#3B82F6" />
                    </SvgGradient>
                    <SvgGradient id="borderSF" x1="0%" y1="100%" x2="100%" y2="0%">
                        <Stop offset="0%" stopColor="#2563EB" />
                        <Stop offset="100%" stopColor="#BFDBFE" />
                    </SvgGradient>
                </Defs>
                <Path d="M12 2l2.5 6h6.5l-5 4 2 6.5-6-4.5-6 4.5 2-6.5-5-4h6.5L12 2z" fill="url(#gradSF)" fillOpacity={0.15} stroke="url(#borderSF)" strokeWidth={1.5} strokeLinejoin="round" />
                <Path d="M12 5l1.5 4h4l-3 2.5 1 4-3.5-3-3.5 3 1-4-3-2.5h4L12 5z" fill="url(#gradSF)" stroke="#2563EB" strokeWidth="0.5" />
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

const BoosterScreen = ({ navigation }) => {
    const { isDarkMode, colors } = useTheme();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [buyingType, setBuyingType] = useState(null);
    const buyingRef = useRef(false);
    const [timeLeftStr, setTimeLeftStr] = useState('');
    const [customModalConfig, setCustomModalConfig] = useState(null);
    const [modalAnim] = useState(new Animated.Value(0));

    const fetchUserDetails = async () => {
        try {
            const res = await getMe();
            setUser(res.data);
        } catch (e) {
            console.log("Failed fetching user in BoosterScreen", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUserDetails();
    }, []);

    // Countdown Timer logic
    useEffect(() => {
        if (!user?.xp_booster_expiry) return;

        const updateTimer = () => {
            const expiry = new Date(user.xp_booster_expiry);
            const now = new Date();
            const diffMs = expiry - now;

            if (diffMs <= 0) {
                setTimeLeftStr('');
                // Optionally refresh user details once it ends
                fetchUserDetails();
            } else {
                const totalSecs = Math.floor(diffMs / 1000);
                const hrs = Math.floor(totalSecs / 3600);
                const mins = Math.floor((totalSecs % 3600) / 60);
                const secs = totalSecs % 60;

                const hrsStr = hrs > 0 ? `${hrs.toString().padStart(2, '0')}:` : '';
                const minsStr = mins.toString().padStart(2, '0');
                const secsStr = secs.toString().padStart(2, '0');

                setTimeLeftStr(`${hrsStr}${minsStr}:${secsStr}`);
            }
        };

        updateTimer();
        const interval = setInterval(updateTimer, 1000);
        return () => clearInterval(interval);
    }, [user?.xp_booster_expiry]);

    const handleBuyBooster = async (type, cost) => {
        if (!user || buyingRef.current) return;
        if (user.coins < cost) {
            Alert.alert("Insufficient Coins", "Complete more notes or DPPs to earn coins!");
            return;
        }

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (type === 'streak_freezer') {
            buyingRef.current = true;
            setBuyingType(type);
            try {
                const res = await buyStreakFreezer();
                Alert.alert("Streak Freezer Purchased! ❄️", "Your streak is now protected. If you miss a day, your freezer will auto-activate to save your streak!");
                setUser(res.data);
            } catch (err) {
                const msg = err.response?.data?.detail || "Purchase failed. Please try again.";
                Alert.alert("Purchase Failed", msg);
            } finally {
                setBuyingType(null);
                buyingRef.current = false;
            }
            return;
        }

        // For XP Boosters, open custom modal
        const boosterItem = boostersList.find(b => b.type === type);
        setCustomModalConfig({
            type: 'buy',
            boosterType: type,
            title: 'Booster Purchased!',
            subtitle: `You bought the ${boosterItem?.label}. Do you want to activate it right now to start your 2x XP boost, or save it in your inventory?`,
            icon: type,
            actions: [
                { label: 'Save for Later', onPress: () => executePurchase(type, false), secondary: true },
                { label: 'Activate Now', onPress: () => executePurchase(type, true), primary: true }
            ]
        });
        
        Animated.spring(modalAnim, {
            toValue: 1,
            friction: 6,
            tension: 40,
            useNativeDriver: true
        }).start();
    };

    const executePurchase = async (type, activateNow) => {
        closeModal();
        buyingRef.current = true;
        setBuyingType(type);
        try {
            // 1. Buy it (puts it in inventory)
            let res = await buyBooster(type);
            
            // 2. Activate immediately if requested
            if (activateNow) {
                res = await activateBooster(type);
                Alert.alert("Booster Activated! 🚀", "Your Double XP boost is now active!");
            } else {
                Alert.alert("Saved! 🎒", "Booster added to your inventory for later use.");
            }
            setUser(res.data);
        } catch (err) {
            const msg = err.response?.data?.detail || "Booster purchase failed. Please try again.";
            Alert.alert("Purchase Failed", msg);
        } finally {
            setBuyingType(null);
            buyingRef.current = false;
        }
    };
    
    const closeModal = () => {
        Animated.timing(modalAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true
        }).start(() => setCustomModalConfig(null));
    };
    
    const handleActivateInventory = async (type) => {
        if (buyingRef.current) return;
        
        Alert.alert(
            "Activate Booster",
            "Are you sure you want to activate this booster now?",
            [
                { text: "Cancel", style: "cancel" },
                { 
                    text: "Activate", 
                    onPress: async () => {
                        buyingRef.current = true;
                        setBuyingType('activate_' + type);
                        try {
                            const res = await activateBooster(type);
                            Alert.alert("Booster Activated! 🚀", "Your Double XP boost is now active!");
                            setUser(res.data);
                        } catch (err) {
                            const msg = err.response?.data?.detail || "Failed to activate booster.";
                            Alert.alert("Error", msg);
                        } finally {
                            setBuyingType(null);
                            buyingRef.current = false;
                        }
                    }
                }
            ]
        );
    };

    const boostersList = [
        { type: '10m', label: '10 Min Booster', duration: '10 Minutes', cost: 100, icon: 'flash' },
        { type: '30m', label: '30 Min Booster', duration: '30 Minutes', cost: 250, icon: 'speedometer' },
        { type: '1h', label: '1 Hour Booster', duration: '1 Hour', cost: 400, icon: 'hourglass' },
        { type: '3h', label: '3 Hour Booster', duration: '3 Hours', cost: 600, icon: 'time' },
        { type: 'streak_freezer', label: 'Streak Freezer', duration: '2 Days', cost: 600, icon: 'snow' },
    ];

    if (loading) {
        return (
            <SafeAreaView style={[styles.container, { backgroundColor: colors.background, justifyContent: 'center' }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </SafeAreaView>
        );
    }

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
                <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]} numberOfLines={1}>Perks Shop</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity 
                        activeOpacity={0.8}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            navigation.navigate('Chest');
                        }}
                        style={[styles.coinDisplay, { backgroundColor: isDarkMode ? '#2A1F3D' : '#F3E8FF', borderColor: isDarkMode ? '#4C1D95' : '#D8B4FE', paddingHorizontal: 10 }]}
                    >
                        <Ionicons name="gift" size={16} color={isDarkMode ? '#A78BFA' : '#7C3AED'} />
                        <Text style={{ color: isDarkMode ? '#C4B5FD' : '#6D28D9', fontFamily: 'Inter-Bold', fontSize: 13 }}>
                            Chests
                        </Text>
                    </TouchableOpacity>

                    {user?.streak_freezers_owned > 0 && (
                        <View style={[styles.coinDisplay, { backgroundColor: isDarkMode ? '#1E3A8A' : '#DBEAFE', borderColor: isDarkMode ? '#1E40AF' : '#BFDBFE', paddingHorizontal: 10 }]}>
                            <Ionicons name="snow" size={16} color={isDarkMode ? '#93C5FD' : '#2563EB'} />
                            <Text style={{ color: isDarkMode ? '#93C5FD' : '#2563EB', fontFamily: 'Inter-Bold', fontSize: 13 }}>
                                {user.streak_freezers_owned}
                            </Text>
                        </View>
                    )}

                    <View style={[styles.coinDisplay, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFBEB', borderColor: isDarkMode ? '#334155' : '#FDE68A' }]}>
                        <CoinIcon size={18} />
                        <Text style={[styles.coinText, { color: isDarkMode ? '#FBBF24' : '#D97706', fontFamily: 'Inter-Bold' }]}>
                            {user?.coins || 0}
                        </Text>
                    </View>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Active Booster Card */}
                {timeLeftStr ? (
                    <View style={[styles.activeCard, { backgroundColor: colors.primary }]}>
                        <View style={styles.activeRow}>
                            <Ionicons name="rocket-sharp" size={32} color="#FFF" />
                            <View style={styles.activeMeta}>
                                <Text style={styles.activeTitle}>Double XP Booster Active</Text>
                                <Text style={styles.activeTime}>Time Remaining: {timeLeftStr}</Text>
                            </View>
                        </View>
                    </View>
                ) : (
                    <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Ionicons name="information-circle-outline" size={24} color={colors.subtext} />
                        <Text style={[styles.infoText, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                            Use your earned coins to buy boosters and double your XP gains from completed notes and DPPs!
                        </Text>
                    </View>
                )}

                {/* Booster Items */}
                
                {/* Inventory Section */}
                {user?.inventory_boosters && user.inventory_boosters.length > 0 && (
                    <>
                        <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter-ExtraBold', marginTop: 10 }]}>Your Inventory</Text>
                        <View style={styles.shopGrid}>
                            {user.inventory_boosters.map((invItem, index) => {
                                const b = boostersList.find(b => b.type === invItem.type);
                                if (!b) return null;
                                const isActivating = buyingType === 'activate_' + b.type;
                                return (
                                    <View 
                                        key={`inv_${index}`} 
                                        style={[
                                            styles.boosterCard, 
                                            { 
                                                backgroundColor: isDarkMode ? '#1E293B' : '#F8FAFC', 
                                                borderColor: colors.primary,
                                                borderWidth: 1.5,
                                            }
                                        ]}
                                    >
                                        <View style={styles.iconCircle}>
                                            <BoosterIcon type={b.type} size={48} />
                                        </View>
                                        <Text style={[styles.boosterLabel, { color: colors.text, fontFamily: 'Inter-Bold', fontSize: 13 }]}>{b.label}</Text>
                                        
                                        <TouchableOpacity
                                            activeOpacity={0.8}
                                            disabled={isActivating}
                                            onPress={() => handleActivateInventory(b.type)}
                                            style={[
                                                styles.buyButton,
                                                { backgroundColor: colors.primary, marginTop: 12, paddingVertical: 10 }
                                            ]}
                                        >
                                            {isActivating ? (
                                                <ActivityIndicator size="small" color="#FFF" />
                                            ) : (
                                                <Text style={[styles.buyButtonText, { color: '#FFF', fontFamily: 'Inter-Bold' }]}>
                                                    Activate Now
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>
                        <View style={{ height: 20 }} />
                    </>
                )}

                <Text style={[styles.sectionTitle, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>XP Perks Shop</Text>
                <View style={styles.shopGrid}>
                    {boostersList.map((item) => {
                        const hasEnough = (user?.coins || 0) >= item.cost;
                        const isPurchasing = buyingType === item.type;
                        
                        return (
                            <View 
                                key={item.type} 
                                style={[
                                    styles.boosterCard, 
                                    { 
                                        backgroundColor: colors.card, 
                                        borderColor: hasEnough ? (isDarkMode ? '#475569' : '#E2E8F0') : (isDarkMode ? '#334155' : '#F1F5F9'),
                                        opacity: hasEnough ? 1.0 : 0.8
                                    }
                                ]}
                            >
                                <View style={styles.iconCircle}>
                                    <BoosterIcon type={item.type} size={56} />
                                </View>
                                
                                <Text style={[styles.boosterLabel, { color: colors.text, fontFamily: 'Inter-Bold' }]}>{item.label}</Text>
                                <Text style={[styles.boosterDesc, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>+{item.duration} Boost</Text>
                                
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    disabled={isPurchasing}
                                    onPress={() => handleBuyBooster(item.type, item.cost)}
                                    style={[
                                        styles.buyButton,
                                        {
                                            backgroundColor: hasEnough ? '#F59E0B' : (isDarkMode ? '#334155' : '#E2E8F0')
                                        }
                                    ]}
                                >
                                    {isPurchasing ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <View style={styles.buttonContent}>
                                            <CoinIcon size={14} />
                                            <Text 
                                                style={[
                                                    styles.buyButtonText, 
                                                    { 
                                                        color: hasEnough ? '#FFF' : (isDarkMode ? '#94A3B8' : '#64748B'),
                                                        fontFamily: 'Inter-Bold' 
                                                    }
                                                ]}
                                            >
                                                {item.cost}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>

            {/* Custom Modal for Booster Actions */}
            <Modal
                transparent={true}
                visible={!!customModalConfig}
                animationType="none"
                onRequestClose={closeModal}
            >
                <View style={styles.modalOverlay}>
                    <Animated.View style={[
                        styles.modalContent,
                        {
                            backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                            transform: [
                                {
                                    translateY: modalAnim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [300, 0]
                                    })
                                }
                            ],
                            opacity: modalAnim
                        }
                    ]}>
                        {customModalConfig?.icon && (
                            <View style={styles.modalIconBox}>
                                <BoosterIcon type={customModalConfig.icon} size={64} />
                            </View>
                        )}
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{customModalConfig?.title}</Text>
                        <Text style={[styles.modalSubtitle, { color: colors.subtext }]}>{customModalConfig?.subtitle}</Text>

                        <View style={styles.modalActions}>
                            {customModalConfig?.actions?.map((action, i) => (
                                <TouchableOpacity
                                    key={i}
                                    activeOpacity={0.8}
                                    style={[
                                        styles.modalBtn,
                                        action.primary ? { backgroundColor: '#F59E0B' } : { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' },
                                    ]}
                                    onPress={action.onPress}
                                >
                                    <Text style={[
                                        styles.modalBtnText,
                                        { color: action.primary ? '#FFF' : colors.text }
                                    ]}>
                                        {action.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                        <TouchableOpacity style={styles.modalCloseIcon} onPress={closeModal}>
                            <Ionicons name="close" size={24} color={colors.subtext} />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 16 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 20 },
    backBtn: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    title: { fontSize: 19, flex: 1, marginLeft: 12 },
    coinDisplay: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 16, borderWidth: 1, gap: 4 },
    coinText: { fontSize: 16 },
    infoCard: { flexDirection: 'row', padding: 20, borderRadius: 24, borderWidth: 1, alignItems: 'center', gap: 14, marginBottom: 24 },
    infoText: { flex: 1, fontSize: 13, lineHeight: 18 },
    activeCard: { padding: 20, borderRadius: 24, marginBottom: 28, shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 4 },
    activeRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
    activeMeta: { flex: 1 },
    activeTitle: { color: '#FFF', fontSize: 16, fontFamily: 'Inter-Bold' },
    activeTime: { color: 'rgba(255,255,255,0.85)', fontSize: 14, fontFamily: 'Inter-Medium', marginTop: 4 },
    sectionTitle: { fontSize: 18, marginBottom: 16 },
    shopGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
    boosterCard: { width: '48%', padding: 20, borderRadius: 28, borderWidth: 1, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1, marginBottom: 14 },
    iconCircle: { width: 56, height: 56, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
    boosterLabel: { fontSize: 15, textAlign: 'center' },
    boosterDesc: { fontSize: 12, marginTop: 4, marginBottom: 16 },
    buyButton: { width: '100%', paddingVertical: 12, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
    buttonContent: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    buyButtonText: { fontSize: 14 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { width: '100%', borderRadius: 32, padding: 28, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 30, elevation: 10 },
    modalIconBox: { marginBottom: 20 },
    modalTitle: { fontSize: 22, fontFamily: 'Inter-ExtraBold', textAlign: 'center', marginBottom: 12 },
    modalSubtitle: { fontSize: 15, fontFamily: 'Inter-Medium', textAlign: 'center', lineHeight: 22, marginBottom: 32 },
    modalActions: { width: '100%', gap: 12 },
    modalBtn: { width: '100%', paddingVertical: 16, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    modalBtnText: { fontSize: 16, fontFamily: 'Inter-Bold' },
    modalCloseIcon: { position: 'absolute', top: 16, right: 16, width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(128,128,128,0.1)', justifyContent: 'center', alignItems: 'center' },
});

export default BoosterScreen;
