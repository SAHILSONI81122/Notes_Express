import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, Alert, Animated, Dimensions, Platform, FlatList, Image } from 'react-native';
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { getDpps, getMe, getFolders, createFolder, uploadFile, createDpp, uploadImagesToPdf, uploadImagesOcr, parseImagesOcr, API_URL, sendHeartbeat, toggleDppComplete, getCompletionStatus, deleteFolder, deleteDPP, submitDpp, getDppAnalytics, getStudentProgress, renameDPP, updateDppQuestions } from '../api/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import { isOnline, queueOfflineSubmission } from '../utils/offlineManager';
import * as ScreenCapture from 'expo-screen-capture';

const AnimatedProgressBar = ({ progress, color, height = 4 }) => {
    const animatedWidth = useRef(new Animated.Value(0)).current;
    const shineAnim = useRef(new Animated.Value(-100)).current;
    
    useEffect(() => {
        Animated.spring(animatedWidth, {
            toValue: progress,
            useNativeDriver: false,
            bounciness: 4,
            speed: 10
        }).start();

        Animated.loop(
            Animated.timing(shineAnim, {
                toValue: 300,
                duration: 2500,
                useNativeDriver: true,
            })
        ).start();
    }, [progress]);

    return (
        <View style={{ height, width: '100%', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: height / 2, overflow: 'hidden' }}>
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
                    shadowOpacity: 0.5,
                    shadowRadius: 5,
                }} 
            />
            <Animated.View style={[StyleSheet.absoluteFill, { width: '40%', transform: [{ translateX: shineAnim }] }]}>
                <LinearGradient
                    colors={['transparent', 'rgba(255,255,255,0.3)', 'transparent']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={{ flex: 1 }}
                />
            </Animated.View>
        </View>
    );
};

const AnimatedListItem = ({ index, children }) => {
    const slideAnim = useRef(new Animated.Value(20)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    React.useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, { toValue: 1, duration: 400, delay: index * 60, useNativeDriver: true }),
            Animated.timing(slideAnim, { toValue: 0, duration: 400, delay: index * 60, useNativeDriver: true })
        ]).start();
    }, []);

    return (
        <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            {children}
        </Animated.View>
    );
};

