// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  CommandBar,
  ICommandBarItemProps,
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  MessageBar,
  MessageBarType,
  Modal,
  TextField,
  Dropdown,
  IDropdownOption,
  IconButton,
  TooltipHost,
  Pivot,
  PivotItem
} from '@fluentui/react';
import { User, Conversation, Doctor, conversationsAPI, usersAPI, authAPI } from './utils/patientCareAPI';
import { Analytics } from './Analytics';
import { ImportModal } from './ImportModal';
import {
  containerStyle,
  containerTokens,
  headerStyle,
  configContainerStyle,
  configContainerStackTokens,
  buttonStyle
} from './styles/HomeScreen.styles';

interface DashboardProps {
  user: User;
  onLogout: () => void;
  onJoinChat: (threadId: string, conversationTitle: string, conversationId: number, status?: 'active' | 'readonly' | 'archived') => void;
  onStartConsultation: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onLogout, onJoinChat, onStartConsultation }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newConversationTitle, setNewConversationTitle] = useState('');
  const [newConversationType, setNewConversationType] = useState<'1to1' | '1toN'>('1toN');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | undefined>();
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('conversations');
  const [showImportModal, setShowImportModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    setError('');

    try {
      const [conversationsResult, doctorsResult] = await Promise.all([
        conversationsAPI.getConversations(),
        usersAPI.getDoctors()
      ]);

      if (conversationsResult.success) {
        setConversations(conversationsResult.conversations || []);
      } else {
        setError(conversationsResult.message || 'Failed to load conversations');
      }

      if (doctorsResult.success) {
        setDoctors(doctorsResult.doctors || []);
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Load data error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateConversation = async () => {
    if (!newConversationTitle) {
      setError('Conversation title is required');
      return;
    }

    if (newConversationType === '1to1' && !selectedDoctorId) {
      setError('Please select a doctor for 1:1 conversations');
      return;
    }

    setIsCreating(true);
    setError('');

    try {
      const result = await conversationsAPI.createConversation(
        newConversationTitle,
        newConversationType,
        selectedDoctorId
      );

      if (result.success) {
        setShowCreateModal(false);
        setNewConversationTitle('');
        setSelectedDoctorId(undefined);
        await loadData(); // Reload conversations
      } else {
        setError(result.message || 'Failed to create conversation');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Create conversation error:', error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinConversation = async (conversationId: number) => {
    try {
      const result = await conversationsAPI.joinConversation(conversationId);
      if (result.success) {
        await loadData(); // Reload to see updated participant list
      } else {
        setError(result.message || 'Failed to join conversation');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Join conversation error:', error);
    }
  };

  const handleUpdateConversationStatus = async (conversationId: number, status: 'active' | 'readonly' | 'archived') => {
    try {
      const result = await conversationsAPI.updateConversation(conversationId, status);
      if (result.success) {
        await loadData(); // Reload conversations
      } else {
        setError(result.message || 'Failed to update conversation');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Update conversation error:', error);
    }
  };

  const handleDeleteConversation = async (conversationId: number) => {
    if (window.confirm('Are you sure you want to delete this conversation?')) {
      try {
        const result = await conversationsAPI.deleteConversation(conversationId);
        if (result.success) {
          await loadData(); // Reload conversations
        } else {
          setError(result.message || 'Failed to delete conversation');
        }
      } catch (error) {
        setError('Network error. Please try again.');
        console.error('Delete conversation error:', error);
      }
    }
  };

  const handleExportConversation = async (conversationId: number, title: string) => {
    try {
      const blob = await conversationsAPI.exportConversation(conversationId);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `conversation_${conversationId}_${title.replace(/[^a-z0-9]/gi, '_')}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError('Failed to export conversation');
      console.error('Export conversation error:', error);
    }
  };

  const conversationColumns: IColumn[] = [
    {
      key: 'title',
      name: 'Title',
      fieldName: 'title',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true
    },
    {
      key: 'type',
      name: 'Type',
      fieldName: 'type',
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: Conversation) => <Text>{item.type === '1to1' ? '1:1' : '1:N'}</Text>
    },
    {
      key: 'status',
      name: 'Status',
      fieldName: 'status',
      minWidth: 100,
      maxWidth: 120,
      onRender: (item: Conversation) => (
        <Text
          style={{
            color: item.status === 'active' ? 'green' : item.status === 'readonly' ? 'orange' : 'gray'
          }}
        >
          {item.status}
        </Text>
      )
    },
    {
      key: 'creator',
      name: 'Created By',
      minWidth: 150,
      maxWidth: 200,
      onRender: (item: Conversation) => <Text>{item.creator?.display_name || 'Unknown'}</Text>
    },
    {
      key: 'doctor',
      name: 'Assigned Doctor',
      minWidth: 150,
      maxWidth: 200,
      onRender: (item: Conversation) => (
        <Text>{item.assigned_doctor?.display_name || (item.type === '1toN' ? 'Any Doctor' : 'None')}</Text>
      )
    },
    {
      key: 'participants',
      name: 'Participants',
      minWidth: 80,
      maxWidth: 100,
      onRender: (item: Conversation) => <Text>{item.participants?.length || 0}</Text>
    },
    {
      key: 'created_at',
      name: 'Created',
      minWidth: 120,
      maxWidth: 150,
      onRender: (item: Conversation) => <Text>{new Date(item.created_at).toLocaleDateString()}</Text>
    },
    {
      key: 'actions',
      name: 'Actions',
      minWidth: 200,
      onRender: (item: Conversation) => (
        <Stack horizontal tokens={{ childrenGap: 5 }}>
          <TooltipHost content="Join Chat">
            <IconButton iconProps={{ iconName: 'Chat' }} onClick={() => onJoinChat(item.thread_id, item.title, item.id, item.status)} />
          </TooltipHost>

          {user.role === 'doctor' && item.type === '1toN' && !item.participants?.some((p) => p.id === user.id) && (
            <TooltipHost content="Join Conversation">
              <IconButton iconProps={{ iconName: 'AddFriend' }} onClick={() => handleJoinConversation(item.id)} />
            </TooltipHost>
          )}

          {(user.role === 'doctor' || user.role === 'admin') && (
            <>
              {item.status === 'active' && (
                <TooltipHost content="Mark as Read-only">
                  <IconButton
                    iconProps={{ iconName: 'ReadingMode' }}
                    onClick={() => handleUpdateConversationStatus(item.id, 'readonly')}
                  />
                </TooltipHost>
              )}

              {item.status === 'readonly' && (
                <TooltipHost content="Reactivate">
                  <IconButton
                    iconProps={{ iconName: 'Unlock' }}
                    onClick={() => handleUpdateConversationStatus(item.id, 'active')}
                  />
                </TooltipHost>
              )}

              <TooltipHost content="Export as JSON">
                <IconButton
                  iconProps={{ iconName: 'Download' }}
                  onClick={() => handleExportConversation(item.id, item.title)}
                />
              </TooltipHost>

              {user.role === 'admin' && (
                <TooltipHost content="Delete">
                  <IconButton
                    iconProps={{ iconName: 'Delete' }}
                    onClick={() => handleDeleteConversation(item.id)}
                    styles={{ icon: { color: 'red' } }}
                  />
                </TooltipHost>
              )}
            </>
          )}
        </Stack>
      )
    }
  ];

  const commandBarItems: ICommandBarItemProps[] = [
    ...(user.role === 'patient'
      ? [
          {
            key: 'newConsultation',
            text: 'New Consultation',
            iconProps: { iconName: 'Add' },
            onClick: onStartConsultation
          }
        ]
      : []),
    ...(user.role === 'admin'
      ? [
          {
            key: 'import',
            text: 'Import Conversations',
            iconProps: { iconName: 'CloudUpload' },
            onClick: () => setShowImportModal(true)
          }
        ]
      : []),
    {
      key: 'refresh',
      text: 'Refresh',
      iconProps: { iconName: 'Refresh' },
      onClick: loadData
    }
  ];

  const commandBarFarItems: ICommandBarItemProps[] = [
    {
      key: 'profile',
      text: `${user.display_name} (${user.role})`,
      iconProps: { iconName: 'Contact' },
      subMenuProps: {
        items: [
          {
            key: 'logout',
            text: 'Sign Out',
            iconProps: { iconName: 'SignOut' },
            onClick: () => {
              authAPI.logout();
              onLogout();
            }
          }
        ]
      }
    }
  ];

  const doctorOptions: IDropdownOption[] = doctors.map((doctor) => ({
    key: doctor.id,
    text: doctor.display_name
  }));

  const typeOptions: IDropdownOption[] = [
    { key: '1toN', text: 'Any Doctor (1:N)' },
    { key: '1to1', text: 'Specific Doctor (1:1)' }
  ];

  if (isLoading) {
    return (
      <Stack horizontalAlign="center" verticalAlign="center" className={containerStyle}>
        <Text>Loading...</Text>
      </Stack>
    );
  }

  return (
    <Stack className={containerStyle} tokens={containerTokens}>
      <CommandBar items={commandBarItems} farItems={commandBarFarItems} />

      <Stack className={configContainerStyle} tokens={configContainerStackTokens}>
        <Text role={'heading'} aria-level={1} className={headerStyle}>
          {user.role === 'patient'
            ? 'My Conversations'
            : user.role === 'doctor'
            ? 'Patient Conversations'
            : 'Administration Dashboard'}
        </Text>

        {error && (
          <MessageBar messageBarType={MessageBarType.error} style={{ marginBottom: '20px' }}>
            {error}
          </MessageBar>
        )}

        {user.role === 'admin' ? (
          <Pivot
            selectedKey={activeTab}
            onLinkClick={(item) => setActiveTab(item?.props.itemKey || 'conversations')}
            style={{ marginBottom: '20px' }}
          >
            <PivotItem headerText="Conversations" itemKey="conversations">
              <DetailsList
                items={conversations}
                columns={conversationColumns}
                layoutMode={DetailsListLayoutMode.justified}
                isHeaderVisible={true}
              />

              {conversations.length === 0 && (
                <Stack horizontalAlign="center" style={{ marginTop: '40px' }}>
                  <Text variant="large">No conversations found</Text>
                </Stack>
              )}
            </PivotItem>
            
            <PivotItem headerText="Analytics" itemKey="analytics">
              <Analytics isVisible={activeTab === 'analytics'} />
            </PivotItem>
          </Pivot>
        ) : (
          <>
            <DetailsList
              items={conversations}
              columns={conversationColumns}
              layoutMode={DetailsListLayoutMode.justified}
              isHeaderVisible={true}
            />

            {conversations.length === 0 && (
              <Stack horizontalAlign="center" style={{ marginTop: '40px' }}>
                <Text variant="large">No conversations found</Text>
                {user.role === 'patient' && (
                  <PrimaryButton
                    text="Start Your First Consultation"
                    onClick={onStartConsultation}
                    className={buttonStyle}
                    style={{ marginTop: '20px' }}
                  />
                )}
              </Stack>
            )}
          </>
        )}
      </Stack>

      <Modal isOpen={showCreateModal} onDismiss={() => setShowCreateModal(false)} isBlocking={false}>
        <Stack style={{ padding: '30px', minWidth: '400px' }}>
          <Text variant="xLarge" style={{ marginBottom: '20px' }}>
            Create New Conversation
          </Text>

          <TextField
            label="Conversation Title"
            value={newConversationTitle}
            onChange={(_, newValue) => setNewConversationTitle(newValue || '')}
            required
            style={{ marginBottom: '15px' }}
          />

          <Dropdown
            label="Conversation Type"
            options={typeOptions}
            selectedKey={newConversationType}
            onChange={(_, option) => setNewConversationType(option?.key as '1to1' | '1toN')}
            style={{ marginBottom: '15px' }}
          />

          {newConversationType === '1to1' && (
            <Dropdown
              label="Select Doctor"
              placeholder="Choose a doctor"
              options={doctorOptions}
              selectedKey={selectedDoctorId}
              onChange={(_, option) => setSelectedDoctorId(option?.key as number)}
              style={{ marginBottom: '15px' }}
            />
          )}

          <Stack horizontal tokens={{ childrenGap: 10 }} style={{ marginTop: '20px' }}>
            <PrimaryButton
              text={isCreating ? 'Creating...' : 'Create'}
              onClick={handleCreateConversation}
              disabled={isCreating}
            />
            <DefaultButton text="Cancel" onClick={() => setShowCreateModal(false)} />
          </Stack>
        </Stack>
      </Modal>

      <ImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={loadData}
      />
    </Stack>
  );
};
