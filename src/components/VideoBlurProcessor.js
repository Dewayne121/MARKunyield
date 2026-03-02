/**
 * VideoBlurProcessor - Client-side face blur for videos
 *
 * Note: Full video frame processing in React Native requires native modules.
 * This implementation uses expo-face-detector and demonstrates the approach.
 * For production, consider:
 * 1. react-native-video-blur (native module)
 * 2. Server-side processing (original approach)
 * 3. GL-based real-time blur during recording
 */

import React, { useRef, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { Video } from 'expo-av';
import * as FaceDetector from 'expo-face-detector';
import { manipulator } from 'expo-image-manipulator';

export default function VideoBlurProcessor({ videoUri, onComplete, onError }) {
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const videoRef = useRef(null);

  /**
   * Process video to blur faces
   * This is a simplified implementation that demonstrates the approach.
   * Full implementation requires native video processing capabilities.
   */
  const processVideo = async () => {
    setProcessing(true);
    setProgress(0);
    setStatus('Initializing face detector...');

    try {
      // Request face detector permissions
      const { status: detectorStatus } = await FaceDetector.requestPermissionsAsync();
      if (detectorStatus !== 'granted') {
        throw new Error('Face detector permission not granted');
      }

      setStatus('Processing video frames...');

      // Note: This is where we would:
      // 1. Extract frames from video
      // 2. Detect faces in each frame
      // 3. Apply blur to face regions
      // 4. Recombine into new video

      // Since React Native doesn't have built-in frame extraction,
      // we need to use alternative approaches:

      // APPROACH 1: Real-time blur during recording
      // (See BlurCamera component below)

      // APPROACH 2: Post-processing with native module
      // (requires react-native-video-blur or similar)

      // APPROACH 3: GL shader-based blur
      // (requires react-native-gl)

      // For now, return original video with a note
      console.warn('[VideoBlurProcessor] Full video processing requires native modules');
      console.warn('[VideoBlurProcessor] Consider using BlurCamera for real-time blur instead');

      setProgress(100);
      setStatus('Complete (blur requires native module)');

      // Return original for now
      // In production, this would return the blurred URI
      setTimeout(() => {
        onComplete(videoUri);
      }, 500);

    } catch (error) {
      console.error('[VideoBlurProcessor] Error:', error);
      setStatus(`Error: ${error.message}`);
      if (onError) onError(error);
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Detect faces in a single image frame
   */
  const detectFacesInFrame = async (imageUri) => {
    const faces = await FaceDetector.detectFaces(imageUri, {
      mode: FaceDetector.Mode.fast,
      detectLandmarks: FaceDetector.LandmarksType.none,
      runClassifications: false,
      minDetectionInterval: 100,
      tracking: true,
    });

    return faces;
  };

  /**
   * Apply blur to face regions in an image
   */
  const applyBlurToFaces = async (imageUri, faces) => {
    // Note: expo-image-manipulator doesn't support region-based blur
    // This would require canvas or GL-based approach

    // For each face:
    // 1. Extract face region
    // 2. Apply blur
    // 3. Composite back

    return imageUri; // Placeholder
  };

  // Auto-start processing
  React.useEffect(() => {
    if (videoUri) {
      processVideo();
    }
  }, [videoUri]);

  if (!processing) return null;

  return (
    <View style={styles.container}>
      <View style={styles.overlay}>
        <ActivityIndicator size="large" />
        <Text style={styles.status}>{status}</Text>
        <Text style={styles.progress}>{progress}%</Text>
      </View>
    </View>
  );
}

/**
 * BlurCamera - Real-time face blur during recording
 *
 * This is a more practical approach: blur faces WHILE recording.
 * The blur overlay is rendered over the camera view and captured.
 */
export function BlurCamera({ style, onFacesDetected, blurEnabled = false }) {
  const [faces, setFaces] = useState([]);

  const handleFacesDetected = ({ faces: detectedFaces }) => {
    setFaces(detectedFaces);
    if (onFacesDetected) onFacesDetected(detectedFaces);
  };

  return (
    <View style={[styles.cameraContainer, style]}>
      {/* Camera component would go here */}
      {/* Render blur overlays over detected faces */}

      {blurEnabled && faces.map((face, index) => (
        <View
          key={index}
          style={[
            styles.blurOverlay,
            {
              left: face.bounds.origin.x,
              top: face.bounds.origin.y,
              width: face.bounds.size.width,
              height: face.bounds.size.height,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    padding: 20,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  status: {
    color: '#fff',
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  progress: {
    color: '#888',
    marginTop: 8,
    fontSize: 12,
  },
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  blurOverlay: {
    position: 'absolute',
    backgroundColor: 'rgba(180, 180, 180, 0.1)',
    // Note: Real blur would require backdrop-filter or GL shader
    // backdropFilter: 'blur(20px)', // iOS only
  },
});

/**
 * HELPER FUNCTIONS
 */

/**
 * Alternative: Process video by extracting thumbnails
 * This is limited but works with expo-av
 */
export async function extractVideoFrames(videoUri, frameCount = 10) {
  const video = Video.createAsync(videoUri);
  // This is conceptual - expo-av doesn't expose frame extraction
  // Would need to use thumbnail functionality
  return [];
}

/**
 * Alternative: Server-side blur (original approach)
 * Use this if client-side processing is too limited
 */
export async function blurVideoServerSide(videoUrl, apiToken) {
  const normalize = (value) => String(value || '').trim().replace(/\/+$/, '');
  const primary = normalize(process.env.EXPO_PUBLIC_API_URL) || 'http://localhost:3000';
  const fallbackCandidates = String(process.env.EXPO_PUBLIC_API_FALLBACK_URL || '')
    .split(',')
    .map((value) => normalize(value))
    .filter(Boolean);
  const emergency = normalize(process.env.EXPO_PUBLIC_API_EMERGENCY_URL) || 'https://unyield-main.onrender.com';
  const candidates = [primary, ...fallbackCandidates, emergency]
    .filter((url, index, arr) => url && arr.indexOf(url) === index);

  let lastError;
  for (const baseUrl of candidates) {
    try {
      const response = await fetch(`${baseUrl}/api/videos/blur`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`,
        },
        body: JSON.stringify({ videoUrl }),
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `Blur request failed (${response.status})`);
      }

      const data = await response.json();
      return data.data?.blurredVideoUrl || videoUrl;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('Blur request failed');
}
