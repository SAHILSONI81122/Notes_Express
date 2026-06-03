import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { getClassProgress } from '../api/api';
import * as Haptics from 'expo-haptics';

const ClassProgressScreen = ({ route, navigation }) => {
    const { classId, className } = route.params;
    const { isDarkMode, colors } = useTheme();
    const [progressData, setProgressData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchProgress();
    }, [classId]);

    const fetchProgress = async () => {
        setLoading(true);
        try {
            const res = await getClassProgress(classId);
            setProgressData(res.data);
        } catch (error) {
            console.log('Error fetching class progress:', error);
        } finally {
            setLoading(false);
        }
    };

    const renderStudent = ({ item, index }) => {
        const getInitials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';
        const colorPalette = ['#6366F1', '#EC4899', '#14B8A6', '#F59E0B', '#8B5CF6'];
        const avatarColor = colorPalette[index % colorPalette.length];

        return (
            <View style={[styles.studentCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <View style={styles.studentInfo}>
                    <View style={[styles.avatar, { backgroundColor: avatarColor + '20' }]}>
                        <Text style={[styles.avatarText, { color: avatarColor, fontFamily: 'Inter-Bold' }]}>
                            {getInitials(item.student_name)}
                        </Text>
                    </View>
                    <View style={styles.nameContainer}>
                        <Text style={[styles.studentName, { color: colors.text, fontFamily: 'Inter-SemiBold' }]} numberOfLines={1}>
                            {item.student_name}
                        </Text>
                        <Text style={[styles.studentStats, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                            Notes: {item.notes_completed}  •  DPPs: {item.dpps_solved}
                        </Text>
                    </View>
                    <View style={[styles.percentBadge, { backgroundColor: item.progress_percentage >= 80 ? colors.success + '20' : (item.progress_percentage >= 40 ? '#F59E0B20' : colors.error + '20') }]}>
                        <Text style={[styles.percentText, { color: item.progress_percentage >= 80 ? colors.success : (item.progress_percentage >= 40 ? '#D97706' : colors.error), fontFamily: 'Inter-ExtraBold' }]}>
                            {item.progress_percentage}%
                        </Text>
                    </View>
                </View>
                <View style={[styles.progressBarBg, { backgroundColor: colors.border }]}>
                    <View style={[styles.progressBarFill, { 
                        backgroundColor: item.progress_percentage >= 80 ? colors.success : (item.progress_percentage >= 40 ? '#F59E0B' : colors.error),
                        width: `${item.progress_percentage}%` 
                    }]} />
                </View>
            </View>
        );
    };

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
            <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.backBtn, { backgroundColor: isDarkMode ? '#334155' : '#F1F5F9' }]}>
                    <Ionicons name="chevron-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-Bold' }]} numberOfLines={1}>
                        Student Progress
                    </Text>
                    <Text style={[styles.subtitle, { color: colors.primary, fontFamily: 'Inter-Medium' }]}>
                        {className}
                    </Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : progressData.length === 0 ? (
                <View style={styles.centerState}>
                    <Ionicons name="people-outline" size={60} color={colors.subtext} style={{ marginBottom: 15 }} />
                    <Text style={[styles.emptyText, { color: colors.text, fontFamily: 'Inter-SemiBold' }]}>No Students Found</Text>
                    <Text style={[styles.emptySub, { color: colors.subtext, fontFamily: 'Inter-Regular' }]}>There are no students in this class yet.</Text>
                </View>
            ) : (
                <FlatList
                    data={progressData}
                    keyExtractor={item => item.student_id.toString()}
                    renderItem={renderStudent}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingVertical: 14,
        borderBottomWidth: 1,
    },
    backBtn: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    headerInfo: { flex: 1 },
    title: { fontSize: 20 },
    subtitle: { fontSize: 13, marginTop: 2 },
    listContent: { padding: 16, paddingBottom: 40 },
    studentCard: {
        padding: 16, borderRadius: 16, marginBottom: 12,
        borderWidth: 1,
    },
    studentInfo: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
    avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
    avatarText: { fontSize: 16 },
    nameContainer: { flex: 1 },
    studentName: { fontSize: 16, marginBottom: 4 },
    studentStats: { fontSize: 12 },
    percentBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10, marginLeft: 10 },
    percentText: { fontSize: 14 },
    progressBarBg: { height: 6, borderRadius: 3, width: '100%', overflow: 'hidden' },
    progressBarFill: { height: '100%', borderRadius: 3 },
    centerState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    emptyText: { fontSize: 18, marginBottom: 8 },
    emptySub: { fontSize: 14, textAlign: 'center' },
});

export default ClassProgressScreen;
