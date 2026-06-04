import * as FileSystem from 'expo-file-system';
import * as Network from 'expo-network';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../api/api';

const DOWNLOAD_DIR = FileSystem.documentDirectory + 'notes_express_downloads/';

// Initialize download directory
export const initOfflineManager = async () => {
    const dirInfo = await FileSystem.getInfoAsync(DOWNLOAD_DIR);
    if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(DOWNLOAD_DIR, { intermediates: true });
    }
};

// Network status check
export const isOnline = async () => {
    try {
        const state = await Network.getNetworkStateAsync();
        return state.isConnected && state.isInternetReachable !== false;
    } catch (e) {
        return true; // Assume online if check fails
    }
};

// Note / PDF offline handling
export const getLocalNotePath = (noteId) => {
    return `${DOWNLOAD_DIR}note_${noteId}.pdf`;
};

export const isNoteDownloaded = async (noteId) => {
    const path = getLocalNotePath(noteId);
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
};

export const downloadNote = async (note) => {
    try {
        await initOfflineManager();
        const localUri = getLocalNotePath(note.id);
        const remoteUrl = `${API_URL}${note.file_url}`;
        
        const downloadRes = await FileSystem.downloadAsync(remoteUrl, localUri);
        if (downloadRes.status !== 200) {
            throw new Error('Download failed');
        }
        return localUri;
    } catch (error) {
        console.error("Download Error:", error);
        throw error;
    }
};

export const deleteLocalNote = async (noteId) => {
    const path = getLocalNotePath(noteId);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
        await FileSystem.deleteAsync(path);
    }
};

// Returns the local file URI (file://...) so the caller can open it in the in-app PDF viewer.
export const openLocalNote = async (noteId) => {
    const path = getLocalNotePath(noteId);
    const info = await FileSystem.getInfoAsync(path);
    
    if (!info.exists) {
        throw new Error('File not found locally');
    }

    return path;
};

// Offline Queue for Syncing
export const queueOfflineSubmission = async (payload) => {
    try {
        const existing = await AsyncStorage.getItem('offline_submissions');
        let queue = existing ? JSON.parse(existing) : [];
        queue.push({
            ...payload,
            timestamp: Date.now()
        });
        await AsyncStorage.setItem('offline_submissions', JSON.stringify(queue));
    } catch (e) {
        console.log("Failed to queue offline submission:", e);
    }
};

export const getOfflineSubmissions = async () => {
    try {
        const existing = await AsyncStorage.getItem('offline_submissions');
        return existing ? JSON.parse(existing) : [];
    } catch (e) {
        return [];
    }
};

export const clearOfflineSubmissions = async () => {
    await AsyncStorage.removeItem('offline_submissions');
};

// Permanent Caching (survives AsyncStorage clearing)
export const savePermanentCache = async (key, data) => {
    try {
        await initOfflineManager();
        const path = `${DOWNLOAD_DIR}${key}.json`;
        await FileSystem.writeAsStringAsync(path, JSON.stringify(data), { encoding: FileSystem.EncodingType.UTF8 });
    } catch (e) {
        console.log("Failed to save permanent cache:", e);
    }
};

export const getPermanentCache = async (key) => {
    try {
        const path = `${DOWNLOAD_DIR}${key}.json`;
        const info = await FileSystem.getInfoAsync(path);
        if (!info.exists) return null;
        
        const str = await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
        return str; // Return string, let the caller JSON.parse it to match AsyncStorage behavior
    } catch (e) {
        console.log("Failed to get permanent cache:", e);
        return null;
    }
};
