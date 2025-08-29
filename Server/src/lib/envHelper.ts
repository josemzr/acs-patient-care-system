// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import * as fs from 'fs';
import * as path from 'path';
const appSettingsPath = path.join(__dirname, '../../appsettings.json');
let appSettings: {
  ResourceConnectionString: string;
  EndpointUrl: string;
  AdminUserId: string;
  AzureBlobStorageConnectionString: string;
};
if (
  !(
    process.env['ResourceConnectionString'] ||
    process.env['EndpointUrl'] ||
    process.env['AdminUserId'] ||
    process.env['AzureBlobStorageConnectionString']
  )
) {
  if (!fs.existsSync(appSettingsPath)) {
    throw new Error(
      'No appsettings.json found. Please provide an appsettings.json file by copying appsettings.json.sample and removing the .sample extension'
    );
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    appSettings = require(appSettingsPath);
  }
}

/**
 * Retrieves the ACS connection string from environment variables or appsettings.json
 *
 * @returns The ACS connection string from environment variables or appsettings.json
 * @throws Error if no ACS connection string is provided
 */
export const getResourceConnectionString = (): string => {
  const resourceConnectionString = process.env['ResourceConnectionString'] || appSettings.ResourceConnectionString;

  if (!resourceConnectionString || resourceConnectionString === 'REPLACE_WITH_CONNECTION_STRING') {
    throw new Error('No ACS connection string provided - running in demo mode');
  }

  return resourceConnectionString;
};

/**
 * Retrieves the ACS endpoint URL from environment variables or appsettings.json
 *
 * @returns The ACS endpoint URL from environment variables or appsettings.json
 */
export const getEndpoint = (): string => {
  try {
    const endpointUrl = process.env['EndpointUrl'] || appSettings.EndpointUrl;
    if (!endpointUrl || endpointUrl === 'REPLACE_WITH_ENDPOINT_URL') {
      throw new Error('No ACS endpoint URL provided - running in demo mode');
    }
    const uri = new URL(endpointUrl);
    return `${uri.protocol}//${uri.host}`;
  } catch (error) {
    throw new Error('Invalid endpoint URL - running in demo mode');
  }
};

/**
 * Retrieves the ACS Admin UserId from environment variables or appsettings.json
 *
 * @returns The ACS Admin UserId from environment variables or appsettings.json
 * @throws Error if no ACS Admin UserId is provided
 */
export const getAdminUserId = (): string => {
  const adminUserId = process.env['AdminUserId'] || appSettings.AdminUserId;

  if (!adminUserId || adminUserId === 'REPLACE_WITH_ADMIN_USER_ID') {
    throw new Error('No ACS Admin UserId provided - running in demo mode');
  }

  return adminUserId;
};

/**
 * Retrieves the Azure Blob Storage endpoint from environment variables or appsettings.json
 *
 * @returns The Azure Blob Storage endpoint URL
 */
export const getAzureBlobStorageEndpoint = (): string => {
  const uri = new URL(process.env['EndpointUrl'] || appSettings.EndpointUrl);
  return `${uri.protocol}//${uri.host}`;
};

/**
 * Retrieves the Azure Blob Storage connection string from environment variables or appsettings.json
 *
 * @returns The Azure Blob Storage connection string
 * @throws Error if no Azure Blob Storage connection string is provided
 */
export const getAzureBlobStorageConnectionString = (): string => {
  const accountName = process.env['AzureBlobStorageConnectionString'] || appSettings.AzureBlobStorageConnectionString;

  if (!accountName) {
    throw new Error('No Azure Blob Storage Connection String provided');
  }

  return accountName;
};
