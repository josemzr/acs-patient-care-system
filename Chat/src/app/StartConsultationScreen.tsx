// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  PrimaryButton,
  DefaultButton,
  ChoiceGroup,
  IChoiceGroupOption,
  Dropdown,
  IDropdownOption,
  TextField,
  MessageBar,
  MessageBarType,
  Spinner
} from '@fluentui/react';
import { User, Doctor, usersAPI, conversationsAPI } from './utils/patientCareAPI';
import {
  containerStyle,
  containerTokens,
  headerStyle,
  configContainerStyle,
  configContainerStackTokens,
  buttonStyle
} from './styles/HomeScreen.styles';

interface StartConsultationScreenProps {
  user: User;
  onBack: () => void;
  onStartChat: (threadId: string, conversationTitle: string, conversationId: number, status?: 'active' | 'readonly' | 'archived') => void;
}

export const StartConsultationScreen: React.FC<StartConsultationScreenProps> = ({ user, onBack, onStartChat }) => {
  const [consultationType, setConsultationType] = useState<string>('any');
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [consultationTopic, setConsultationTopic] = useState<string>('');
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | undefined>();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    loadDoctors();
  }, []);

  const loadDoctors = async () => {
    try {
      const result = await usersAPI.getDoctors();
      if (result.success) {
        setDoctors(result.doctors || []);
      }
    } catch (error) {
      console.error('Failed to load doctors:', error);
    }
  };

  const consultationTypeOptions: IChoiceGroupOption[] = [
    {
      key: 'specific',
      text: 'Consult with specific doctor',
      iconProps: { iconName: 'Contact' }
    },
    {
      key: 'any',
      text: 'Consult with any doctor',
      iconProps: { iconName: 'Group' }
    },
    {
      key: 'general',
      text: 'General chat room',
      iconProps: { iconName: 'Chat' }
    }
  ];

  const specialtyOptions: IDropdownOption[] = [
    { key: 'cardiology', text: 'Cardiology' },
    { key: 'dermatology', text: 'Dermatology' },
    { key: 'endocrinology', text: 'Endocrinology' },
    { key: 'gastroenterology', text: 'Gastroenterology' },
    { key: 'general-medicine', text: 'General Medicine' },
    { key: 'neurology', text: 'Neurology' },
    { key: 'oncology', text: 'Oncology' },
    { key: 'orthopedics', text: 'Orthopedics' },
    { key: 'pediatrics', text: 'Pediatrics' },
    { key: 'psychiatry', text: 'Psychiatry' },
    { key: 'pulmonology', text: 'Pulmonology' },
    { key: 'radiology', text: 'Radiology' },
    { key: 'urology', text: 'Urology' }
  ];

  const doctorOptions: IDropdownOption[] = doctors.map((doctor) => ({
    key: doctor.id,
    text: doctor.display_name
  }));

  const generateConversationTitle = (): string => {
    if (consultationTopic.trim()) {
      return consultationTopic.trim().substring(0, 50);
    }

    switch (consultationType) {
      case 'specific': {
        const doctorName = doctors.find((d) => d.id === selectedDoctorId)?.display_name || 'Doctor';
        return `Consultation with ${doctorName}`;
      }
      case 'any':
        return selectedSpecialties.length > 0 ? `${selectedSpecialties[0]} Consultation` : 'Medical Consultation';
      case 'general':
        return 'General Discussion';
      default:
        return 'Medical Consultation';
    }
  };

  const handleStartConsultation = async () => {
    setError('');
    setIsLoading(true);

    try {
      // Validate inputs
      if (consultationType === 'specific' && !selectedDoctorId) {
        setError('Please select a doctor for specific consultations');
        setIsLoading(false);
        return;
      }

      const title = generateConversationTitle();
      const type = consultationType === 'general' ? '1toN' : consultationType === 'specific' ? '1to1' : '1toN';

      const result = await conversationsAPI.createConversation(
        title,
        type,
        consultationType === 'specific' ? selectedDoctorId : undefined
      );

      if (result.success && result.thread_id && result.conversation) {
        // Success - start the chat (new conversations are always active)
        onStartChat(result.thread_id, title, result.conversation.id, 'active');
      } else {
        setError(result.message || 'Failed to create consultation');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Start consultation error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const isFormValid = (): boolean => {
    if (consultationType === 'specific' && !selectedDoctorId) {
      return false;
    }
    return true;
  };

  return (
    <Stack horizontalAlign="center" verticalAlign="center" className={containerStyle} tokens={containerTokens}>
      <Stack className={configContainerStyle} tokens={configContainerStackTokens}>
        <Text role={'heading'} aria-level={1} className={headerStyle}>
          Start a Medical Consultation
        </Text>

        {error && (
          <MessageBar messageBarType={MessageBarType.error} style={{ marginBottom: '20px' }}>
            {error}
          </MessageBar>
        )}

        <Stack tokens={{ childrenGap: 20 }}>
          {/* Type of consultation */}
          <Stack>
            <Text variant="medium" style={{ fontWeight: 600, marginBottom: '10px' }}>
              Type of consultation
            </Text>
            <ChoiceGroup
              options={consultationTypeOptions}
              selectedKey={consultationType}
              onChange={(_, option) => option && setConsultationType(option.key)}
            />
          </Stack>

          {/* Doctor selection for specific consultation */}
          {consultationType === 'specific' && (
            <Dropdown
              label="Select Doctor"
              placeholder="Choose a doctor"
              options={doctorOptions}
              selectedKey={selectedDoctorId}
              onChange={(_, option) => setSelectedDoctorId(option?.key as number)}
              required
            />
          )}

          {/* Medical specialties (optional) */}
          {(consultationType === 'any' || consultationType === 'general') && (
            <Dropdown
              label="Medical specialties (optional)"
              placeholder="Select one or more specialties"
              multiSelect
              options={specialtyOptions}
              selectedKeys={selectedSpecialties}
              onChange={(_, option) => {
                if (option) {
                  const newSelection = [...selectedSpecialties];
                  if (option.selected) {
                    newSelection.push(option.key as string);
                  } else {
                    const index = newSelection.indexOf(option.key as string);
                    if (index > -1) {
                      newSelection.splice(index, 1);
                    }
                  }
                  setSelectedSpecialties(newSelection);
                }
              }}
            />
          )}

          {/* Consultation topic (optional) */}
          <TextField
            label="Consultation topic (optional)"
            placeholder="Brief description of your medical concern"
            multiline
            rows={4}
            value={consultationTopic}
            onChange={(_, newValue) => setConsultationTopic(newValue || '')}
            maxLength={500}
          />

          {/* Action buttons */}
          <Stack horizontal tokens={{ childrenGap: 10 }} horizontalAlign="start">
            <PrimaryButton
              text={isLoading ? 'Starting...' : 'Start Consultation'}
              onClick={handleStartConsultation}
              disabled={!isFormValid() || isLoading}
              className={buttonStyle}
            />
            <DefaultButton text="Back" onClick={onBack} disabled={isLoading} />
          </Stack>
        </Stack>

        {isLoading && (
          <Stack horizontalAlign="center" style={{ marginTop: '20px' }}>
            <Spinner label="Creating consultation..." />
          </Stack>
        )}
      </Stack>
    </Stack>
  );
};
