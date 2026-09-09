import React, { useState, useRef, useEffect } from 'react';
import { Modal, StyleSheet, View, Text, TouchableOpacity, Image, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import { colors, spacing, typography, rounded } from '../theme';
import { Button } from './ui';

interface CameraModalProps {
  visible: boolean;
  onClose: () => void;
  onPhotoTaken: (uri: string) => void;
}

export function CameraModal({ visible, onClose, onPhotoTaken }: CameraModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraReady, setCameraReady] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const cameraRef = useRef<CameraView>(null);

  useEffect(() => {
    if (visible && !permission?.granted && permission?.canAskAgain) {
      requestPermission();
    }
  }, [visible, permission, requestPermission]);

  const takePicture = async () => {
    if (cameraRef.current && cameraReady) {
      try {
        const photo = await cameraRef.current.takePictureAsync({
          quality: 0.8,
          base64: false,
        });
        if (photo?.uri) {
          setPhotoUri(photo.uri);
        }
      } catch (e) {
        console.error('Failed to take picture:', e);
      }
    }
  };

  const processAndUsePhoto = async (action: 'crop' | 'none') => {
    if (!photoUri) return;
    try {
      let finalUri = photoUri;
      if (action === 'crop') {
        // Example: crop to square
        const manipulated = await ImageManipulator.manipulateAsync(
          photoUri,
          [
            // we don't know the exact dimensions, but we can resize or do a basic crop
            // For a robust app, we'd use a UI for cropping, but for now we just compress or flip as an example
            { resize: { width: 1080 } }
          ],
          { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
        );
        finalUri = manipulated.uri;
      }
      onPhotoTaken(finalUri);
      setPhotoUri(null);
      onClose();
    } catch (e) {
      console.error('Failed to process image:', e);
      Alert.alert('Error processing image');
    }
  };

  if (!visible) return null;

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={styles.container}>
          <Text style={styles.text}>We need your permission to show the camera</Text>
          <Button label="Grant permission" onPress={requestPermission} />
          <Button label="Cancel" variant="outline" onPress={onClose} style={{ marginTop: spacing.md }} />
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {!photoUri ? (
          <>
            <CameraView 
              ref={cameraRef}
              style={styles.camera} 
              facing="back"
              onCameraReady={() => setCameraReady(true)}
            />
            <View style={styles.buttonContainer}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.btnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.captureBtn} onPress={takePicture}>
                <View style={styles.captureInner} />
              </TouchableOpacity>
              <View style={{ flex: 1 }} />
            </View>
          </>
        ) : (
          <View style={styles.previewContainer}>
            <Image source={{ uri: photoUri }} style={styles.preview} resizeMode="contain" />
            <View style={styles.actionContainer}>
              <Button label="Retake" variant="outline" onPress={() => setPhotoUri(null)} />
              <Button label="Use Photo" onPress={() => processAndUsePhoto('none')} style={{ marginLeft: spacing.md }} />
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'black',
  },
  camera: {
    flex: 1,
  },
  buttonContainer: {
    flexDirection: 'row',
    backgroundColor: 'black',
    paddingBottom: 40,
    paddingTop: 20,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cancelBtn: {
    flex: 1,
    paddingLeft: spacing.lg,
  },
  btnText: {
    ...typography.bodyMd,
    color: 'white',
  },
  captureBtn: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: 'black',
  },
  previewContainer: {
    flex: 1,
    backgroundColor: 'black',
  },
  preview: {
    flex: 1,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  text: {
    ...typography.bodyMd,
    color: 'white',
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
});
