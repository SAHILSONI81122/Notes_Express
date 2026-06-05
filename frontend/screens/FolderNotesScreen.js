import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList, ActivityIndicator, Modal, TextInput, ScrollView, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as WebBrowser from 'expo-web-browser';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getNotes, getMe, uploadFile, uploadNote, uploadImagesToPdf, createFolder, API_URL, logNoteTime } from '../api/api';


const FolderNotesScreen = ({ route, navigation }) => {
    const { folder } = route.params;
    const [notes, setNotes] = useState([]);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [modalVisible, setModalVisible] = useState(false);
    const [newFolderName, setNewFolderName] = useState('');
    const [isUploading, setIsUploading] = useState(false);
    const { isDarkMode, colors } = useTheme();
    const [savedNoteTimes, setSavedNoteTimes] = useState({});

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

    const loadSavedNoteTimes = async (noteList) => {
        const times = {};
        for (const note of noteList) {
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

    const fetchFolderNotes = async () => {
        setLoading(true);
        try {
            const [userRes, notesRes] = await Promise.all([
                getMe(),
                // Bug Fix: Pass folder.id so backend filters by folder — don't fetch all notes and filter client-side
                getNotes(folder.batch_id, folder.class_group_id, folder.id)
            ]);
            setUser(userRes.data);
            const folderNotes = notesRes.data;
            setNotes(folderNotes);
            await loadSavedNoteTimes(folderNotes);
        } catch (error) {
            console.log("Error fetching folder notes:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchFolderNotes();
    }, [folder.id]);

    const handleCreateFolder = async () => {
        if (!newFolderName.trim()) return;
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        try {
            await createFolder({ 
                name: newFolderName, 
                batch_id: user.batch_id,
                class_group_id: folder.class_group_id
            });
            setNewFolderName('');
            setModalVisible(false);
            Alert.alert("Success", "New folder created!");
        } catch (error) {
            Alert.alert("Error", "Could not create folder");
        }
    };

    const pickDocument = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const result = await DocumentPicker.getDocumentAsync({ type: 'application/pdf' });
            if (!result.canceled) {
                uploadPickedFile(result.assets[0]);
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
            uploadPickedImages(result.assets);
        }
    };

    const uploadPickedFile = async (asset) => {
        setIsUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', {
                uri: asset.uri,
                name: asset.name,
                type: 'application/pdf',
            });

            const uploadRes = await uploadFile(formData);
            await uploadNote({
                title: asset.name.replace('.pdf', ''),
                file_url: uploadRes.data.file_url,
                batch_id: user.batch_id,
                class_group_id: folder.class_group_id,
                folder_id: folder.id
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchFolderNotes();
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Failed to upload note");
        } finally {
            setIsUploading(false);
        }
    };

    const uploadPickedImages = async (assets) => {
        setIsUploading(true);
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
                title: `${folder.name} Notes - ${new Date().toLocaleDateString()}`,
                file_url: uploadRes.data.file_url,
                batch_id: user.batch_id,
                class_group_id: folder.class_group_id,
                folder_id: folder.id
            });
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            fetchFolderNotes();
        } catch (error) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
            Alert.alert("Error", "Failed to convert and upload images");
        } finally {
            setIsUploading(false);
        }
    };

    const isAdminOrTeacher = user?.role === 'admin' || user?.role === 'teacher';

    const handleViewNote = async (note) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const startTime = Date.now();
            const url = `${API_URL}${note.file_url}`;
            await WebBrowser.openBrowserAsync(url);
            const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);

            if (elapsedSeconds > 0) {
                const currentStr = await AsyncStorage.getItem('note_time_spent_' + note.id);
                const currentSecs = currentStr ? parseInt(currentStr, 10) : 0;
                const newTotal = currentSecs + elapsedSeconds;
                await AsyncStorage.setItem('note_time_spent_' + note.id, newTotal.toString());
                setSavedNoteTimes(prev => ({
                    ...prev,
                    [note.id]: newTotal
                }));

                if (user?.role === 'student') {
                    try {
                        await logNoteTime(note.id, elapsedSeconds);
                    } catch (err) {
                        console.log("Error syncing note time to backend:", err);
                    }
                }
            }

            const recentStr = await AsyncStorage.getItem('recent_notes_v1') || '[]';
            let recents = JSON.parse(recentStr);
            recents = recents.filter(n => n.id !== note.id);
            recents.unshift({ ...note, openedAt: Date.now() });
            recents = recents.slice(0, 20);
            await AsyncStorage.setItem('recent_notes_v1', JSON.stringify(recents));
        } catch (error) {
            Alert.alert("Error", "Could not open note");
        }
    };

    const renderNote = ({ item }) => (
        <TouchableOpacity 
            style={[styles.item, { backgroundColor: colors.card }]}
            onPress={() => handleViewNote(item)}
        >
            <View style={[styles.itemIcon, { backgroundColor: colors.primary + '1A' }]}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
            </View>
            <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]} numberOfLines={1}>{item.title}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={[styles.itemSubtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                        {new Date(item.uploaded_at).toLocaleDateString()}
                    </Text>
                    {savedNoteTimes[item.id] !== undefined && (
                        <Text style={[styles.itemSubtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                            {` • ⏱️ ${formatNoteTime(savedNoteTimes[item.id])}`}
                        </Text>
                    )}
                </View>
            </View>
            <View style={[styles.viewBtn, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
                <Ionicons name="chevron-forward" size={18} color={colors.primary} />
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={styles.header}>
                <TouchableOpacity 
                    onPress={() => navigation.goBack()} 
                    style={[styles.backButton, { backgroundColor: colors.card }]}
                >
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <View>
                    <Text style={[styles.title, { color: colors.text, fontFamily: 'Inter-ExtraBold' }]}>{folder.name}</Text>
                    <Text style={[styles.subtitle, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>{notes.length} Documents Available</Text>
                </View>
            </View>

            {loading ? (
                <View style={styles.centerState}>
                    <ActivityIndicator size="large" color={colors.primary} />
                </View>
            ) : notes.length === 0 ? (
                <View style={styles.centerState}>
                    <View style={[styles.iconCircle, { backgroundColor: isDarkMode ? '#1F2937' : '#F3F4F6' }]}>
                        <Ionicons name="folder-open-outline" size={40} color={colors.subtext} />
                    </View>
                    <Text style={[styles.emptyTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>No Notes in this Folder</Text>
                    <Text style={[styles.emptyText, { color: colors.subtext, fontFamily: 'Inter-Medium' }]}>
                        Once your teacher uploads notes to this folder, they will appear here.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={notes}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderNote}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {isAdminOrTeacher && (
                <View style={styles.fabContainer}>
                    <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary }]} onPress={pickImages}>
                        <Ionicons name="images" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.fab, { backgroundColor: colors.primary, marginTop: 12 }]} onPress={pickDocument}>
                        <Ionicons name="document-attach" size={20} color="#FFF" />
                    </TouchableOpacity>
                    <TouchableOpacity 
                        style={[styles.fabMain, { backgroundColor: colors.primary, marginTop: 12 }]} 
                        onPress={() => setModalVisible(true)}
                    >
                        <Ionicons name="add" size={32} color="#FFF" />
                    </TouchableOpacity>
                </View>
            )}

            <Modal visible={modalVisible} transparent animationType="fade">
                <TouchableOpacity 
                    style={styles.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setModalVisible(false)}
                >
                    <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
                        <Text style={[styles.modalTitle, { color: colors.text, fontFamily: 'Inter-Bold' }]}>New Sub-folder</Text>
                        <TextInput
                            style={[styles.input, { color: colors.text, borderColor: colors.border, fontFamily: 'Inter-Medium' }]}
                            placeholder="e.g. Assignments"
                            placeholderTextColor={colors.subtext}
                            value={newFolderName}
                            onChangeText={setNewFolderName}
                            autoFocus
                        />
                        <View style={styles.modalButtons}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalBtn}>
                                <Text style={{ color: colors.subtext, fontFamily: 'Inter-SemiBold' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                onPress={handleCreateFolder} 
                                style={[styles.modalBtnPrimary, { backgroundColor: colors.primary }]}
                            >
                                <Text style={{ color: '#FFF', fontFamily: 'Inter-Bold' }}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            {isUploading && (
                <View style={styles.uploadingOverlay}>
                    <View style={styles.uploadCard}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={[styles.uploadingText, { color: colors.text, fontFamily: 'Inter-Bold' }]}>Uploading...</Text>
                    </View>
                </View>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, paddingHorizontal: 24 },
    header: { flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 20 },
    backButton: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 16, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    title: { fontSize: 22 },
    subtitle: { fontSize: 13, marginTop: 2 },
    listContent: { paddingBottom: 120 },
    item: { 
        flexDirection: 'row', alignItems: 'center',
        padding: 12, borderRadius: 20, marginBottom: 12,
        shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 10, elevation: 2
    },
    itemIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 14 },
    itemContent: { flex: 1, paddingRight: 8 },
    itemTitle: { fontSize: 14 },
    itemSubtitle: { fontSize: 12, marginTop: 2 },
    viewBtn: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    centerState: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    iconCircle: { width: 80, height: 80, borderRadius: 40, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
    emptyTitle: { fontSize: 20, marginBottom: 10, textAlign: 'center' },
    emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 22, paddingHorizontal: 20 },
    fabContainer: { position: 'absolute', bottom: 30, right: 30, alignItems: 'center' },
    fab: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center', elevation: 6, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 10 },
    fabMain: { width: 68, height: 68, borderRadius: 34, justifyContent: 'center', alignItems: 'center', elevation: 10, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 12 },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    modalContent: { width: '100%', padding: 24, borderRadius: 28, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    modalTitle: { fontSize: 20, marginBottom: 20 },
    input: { height: 50, borderWidth: 1, borderRadius: 14, paddingHorizontal: 16, marginBottom: 24, fontSize: 15 },
    modalButtons: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 12 },
    modalBtn: { paddingHorizontal: 12 },
    modalBtnPrimary: { borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
    uploadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', zIndex: 1000 },
    uploadCard: { backgroundColor: '#FFF', padding: 24, borderRadius: 20, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    uploadingText: { marginTop: 12, fontSize: 14 }
});

export default FolderNotesScreen;
