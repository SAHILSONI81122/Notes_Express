import React, { useState } from 'react';
import { Text, View, StyleSheet, TouchableOpacity, Alert, Modal, FlatList, ActivityIndicator } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { joinBatch, getInviteInfo } from '../api/api';

export default function QRScannerScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showClassModal, setShowClassModal] = useState(false);
  const [batchInfo, setBatchInfo] = useState(null);
  const [pendingCode, setPendingCode] = useState(null);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <Text style={{ textAlign: 'center', marginBottom: 20, color: '#FFFFFF' }}>We need your permission to show the camera</Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>Grant Permission</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleBarCodeScanned = async ({ type, data }) => {
    setScanned(true);
    setIsLoading(true);
    try {
        const res = await getInviteInfo(data);
        const info = res.data;
        setPendingCode(data);
        if (info.role !== 'teacher' && info.class_groups && info.class_groups.length > 0) {
            setBatchInfo(info);
            setShowClassModal(true);
        } else {
            await processJoin(data, null);
        }
    } catch (error) {
        let msg = "Something went wrong. Please try again.";
        if (error.response?.status === 404) msg = "Group not found. This QR code may be outdated.";
        else if (error.response?.status === 410) msg = "This invite code has expired. Please ask for a new one.";
        Alert.alert("Error", msg, [{ text: "Try Again", onPress: () => setScanned(false) }]);
    } finally {
        setIsLoading(false);
    }
  };

  const processJoin = async (code, classGroupId) => {
    setIsLoading(true);
    try {
        await joinBatch(code, classGroupId);
        setShowClassModal(false);
        Alert.alert("Success", "Joined the coaching group!", [
            { text: "OK", onPress: () => navigation.replace('MainApp') }
        ]);
    } catch (error) {
        let msg = "Could not join the group. Please try again.";
        if (error.response?.status === 403) msg = "You are already a member of this group.";
        Alert.alert("Error", msg, [{ text: "Try Again", onPress: () => { setScanned(false); setShowClassModal(false); } }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
      />

      {/* Camera Overlay */}
      <View style={styles.overlay}>
          <View style={styles.unfocusedContainer} />
          <View style={styles.middleContainer}>
              <View style={styles.unfocusedContainer} />
              <View style={styles.focusedContainer}>
                  <View style={styles.frameCornerTopLeft} />
                  <View style={styles.frameCornerTopRight} />
                  <View style={styles.frameCornerBottomLeft} />
                  <View style={styles.frameCornerBottomRight} />
              </View>
              <View style={styles.unfocusedContainer} />
          </View>
          <View style={styles.bottomOverlay}>
              <Text style={styles.scanText}>Scan the Group QR Code</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => navigation.goBack()}>
                  <Ionicons name="close" size={32} color="#FFFFFF" />
              </TouchableOpacity>
          </View>
      </View>

      {/* Class Group Selection Modal */}
      <Modal visible={showClassModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
              <View style={styles.modalContent}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <Text style={styles.modalTitle}>Select Your Class</Text>
                      <TouchableOpacity onPress={() => { setShowClassModal(false); setScanned(false); }}>
                          <Ionicons name="close" size={24} color="#111827" />
                      </TouchableOpacity>
                  </View>
                  <Text style={{ color: '#6B7280', marginBottom: 20 }}>
                      {batchInfo?.name} has multiple classes. Which one are you in?
                  </Text>
                  {isLoading ? (
                      <ActivityIndicator size="large" color="#4F46E5" style={{ marginVertical: 30 }} />
                  ) : (
                      <FlatList
                          data={batchInfo?.class_groups || []}
                          keyExtractor={item => item.id.toString()}
                          renderItem={({ item }) => (
                              <TouchableOpacity
                                  style={styles.classGroupItem}
                                  onPress={() => processJoin(pendingCode, item.id)}
                              >
                                  <Text style={styles.classGroupName}>{item.name}</Text>
                                  <Ionicons name="chevron-forward" size={20} color="#4F46E5" />
                              </TouchableOpacity>
                          )}
                      />
                  )}
              </View>
          </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', backgroundColor: '#000' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  unfocusedContainer: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)' },
  middleContainer: { flexDirection: 'row', height: 250 },
  focusedContainer: { width: 250, borderRadius: 20, position: 'relative' },
  bottomOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', paddingTop: 40 },
  scanText: { color: '#FFF', fontSize: 18, fontWeight: '500', marginBottom: 40 },
  closeBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  button: { backgroundColor: '#4F46E5', padding: 16, borderRadius: 12, alignSelf: 'center' },
  buttonText: { color: '#FFF', fontWeight: 'bold' },
  frameCornerTopLeft: { position: 'absolute', top: 0, left: 0, width: 40, height: 40, borderTopWidth: 4, borderLeftWidth: 4, borderColor: '#4F46E5', borderTopLeftRadius: 20 },
  frameCornerTopRight: { position: 'absolute', top: 0, right: 0, width: 40, height: 40, borderTopWidth: 4, borderRightWidth: 4, borderColor: '#4F46E5', borderTopRightRadius: 20 },
  frameCornerBottomLeft: { position: 'absolute', bottom: 0, left: 0, width: 40, height: 40, borderBottomWidth: 4, borderLeftWidth: 4, borderColor: '#4F46E5', borderBottomLeftRadius: 20 },
  frameCornerBottomRight: { position: 'absolute', bottom: 0, right: 0, width: 40, height: 40, borderBottomWidth: 4, borderRightWidth: 4, borderColor: '#4F46E5', borderBottomRightRadius: 20 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', color: '#111827' },
  classGroupItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 20, backgroundColor: '#F3F4F6', borderRadius: 16, marginBottom: 12 },
  classGroupName: { fontSize: 16, fontWeight: 'bold', color: '#111827' },
});
