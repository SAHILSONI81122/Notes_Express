import React, { useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal, ScrollView, Animated, Alert, Image, PanResponder, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { getMe, getClassGroups, sendHeartbeat, getActiveCount, getStudentProgress, getUnreadCount, getChestsStatus, submitDpp } from '../api/api';
import { useFocusEffect } from '@react-navigation/native';
import { isOnline, getOfflineSubmissions, clearOfflineSubmissions } from '../utils/offlineManager';
import { useTheme } from '../context/ThemeContext';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { RankBadge, RANKS_LADDER } from '../components/RankBadge';
import { usePushNotifications } from '../hooks/usePushNotifications';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedTouchableOpacity = Animated.createAnimatedComponent(TouchableOpacity);

const CircularProgress = ({ progress, size, strokeWidth, color, textColor, subtextColor, trackColor }) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.spring(animatedValue, {
            toValue: progress,
            useNativeDriver: true,
            bounciness: 2,
            speed: 12
        }).start();
    }, [progress]);

    const strokeDashoffset = animatedValue.interpolate({
        inputRange: [0, 100],
        outputRange: [circumference, 0],
    });

    const center = size / 2;

    return (
        <View style={{ width: size, height: size, justifyContent: 'center', alignItems: 'center' }}>
            <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <Defs>
                    <SvgGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={color} stopOpacity="1" />
                        <Stop offset="100%" stopColor={color} stopOpacity="0.7" />
                    </SvgGradient>
                </Defs>

                {/* Clean Background Track */}
                <Circle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke={trackColor || "rgba(255,255,255,0.08)"}
                    strokeWidth={strokeWidth}
                    fill="transparent"
                />

                {/* Main Progress Ring - Crisp & Vibrant */}
                <AnimatedCircle
                    cx={center}
                    cy={center}
                    r={radius}
                    stroke="url(#ringGrad)"
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                    rotation="-90"
                    origin={`${center}, ${center}`}
                />
            </Svg>

            {/* Center Text */}
            <View style={{ 
                position: 'absolute', 
                width: size, 
                height: size, 
                justifyContent: 'center', 
                alignItems: 'center',
                zIndex: 10,
                elevation: 10
            }}>
                <Text style={{ fontSize: size * 0.22, fontFamily: 'Inter-Black', color: textColor || '#FFFFFF', letterSpacing: -0.5 }}>
                    {Math.round(progress || 0)}%
                </Text>
                <Text style={{ fontSize: 10, fontFamily: 'Inter-Bold', color: subtextColor || 'rgba(255,255,255,0.5)', marginTop: -2 }}>
                    OVERALL
                </Text>
            </View>
        </View>
    );
};

const CoinIcon = ({ size = 20 }) => {
    return (
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
};

const AnimatedProgressBar = ({ progress, color, height = 8 }) => {
    const animatedWidth = useRef(new Animated.Value(0)).current;
    const shineAnim = useRef(new Animated.Value(-100)).current;
    
    useEffect(() => {
        Animated.spring(animatedWidth, {
            toValue: progress,
            useNativeDriver: false,
            bounciness: 8,
            speed: 12
        }).start();

        Animated.loop(
            Animated.timing(shineAnim, {
                toValue: 400,
                duration: 2000,
                useNativeDriver: true,
            })
        ).start();
    }, [progress]);

    return (
        <View style={{ height, width: '100%', backgroundColor: 'rgba(0,0,0,0.1)', borderRadius: height / 2, overflow: 'hidden' }}>
            <Animated.View 
                style={{ 
                    height: '100%', 
                    backgroundColor: color, 
                    width: animatedWidth.interpolate({
                        inputRange: [0, 100],
                        outputRange: ['0%', '100%']
                    }),
                    borderRadius: height / 2,
                    shadowColor: color,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.8,
                    shadowRadius: 10,
                    elevation: 5
                }} 
            />
            <Animated.View style={[StyleSheet.absoluteFill, { 
                width: '40%', 
                transform: [{ translateX: shineAnim }] 
            }]}>
                <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.4)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                />
            </Animated.View>
        </View>
    );
};


