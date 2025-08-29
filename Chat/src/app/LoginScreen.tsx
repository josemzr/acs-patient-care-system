// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState } from 'react';
import {
  Stack,
  Text,
  TextField,
  PrimaryButton,
  DefaultButton,
  MessageBar,
  MessageBarType,
  Dropdown,
  IDropdownOption
} from '@fluentui/react';
import { authAPI, User } from './utils/patientCareAPI';
import {
  containerStyle,
  containerTokens,
  headerStyle,
  configContainerStyle,
  configContainerStackTokens,
  buttonStyle
} from './styles/HomeScreen.styles';

interface LoginScreenProps {
  onLoginSuccess: (user: User, token: string) => void;
  onShowRegister: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, onShowRegister }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleLogin = async () => {
    if (!email || !password) {
      setError('Email and password are required');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const result = await authAPI.login(email, password);

      if (result.success && result.token && result.user) {
        authAPI.setToken(result.token);
        onLoginSuccess(result.user, result.token);
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <Stack horizontalAlign="center" verticalAlign="center" tokens={containerTokens} className={containerStyle}>
      <Stack className={configContainerStyle} tokens={configContainerStackTokens}>
        <Text role={'heading'} aria-level={1} className={headerStyle}>
          Patient Care System
        </Text>

        <Text variant="mediumPlus" style={{ marginBottom: '20px' }}>
          Sign in to access your conversations
        </Text>

        {error && (
          <MessageBar messageBarType={MessageBarType.error} style={{ marginBottom: '20px' }}>
            {error}
          </MessageBar>
        )}

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(_, newValue) => setEmail(newValue || '')}
          onKeyPress={handleKeyPress}
          required
          style={{ marginBottom: '15px' }}
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(_, newValue) => setPassword(newValue || '')}
          onKeyPress={handleKeyPress}
          required
          style={{ marginBottom: '20px' }}
        />

        <PrimaryButton
          text={isLoading ? 'Signing in...' : 'Sign In'}
          onClick={handleLogin}
          disabled={isLoading}
          className={buttonStyle}
          style={{ marginBottom: '10px' }}
        />

        <DefaultButton text="Create Account" onClick={onShowRegister} className={buttonStyle} />

        <Stack style={{ marginTop: '30px', padding: '15px', backgroundColor: '#f3f2f1', borderRadius: '4px' }}>
          <Text variant="small" style={{ fontWeight: 'bold', marginBottom: '5px' }}>
            Demo Accounts:
          </Text>
          <Text variant="small">Admin: admin@example.com / admin123</Text>
          <Text variant="small">Doctor: doctor@example.com / doctor123</Text>
          <Text variant="small">Patient: patient@example.com / patient123</Text>
          <Text variant="small">Quality: quality@example.com / quality123</Text>
        </Stack>
      </Stack>
    </Stack>
  );
};

interface RegisterScreenProps {
  onRegisterSuccess: () => void;
  onShowLogin: () => void;
}

export const RegisterScreen: React.FC<RegisterScreenProps> = ({ onRegisterSuccess, onShowLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'patient' | 'doctor' | 'quality'>('patient');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  const roleOptions: IDropdownOption[] = [
    { key: 'patient', text: 'Patient' },
    { key: 'doctor', text: 'Doctor' },
    { key: 'quality', text: 'Quality Assurance' }
  ];

  const handleRegister = async () => {
    if (!email || !password || !displayName) {
      setError('All fields are required');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await authAPI.register(email, password, role, displayName);

      if (result.success) {
        setSuccess('Account created successfully! You can now sign in.');
        setTimeout(() => {
          onRegisterSuccess();
        }, 2000);
      } else {
        setError(result.message || 'Registration failed');
      }
    } catch (error) {
      setError('Network error. Please try again.');
      console.error('Registration error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      handleRegister();
    }
  };

  return (
    <Stack horizontalAlign="center" verticalAlign="center" tokens={containerTokens} className={containerStyle}>
      <Stack className={configContainerStyle} tokens={configContainerStackTokens}>
        <Text role={'heading'} aria-level={1} className={headerStyle}>
          Create Account
        </Text>

        <Text variant="mediumPlus" style={{ marginBottom: '20px' }}>
          Join the Patient Care System
        </Text>

        {error && (
          <MessageBar messageBarType={MessageBarType.error} style={{ marginBottom: '20px' }}>
            {error}
          </MessageBar>
        )}

        {success && (
          <MessageBar messageBarType={MessageBarType.success} style={{ marginBottom: '20px' }}>
            {success}
          </MessageBar>
        )}

        <TextField
          label="Full Name"
          value={displayName}
          onChange={(_, newValue) => setDisplayName(newValue || '')}
          onKeyPress={handleKeyPress}
          required
          style={{ marginBottom: '15px' }}
        />

        <TextField
          label="Email"
          type="email"
          value={email}
          onChange={(_, newValue) => setEmail(newValue || '')}
          onKeyPress={handleKeyPress}
          required
          style={{ marginBottom: '15px' }}
        />

        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(_, newValue) => setPassword(newValue || '')}
          onKeyPress={handleKeyPress}
          required
          style={{ marginBottom: '15px' }}
        />

        <Dropdown
          label="Role"
          options={roleOptions}
          selectedKey={role}
          onChange={(_, option) => setRole(option?.key as 'patient' | 'doctor' | 'quality')}
          style={{ marginBottom: '20px' }}
        />

        <PrimaryButton
          text={isLoading ? 'Creating Account...' : 'Create Account'}
          onClick={handleRegister}
          disabled={isLoading}
          className={buttonStyle}
          style={{ marginBottom: '10px' }}
        />

        <DefaultButton text="Back to Sign In" onClick={onShowLogin} className={buttonStyle} />
      </Stack>
    </Stack>
  );
};
