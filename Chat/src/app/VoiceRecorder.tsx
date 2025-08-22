// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useRef, useCallback } from 'react';
import {
  IconButton,
  MessageBar,
  MessageBarType,
  Dialog,
  DialogType,
  DialogFooter,
  PrimaryButton,
  DefaultButton,
  Stack,
  Text
} from '@fluentui/react';

interface VoiceRecorderProps {
  onVoiceRecorded: (audioFile: File) => void;
  disabled?: boolean;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({
  onVoiceRecorded,
  disabled = false
}) => {
  const [isRecording, setIsRecording] = useState(false);
  const [showRecordingDialog, setShowRecordingDialog] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [hasRecording, setHasRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const recordedBlobRef = useRef<Blob | null>(null);

  const startRecording = useCallback(async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100
        } 
      });

      // Create MediaRecorder with preferred format
      let options = { mimeType: 'audio/webm;codecs=opus' };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: 'audio/webm' };
        if (!MediaRecorder.isTypeSupported(options.mimeType)) {
          options = { mimeType: 'audio/mp4' };
          if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = {} as any; // Use default
          }
        }
      }

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { 
          type: mediaRecorder.mimeType || 'audio/webm'
        });
        recordedBlobRef.current = audioBlob;
        
        // Create preview URL
        const audioUrl = URL.createObjectURL(audioBlob);
        if (audioPreviewRef.current) {
          audioPreviewRef.current.src = audioUrl;
        }
        
        setHasRecording(true);
        
        // Stop all tracks to release the microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);

      // Start timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error('Error accessing microphone:', err);
      setError('Unable to access microphone. Please check your browser permissions.');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  }, [isRecording]);

  const discardRecording = useCallback(() => {
    if (recordedBlobRef.current) {
      URL.revokeObjectURL(audioPreviewRef.current?.src || '');
    }
    recordedBlobRef.current = null;
    setHasRecording(false);
    setRecordingTime(0);
    setShowRecordingDialog(false);
  }, []);

  const sendRecording = useCallback(() => {
    if (recordedBlobRef.current) {
      // Create a File from the Blob
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = recordedBlobRef.current.type.includes('webm') ? 'webm' : 
                      recordedBlobRef.current.type.includes('mp4') ? 'mp4' : 'webm';
      const filename = `voice-message-${timestamp}.${extension}`;
      
      const file = new File([recordedBlobRef.current], filename, {
        type: recordedBlobRef.current.type
      });

      onVoiceRecorded(file);
      discardRecording();
    }
  }, [onVoiceRecorded, discardRecording]);

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const openRecordingDialog = () => {
    setShowRecordingDialog(true);
    setError(null);
  };

  const closeRecordingDialog = () => {
    if (isRecording) {
      stopRecording();
    }
    if (!hasRecording) {
      setShowRecordingDialog(false);
      setRecordingTime(0);
    }
  };

  return (
    <>
      {error && (
        <MessageBar 
          messageBarType={MessageBarType.error} 
          onDismiss={() => setError(null)}
          isMultiline={false}
          styles={{
            root: {
              position: 'fixed',
              top: '20px',
              left: '20px',
              zIndex: 1001,
              maxWidth: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
            }
          }}
        >
          {error}
        </MessageBar>
      )}

      <IconButton
        iconProps={{ iconName: 'Microphone' }}
        title="Record voice message"
        disabled={disabled}
        onClick={openRecordingDialog}
        styles={{
          root: {
            position: 'absolute',
            right: '128px', // Position to the left of attachment buttons
            bottom: '16px',
            zIndex: 1000,
            backgroundColor: 'transparent',
            border: 'none',
            borderRadius: '4px',
            width: '32px',
            height: '32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          },
          rootHovered: {
            backgroundColor: '#f3f2f1'
          },
          rootDisabled: {
            backgroundColor: 'transparent',
            opacity: 0.6
          },
          icon: {
            fontSize: '16px',
            color: isRecording ? '#d13438' : '#605e5c'
          }
        }}
      />

      <Dialog
        hidden={!showRecordingDialog}
        onDismiss={closeRecordingDialog}
        dialogContentProps={{
          type: DialogType.normal,
          title: 'Voice Message'
        }}
        modalProps={{
          isBlocking: true,
          styles: { main: { maxWidth: 500, minWidth: 400 } }
        }}
      >
        <Stack tokens={{ childrenGap: 16 }}>
          {!hasRecording ? (
            <>
              {isRecording ? (
                <>
                  <Stack horizontalAlign="center" tokens={{ childrenGap: 8 }}>
                    <Text variant="large">Recording...</Text>
                    <Text variant="mediumPlus" style={{ color: '#d13438', fontWeight: 'bold' }}>
                      {formatTime(recordingTime)}
                    </Text>
                    <div style={{ 
                      width: '20px', 
                      height: '20px', 
                      borderRadius: '50%', 
                      backgroundColor: '#d13438',
                      animation: 'pulse 1s infinite'
                    }} />
                  </Stack>
                  <Text>Speak into your microphone. Click stop when finished.</Text>
                </>
              ) : (
                <>
                  <Text>Click the microphone button to start recording your voice message.</Text>
                  <Stack horizontalAlign="center">
                    <IconButton
                      iconProps={{ iconName: 'Microphone' }}
                      onClick={startRecording}
                      styles={{
                        root: {
                          width: '60px',
                          height: '60px',
                          borderRadius: '50%',
                          backgroundColor: '#0078d4'
                        },
                        rootHovered: {
                          backgroundColor: '#106ebe'
                        },
                        icon: {
                          fontSize: '24px',
                          color: 'white'
                        }
                      }}
                    />
                  </Stack>
                </>
              )}
            </>
          ) : (
            <>
              <Text>Recording completed ({formatTime(recordingTime)})</Text>
              <Stack horizontalAlign="center">
                <audio 
                  ref={audioPreviewRef} 
                  controls 
                  style={{ width: '100%', maxWidth: '300px' }}
                />
              </Stack>
              <Text variant="small">
                Listen to your recording and click "Send" to upload it to the conversation.
              </Text>
            </>
          )}
        </Stack>

        <DialogFooter>
          {isRecording ? (
            <>
              <PrimaryButton onClick={stopRecording} text="Stop Recording" />
              <DefaultButton onClick={closeRecordingDialog} text="Cancel" />
            </>
          ) : hasRecording ? (
            <>
              <PrimaryButton onClick={sendRecording} text="Send" />
              <DefaultButton onClick={discardRecording} text="Re-record" />
              <DefaultButton onClick={closeRecordingDialog} text="Cancel" />
            </>
          ) : (
            <>
              <DefaultButton onClick={closeRecordingDialog} text="Cancel" />
            </>
          )}
        </DialogFooter>
      </Dialog>

      <style>{`
        @keyframes pulse {
          0% { opacity: 1; }
          50% { opacity: 0.5; }
          100% { opacity: 1; }
        }
      `}</style>
    </>
  );
};