const DPPScreen = ({ navigation, route }) => {
    const insets = useSafeAreaInsets();
    const folder = route.params?.folder;
    const [dpps, setDpps] = useState([]);
    const [folders, setFolders] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const { isDarkMode } = useTheme();

    const [selectedClassId, setSelectedClassId] = useState(null);
    const [completedDppIds, setCompletedDppIds] = useState(new Set());
    const [dppXp, setDppXp] = useState(0);
    const [progressData, setProgressData] = useState(null);
    const [togglingId, setTogglingId] = useState(null);
    const [showVictory, setShowVictory] = useState(false);
    const [sessionXP, setSessionXP] = useState(0);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadModalVisible, setUploadModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState(null);
    const [deleteDppModalVisible, setDeleteDppModalVisible] = useState(false);
    const [dppToDelete, setDppToDelete] = useState(null);
    const [dppOptionsModalVisible, setDppOptionsModalVisible] = useState(false);
    const [selectedDppForOptions, setSelectedDppForOptions] = useState(null);
    const [renameDppModalVisible, setRenameDppModalVisible] = useState(false);
    const [renameDppName, setRenameDppName] = useState('');
    const [recentDpps, setRecentDpps] = useState([]);
    const [timeLeft, setTimeLeft] = useState('');
    const victoryAnim = useRef(new Animated.Value(0)).current;

    // Naming modal states
    const [namingModalVisible, setNamingModalVisible] = useState(false);
    const [pendingName, setPendingName] = useState('');
    const [pendingQuestions, setPendingQuestions] = useState('10');
    const [pendingAsset, setPendingAsset] = useState(null);
    const [pendingAssets, setPendingAssets] = useState(null);
    const [isImagesNaming, setIsImagesNaming] = useState(false);
    const [isOCRMode, setIsOCRMode] = useState(false);

    // Interactive DPP / OCR Review states
    const [parsedQuestions, setParsedQuestions] = useState([]);
    const [editQuestionsModalVisible, setEditQuestionsModalVisible] = useState(false);
    const [publishTitle, setPublishTitle] = useState('');
    const [editingDppId, setEditingDppId] = useState(null);
    
    // Student interactive Quiz states
    const [activeQuizDpp, setActiveQuizDpp] = useState(null);
    const [quizCurrentIndex, setQuizCurrentIndex] = useState(0);
    const [quizSelectedOption, setQuizSelectedOption] = useState(null);
    const [quizOptionCorrectness, setQuizOptionCorrectness] = useState(null); // 'correct' or 'wrong'
    const [quizCorrectAnswerRevealed, setQuizCorrectAnswerRevealed] = useState(false);
    const [quizCompleted, setQuizCompleted] = useState(false);
    const [studentQuizModalVisible, setStudentQuizModalVisible] = useState(false);
    const [savedDppTimes, setSavedDppTimes] = useState({});
    const [quizTime, setQuizTime] = useState(0);
    const [quizCorrectCount, setQuizCorrectCount] = useState(0);

    // Teacher Analytics states
    const [teacherAnalyticsModalVisible, setTeacherAnalyticsModalVisible] = useState(false);
    const [selectedDppAnalytics, setSelectedDppAnalytics] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);

    const formatTime = (seconds) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    const formatDuration = (seconds) => {
        if (!seconds) return '0s';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        if (mins > 0) {
            return `${mins}m ${secs}s`;
        }
        return `${secs}s`;
    };

    // Daily countdown timer
    useEffect(() => {
        const tick = () => {
            const now = new Date();
            const midnight = new Date(); midnight.setHours(24,0,0,0);
            const diff = midnight - now;
            const h = Math.floor(diff / 3600000);
            const m = Math.floor((diff % 3600000) / 60000);
            setTimeLeft(`${h}h ${m}m`);
        };
        tick();
        const t = setInterval(tick, 60000);
        return () => clearInterval(t);
    }, []);

    useEffect(() => {
        let interval = null;
        if (studentQuizModalVisible && !quizCompleted) {
            interval = setInterval(() => {
                setQuizTime(prev => prev + 1);
            }, 1000);
        } else {
            if (interval) {
                clearInterval(interval);
            }
        }
        return () => {
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [studentQuizModalVisible, quizCompleted]);

    const loadSavedDppTimes = async (dppList, recentList = []) => {
        const times = {};
        const allDpps = [...dppList, ...recentList];
        for (const dpp of allDpps) {
            try {
                const t = await AsyncStorage.getItem('dpp_time_spent_' + dpp.id);
                if (t !== null) {
                    times[dpp.id] = parseInt(t, 10);
                }
            } catch (e) {
                console.log("Error loading DPP time:", e);
            }
        }
        setSavedDppTimes(times);
    };



    const hasStreakBonus = (user?.streak_count || 0) > 0 && (user?.streak_count || 0) % 6 === 0;

    // Premium Arena Gamification Colors
    const bgGradient = isDarkMode ? ['#0E0608', '#1C0D11', '#080304'] : ['#F8FAFC', '#F1F5F9', '#F8FAFC'];
    const themeText = isDarkMode ? '#FFF' : '#0F172A';
    const themeSubtext = isDarkMode ? 'rgba(255, 255, 255, 0.45)' : '#64748B';
    const themeCardBg = isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF';
    const themeCardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
    const themeIconBtnBg = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9';
    const themeIconColor = isDarkMode ? '#FFF' : '#475569';
    const glassBg = 'rgba(255, 255, 255, 0.05)';
    const glassBorder = 'rgba(255, 255, 255, 0.08)';

    // Dynamic Modal Overlay & Dialog Colors
    const modalBgGradient = isDarkMode ? ['#1E293B', '#0F172A'] : ['#FFFFFF', '#F8FAFC'];
    const modalOverlayBg = isDarkMode ? 'rgba(0, 0, 0, 0.75)' : 'rgba(15, 23, 42, 0.3)';
    const modalBorder = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
    const modalTitleText = isDarkMode ? '#FFFFFF' : '#0F172A';
    const modalInputBg = isDarkMode ? 'rgba(0, 0, 0, 0.2)' : '#F1F5F9';
    const modalInputBorder = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0';
    const modalInputText = isDarkMode ? '#FFFFFF' : '#0F172A';
    const modalInputPlaceholder = isDarkMode ? 'rgba(255, 255, 255, 0.4)' : '#94A3B8';
    const modalCancelBg = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9';
    const modalCancelBorder = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#E2E8F0';
    const modalCancelTextVal = isDarkMode ? '#FFFFFF' : '#475569';
    const actionRowBg = isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#F8FAFC';
    const actionRowBorder = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0';
    const actionRowTextVal = isDarkMode ? '#FFFFFF' : '#0F172A';
    const actionRowSubTextVal = isDarkMode ? 'rgba(255, 255, 255, 0.4)' : '#64748B';
    const actionRowChevronColor = isDarkMode ? 'rgba(255, 255, 255, 0.3)' : '#94A3B8';
    const deleteDescColor = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : '#334155';
    const deleteDescHighlight = isDarkMode ? '#FFFFFF' : '#0F172A';
    const deleteWarningBg = isDarkMode ? 'rgba(239, 68, 68, 0.08)' : '#FEF2F2';
    const deleteWarningBorder = isDarkMode ? 'rgba(239, 68, 68, 0.2)' : '#FCA5A5';
    const deleteWarningTextVal = isDarkMode ? '#FCA5A5' : '#B91C1C';
    const questionCardBg = isDarkMode ? 'rgba(255, 255, 255, 0.03)' : '#FFFFFF';
    const questionCardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.06)' : '#E2E8F0';
    const questionLabelText = isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#64748B';
    const questionTypeToggleBg = isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#F1F5F9';
    const questionTypeInactiveText = isDarkMode ? 'rgba(255, 255, 255, 0.6)' : '#64748B';
    const questionAddSlideBorder = isDarkMode ? 'rgba(255, 255, 255, 0.15)' : '#CBD5E1';
    const questionAddSlideText = isDarkMode ? 'rgba(255, 255, 255, 0.7)' : '#64748B';


    const fetchData = async (q = searchQuery) => {
        setLoading(true);
        try {
            const classIdStr = await AsyncStorage.getItem('selectedClassGroupId');
            const classId = classIdStr ? Number(classIdStr) : null;
            setSelectedClassId(classId);

            const online = await isOnline();
            if (!online) {
                const cacheKey = 'dpps_cache_' + (folder ? folder.id : 'root');
                const cachedData = await AsyncStorage.getItem(cacheKey);
                if (cachedData) {
                    const parsed = JSON.parse(cachedData);
                    setDpps(parsed.dpps || []);
                    setFolders(parsed.folders || []);
                    setCompletedDppIds(new Set(parsed.completed || []));
                    setDppXp(parsed.xp || 0);
                    if (!folder && parsed.progress) setProgressData(parsed.progress);
                    
                    const recentStr = await AsyncStorage.getItem('recent_dpps_v1') || '[]';
                    const recents = JSON.parse(recentStr);
                    const recs = recents.filter(d => Date.now() - d.openedAt < 24 * 60 * 60 * 1000);
                    setRecentDpps(recs);
                    
                    await loadSavedDppTimes(parsed.dpps || [], recs);
                } else {
                    Alert.alert("Offline", "No internet connection and no cached challenges available.");
                }
                setLoading(false);
                return;
            }

            const userRes = await getMe();
            setUser(userRes.data);
            const batchId = userRes.data.batch_id;
            
            if (batchId) {
                if ((userRes.data.role === 'admin' || userRes.data.role === 'teacher') && !classId) {
                    setDpps([]); setFolders([]); setLoading(false); return;
                }
                const queryClassId = (userRes.data.role === 'admin' || userRes.data.role === 'teacher') ? classId : null;
                const fetchArr = [
                    getDpps(batchId, queryClassId, folder?.id, q),
                    getFolders(batchId, queryClassId, folder?.id, q, 'dpp'),
                ];
                if (userRes.data.role === 'student') fetchArr.push(getCompletionStatus());
                if (userRes.data.role === 'student' && !folder) fetchArr.push(getStudentProgress());

                const results = await Promise.all(fetchArr);
                const fetchedDpps = results[0].data;
                const fetchedFolders = results[1].data;
                setDpps(fetchedDpps);
                setFolders(fetchedFolders);
                
                let completedArr = [];
                let xp = 0;
                if (userRes.data.role === 'student' && results[2]) {
                    completedArr = results[2].data.completed_dpp_ids || [];
                    xp = results[2].data.dpp_xp || 0;
                    setCompletedDppIds(new Set(completedArr));
                    setDppXp(xp);
                }
                
                let progress = null;
                if (userRes.data.role === 'student' && !folder && results[3]) {
                    progress = results[3].data;
                    setProgressData(progress);
                }

                const cacheKey = 'dpps_cache_' + (folder ? folder.id : 'root');
                await AsyncStorage.setItem(cacheKey, JSON.stringify({
                    dpps: fetchedDpps,
                    folders: fetchedFolders,
                    completed: completedArr,
                    xp: xp,
                    progress: progress
                }));

                let recs = [];
                if (!folder) {
                    const recentStr = await AsyncStorage.getItem('recent_dpps_v1') || '[]';
                    const recents = JSON.parse(recentStr);
                    // Build a set of all DPP IDs currently on the server (across all folders).
                    // This purges deleted DPPs from the recents list so they don't ghost-appear.
                    const allFetchedDppIds = new Set(fetchedDpps.map(d => d.id));
                    const cleanedRecents = recents.filter(d =>
                        Date.now() - d.openedAt < 24 * 60 * 60 * 1000 &&
                        allFetchedDppIds.has(d.id)
                    );
                    if (cleanedRecents.length !== recents.length) {
                        await AsyncStorage.setItem('recent_dpps_v1', JSON.stringify(cleanedRecents));
                    }
                    recs = cleanedRecents;
                    setRecentDpps(recs);
                }
                await loadSavedDppTimes(fetchedDpps, recs);
            }
        } catch (err) {
            console.log("Fetch Error:", err);
            Alert.alert("Network Error", "Could not fetch challenges. Try opening an offline folder.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!isSearching) return;
        const delayDebounceFn = setTimeout(() => { fetchData(searchQuery); }, 500);
        return () => clearTimeout(delayDebounceFn);
    }, [searchQuery]);

    useFocusEffect(
        useCallback(() => {
            fetchData('');
            const action = folder ? `Solving DPPs in ${folder.name}` : 'Browsing DPPs';
            sendHeartbeat(action).catch(console.log);
            const interval = setInterval(() => sendHeartbeat(action).catch(console.log), 1000);
            return () => clearInterval(interval);
        }, [folder])
    );

    useEffect(() => {
        if (studentQuizModalVisible) {
            ScreenCapture.preventScreenCaptureAsync().catch(console.log);
        } else {
            ScreenCapture.allowScreenCaptureAsync().catch(console.log);
        }
        return () => { ScreenCapture.allowScreenCaptureAsync().catch(console.log); };
    }, [studentQuizModalVisible]);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await createFolder({ name: newFolderName, batch_id: user.batch_id, class_group_id: selectedClassId, parent_id: folder?.id, folder_type: 'dpp' });
            setNewFolderName(''); setModalVisible(false); fetchData();
        } catch (error) { Alert.alert("Error", "Could not create folder"); }
    };

    const handleDeleteFolder = (folderItem) => {
        if (user?.role !== 'admin' && user?.role !== 'teacher') return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setFolderToDelete(folderItem);
        setDeleteModalVisible(true);
    };

    const confirmDeleteFolder = async () => {
        if (!folderToDelete) return;
        setDeleteModalVisible(false);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
                await deleteFolder(folderToDelete.id);
            } catch (apiErr) {
                if (apiErr.response?.status !== 404) {
                    throw apiErr;
                }
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Clean up DPPs belonging to deleted folder from recents
            const recentStr = await AsyncStorage.getItem('recent_dpps_v1') || '[]';
            let recents = JSON.parse(recentStr);
            recents = recents.filter(d => d.folder_id !== folderToDelete.id);
            await AsyncStorage.setItem('recent_dpps_v1', JSON.stringify(recents));
            if (!folder) {
                setRecentDpps(recents.filter(d => Date.now() - d.openedAt < 24 * 60 * 60 * 1000));
            }

            fetchData();
        } catch (err) {
            Alert.alert("Error", "Could not delete arena");
        } finally {
            setFolderToDelete(null);
        }
    };

    const handleDppOptionsPress = (dppItem) => {
        if (user?.role !== 'admin' && user?.role !== 'teacher') return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setSelectedDppForOptions(dppItem);
        setDppOptionsModalVisible(true);
    };

    const handleDeleteDppPress = () => {
        setDppOptionsModalVisible(false);
        setTimeout(() => {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            setDppToDelete(selectedDppForOptions);
            setDeleteDppModalVisible(true);
        }, 300);
    };

    const handleRenameDppPress = () => {
        setDppOptionsModalVisible(false);
        setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setRenameDppName(selectedDppForOptions.title);
            setRenameDppModalVisible(true);
        }, 300);
    };

    const confirmRenameDpp = async () => {
        if (!selectedDppForOptions || !renameDppName.trim()) {
            Alert.alert("Error", "Please enter a valid name");
            return;
        }
        setRenameDppModalVisible(false);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await renameDPP(selectedDppForOptions.id, renameDppName);
            
            // Clean up from recent DPPs (update name if present)
            const recentStr = await AsyncStorage.getItem('recent_dpps_v1') || '[]';
            let recents = JSON.parse(recentStr);
            recents = recents.map(d => {
                if (d.id === selectedDppForOptions.id) {
                    return { ...d, title: renameDppName };
                }
                return d;
            });
            await AsyncStorage.setItem('recent_dpps_v1', JSON.stringify(recents));
            
            fetchData();
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (err) {
            Alert.alert("Error", "Could not rename DPP");
        } finally {
            setSelectedDppForOptions(null);
            setRenameDppName('');
        }
    };

    const handleEditQuestionsPress = () => {
        setDppOptionsModalVisible(false);
        setTimeout(() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            
            // Map backend questions to frontend format if they exist
            const questions = selectedDppForOptions.questions || [];
            const mapped = questions.map((q, idx) => {
                let parsedOpts = ["Option A", "Option B", "Option C", "Option D"];
                if (q.options) {
                    try {
                        const arr = JSON.parse(q.options);
                        if (Array.isArray(arr) && arr.length === 4) {
                            parsedOpts = arr.map(opt => opt.replace(/^[A-D]:\s*/, ''));
                        }
                    } catch (e) {}
                }
                return {
                    id: String(idx) + '_' + Date.now(),
                    question_text: q.question_text || '',
                    question_type: q.question_type || 'subjective',
                    options: parsedOpts,
                    correct_option: q.correct_option || 'A'
                };
            });
            
            setParsedQuestions(mapped);
            setPublishTitle(selectedDppForOptions.title);
            setEditingDppId(selectedDppForOptions.id);
            setEditQuestionsModalVisible(true);
        }, 300);
    };

    const confirmDeleteDpp = async () => {
        if (!dppToDelete) return;
        setDeleteDppModalVisible(false);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            try {
                await deleteDPP(dppToDelete.id);
            } catch (apiErr) {
                if (apiErr.response?.status !== 404) {
                    throw apiErr;
                }
            }
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Clean up from recent DPPs
            const recentStr = await AsyncStorage.getItem('recent_dpps_v1') || '[]';
            let recents = JSON.parse(recentStr);
            recents = recents.filter(d => d.id !== dppToDelete.id);
            await AsyncStorage.setItem('recent_dpps_v1', JSON.stringify(recents));
            if (!folder) {
                setRecentDpps(recents.filter(d => Date.now() - d.openedAt < 24 * 60 * 60 * 1000));
            }

            fetchData();
        } catch (err) {
            Alert.alert("Error", "Could not delete DPP");
        } finally {
            setDppToDelete(null);
        }
    };

    const pickDocument = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
            if (!result.canceled) {
                const asset = result.assets[0];
                const fileName = asset.name || (asset.uri ? asset.uri.split('/').pop() : 'document.pdf');
                setPendingAsset(asset);
                setPendingName(fileName.replace('.pdf', ''));
                setPendingQuestions('10');
                setIsImagesNaming(false);
                setNamingModalVisible(true);
            }
        } catch (err) {
            console.log(err);
        }
    };

    const pickImages = async (isOCR = false) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission Denied', 'We need access to your photos to upload them.');
            return;
        }

        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsMultipleSelection: true,
            quality: 1,
        });

        if (!result.canceled) {
            setPendingAssets(result.assets);
            setPendingName(`${folder ? folder.name : 'Daily'} Challenge - ${new Date().toLocaleDateString()}`);
            setPendingQuestions('10');
            setIsImagesNaming(true);
            setIsOCRMode(isOCR);
            setNamingModalVisible(true);
        }
    };

    const handleNamingSubmit = () => {
        if (!pendingName.trim()) {
            Alert.alert("Error", "Please enter a name");
            return;
        }
        if (isImagesNaming) {
            if (isOCRMode) {
                uploadPickedImagesOCR(pendingAssets, pendingName.trim());
            } else {
                uploadPickedImages(pendingAssets, pendingName.trim());
            }
        } else {
            uploadPickedFile(pendingAsset, pendingName.trim());
        }
    };

    const uploadPickedFile = async (asset, customName) => {
        setIsUploading(true);
        setNamingModalVisible(false);
        try {
            const fileName = customName + '.pdf';
            const formData = new FormData();
            formData.append('file', {
                uri: asset.uri,
                name: fileName,
                type: 'application/pdf',
            });

            const uploadRes = await uploadFile(formData);
            await createDpp({
                title: customName,
                file_url: uploadRes.data.file_url,
                batch_id: user.batch_id,
                class_group_id: selectedClassId,
                folder_id: folder?.id || null
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchData();
        } catch (error) {
            console.log("Upload DPP Error:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const detailMsg = error.response?.data?.detail || error.message || "Failed to upload DPP";
            Alert.alert("Error", typeof detailMsg === 'string' ? detailMsg : JSON.stringify(detailMsg));
        } finally {
            setIsUploading(false);
        }
    };

    const uploadPickedImages = async (assets, customName) => {
        setIsUploading(true);
        setNamingModalVisible(false);
        try {
            const formData = new FormData();
            assets.forEach((asset, index) => {
                formData.append('files', {
                    uri: asset.uri,
                    name: `image_${index}.jpg`,
                    type: 'image/jpeg',
                });
            });

            const uploadRes = await uploadImagesToPdf(formData);
            await createDpp({
                title: customName,
                file_url: uploadRes.data.file_url,
                batch_id: user.batch_id,
                class_group_id: selectedClassId,
                folder_id: folder?.id || null
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchData();
        } catch (error) {
            console.log("Upload DPP Images Error:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const detailMsg = error.response?.data?.detail || error.message || "Failed to convert and upload images";
            Alert.alert("Error", typeof detailMsg === 'string' ? detailMsg : JSON.stringify(detailMsg));
        } finally {
            setIsUploading(false);
        }
    };

    const uploadPickedImagesOCR = async (assets, customName, totalQuestions = 10) => {
        setIsUploading(true);
        setNamingModalVisible(false);
        try {
            const formData = new FormData();
            assets.forEach((asset, index) => {
                formData.append('files', {
                    uri: asset.uri,
                    name: `image_${index}.jpg`,
                    type: 'image/jpeg',
                });
            });

            const uploadRes = await parseImagesOcr(formData);
            
            // The response contains an array of parsed questions
            const items = (uploadRes.data || []).map((q, idx) => {
                let parsedOpts = ["Option A", "Option B", "Option C", "Option D"];
                if (q.options) {
                    try {
                        const parsed = JSON.parse(q.options);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            parsedOpts = parsed.map(o => o.replace(/^[A-D]\s*[:\.\)]\s*/i, ''));
                        }
                    } catch (e) {
                        // Keep defaults
                    }
                }
                return {
                    id: String(idx) + '_' + Date.now(),
                    question_text: q.question_text || '',
                    question_type: q.question_type || 'subjective',
                    options: parsedOpts,
                    correct_option: q.correct_option || 'A'
                };
            });
            
            setParsedQuestions(items);
            setPublishTitle(customName);
            setEditQuestionsModalVisible(true);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
            console.log("Upload DPP Images OCR Error:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const detailMsg = error.response?.data?.detail || error.message || "Failed to OCR and parse images";
            Alert.alert("Error", typeof detailMsg === 'string' ? detailMsg : JSON.stringify(detailMsg));
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddQuestion = () => {
        setParsedQuestions(prev => [
            ...prev,
            {
                id: String(Date.now()) + '_' + Math.random(),
                question_text: '',
                question_type: 'subjective',
                options: ["Option A", "Option B", "Option C", "Option D"],
                correct_option: 'A'
            }
        ]);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleUpdateQuestionText = (index, val) => {
        setParsedQuestions(prev => prev.map((q, idx) => idx === index ? { ...q, question_text: val } : q));
    };

    const handleUpdateQuestionType = (index, type) => {
        setParsedQuestions(prev => prev.map((q, idx) => idx === index ? { ...q, question_type: type } : q));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleUpdateQuestionOption = (index, optIdx, val) => {
        setParsedQuestions(prev => prev.map((q, idx) => {
            if (idx === index) {
                const newOpts = [...q.options];
                newOpts[optIdx] = val;
                return { ...q, options: newOpts };
            }
            return q;
        }));
    };

    const handleUpdateCorrectOption = (index, letter) => {
        setParsedQuestions(prev => prev.map((q, idx) => idx === index ? { ...q, correct_option: letter } : q));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    };

    const handleRemoveQuestion = (index) => {
        setParsedQuestions(prev => prev.filter((_, idx) => idx !== index));
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    };

    const handlePublishParsedDpp = async () => {
        if (!publishTitle.trim()) {
            Alert.alert("Title Required", "Please enter a challenge name.");
            return;
        }
        if (parsedQuestions.length === 0) {
            Alert.alert("No Questions", "Please add at least one question.");
            return;
        }
        
        for (let i = 0; i < parsedQuestions.length; i++) {
            if (!parsedQuestions[i].question_text.trim()) {
                Alert.alert("Incomplete Question", `Question #${i + 1} has no text.`);
                return;
            }
        }
        
        setIsUploading(true);
        setEditQuestionsModalVisible(false);
        
        try {
            const backendQuestions = parsedQuestions.map(q => {
                let opts = null;
                if (q.question_type === 'mcq') {
                    const prefixes = ['A', 'B', 'C', 'D'];
                    const mappedOpts = q.options.map((opt, oIdx) => `${prefixes[oIdx]}: ${opt}`);
                    opts = JSON.stringify(mappedOpts);
                }
                return {
                    question_text: q.question_text.trim(),
                    question_type: q.question_type,
                    options: opts,
                    correct_option: q.question_type === 'mcq' ? q.correct_option : null
                };
            });
            
            if (editingDppId) {
                await updateDppQuestions(editingDppId, backendQuestions);
                if (publishTitle.trim() !== selectedDppForOptions?.title) {
                    await renameDPP(editingDppId, publishTitle.trim());
                }
                
                // Update recents
                const recentStr = await AsyncStorage.getItem('recent_dpps_v1') || '[]';
                let recents = JSON.parse(recentStr);
                recents = recents.map(d => {
                    if (d.id === editingDppId) {
                        return { ...d, title: publishTitle.trim() };
                    }
                    return d;
                });
                await AsyncStorage.setItem('recent_dpps_v1', JSON.stringify(recents));
            } else {
                await createDpp({
                    title: publishTitle.trim(),
                    total_questions: backendQuestions.length,
                    batch_id: user.batch_id,
                    class_group_id: selectedClassId,
                    folder_id: folder?.id || null,
                    questions: backendQuestions
                });
            }
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchData();
            setEditingDppId(null);
        } catch (error) {
            console.log("Create interactive DPP Error:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const detailMsg = error.response?.data?.detail || error.message || "Failed to create challenge";
            Alert.alert("Error", typeof detailMsg === 'string' ? detailMsg : JSON.stringify(detailMsg));
        } finally {
            setIsUploading(false);
        }
    };

    const handleQuizAnswerPress = (letter) => {
        if (quizSelectedOption !== null) return;
        
        setQuizSelectedOption(letter);
        const currentQuestion = activeQuizDpp.questions[quizCurrentIndex];
        const isCorrect = currentQuestion.correct_option === letter;
        
        setQuizOptionCorrectness(isCorrect ? 'correct' : 'wrong');
        
        if (isCorrect) {
            setQuizCorrectCount(prev => prev + 1);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Auto advance after 1.5 seconds
            setTimeout(() => {
                handleQuizNext();
            }, 1500);
        } else {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        }
    };
    
    const handleQuizNext = () => {
        if (!activeQuizDpp) return;
        
        const nextIndex = quizCurrentIndex + 1;
        if (nextIndex < activeQuizDpp.questions.length) {
            setQuizCurrentIndex(nextIndex);
            setQuizSelectedOption(null);
            setQuizOptionCorrectness(null);
            setQuizCorrectAnswerRevealed(false);
        } else {
            setQuizCompleted(true);
            setQuizCorrectAnswerRevealed(false);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        }
    };
    
    const handleQuizSubmit = async () => {
        setStudentQuizModalVisible(false);
        if (!activeQuizDpp) return;
        
        try {
            await AsyncStorage.setItem('dpp_time_spent_' + activeQuizDpp.id, quizTime.toString());
            setSavedDppTimes(prev => ({
                ...prev,
                [activeQuizDpp.id]: quizTime
            }));
        } catch (e) {
            console.log("Failed to save DPP time:", e);
        }

        try {
            const online = await isOnline();
            const attemptPayload = {
                dpp_id: activeQuizDpp.id,
                questions_attempted: activeQuizDpp.questions ? activeQuizDpp.questions.length : 0,
                correct_questions: quizCorrectCount,
                time_spent: quizTime,
                completed: true
            };

            // Update XP using accurate backend multipliers if online
            if (online) {
                const res = await submitDpp(attemptPayload);
                if (res && res.data && res.data.new_dpp_xp !== undefined) {
                    setDppXp(res.data.new_dpp_xp);
                    setSessionXP(res.data.xp_gained || 0); // For the victory screen overlay
                }
            } else {
                await queueOfflineSubmission(attemptPayload);
                Alert.alert("Offline Sync", "Score saved locally. It will automatically upload when you reconnect to the internet.");
                
                // Fallback for offline UI
                const baseXp = Math.max(10, quizCorrectCount * 10);
                const earnedXp = hasStreakBonus ? baseXp * 2 : baseXp;
                setSessionXP(earnedXp);
                setDppXp(prev => prev + earnedXp);
            }
            
            // Add to completed set locally
            setCompletedDppIds(prev => {
                const next = new Set(prev);
                next.add(activeQuizDpp.id);
                return next;
            });

            // Update user_attempt locally in dpps array
            setDpps(prev => prev.map(d => {
                if (d.id === activeQuizDpp.id) {
                    return {
                        ...d,
                        user_attempt: {
                            time_spent: quizTime,
                            correct_questions: quizCorrectCount,
                            questions_attempted: activeQuizDpp.questions ? activeQuizDpp.questions.length : 0,
                            completed: true
                        }
                    };
                }
                return d;
            }));
            
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

            const nextSetSize = completedDppIds.has(activeQuizDpp.id) ? completedDppIds.size : completedDppIds.size + 1;
            if (nextSetSize === dpps.length && dpps.length > 0) {
                setTimeout(() => {
                    Animated.spring(victoryAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
                    setShowVictory(true);
                }, 400);
            }
        } catch (err) {
            console.log("Failed to submit quiz attempt", err);
            Alert.alert("Submission Error", "Could not submit your DPP score to the database.");
        }
    };




    const handleAddContentPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setUploadModalVisible(true);
    };

    const handleViewDpp = async (dpp) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        
        // Teacher / Admin Analytics flow
        if (user?.role === 'teacher' || user?.role === 'admin') {
            setAnalyticsLoading(true);
            setTeacherAnalyticsModalVisible(true);
            try {
                const res = await getDppAnalytics(dpp.id);
                setSelectedDppAnalytics(res.data);
            } catch (err) {
                console.log("Error fetching DPP analytics:", err);
                Alert.alert("Error", "Could not fetch student progress analytics.");
                setTeacherAnalyticsModalVisible(false);
            } finally {
                setAnalyticsLoading(false);
            }
            return;
        }

        // Student Quiz solving flow
        try {
            const recentStr = await AsyncStorage.getItem('recent_dpps_v1') || '[]';
            let recents = JSON.parse(recentStr);
            recents = recents.filter(d => d.id !== dpp.id);
            recents.unshift({ ...dpp, openedAt: Date.now() });
            recents = recents.slice(0, 20);
            await AsyncStorage.setItem('recent_dpps_v1', JSON.stringify(recents));
            if (!folder) {
                setRecentDpps(recents.filter(d => Date.now() - d.openedAt < 24 * 60 * 60 * 1000));
            }

            if (dpp.questions && dpp.questions.length > 0) {
                setActiveQuizDpp(dpp);
                setQuizCurrentIndex(0);
                setQuizSelectedOption(null);
                setQuizOptionCorrectness(null);
                setQuizCorrectAnswerRevealed(false);
                setQuizCompleted(false);
                setQuizTime(0);
                setQuizCorrectCount(0);
                setStudentQuizModalVisible(true);
            } else {
                if (dpp.file_url) {
                    navigation.navigate('PdfViewer', {
                        pdfUrl: `${API_URL}${dpp.file_url}`,
                        title: dpp.title,
                        userIdentifier: user?.phone || user?.name || user?.email || 'STUDENT',
                        noteId: dpp.id
                    });
                } else {
                    Alert.alert("Empty Challenge", "This challenge does not have any content yet.");
                }
            }
        } catch (error) {
            Alert.alert("Error", "Could not open DPP");
        }
    };

    const handleToggleDppComplete = async (dppId, e) => {
        e.stopPropagation?.();
        if (togglingId === dppId) return;
        setTogglingId(dppId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            const res = await toggleDppComplete(dppId);
            setCompletedDppIds(prev => {
                const next = new Set(prev);
                if (res.data.completed) {
                    next.add(dppId);
                    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                    
                    if (res.data.new_dpp_xp !== undefined) {
                        setDppXp(res.data.new_dpp_xp);
                        setSessionXP(res.data.xp_gained || 0); // For the victory overlay
                    }
                    
                    if (next.size === dpps.length && dpps.length > 0) {
                        setTimeout(() => {
                            Animated.spring(victoryAnim, { toValue: 1, friction: 6, useNativeDriver: true }).start();
                            setShowVictory(true);
                        }, 400);
                    }
                } else { 
                    next.delete(dppId); 
                    if (res.data.new_dpp_xp !== undefined) setDppXp(res.data.new_dpp_xp);
                    else setDppXp(prev => Math.max(0, prev - 50));
                }
                return next;
            });

            // Update user_attempt locally in dpps array
            setDpps(prev => prev.map(d => {
                if (d.id === dppId) {
                    return {
                        ...d,
                        user_attempt: res.data.completed ? {
                            time_spent: 0,
                            correct_questions: 0,
                            questions_attempted: 0,
                            completed: true
                        } : null
                    };
                }
                return d;
            }));
        } catch (err) { console.log(err); } finally { setTogglingId(null); }
    };

    const renderDashboard = () => {
        if (folder) return null;
        if (user?.role === 'teacher' || user?.role === 'admin') return null;
        
        // Use progress API data (spans all folders) if available, fallback to visible dpps
        const completedCount = progressData ? progressData.dpps_solved : dpps.filter(d => completedDppIds.has(d.id)).length;
        const totalCount = progressData ? progressData.total_dpps : dpps.length;
        const combatLevel = Math.max(1, Math.floor(completedCount / 2) + 1);
        const currentXP = dppXp; // Removed sessionXP addition since dppXp is now perfectly accurate
        
        return (
            <View style={styles.dashboardContainer}>
                <LinearGradient 
                    colors={isDarkMode ? ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.02)'] : ['rgba(239, 68, 68, 0.08)', 'rgba(239, 68, 68, 0.01)']} 
                    style={[styles.dashboardCard, { borderColor: isDarkMode ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)', backgroundColor: themeCardBg }]}
                >
                    <View style={styles.dashboardTopRow}>
                        <View>
                            <Text style={[styles.dashboardSub, { color: isDarkMode ? '#FCA5A5' : '#EF4444' }]}>CHALLENGE GROUND</Text>
                            <Text style={[styles.dashboardTitle, { color: themeText }]}>The Combat Arena</Text>
                        </View>
                    </View>

                    <View style={[styles.dashboardDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]} />

                    <View style={styles.dashboardProgressInfo}>
                        <View style={styles.dashboardStatCol}>
                            <Text style={[styles.dashboardStatVal, { color: themeText }]}>⭐ {currentXP} XP</Text>
                            <Text style={[styles.dashboardStatLabel, { color: themeSubtext }]}>XP Gained</Text>
                        </View>
                        <View style={styles.dashboardStatCol}>
                            <Text style={[styles.dashboardStatVal, { color: themeText }]}>⚔️ {completedCount} / {totalCount}</Text>
                            <Text style={[styles.dashboardStatLabel, { color: themeSubtext }]}>Quests Cleared</Text>
                        </View>
                    </View>

                    <View style={styles.progressBarWrapper}>
                        <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0' }]}>
                            <View 
                                style={[
                                    styles.progressBarFill, 
                                    { backgroundColor: '#EF4444', shadowColor: '#EF4444', width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }
                                ]} 
                            />
                        </View>
                        <Text style={[styles.progressBarProgressText, { color: themeSubtext }]}>
                            {totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0}% Mastery
                        </Text>
                    </View>
                </LinearGradient>
            </View>
        );
    };

    const renderFolder = (folderItem, index) => {
        const FOLDER_THEMES = [
            {
                accent: '#EF4444', // Crimson/Red
                borderGlow: isDarkMode ? 'rgba(239, 68, 68, 0.35)' : 'rgba(239, 68, 68, 0.25)',
                cardGradient: isDarkMode ? ['rgba(239, 68, 68, 0.15)', 'rgba(239, 68, 68, 0.02)'] : ['rgba(239, 68, 68, 0.08)', 'rgba(239, 68, 68, 0.02)'],
            },
            {
                accent: '#FBBF24', // Gold
                borderGlow: isDarkMode ? 'rgba(251, 191, 36, 0.35)' : 'rgba(251, 191, 36, 0.25)',
                cardGradient: isDarkMode ? ['rgba(251, 191, 36, 0.15)', 'rgba(251, 191, 36, 0.02)'] : ['rgba(251, 191, 36, 0.08)', 'rgba(251, 191, 36, 0.02)'],
            },
            {
                accent: '#EC4899', // Pink
                borderGlow: isDarkMode ? 'rgba(236, 72, 153, 0.35)' : 'rgba(236, 72, 153, 0.25)',
                cardGradient: isDarkMode ? ['rgba(236, 72, 153, 0.15)', 'rgba(236, 72, 153, 0.02)'] : ['rgba(236, 72, 153, 0.08)', 'rgba(236, 72, 153, 0.02)'],
            },
            {
                accent: '#3B82F6', // Blue
                borderGlow: isDarkMode ? 'rgba(59, 130, 246, 0.35)' : 'rgba(59, 130, 246, 0.25)',
                cardGradient: isDarkMode ? ['rgba(59, 130, 246, 0.15)', 'rgba(59, 130, 246, 0.02)'] : ['rgba(59, 130, 246, 0.08)', 'rgba(59, 130, 246, 0.02)'],
            },
            {
                accent: '#10B981', // Emerald
                borderGlow: isDarkMode ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)',
                cardGradient: isDarkMode ? ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.02)'] : ['rgba(16, 185, 129, 0.08)', 'rgba(16, 185, 129, 0.02)'],
            },
            {
                accent: '#A855F7', // Purple
                borderGlow: isDarkMode ? 'rgba(168, 85, 247, 0.35)' : 'rgba(168, 85, 247, 0.25)',
                cardGradient: isDarkMode ? ['rgba(168, 85, 247, 0.15)', 'rgba(168, 85, 247, 0.02)'] : ['rgba(168, 85, 247, 0.08)', 'rgba(168, 85, 247, 0.02)'],
            },
        ];

        // Hash folder name to assign a consistent theme color
        let hash = 0;
        const nameStr = folderItem.name || "";
        for (let i = 0; i < nameStr.length; i++) {
            hash = nameStr.charCodeAt(i) + ((hash << 5) - hash);
        }
        const themeIndex = Math.abs(hash) % FOLDER_THEMES.length;
        const theme = FOLDER_THEMES[themeIndex];

        return (
            <TouchableOpacity
                key={folderItem.id}
                activeOpacity={0.82}
                onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); navigation.push('DPPScreen', { folder: folderItem }); }}
                onLongPress={() => handleDeleteFolder(folderItem)}
                style={[styles.grimoireCard, { borderColor: theme.borderGlow, backgroundColor: themeCardBg }]}
            >
                <LinearGradient colors={theme.cardGradient} style={styles.grimoireCardGradient}>
                    <View style={[styles.grimoireIconContainer, { borderColor: theme.borderGlow, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)' }]}>
                        <Ionicons name="flash" size={24} color={theme.accent} />
                    </View>
                    <Text style={[styles.grimoireName, { color: themeText }]} numberOfLines={2}>{folderItem.name}</Text>
                    <View style={styles.grimoireFooter}>
                        <Ionicons name="game-controller" size={13} color={theme.accent} />
                        <Text style={[styles.grimoireFooterText, { color: theme.accent }]}>Enter Arena</Text>
                    </View>
                </LinearGradient>
            </TouchableOpacity>
        );
    };

    const renderDpp = ({ item, index }) => {
        const isDone = completedDppIds.has(item.id);
        const isBusy = togglingId === item.id;
        const isStudent = user?.role === 'student';

        // Solve time calculation
        const hasTimeData = item.user_attempt?.time_spent !== undefined || savedDppTimes[item.id] !== undefined;
        let solveTimeStr = null;
        if (hasTimeData) {
            const timeVal = item.user_attempt?.time_spent !== undefined ? item.user_attempt.time_spent : savedDppTimes[item.id];
            if (timeVal > 0) solveTimeStr = formatDuration(timeVal);
        }

        return (
            <AnimatedListItem index={index || 0}>
                <TouchableOpacity 
                    activeOpacity={0.85} 
                    onPress={() => handleViewDpp(item)}
                    onLongPress={() => handleDppOptionsPress(item)}
                >
                    <LinearGradient
                        colors={isDone 
                            ? (isDarkMode ? ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.02)'] : ['rgba(16, 185, 129, 0.08)', 'rgba(16, 185, 129, 0.01)'])
                            : (isDarkMode ? ['rgba(255, 255, 255, 0.04)', 'rgba(0,0,0,0.15)'] : ['#FFFFFF', '#FAF5F5'])}
                        style={[styles.codexCard, { borderColor: isDone ? '#10B981' : themeCardBorder }]}
                    >
                        <View style={styles.codexRow}>
                            <View style={[styles.codexStatusBadge, isDone ? styles.codexStatusBadgeDone : styles.codexStatusBadgePending, { backgroundColor: isDone ? (isDarkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)') : (isDarkMode ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.05)') }]}>
                                <Ionicons name={isDone ? "shield-checkmark" : "flash-outline"} size={22} color={isDone ? "#10B981" : "#EF4444"} />
                            </View>
                            
                            <View style={styles.codexInfo}>
                                <Text style={[styles.codexTitle, { color: themeText }]} numberOfLines={1}>{item.title}</Text>
                                <View style={styles.codexBadgesRow}>

                                    {isStudent && solveTimeStr && (
                                        <View style={[styles.codexTimePill, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : '#F1F5F9', borderColor: themeCardBorder }]}>
                                            <Ionicons name="time-outline" size={11} color={isDarkMode ? "rgba(255, 255, 255, 0.5)" : "#64748B"} />
                                            <Text style={[styles.codexTimeText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#64748B' }]}>Time taken: {solveTimeStr}</Text>
                                        </View>
                                    )}
                                    {isDone && item.user_attempt && (
                                        <View style={[styles.codexClassProgressPill, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.04)' : '#F1F5F9', borderColor: themeCardBorder }]}>
                                            <Ionicons name="ribbon-outline" size={11} color={isDarkMode ? "rgba(255, 255, 255, 0.5)" : "#64748B"} />
                                            <Text style={[styles.codexClassProgressText, { color: isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#64748B' }]}>
                                                {item.user_attempt.correct_questions}/{item.user_attempt.questions_attempted} Score
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                            
                            {isStudent ? (
                                <TouchableOpacity 
                                    onPress={(e) => {
                                        e.stopPropagation?.();
                                        if (item.questions && item.questions.length > 0) {
                                            if (!isDone) {
                                                handleViewDpp(item);
                                            }
                                        } else {
                                            handleToggleDppComplete(item.id, e);
                                        }
                                    }}
                                    style={[styles.codexActionBtn, isDone && styles.codexActionBtnDone, { backgroundColor: isDone ? '#10B981' : (isDarkMode ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)'), borderColor: isDone ? '#10B981' : (isDarkMode ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)') }]}
                                >
                                    {isBusy ? <ActivityIndicator size="small" color="#FFF" /> :
                                     isDone ? <Ionicons name="checkmark-done" size={18} color="#FFF" /> :
                                     <Text style={[styles.codexActionBtnText, { color: isDarkMode ? '#EF4444' : '#DC2626' }]}>BATTLE</Text>}
                                </TouchableOpacity>
                            ) : (
                                <Ionicons name="chevron-forward" size={18} color={isDarkMode ? "rgba(255,255,255,0.25)" : "#94A3B8"} />
                            )}
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </AnimatedListItem>
        );
    };

    const getDisplayDpps = () => {
        if (folder) {
            return dpps;
        } else {
            if (searchQuery) {
                return dpps;
            }
            const rootDpps = dpps.filter(d => d.folder_id === null);
            const validRecent = recentDpps.filter(rd => rd.folder_id !== null && (Date.now() - rd.openedAt < 24 * 60 * 60 * 1000));
            const merged = [...rootDpps];
            validRecent.forEach(rd => {
                if (!merged.some(m => m.id === rd.id)) {
                    merged.push(rd);
                }
            });
            return merged;
        }
    };
    const displayDpps = getDisplayDpps();
    const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredDpps = displayDpps.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()));
    const totalDpps = displayDpps.length;
    const completedCount = displayDpps.filter(n => completedDppIds.has(n.id)).length;
    const progressPercent = totalDpps > 0 ? (completedCount / totalDpps) * 100 : 0;
    const motivTag = progressPercent === 100 ? '🏆 Arena Conquered!' : progressPercent >= 80 ? '🔥 Final boss awaits!' : progressPercent >= 50 ? '⚡ You\'re on fire!' : '🎯 Start your mission!';
    const isStudent = user?.role === 'student';

    return (
        <LinearGradient colors={bgGradient} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>

                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: themeIconBtnBg }]}>
                        <Ionicons name="chevron-back" size={24} color={themeIconColor} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={[styles.title, { color: themeText }]}>{folder ? folder.name : 'Daily Challenges'}</Text>
                        {isStudent && totalDpps > 0 && (
                            <Text style={{ color: isDarkMode ? 'rgba(255,255,255,0.55)' : '#64748B', fontFamily: 'Inter-Medium', fontSize: 12, marginTop: 3 }}>{motivTag}</Text>
                        )}
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                    {renderDashboard()}

                    {/* Streak Banner */}
                    {isStudent && hasStreakBonus && (
                        <View style={styles.streakBanner}>
                            <Ionicons name="flame" size={16} color="#FFF" />
                            <Text style={styles.streakBannerText}>🔥 Day {user.streak_count} Streak — 2× XP BONUS ACTIVE!</Text>
                        </View>
                    )}

                    {!folder && (
                        <View style={[styles.searchBarContainer, { backgroundColor: themeCardBg, borderColor: themeCardBorder }]}>
                            <Ionicons name="search-outline" size={18} color={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : '#64748B'} style={{ marginRight: 8 }} />
                            <TextInput 
                                style={[styles.searchBarInput, { color: themeText }]} 
                                placeholder="Search arenas or challenges..." 
                                placeholderTextColor={isDarkMode ? 'rgba(255, 255, 255, 0.3)' : '#94A3B8'} 
                                value={searchQuery} 
                                onChangeText={(text) => {
                                        setSearchQuery(text);
                                        setIsSearching(text.length > 0);
                                    }} 
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => { setSearchQuery(''); setIsSearching(false); fetchData(''); }}>
                                    <Ionicons name="close-circle" size={18} color={isDarkMode ? 'rgba(255, 255, 255, 0.5)' : '#94A3B8'} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Arena Grid */}
                    {filteredFolders.length > 0 && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : '#64748B' }]}>⚔️  Choose Your Arena</Text>
                            <View style={styles.arenaGrid}>
                                {filteredFolders.map((f, i) => renderFolder(f, i))}
                            </View>
                        </View>
                    )}

                    {/* Quest Cards (DPPs) */}
                    {loading ? (
                        <View style={styles.centerState}><ActivityIndicator size="large" color="#FCA5A5" /></View>
                    ) : (
                        <View style={styles.section}>
                            <View style={styles.notesList}>
                                {filteredDpps.length > 0 ? (
                                    filteredDpps.map((dpp, index) => <View key={dpp.id}>{renderDpp({ item: dpp, index })}</View>)
                                ) : null}
                            </View>
                        </View>
                    )}
                </ScrollView>

                {(user?.role === 'admin' || user?.role === 'teacher') && (
                    <View style={styles.fabContainer}>
                        <TouchableOpacity style={[styles.fab, { marginBottom: 12 }]} onPress={handleAddContentPress}>
                            <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.fabGradient}>
                                <Ionicons name="document-attach" size={26} color="#FFF" />
                            </LinearGradient>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.fab} onPress={() => setModalVisible(true)}>
                            <LinearGradient colors={['#EF4444', '#B91C1C']} style={styles.fabGradient}>
                                <Ionicons name="add" size={32} color="#FFF" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Create Arena Modal */}
                <Modal visible={modalVisible} transparent animationType="fade">
                    <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: modalOverlayBg }]} activeOpacity={1} onPress={() => setModalVisible(false)}>
                        <LinearGradient colors={modalBgGradient} style={[styles.modalContent, { borderColor: modalBorder }]}>
                            <Text style={[styles.modalTitle, { color: modalTitleText }]}>CREATE ARENA</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: modalInputBg, color: modalInputText, borderColor: modalInputBorder }]} 
                                placeholder="Arena Name..." 
                                placeholderTextColor={modalInputPlaceholder} 
                                value={newFolderName} 
                                onChangeText={setNewFolderName} 
                                autoFocus 
                            />
                            <View style={styles.modalActionRow}>
                                <TouchableOpacity onPress={() => setModalVisible(false)} style={[styles.modalCancelBtn, { backgroundColor: modalCancelBg, borderColor: modalCancelBorder }]}>
                                    <Text style={[styles.modalCancelText, { color: modalCancelTextVal }]}>CANCEL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleCreateFolder} style={styles.modalCreateBtn}>
                                    <LinearGradient colors={['#EF4444', '#B91C1C']} style={styles.modalCreateGradient}>
                                        <Text style={styles.modalCreateText}>CREATE</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </Modal>

                {/* Victory Modal */}
                <Modal visible={showVictory} transparent animationType="fade">
                    <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', alignItems: 'center', padding: 28 }}>
                        <Animated.View style={[styles.victoryCard, {
                            transform: [{ scale: victoryAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1] }) }],
                            opacity: victoryAnim,
                            backgroundColor: '#1A1A1A',
                            borderRadius: 24,
                            padding: 28,
                            alignItems: 'center',
                        }]}>
                            {/* Trophy */}
                            <Text style={{ fontSize: 52, marginBottom: 12 }}>🏆</Text>

                            {/* Title */}
                            <Text style={{ color: '#FFFFFF', fontFamily: 'Inter-Black', fontSize: 24, textAlign: 'center' }}>Arena Conquered!</Text>
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontFamily: 'Inter-Regular', fontSize: 14, textAlign: 'center', marginTop: 6 }}>
                                All quests complete
                            </Text>

                            {/* XP row */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 20, backgroundColor: 'rgba(251,191,36,0.12)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 }}>
                                <Ionicons name="star" size={18} color="#F59E0B" />
                                <Text style={{ color: '#F59E0B', fontFamily: 'Inter-Bold', fontSize: 20 }}>+{sessionXP} XP</Text>
                            </View>

                            {/* Streak line */}
                            {hasStreakBonus && (
                                <Text style={{ color: '#10B981', fontFamily: 'Inter-Medium', fontSize: 13, marginTop: 10 }}>
                                    🔥 Day {user?.streak_count} streak — 2× bonus applied
                                </Text>
                            )}

                            {/* Button */}
                            <TouchableOpacity
                                onPress={() => { setShowVictory(false); }}
                                activeOpacity={0.8}
                                style={{ marginTop: 24, backgroundColor: '#F59E0B', width: '100%', paddingVertical: 14, borderRadius: 14, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#000', fontFamily: 'Inter-Bold', fontSize: 16 }}>Continue</Text>
                            </TouchableOpacity>
                        </Animated.View>
                    </View>
                </Modal>



                {/* Upload Action Sheet Modal */}
                <Modal visible={uploadModalVisible} transparent animationType="fade">
                    <TouchableOpacity 
                        style={[styles.actionModalOverlay, { backgroundColor: modalOverlayBg }]} 
                        activeOpacity={1} 
                        onPress={() => setUploadModalVisible(false)}
                    >
                        <LinearGradient colors={modalBgGradient} style={[styles.actionModalContent, { borderColor: modalBorder }]}>
                            <View style={styles.actionModalHeader}>
                                <Text style={[styles.actionModalTitle, { color: modalTitleText }]}>UPLOAD CHALLENGE</Text>
                                <Text style={[styles.actionModalSubtitle, { color: themeSubtext }]}>Select a method to publish a new Daily Challenge</Text>
                            </View>
                            
                            <TouchableOpacity 
                                style={[styles.actionRow, { backgroundColor: actionRowBg, borderColor: actionRowBorder }]} 
                                activeOpacity={0.7}
                                onPress={() => {
                                    setUploadModalVisible(false);
                                    setTimeout(pickDocument, 300);
                                }}
                            >
                                <LinearGradient colors={['rgba(59,130,246,0.18)', 'rgba(29,78,216,0.06)']} style={styles.actionRowIconWrap}>
                                    <Ionicons name="document-text" size={24} color="#60A5FA" />
                                </LinearGradient>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={[styles.actionRowText, { color: actionRowTextVal }]}>Upload PDF directly</Text>
                                    <Text style={[styles.actionRowSub, { color: actionRowSubTextVal }]}>Select an existing PDF file from your device</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={actionRowChevronColor} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.actionRow, { backgroundColor: actionRowBg, borderColor: actionRowBorder }]} 
                                activeOpacity={0.7}
                                onPress={() => {
                                    setUploadModalVisible(false);
                                    setTimeout(pickImages, 300);
                                }}
                            >
                                <LinearGradient colors={['rgba(236,72,153,0.18)', 'rgba(190,24,93,0.06)']} style={styles.actionRowIconWrap}>
                                    <Ionicons name="images" size={24} color="#F472B6" />
                                </LinearGradient>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={[styles.actionRowText, { color: actionRowTextVal }]}>Images to PDF</Text>
                                    <Text style={[styles.actionRowSub, { color: actionRowSubTextVal }]}>Choose multiple photos to convert into one PDF</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={actionRowChevronColor} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.actionRow, { backgroundColor: actionRowBg, borderColor: actionRowBorder }]} 
                                activeOpacity={0.7}
                                onPress={() => {
                                    setUploadModalVisible(false);
                                    setTimeout(() => pickImages(true), 300);
                                }}
                            >
                                <LinearGradient colors={['rgba(16,185,129,0.18)', 'rgba(4,120,87,0.06)']} style={styles.actionRowIconWrap}>
                                    <Ionicons name="scan-circle" size={24} color="#10B981" />
                                </LinearGradient>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={[styles.actionRowText, { color: actionRowTextVal }]}>Scan Images (AI OCR)</Text>
                                    <Text style={[styles.actionRowSub, { color: actionRowSubTextVal }]}>Extract question text from images to build a clean DPP sheet</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={actionRowChevronColor} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => setUploadModalVisible(false)} 
                                style={[styles.actionModalCancelBtn, { backgroundColor: modalCancelBg, borderColor: modalCancelBorder }]}
                            >
                                <Text style={[styles.actionModalCancelText, { color: modalCancelTextVal }]}>CANCEL</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </TouchableOpacity>
                </Modal>

                {/* Custom Naming Modal */}
                <Modal visible={namingModalVisible} transparent animationType="fade">
                    <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: modalOverlayBg }]} activeOpacity={1} onPress={() => setNamingModalVisible(false)}>
                        <LinearGradient colors={modalBgGradient} style={[styles.modalContent, { borderColor: modalBorder }]}>
                            <Text style={[styles.modalTitle, { color: modalTitleText }]}>NAME CHALLENGE</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: modalInputBg, color: modalInputText, borderColor: modalInputBorder }]} 
                                placeholder="Challenge Name..." 
                                placeholderTextColor={modalInputPlaceholder} 
                                value={pendingName} 
                                onChangeText={setPendingName} 
                                autoFocus
                            />
                            <View style={styles.modalActionRow}>
                                <TouchableOpacity onPress={() => setNamingModalVisible(false)} style={[styles.modalCancelBtn, { backgroundColor: modalCancelBg, borderColor: modalCancelBorder }]}>
                                    <Text style={[styles.modalCancelText, { color: modalCancelTextVal }]}>CANCEL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleNamingSubmit} style={styles.modalCreateBtn}>
                                    <LinearGradient colors={['#EF4444', '#B91C1C']} style={styles.modalCreateGradient}>
                                        <Text style={styles.modalCreateText}>UPLOAD</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </Modal>

                {/* Custom Delete Confirmation Modal */}
                <Modal visible={deleteModalVisible} transparent animationType="fade">
                    <TouchableOpacity 
                        style={[styles.actionModalOverlay, { backgroundColor: modalOverlayBg }]} 
                        activeOpacity={1} 
                        onPress={() => setDeleteModalVisible(false)}
                    >
                        <LinearGradient colors={modalBgGradient} style={[styles.deleteModalContent, { borderColor: modalBorder }]}>
                            <View style={styles.deleteIconGlow}>
                                <Ionicons name="skull" size={32} color="#EF4444" />
                            </View>
                            
                            <Text style={[styles.deleteModalTitle, { color: modalTitleText }]}>DESTROY ARENA</Text>
                            <Text style={[styles.deleteModalDesc, { color: deleteDescColor }]}>
                                Are you sure you want to delete <Text style={{ color: deleteDescHighlight, fontFamily: 'Inter-Bold' }}>"{folderToDelete?.name}"</Text> and all its quests?
                            </Text>
                            <Text style={[styles.deleteWarningText, { color: deleteWarningTextVal, backgroundColor: deleteWarningBg, borderColor: deleteWarningBorder }]}>
                                ⚠️ This action will permanently remove all sub-arenas, challenges, and files inside it. This cannot be undone.
                            </Text>
                            
                            <View style={styles.modalActionRow}>
                                <TouchableOpacity 
                                    onPress={() => setDeleteModalVisible(false)} 
                                    style={[styles.modalCancelBtn, { backgroundColor: modalCancelBg, borderColor: modalCancelBorder }]}
                                >
                                    <Text style={[styles.modalCancelText, { color: modalCancelTextVal }]}>CANCEL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={confirmDeleteFolder} 
                                    style={styles.modalDeleteBtn}
                                >
                                    <LinearGradient colors={['#EF4444', '#991B1B']} style={styles.modalDeleteGradient}>
                                        <Text style={styles.modalDeleteText}>DESTROY</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </Modal>

                {/* DPP Options Modal */}
                <Modal visible={dppOptionsModalVisible} transparent animationType="fade">
                    <TouchableOpacity 
                        style={[styles.actionModalOverlay, { backgroundColor: modalOverlayBg }]} 
                        activeOpacity={1} 
                        onPress={() => setDppOptionsModalVisible(false)}
                    >
                        <LinearGradient colors={modalBgGradient} style={[styles.actionModalContent, { borderColor: modalBorder }]}>
                            <View style={styles.actionModalHeader}>
                                <Text style={[styles.actionModalTitle, { color: modalTitleText }]}>CHALLENGE OPTIONS</Text>
                                <Text style={[styles.actionModalSubtitle, { color: themeSubtext }]}>"{selectedDppForOptions?.title}"</Text>
                            </View>
                            
                            <TouchableOpacity 
                                style={[styles.actionRow, { backgroundColor: actionRowBg, borderColor: actionRowBorder }]} 
                                activeOpacity={0.7}
                                onPress={handleEditQuestionsPress}
                            >
                                <LinearGradient colors={['rgba(16,185,129,0.18)', 'rgba(4,120,87,0.06)']} style={styles.actionRowIconWrap}>
                                    <Ionicons name="list" size={24} color="#10B981" />
                                </LinearGradient>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={[styles.actionRowText, { color: actionRowTextVal }]}>Edit DPP</Text>
                                    <Text style={[styles.actionRowSub, { color: actionRowSubTextVal }]}>Modify name, questions, and options for this DPP</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={actionRowChevronColor} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.actionRow, { backgroundColor: actionRowBg, borderColor: actionRowBorder }]} 
                                activeOpacity={0.7}
                                onPress={handleDeleteDppPress}
                            >
                                <LinearGradient colors={['rgba(239,68,68,0.18)', 'rgba(153,27,27,0.06)']} style={styles.actionRowIconWrap}>
                                    <Ionicons name="trash" size={24} color="#EF4444" />
                                </LinearGradient>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={[styles.actionRowText, { color: actionRowTextVal }]}>Delete Challenge</Text>
                                    <Text style={[styles.actionRowSub, { color: actionRowSubTextVal }]}>Permanently destroy this DPP</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={actionRowChevronColor} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => setDppOptionsModalVisible(false)} 
                                style={[styles.actionModalCancelBtn, { backgroundColor: modalCancelBg, borderColor: modalCancelBorder }]}
                            >
                                <Text style={[styles.actionModalCancelText, { color: modalCancelTextVal }]}>CANCEL</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </TouchableOpacity>
                </Modal>

                {/* Rename DPP Modal */}
                <Modal visible={renameDppModalVisible} transparent animationType="fade">
                    <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: modalOverlayBg }]} activeOpacity={1} onPress={() => setRenameDppModalVisible(false)}>
                        <LinearGradient colors={modalBgGradient} style={[styles.modalContent, { borderColor: modalBorder }]}>
                            <Text style={[styles.modalTitle, { color: modalTitleText }]}>RENAME CHALLENGE</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: modalInputBg, color: modalInputText, borderColor: modalInputBorder }]} 
                                placeholder="Challenge Name..." 
                                placeholderTextColor={modalInputPlaceholder} 
                                value={renameDppName} 
                                onChangeText={setRenameDppName} 
                                autoFocus 
                            />
                            <View style={styles.modalActionRow}>
                                <TouchableOpacity onPress={() => setRenameDppModalVisible(false)} style={[styles.modalCancelBtn, { backgroundColor: modalCancelBg, borderColor: modalCancelBorder }]}>
                                    <Text style={[styles.modalCancelText, { color: modalCancelTextVal }]}>CANCEL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity onPress={confirmRenameDpp} style={styles.modalCreateBtn}>
                                    <LinearGradient colors={['#3B82F6', '#1D4ED8']} style={styles.modalCreateGradient}>
                                        <Text style={styles.modalCreateText}>SAVE</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </Modal>

                {/* Custom Delete DPP Confirmation Modal */}
                <Modal visible={deleteDppModalVisible} transparent animationType="fade">
                    <TouchableOpacity 
                        style={[styles.actionModalOverlay, { backgroundColor: modalOverlayBg }]} 
                        activeOpacity={1} 
                        onPress={() => setDeleteDppModalVisible(false)}
                    >
                        <LinearGradient colors={modalBgGradient} style={[styles.deleteModalContent, { borderColor: modalBorder }]}>
                            <View style={styles.deleteIconGlow}>
                                <Ionicons name="trash" size={32} color="#EF4444" />
                            </View>
                            
                            <Text style={[styles.deleteModalTitle, { color: modalTitleText }]}>DELETE CHALLENGE</Text>
                            <Text style={[styles.deleteModalDesc, { color: deleteDescColor }]}>
                                Are you sure you want to delete the DPP <Text style={{ color: deleteDescHighlight, fontFamily: 'Inter-Bold' }}>"{dppToDelete?.title}"</Text>?
                            </Text>
                            <Text style={[styles.deleteWarningText, { color: deleteWarningTextVal, backgroundColor: deleteWarningBg, borderColor: deleteWarningBorder }]}>
                                ⚠️ This file will be permanently deleted and students will no longer be able to complete this quest.
                            </Text>
                            
                            <View style={styles.modalActionRow}>
                                <TouchableOpacity 
                                    onPress={() => setDeleteDppModalVisible(false)} 
                                    style={[styles.modalCancelBtn, { backgroundColor: modalCancelBg, borderColor: modalCancelBorder }]}
                                >
                                    <Text style={[styles.modalCancelText, { color: modalCancelTextVal }]}>CANCEL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={confirmDeleteDpp} 
                                    style={styles.modalDeleteBtn}
                                >
                                    <LinearGradient colors={['#EF4444', '#991B1B']} style={styles.modalDeleteGradient}>
                                        <Text style={styles.modalDeleteText}>DELETE</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </Modal>

                {/* Teacher Question Editor Modal */}
                <Modal visible={editQuestionsModalVisible} transparent animationType="slide">
                    <LinearGradient colors={modalBgGradient} style={{ flex: 1, paddingTop: insets.top }}>
                        <View style={{ flex: 1 }}>
                            
                            {/* Modal Header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: modalBorder }}>
                                <TouchableOpacity 
                                    onPress={() => {
                                        setEditQuestionsModalVisible(false);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={[styles.iconButton, { backgroundColor: themeIconBtnBg }]}
                                >
                                    <Ionicons name="close" size={24} color={themeIconColor} />
                                </TouchableOpacity>
                                <Text style={[styles.title, { fontSize: 16, color: modalTitleText }]}>EDIT QUESTIONS</Text>
                                <TouchableOpacity 
                                    onPress={handlePublishParsedDpp}
                                    style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 18, backgroundColor: '#10B981' }}
                                >
                                    <Text style={{ color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 13 }}>PUBLISH</Text>
                                </TouchableOpacity>
                            </View>

                            <ScrollView contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
                                {/* Title Input */}
                                <View style={{ marginBottom: 20 }}>
                                    <Text style={{ color: questionLabelText, fontSize: 12, fontFamily: 'Inter-Bold', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 1 }}>Challenge Name</Text>
                                    <TextInput
                                        style={[styles.input, { width: '100%', backgroundColor: modalInputBg, color: modalInputText, borderColor: modalInputBorder }]}
                                        placeholder="Challenge Name..."
                                        placeholderTextColor={modalInputPlaceholder}
                                        value={publishTitle}
                                        onChangeText={setPublishTitle}
                                    />
                                </View>

                                {parsedQuestions.map((q, idx) => (
                                    <View key={q.id} style={{ backgroundColor: questionCardBg, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: questionCardBorder }}>
                                        {/* Card Header */}
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                            <Text style={{ color: '#EF4444', fontFamily: 'Inter-ExtraBold', fontSize: 14 }}>QUESTION #{idx + 1}</Text>
                                            <TouchableOpacity onPress={() => handleRemoveQuestion(idx)} style={{ padding: 4 }}>
                                                <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>

                                        {/* Question Text */}
                                        <Text style={{ color: questionLabelText, fontSize: 11, fontFamily: 'Inter-Bold', marginBottom: 6 }}>QUESTION TEXT</Text>
                                        <TextInput
                                            style={[styles.input, { width: '100%', height: 70, textAlignVertical: 'top', paddingTop: 8, paddingBottom: 8, backgroundColor: modalInputBg, color: modalInputText, borderColor: modalInputBorder }]}
                                            multiline
                                            placeholder="Type question content here..."
                                            placeholderTextColor={modalInputPlaceholder}
                                            value={q.question_text}
                                            onChangeText={(val) => handleUpdateQuestionText(idx, val)}
                                        />

                                        {/* Question Type Toggle */}
                                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                                            <Text style={{ color: questionLabelText, fontSize: 11, fontFamily: 'Inter-Bold' }}>TYPE</Text>
                                            <View style={{ flexDirection: 'row', backgroundColor: questionTypeToggleBg, borderRadius: 12, padding: 3 }}>
                                                <TouchableOpacity 
                                                    onPress={() => handleUpdateQuestionType(idx, 'mcq')}
                                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, backgroundColor: q.question_type === 'mcq' ? '#EF4444' : 'transparent' }}
                                                >
                                                    <Text style={{ color: q.question_type === 'mcq' ? '#FFF' : questionTypeInactiveText, fontFamily: 'Inter-Bold', fontSize: 11 }}>MCQ</Text>
                                                </TouchableOpacity>
                                                <TouchableOpacity 
                                                    onPress={() => handleUpdateQuestionType(idx, 'subjective')}
                                                    style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9, backgroundColor: q.question_type === 'subjective' ? '#EF4444' : 'transparent' }}
                                                >
                                                    <Text style={{ color: q.question_type === 'subjective' ? '#FFF' : questionTypeInactiveText, fontFamily: 'Inter-Bold', fontSize: 11 }}>Subjective</Text>
                                                </TouchableOpacity>
                                            </View>
                                        </View>

                                        {/* MCQ details */}
                                        {q.question_type === 'mcq' && (
                                            <View style={{ marginTop: 14, borderTopWidth: 1, borderColor: questionCardBorder, paddingTop: 12 }}>
                                                <Text style={{ color: questionLabelText, fontSize: 11, fontFamily: 'Inter-Bold', marginBottom: 8 }}>OPTIONS</Text>
                                                {['A', 'B', 'C', 'D'].map((optChar, optIdx) => (
                                                    <View key={optChar} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                                                        <Text style={{ color: questionLabelText, fontFamily: 'Inter-Bold', fontSize: 13, width: 20 }}>{optChar}</Text>
                                                        <TextInput
                                                            style={[styles.input, { flex: 1, height: 38, marginBottom: 0, backgroundColor: modalInputBg, color: modalInputText, borderColor: modalInputBorder }]}
                                                            placeholder={`Option ${optChar}...`}
                                                            placeholderTextColor={modalInputPlaceholder}
                                                            value={q.options[optIdx] || ''}
                                                            onChangeText={(val) => handleUpdateQuestionOption(idx, optIdx, val)}
                                                        />
                                                    </View>
                                                ))}

                                                {/* Correct option selector */}
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
                                                    <Text style={{ color: questionLabelText, fontSize: 11, fontFamily: 'Inter-Bold' }}>CORRECT ANSWER</Text>
                                                    <View style={{ flexDirection: 'row', gap: 6 }}>
                                                        {['A', 'B', 'C', 'D'].map((letter) => (
                                                            <TouchableOpacity
                                                                key={letter}
                                                                onPress={() => handleUpdateCorrectOption(idx, letter)}
                                                                style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: q.correct_option === letter ? '#10B981' : (isDarkMode ? 'rgba(255,255,255,0.2)' : '#CBD5E1'), backgroundColor: q.correct_option === letter ? '#10B981' : 'transparent', justifyContent: 'center', alignItems: 'center' }}
                                                            >
                                                                <Text style={{ color: q.correct_option === letter ? '#FFF' : (isDarkMode ? '#FFF' : '#64748B'), fontFamily: 'Inter-Bold', fontSize: 12 }}>{letter}</Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                ))}

                                <TouchableOpacity 
                                    onPress={handleAddQuestion}
                                    style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 14, borderRadius: 16, borderWidth: 1, borderColor: questionAddSlideBorder, borderStyle: 'dashed', marginTop: 10, marginBottom: 40 }}
                                >
                                    <Ionicons name="add-circle-outline" size={20} color={questionAddSlideText} />
                                    <Text style={{ color: questionAddSlideText, fontFamily: 'Inter-Bold', fontSize: 13 }}>Add Question Slide</Text>
                                </TouchableOpacity>
                            </ScrollView>

                            </View>
                        </LinearGradient>
                </Modal>

                <Modal visible={studentQuizModalVisible} transparent animationType="slide">
                    <LinearGradient colors={['#1E0A0F', '#0C0104']} style={{ flex: 1, paddingTop: insets.top }}>
                        <View style={{ flex: 1 }}>
                            
                            {/* Header */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                                <TouchableOpacity 
                                    onPress={() => {
                                        setStudentQuizModalVisible(false);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                    style={styles.iconButton}
                                >
                                    <Ionicons name="close" size={24} color="#FFF" />
                                </TouchableOpacity>
                                <Text style={[styles.title, { fontSize: 15, flex: 1, textAlign: 'center', marginHorizontal: 8 }]} numberOfLines={1}>
                                    {activeQuizDpp?.title.toUpperCase()}
                                </Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239, 68, 68, 0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                                    <Ionicons name="time-outline" size={14} color="#EF4444" style={{ marginRight: 4 }} />
                                    <Text style={{ color: '#EF4444', fontFamily: 'Inter-Bold', fontSize: 12 }}>{formatTime(quizTime)}</Text>
                                </View>
                            </View>

                            {activeQuizDpp && activeQuizDpp.questions && activeQuizDpp.questions.length > 0 && !quizCompleted ? (
                                <View style={{ flex: 1, padding: 18, justifyContent: 'space-between' }}>
                                    
                                    {/* Progress Header */}
                                    <View>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                            <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter-Bold', fontSize: 11 }}>QUESTION {quizCurrentIndex + 1} OF {activeQuizDpp.questions.length}</Text>
                                            <Text style={{ color: '#EF4444', fontFamily: 'Inter-ExtraBold', fontSize: 11 }}>+{completedDppIds.has(activeQuizDpp.id) ? '0' : '50'} XP</Text>
                                        </View>
                                        
                                        {/* progress bar */}
                                        <View style={{ height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.08)', width: '100%' }}>
                                            <View style={{ height: '100%', borderRadius: 3, backgroundColor: '#EF4444', width: `${((quizCurrentIndex) / activeQuizDpp.questions.length) * 100}%` }} />
                                        </View>
                                    </View>

                                    {/* Question Card */}
                                    <ScrollView style={{ flex: 1, marginVertical: 20 }}>
                                        <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: 24, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' }}>
                                            <Text style={{ color: '#FFF', fontFamily: 'Inter-Medium', fontSize: 18, lineHeight: 26, letterSpacing: 0.2 }}>
                                                {activeQuizDpp.questions[quizCurrentIndex]?.question_text}
                                            </Text>
                                        </View>

                                        {/* Options / Action Buttons */}
                                        <View style={{ marginTop: 20 }}>
                                            {activeQuizDpp.questions[quizCurrentIndex]?.question_type === 'mcq' ? (
                                                <View>
                                                    {(() => {
                                                        const currentQ = activeQuizDpp.questions[quizCurrentIndex];
                                                        let opts = [];
                                                        try {
                                                            opts = JSON.parse(currentQ.options);
                                                        } catch (e) {
                                                            opts = ["Option A", "Option B", "Option C", "Option D"];
                                                        }
                                                        
                                                        return opts.map((opt) => {
                                                            const optLetter = opt.charAt(0).toUpperCase();
                                                            const optText = opt.substring(2);
                                                            
                                                            const isSelected = quizSelectedOption === optLetter;
                                                            const isCorrect = currentQ.correct_option === optLetter;
                                                            
                                                            let cardBg = 'rgba(255,255,255,0.04)';
                                                            let borderColor = 'rgba(255,255,255,0.06)';
                                                            let iconName = null;
                                                            let iconColor = '#FFF';

                                                            if (isSelected) {
                                                                if (quizOptionCorrectness === 'correct') {
                                                                    cardBg = 'rgba(16,185,129,0.15)';
                                                                    borderColor = 'rgba(16,185,129,0.4)';
                                                                    iconName = 'checkmark-circle';
                                                                    iconColor = '#10B981';
                                                                } else {
                                                                    cardBg = 'rgba(239,68,68,0.15)';
                                                                    borderColor = 'rgba(239,68,68,0.4)';
                                                                    iconName = 'close-circle';
                                                                    iconColor = '#EF4444';
                                                                }
                                                            } else if (quizSelectedOption !== null && isCorrect) {
                                                                cardBg = 'rgba(16,185,129,0.08)';
                                                                borderColor = 'rgba(16,185,129,0.25)';
                                                            }

                                                            return (
                                                                <TouchableOpacity
                                                                    key={optLetter}
                                                                    onPress={() => handleQuizAnswerPress(optLetter)}
                                                                    activeOpacity={0.8}
                                                                    style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: cardBg, paddingHorizontal: 18, paddingVertical: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: borderColor }}
                                                                >
                                                                    <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: isSelected && quizOptionCorrectness === 'correct' ? '#10B981' : isSelected && quizOptionCorrectness === 'wrong' ? '#EF4444' : 'rgba(255,255,255,0.06)', justifyContent: 'center', alignItems: 'center', marginRight: 14 }}>
                                                                        <Text style={{ color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 13 }}>{optLetter}</Text>
                                                                    </View>
                                                                    <Text style={{ color: '#FFF', fontSize: 15, fontFamily: 'Inter-Medium', flex: 1 }}>{optText}</Text>
                                                                    {iconName && <Ionicons name={iconName} size={22} color={iconColor} />}
                                                                </TouchableOpacity>
                                                            );
                                                        });
                                                    })()}
                                                </View>
                                            ) : (
                                                <View style={{ paddingVertical: 10 }}>
                                                    {quizCorrectAnswerRevealed ? (
                                                        <View style={{ backgroundColor: 'rgba(16,185,129,0.08)', borderRadius: 16, padding: 18, borderLeftWidth: 4, borderLeftColor: '#10B981' }}>
                                                            <Text style={{ color: '#10B981', fontFamily: 'Inter-Bold', fontSize: 12, marginBottom: 4 }}>EXPLANATION / SOLUTION</Text>
                                                            <Text style={{ color: '#FFF', fontSize: 14, lineHeight: 20 }}>Please self-check your solution with your peers in the Chat zone.</Text>
                                                        </View>
                                                    ) : (
                                                        <TouchableOpacity 
                                                            onPress={() => {
                                                                setQuizCorrectAnswerRevealed(true);
                                                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                                            }}
                                                            style={{ alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }}
                                                        >
                                                            <Text style={{ color: 'rgba(255,255,255,0.6)', fontFamily: 'Inter-Bold', fontSize: 12 }}>REVEAL EXPLANATION</Text>
                                                        </TouchableOpacity>
                                                    )}
                                                </View>
                                            )}
                                        </View>
                                    </ScrollView>

                                    {(activeQuizDpp.questions[quizCurrentIndex]?.question_type !== 'mcq' || quizSelectedOption !== null) && (
                                        <TouchableOpacity 
                                            onPress={handleQuizNext}
                                            style={{ backgroundColor: '#EF4444', borderRadius: 18, paddingVertical: 14, alignItems: 'center', marginTop: 10 }}
                                        >
                                            <Text style={{ color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 15 }}>
                                                {activeQuizDpp.questions[quizCurrentIndex]?.question_type === 'mcq' ? "NEXT QUESTION" : "MARK RESOLVED & NEXT"}
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                </View>
                            ) : (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
                                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(16,185,129,0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
                                        <Ionicons name="trophy" size={44} color="#10B981" />
                                    </View>
                                    <Text style={{ color: '#FFF', fontSize: 24, fontFamily: 'Inter-ExtraBold', textAlign: 'center', marginBottom: 10 }}>CHALLENGE CLEARED!</Text>
                                    <Text style={{ color: 'rgba(255,255,255,0.6)', fontSize: 14, fontFamily: 'Inter-Medium', textAlign: 'center', marginBottom: 20, paddingHorizontal: 20 }}>
                                        You completed all slide tasks in this daily practice set.
                                    </Text>

                                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.3)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 16, marginBottom: 25 }}>
                                        <Ionicons name="time-outline" size={18} color="#10B981" style={{ marginRight: 6 }} />
                                        <Text style={{ color: '#10B981', fontFamily: 'Inter-Bold', fontSize: 15 }}>
                                            Time Taken: {formatTime(quizTime)}
                                        </Text>
                                    </View>
                                    
                                    {!completedDppIds.has(activeQuizDpp?.id) && (
                                        <View style={{ backgroundColor: 'rgba(245,158,11,0.1)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.3)', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 16, marginBottom: 30 }}>
                                            <Text style={{ color: '#F59E0B', fontFamily: 'Inter-Bold', fontSize: 14, textAlign: 'center' }}>🏆 XP EARNED!</Text>
                                        </View>
                                    )}

                                    <TouchableOpacity 
                                        onPress={handleQuizSubmit}
                                        style={{ width: '100%', backgroundColor: '#EF4444', borderRadius: 18, paddingVertical: 15, alignItems: 'center' }}
                                    >
                                        <Text style={{ color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 16 }}>CLAIM XP & EXIT</Text>
                                    </TouchableOpacity>
                                </View>
                            )}

                            </View>
                        </LinearGradient>
                </Modal>

                {/* Teacher Analytics Modal */}
                <Modal visible={teacherAnalyticsModalVisible} transparent animationType="slide">
                    <LinearGradient colors={modalBgGradient} style={{ flex: 1, paddingTop: insets.top }}>
                        <View style={{ flex: 1 }}>
                                {/* Header */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderColor: modalBorder }}>
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setTeacherAnalyticsModalVisible(false);
                                            setSelectedDppAnalytics(null);
                                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                        }}
                                        style={[styles.iconButton, { backgroundColor: themeIconBtnBg }]}
                                    >
                                        <Ionicons name="close" size={24} color={themeIconColor} />
                                    </TouchableOpacity>
                                    <Text style={[styles.title, { fontSize: 16, letterSpacing: 1, color: modalTitleText }]}>CHALLENGE ANALYTICS</Text>
                                    <View style={{ width: 44 }} />
                                </View>

                                {analyticsLoading ? (
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                        <ActivityIndicator size="large" color="#EF4444" />
                                        <Text style={{ color: themeSubtext, fontFamily: 'Inter-Medium', marginTop: 12 }}>Loading analytics...</Text>
                                    </View>
                                ) : selectedDppAnalytics ? (
                                    <View style={{ flex: 1 }}>
                                        {/* DPP Stats Overview Card */}
                                        <View style={{ margin: 16, padding: 18, backgroundColor: themeCardBg, borderRadius: 24, borderWidth: 1, borderColor: modalBorder }}>
                                            <Text style={{ color: themeText, fontFamily: 'Inter-ExtraBold', fontSize: 18, marginBottom: 6 }}>
                                                {selectedDppAnalytics.dpp_title}
                                            </Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 14 }}>
                                                <Ionicons name="document-text-outline" size={14} color={themeSubtext} />
                                                <Text style={{ color: themeSubtext, fontFamily: 'Inter-SemiBold', fontSize: 12 }}>
                                                    {selectedDppAnalytics.total_questions} Questions • {selectedDppAnalytics.is_mcq ? "MCQ Practice" : "Subjective Practice"}
                                                </Text>
                                            </View>

                                            {/* Submission Ratio */}
                                            {(() => {
                                                const totalStudents = selectedDppAnalytics.students.length;
                                                const completedStudents = selectedDppAnalytics.students.filter(s => s.completed).length;
                                                const completionRate = totalStudents > 0 ? (completedStudents / totalStudents) * 100 : 0;
                                                
                                                return (
                                                    <View>
                                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                                            <Text style={{ color: themeSubtext, fontFamily: 'Inter-Bold', fontSize: 12 }}>COMPLETION RATE</Text>
                                                            <Text style={{ color: '#FBBF24', fontFamily: 'Inter-ExtraBold', fontSize: 12 }}>
                                                                {completedStudents} / {totalStudents} Solved
                                                            </Text>
                                                        </View>
                                                        <AnimatedProgressBar progress={completionRate} color="#EF4444" height={6} />
                                                    </View>
                                                );
                                            })()}
                                        </View>

                                        {/* Students List */}
                                        <Text style={[styles.sectionTitle, { marginLeft: 20, marginBottom: 8, color: themeSubtext }]}>Student Standings</Text>
                                        
                                        {selectedDppAnalytics.students.length === 0 ? (
                                            <View style={{ flex: 0.7, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
                                                <Ionicons name="people-outline" size={48} color={themeSubtext} />
                                                <Text style={{ color: themeSubtext, fontFamily: 'Inter-Bold', fontSize: 15, marginTop: 12, textAlign: 'center' }}>No students in this class group</Text>
                                            </View>
                                        ) : (
                                            <FlatList
                                                data={selectedDppAnalytics.students}
                                                keyExtractor={(item) => String(item.student_id)}
                                                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, gap: 10 }}
                                                renderItem={({ item }) => {
                                                    const initials = item.student_name ? item.student_name.charAt(0).toUpperCase() : '?';
                                                    return (
                                                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, backgroundColor: actionRowBg, borderRadius: 20, borderWidth: 1, borderColor: actionRowBorder }}>
                                                            {/* Avatar */}
                                                            <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E2E8F0', justifyContent: 'center', alignItems: 'center', marginRight: 12, overflow: 'hidden' }}>
                                                                {item.avatar_url ? (
                                                                    <Image source={{ uri: `${API_URL}${item.avatar_url}` }} style={{ width: '100%', height: '100%' }} />
                                                                ) : (
                                                                    <Text style={{ color: isDarkMode ? '#FFF' : '#475569', fontFamily: 'Inter-Bold', fontSize: 16 }}>{initials}</Text>
                                                                )}
                                                            </View>

                                                            {/* Info */}
                                                            <View style={{ flex: 1 }}>
                                                                <Text style={{ color: actionRowTextVal, fontFamily: 'Inter-Bold', fontSize: 15 }} numberOfLines={1}>
                                                                    {item.student_name}
                                                                </Text>
                                                                <Text style={{ color: actionRowSubTextVal, fontFamily: 'Inter-Medium', fontSize: 11, marginTop: 2 }} numberOfLines={1}>
                                                                    {item.student_email}
                                                                </Text>
                                                            </View>

                                                            {/* Completion Status Pillar */}
                                                            <View style={{ alignItems: 'flex-end', marginLeft: 10 }}>
                                                                <View style={{
                                                                    flexDirection: 'row',
                                                                    alignItems: 'center',
                                                                    backgroundColor: item.completed ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.12)',
                                                                    paddingHorizontal: 10,
                                                                    paddingVertical: 5,
                                                                    borderRadius: 10,
                                                                    borderWidth: 1,
                                                                    borderColor: item.completed ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.2)',
                                                                    gap: 4
                                                                }}>
                                                                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: item.completed ? '#10B981' : '#EF4444' }} />
                                                                    <Text style={{
                                                                        color: item.completed ? '#10B981' : '#EF4444',
                                                                        fontFamily: 'Inter-ExtraBold',
                                                                        fontSize: 10,
                                                                        textTransform: 'uppercase',
                                                                        letterSpacing: 0.5
                                                                    }}>
                                                                        {item.completed ? "Completed" : "Pending"}
                                                                    </Text>
                                                                </View>
                                                                {item.completed ? (
                                                                    <View style={{ marginTop: 4, alignItems: 'flex-end' }}>
                                                                        <Text style={{ color: themeSubtext, fontFamily: 'Inter-Bold', fontSize: 11 }}>
                                                                            ⏱️ {formatDuration(item.time_spent_seconds)}
                                                                        </Text>
                                                                        {selectedDppAnalytics.is_mcq && (
                                                                            <Text style={{ color: '#FBBF24', fontFamily: 'Inter-ExtraBold', fontSize: 11, marginTop: 2 }}>
                                                                                🎯 {item.correct_questions} / {selectedDppAnalytics.total_questions} Correct
                                                                            </Text>
                                                                        )}
                                                                    </View>
                                                                ) : (
                                                                    <Text style={{ color: themeSubtext, fontFamily: 'Inter-Medium', fontSize: 10, marginTop: 4 }}>
                                                                        Not attempted
                                                                    </Text>
                                                                )}
                                                            </View>
                                                        </View>
                                                    );
                                                }}
                                            />
                                        )}
                                    </View>
                                ) : (
                                    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                        <Ionicons name="warning-outline" size={36} color="rgba(255,255,255,0.4)" />
                                        <Text style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'Inter-Bold', fontSize: 15, marginTop: 8 }}>Failed to load data</Text>
                                    </View>
                                )}
                            </View>
                        </LinearGradient>
                </Modal>

                {isUploading && (
                    <View style={styles.uploadingOverlay}>
                        <View style={styles.uploadCard}>
                            <ActivityIndicator size="large" color="#EF4444" />
                            <Text style={[styles.uploadingText, { color: '#000', fontFamily: 'Inter-Bold' }]}>Uploading...</Text>
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </LinearGradient>
    );
};

