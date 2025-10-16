import { useState, useRef, useCallback, useEffect } from 'react';
import { toast } from 'sonner';

// ICE servers configuration for STUN/TURN
const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export type CallType = 'audio' | 'video';
export type CallStatus = 'idle' | 'calling' | 'ringing' | 'connected' | 'ended';

interface UseWebRTCProps {
  onIncomingCall?: (callerId: string, callerName: string, callType: CallType) => void;
  onCallEnded?: () => void;
  sendSignal: (signal: any) => void;
}

export const useWebRTC = ({ onIncomingCall, onCallEnded, sendSignal }: UseWebRTCProps) => {
  const [callStatus, setCallStatus] = useState<CallStatus>('idle');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [callType, setCallType] = useState<CallType>('audio');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [remotePeerInfo, setRemotePeerInfo] = useState<{ id: string; name: string } | null>(null);

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueue = useRef<RTCIceCandidate[]>([]);

  // Initialize peer connection
  const initializePeerConnection = useCallback(() => {
    if (peerConnectionRef.current) {
      return peerConnectionRef.current;
    }

    console.log('📞 Initializing peer connection');
    const peerConnection = new RTCPeerConnection(ICE_SERVERS);
    peerConnectionRef.current = peerConnection;

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('📞 Sending ICE candidate');
        sendSignal({
          type: 'ice-candidate',
          candidate: event.candidate,
        });
      }
    };

    // Handle remote stream
    peerConnection.ontrack = (event) => {
      console.log('📞 Received remote track:', event.streams[0]);
      setRemoteStream(event.streams[0]);
    };

    // Handle connection state changes
    peerConnection.onconnectionstatechange = () => {
      console.log('📞 Connection state:', peerConnection.connectionState);
      if (peerConnection.connectionState === 'connected') {
        setCallStatus('connected');
        toast.success('Call connected!');
      } else if (
        peerConnection.connectionState === 'disconnected' ||
        peerConnection.connectionState === 'failed' ||
        peerConnection.connectionState === 'closed'
      ) {
        endCall();
      }
    };

    return peerConnection;
  }, [sendSignal]);

  // Check if browser supports media devices
  const checkBrowserSupport = useCallback((type: CallType): boolean => {
    console.log('📞 Checking browser support...');
    console.log('📞 navigator.mediaDevices:', navigator.mediaDevices);
    console.log('📞 getUserMedia:', navigator.mediaDevices?.getUserMedia);
    console.log('📞 Protocol:', window.location.protocol);
    console.log('📞 Hostname:', window.location.hostname);
    
    // Check basic getUserMedia support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Try legacy getUserMedia for older browsers
      const legacyGetUserMedia = (navigator as any).getUserMedia || 
                                 (navigator as any).webkitGetUserMedia || 
                                 (navigator as any).mozGetUserMedia;
      
      if (!legacyGetUserMedia) {
        toast.error('Your browser does not support audio/video calls. Please update your browser.', {
          duration: 5000
        });
        return false;
      }
    }

    // Check if secure context (HTTPS, localhost, or local network)
    const isLocalhost = window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1' ||
                       window.location.hostname.startsWith('192.168.') ||
                       window.location.hostname.startsWith('10.') ||
                       window.location.hostname.endsWith('.local');
    
    const isSecure = window.location.protocol === 'https:' || isLocalhost;
    
    if (!isSecure) {
      console.warn('📞 Not a secure context, but will try anyway');
      toast.warning('For best results, use HTTPS. Calls may not work on HTTP.', {
        duration: 4000
      });
      // Don't block, just warn
    }

    return true;
  }, []);

  // Get user media (camera/microphone)
  const getUserMedia = useCallback(async (type: CallType) => {
    try {
      console.log(`📞 Getting user media for ${type} call`);
      
      // Check browser support first (but don't block on warnings)
      checkBrowserSupport(type);

      // Try with optimized constraints first
      let constraints: MediaStreamConstraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: type === 'video' ? { 
          width: { ideal: 1280 }, 
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
      };

      console.log('📞 Requesting media with optimized constraints:', constraints);
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        console.log('📞 Got local stream with optimized settings:', stream);
        setLocalStream(stream);
        localStreamRef.current = stream;
        return stream;
      } catch (firstError: any) {
        console.log('📞 Optimized constraints failed, trying simple constraints:', firstError);
        
        // Fallback to simple constraints
        const simpleConstraints: MediaStreamConstraints = {
          audio: true,
          video: type === 'video',
        };
        
        console.log('📞 Trying simple constraints:', simpleConstraints);
        const stream = await navigator.mediaDevices.getUserMedia(simpleConstraints);
        console.log('📞 Got local stream with simple settings:', stream);
        setLocalStream(stream);
        localStreamRef.current = stream;
        toast.info('Using basic audio/video settings');
        return stream;
      }
    } catch (error: any) {
      console.error('📞 Error getting user media:', error);
      console.error('📞 Error details:', {
        name: error.name,
        message: error.message,
        constraint: error.constraint
      });
      
      // Provide detailed error messages based on the error type
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        const device = type === 'video' ? 'camera and microphone' : 'microphone';
        toast.error(
          `Permission denied! Please allow ${device} access when browser asks.`,
          { duration: 5000 }
        );
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        const device = type === 'video' ? 'camera or microphone' : 'microphone';
        toast.error(`No ${device} found. Please check your device.`);
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        const device = type === 'video' ? 'camera/microphone' : 'microphone';
        toast.error(
          `${device} is already in use. Please close other apps.`
        );
      } else if (error.name === 'SecurityError') {
        toast.error('Security error. Try using HTTPS or check your browser permissions.');
      } else {
        toast.error(`Failed to access ${type === 'video' ? 'camera/microphone' : 'microphone'}. Please allow permissions.`);
      }
      
      throw error;
    }
  }, [checkBrowserSupport]);

  // Request permissions before starting call
  const requestPermissions = useCallback(async (type: CallType): Promise<boolean> => {
    try {
      console.log(`📞 Requesting ${type} call permissions`);
      console.log('📞 User Agent:', navigator.userAgent);
      
      // Check browser support first
      if (!checkBrowserSupport(type)) {
        console.log('📞 Browser support check failed');
        return false;
      }

      console.log('📞 Browser support OK, requesting media...');

      // Request permissions with simple constraints first
      const constraints = {
        audio: true,
        video: type === 'video',
      };

      console.log('📞 Constraints:', constraints);
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      console.log('📞 Got stream:', stream);
      
      // Stop the stream immediately as we just wanted to check permissions
      stream.getTracks().forEach(track => {
        console.log('📞 Stopping track:', track.kind);
        track.stop();
      });
      
      console.log('📞 Permissions granted successfully');
      toast.success('Permissions granted!');
      return true;
    } catch (error: any) {
      console.error('📞 Permission request failed:', error);
      console.error('📞 Error name:', error.name);
      console.error('📞 Error message:', error.message);
      
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        const device = type === 'video' ? 'camera and microphone' : 'microphone';
        toast.error(
          `Please allow access to ${device}. Click Allow when browser asks.`,
          { duration: 6000 }
        );
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        const device = type === 'video' ? 'camera or microphone' : 'microphone';
        toast.error(`No ${device} found. Please check your device.`);
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        toast.error('Device is already in use. Please close other apps.');
      } else if (error.name === 'SecurityError') {
        toast.error('Security error. Try using HTTPS or check browser settings.');
      } else {
        toast.error(`Failed to access ${type === 'video' ? 'camera/microphone' : 'microphone'}. ${error.message || 'Please check permissions.'}`);
      }
      
      return false;
    }
  }, [checkBrowserSupport]);

  // Start outgoing call
  const startCall = useCallback(
    async (recipientId: string, recipientName: string, type: CallType) => {
      try {
        console.log(`📞 Starting ${type} call to ${recipientName}`);
        setCallType(type);
        setCallStatus('calling');
        setRemotePeerInfo({ id: recipientId, name: recipientName });

        const stream = await getUserMedia(type);
        const peerConnection = initializePeerConnection();

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        // Create offer
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);

        console.log('📞 Sending call offer to:', recipientId);
        sendSignal({
          type: 'call-offer',
          offer,
          callType: type,
          recipientId,
        });
        
        toast.info(`Calling ${recipientName}...`);
      } catch (error) {
        console.error('📞 Error starting call:', error);
        const device = type === 'video' ? 'camera/microphone' : 'microphone';
        toast.error(`Failed to start call. Please allow ${device} access and try again.`);
        // Reset state on error
        setCallStatus('idle');
        setRemotePeerInfo(null);
        throw error;
      }
    },
    [getUserMedia, initializePeerConnection, sendSignal]
  );

  // Answer incoming call
  const answerCall = useCallback(
    async (offer: RTCSessionDescriptionInit, type: CallType) => {
      try {
        console.log(`📞 Answering ${type} call`);
        setCallType(type);
        setCallStatus('connected');

        const stream = await getUserMedia(type);
        const peerConnection = initializePeerConnection();

        // Add local tracks to peer connection
        stream.getTracks().forEach((track) => {
          peerConnection.addTrack(track, stream);
        });

        // Set remote description (offer)
        await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

        // Process queued ICE candidates
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          if (candidate) {
            await peerConnection.addIceCandidate(candidate);
          }
        }

        // Create answer
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        console.log('📞 Sending call answer');
        sendSignal({
          type: 'call-answer',
          answer,
        });
      } catch (error: any) {
        console.error('📞 Error answering call:', error);
        const device = type === 'video' ? 'camera/microphone' : 'microphone';
        
        if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
          toast.error(`Cannot answer call. Please allow ${device} access.`, { duration: 5000 });
        } else {
          toast.error(`Failed to answer call. Please check your ${device}.`);
        }
        
        // Reset state
        setCallStatus('idle');
        setRemotePeerInfo(null);
        throw error;
      }
    },
    [getUserMedia, initializePeerConnection, sendSignal]
  );

  // Handle call answer
  const handleAnswer = useCallback(
    async (answer: RTCSessionDescriptionInit) => {
      try {
        console.log('📞 Received call answer');
        const peerConnection = peerConnectionRef.current;
        if (!peerConnection) {
          throw new Error('Peer connection not initialized');
        }

        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
        
        // Process queued ICE candidates
        while (iceCandidatesQueue.current.length > 0) {
          const candidate = iceCandidatesQueue.current.shift();
          if (candidate) {
            await peerConnection.addIceCandidate(candidate);
          }
        }
      } catch (error) {
        console.error('📞 Error handling answer:', error);
        endCall();
      }
    },
    []
  );

  // Handle ICE candidate
  const handleIceCandidate = useCallback(async (candidate: RTCIceCandidateInit) => {
    try {
      console.log('📞 Received ICE candidate');
      const peerConnection = peerConnectionRef.current;
      
      if (peerConnection && peerConnection.remoteDescription) {
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        // Queue candidate if remote description not set yet
        console.log('📞 Queuing ICE candidate');
        iceCandidatesQueue.current.push(new RTCIceCandidate(candidate));
      }
    } catch (error) {
      console.error('📞 Error handling ICE candidate:', error);
    }
  }, []);

  // Reject call
  const rejectCall = useCallback(() => {
    console.log('📞 Rejecting call');
    sendSignal({ type: 'call-rejected' });
    endCall();
  }, [sendSignal]);

  // End call
  const endCall = useCallback(() => {
    console.log('📞 Ending call');
    
    // Stop all tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Close peer connection
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }

    // Clear states
    setLocalStream(null);
    setRemoteStream(null);
    setCallStatus('idle');
    setIsMuted(false);
    setIsVideoOff(false);
    setRemotePeerInfo(null);
    localStreamRef.current = null;
    iceCandidatesQueue.current = [];

    // Notify parent
    if (onCallEnded) {
      onCallEnded();
    }

    // Send end signal
    sendSignal({ type: 'call-ended' });
  }, [sendSignal, onCallEnded]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  }, []);

  // Toggle video
  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
      }
    };
  }, []);

  return {
    // State
    callStatus,
    localStream,
    remoteStream,
    callType,
    isMuted,
    isVideoOff,
    remotePeerInfo,

    // Actions
    requestPermissions,
    startCall,
    answerCall,
    rejectCall,
    endCall,
    toggleMute,
    toggleVideo,
    handleAnswer,
    handleIceCandidate,
  };
};
