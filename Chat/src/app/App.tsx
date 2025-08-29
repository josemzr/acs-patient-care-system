// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { setLogLevel } from '@azure/logger';
import { initializeIcons, Spinner } from '@fluentui/react';
import React, { useState, useEffect } from 'react';
import { ChatScreen } from './ChatScreen';
import ConfigurationScreen from './ConfigurationScreen';
import { EndScreen } from './EndScreen';
import { ErrorScreen } from './ErrorScreen';
import HomeScreen from './HomeScreen';
import { LoginScreen, RegisterScreen } from './LoginScreen';
import { Dashboard } from './Dashboard';
import { StartConsultationScreen } from './StartConsultationScreen';
import { getExistingThreadIdFromURL } from './utils/getParametersFromURL';
import { getBuildTime, getChatSDKVersion, getCommitID, getCommnicationReactSDKVersion } from './utils/utils';
import { initializeFileTypeIcons } from '@fluentui/react-file-type-icons';
import { authAPI, User } from './utils/patientCareAPI';

setLogLevel('error');

console.log(
  `ACS sample chat app. Last Updated ${getBuildTime()} with CommitID:${getCommitID()} using @azure/communication-chat:${getChatSDKVersion()} and @azure/communication-react:${getCommnicationReactSDKVersion()}`
);

initializeIcons();
initializeFileTypeIcons();

const ERROR_PAGE_TITLE_REMOVED = 'You have been removed from the chat.';

const webAppTitle = document.title;

export default (): JSX.Element => {
  const [page, setPage] = useState('loading');
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [threadId, setThreadId] = useState('');
  const [endpointUrl, setEndpointUrl] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [conversationId, setConversationId] = useState<number | undefined>();
  const [conversationTitle, setConversationTitle] = useState('');
  const [conversationStatus, setConversationStatus] = useState<'active' | 'readonly' | 'archived'>('active');
  const [showRegister, setShowRegister] = useState(false);
  const [showStartConsultation, setShowStartConsultation] = useState(false);

  // Check for existing authentication on component mount
  useEffect(() => {
    const checkAuth = async () => {
      const existingToken = authAPI.getToken();
      if (existingToken) {
        try {
          const result = await authAPI.verifyToken();
          if (result.success && result.user) {
            setUser(result.user);
            setPage('dashboard');
            return;
          }
        } catch (error) {
          console.error('Token verification failed:', error);
          authAPI.logout();
        }
      }

      // Check if there's a thread ID in URL - redirect to legacy flow
      const existingThreadId = getExistingThreadIdFromURL();
      if (existingThreadId) {
        setPage('configuration');
      } else {
        setPage('auth');
      }
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = (loggedInUser: User, authToken: string) => {
    setUser(loggedInUser);
    setPage('dashboard');
  };

  const handleLogout = () => {
    setUser(null);
    setPage('auth');
    // Clear other state
    setToken('');
    setUserId('');
    setDisplayName('');
    setThreadId('');
    setEndpointUrl('');
  };

  const handleJoinChat = (chatThreadId: string, title: string, convId: number, status?: 'active' | 'readonly' | 'archived') => {
    setThreadId(chatThreadId);
    setConversationId(convId);
    setConversationTitle(title);
    setConversationStatus(status || 'active');
    setShowStartConsultation(false); // Hide start consultation screen
    setPage('configuration');
  };

  const handleStartConsultation = () => {
    setShowStartConsultation(true);
  };

  const handleBackFromConsultation = () => {
    setShowStartConsultation(false);
  };

  const renderPage = (): JSX.Element => {
    switch (page) {
      case 'loading': {
        return <Spinner label={'Loading...'} ariaLive="assertive" labelPosition="top" />;
      }
      case 'auth': {
        document.title = `${showRegister ? 'register' : 'login'} - ${webAppTitle}`;
        return showRegister ? (
          <RegisterScreen onRegisterSuccess={() => setShowRegister(false)} onShowLogin={() => setShowRegister(false)} />
        ) : (
          <LoginScreen onLoginSuccess={handleLoginSuccess} onShowRegister={() => setShowRegister(true)} />
        );
      }
      case 'dashboard': {
        document.title = `dashboard - ${webAppTitle}`;
        if (!user) {
          setPage('auth');
          return <Spinner label={'Loading...'} ariaLive="assertive" labelPosition="top" />;
        }

        if (showStartConsultation) {
          return (
            <StartConsultationScreen user={user} onBack={handleBackFromConsultation} onStartChat={handleJoinChat} />
          );
        }

        return (
          <Dashboard
            user={user}
            onLogout={handleLogout}
            onJoinChat={handleJoinChat}
            onStartConsultation={handleStartConsultation}
          />
        );
      }
      case 'home': {
        document.title = `home - ${webAppTitle}`;
        return <HomeScreen />;
      }
      case 'configuration': {
        document.title = `configuration - ${webAppTitle}`;
        return (
          <ConfigurationScreen
            joinChatHandler={() => {
              setPage('chat');
            }}
            setToken={setToken}
            setUserId={setUserId}
            setDisplayName={setDisplayName}
            setThreadId={setThreadId}
            setEndpointUrl={setEndpointUrl}
            prefilledThreadId={threadId}
            prefilledDisplayName={user?.display_name || ''}
            conversationTitle={conversationTitle}
          />
        );
      }
      case 'chat': {
        document.title = `chat - ${webAppTitle}`;
        if (token && userId && displayName && threadId && endpointUrl) {
          return (
            <ChatScreen
              token={token}
              userId={userId}
              displayName={displayName}
              endpointUrl={endpointUrl}
              threadId={threadId}
              conversationId={conversationId}
              conversationStatus={conversationStatus}
              endChatHandler={(isParticipantRemoved) => {
                if (isParticipantRemoved) {
                  setPage('removed');
                } else {
                  setPage('end');
                }
              }}
            />
          );
        }

        return <Spinner label={'Loading...'} ariaLive="assertive" labelPosition="top" />;
      }
      case 'end': {
        document.title = `end chat - ${webAppTitle}`;
        return (
          <EndScreen
            rejoinHandler={() => {
              setPage('chat'); // use stored information to attempt to rejoin the chat thread
            }}
            homeHandler={() => {
              if (user) {
                setPage('dashboard');
              } else {
                window.location.href = window.location.origin + window.location.pathname;
              }
            }}
            userId={userId}
            displayName={displayName}
          />
        );
      }
      case 'removed': {
        document.title = `removed - ${webAppTitle}`;
        return (
          <ErrorScreen
            title={ERROR_PAGE_TITLE_REMOVED}
            homeHandler={() => {
              if (user) {
                setPage('dashboard');
              } else {
                window.location.href = window.location.origin + window.location.pathname;
              }
            }}
          />
        );
      }
      default:
        document.title = `error - ${webAppTitle}`;
        throw new Error('Page type not recognized');
    }
  };

  if (getExistingThreadIdFromURL() && page === 'loading') {
    setPage('configuration');
  }

  return renderPage();
};
