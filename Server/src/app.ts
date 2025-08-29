// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import express from 'express';
import cors from 'cors';
import createError from 'http-errors';
import logger from 'morgan';
import path from 'path';

import issueToken from './routes/issueToken';
import refreshToken from './routes/refreshToken';
import getEndpointUrl from './routes/getEndpointUrl';
import userConfig from './routes/userConfig';
import createThread from './routes/createThread';
import addUser from './routes/addUser';
import uploadToAzureBlobStorage from './routes/uploadToAzureBlobStorage';

// New patient care system routes
import auth from './routes/auth';
import conversations from './routes/conversations';
import users from './routes/users';
import attachments from './routes/attachments';
import analytics from './routes/analytics';
import importRoutes from './routes/import';

// Initialize database
import { initializeDatabase } from './lib/database';
import { createDemoUsers } from './lib/seedDatabase';

const app = express();

// Initialize database on startup
initializeDatabase()
  .then(() => createDemoUsers())
  .catch(console.error);

app.use(logger('tiny'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.resolve(__dirname, 'build')));

/**
 * route: /auth
 * purpose: Authentication endpoints (login, register, verify)
 */
app.use('/auth', cors(), auth);

/**
 * route: /conversations
 * purpose: Conversation management for patient care system
 */
app.use('/conversations', cors(), conversations);

/**
 * route: /users
 * purpose: User management endpoints
 */
app.use('/users', cors(), users);

/**
 * route: /attachments
 * purpose: File attachment management for conversations
 */
app.use('/attachments', cors(), attachments);

/**
 * route: /analytics
 * purpose: Analytics and reporting for administrators
 */
app.use('/analytics', cors(), analytics);

/**
 * route: /import
 * purpose: Import conversations from external sources (admin only)
 */
app.use('/import', cors(), importRoutes);

/**
 * route: /createThread
 * purpose: Chat: create a new chat thread
 */
app.use('/createThread', cors(), createThread);

/**
 * route: /addUser
 * purpose: Chat: add the user to the chat thread
 */
app.use('/addUser', cors(), addUser);

/**
 * route: /refreshToken
 * purpose: Chat,Calling: get a new token
 */
app.use('/refreshToken', cors(), refreshToken);

/**
 * route: /getEndpointUrl
 * purpose: Chat,Calling: get the endpoint url of ACS resource
 */
app.use('/getEndpointUrl', cors(), getEndpointUrl);

/**
 * route: /token
 * purpose: Chat,Calling: get ACS token with the given scope
 */
app.use('/token', cors(), issueToken);

/**
 * route: /userConfig
 * purpose: Chat: to add user details to userconfig for chat thread
 */
app.use('/userConfig', cors(), userConfig);

/**
 * route: /getLogUploadData
 * purpose: Get tokens and endpoints for uploading logs to Azure Blob Storage
 */
app.use('/uploadToAzureBlobStorage', cors(), uploadToAzureBlobStorage);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

export default app;