const SW = Dimensions.get('window').width;

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    headerCenter: { alignItems: 'center', flex: 1 },
    title: { fontSize: 20, fontFamily: 'Inter-ExtraBold', color: '#FFF', letterSpacing: 0.5 },
    streakBanner: { marginHorizontal: 16, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(245,158,11,0.2)', borderWidth: 1, borderColor: 'rgba(245,158,11,0.4)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
    streakBannerText: { color: '#FCD34D', fontFamily: 'Inter-Bold', fontSize: 13, flex: 1 },
    xpBarWrap: { marginHorizontal: 16, marginBottom: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
    seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)' },
    section: { marginTop: 20 },
    sectionTitle: { fontSize: 13, fontFamily: 'Inter-ExtraBold', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: 2, marginLeft: 20, marginBottom: 14 },
    arenaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        gap: 12,
    },
    arenaCard: {
        width: (SW - 44) / 2,
        borderRadius: 22,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 8,
    },
    arenaCardGradient: {
        padding: 18,
        minHeight: 160,
        justifyContent: 'space-between',
    },
    arenaZoneBadge: {
        alignSelf: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.25)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    arenaZoneBadgeText: {
        color: 'rgba(255,255,255,0.75)',
        fontFamily: 'Inter-ExtraBold',
        fontSize: 9,
        letterSpacing: 1,
    },
    arenaCardIcon: {
        width: 68,
        height: 68,
        borderRadius: 22,
        backgroundColor: 'rgba(0,0,0,0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
        borderWidth: 1.5,
        borderColor: 'rgba(255,255,255,0.2)',
        shadowColor: '#FFF',
        shadowOpacity: 0.15,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 0 },
    },
    arenaCardName: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 16,
        color: '#FFF',
        marginTop: 12,
        lineHeight: 20,
    },
    arenaCardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 10,
    },
    arenaCardFooterText: {
        fontFamily: 'Inter-Bold',
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
    },
    notesList: { paddingHorizontal: 20, gap: 12 },
    questCard: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16 },
    diffDot: { width: 48, height: 48, borderRadius: 14, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
    questTitle: { fontFamily: 'Inter-Bold', fontSize: 15, color: '#FFF' },
    diffBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
    diffLabel: { fontFamily: 'Inter-ExtraBold', fontSize: 10, letterSpacing: 0.5 },
    xpPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(251,191,36,0.15)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(251,191,36,0.3)', gap: 3 },
    xpText: { fontFamily: 'Inter-ExtraBold', fontSize: 11, color: '#FCD34D' },
    checkbox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    centerState: { height: 160, justifyContent: 'center', alignItems: 'center' },
    emptyText: { fontFamily: 'Inter-Medium', fontSize: 15, color: 'rgba(255,255,255,0.5)', marginTop: 12 },
    fabContainer: { position: 'absolute', bottom: 30, right: 20 },
    fab: { shadowColor: '#000', shadowOffset: {width:0,height:4}, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 },
    fabGradient: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { width: '100%', borderRadius: 32, padding: 24, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    modalTitle: { fontSize: 16, fontFamily: 'Inter-ExtraBold', color: '#FFF', letterSpacing: 2, marginBottom: 24, textAlign: 'center' },
    input: { height: 60, borderRadius: 16, paddingHorizontal: 20, fontFamily: 'Inter-Bold', fontSize: 16, color: '#FFF', backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginBottom: 24 },
    modalActionRow: { flexDirection: 'row', gap: 12 },
    modalCancelBtn: { flex: 1, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    modalCancelText: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#FFF', letterSpacing: 1 },
    modalCreateBtn: { flex: 1, borderRadius: 16, overflow: 'hidden' },
    modalCreateGradient: { flex: 1, justifyContent: 'center', alignItems: 'center', height: 56 },
    modalCreateText: { color: '#FFF', fontFamily: 'Inter-ExtraBold', fontSize: 14, letterSpacing: 1 },
    victoryCard: { width: '100%' },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
    },
    uploadCard: {
        backgroundColor: '#FFF',
        padding: 24,
        borderRadius: 20,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        elevation: 5,
    },
    uploadingText: {
        marginTop: 12,
        fontSize: 14,
    },
    actionModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.85)',
        justifyContent: 'flex-end',
        padding: 16,
    },
    actionModalContent: {
        width: '100%',
        borderRadius: 30,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        paddingBottom: 36,
    },
    actionModalHeader: {
        alignItems: 'center',
        marginBottom: 24,
    },
    actionModalTitle: {
        fontSize: 15,
        fontFamily: 'Inter-ExtraBold',
        color: '#FFF',
        letterSpacing: 2,
        marginBottom: 6,
    },
    actionModalSubtitle: {
        fontSize: 12,
        fontFamily: 'Inter-Medium',
        color: 'rgba(255,255,255,0.45)',
        textAlign: 'center',
    },
    actionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    actionRowIconWrap: {
        width: 50,
        height: 50,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    actionRowText: {
        fontFamily: 'Inter-Bold',
        fontSize: 15,
        color: '#FFF',
    },
    actionRowSub: {
        fontFamily: 'Inter-Medium',
        fontSize: 11,
        color: 'rgba(255,255,255,0.4)',
        marginTop: 2,
    },
    actionModalCancelBtn: {
        height: 56,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginTop: 8,
    },
    actionModalCancelText: {
        fontFamily: 'Inter-Bold',
        fontSize: 13,
        color: '#FFF',
        letterSpacing: 1.5,
    },
    deleteModalContent: {
        width: '90%',
        borderRadius: 32,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        alignSelf: 'center',
        marginAuto: 'auto',
    },
    deleteIconGlow: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    deleteModalTitle: {
        fontSize: 16,
        fontFamily: 'Inter-ExtraBold',
        color: '#FFF',
        letterSpacing: 2,
        marginBottom: 12,
        textAlign: 'center',
    },
    deleteModalDesc: {
        fontSize: 14,
        fontFamily: 'Inter-Medium',
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 20,
        marginBottom: 12,
    },
    deleteWarningText: {
        fontSize: 12,
        fontFamily: 'Inter-Bold',
        color: '#FCA5A5',
        textAlign: 'center',
        lineHeight: 18,
        backgroundColor: 'rgba(239, 68, 68, 0.08)',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.2)',
        marginBottom: 24,
    },
    modalDeleteBtn: {
        flex: 1,
        borderRadius: 16,
        overflow: 'hidden',
    },
    modalDeleteGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        height: 56,
    },
    modalDeleteText: {
        color: '#FFF',
        fontFamily: 'Inter-ExtraBold',
        fontSize: 14,
        letterSpacing: 1,
    },
    // New styles for Combat Status Panel, search bar, folders, and quests
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 18,
        marginHorizontal: 16,
        marginTop: 12,
        paddingHorizontal: 14,
        height: 48,
    },
    searchBarInput: {
        flex: 1,
        height: '100%',
        color: '#FFF',
        fontFamily: 'Inter-Bold',
        fontSize: 14,
    },
    dashboardContainer: {
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 10,
    },
    dashboardCard: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.18)',
    },
    dashboardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dashboardSub: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 11,
        color: '#FCA5A5',
        letterSpacing: 2,
        marginBottom: 4,
    },
    dashboardTitle: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 20,
        color: '#FFF',
    },
    levelBadge: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    levelBadgeLabel: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 9,
        color: '#FFF',
    },
    levelBadgeVal: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 18,
        color: '#FFF',
        lineHeight: 18,
    },
    dashboardDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginVertical: 16,
    },
    dashboardProgressInfo: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 16,
    },
    dashboardStatCol: {
        alignItems: 'center',
    },
    dashboardStatVal: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 16,
        color: '#FFF',
    },
    dashboardStatLabel: {
        fontFamily: 'Inter-Medium',
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.4)',
        marginTop: 4,
    },
    progressBarWrapper: {
        width: '100%',
        alignItems: 'center',
    },
    progressBarBg: {
        width: '100%',
        height: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        backgroundColor: '#EF4444',
        borderRadius: 3,
        shadowColor: '#EF4444',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 5,
    },
    progressBarProgressText: {
        fontFamily: 'Inter-Bold',
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.6)',
        marginTop: 8,
    },
    grimoireCard: {
        width: (SW - 44) / 2,
        borderRadius: 22,
        borderWidth: 1,
        overflow: 'hidden',
        backgroundColor: 'rgba(255, 255, 255, 0.02)',
    },
    grimoireCardGradient: {
        padding: 16,
        minHeight: 160,
        justifyContent: 'space-between',
    },
    grimoireIconContainer: {
        width: 52,
        height: 52,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    grimoireName: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 15,
        color: '#FFF',
        marginTop: 10,
        lineHeight: 18,
    },
    grimoireFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    grimoireFooterText: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 11,
    },
    codexCard: {
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    codexRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    codexStatusBadge: {
        width: 44,
        height: 44,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    codexStatusBadgePending: {
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
    },
    codexStatusBadgeDone: {
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
    },
    codexInfo: {
        flex: 1,
        marginLeft: 14,
        marginRight: 10,
    },
    codexTitle: {
        fontFamily: 'Inter-Bold',
        fontSize: 15,
        color: '#FFF',
    },
    codexBadgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    codexXpPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(251, 191, 36, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: 'rgba(251, 191, 36, 0.25)',
    },
    codexXpText: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 10,
        color: '#FCD34D',
        marginLeft: 3,
    },
    codexTimePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        gap: 3,
    },
    codexTimeText: {
        fontFamily: 'Inter-Bold',
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.5)',
    },
    codexClassProgressPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 0.5,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        gap: 3,
    },
    codexClassProgressText: {
        fontFamily: 'Inter-Bold',
        fontSize: 10,
        color: 'rgba(255, 255, 255, 0.5)',
    },
    codexActionBtn: {
        paddingHorizontal: 12,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 64,
    },
    codexActionBtnDone: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    codexActionBtnText: {
        color: '#EF4444',
        fontFamily: 'Inter-ExtraBold',
        fontSize: 11,
        letterSpacing: 0.5,
    }
});

export default DPPScreen;


