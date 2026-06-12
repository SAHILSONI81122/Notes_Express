import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

import Constants from 'expo-constants';

// ─── API URL Configuration ────────────────────────────────────────────────────
// Set EXPO_PUBLIC_API_URL in your frontend/.env file:
//   Local (iOS Simulator):    http://127.0.0.1:8000
//   Local (Android Emulator): http://10.0.2.2:8000
//   Local (Physical Device):  http://192.168.29.90:8000
//   Production:               https://api.yourdomain.com
//
// Hardcoded for production.
// If you want to switch back to local dev, you can restore the process.env.EXPO_PUBLIC_API_URL logic.
export const API_URL = 'https://notes-express.vercel.app';

console.log('App is connecting to:', API_URL);


const api = axios.create({
  baseURL: API_URL,
  timeout: 300000, // 5 minutes timeout to allow for slow AI OCR requests
});

let authToken = null;
let isInitialized = false;
let initPromise = null;

export const initializeAuthToken = async () => {
  if (isInitialized) return authToken;
  if (!initPromise) {
    initPromise = AsyncStorage.getItem('token').then(token => {
      authToken = token;
      isInitialized = true;
      return token;
    });
  }
  return initPromise;
};

export const setSessionToken = async (token) => {
  authToken = token;
  isInitialized = true;
  if (token) {
    await AsyncStorage.setItem('token', token);
  } else {
    await AsyncStorage.removeItem('token');
  }
};

export const clearSession = async () => {
  authToken = null;
  isInitialized = true;
  initPromise = null; // Reset so next initializeAuthToken reads fresh from AsyncStorage
  try {
    const keys = await AsyncStorage.getAllKeys();
    const keysToRemove = keys.filter(key => key !== 'theme');
    if (keysToRemove.length > 0) {
      await AsyncStorage.multiRemove(keysToRemove);
    }
  } catch (e) {
    console.log("Error clearing session:", e);
  }
};

api.interceptors.request.use(
  async (config) => {
    if (!isInitialized) {
      await initializeAuthToken();
    }
    if (authToken) {
      config.headers.Authorization = `Bearer ${authToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export const login = (username, password) => {
  return api.post('/login', `username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    }
  });
};

export const getMe = () => api.get('/me');

export const signup = (data) => api.post('/signup', data);

export const updatePushToken = (token) => api.put('/push-token', { token });

export const getNotes = (batchId, classGroupId = null, folderId = null, search = null) => {
    let url = `/notes/${batchId}?`;
    if (classGroupId) url += `class_group_id=${classGroupId}&`;
    if (folderId) url += `folder_id=${folderId}&`;
    if (search) url += `search=${encodeURIComponent(search)}`;
    return api.get(url);
};

export const uploadNote = (data) => api.post('/upload-note', data);

const uploadToSignedUrl = async (formData, fieldName = 'file') => {
  // Extract file from React Native FormData
  let file;
  if (typeof formData.getParts === 'function') {
    file = formData.getParts().find(p => p.fieldName === fieldName);
  } else if (formData._parts) {
    const part = formData._parts.find(p => p[0] === fieldName);
    file = part ? part[1] : null;
  }
  
  if (!file) throw new Error("File not found in FormData");

  // 1. Get Signed URL from backend
  const res = await api.post('/get-upload-url', {
    filename: file.name || file.fileName || `upload_${Date.now()}`,
    content_type: file.type || file.mimeType || 'application/octet-stream'
  });
  
  const { signed_url, public_url } = res.data;
  
  // 2. Upload file directly to Supabase
  const response = await fetch(file.uri);
  const blob = await response.blob();
  
  const uploadRes = await fetch(signed_url, {
    method: 'PUT',
    headers: { 'Content-Type': file.type || file.mimeType || 'application/octet-stream' },
    body: blob
  });
  
  if (!uploadRes.ok) {
    throw new Error(`Upload failed with status ${uploadRes.status}`);
  }
  
  return public_url;
};

