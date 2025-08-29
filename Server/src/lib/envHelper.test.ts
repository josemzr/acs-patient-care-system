// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { getResourceConnectionString, getEndpoint, getAdminUserId } from './envHelper';

describe('Environment Helper', () => {
  const originalEnv = process.env;

  afterEach(() => {
    // Restore original environment
    process.env = { ...originalEnv };
  });

  describe('Environment Variable Priority', () => {
    test('should prioritize ResourceConnectionString from env over config', () => {
      process.env['ResourceConnectionString'] = 'env_connection_string';
      
      const result = getResourceConnectionString();
      
      expect(result).toBe('env_connection_string');
    });

    test('should prioritize EndpointUrl from env over config', () => {
      process.env['EndpointUrl'] = 'https://test.communication.azure.com';
      
      const result = getEndpoint();
      
      expect(result).toBe('https://test.communication.azure.com');
    });

    test('should prioritize AdminUserId from env over config', () => {
      process.env['AdminUserId'] = 'env_admin_user_id';
      
      const result = getAdminUserId();
      
      expect(result).toBe('env_admin_user_id');
    });
  });

  describe('Placeholder Value Rejection', () => {
    test('should reject placeholder connection string from env vars', () => {
      process.env['ResourceConnectionString'] = 'REPLACE_WITH_CONNECTION_STRING';
      
      expect(() => getResourceConnectionString()).toThrow('No ACS connection string provided - running in demo mode');
    });

    test('should reject placeholder endpoint URL from env vars', () => {
      process.env['EndpointUrl'] = 'REPLACE_WITH_ENDPOINT_URL';
      
      expect(() => getEndpoint()).toThrow('Invalid endpoint URL - running in demo mode');
    });

    test('should reject placeholder admin user ID from env vars', () => {
      process.env['AdminUserId'] = 'REPLACE_WITH_ADMIN_USER_ID';
      
      expect(() => getAdminUserId()).toThrow('No ACS Admin UserId provided - running in demo mode');
    });
  });
});