// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import {
  CommunicationAccessToken,
  CommunicationIdentityClient,
  CommunicationUserToken,
  TokenScope
} from '@azure/communication-identity';
import { CommunicationUserIdentifier } from '@azure/communication-common';
import { getResourceConnectionString, getAdminUserId } from './envHelper';

// lazy init to allow mocks in test
let identityClient: CommunicationIdentityClient | undefined = undefined;
const getIdentityClient = (): CommunicationIdentityClient => {
  if (!identityClient) {
    try {
      identityClient = new CommunicationIdentityClient(getResourceConnectionString());
    } catch (error) {
      console.warn('Azure Communication Services identity client not configured, using demo mode:', error.message);
      throw error; // Re-throw to be caught by calling functions
    }
  }
  return identityClient;
};

/**
 *
 * @returns The CommunicationUserIdentifier for the admin user.
 */
export const getAdminUser = (): CommunicationUserIdentifier => {
  try {
    return { communicationUserId: getAdminUserId() };
  } catch (error) {
    console.warn('Admin user ID not configured, using demo mode');
    return { communicationUserId: 'demo_admin_user' };
  }
};

/**
 * Retrieves a CommunicationAccessToken for the admin user with the specified scopes.
 * In demo mode, returns a fake token.
 *
 * @param scopes - The scopes for which the token is requested.
 * @param user - The CommunicationUserIdentifier for which the token is requested.
 * @returns A promise that resolves to a CommunicationAccessToken.
 */
export const getToken = async (
  user: CommunicationUserIdentifier,
  scopes: TokenScope[]
): Promise<CommunicationAccessToken> => {
  try {
    return await getIdentityClient().getToken(user, scopes);
  } catch (error) {
    console.warn('Azure Communication Services not configured, returning demo token');
    // Return a fake token for demo purposes
    return {
      token: `demo_token_${Date.now()}`,
      expiresOn: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    };
  }
};

/**
 * Creates a new CommunicationUserIdentifier and a CommunicationUserToken for the admin user with the specified scopes.
 * In demo mode, returns fake user and token.
 *
 * @param scopes - The scopes for which the token is requested.
 * @returns A promise that resolves to a CommunicationUserToken.
 */
export const createUserAndToken = async (scopes: TokenScope[]): Promise<CommunicationUserToken> => {
  try {
    return await getIdentityClient().createUserAndToken(scopes);
  } catch (error) {
    console.warn('Azure Communication Services not configured, returning demo user and token');
    // Return fake user and token for demo purposes
    return {
      user: { communicationUserId: `demo_user_${Date.now()}` },
      token: `demo_token_${Date.now()}`,
      expiresOn: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours from now
    };
  }
};