export const uploadFile = async (formData) => {
  const public_url = await uploadToSignedUrl(formData, 'file');
  return { data: { file_url: public_url } };
};
export const uploadImagesToPdf = (formData) => api.post('/upload-images-to-pdf', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const uploadImagesOcr = (title, formData) => api.post(`/upload-images-ocr?title=${encodeURIComponent(title)}`, formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});
export const parseImagesOcr = (formData) => api.post('/parse-images-ocr', formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

export const getFolders = (batchId, classGroupId = null, parentId = null, search = null, folderType = 'notes') => {
    let url = `/folders/${batchId}?folder_type=${folderType}&`;
    if (classGroupId) url += `class_group_id=${classGroupId}&`;
    if (parentId) url += `parent_id=${parentId}&`;
    if (search) url += `search=${encodeURIComponent(search)}`;
    return api.get(url);
};

export const createFolder = (data) => api.post('/create-folder', data);

export const getDpps = (batchId, classGroupId = null, folderId = null, search = null) => {
    let url = `/dpps/${batchId}?`;
    if (classGroupId) url += `class_group_id=${classGroupId}&`;
    if (folderId) url += `folder_id=${folderId}&`;
    if (search) url += `search=${encodeURIComponent(search)}`;
    return api.get(url);
};

export const createDpp = (data) => api.post('/create-dpp', data);

export const submitDpp = (data) => api.post('/submit-dpp', data);
export const getDppAnalytics = (dppId) => api.get(`/analytics/${dppId}`);

export const createBatch = (data) => api.post('/batches', data);

export const joinBatch = (inviteCode, classGroupId = null) => {
    let url = `/batches/join?invite_code=${inviteCode}`;
    if (classGroupId) url += `&class_group_id=${classGroupId}`;
    return api.post(url);
};
export const getInviteInfo = (inviteCode) => api.get(`/batches/invite/${inviteCode}`);

export const getBatchMembers = (batchId) => api.get(`/batches/${batchId}/members`);
export const switchBatch = (batchId) => api.post(`/batches/switch/${batchId}`);
export const refreshInviteCode = (batchId, role = 'student') => api.post(`/batches/${batchId}/refresh-invite?role=${role}`);
export const removeMember = (batchId, userId) => api.delete(`/batches/${batchId}/members/${userId}`);
export const bulkRemoveMembers = (batchId, userIds) => api.delete(`/batches/${batchId}/members/bulk-remove`, { data: userIds });
export const updateMemberRole = (batchId, userId, role) => api.put(`/batches/${batchId}/members/${userId}/role?new_role=${role}`);

export const createClassGroup = (batchId, data) => api.post(`/batches/${batchId}/class_groups`, data);
export const getClassGroups = (batchId) => api.get(`/batches/${batchId}/class_groups`);
export const addMemberToClassGroup = (classGroupId, userId) => api.post(`/batches/class_groups/${classGroupId}/members/${userId}`);
export const removeMemberFromClassGroup = (classGroupId, userId) => api.delete(`/batches/class_groups/${classGroupId}/members/${userId}`);

export const updateAvatar = async (formData) => {
  const public_url = await uploadToSignedUrl(formData, 'avatar');
  return api.post('/me/avatar-url', { avatar_url: public_url });
};

export const sendHeartbeat = (action = null) => {
    let url = '/heartbeat';
    if (action) url += `?action=${encodeURIComponent(action)}`;
    return api.post(url);
};
export const getActiveCount = (classGroupId) => api.get(`/class_groups/${classGroupId}/active_count`);
export const getStudentProgress = (userId = null) => {
    let url = '/progress';
    if (userId) url += `?user_id=${userId}`;
    return api.get(url);
};
export const getClassProgress = (classGroupId) => api.get(`/progress/class/${classGroupId}`);
export const getCompletionStatus = () => api.get('/completion-status');
export const toggleNoteComplete = (noteId) => api.post(`/complete/note/${noteId}`);
export const toggleDppComplete = (dppId) => api.post(`/complete/dpp/${dppId}`);
export const logNoteTime = (noteId, timeSpent) => api.post(`/notes/${noteId}/time`, { time_spent: timeSpent });
export const getNoteAnalytics = (noteId) => api.get(`/notes/${noteId}/analytics`);
export const buyBooster = (boosterType) => api.post('/buy-booster', { booster_type: boosterType });
export const buyStreakFreezer = () => api.post('/buy-booster', { booster_type: 'streak_freezer' });
export const activateBooster = (type) => api.post('/activate-booster', { booster_type: type });
export const getChestsStatus = () => api.get('/chests-status');
export const claimChest = (chestType) => api.post('/claim-chest', { chest_type: chestType });

export const updateBatch = (batchId, data) => api.put(`/batches/${batchId}`, data);
export const deleteNote = (noteId) => api.delete(`/notes/${noteId}`);
export const deleteFolder = (folderId) => api.delete(`/folders/${folderId}`);
export const deleteDPP = (dppId) => api.delete(`/dpps/${dppId}`);
export const renameNote = (noteId, title) => api.put(`/notes/${noteId}/rename`, { name: title });
export const renameFolder = (folderId, name) => api.put(`/folders/${folderId}/rename`, { name: name });
export const renameDPP = (dppId, title) => api.put(`/dpps/${dppId}/rename`, { name: title });
export const updateDppQuestions = (dppId, questions) => api.put(`/dpps/${dppId}/questions`, questions);

// Doubts / Messaging
export const sendDoubtMessage = (data) => api.post('/doubts/send', data);
export const getConversations = () => api.get('/doubts/conversations');
export const getDoubtMessages = (otherUserId) => api.get(`/doubts/messages/${otherUserId}`);
export const getAvailableTeachers = () => api.get('/doubts/teachers');
export const getUnreadCount = () => api.get('/doubts/unread-count');
export const deleteConversation = (otherUserId) => api.delete(`/doubts/conversations/${otherUserId}`);
export const uploadChatImage = async (formData) => {
  const public_url = await uploadToSignedUrl(formData, 'file');
  return { data: { image_url: public_url } };
};
export const uploadChatAudio = async (formData) => {
  const public_url = await uploadToSignedUrl(formData, 'file');
  return { data: { audio_url: public_url } };
};
export const getLeaderboard = (classGroupId) => api.get('/leaderboard', { params: { class_group_id: classGroupId } });

export const updateInstitute = (data) => api.patch('/institute', data);

export default api;
