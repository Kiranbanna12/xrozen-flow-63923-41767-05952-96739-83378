import { useEffect, useRef } from 'react';
import { Phone, PhoneOff, Mic, MicOff, Video, VideoOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CallStatus, CallType } from '@/hooks/useWebRTC';

interface CallDialogProps {
  isOpen: boolean;
  callStatus: CallStatus;
  callType: CallType;
  remotePeerInfo: { id: string; name: string } | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  isVideoOff: boolean;
  onAnswer: () => void;
  onReject: () => void;
  onEnd: () => void;
  onToggleMute: () => void;
  onToggleVideo: () => void;
}

export const CallDialog = ({
  isOpen,
  callStatus,
  callType,
  remotePeerInfo,
  localStream,
  remoteStream,
  isMuted,
  isVideoOff,
  onAnswer,
  onReject,
  onEnd,
  onToggleMute,
  onToggleVideo,
}: CallDialogProps) => {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // Update local video stream
  useEffect(() => {
    if (localVideoRef.current && localStream && callType === 'video') {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, callType]);

  // Update remote video stream
  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  const getCallStatusText = () => {
    switch (callStatus) {
      case 'calling':
        return 'Calling...';
      case 'ringing':
        return 'Incoming call';
      case 'connected':
        return 'Connected';
      default:
        return '';
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onEnd()}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden">
        <div className="relative h-[500px] bg-gradient-to-br from-blue-900 to-purple-900">
          {/* Remote Video (Full Screen) */}
          {callType === 'video' && remoteStream ? (
            <video
              ref={remoteVideoRef}
              autoPlay
              playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-white">
              <Avatar className="h-32 w-32 mb-4 border-4 border-white/20">
                <AvatarFallback className="text-4xl bg-white/10">
                  {remotePeerInfo ? getInitials(remotePeerInfo.name) : '?'}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-semibold mb-2">
                {remotePeerInfo?.name || 'Unknown'}
              </h2>
              <p className="text-white/80">{getCallStatusText()}</p>
            </div>
          )}

          {/* Local Video (Picture-in-Picture) */}
          {callType === 'video' && localStream && callStatus === 'connected' && (
            <div className="absolute top-4 right-4 w-32 h-24 bg-black rounded-lg overflow-hidden border-2 border-white/20 shadow-lg">
              {!isVideoOff ? (
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <VideoOff className="h-8 w-8 text-white/50" />
                </div>
              )}
            </div>
          )}

          {/* Call Info Header */}
          <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/50 to-transparent">
            <DialogHeader>
              <DialogTitle className="text-white text-center">
                {callType === 'video' ? 'Video Call' : 'Voice Call'}
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* Call Controls */}
          <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/50 to-transparent">
            {callStatus === 'ringing' ? (
              // Incoming call buttons
              <div className="flex justify-center gap-4">
                <Button
                  onClick={onReject}
                  size="lg"
                  className="rounded-full h-16 w-16 bg-red-500 hover:bg-red-600"
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
                <Button
                  onClick={onAnswer}
                  size="lg"
                  className="rounded-full h-16 w-16 bg-green-500 hover:bg-green-600"
                >
                  <Phone className="h-6 w-6" />
                </Button>
              </div>
            ) : (
              // Active call controls
              <div className="flex justify-center items-center gap-4">
                {/* Mute/Unmute */}
                <Button
                  onClick={onToggleMute}
                  size="lg"
                  variant={isMuted ? 'destructive' : 'secondary'}
                  className="rounded-full h-14 w-14"
                >
                  {isMuted ? (
                    <MicOff className="h-5 w-5" />
                  ) : (
                    <Mic className="h-5 w-5" />
                  )}
                </Button>

                {/* Video On/Off (only for video calls) */}
                {callType === 'video' && (
                  <Button
                    onClick={onToggleVideo}
                    size="lg"
                    variant={isVideoOff ? 'destructive' : 'secondary'}
                    className="rounded-full h-14 w-14"
                  >
                    {isVideoOff ? (
                      <VideoOff className="h-5 w-5" />
                    ) : (
                      <Video className="h-5 w-5" />
                    )}
                  </Button>
                )}

                {/* End Call */}
                <Button
                  onClick={onEnd}
                  size="lg"
                  className="rounded-full h-16 w-16 bg-red-500 hover:bg-red-600"
                >
                  <PhoneOff className="h-6 w-6" />
                </Button>
              </div>
            )}

            {/* Call Duration Timer */}
            {callStatus === 'connected' && (
              <div className="text-center mt-4">
                <p className="text-white/80 text-sm">
                  {remotePeerInfo?.name || 'Unknown'}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
