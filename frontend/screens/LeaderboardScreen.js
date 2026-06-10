import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, Image, TouchableOpacity, Platform, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { getLeaderboard, getMe, API_URL } from '../api/api';
import { useTheme } from '../context/ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import { RankBadge, getRankInfo } from '../components/RankBadge';

const { width } = Dimensions.get('window');

const LeaderboardScreen = ({ navigation }) => {
    const [loading, setLoading] = useState(true);
    const [students, setStudents] = useState([]);
    const [myRank, setMyRank] = useState(0);
    const [currentUser, setCurrentUser] = useState(null);
    const [classes, setClasses] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState(null);
    const [hasAnyXp, setHasAnyXp] = useState(false);
    const { colors, isDarkMode } = useTheme();

    // Use a fixed dark theme for the gamified feel, or adapt to the current theme
    const themeBg = isDarkMode ? ['#0F172A', '#020617'] : ['#4F46E5', '#312E81'];
    const cardBg = isDarkMode ? 'rgba(30, 41, 59, 0.7)' : 'rgba(255, 255, 255, 0.15)';
    const textColor = '#FFFFFF';
    const subtextColor = 'rgba(255, 255, 255, 0.7)';

    useEffect(() => {
        const init = async () => {
            try {
                const meRes = await getMe();
                const user = meRes.data;
                setCurrentUser(user);
                
                let targetClassId = null;
                
                if (user.role === 'student' && user.class_groups && user.class_groups.length > 0) {
                    setClasses(user.class_groups);
                    const savedId = await AsyncStorage.getItem('leaderboardClassId');
                    if (savedId && user.class_groups.some(cg => cg.id.toString() === savedId)) {
                        targetClassId = savedId;
                    } else {
                        targetClassId = user.class_groups[0].id;
                        await AsyncStorage.setItem('leaderboardClassId', targetClassId.toString());
                    }
                    setSelectedClassId(targetClassId);
                } else {
                    const savedId = await AsyncStorage.getItem('selectedClassGroupId');
                    if (savedId) {
                        targetClassId = savedId;
                        setSelectedClassId(savedId);
                    }
                }
                
                fetchLeaderboard(targetClassId);
            } catch (err) {
                console.log(err);
                setLoading(false);
            }
        };
        init();
    }, []);

    const fetchLeaderboard = async (classId) => {
        setLoading(true);
        try {
            const res = await getLeaderboard(classId);
            setStudents(res.data.leaderboard);
            setMyRank(res.data.my_rank);
            setHasAnyXp(res.data.has_any_xp);
        } catch (err) {
            console.log(err);
        } finally {
            setLoading(false);
        }
    };

    const handleClassSelect = async (classId) => {
        setSelectedClassId(classId);
        await AsyncStorage.setItem('leaderboardClassId', classId.toString());
        fetchLeaderboard(classId);
    };

    const PodiumItem = ({ student, rank }) => {
        if (!student) return <View style={styles.podiumPlaceholder} />;

        const isFirst = rank === 1;
        const height = isFirst ? 140 : rank === 2 ? 110 : 90;
        const size = isFirst ? 80 : 60;
        const colors = isFirst ? ['#FBBF24', '#D97706'] : rank === 2 ? ['#94A3B8', '#64748B'] : ['#B45309', '#78350F'];
        const medalIcon = isFirst ? 'trophy' : 'medal';

        return (
            <View style={styles.podiumWrapper}>
                <View style={[styles.podiumAvatarContainer, { width: size, height: size, borderRadius: size/2, borderColor: colors[0] }]}>
                    {student.avatar_url ? (
                        <Image source={{ uri: `${student.avatar_url?.startsWith('http') ? student.avatar_url : `\${API_URL}\${student.avatar_url}`}` }} style={styles.avatarFull} />
                    ) : (
                        <Text style={[styles.avatarTextLarge, { fontSize: size/2.5 }]}>{student.name.charAt(0).toUpperCase()}</Text>
                    )}
                    <View style={[styles.podiumBadge, { backgroundColor: colors[0] }]}>
                        <Text style={styles.podiumBadgeText}>{rank}</Text>
                    </View>
                </View>
                
                <Text style={styles.podiumName} numberOfLines={1}>{student.name.split(' ')[0]}</Text>
                <Text style={styles.podiumXp}>{student.xp} XP</Text>
                
                <LinearGradient colors={colors} style={[styles.podiumBar, { height }]}>
                    <View style={{ opacity: 0.85, marginTop: 12, alignItems: 'center' }}>
                        <Text style={{ color: '#FFF', fontSize: isFirst ? 28 : 22, fontFamily: 'Inter-Black', marginBottom: -4, textShadowColor: 'rgba(0,0,0,0.2)', textShadowOffset: {width: 0, height: 1}, textShadowRadius: 2 }}>
                            {rank}
                        </Text>
                        <Text style={{ color: '#FFF', fontSize: isFirst ? 14 : 11, fontFamily: 'Inter-Bold', textTransform: 'uppercase', letterSpacing: 1 }}>
                            {rank === 1 ? 'st' : rank === 2 ? 'nd' : 'rd'}
                        </Text>
                    </View>
                </LinearGradient>
            </View>
        );
    };

    const renderItem = ({ item, index }) => {
        // Skip top 3 if they exist as they are in the podium
        if (hasAnyXp && index < 3) return null;

        const isMe = item.id === currentUser?.id;

        return (
            <View style={[
                styles.listItem, 
                { backgroundColor: cardBg },
                isMe && { borderColor: '#FBBF24', borderWidth: 1 }
            ]}>
                {hasAnyXp && (
                    <View style={styles.listRankBadge}>
                        <Text style={styles.listRankText}>{index + 1}</Text>
                    </View>
                )}
                
                <View style={[styles.listAvatar, !hasAnyXp && { marginLeft: 0 }]}>
                    {item.avatar_url ? (
                        <Image source={{ uri: `${item.avatar_url?.startsWith('http') ? item.avatar_url : `\${API_URL}\${item.avatar_url}`}` }} style={styles.avatarFull} />
                    ) : (
                        <Text style={styles.avatarTextSmall}>{item.name.charAt(0).toUpperCase()}</Text>
                    )}
                </View>

                <View style={styles.listInfo}>
                    <Text style={styles.listName} numberOfLines={1}>
                        {item.name} {isMe && <Text style={{color: '#FBBF24'}}>(You)</Text>}
                    </Text>
                    <View style={{ marginTop: 4, alignSelf: 'flex-start' }}>
                        <RankBadge xp={item.xp} size="small" />
                    </View>
                </View>

                <View style={styles.listXpContainer}>
                    <Text style={styles.listXpText}>{item.xp}</Text>
                    <Text style={styles.listXpLabel}>XP</Text>
                </View>
            </View>
        );
    };

    const renderHeader = () => {
        if (!hasAnyXp || students.length === 0) return null;
        return (
            <View style={styles.podiumSection}>
                <PodiumItem student={students[1]} rank={2} />
                <PodiumItem student={students[0]} rank={1} />
                <PodiumItem student={students[2]} rank={3} />
            </View>
        );
    };

    const EmptyState = () => (
        <View style={styles.emptyContainer}>
            <Ionicons name="game-controller-outline" size={64} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyTitle}>The Arena is Empty</Text>
            <Text style={styles.emptySubtitle}>
                No XP earned in this class yet. Complete notes and DPPs to dominate the leaderboard!
            </Text>
        </View>
    );

    return (
        <LinearGradient colors={themeBg} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <Ionicons name="chevron-back" size={28} color={textColor} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Leaderboard</Text>
                    <View style={{ width: 44 }} />
                </View>



                {/* Main Content */}
                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#FBBF24" />
                    </View>
                ) : (
                    <View style={{ flex: 1 }}>
                        <FlatList
                            data={students}
                            renderItem={renderItem}
                            keyExtractor={item => item.id.toString()}
                            contentContainerStyle={styles.list}
                            showsVerticalScrollIndicator={false}
                            ListHeaderComponent={renderHeader}
                            ListEmptyComponent={<EmptyState />}
                        />
                        
                        {/* Floating 'My Rank' Footer */}
                        {currentUser?.role === 'student' && (
                            <View style={styles.myRankCardWrapper}>
                                <LinearGradient colors={['rgba(30, 41, 59, 0.95)', 'rgba(15, 23, 42, 0.95)']} style={styles.myRankCard}>
                                    <View style={[styles.myRankInfo, { flex: 1.5, alignItems: 'flex-start' }]}>
                                        <Text style={styles.myRankLabel}>Your Tier</Text>
                                        <View style={{ marginTop: 4 }}>
                                            <RankBadge xp={students.find(s => s.id === currentUser.id)?.xp || 0} size="small" />
                                        </View>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.myRankInfo}>
                                        <Text style={styles.myRankLabel}>Class Rank</Text>
                                        <Text style={[styles.myRankValue, { color: '#FFF', fontSize: myRank > 0 ? 26 : 14 }]}>
                                            {myRank > 0 ? `#${myRank}` : 'Unranked'}
                                        </Text>
                                    </View>
                                    <View style={styles.divider} />
                                    <View style={styles.myRankInfo}>
                                        <Text style={styles.myRankLabel}>Class XP</Text>
                                        <Text style={styles.myRankValue}>
                                            {students.find(s => s.id === currentUser.id)?.xp || 0}
                                        </Text>
                                    </View>
                                </LinearGradient>
                            </View>
                        )}
                    </View>
                )}
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 10, paddingBottom: 16 },
    backBtn: { width: 44, height: 44, justifyContent: 'center', alignItems: 'flex-start' },
    headerTitle: { fontSize: 22, fontFamily: 'Inter-ExtraBold', color: '#FFF', textTransform: 'uppercase', letterSpacing: 1 },
    
    classSelectorContainer: { paddingBottom: 16 },
    classSelector: { paddingHorizontal: 16, gap: 10 },
    classPill: { paddingHorizontal: 20, paddingVertical: 10, borderRadius: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
    classPillActive: { backgroundColor: '#FBBF24', borderColor: '#FBBF24' },
    classPillInactive: { backgroundColor: 'rgba(255,255,255,0.1)' },
    classPillText: { fontSize: 14, fontFamily: 'Inter-SemiBold' },

    podiumSection: { flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', marginTop: 20, marginBottom: 30, paddingHorizontal: 10, height: 260 },
    podiumWrapper: { flex: 1, alignItems: 'center', marginHorizontal: 4 },
    podiumPlaceholder: { flex: 1, marginHorizontal: 4 },
    podiumAvatarContainer: { borderWidth: 3, backgroundColor: '#1E293B', justifyContent: 'center', alignItems: 'center', marginBottom: 8, zIndex: 10 },
    avatarFull: { width: '100%', height: '100%', borderRadius: 100 },
    avatarTextLarge: { color: '#FFF', fontFamily: 'Inter-Bold' },
    podiumBadge: { position: 'absolute', bottom: -8, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#0F172A' },
    podiumBadgeText: { color: '#FFF', fontSize: 12, fontFamily: 'Inter-ExtraBold' },
    podiumName: { color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 14, marginBottom: 2 },
    podiumXp: { color: 'rgba(255,255,255,0.8)', fontFamily: 'Inter-SemiBold', fontSize: 12, marginBottom: 12 },
    podiumBar: { width: '100%', borderTopLeftRadius: 16, borderTopRightRadius: 16, alignItems: 'center' },

    list: { paddingHorizontal: 16, paddingBottom: 130 },
    listItem: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, marginBottom: 10, overflow: 'hidden' },
    listRankBadge: { width: 30, alignItems: 'center' },
    listRankText: { color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 16 },
    listAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center', marginLeft: 10, marginRight: 14 },
    avatarTextSmall: { color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 18 },
    listInfo: { flex: 1 },
    listName: { color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 16, marginBottom: 2 },
    listLevel: { color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter-Medium', fontSize: 12 },
    listXpContainer: { alignItems: 'flex-end', marginLeft: 10 },
    listXpText: { color: '#FBBF24', fontFamily: 'Inter-ExtraBold', fontSize: 18 },
    listXpLabel: { color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter-Bold', fontSize: 10 },

    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    
    emptyContainer: { alignItems: 'center', marginTop: 80, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 22, fontFamily: 'Inter-ExtraBold', color: '#FFF', marginTop: 16, marginBottom: 8 },
    emptySubtitle: { fontSize: 15, fontFamily: 'Inter-Medium', color: 'rgba(255,255,255,0.6)', textAlign: 'center', lineHeight: 22 },

    myRankCardWrapper: { position: 'absolute', bottom: Platform.OS === 'ios' ? 20 : 10, left: 16, right: 16 },
    myRankCard: { flexDirection: 'row', borderRadius: 24, padding: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 10, justifyContent: 'space-around', alignItems: 'center' },
    myRankInfo: { alignItems: 'center', flex: 1 },
    myRankLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12, fontFamily: 'Inter-Bold', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 },
    myRankValue: { color: '#FBBF24', fontSize: 26, fontFamily: 'Inter-ExtraBold' },
    divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' }
});

export default LeaderboardScreen;
