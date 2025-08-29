// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState } from 'react';
import {
  Modal,
  PrimaryButton,
  DefaultButton,
  TextField,
  Text,
  Stack,
  MessageBar,
  MessageBarType,
  ProgressIndicator,
  Label,
  PivotItem,
  Pivot,
  DetailsList,
  DetailsListLayoutMode,
  IColumn,
  SelectionMode
} from '@fluentui/react';
import { importAPI } from './utils/patientCareAPI';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: () => void;
}

interface ImportResult {
  successful: number;
  failed: number;
  errors: Array<{ conversation: string; error: string }>;
  createdUsers: Array<{ email: string; role: string }>;
  skippedUsers: Array<{ email: string; reason: string }>;
}

export const ImportModal: React.FC<ImportModalProps> = ({ isOpen, onClose, onImportSuccess }) => {
  const [selectedTab, setSelectedTab] = useState('rocketchat');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // RocketChat connection form
  const [rocketChatUrl, setRocketChatUrl] = useState('');
  const [rocketChatUsername, setRocketChatUsername] = useState('');
  const [rocketChatPassword, setRocketChatPassword] = useState('');

  // File import
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const resetForm = () => {
    setError('');
    setSuccess('');
    setImportResult(null);
    setSelectedFile(null);
    setRocketChatUrl('');
    setRocketChatUsername('');
    setRocketChatPassword('');
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const validateRocketChatForm = () => {
    if (!rocketChatUrl || !rocketChatUsername || !rocketChatPassword) {
      setError('Please fill in all RocketChat connection fields');
      return false;
    }

    try {
      new URL(rocketChatUrl);
    } catch {
      setError('Please enter a valid RocketChat server URL');
      return false;
    }

    return true;
  };

  const handleDirectImport = async () => {
    if (!validateRocketChatForm()) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await importAPI.importDirectFromRocketChat(
        rocketChatUrl,
        rocketChatUsername,
        rocketChatPassword
      );

      if (result.success) {
        setSuccess(result.message || 'Import completed successfully!');
        setImportResult(result.data);
        onImportSuccess();
      } else {
        setError(result.message || 'Import failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Direct import error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExportFromRocketChat = async () => {
    if (!validateRocketChatForm()) return;

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await importAPI.exportFromRocketChat(
        rocketChatUrl,
        rocketChatUsername,
        rocketChatPassword
      );

      if (result.success && result.data) {
        // Download the exported data as JSON
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rocketchat_export_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        window.URL.revokeObjectURL(url);

        setSuccess(`Successfully exported ${result.data.conversations?.length || 0} conversations. File downloaded.`);
      } else {
        setError(result.message || 'Export failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Export error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileImport = async () => {
    if (!selectedFile) {
      setError('Please select a file to import');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await importAPI.importConversationsFile(selectedFile);

      if (result.success) {
        setSuccess(result.message || 'File imported successfully!');
        setImportResult(result.data);
        onImportSuccess();
      } else {
        setError(result.message || 'Import failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('File import error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type !== 'application/json' && !file.name.endsWith('.json')) {
        setError('Please select a JSON file');
        return;
      }
      setSelectedFile(file);
      setError('');
    }
  };

  const errorColumns: IColumn[] = [
    {
      key: 'conversation',
      name: 'Conversation',
      fieldName: 'conversation',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true
    },
    {
      key: 'error',
      name: 'Error',
      fieldName: 'error',
      minWidth: 300,
      isResizable: true
    }
  ];

  const userColumns: IColumn[] = [
    {
      key: 'email',
      name: 'Email',
      fieldName: 'email',
      minWidth: 200,
      maxWidth: 300,
      isResizable: true
    },
    {
      key: 'role',
      name: 'Role',
      fieldName: 'role',
      minWidth: 100,
      maxWidth: 150
    },
    {
      key: 'reason',
      name: 'Reason',
      fieldName: 'reason',
      minWidth: 200,
      isResizable: true
    }
  ];

  return (
    <Modal
      isOpen={isOpen}
      onDismiss={handleClose}
      isBlocking={false}
      containerClassName="import-modal"
      styles={{ main: { minWidth: '800px', maxWidth: '1000px' } }}
    >
      <div style={{ padding: '24px' }}>
        <Text variant="xxLarge" block style={{ marginBottom: '16px' }}>
          Import Conversations
        </Text>
        <Text variant="medium" block style={{ marginBottom: '24px', color: '#666' }}>
          Import 1:1 conversations from RocketChat into this system. Only administrators can perform imports.
        </Text>

        {error && (
          <MessageBar
            messageBarType={MessageBarType.error}
            dismissButtonAriaLabel="Close"
            onDismiss={() => setError('')}
            style={{ marginBottom: '16px' }}
          >
            {error}
          </MessageBar>
        )}

        {success && (
          <MessageBar
            messageBarType={MessageBarType.success}
            dismissButtonAriaLabel="Close"
            onDismiss={() => setSuccess('')}
            style={{ marginBottom: '16px' }}
          >
            {success}
          </MessageBar>
        )}

        {isLoading && (
          <div style={{ marginBottom: '16px' }}>
            <ProgressIndicator description="Processing import..." />
          </div>
        )}

        <Pivot selectedKey={selectedTab} onLinkClick={(item) => setSelectedTab(item?.props.itemKey || 'rocketchat')}>
          <PivotItem headerText="Direct Import" itemKey="rocketchat">
            <Stack tokens={{ childrenGap: 16 }} style={{ marginTop: '16px' }}>
              <Text variant="medium">
                Connect directly to RocketChat and import all 1:1 conversations.
              </Text>
              
              <TextField
                label="RocketChat Server URL"
                placeholder="https://your-rocketchat-server.com"
                value={rocketChatUrl}
                onChange={(_, newValue) => setRocketChatUrl(newValue || '')}
                required
                disabled={isLoading}
              />
              
              <TextField
                label="Username"
                placeholder="Your RocketChat username"
                value={rocketChatUsername}
                onChange={(_, newValue) => setRocketChatUsername(newValue || '')}
                required
                disabled={isLoading}
              />
              
              <TextField
                label="Password"
                type="password"
                placeholder="Your RocketChat password"
                value={rocketChatPassword}
                onChange={(_, newValue) => setRocketChatPassword(newValue || '')}
                required
                disabled={isLoading}
              />

              <Stack horizontal tokens={{ childrenGap: 16 }}>
                <PrimaryButton
                  text="Import Conversations"
                  onClick={handleDirectImport}
                  disabled={isLoading}
                />
                <DefaultButton
                  text="Export Only"
                  onClick={handleExportFromRocketChat}
                  disabled={isLoading}
                />
              </Stack>
            </Stack>
          </PivotItem>

          <PivotItem headerText="File Import" itemKey="file">
            <Stack tokens={{ childrenGap: 16 }} style={{ marginTop: '16px' }}>
              <Text variant="medium">
                Import conversations from a previously exported JSON file.
              </Text>
              
              <div>
                <Label required>Select JSON File</Label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={handleFileSelect}
                  disabled={isLoading}
                  style={{ marginTop: '8px' }}
                />
                {selectedFile && (
                  <Text variant="small" style={{ marginTop: '4px', color: '#666' }}>
                    Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </Text>
                )}
              </div>

              <PrimaryButton
                text="Import File"
                onClick={handleFileImport}
                disabled={isLoading || !selectedFile}
              />
            </Stack>
          </PivotItem>
        </Pivot>

        {importResult && (
          <div style={{ marginTop: '24px', padding: '16px', backgroundColor: '#f3f2f1', borderRadius: '4px' }}>
            <Text variant="large" block style={{ marginBottom: '12px' }}>
              Import Results
            </Text>
            <Stack tokens={{ childrenGap: 8 }}>
              <Text>✅ Successfully imported: {importResult.successful} conversations</Text>
              <Text>❌ Failed: {importResult.failed} conversations</Text>
              <Text>👤 Created users: {importResult.createdUsers.length}</Text>
              <Text>⚠️ Skipped users: {importResult.skippedUsers.length}</Text>
            </Stack>

            {importResult.errors.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <Text variant="mediumPlus" block style={{ marginBottom: '8px' }}>
                  Errors ({importResult.errors.length})
                </Text>
                <DetailsList
                  items={importResult.errors}
                  columns={errorColumns}
                  layoutMode={DetailsListLayoutMode.justified}
                  selectionMode={SelectionMode.none}
                  compact
                />
              </div>
            )}

            {importResult.createdUsers.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <Text variant="mediumPlus" block style={{ marginBottom: '8px' }}>
                  Created Users ({importResult.createdUsers.length})
                </Text>
                <DetailsList
                  items={importResult.createdUsers}
                  columns={userColumns.slice(0, 2)}
                  layoutMode={DetailsListLayoutMode.justified}
                  selectionMode={SelectionMode.none}
                  compact
                />
              </div>
            )}

            {importResult.skippedUsers.length > 0 && (
              <div style={{ marginTop: '16px' }}>
                <Text variant="mediumPlus" block style={{ marginBottom: '8px' }}>
                  Skipped Users ({importResult.skippedUsers.length})
                </Text>
                <DetailsList
                  items={importResult.skippedUsers}
                  columns={userColumns}
                  layoutMode={DetailsListLayoutMode.justified}
                  selectionMode={SelectionMode.none}
                  compact
                />
              </div>
            )}
          </div>
        )}

        <Stack horizontal horizontalAlign="end" tokens={{ childrenGap: 8 }} style={{ marginTop: '24px' }}>
          <DefaultButton text="Close" onClick={handleClose} disabled={isLoading} />
        </Stack>
      </div>
    </Modal>
  );
};