const StudentDashboard = ({ route, navigation }) => {
    const [user, setUser] = React.useState(null);
    const { expoPushToken, notification } = usePushNotifications(user);
    const [selectedClassName, setSelectedClassName] = React.useState(null);
    const [selectedClassId, setSelectedClassId] = React.useState(null);
    const [classGroups, setClassGroups] = React.useState([]);
    const [showClassSelector, setShowClassSelector] = React.useState(false);
    const [activeCount, setActiveCount] = React.useState(null);
    const [activeStudents, setActiveStudents] = React.useState([]);
    const [showActiveModal, setShowActiveModal] = React.useState(false);
    const [showRankModal, setShowRankModal] = React.useState(false);
    const [showStreakModal, setShowStreakModal] = React.useState(false);
    const [progress, setProgress] = React.useState(null);
    const [unreadDoubts, setUnreadDoubts] = React.useState(0);
    const [chests, setChests] = React.useState(null);
    const { isDarkMode, colors } = useTheme();

    const heartbeatRef = useRef(null);
    const pollRef = useRef(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    
    const [toastData, setToastData] = React.useState(null);
    const toastAnim = useRef(new Animated.Value(-150)).current;

    const triggerLocalToast = (title, body) => {
        setToastData({ title, body });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        
        Animated.spring(toastAnim, {
            toValue: 20,
            useNativeDriver: true,
            bounciness: 12,
            speed: 14
        }).start();

        setTimeout(() => {
            Animated.timing(toastAnim, {
                toValue: -150,
                duration: 300,
                useNativeDriver: true
            }).start(() => setToastData(null));
        }, 4000);
    };

    useEffect(() => {
        if (notification) {
            triggerLocalToast(notification.request.content.title, notification.request.content.body);
        }
    }, [notification]);

    const pan = useRef(new Animated.ValueXY()).current;
    const panResponder = useRef(
        PanResponder.create({
            onMoveShouldSetPanResponder: (evt, gestureState) => {
                return Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
            },
            onPanResponderGrant: () => {
                pan.setOffset({ x: pan.x._value, y: pan.y._value });
            },
            onPanResponderMove: Animated.event(
                [null, { dx: pan.x, dy: pan.y }],
                { useNativeDriver: false }
            ),
            onPanResponderRelease: (evt, gestureState) => {
                pan.flattenOffset();
                
                const { width: SCREEN_WIDTH } = Dimensions.get('window');
                const isLeftHalf = gestureState.moveX < SCREEN_WIDTH / 2;
                
                // Initial right position is 20. So pan.x = 0 means it's on the right.
                // To snap to the left, targetX = -(SCREEN_WIDTH - 64(width) - 20(initial right) - 20(left margin))
                const targetX = isLeftHalf ? -(SCREEN_WIDTH - 104) : 0;

                Animated.spring(pan.x, {
                    toValue: targetX,
                    useNativeDriver: false,
                    bounciness: 10,
                    speed: 14
                }).start();
            }
        })
    ).current;

    useEffect(() => {
        const pulseLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, useNativeDriver: true }),
                Animated.timing(pulseAnim, { toValue: 1.0, duration: 900, useNativeDriver: true })
            ])
        );
        pulseLoop.start();
        return () => pulseLoop.stop();
    }, []);

    useEffect(() => {
        const syncOffline = async () => {
            const online = await isOnline();
            if (online) {
                const submissions = await getOfflineSubmissions();
                if (submissions && submissions.length > 0) {
                    let syncedCount = 0;
                    for (const sub of submissions) {
                        try {
                            if (sub.dpp_id) {
                                await submitDpp(sub);
                                syncedCount++;
                            }
                        } catch (e) {
                            console.log("Failed to sync submission:", e);
                        }
                    }
                    if (syncedCount > 0) {
                        await clearOfflineSubmissions();
                        if (selectedClassId) fetchProgress(selectedClassId);
                    }
                }
            }
        };
        syncOffline();
    }, [selectedClassId]);

    const fetchActiveCount = async (classId) => {
        if (!classId) return;
        try {
            const res = await getActiveCount(classId);
            setActiveCount(res.data.active_count);
            setActiveStudents(res.data.active_students || []);
        } catch (e) {
            console.log('Active count error:', e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            getMe().then(async res => {
                const userData = res.data;
                setUser(userData);
                await AsyncStorage.setItem('cached_user', JSON.stringify(userData));
                
                const id = await AsyncStorage.getItem('selectedClassGroupId');
                const numericId = id ? Number(id) : null;
                setSelectedClassId(numericId);

                if (userData.batch_id && (userData.role === 'admin' || userData.role === 'teacher')) {
                    getClassGroups(userData.batch_id).then(async cgRes => {
                        const groups = cgRes.data;
                        setClassGroups(groups);
                        
                        // If no classes exist for this batch, clear selection
                        if (groups.length === 0) {
                            setSelectedClassId(null);
                            setSelectedClassName(null);
                            await AsyncStorage.removeItem('selectedClassGroupId');
                            await AsyncStorage.removeItem('selectedClassName');
                        } else if (id) {
                            // If selected class isn't in current batch, clear it
                            if (!groups.some(g => g.id.toString() === id.toString())) {
                                setSelectedClassId(null);
                                setSelectedClassName(null);
                                await AsyncStorage.removeItem('selectedClassGroupId');
                                await AsyncStorage.removeItem('selectedClassName');
                            } else {
                                fetchActiveCount(id);
                            }
                        }
                    }).catch(console.log);
                }
            }).catch(async err => {
                console.log("getMe error:", err);
                const cachedUser = await AsyncStorage.getItem('cached_user');
                if (cachedUser) {
                    const parsedUser = JSON.parse(cachedUser);
                    setUser(parsedUser);
                    if (parsedUser.role !== 'student') {
                        const id = await AsyncStorage.getItem('selectedClassGroupId');
                        setSelectedClassId(id ? Number(id) : null);
                    }
                }
            });

            AsyncStorage.getItem('selectedClassName').then(name => setSelectedClassName(name));

            getStudentProgress().then(res => setProgress(res.data)).catch(console.log);
            getUnreadCount().then(res => setUnreadDoubts(res.data.unread_count || 0)).catch(console.log);
            getChestsStatus().then(res => setChests(res.data.chests)).catch(console.log);

            // Send heartbeat immediately then every 30 seconds (not 1s — avoids flooding the API)
            sendHeartbeat('Browsing Dashboard').catch(console.log);
            heartbeatRef.current = setInterval(() => {
                sendHeartbeat('Browsing Dashboard').catch(console.log);
            }, 30000);

            // Poll active count every 30 seconds (not 1s — avoids hammering the API)
            pollRef.current = setInterval(async () => {
                const userRes = await getMe();
                if (userRes.data.role === 'admin' || userRes.data.role === 'teacher') {
                    const id = await AsyncStorage.getItem('selectedClassGroupId');
                    fetchActiveCount(id);
                }
            }, 30000);
            
            // Poll for student progress changes every 60 seconds
            const studentPollRef = setInterval(async () => {
                const userRes = await getMe();
                if (userRes.data.role === 'student') {
                    try {
                        const progressRes = await getStudentProgress();
                        setProgress(prev => {
                            if (prev) {
                                if (progressRes.data.total_dpps > prev.total_dpps) {
                                    triggerLocalToast("New DPP Added!", "A new DPP was just added to your class.");
                                }
                                if (progressRes.data.total_notes > prev.total_notes) {
                                    triggerLocalToast("New Note Added!", "A new Note was just added to your class.");
                                }
                            }
                            return progressRes.data;
                        });
                    } catch (e) {
                        console.log("Polling progress error:", e);
                    }
                }
            }, 60000);

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }).start();

            return () => {
                clearInterval(heartbeatRef.current);
                clearInterval(pollRef.current);
                clearInterval(studentPollRef);
            };
        }, [route?.params?.refresh])
    );

    const handlePress = (screen) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        navigation.navigate(screen);
    };

    const getChestBadgeInfo = () => {
        if (!chests) {
            return {
                text: "Chests",
                icon: "gift",
                color: isDarkMode ? '#A78BFA' : '#7C3AED',
                bgColor: isDarkMode ? '#2A1F3D' : '#F3E8FF',
                borderColor: isDarkMode ? '#4C1D95' : '#D8B4FE',
                pulse: false
            };
        }

        // 1. Look for any chest that is ready to claim
        const claimable = chests.find(c => c.status === 'ready_to_claim');
        if (claimable) {
            let color = '#10B981'; // Green for ready to claim
            let bgColor = isDarkMode ? '#064E3B' : '#D1FAE5';
            let borderColor = isDarkMode ? '#047857' : '#A7F3D0';
            
            // Customize by type
            if (claimable.chest_type === 'normal') {
                return { text: "Claim Daily!", icon: "gift", color, bgColor, borderColor, pulse: true };
            } else if (claimable.chest_type === 'rare') {
                return { text: "Claim Rare!", icon: "gift", color, bgColor, borderColor, pulse: true };
            } else if (claimable.chest_type === 'epic') {
                return { text: "Claim Epic!", icon: "gift", color, bgColor, borderColor, pulse: true };
            } else {
                return { text: "Claim Legend!", icon: "gift", color, bgColor, borderColor, pulse: true };
            }
        }

        // 2. Otherwise, look for the first locked chest (next to unlock)
        const nextLocked = chests.find(c => c.status === 'locked');
        if (nextLocked) {
            let label = nextLocked.chest_type === 'rare' ? 'Rare' : nextLocked.chest_type === 'epic' ? 'Epic' : 'Legend';
            return {
                text: `${label} (${nextLocked.progress}/${nextLocked.target})`,
                icon: "lock-open-outline",
                color: isDarkMode ? '#94A3B8' : '#475569',
                bgColor: isDarkMode ? '#1E293B' : '#F1F5F9',
                borderColor: isDarkMode ? '#334155' : '#CBD5E1',
                pulse: false
            };
        }

        // 3. If all chests are claimed
        return {
            text: "All Claimed",
            icon: "checkmark-circle",
            color: isDarkMode ? '#64748B' : '#94A3B8',
            bgColor: isDarkMode ? '#1E293B' : '#F1F5F9',
            borderColor: isDarkMode ? '#334155' : '#E2E8F0',
            pulse: false
        };
    };

    const handleStreakPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setShowStreakModal(true);
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.topBar}>
                <TouchableOpacity 
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        navigation.openDrawer();
                    }} 
                    style={[styles.menuBtn, { backgroundColor: colors.card }]}
                >
                    <Ionicons name="menu" size={28} color={colors.text} />
                </TouchableOpacity>
                
                {user?.role === 'student' && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <AnimatedTouchableOpacity 
                            activeOpacity={0.8}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                navigation.navigate('Chest');
                            }}
                            style={[
                                styles.streakBadge, 
                                { 
                                    backgroundColor: getChestBadgeInfo().bgColor, 
                                    borderColor: getChestBadgeInfo().borderColor, 
                                    borderWidth: 1,
                                    transform: getChestBadgeInfo().pulse ? [{ scale: pulseAnim }] : [{ scale: 1 }]
                                }
                            ]}
                        >
                            <Ionicons name={getChestBadgeInfo().icon} size={18} color={getChestBadgeInfo().color} />
                            <Text style={[styles.streakText, { color: getChestBadgeInfo().color, fontFamily: 'Inter-Bold' }]}>
                                {getChestBadgeInfo().text}
                            </Text>
                        </AnimatedTouchableOpacity>
                        <TouchableOpacity 
                            activeOpacity={0.8}
                            onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                navigation.navigate('Booster');
                            }}
                            style={[styles.streakBadge, { backgroundColor: isDarkMode ? '#1E293B' : '#FFFBEB', borderColor: isDarkMode ? '#334155' : '#FDE68A', borderWidth: 1 }]}
                        >
                            <CoinIcon size={20} />
                            <Text style={[styles.streakText, { color: isDarkMode ? '#FBBF24' : '#D97706', fontFamily: 'Inter-Bold' }]}>
                                {user?.coins || 0}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            activeOpacity={0.8} 
                            onPress={handleStreakPress}
                            style={[styles.streakBadge, { backgroundColor: isDarkMode ? '#312E81' : '#EEF2FF' }]}
                        >
                            <Ionicons 
                                name="flame" 
                                size={Math.min(26, 18 + (user?.streak_count || 0))} 
                                color="#F59E0B" 
                            />
                            <Text style={[styles.streakText, { color: isDarkMode ? '#E0E7FF' : '#4338CA', fontFamily: 'Inter-Bold' }]}>
                                {user?.streak_count || 0}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {(user?.role === 'admin' || user?.role === 'teacher') && selectedClassName && (
                    <TouchableOpacity 
                        style={[styles.classBadge, { backgroundColor: colors.primary + '1A' }]}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            setShowClassSelector(true);
                        }}
                    >
                        <Ionicons name="layers" size={16} color={colors.primary} style={{marginRight: 6}} />
                        <Text style={{ color: colors.primary, fontFamily: 'Inter-Bold', fontSize: 13 }}>{selectedClassName}</Text>
                        <Ionicons name="chevron-down" size={16} color={colors.primary} style={{marginLeft: 4}} />
                    </TouchableOpacity>
                )}
            </View>
 
             <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
                 <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
                     <View style={styles.headerTop}>
                         <View>
                             <Text style={[styles.greeting, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>
                                 Hello, {user?.name?.split(' ')[0] || 'Student'}!
                             </Text>
                             <Text style={[styles.subtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                                 {user?.role === 'admin' || user?.role === 'teacher' 
                                     ? 'Manage your academic content today.' 
                                     : 'Ready to level up your knowledge?'}
                             </Text>
                         </View>
                     </View>

                    {user?.role === 'student' && (
                        <View style={[styles.gamifyRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <TouchableOpacity activeOpacity={0.8} onPress={() => setShowRankModal(true)}>
                                <RankBadge xp={user?.xp || 0} size="normal" />
                            </TouchableOpacity>
                            <View style={styles.xpContainer}>
                                <View style={styles.xpTextRow}>
                                    <Text style={[styles.xpLabel, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Experience</Text>
                                    <Text style={[styles.xpValue, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>{(user?.xp % 500) || 0} / 500 XP</Text>
                                </View>
                                <View style={[styles.xpBarBg, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
                                    <View style={[styles.xpBarFill, { backgroundColor: colors.primary, width: `${(user?.xp % 500) / 5}%` }]} />
                                </View>
                            </View>
                        </View>
                    )}
                </Animated.View>

                <View style={styles.grid}>
                    <View style={styles.row}>
                        <TouchableOpacity 
                            activeOpacity={0.9}
                            style={styles.subCardContainer}
                            onPress={() => handlePress('NotesScreen')}
                        >
                            <LinearGradient
                                colors={isDarkMode ? ['#4F46E5', '#3730A3'] : ['#6366F1', '#4F46E5']}
                                style={styles.subCard}
                            >
                                <View style={styles.iconCircle}>
                                    <Ionicons name="document-text" size={24} color="#FFFFFF" />
                                </View>
                                <Text style={[styles.subCardTitle, { fontFamily: 'Inter-Bold' }]}>Notes</Text>
                                <Text style={[styles.subCardSubtitle, { fontFamily: 'Inter-Medium' }]}>+20 XP / note</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            activeOpacity={0.9}
                            style={styles.subCardContainer}
                            onPress={() => handlePress('DPPScreen')}
                        >
                            <LinearGradient
                                colors={isDarkMode ? ['#E11D48', '#9F1239'] : ['#F43F5E', '#E11D48']}
                                style={styles.subCard}
                            >
                                <View style={styles.iconCircle}>
                                    <Ionicons name="create" size={24} color="#FFFFFF" />
                                </View>
                                <Text style={[styles.subCardTitle, { fontFamily: 'Inter-Bold' }]}>DPPs</Text>
                                <Text style={[styles.subCardSubtitle, { fontFamily: 'Inter-Medium' }]}>+10 XP / correct</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.row}>
                        <TouchableOpacity 
                            activeOpacity={0.9}
                            style={styles.subCardContainer}
                            onPress={() => handlePress('DoubtsScreen')}
                        >
                            <LinearGradient
                                colors={isDarkMode ? ['#0891B2', '#164E63'] : ['#06B6D4', '#0891B2']}
                                style={styles.subCard}
                            >
                                <View style={styles.iconCircle}>
                                    <View>
                                        <Ionicons name="chatbubbles" size={22} color="#FFFFFF" />
                                        {unreadDoubts > 0 && <View style={styles.dot} />}
                                    </View>
                                </View>
                                <Text style={[styles.subCardTitle, { fontFamily: 'Inter-Bold' }]}>Doubts</Text>
                                <Text style={[styles.subCardSubtitle, { fontFamily: 'Inter-Medium' }]}>Ask Mentors</Text>
                            </LinearGradient>
                        </TouchableOpacity>

                        <TouchableOpacity 
                            activeOpacity={0.9}
                            style={styles.subCardContainer}
                            onPress={() => handlePress('LeaderboardScreen')}
                        >
                            <LinearGradient
                                colors={isDarkMode ? ['#D97706', '#92400E'] : ['#F59E0B', '#D97706']}
                                style={styles.subCard}
                            >
                                <View style={styles.iconCircle}>
                                    <Ionicons name="trophy" size={22} color="#FFFFFF" />
                                </View>
                                <Text style={[styles.subCardTitle, { fontFamily: 'Inter-Bold' }]}>Ranking</Text>
                                <Text style={[styles.subCardSubtitle, { fontFamily: 'Inter-Medium' }]} numberOfLines={1}>Batch Toppers</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>

                    {user?.role === 'student' && progress && (

                        <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                            <View style={{ paddingVertical: 10 }}>
                                <Text style={[styles.statsTitle, { color: colors.text, fontFamily: 'Inter-Black', fontSize: 18, marginBottom: 16 }]}>My Progress</Text>

                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                    
                                    {/* Left Side: Circular Progress */}
                                    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                        <CircularProgress 
                                            progress={progress.overall_percentage || 0} 
                                            size={120} 
                                            strokeWidth={14} 
                                            color={colors.primary} 
                                            textColor={colors.text}
                                            subtextColor={colors.subtext}
                                            trackColor={isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.05)"}
                                        />
                                    </View>

                                    {/* Right Side: Stats Details */}
                                    <View style={{ flex: 1.2, gap: 16, paddingLeft: 12 }}>
                                        
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#6366F1' + '20', justifyContent: 'center', alignItems: 'center' }}>
                                                <Ionicons name="document-text" size={20} color="#6366F1" />
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 14, fontFamily: 'Inter-Bold', color: colors.text }}>Notes Vault</Text>
                                                <Text style={{ fontSize: 12, fontFamily: 'Inter-Medium', color: colors.subtext }}>{progress.notes_completed} of {progress.total_notes} finished</Text>
                                            </View>
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                            <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#EF4444' + '20', justifyContent: 'center', alignItems: 'center' }}>
                                                <Ionicons name="flame" size={20} color="#EF4444" />
                                            </View>
                                            <View>
                                                <Text style={{ fontSize: 14, fontFamily: 'Inter-Bold', color: colors.text }}>DPPs Solved</Text>
                                                <Text style={{ fontSize: 12, fontFamily: 'Inter-Medium', color: colors.subtext }}>{progress.dpps_solved} of {progress.total_dpps} completed</Text>
                                            </View>
                                        </View>

                                    </View>
                                </View>
                            </View>
                        </View>
                    )}

                    {(user?.role === 'admin' || user?.role === 'teacher') && selectedClassId && (
                        <>
                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    if (activeStudents.length > 0) setShowActiveModal(true);
                                }}
                                style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                            >
                                <View style={styles.statsInfo}>
                                    <Text style={[styles.statsTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Class Activity</Text>
                                    <Text style={[styles.statsSubtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                                        Live in {selectedClassName}
                                    </Text>
                                </View>
                                <View style={[styles.statsBadge, { backgroundColor: activeCount > 0 ? colors.success + '1A' : (isDarkMode ? '#374151' : '#F3F4F6') }]}>
                                    <View style={[styles.onlineDot, { backgroundColor: activeCount > 0 ? colors.success : '#9CA3AF' }]} />
                                    <Text style={[styles.statsCount, { color: activeCount > 0 ? colors.success : colors.subtext, fontFamily: 'Inter-ExtraBold' }]}>
                                        {activeCount !== null ? activeCount : '—'}
                                    </Text>
                                    <Text style={[styles.activeLabel, { color: activeCount > 0 ? colors.success : colors.subtext, fontFamily: 'Inter-Bold' }]}>
                                        Active
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            <TouchableOpacity 
                                activeOpacity={0.8}
                                onPress={() => {
                                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    navigation.navigate('ClassProgressScreen', { classId: selectedClassId, className: selectedClassName });
                                }}
                                style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border, marginTop: 12 }]}
                            >
                                <View style={styles.statsInfo}>
                                    <Text style={[styles.statsTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Student Progress</Text>
                                    <Text style={[styles.statsSubtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                                        View performance in {selectedClassName}
                                    </Text>
                                </View>
                                <View style={[styles.statsBadge, { backgroundColor: colors.primary + '1A', paddingHorizontal: 12 }]}>
                                    <Ionicons name="bar-chart" size={18} color={colors.primary} />
                                    <Text style={[styles.activeLabel, { color: colors.primary, fontFamily: 'Inter-Bold', marginLeft: 6 }]}>
                                        View
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </ScrollView>

            {/* ── Floating Brain Boost Button (students only) ── */}
            {user?.role === 'student' && (
                <Animated.View
                    style={{
                        position: 'absolute',
                        right: 20,
                        bottom: 20,
                        transform: [{ translateX: pan.x }, { translateY: pan.y }],
                        zIndex: 1000,
                    }}
                    {...panResponder.panHandlers}
                >
                    <TouchableOpacity
                        activeOpacity={0.9}
                        onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                            navigation.navigate('BrainGames');
                        }}
                        style={{
                            width: 64,
                            height: 64,
                            borderRadius: 32,
                            backgroundColor: isDarkMode ? '#2D1B69' : '#EEF2FF',
                            borderWidth: 2,
                            borderColor: isDarkMode ? '#818CF8' : '#6366F1',
                            justifyContent: 'center',
                            alignItems: 'center',
                            shadowColor: isDarkMode ? '#818CF8' : '#6366F1',
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.4,
                            shadowRadius: 10,
                            elevation: 8,
                        }}
                    >
                        <Text style={{ fontSize: 32 }}>🧠</Text>
                    </TouchableOpacity>
                </Animated.View>
            )}

            {/* Class Selector Modal */}
            <Modal visible={showClassSelector} transparent animationType="fade">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowClassSelector(false)}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <View style={styles.modalHeader}>
                            <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Switch Class</Text>
                            <TouchableOpacity onPress={() => setShowClassSelector(false)}>
                                <Ionicons name="close-circle" size={24} color={colors.subtext} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 350 }} showsVerticalScrollIndicator={false}>
                            {classGroups.map(cg => (
                                <TouchableOpacity 
                                    key={cg.id}
                                    style={[styles.classOption, { borderBottomColor: colors.border }]}
                                    onPress={async () => {
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        await AsyncStorage.setItem('selectedClassGroupId', cg.id.toString());
                                        await AsyncStorage.setItem('selectedClassName', cg.name);
                                        setSelectedClassName(cg.name);
                                        setSelectedClassId(cg.id.toString());
                                        setActiveCount(null);
                                        fetchActiveCount(cg.id.toString());
                                        setShowClassSelector(false);
                                    }}
                                >
                                    <View style={styles.optionLeft}>
                                        <View style={[styles.optionDot, { backgroundColor: selectedClassName === cg.name ? colors.primary : colors.border }]} />
                                        <Text style={[styles.classOptionText, { color: colors.text, fontFamily: selectedClassName === cg.name ? 'Inter-Bold' : 'Inter-Medium' }]}>
                                            {cg.name}
                                        </Text>
                                    </View>
                                    {selectedClassName === cg.name && <Ionicons name="checkmark-circle" size={24} color={colors.primary} />}
                                </TouchableOpacity>
                            ))}
                            {classGroups.length === 0 && (
                                <View style={styles.emptyState}>
                                    <Ionicons name="alert-circle-outline" size={48} color={colors.subtext} />
                                    <Text style={{ color: colors.subtext, textAlign: 'center', marginTop: 12, fontFamily: 'Inter-Medium' }}>No classes found.</Text>
                                </View>
                            )}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Active Students Modal */}
            <Modal visible={showActiveModal} transparent animationType="slide">
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowActiveModal(false)}>
                    <View style={[styles.modalContent, { backgroundColor: colors.card, height: '50%' }]}>
                        <View style={styles.modalHeader}>
                            <View>
                                <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Active Students</Text>
                                <Text style={{ color: colors.subtext, fontFamily: 'Inter-Medium' }}>Current activity in {selectedClassName}</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowActiveModal(false)}>
                                <Ionicons name="close-circle" size={24} color={colors.subtext} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
                            {activeStudents.map(student => (
                                <View key={student.id} style={[styles.studentItem, { borderBottomColor: colors.border }]}>
                                    <View style={[styles.avatarPlaceholder, { backgroundColor: colors.primary + '20' }]}>
                                        <Text style={{ color: colors.primary, fontFamily: 'Inter-Bold' }}>
                                            {student.name.charAt(0).toUpperCase()}
                                        </Text>
                                        <View style={[styles.activeStatusDot, { backgroundColor: colors.success }]} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.studentName, { color: colors.text, fontFamily: 'Inter-Bold' }]}>{student.name}</Text>
                                        <Text style={{ color: colors.subtext, fontSize: 12, fontFamily: 'Inter-Medium' }}>
                                            {student.current_action || 'Online'}
                                        </Text>
                                    </View>
                                    <View style={[styles.onlinePulse, { backgroundColor: colors.success + '20' }]}>
                                        <Text style={{ color: colors.success, fontSize: 10, fontFamily: 'Inter-Bold' }}>LIVE</Text>
                                    </View>
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* Streak Modal */}
            <Modal visible={showStreakModal} transparent animationType="fade">
                <View style={[styles.modalOverlay, { justifyContent: 'center', alignItems: 'center' }]}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowStreakModal(false)} />
                    <View style={[{ backgroundColor: colors.card, width: '85%', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }]}>
                        <View style={{ alignItems: 'center', marginBottom: 20 }}>
                            <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginBottom: 16 }}>
                                <Ionicons name="flame" size={32} color="#F59E0B" />
                            </View>
                            <Text style={{ color: colors.text, fontFamily: 'Inter-Black', fontSize: 22, textAlign: 'center' }}>How Streaks Work</Text>
                            <Text style={{ color: colors.subtext, fontFamily: 'Inter-Medium', fontSize: 14, textAlign: 'center', marginTop: 8 }}>Keep your daily streak alive to build a strong learning habit!</Text>
                        </View>
                        
                        <View style={{ gap: 16, marginBottom: 24 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#D1FAE5', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 }}>
                                    <Ionicons name="checkmark" size={14} color="#10B981" />
                                </View>
                                <Text style={{ flex: 1, color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, lineHeight: 20 }}>Complete any Note or DPP to earn a streak for the day.</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FEF3C7', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 }}>
                                    <Ionicons name="flash" size={14} color="#F59E0B" />
                                </View>
                                <Text style={{ flex: 1, color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, lineHeight: 20 }}>On every <Text style={{ fontFamily: 'Inter-Bold', color: '#F59E0B' }}>6th consecutive day</Text>, you earn <Text style={{ fontFamily: 'Inter-Bold', color: '#F59E0B' }}>2× XP</Text> on all tasks that day!</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#FEE2E2', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 }}>
                                    <Ionicons name="close" size={14} color="#EF4444" />
                                </View>
                                <Text style={{ flex: 1, color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, lineHeight: 20 }}>Missing a day completely resets your streak back to 1.</Text>
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                                <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#DBEAFE', justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2 }}>
                                    <Ionicons name="shield-checkmark" size={14} color="#3B82F6" />
                                </View>
                                <Text style={{ flex: 1, color: colors.text, fontFamily: 'Inter-Medium', fontSize: 14, lineHeight: 20 }}>Unchecking a task after earning a streak does NOT remove your streak for that day!</Text>
                            </View>
                        </View>

                        <TouchableOpacity 
                            onPress={() => setShowStreakModal(false)}
                            activeOpacity={0.8}
                            style={{ backgroundColor: '#F59E0B', paddingVertical: 14, borderRadius: 16, alignItems: 'center' }}
                        >
                            <Text style={{ color: '#FFFFFF', fontFamily: 'Inter-Bold', fontSize: 16 }}>Got It!</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Rank Ladder Modal */}
            <Modal visible={showRankModal} transparent animationType="slide">
                <View style={styles.modalOverlay}>
                    <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={() => setShowRankModal(false)} />
                    <View style={[styles.modalContent, { backgroundColor: colors.card, height: '85%', paddingBottom: 0 }]}>
                        <View style={[styles.modalHeader, { paddingHorizontal: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                            <View>
                                <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'Inter-Black', fontSize: 22 }]}>Ranking Ladder</Text>
                                <Text style={{ color: colors.subtext, fontFamily: 'Inter-Medium', fontSize: 13, marginTop: 4 }}>Earn XP to unlock competitive tiers.</Text>
                            </View>
                            <TouchableOpacity onPress={() => setShowRankModal(false)} style={{ backgroundColor: colors.background, padding: 8, borderRadius: 20 }}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 24, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
                            {RANKS_LADDER.map((rank, index) => {
                                const isCurrentRank = user?.xp >= rank.xpRequired && (index === RANKS_LADDER.length - 1 || user?.xp < RANKS_LADDER[index + 1].xpRequired);
                                const isUnlocked = user?.xp >= rank.xpRequired;
                                
                                return (
                                    <View key={rank.name} style={{ flexDirection: 'row', marginBottom: index === RANKS_LADDER.length - 1 ? 0 : 16 }}>
                                        {/* Ladder Path & Icon */}
                                        <View style={{ alignItems: 'center', marginRight: 16 }}>
                                            <LinearGradient 
                                                colors={isUnlocked ? rank.colors : [colors.border, colors.border]} 
                                                style={{ width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', opacity: isUnlocked ? 1 : 0.3 }}
                                            >
                                                {rank.type === 'ionicon' ? (
                                                    <Ionicons name={rank.icon} size={26} color={isUnlocked ? "#FFF" : colors.text} />
                                                ) : (
                                                    <MaterialCommunityIcons name={rank.icon} size={26} color={isUnlocked ? "#FFF" : colors.text} />
                                                )}
                                            </LinearGradient>
                                            {index !== RANKS_LADDER.length - 1 && (
                                                <View style={{ width: 3, flex: 1, backgroundColor: isUnlocked ? rank.colors[1] : colors.border, opacity: isUnlocked ? 0.6 : 0.2, marginTop: 4 }} />
                                            )}
                                        </View>
                                        
                                        {/* Rank Details Box */}
                                        <View style={[
                                            { 
                                                flex: 1, 
                                                padding: 16, 
                                                borderRadius: 20, 
                                                borderWidth: 1, 
                                                borderColor: isCurrentRank ? rank.colors[0] : 'transparent', 
                                                backgroundColor: isUnlocked ? colors.background : 'transparent',
                                                overflow: 'hidden',
                                                justifyContent: 'center'
                                            }, 
                                            isCurrentRank && { 
                                                shadowColor: rank.colors[0], 
                                                shadowOffset: { width: 0, height: 4 }, 
                                                shadowOpacity: 0.2, 
                                                shadowRadius: 8, 
                                                elevation: 4 
                                            }
                                        ]}>
                                            {isCurrentRank && (
                                                <View style={[
                                                    StyleSheet.absoluteFillObject, 
                                                    { 
                                                        backgroundColor: rank.colors[0] + '15',
                                                        borderRadius: 20
                                                    }
                                                ]} />
                                            )}
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
                                                <View>
                                                    <Text style={{ fontSize: 18, fontFamily: 'Inter-Black', color: isUnlocked ? colors.text : colors.subtext, letterSpacing: 0.5 }}>{rank.name}</Text>
                                                    <Text style={{ fontSize: 13, fontFamily: 'Inter-Bold', color: isUnlocked ? colors.primary : colors.subtext, marginTop: 4 }}>
                                                        {rank.xpRequired} XP {index === RANKS_LADDER.length - 1 ? '+' : `- ${RANKS_LADDER[index + 1].xpRequired - 1}`}
                                                    </Text>
                                                </View>
                                                
                                                {isCurrentRank && (
                                                    <View style={{ backgroundColor: rank.colors[0], paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 }}>
                                                        <Text style={{ color: '#FFF', fontSize: 10, fontFamily: 'Inter-Black', textTransform: 'uppercase', letterSpacing: 1 }}>Current</Text>
                                                    </View>
                                                )}
                                                
                                                {!isUnlocked && (
                                                    <Ionicons name="lock-closed" size={18} color={colors.subtext} style={{ opacity: 0.5 }} />
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* Foreground In-App Notification Toast */}
            {toastData && (
                <Animated.View style={{
                    position: 'absolute',
                    top: 0,
                    left: 16,
                    right: 16,
                    transform: [{ translateY: toastAnim }],
                    zIndex: 9999,
                    backgroundColor: isDarkMode ? '#1E293B' : '#FFFFFF',
                    borderRadius: 16,
                    padding: 16,
                    flexDirection: 'row',
                    alignItems: 'center',
                    shadowColor: colors.primary,
                    shadowOffset: { width: 0, height: 8 },
                    shadowOpacity: 0.3,
                    shadowRadius: 12,
                    elevation: 10,
                    borderWidth: 1,
                    borderColor: colors.primary + '40'
                }}>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: colors.primary + '20', justifyContent: 'center', alignItems: 'center', marginRight: 12 }}>
                        <Ionicons name="notifications" size={24} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontFamily: 'Inter-Bold', color: colors.text }}>{toastData.title || "New Notification"}</Text>
                        <Text style={{ fontSize: 13, fontFamily: 'Inter-Medium', color: colors.subtext, marginTop: 2 }}>{toastData.body}</Text>
                    </View>
                    <TouchableOpacity onPress={() => {
                        Animated.timing(toastAnim, { toValue: -150, duration: 200, useNativeDriver: true }).start(() => setToastData(null));
                    }}>
                        <Ionicons name="close" size={20} color={colors.subtext} />
                    </TouchableOpacity>
                </Animated.View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 24 },
    topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 15 },
    menuBtn: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    classBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
    header: { marginBottom: 24, marginTop: 24 },
    headerTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    greeting: { fontSize: 24, color: '#111827' },
    subtitle: { fontSize: 14, color: '#6B7280', marginTop: 4, maxWidth: '80%' },
    streakBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, gap: 4 },
    streakText: { fontSize: 16 },
    gamifyRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20, padding: 16, borderRadius: 20, borderWidth: 1, gap: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 2 },
    levelBadge: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(79, 70, 229, 0.1)', padding: 10, borderRadius: 16, minWidth: 55 },
    levelLabel: { fontSize: 10, textTransform: 'uppercase', letterSpacing: 1 },
    levelValue: { fontSize: 22, marginTop: -2 },
    progressCard: { padding: 24, borderRadius: 32, borderWidth: 1, marginTop: 12 },
    multiRingContainer: { flexDirection: 'row', alignItems: 'center' },
    ringsWrapper: { width: 140, height: 140, justifyContent: 'center', alignItems: 'center' },
    centerTextContainer: { alignItems: 'center' },
    overallPercent: { fontSize: 22, fontFamily: 'Inter-Black' },
    overallLabel: { fontSize: 8, fontFamily: 'Inter-Bold', opacity: 0.5, marginTop: -4 },
    legendContainer: { flex: 1, marginLeft: 24, gap: 16 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    legendDot: { width: 10, height: 10, borderRadius: 5 },
    legendTitle: { fontSize: 14, fontFamily: 'Inter-Bold' },
    legendValue: { fontSize: 12, fontFamily: 'Inter-Medium' },
    xpContainer: { flex: 1 },
    xpTextRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 8 },
    xpLabel: { fontSize: 13 },
    xpValue: { fontSize: 11 },
    xpBarBg: { height: 6, borderRadius: 3, width: '100%', overflow: 'hidden' },
    xpBarFill: { height: '100%', borderRadius: 3 },
    grid: { flexDirection: 'column', gap: 16 },
    row: { flexDirection: 'row', gap: 12 },
    // Main Card
    mainCard: { padding: 24, borderRadius: 32, shadowColor: "#4F46E5", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 8 },
    mainCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    mainCardText: { flex: 1, marginRight: 16 },
    mainCardTitle: { fontSize: 22, color: '#FFFFFF', letterSpacing: -0.5 },
    mainCardSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.85)', marginTop: 8, lineHeight: 20 },
    mainCardIcon: { width: 56, height: 56, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    mainCardFooter: { flexDirection: 'row', alignItems: 'center', marginTop: 24, backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 14 },
    footerText: { color: '#FFFFFF', fontSize: 14, marginRight: 8 },
    // Sub Card
    subCardContainer: { flex: 1 },
    subCard: { padding: 20, borderRadius: 28, minHeight: 140, justifyContent: 'space-between', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 5 },
    iconCircle: { width: 44, height: 44, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.25)', justifyContent: 'center', alignItems: 'center', marginBottom: 12, position: 'relative' },
    unreadBadge: { position: 'absolute', top: -5, right: -5, backgroundColor: '#FFFFFF', borderRadius: 10, minWidth: 20, height: 20, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: '#0EA5E9' },
    unreadText: { color: '#0EA5E9', fontSize: 10, fontFamily: 'Inter-ExtraBold' },
    subCardTitle: { fontSize: 18, color: '#FFFFFF' },
    subCardSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 },
    // Stats Card
    statsCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderRadius: 24, marginTop: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2, borderWidth: 1 },
    statsInfo: { flex: 1 },
    statsTitle: { fontSize: 16 },
    statsSubtitle: { fontSize: 12, marginTop: 2 },
    statsBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16 },
    onlineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
    statsCount: { fontSize: 18 },
    activeLabel: { fontSize: 11, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { width: '100%', padding: 24, borderRadius: 32, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    modalTitle: { fontSize: 22 },
    classOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 18, borderBottomWidth: 1 },
    optionLeft: { flexDirection: 'row', alignItems: 'center' },
    optionDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
    classOptionText: { fontSize: 17 },
    emptyState: { padding: 40, alignItems: 'center' },
    studentItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, gap: 12 },
    avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', position: 'relative' },
    activeStatusDot: { width: 12, height: 12, borderRadius: 6, position: 'absolute', bottom: 0, right: 0, borderWidth: 2, borderColor: '#FFF' },
    studentName: { fontSize: 16 },
    onlinePulse: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
    // Progress Card
    progressCard: { padding: 20, borderRadius: 24, marginTop: 8, borderWidth: 1, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 10, elevation: 2 },
    progressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
    progressTitle: { fontSize: 16 },
    progressPercent: { fontSize: 18 },
    progressBarBg: { height: 8, borderRadius: 4, width: '100%', marginBottom: 16, overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 4 },
    statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
    statItem: { alignItems: 'center' },
    statValue: { fontSize: 16 },
    statLabel: { fontSize: 11, marginTop: 2 },
    statDivider: { width: 1, height: 30 }
});

export default StudentDashboard;
