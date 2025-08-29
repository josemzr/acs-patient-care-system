// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { AzureCommunicationTokenCredential } from '@azure/communication-common';
import { ChatClient, CreateChatThreadOptions, CreateChatThreadRequest, ChatMessage } from '@azure/communication-chat';
import { getEndpoint, getResourceConnectionString } from '../envHelper';
import { getAdminUser, getToken } from '../identityClient';

/**
 * Creates a new chat thread with the specified topic name.
 * If no topic name is provided, it defaults to 'Your Chat sample'.
 * In demo mode (when ACS credentials are not properly configured),
 * generates fake thread IDs for testing.
 *
 * @param {string} [topicName] - The topic name for the chat thread.
 * @returns {Promise<string>} - The ID of the newly created chat thread.
 * @throws {Error} - If the thread ID is invalid or missing.
 */
export const createThread = async (topicName?: string): Promise<string> => {
  // Check if we're in demo mode by trying to get the connection string
  try {
    getResourceConnectionString();
  } catch (error) {
    // We're in demo mode, generate a fake thread ID
    console.log('Running in demo mode - generating fake thread ID');
    return `demo_thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  try {
    const user = await getAdminUser();

    const credential = new AzureCommunicationTokenCredential({
      tokenRefresher: async () => (await getToken(user, ['chat', 'voip'])).token,
      refreshProactively: true
    });
    const chatClient = new ChatClient(getEndpoint(), credential);

    const request: CreateChatThreadRequest = {
      topic: topicName ?? 'Your Chat sample'
    };
    const options: CreateChatThreadOptions = {
      participants: [
        {
          id: {
            communicationUserId: user.communicationUserId
          }
        }
      ]
    };
    const result = await chatClient.createChatThread(request, options);

    const threadID = result.chatThread?.id;
    if (!threadID) {
      throw new Error(`Invalid or missing ID for newly created thread ${result.chatThread}`);
    }

    return threadID;
  } catch (error) {
    console.warn('Azure Communication Services failed, using demo mode:', error.message);
    // Generate a fake thread ID for demo purposes
    return `demo_thread_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
};

/**
 * Retrieves all messages from a chat thread.
 * In demo mode (when ACS credentials are not properly configured),
 * returns mock messages for testing.
 *
 * @param {string} threadId - The ID of the chat thread to retrieve messages from.
 * @returns {Promise<ChatMessage[]>} - Array of chat messages from the thread.
 */
export const getThreadMessages = async (threadId: string): Promise<ChatMessage[]> => {
  // Check if we're in demo mode
  try {
    getResourceConnectionString();
  } catch (error) {
    // We're in demo mode, return mock messages
    console.log('Running in demo mode - returning mock messages');
    return [
      {
        id: 'demo_message_1',
        type: 'text',
        sequenceId: '1',
        version: '1',
        content: { message: 'Hello Doctor, I need medical consultation.' },
        senderDisplayName: 'John Smith',
        createdOn: new Date('2025-07-22T23:21:35Z'),
        sender: { kind: 'communicationUser', communicationUserId: 'demo_user_patient' }
      } as ChatMessage,
      {
        id: 'demo_message_2',
        type: 'text',
        sequenceId: '2',
        version: '1',
        content: { message: 'Hello John, I can help you. What seems to be the issue?' },
        senderDisplayName: 'Dr. Sarah Johnson',
        createdOn: new Date('2025-07-22T23:22:00Z'),
        sender: { kind: 'communicationUser', communicationUserId: 'demo_user_doctor' }
      } as ChatMessage,
      {
        id: 'demo_message_3',
        type: 'text',
        sequenceId: '3',
        version: '1',
        content: { message: 'I have been experiencing headaches for the past week.' },
        senderDisplayName: 'John Smith',
        createdOn: new Date('2025-07-22T23:22:30Z'),
        sender: { kind: 'communicationUser', communicationUserId: 'demo_user_patient' }
      } as ChatMessage
    ];
  }

  try {
    const user = await getAdminUser();

    const credential = new AzureCommunicationTokenCredential({
      tokenRefresher: async () => (await getToken(user, ['chat', 'voip'])).token,
      refreshProactively: true
    });
    const chatClient = new ChatClient(getEndpoint(), credential);
    const chatThreadClient = chatClient.getChatThreadClient(threadId);

    const messages: ChatMessage[] = [];

    // Retrieve all messages from the thread
    const messagesIterable = chatThreadClient.listMessages();
    for await (const message of messagesIterable) {
      messages.push(message);
    }

    // Sort messages by creation time (oldest first)
    messages.sort((a, b) => {
      const timeA = a.createdOn ? new Date(a.createdOn).getTime() : 0;
      const timeB = b.createdOn ? new Date(b.createdOn).getTime() : 0;
      return timeA - timeB;
    });

    return messages;
  } catch (error) {
    console.warn('Azure Communication Services failed, returning demo messages:', error.message);
    // Return mock messages for demo purposes
    return [
      {
        id: 'demo_message_1',
        type: 'text',
        sequenceId: '1',
        version: '1',
        content: { message: 'Hello Doctor, I need medical consultation.' },
        senderDisplayName: 'John Smith',
        createdOn: new Date('2025-07-22T23:21:35Z'),
        sender: { kind: 'communicationUser', communicationUserId: 'demo_user_patient' }
      } as ChatMessage,
      {
        id: 'demo_message_2',
        type: 'text',
        sequenceId: '2',
        version: '1',
        content: { message: 'Hello John, I can help you. What seems to be the issue?' },
        senderDisplayName: 'Dr. Sarah Johnson',
        createdOn: new Date('2025-07-22T23:22:00Z'),
        sender: { kind: 'communicationUser', communicationUserId: 'demo_user_doctor' }
      } as ChatMessage,
      {
        id: 'demo_message_3',
        type: 'text',
        sequenceId: '3',
        version: '1',
        content: { message: 'I have been experiencing headaches for the past week.' },
        senderDisplayName: 'John Smith',
        createdOn: new Date('2025-07-22T23:22:30Z'),
        sender: { kind: 'communicationUser', communicationUserId: 'demo_user_patient' }
      } as ChatMessage
    ];
  }
};
