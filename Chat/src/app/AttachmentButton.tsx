// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useEffect, useCallback } from 'react';
import {
  IconButton,
  MessageBar,
  MessageBarType,
  ProgressIndicator,
  Dialog,
  DialogType,
  DialogFooter,
  DefaultButton,
  DocumentCard,
  DocumentCardTitle,
  DocumentCardDetails,
  DocumentCardType,
  Stack,
  Text,
  List,
  IIconProps
} from '@fluentui/react';
import { VoiceRecorder } from './VoiceRecorder';

interface Attachment {
  id: number;
  original_filename: string;
  file_size: number;
  file_type: string;
  uploader_name: string;
  created_at: string;
}

interface AttachmentButtonProps {
  conversationId: number;
  token: string;
  serverUrl: string;
  isReadonly?: boolean;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const isAudioFile = (fileType: string): boolean => {
  return fileType.startsWith('audio/');
};

export const AttachmentButton: React.FC<AttachmentButtonProps> = ({
  conversationId,
  token,
  serverUrl,
  isReadonly = false
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showAttachments, setShowAttachments] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAttachments = useCallback(async () => {
    try {
      const response = await fetch(`${serverUrl}/attachments/${conversationId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setAttachments(data.attachments || []);
      } else {
        console.error('Failed to load attachments');
      }
    } catch (error) {
      console.error('Error loading attachments:', error);
    }
  }, [conversationId, token, serverUrl]);

  useEffect(() => {
    loadAttachments();
  }, [loadAttachments]);

  const handleVoiceRecorded = async (audioFile: File) => {
    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', audioFile);

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 201) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${serverUrl}/attachments/upload/${conversationId}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);

      await uploadPromise;
      
      // Reload attachments
      await loadAttachments();
      setUploadProgress(0);
    } catch (error) {
      console.error('Voice upload error:', error);
      setError('Failed to upload voice message. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size (50MB limit)
    if (file.size > 50 * 1024 * 1024) {
      setError('File size exceeds 50MB limit');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png', 
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Audio types for voice messages
      'audio/mpeg',
      'audio/wav',
      'audio/ogg',
      'audio/mp3',
      'audio/webm',
      'audio/mp4'
    ];

    if (!allowedTypes.includes(file.type)) {
      setError('File type not allowed. Please use images, PDF, Word, Excel, text, or audio files.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const xhr = new XMLHttpRequest();
      
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          setUploadProgress(percentComplete);
        }
      });

      const uploadPromise = new Promise<void>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 201) {
            resolve();
          } else {
            reject(new Error(`Upload failed: ${xhr.statusText}`));
          }
        };
        xhr.onerror = () => reject(new Error('Upload failed'));
      });

      xhr.open('POST', `${serverUrl}/attachments/upload/${conversationId}`);
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.send(formData);

      await uploadPromise;
      
      // Reload attachments
      await loadAttachments();
      setUploadProgress(0);
    } catch (error) {
      console.error('Upload error:', error);
      setError('Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
      // Reset the input
      event.target.value = '';
    }
  };

  const handleDownload = async (attachmentId: number, filename: string) => {
    try {
      const response = await fetch(`${serverUrl}/attachments/download/${attachmentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        // Open download URL in new window
        window.open(data.download_url, '_blank');
      } else {
        setError('Failed to generate download link');
      }
    } catch (error) {
      console.error('Download error:', error);
      setError('Failed to download file');
    }
  };

  const handleDeleteAttachment = async (attachmentId: number) => {
    try {
      const response = await fetch(`${serverUrl}/attachments/${attachmentId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await loadAttachments();
      } else {
        setError('Failed to delete attachment');
      }
    } catch (error) {
      console.error('Delete error:', error);
      setError('Failed to delete attachment');
    }
  };

  const createAudioPlayer = async (attachmentId: number): Promise<string> => {
    try {
      const response = await fetch(`${serverUrl}/attachments/download/${attachmentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        return data.download_url;
      }
    } catch (error) {
      console.error('Error getting audio URL:', error);
    }
    return '';
  };

  const attachIcon: IIconProps = { iconName: 'Attach' };

  const AttachmentListItem: React.FC<{ 
    attachment: Attachment; 
    onDownload: (id: number, filename: string) => void;
    onDelete: (id: number) => void;
  }> = ({ attachment, onDownload, onDelete }) => {
    const [audioUrl, setAudioUrl] = useState<string>('');
    
    useEffect(() => {
      if (isAudioFile(attachment.file_type)) {
        createAudioPlayer(attachment.id).then(setAudioUrl);
      }
    }, [attachment.id, attachment.file_type]);

    return (
      <DocumentCard
        type={DocumentCardType.compact}
        onClick={!isAudioFile(attachment.file_type) ? () => onDownload(attachment.id, attachment.original_filename) : undefined}
        styles={{ 
          root: { 
            margin: '4px 0', 
            cursor: isAudioFile(attachment.file_type) ? 'default' : 'pointer' 
          } 
        }}
      >
        <DocumentCardDetails>
          <Stack tokens={{ childrenGap: 8 }}>
            <Stack horizontal verticalAlign="center" tokens={{ childrenGap: 8 }}>
              <Stack.Item grow>
                <Stack>
                  <DocumentCardTitle
                    title={attachment.original_filename}
                    shouldTruncate={true}
                  />
                  <Text variant="small" styles={{ root: { color: '#666' } }}>
                    {formatFileSize(attachment.file_size)} • {attachment.uploader_name} • {new Date(attachment.created_at).toLocaleDateString()}
                    {isAudioFile(attachment.file_type) && ' • Voice Message'}
                  </Text>
                </Stack>
              </Stack.Item>
              <Stack.Item>
                <IconButton
                  iconProps={{ iconName: 'Download' }}
                  title="Download"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDownload(attachment.id, attachment.original_filename);
                  }}
                />
                {!isReadonly && (
                  <IconButton
                    iconProps={{ iconName: 'Delete' }}
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm('Are you sure you want to delete this attachment?')) {
                        onDelete(attachment.id);
                      }
                    }}
                  />
                )}
              </Stack.Item>
            </Stack>
            
            {isAudioFile(attachment.file_type) && audioUrl && (
              <Stack>
                <audio 
                  controls 
                  style={{ width: '100%', maxWidth: '400px' }}
                  preload="metadata"
                >
                  <source src={audioUrl} type={attachment.file_type} />
                  Your browser does not support the audio element.
                </audio>
              </Stack>
            )}
          </Stack>
        </DocumentCardDetails>
      </DocumentCard>
    );
  };

  const renderAttachmentsDialog = () => (
    <Dialog
      hidden={!showAttachments}
      onDismiss={() => setShowAttachments(false)}
      dialogContentProps={{
        type: DialogType.normal,
        title: 'Attachments',
        subText: `${attachments.length} file(s) attached to this conversation`
      }}
      modalProps={{
        isBlocking: false,
        styles: { main: { maxWidth: 600, minWidth: 400 } }
      }}
    >
      <Stack tokens={{ childrenGap: 8 }}>
        {attachments.length === 0 ? (
          <Text>No attachments found.</Text>
        ) : (
          <List
            items={attachments}
            onRenderCell={(attachment) => (
              <AttachmentListItem
                key={attachment!.id}
                attachment={attachment!}
                onDownload={handleDownload}
                onDelete={handleDeleteAttachment}
              />
            )}
          />
        )}
      </Stack>
      
      <DialogFooter>
        <DefaultButton onClick={() => setShowAttachments(false)} text="Close" />
      </DialogFooter>
    </Dialog>
  );

  if (isReadonly) {
    // In readonly mode, only show view button if there are attachments
    return attachments.length > 0 ? (
      <>
        <IconButton
          iconProps={{ iconName: 'View' }}
          title={`View attachments (${attachments.length})`}
          onClick={() => setShowAttachments(true)}
          styles={{
            root: {
              position: 'absolute',
              right: '48px', // Position closer to the text input box
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
            icon: {
              fontSize: '16px',
              color: '#605e5c'
            }
          }}
        />
        <VoiceRecorder
          onVoiceRecorded={handleVoiceRecorded}
          disabled={true}
        />
        {renderAttachmentsDialog()}
      </>
    ) : (
      <>
        <VoiceRecorder
          onVoiceRecorded={handleVoiceRecorded}
          disabled={true}
        />
      </>
    );
  }

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
              right: '20px',
              zIndex: 1001,
              maxWidth: '400px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
            }
          }}
        >
          {error}
        </MessageBar>
      )}

      {uploading && (
        <ProgressIndicator 
          label="Uploading file..."
          percentComplete={uploadProgress / 100}
          styles={{
            root: {
              position: 'fixed',
              top: '70px',
              right: '20px',
              zIndex: 1001,
              maxWidth: '300px',
              backgroundColor: 'white',
              padding: '12px',
              border: '1px solid #d1d1d1',
              borderRadius: '4px',
              boxShadow: '0 4px 8px rgba(0,0,0,0.1)'
            }
          }}
        />
      )}

      <IconButton
        iconProps={attachIcon}
        title="Attach file"
        disabled={uploading}
        onClick={() => document.getElementById('file-input-overlay')?.click()}
        styles={{
          root: {
            position: 'absolute',
            right: '48px', // Position closer to the text input box
            bottom: '16px', // Align with send box
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
            color: '#605e5c'
          }
        }}
      />

      {attachments.length > 0 && (
        <IconButton
          iconProps={{ iconName: 'View' }}
          title={`View attachments (${attachments.length})`}
          onClick={() => setShowAttachments(true)}
          styles={{
            root: {
              position: 'absolute',
              right: '88px', // Position to the left of attach button
              bottom: '16px', // Align with send box
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
            icon: {
              fontSize: '16px',
              color: '#605e5c'
            }
          }}
        />
      )}

      <input
        id="file-input-overlay"
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileUpload}
        accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.mp3,.wav,.ogg,.webm,.mp4"
      />

      <VoiceRecorder
        onVoiceRecorded={handleVoiceRecorded}
        disabled={uploading || isReadonly}
      />

      {renderAttachmentsDialog()}
    </>
  );
};