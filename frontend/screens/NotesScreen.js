import React, { useCallback, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Modal, TextInput, ScrollView, Alert, Animated, Dimensions } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { getNotes, getMe, getFolders, createFolder, uploadFile, uploadNote, uploadImagesToPdf, API_URL, sendHeartbeat, toggleNoteComplete, getCompletionStatus, deleteFolder, deleteNote, logNoteTime, getNoteAnalytics } from '../api/api';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import * as WebBrowser from 'expo-web-browser';
import { LinearGradient } from 'expo-linear-gradient';
import Constants from 'expo-constants';
import { isOnline, downloadNote, openLocalNote, isNoteDownloaded, savePermanentCache, getPermanentCache } from '../utils/offlineManager';

const SW = Dimensions.get('window').width;

const ARENA_COLORS = [
    ['#F97316', '#C2410C'],
    ['#7C3AED', '#4C1D95'],
    ['#0369A1', '#0C4A6E'],
    ['#065F46', '#022C22'],
    ['#BE185D', '#831843'],
    ['#B45309', '#78350F'],
];

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

const NotesScreen = ({ navigation, route }) => {
    const insets = useSafeAreaInsets();
    const folder = route.params?.folder;
    const [notes, setNotes] = useState([]);
    const [folders, setFolders] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const { isDarkMode } = useTheme();

    const [selectedClassId, setSelectedClassId] = useState(null);
    const [completedNoteIds, setCompletedNoteIds] = useState(new Set());
    const [noteXp, setNoteXp] = useState(0);
    const [globalTotalNotes, setGlobalTotalNotes] = useState(0);
    const [togglingId, setTogglingId] = useState(null);
    const [downloadedNotes, setDownloadedNotes] = useState({});
    const [downloadingNoteId, setDownloadingNoteId] = useState(null);

    const [isUploading, setIsUploading] = useState(false);
    const [uploadModalVisible, setUploadModalVisible] = useState(false);
    const [deleteModalVisible, setDeleteModalVisible] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState(null);
    const [deleteNoteModalVisible, setDeleteNoteModalVisible] = useState(false);
    const [noteToDelete, setNoteToDelete] = useState(null);
    const [recentNotes, setRecentNotes] = useState([]);
    const [savedNoteTimes, setSavedNoteTimes] = useState({});

    // Teacher Options & Analytics Modals
    const [selectedTeacherNote, setSelectedTeacherNote] = useState(null);
    const [teacherOptionsVisible, setTeacherOptionsVisible] = useState(false);
    const [analyticsVisible, setAnalyticsVisible] = useState(false);
    const [analyticsData, setAnalyticsData] = useState(null);
    const [analyticsLoading, setAnalyticsLoading] = useState(false);
    const [analyticsSearchQuery, setAnalyticsSearchQuery] = useState('');
    
    const hasStreakBonus = (user?.streak_count || 0) > 0 && (user?.streak_count || 0) % 6 === 0;

    const formatNoteTime = (totalSeconds) => {
        if (totalSeconds < 60) {
            return `${totalSeconds}s`;
        }
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        if (mins < 60) {
            return `${mins}m ${secs}s`;
        }
        const hrs = Math.floor(mins / 60);
        const remainingMins = mins % 60;
        return `${hrs}h ${remainingMins}m`;
    };

    const loadSavedNoteTimes = async (noteList, recentList = []) => {
        const times = {};
        const allNotes = [...noteList, ...recentList];
        for (const note of allNotes) {
            try {
                const t = await AsyncStorage.getItem('note_time_spent_' + note.id);
                if (t !== null) {
                    times[note.id] = parseInt(t, 10);
                }
            } catch (e) {
                console.log("Error loading note time:", e);
            }
        }
        setSavedNoteTimes(times);
    };
    
    // Naming modal states
    const [namingModalVisible, setNamingModalVisible] = useState(false);
    const [pendingName, setPendingName] = useState('');
    const [pendingAsset, setPendingAsset] = useState(null);
    const [pendingAssets, setPendingAssets] = useState(null);
    const [isImagesNaming, setIsImagesNaming] = useState(false);

    // Premium Archive Gamification Colors
    const bgGradient = isDarkMode ? ['#080914', '#11132A', '#03040A'] : ['#F8FAFC', '#F1F5F9', '#F8FAFC'];
    const themeText = isDarkMode ? '#FFF' : '#0F172A';
    const themeSubtext = isDarkMode ? 'rgba(255, 255, 255, 0.45)' : '#64748B';
    const themeCardBg = isDarkMode ? 'rgba(255, 255, 255, 0.02)' : '#FFFFFF';
    const themeCardBorder = isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0';
    const themeIconBtnBg = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : '#F1F5F9';
    const themeIconColor = isDarkMode ? '#FFF' : '#475569';
    const glassBg = 'rgba(255, 255, 255, 0.05)';
    const glassBorder = 'rgba(255, 255, 255, 0.1)';

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


    const checkDownloadedStatus = async (notesList) => {
        const dlMap = {};
        for (const note of notesList) {
            dlMap[note.id] = await isNoteDownloaded(note.id);
        }
        setDownloadedNotes(dlMap);
    };

    const fetchData = async (q = searchQuery) => {
        setLoading(true);
        try {
            const classIdStr = await AsyncStorage.getItem('selectedClassGroupId');
            const classId = classIdStr ? Number(classIdStr) : null;
            setSelectedClassId(classId);

            const cacheKey = 'notes_cache_' + (folder ? folder.id : 'root');
            const cachedData = await getPermanentCache(cacheKey);
            let hasCache = false;
            if (cachedData) {
                try {
                    const parsed = JSON.parse(cachedData);
                    setNotes(parsed.notes || []);
                    setFolders(parsed.folders || []);
                    setCompletedNoteIds(new Set(parsed.completed || []));
                    setNoteXp(parsed.xp || 0);
                    if (parsed.globalTotalNotes !== undefined) setGlobalTotalNotes(parsed.globalTotalNotes);
                    
                    const recentStr = await AsyncStorage.getItem('recent_notes_v1') || '[]';
                    const recents = JSON.parse(recentStr);
                    const recs = recents.filter(n => Date.now() - n.openedAt < 24 * 60 * 60 * 1000);
                    setRecentNotes(recs);
                    
                    await loadSavedNoteTimes(parsed.notes || [], recs);
                    await checkDownloadedStatus(parsed.notes || []);
                    setLoading(false); // Instantly stop loading spinner
                    hasCache = true;
                } catch (e) {
                    console.log("Error parsing cache", e);
                }
            }

            const online = await isOnline();
            if (!online) {
                if (!hasCache) {
                    Alert.alert("Offline", "No internet connection and no cached notes available.");
                    setLoading(false);
                }
                return;
            }

            const userRes = await getMe();
            setUser(userRes.data);
            const batchId = userRes.data.batch_id;
            
            if (batchId) {
                if ((userRes.data.role === 'admin' || userRes.data.role === 'teacher') && !classId) {
                    setNotes([]); setFolders([]); setLoading(false); return;
                }
                const queryClassId = (userRes.data.role === 'admin' || userRes.data.role === 'teacher') ? classId : null;
                const fetchArr = [
                    getNotes(batchId, queryClassId, folder?.id, q),
                    getFolders(batchId, queryClassId, folder?.id, q, 'notes'),
                ];
                if (userRes.data.role === 'student') fetchArr.push(getCompletionStatus());

                const results = await Promise.all(fetchArr);
                const fetchedNotes = results[0].data;
                const fetchedFolders = results[1].data;
                setNotes(fetchedNotes);
                setFolders(fetchedFolders);
                
                let completedArr = [];
                let xp = 0;
                let globalNotes = 0;
                if (userRes.data.role === 'student' && results[2]) {
                    completedArr = results[2].data.completed_note_ids;
                    xp = results[2].data.note_xp || 0;
                    globalNotes = results[2].data.total_notes || 0;
                    setCompletedNoteIds(new Set(completedArr));
                    setNoteXp(xp);
                    setGlobalTotalNotes(globalNotes);
                }

                const cacheKey = 'notes_cache_' + (folder ? folder.id : 'root');
                await savePermanentCache(cacheKey, {
                    notes: fetchedNotes,
                    folders: fetchedFolders,
                    completed: completedArr,
                    xp: xp,
                    globalTotalNotes: globalNotes
                });

                let recs = [];
                if (!folder) {
                    const recentStr = await AsyncStorage.getItem('recent_notes_v1') || '[]';
                    const recents = JSON.parse(recentStr);
                    // Purge deleted notes from recents by cross-checking with server-fetched IDs
                    const allFetchedNoteIds = new Set(fetchedNotes.map(n => n.id));
                    const cleanedRecents = recents.filter(n =>
                        Date.now() - n.openedAt < 24 * 60 * 60 * 1000 &&
                        allFetchedNoteIds.has(n.id)
                    );
                    if (cleanedRecents.length !== recents.length) {
                        await AsyncStorage.setItem('recent_notes_v1', JSON.stringify(cleanedRecents));
                    }
                    recs = cleanedRecents;
                    setRecentNotes(recs);
                }
                await loadSavedNoteTimes(fetchedNotes, recs);
                await checkDownloadedStatus(fetchedNotes);
            }
        } catch (err) {
            console.log("Fetch Error:", err);
            Alert.alert("Network Error", "Could not fetch data. Try opening an offline folder.");
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
            const action = folder ? `Studying in ${folder.name}` : 'Browsing Class Notes';
            sendHeartbeat(action).catch(console.log);
            const interval = setInterval(() => sendHeartbeat(action).catch(console.log), 1000);
            return () => clearInterval(interval);
        }, [folder])
    );

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            await createFolder({ name: newFolderName, batch_id: user.batch_id, class_group_id: selectedClassId, parent_id: folder?.id, folder_type: 'notes' });
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
            await deleteFolder(folderToDelete.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Clean up notes belonging to deleted folder from recents
            const recentStr = await AsyncStorage.getItem('recent_notes_v1') || '[]';
            let recents = JSON.parse(recentStr);
            recents = recents.filter(n => n.folder_id !== folderToDelete.id);
            await AsyncStorage.setItem('recent_notes_v1', JSON.stringify(recents));
            if (!folder) {
                setRecentNotes(recents.filter(n => Date.now() - n.openedAt < 24 * 60 * 60 * 1000));
            }

            fetchData();
        } catch (err) {
            Alert.alert("Error", "Could not delete vault");
        } finally {
            setFolderToDelete(null);
        }
    };

    const handleDeleteNotePress = (noteItem) => {
        if (user?.role !== 'admin' && user?.role !== 'teacher') return;
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        setNoteToDelete(noteItem);
        setDeleteNoteModalVisible(true);
    };

    const confirmDeleteNote = async () => {
        if (!noteToDelete) return;
        setDeleteNoteModalVisible(false);
        try {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
            await deleteNote(noteToDelete.id);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            
            // Clean up from recent notes
            const recentStr = await AsyncStorage.getItem('recent_notes_v1') || '[]';
            let recents = JSON.parse(recentStr);
            recents = recents.filter(n => n.id !== noteToDelete.id);
            await AsyncStorage.setItem('recent_notes_v1', JSON.stringify(recents));
            if (!folder) {
                setRecentNotes(recents.filter(n => Date.now() - n.openedAt < 24 * 60 * 60 * 1000));
            }

            fetchData();
        } catch (err) {
            Alert.alert("Error", "Could not delete note");
        } finally {
            setNoteToDelete(null);
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
                setIsImagesNaming(false);
                setNamingModalVisible(true);
            }
        } catch (err) {
            console.log(err);
        }
    };

    const pickImages = async () => {
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
            setPendingName(`${folder ? folder.name : 'Class'} Notes - ${new Date().toLocaleDateString()}`);
            setIsImagesNaming(true);
            setNamingModalVisible(true);
        }
    };

    const handleNamingSubmit = () => {
        if (!pendingName.trim()) {
            Alert.alert("Error", "Please enter a name");
            return;
        }
        if (isImagesNaming) {
            uploadPickedImages(pendingAssets, pendingName.trim());
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
            await uploadNote({
                title: customName,
                file_url: uploadRes.data.file_url,
                batch_id: user.batch_id,
                class_group_id: selectedClassId,
                folder_id: folder?.id || null
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchData();
        } catch (error) {
            console.log("Upload Note Error:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const detailMsg = error.response?.data?.detail || error.message || "Failed to upload note";
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
            await uploadNote({
                title: customName,
                file_url: uploadRes.data.file_url,
                batch_id: user.batch_id,
                class_group_id: selectedClassId,
                folder_id: folder?.id || null
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchData();
        } catch (error) {
            console.log("Upload Images Error:", error);
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            const detailMsg = error.response?.data?.detail || error.message || "Failed to convert and upload images";
            Alert.alert("Error", typeof detailMsg === 'string' ? detailMsg : JSON.stringify(detailMsg));
        } finally {
            setIsUploading(false);
        }
    };

    const handleAddContentPress = () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setUploadModalVisible(true);
    };

    const handleDownloadNote = async (noteItem, e) => {
        e.stopPropagation?.();
        if (downloadingNoteId === noteItem.id) return;
        setDownloadingNoteId(noteItem.id);
        try {
            await downloadNote(noteItem);
            setDownloadedNotes(prev => ({ ...prev, [noteItem.id]: true }));
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            // Open the PDF in-app immediately after download
            navigation.navigate('PdfViewer', {
                pdfUrl: `${API_URL}${noteItem.file_url}`,
                title: noteItem.title,
                userIdentifier: user?.phone || user?.name || user?.email || 'STUDENT',
                noteId: noteItem.id
            });
        } catch (err) {
            Alert.alert("Download Failed", "Please check your connection and try again.");
        } finally {
            setDownloadingNoteId(null);
        }
    };

    const handleViewNote = async (note) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const isLocal = await isNoteDownloaded(note.id);

            if (isLocal) {
                // Open the locally-downloaded file directly in the in-app PDF viewer
                const localPath = await openLocalNote(note.id);
                navigation.navigate('PdfViewer', {
                    pdfUrl: localPath,
                    title: note.title,
                    userIdentifier: user?.phone || user?.name || user?.email || 'STUDENT',
                    noteId: note.id
                });
            } else {
                const online = await isOnline();
                if (!online) {
                    Alert.alert("Offline", "You need an internet connection to view this note or download it first.");
                    return;
                }
                navigation.navigate('PdfViewer', {
                    pdfUrl: `${API_URL}${note.file_url}`,
                    title: note.title,
                    userIdentifier: user?.phone || user?.name || user?.email || 'STUDENT',
                    noteId: note.id
                });
            }

            // Update recents list
            const recentStr = await AsyncStorage.getItem('recent_notes_v1') || '[]';
            let recents = JSON.parse(recentStr);
            recents = recents.filter(n => n.id !== note.id);
            recents.unshift({ ...note, openedAt: Date.now() });
            recents = recents.slice(0, 20);
            await AsyncStorage.setItem('recent_notes_v1', JSON.stringify(recents));
            if (!folder) {
                setRecentNotes(recents.filter(n => Date.now() - n.openedAt < 24 * 60 * 60 * 1000));
            }
        } catch (error) {
            Alert.alert("Error", "Could not open note");
        }
    };

    const fetchNoteAnalytics = async (noteId, silent = false) => {
        if (!silent) setAnalyticsLoading(true);
        try {
            const res = await getNoteAnalytics(noteId);
            setAnalyticsData(res.data);
        } catch (err) {
            console.log("Error loading note analytics:", err);
            if (!silent) Alert.alert("Error", "Could not load note analytics");
        } finally {
            if (!silent) setAnalyticsLoading(false);
        }
    };

    // Live polling for analytics when modal is open
    useEffect(() => {
        let interval;
        if (analyticsVisible && selectedTeacherNote) {
            interval = setInterval(() => {
                fetchNoteAnalytics(selectedTeacherNote.id, true);
            }, 5000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [analyticsVisible, selectedTeacherNote]);

    const handleToggleNoteComplete = async (noteId, e) => {
        e.stopPropagation?.();
        if (togglingId === noteId) return;
        setTogglingId(noteId);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        try {
            const res = await toggleNoteComplete(noteId);
            setCompletedNoteIds(prev => {
                const next = new Set(prev);
                if (res.data.completed) { 
                    next.add(noteId); 
                } else { 
                    next.delete(noteId); 
                }
                if (res.data.new_note_xp !== undefined) {
                    setNoteXp(res.data.new_note_xp);
                }
                return next;
            });
        } catch (err) { console.log(err); } finally { setTogglingId(null); }
    };

    const renderDashboard = () => {
        if (!user || folder) return null;
        if (user?.role === 'teacher' || user?.role === 'admin') return null;
        
        // Use global counts for the dashboard to accurately show overall mastery
        const completedCount = completedNoteIds.size;
        const totalCount = globalTotalNotes;
        const librarianLevel = Math.max(1, Math.floor(completedCount / 3) + 1);
        
        return (
            <View style={styles.dashboardContainer}>
                <LinearGradient 
                    colors={isDarkMode ? ['rgba(99, 102, 241, 0.15)', 'rgba(99, 102, 241, 0.02)'] : ['rgba(99, 102, 241, 0.08)', 'rgba(99, 102, 241, 0.01)']} 
                    style={[styles.dashboardCard, { borderColor: isDarkMode ? 'rgba(99, 102, 241, 0.18)' : 'rgba(99, 102, 241, 0.12)', backgroundColor: themeCardBg }]}
                >
                    <View style={styles.dashboardTopRow}>
                        <View>
                            <Text style={[styles.dashboardSub, { color: isDarkMode ? '#818CF8' : '#4F46E5' }]}>{(Constants.expoConfig?.name?.toUpperCase() || 'ACADEMY')} VAULT</Text>
                            <Text style={[styles.dashboardTitle, { color: themeText }]}>Archive of Knowledge</Text>
                        </View>
                    </View>

                    <View style={[styles.dashboardDivider, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0' }]} />

                    <View style={styles.dashboardProgressInfo}>
                        <View style={styles.dashboardStatCol}>
                            <Text style={[styles.dashboardStatVal, { color: themeText }]}>⭐ {noteXp} XP</Text>
                            <Text style={[styles.dashboardStatLabel, { color: themeSubtext }]}>Notes XP</Text>
                        </View>
                        <View style={styles.dashboardStatCol}>
                            <Text style={[styles.dashboardStatVal, { color: themeText }]}>📖 {completedCount} / {totalCount}</Text>
                            <Text style={[styles.dashboardStatLabel, { color: themeSubtext }]}>Notes Completed</Text>
                        </View>
                    </View>

                    <View style={styles.progressBarWrapper}>
                        <View style={[styles.progressBarBg, { backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : '#E2E8F0' }]}>
                            <View 
                                style={[
                                    styles.progressBarFill, 
                                    { backgroundColor: '#818CF8', shadowColor: '#818CF8', width: `${totalCount > 0 ? (completedCount / totalCount) * 100 : 0}%` }
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
                accent: '#818CF8', // Indigo
                borderGlow: isDarkMode ? 'rgba(129, 140, 248, 0.35)' : 'rgba(129, 140, 248, 0.25)',
                cardGradient: isDarkMode ? ['rgba(129, 140, 248, 0.15)', 'rgba(129, 140, 248, 0.02)'] : ['rgba(129, 140, 248, 0.08)', 'rgba(129, 140, 248, 0.02)'],
            },
            {
                accent: '#A855F7', // Purple
                borderGlow: isDarkMode ? 'rgba(168, 85, 247, 0.35)' : 'rgba(168, 85, 247, 0.25)',
                cardGradient: isDarkMode ? ['rgba(168, 85, 247, 0.15)', 'rgba(168, 85, 247, 0.02)'] : ['rgba(168, 85, 247, 0.08)', 'rgba(168, 85, 247, 0.02)'],
            },
            {
                accent: '#10B981', // Emerald
                borderGlow: isDarkMode ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.25)',
                cardGradient: isDarkMode ? ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.02)'] : ['rgba(16, 185, 129, 0.08)', 'rgba(16, 185, 129, 0.02)'],
            },
            {
                accent: '#FBBF24', // Amber/Gold
                borderGlow: isDarkMode ? 'rgba(251, 191, 36, 0.35)' : 'rgba(251, 191, 36, 0.25)',
                cardGradient: isDarkMode ? ['rgba(251, 191, 36, 0.15)', 'rgba(251, 191, 36, 0.02)'] : ['rgba(251, 191, 36, 0.08)', 'rgba(251, 191, 36, 0.02)'],
            },
            {
                accent: '#06B6D4', // Cyan
                borderGlow: isDarkMode ? 'rgba(6, 182, 212, 0.35)' : 'rgba(6, 182, 212, 0.25)',
                cardGradient: isDarkMode ? ['rgba(6, 182, 212, 0.15)', 'rgba(6, 182, 212, 0.02)'] : ['rgba(6, 182, 212, 0.08)', 'rgba(6, 182, 212, 0.02)'],
            },
            {
                accent: '#EC4899', // Pink
                borderGlow: isDarkMode ? 'rgba(236, 72, 153, 0.35)' : 'rgba(236, 72, 153, 0.25)',
                cardGradient: isDarkMode ? ['rgba(236, 72, 153, 0.15)', 'rgba(236, 72, 153, 0.02)'] : ['rgba(236, 72, 153, 0.08)', 'rgba(236, 72, 153, 0.02)'],
            },
            {
                accent: '#FB923C', // Orange
                borderGlow: isDarkMode ? 'rgba(251, 146, 60, 0.35)' : 'rgba(251, 146, 60, 0.25)',
                cardGradient: isDarkMode ? ['rgba(251, 146, 60, 0.15)', 'rgba(251, 146, 60, 0.02)'] : ['rgba(251, 146, 60, 0.08)', 'rgba(251, 146, 60, 0.02)'],
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
            <AnimatedListItem index={index || 0} key={folderItem.id}>
                <TouchableOpacity
                    activeOpacity={0.82}
                    onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                        navigation.push('NotesScreen', { folder: folderItem });
                    }}
                    onLongPress={() => handleDeleteFolder(folderItem)}
                    style={[styles.grimoireCard, { borderColor: theme.borderGlow, backgroundColor: themeCardBg }]}
                >
                    <LinearGradient colors={theme.cardGradient} style={styles.grimoireCardGradient}>
                        <View style={[styles.grimoireIconContainer, { borderColor: theme.borderGlow, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.02)' }]}>
                            <Ionicons name="folder-open" size={24} color={theme.accent} />
                        </View>
                        <Text style={[styles.grimoireName, { color: themeText }]} numberOfLines={2}>{folderItem.name}</Text>
                        <View style={styles.grimoireFooter}>
                            <Ionicons name="book-outline" size={13} color={theme.accent} />
                            <Text style={[styles.grimoireFooterText, { color: theme.accent }]}>Open Vault</Text>
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </AnimatedListItem>
        );
    };

    const renderNote = ({ item, index }) => {
        const isDone = completedNoteIds.has(item.id);
        const isBusy = togglingId === item.id;
        const isStudent = user?.role === 'student';
        const readingTime = Math.max(3, Math.min(15, Math.floor((item.title || "").length / 4))); 
        const classProgressVal = Math.round(70 + (item.id % 25));

        return (
            <AnimatedListItem index={index || 0}>
                <TouchableOpacity 
                    activeOpacity={0.8} 
                    onPress={() => {
                        if (user?.role === 'admin' || user?.role === 'teacher') {
                            setSelectedTeacherNote(item);
                            setTeacherOptionsVisible(true);
                        } else {
                            handleViewNote(item);
                        }
                    }}
                    onLongPress={() => handleDeleteNotePress(item)}
                >
                    <LinearGradient 
                        colors={isDone 
                            ? (isDarkMode ? ['rgba(16, 185, 129, 0.15)', 'rgba(16, 185, 129, 0.02)'] : ['rgba(16, 185, 129, 0.08)', 'rgba(16, 185, 129, 0.01)'])
                            : (isDarkMode ? ['rgba(255, 255, 255, 0.04)', 'rgba(0,0,0,0.15)'] : ['#FFFFFF', '#FAF5F5'])}
                        style={[styles.codexCard, { borderColor: isDone ? '#10B981' : themeCardBorder }]}
                    >
                        <View style={styles.codexRow}>
                            <View style={[styles.codexStatusBadge, isDone ? styles.codexStatusBadgeDone : styles.codexStatusBadgePending, { backgroundColor: isDone ? (isDarkMode ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)') : (isDarkMode ? 'rgba(129, 140, 248, 0.1)' : 'rgba(129, 140, 248, 0.05)') }]}>
                                <Ionicons name={isDone ? "checkmark-done-circle" : "book-outline"} size={22} color={isDone ? "#10B981" : "#818CF8"} />
                            </View>
                            
                            <View style={styles.codexInfo}>
                                <Text style={[styles.codexTitle, { color: themeText }]} numberOfLines={1}>{item.title}</Text>
                                <View style={styles.codexBadgesRow}>
                                    <View style={[styles.codexXpPill, { backgroundColor: isDarkMode ? 'rgba(251, 191, 36, 0.15)' : 'rgba(251, 191, 36, 0.06)' }]}>
                                        <Ionicons name="sparkles" size={11} color="#FBBF24" />
                                        <Text style={styles.codexXpText}>+{Math.floor(20 * (hasStreakBonus ? 2 : 1) * (user?.xp_booster_multiplier || 1.0))} XP</Text>
                                    </View>
                                </View>
                            </View>

                            {isStudent ? (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    {!downloadedNotes[item.id] ? (
                                        <TouchableOpacity 
                                            onPress={(e) => handleDownloadNote(item, e)}
                                            style={{ padding: 6, backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#F1F5F9', borderRadius: 8 }}
                                        >
                                            {downloadingNoteId === item.id ? (
                                                <ActivityIndicator size="small" color="#818CF8" />
                                            ) : (
                                                <Ionicons name="cloud-download-outline" size={20} color={isDarkMode ? 'rgba(255,255,255,0.6)' : '#64748B'} />
                                            )}
                                        </TouchableOpacity>
                                    ) : (
                                        <View style={{ padding: 6 }}>
                                            <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                                        </View>
                                    )}
                                    <TouchableOpacity
                                        onPress={(e) => handleToggleNoteComplete(item.id, e)}
                                        style={[styles.codexActionBtn, isDone && styles.codexActionBtnDone, { backgroundColor: isDone ? '#10B981' : (isDarkMode ? 'rgba(129, 140, 248, 0.15)' : 'rgba(129, 140, 248, 0.1)'), borderColor: isDone ? '#10B981' : (isDarkMode ? 'rgba(129, 140, 248, 0.3)' : 'rgba(129, 140, 248, 0.2)') }]}
                                    >
                                        {isBusy ? <ActivityIndicator size="small" color="#FFF" /> : 
                                         isDone ? <Ionicons name="checkmark-done" size={18} color="#FFF" /> : 
                                         <Text style={[styles.codexActionBtnText, { color: isDarkMode ? '#818CF8' : '#4F46E5' }]}>READ</Text>}
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <Ionicons name="chevron-forward" size={18} color={isDarkMode ? "rgba(255,255,255,0.25)" : "#94A3B8"} />
                            )}
                        </View>
                    </LinearGradient>
                </TouchableOpacity>
            </AnimatedListItem>
        );
    };

    const getDisplayNotes = () => {
        if (folder) {
            return notes;
        } else {
            if (searchQuery) {
                return notes;
            }
            const rootNotes = notes.filter(n => n.folder_id === null);
            const validRecent = recentNotes.filter(rn => rn.folder_id !== null && (Date.now() - rn.openedAt < 24 * 60 * 60 * 1000));
            const merged = [...rootNotes];
            validRecent.forEach(rn => {
                if (!merged.some(m => m.id === rn.id)) {
                    merged.push(rn);
                }
            });
            return merged;
        }
    };
    const displayNotes = getDisplayNotes();
    const filteredFolders = folders.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const filteredNotes = displayNotes.filter(n => n.title.toLowerCase().includes(searchQuery.toLowerCase()));

    // Progress Bar Logic
    const totalNotes = notes.length;
    const completedNotes = notes.filter(n => completedNoteIds.has(n.id)).length;
    const progressPercent = totalNotes > 0 ? (completedNotes / totalNotes) * 100 : 0;

    return (
        <LinearGradient colors={bgGradient} style={styles.container}>
            <SafeAreaView style={{ flex: 1 }}>
                
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={[styles.iconButton, { backgroundColor: themeIconBtnBg }]}>
                        <Ionicons name="chevron-back" size={24} color={themeIconColor} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={[styles.title, { color: themeText }]}>{folder ? folder.name : 'Class Notes'}</Text>
                        {user?.role === 'student' && totalNotes > 0 && (
                            <View style={styles.progressContainer}>
                                <AnimatedProgressBar progress={progressPercent} color="#10B981" />
                            </View>
                        )}
                    </View>
                    <View style={{ width: 44 }} />
                </View>
                
                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                    
                    {renderDashboard()}

                    {!folder && (
                        <View style={[styles.searchBarContainer, { backgroundColor: themeCardBg, borderColor: themeCardBorder }]}>
                            <Ionicons name="search-outline" size={18} color={isDarkMode ? 'rgba(255, 255, 255, 0.4)' : '#64748B'} style={{ marginRight: 8 }} />
                            <TextInput 
                                style={[styles.searchBarInput, { color: themeText }]} 
                                placeholder="Search vaults or codexes..." 
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

                    {filteredFolders.length > 0 && (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : '#64748B' }]}>Vaults</Text>
                            <View style={styles.arenaGrid}>
                                {filteredFolders.map((f, i) => renderFolder(f, i))}
                            </View>
                        </View>
                    )}

                    {loading ? (
                        <View style={styles.centerState}><ActivityIndicator size="large" color="#818CF8" /></View>
                    ) : (
                        <View style={styles.section}>
                            <Text style={[styles.sectionTitle, { color: isDarkMode ? 'rgba(255, 255, 255, 0.45)' : '#64748B' }]}>Available Quests</Text>
                            
                            <View style={styles.notesList}>
                                {filteredNotes.length > 0 ? (
                                    filteredNotes.map((note, index) => <View key={note.id}>{renderNote({ item: note, index })}</View>)
                                ) : (
                                    <View style={styles.centerState}>
                                        <Ionicons name="shield-checkmark" size={60} color={isDarkMode ? "rgba(255,255,255,0.1)" : "#CBD5E1"} />
                                        <Text style={[styles.emptyText, { color: isDarkMode ? 'rgba(255,255,255,0.5)' : '#64748B' }]}>All quests completed!</Text>
                                    </View>
                                )}
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
                            <LinearGradient colors={['#FBBF24', '#D97706']} style={styles.fabGradient}>
                                <Ionicons name="add" size={32} color="#000" />
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                )}


                {/* Create Vault Modal */}
                <Modal visible={modalVisible} transparent animationType="fade">
                    <TouchableOpacity style={[styles.modalOverlay, { backgroundColor: modalOverlayBg }]} activeOpacity={1} onPress={() => setModalVisible(false)}>
                        <LinearGradient colors={modalBgGradient} style={[styles.modalContent, { borderColor: modalBorder }]}>
                            <Text style={[styles.modalTitle, { color: modalTitleText }]}>CREATE VAULT</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: modalInputBg, color: modalInputText, borderColor: modalInputBorder }]} 
                                placeholder="Vault Name..." 
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
                                    <LinearGradient colors={['#FBBF24', '#D97706']} style={styles.modalCreateGradient}>
                                        <Text style={styles.modalCreateText}>CREATE</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
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
                                <Text style={[styles.actionModalTitle, { color: modalTitleText }]}>UPLOAD NOTES</Text>
                                <Text style={[styles.actionModalSubtitle, { color: themeSubtext }]}>Select a method to publish new study material</Text>
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
                            <Text style={[styles.modalTitle, { color: modalTitleText }]}>NAME YOUR NOTE</Text>
                            <TextInput 
                                style={[styles.input, { backgroundColor: modalInputBg, color: modalInputText, borderColor: modalInputBorder }]} 
                                placeholder="Note Name..." 
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
                                    <LinearGradient colors={['#FBBF24', '#D97706']} style={styles.modalCreateGradient}>
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
                                <Ionicons name="trash-bin" size={32} color="#EF4444" />
                            </View>
                            
                            <Text style={[styles.deleteModalTitle, { color: modalTitleText }]}>DELETE VAULT</Text>
                            <Text style={[styles.deleteModalDesc, { color: deleteDescColor }]}>
                                Are you sure you want to delete <Text style={{ color: deleteDescHighlight, fontFamily: 'Inter-Bold' }}>"{folderToDelete?.name}"</Text> and all its contents?
                            </Text>
                            <Text style={[styles.deleteWarningText, { color: deleteWarningTextVal, backgroundColor: deleteWarningBg, borderColor: deleteWarningBorder }]}>
                                ⚠️ This action will permanently remove all sub-vaults, notes, and files inside it. This cannot be undone.
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
                                        <Text style={styles.modalDeleteText}>DELETE</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </Modal>

                {/* Custom Delete Note Confirmation Modal */}
                <Modal visible={deleteNoteModalVisible} transparent animationType="fade">
                    <TouchableOpacity 
                        style={[styles.actionModalOverlay, { backgroundColor: modalOverlayBg }]} 
                        activeOpacity={1} 
                        onPress={() => setDeleteNoteModalVisible(false)}
                    >
                        <LinearGradient colors={modalBgGradient} style={[styles.deleteModalContent, { borderColor: modalBorder }]}>
                            <View style={styles.deleteIconGlow}>
                                <Ionicons name="trash" size={32} color="#EF4444" />
                            </View>
                            
                            <Text style={[styles.deleteModalTitle, { color: modalTitleText }]}>DELETE NOTE</Text>
                            <Text style={[styles.deleteModalDesc, { color: deleteDescColor }]}>
                                Are you sure you want to delete the PDF <Text style={{ color: deleteDescHighlight, fontFamily: 'Inter-Bold' }}>"{noteToDelete?.title}"</Text>?
                            </Text>
                            <Text style={[styles.deleteWarningText, { color: deleteWarningTextVal, backgroundColor: deleteWarningBg, borderColor: deleteWarningBorder }]}>
                                ⚠️ This file will be permanently deleted and students will no longer be able to access it.
                            </Text>
                            
                            <View style={styles.modalActionRow}>
                                <TouchableOpacity 
                                    onPress={() => setDeleteNoteModalVisible(false)} 
                                    style={[styles.modalCancelBtn, { backgroundColor: modalCancelBg, borderColor: modalCancelBorder }]}
                                >
                                    <Text style={[styles.modalCancelText, { color: modalCancelTextVal }]}>CANCEL</Text>
                                </TouchableOpacity>
                                <TouchableOpacity 
                                    onPress={confirmDeleteNote} 
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

                {/* Teacher Action Choice Modal */}
                <Modal visible={teacherOptionsVisible} transparent animationType="fade">
                    <TouchableOpacity 
                        style={[styles.actionModalOverlay, { backgroundColor: modalOverlayBg }]} 
                        activeOpacity={1} 
                        onPress={() => setTeacherOptionsVisible(false)}
                    >
                        <LinearGradient colors={modalBgGradient} style={[styles.actionModalContent, { borderColor: modalBorder }]}>
                            <View style={styles.actionModalHeader}>
                                <Text style={[styles.actionModalTitle, { color: modalTitleText }]}>STUDY MATERIAL OPTIONS</Text>
                                <Text style={[styles.actionModalSubtitle, { color: themeSubtext }]} numberOfLines={1}>{selectedTeacherNote?.title}</Text>
                            </View>
                            
                            <TouchableOpacity 
                                style={[styles.actionRow, { backgroundColor: actionRowBg, borderColor: actionRowBorder }]} 
                                activeOpacity={0.7}
                                onPress={() => {
                                    setTeacherOptionsVisible(false);
                                    if (selectedTeacherNote) {
                                        handleViewNote(selectedTeacherNote);
                                    }
                                }}
                            >
                                <LinearGradient colors={['rgba(16,185,129,0.18)', 'rgba(16,185,129,0.06)']} style={styles.actionRowIconWrap}>
                                    <Ionicons name="book-open" size={24} color="#10B981" />
                                </LinearGradient>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={[styles.actionRowText, { color: actionRowTextVal }]}>Open Study Material</Text>
                                    <Text style={[styles.actionRowSub, { color: actionRowSubTextVal }]}>Open and review this PDF in the app</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={actionRowChevronColor} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                style={[styles.actionRow, { backgroundColor: actionRowBg, borderColor: actionRowBorder }]} 
                                activeOpacity={0.7}
                                onPress={() => {
                                    setTeacherOptionsVisible(false);
                                    if (selectedTeacherNote) {
                                        fetchNoteAnalytics(selectedTeacherNote.id);
                                        setAnalyticsVisible(true);
                                    }
                                }}
                            >
                                <LinearGradient colors={['rgba(99,102,241,0.18)', 'rgba(99,102,241,0.06)']} style={styles.actionRowIconWrap}>
                                    <Ionicons name="pie-chart" size={24} color="#818CF8" />
                                </LinearGradient>
                                <View style={{ flex: 1, marginLeft: 16 }}>
                                    <Text style={[styles.actionRowText, { color: actionRowTextVal }]}>View Class Analytics</Text>
                                    <Text style={[styles.actionRowSub, { color: actionRowSubTextVal }]}>Check who completed this note and study times</Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color={actionRowChevronColor} />
                            </TouchableOpacity>

                            <TouchableOpacity 
                                onPress={() => setTeacherOptionsVisible(false)} 
                                style={[styles.actionModalCancelBtn, { backgroundColor: modalCancelBg, borderColor: modalCancelBorder }]}
                            >
                                <Text style={[styles.actionModalCancelText, { color: modalCancelTextVal }]}>CANCEL</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </TouchableOpacity>
                </Modal>
                             {/* Note Analytics Modal */}
                <Modal visible={analyticsVisible} transparent animationType="slide">
                    <View style={[styles.analyticsOverlay, { backgroundColor: modalOverlayBg, paddingTop: insets.top }]}>
                        <LinearGradient colors={modalBgGradient} style={[styles.analyticsContent, { borderColor: modalBorder }]}>
                            <View style={styles.analyticsHeader}>
                                <TouchableOpacity 
                                    onPress={() => {
                                        setAnalyticsVisible(false);
                                        setAnalyticsData(null);
                                        setAnalyticsSearchQuery('');
                                    }} 
                                    style={[styles.iconButton, { backgroundColor: themeIconBtnBg }]}
                                >
                                    <Ionicons name="chevron-back" size={24} color={themeIconColor} />
                                </TouchableOpacity>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text style={[styles.analyticsTitle, { color: modalTitleText }]} numberOfLines={1}>QUEST ANALYTICS</Text>
                                    <Text style={[styles.analyticsSubtitle, { color: themeSubtext }]} numberOfLines={1}>{selectedTeacherNote?.title}</Text>
                                </View>
                            </View>

                            {analyticsLoading ? (
                                <View style={styles.analyticsLoadingContainer}>
                                    <ActivityIndicator size="large" color="#818CF8" />
                                    <Text style={[styles.analyticsLoadingText, { color: themeSubtext }]}>Analyzing student progress...</Text>
                                </View>
                            ) : (
                                <View style={{ flex: 1 }}>
                                    {analyticsData && (
                                        <View style={styles.statsPanel}>
                                            <View style={[styles.statCard, { backgroundColor: themeCardBg, borderColor: modalBorder }]}>
                                                <Text style={[styles.statValue, { color: themeText }]}>
                                                    {analyticsData.students.filter(s => s.completed).length} / {analyticsData.students.length}
                                                </Text>
                                                <Text style={[styles.statLabel, { color: themeSubtext }]}>Completed</Text>
                                            </View>
                                            <View style={[styles.statCard, { backgroundColor: themeCardBg, borderColor: modalBorder }]}>
                                                <Text style={[styles.statValue, { color: themeText }]}>
                                                    {analyticsData.students.length > 0 
                                                        ? Math.round((analyticsData.students.filter(s => s.completed).length / analyticsData.students.length) * 100)
                                                        : 0}%
                                                </Text>
                                                <Text style={[styles.statLabel, { color: themeSubtext }]}>Completion Rate</Text>
                                            </View>
                                            <View style={[styles.statCard, { backgroundColor: themeCardBg, borderColor: modalBorder }]}>
                                                <Text style={[styles.statValue, { color: themeText }]}>
                                                    {(() => {
                                                        const completedStudents = analyticsData.students.filter(s => s.completed && s.time_spent > 0);
                                                        if (completedStudents.length === 0) return '0s';
                                                        const avg = Math.round(completedStudents.reduce((acc, curr) => acc + curr.time_spent, 0) / completedStudents.length);
                                                        return formatNoteTime(avg);
                                                    })()}
                                                </Text>
                                                <Text style={[styles.statLabel, { color: themeSubtext }]}>Avg. Study Time</Text>
                                            </View>
                                        </View>
                                    )}

                                    <View style={[styles.analyticsSearchContainer, { backgroundColor: modalInputBg, borderColor: modalInputBorder }]}>
                                        <Ionicons name="search" size={18} color={modalInputPlaceholder} style={{ marginLeft: 12 }} />
                                        <TextInput
                                            style={[styles.analyticsSearchInput, { color: modalInputText }]}
                                            placeholder="Search student by name..."
                                            placeholderTextColor={modalInputPlaceholder}
                                            value={analyticsSearchQuery}
                                            onChangeText={setAnalyticsSearchQuery}
                                        />
                                        {analyticsSearchQuery !== '' && (
                                            <TouchableOpacity onPress={() => setAnalyticsSearchQuery('')}>
                                                <Ionicons name="close-circle" size={18} color={modalInputPlaceholder} style={{ marginRight: 12 }} />
                                            </TouchableOpacity>
                                        )}
                                    </View>

                                    <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                                        {analyticsData && analyticsData.students.filter(s => s.name.toLowerCase().includes(analyticsSearchQuery.toLowerCase())).length > 0 ? (
                                            analyticsData.students
                                                .filter(s => s.name.toLowerCase().includes(analyticsSearchQuery.toLowerCase()))
                                                .map((student) => (
                                                    <View key={student.student_id} style={[styles.studentRow, { backgroundColor: actionRowBg, borderColor: actionRowBorder }]}>
                                                        <View style={styles.studentInfoCol}>
                                                            <View style={[styles.studentAvatar, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.08)' : '#E2E8F0' }]}>
                                                                <Text style={[styles.studentAvatarText, { color: isDarkMode ? '#FFF' : '#475569' }]}>{student.name.charAt(0).toUpperCase()}</Text>
                                                            </View>
                                                            <View style={{ marginLeft: 12, flex: 1 }}>
                                                                <Text style={[styles.studentNameText, { color: actionRowTextVal }]} numberOfLines={1}>{student.name}</Text>
                                                                <Text style={[styles.studentEmailText, { color: actionRowSubTextVal }]} numberOfLines={1}>{student.email}</Text>
                                                            </View>
                                                        </View>

                                                        <View style={styles.studentStatusCol}>
                                                            {student.completed ? (
                                                                <View style={styles.statusDonePill}>
                                                                    <Ionicons name="checkmark-circle" size={12} color="#10B981" />
                                                                    <Text style={styles.statusDoneText}>Completed</Text>
                                                                </View>
                                                            ) : student.is_studying ? (
                                                                <View style={[styles.statusPendingPill, { borderColor: isDarkMode ? 'rgba(96,165,250,0.3)' : '#93C5FD', backgroundColor: isDarkMode ? 'rgba(96,165,250,0.1)' : '#EFF6FF' }]}>
                                                                    <ActivityIndicator size="small" color="#3B82F6" style={{ transform: [{ scale: 0.6 }] }} />
                                                                    <Text style={[styles.statusPendingText, { color: '#3B82F6', marginLeft: -2 }]}>Studying...</Text>
                                                                </View>
                                                            ) : (
                                                                <View style={[styles.statusPendingPill, { borderColor: isDarkMode ? 'rgba(255,255,255,0.1)' : '#CBD5E1', backgroundColor: isDarkMode ? 'rgba(255,255,255,0.04)' : '#F1F5F9' }]}>
                                                                    <Ionicons name="ellipse-outline" size={11} color={themeSubtext} />
                                                                    <Text style={[styles.statusPendingText, { color: themeSubtext }]}>Not Started</Text>
                                                                </View>
                                                            )}

                                                            <View style={[styles.timeSpentPill, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.03)' : '#F8FAFC', borderColor: modalBorder }]}>
                                                                <Ionicons name="time-outline" size={12} color={themeSubtext} />
                                                                <Text style={[styles.timeSpentText, { color: themeSubtext }]}>
                                                                    {formatNoteTime(student.time_spent)}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))
                                        ) : (
                                            <View style={styles.analyticsCenterState}>
                                                <Ionicons name="people-outline" size={48} color="rgba(255,255,255,0.15)" />
                                                <Text style={styles.analyticsEmptyText}>No students found</Text>
                                            </View>
                                        )}
                                    </ScrollView>
                                </View>
                            )}
                        </LinearGradient>
                    </View>
                </Modal>

                {isUploading && (
                    <View style={styles.uploadingOverlay}>
                        <View style={styles.uploadCard}>
                            <ActivityIndicator size="large" color="#818CF8" />
                            <Text style={[styles.uploadingText, { color: '#000', fontFamily: 'Inter-Bold' }]}>Uploading...</Text>
                        </View>
                    </View>
                )}
            </SafeAreaView>
        </LinearGradient>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1 },
    
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16 },
    iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)', justifyContent: 'center', alignItems: 'center' },
    headerCenter: { alignItems: 'center', flex: 1 },
    title: { fontSize: 20, fontFamily: 'Inter-ExtraBold', color: '#FFF', letterSpacing: 1 },
    progressContainer: { width: 100, height: 4, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 2, marginTop: 8, overflow: 'hidden' },
    progressBar: { height: '100%', backgroundColor: '#FBBF24' },
    
    section: { marginTop: 24 },
    sectionTitle: { fontSize: 14, fontFamily: 'Inter-ExtraBold', color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 2, marginLeft: 20, marginBottom: 16 },
    
    foldersList: { paddingHorizontal: 20, gap: 16, paddingRight: 32 },
    folderCard: { width: 130, height: 130 },
    folderGlass: { flex: 1, borderRadius: 24, padding: 16, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
    folderIconGlow: { width: 56, height: 56, borderRadius: 28, backgroundColor: 'rgba(251, 191, 36, 0.15)', justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
    folderName: { fontFamily: 'Inter-Bold', fontSize: 14, color: '#FFF', textAlign: 'center' },

    arenaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 16,
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
    arenaCardIcon: {
        width: 62,
        height: 62,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 4,
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
    questCard: { borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', padding: 16, backgroundColor: 'rgba(255,255,255,0.03)' },
    questCardDone: { borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.05)' },
    
    questHeader: { flexDirection: 'row', alignItems: 'center' },
    questIconContainer: { width: 48, height: 48, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.05)', justifyContent: 'center', alignItems: 'center' },
    questInfo: { flex: 1, marginLeft: 16, marginRight: 12 },
    questTitle: { fontFamily: 'Inter-Bold', fontSize: 16, color: '#FFF', marginBottom: 6 },
    
    xpPill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', backgroundColor: 'rgba(251, 191, 36, 0.15)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(251, 191, 36, 0.3)' },
    xpText: { fontFamily: 'Inter-ExtraBold', fontSize: 12, color: '#FCD34D', marginLeft: 4 },
    
    checkbox: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
    checkboxDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
    
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
    modalCreateGradient: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    modalCreateText: { color: '#000', fontFamily: 'Inter-ExtraBold', fontSize: 14, letterSpacing: 1 },
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
    analyticsOverlay: { flex: 1, backgroundColor: '#000' },
    analyticsContent: { flex: 1 },
    analyticsHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingTop: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 255, 255, 0.08)' },
    analyticsTitle: { fontSize: 18, fontFamily: 'Inter-ExtraBold', color: '#FFF', letterSpacing: 2 },
    analyticsSubtitle: { fontSize: 13, fontFamily: 'Inter-Medium', color: '#818CF8', marginTop: 2 },
    analyticsLoadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    analyticsLoadingText: { color: 'rgba(255, 255, 255, 0.6)', fontFamily: 'Inter-Medium', fontSize: 14, marginTop: 16 },
    statsPanel: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginVertical: 16, gap: 8 },
    statCard: { flex: 1, backgroundColor: 'rgba(255, 255, 255, 0.04)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 16, padding: 12, alignItems: 'center' },
    statValue: { fontSize: 16, fontFamily: 'Inter-ExtraBold', color: '#FFF' },
    statLabel: { fontSize: 10, fontFamily: 'Inter-Medium', color: 'rgba(255, 255, 255, 0.4)', marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    analyticsSearchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 16, marginHorizontal: 16, marginBottom: 16, height: 48 },
    analyticsSearchInput: { flex: 1, height: '100%', color: '#FFF', fontFamily: 'Inter-Medium', fontSize: 14, paddingHorizontal: 12 },
    studentRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.03)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.06)', borderRadius: 20, padding: 14, marginBottom: 10 },
    studentInfoCol: { flexDirection: 'row', alignItems: 'center', flex: 0.65 },
    studentAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#818CF8', justifyContent: 'center', alignItems: 'center' },
    studentAvatarText: { color: '#FFF', fontFamily: 'Inter-ExtraBold', fontSize: 16 },
    studentNameText: { color: '#FFF', fontFamily: 'Inter-Bold', fontSize: 14 },
    studentEmailText: { color: 'rgba(255, 255, 255, 0.4)', fontFamily: 'Inter-Medium', fontSize: 11, marginTop: 2 },
    studentStatusCol: { alignItems: 'flex-end', flex: 0.35, gap: 6 },
    statusDonePill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(16, 185, 129, 0.15)', borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.25)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
    statusDoneText: { color: '#10B981', fontFamily: 'Inter-Bold', fontSize: 11 },
    statusPendingPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4, gap: 4 },
    statusPendingText: { color: 'rgba(255, 255, 255, 0.5)', fontFamily: 'Inter-Bold', fontSize: 11 },
    timeSpentPill: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255, 255, 255, 0.04)', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, gap: 3 },
    timeSpentText: { color: 'rgba(255, 255, 255, 0.7)', fontFamily: 'Inter-Medium', fontSize: 11 },
    analyticsCenterState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 40 },
    analyticsEmptyText: { color: 'rgba(255, 255, 255, 0.3)', fontFamily: 'Inter-Medium', fontSize: 14, marginTop: 12 },

    // Knowledge Archive Overhaul Styles
    dashboardContainer: {
        paddingHorizontal: 16,
        marginTop: 16,
        marginBottom: 10,
    },
    dashboardCard: {
        borderRadius: 24,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(99, 102, 241, 0.18)',
    },
    dashboardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    dashboardSub: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 11,
        color: '#818CF8',
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
        backgroundColor: '#818CF8',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#818CF8',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    levelBadgeLabel: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 9,
        color: '#0D0F1B',
    },
    levelBadgeVal: {
        fontFamily: 'Inter-ExtraBold',
        fontSize: 18,
        color: '#0D0F1B',
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
        backgroundColor: '#818CF8',
        borderRadius: 3,
        shadowColor: '#818CF8',
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
    grimoireEmoji: {
        fontSize: 26,
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
    codexCardDone: {
        borderColor: '#10B981',
        backgroundColor: 'rgba(16, 185, 129, 0.04)',
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
        backgroundColor: 'rgba(129, 140, 248, 0.1)',
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
        backgroundColor: 'rgba(251, 191, 36, 0.15)',
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
        backgroundColor: 'rgba(129, 140, 248, 0.15)',
        borderWidth: 1,
        borderColor: 'rgba(129, 140, 248, 0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        minWidth: 64,
    },
    codexActionBtnDone: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
    codexActionBtnText: {
        color: '#818CF8',
        fontFamily: 'Inter-ExtraBold',
        fontSize: 11,
        letterSpacing: 0.5,
    }
});

export default NotesScreen;

