// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import request from 'supertest';
import app from '../app';
import { DatabaseService, UserRole } from '../lib/database';

describe('Attachments Routes', () => {
  let authToken: string;
  let userId: number;
  let conversationId: number;

  beforeAll(async () => {
    // Create a test user and get auth token
    try {
      await DatabaseService.createUser('test@attachments.com', 'password', UserRole.PATIENT, 'Test Patient');
    } catch (error) {
      // User might already exist
    }

    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'test@attachments.com',
        password: 'password'
      });

    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.token;
    userId = loginResponse.body.user.id;

    // Create a test conversation
    const conversationResponse = await request(app)
      .post('/conversations')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Test Conversation for Attachments',
        type: '1toN'
      });

    expect(conversationResponse.status).toBe(201);
    conversationId = conversationResponse.body.conversation.id;
  });

  test('GET /attachments/:conversationId - should list attachments for conversation', async () => {
    const response = await request(app)
      .get(`/attachments/${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.attachments)).toBe(true);
  });

  test('GET /attachments/:conversationId - should return 401 without auth', async () => {
    const response = await request(app)
      .get(`/attachments/${conversationId}`);

    expect(response.status).toBe(401);
  });

  test('GET /attachments/999 - should return 404 for non-existent conversation', async () => {
    const response = await request(app)
      .get('/attachments/999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
  });

  test('POST /attachments/upload/:conversationId - should require file', async () => {
    const response = await request(app)
      .post(`/attachments/upload/${conversationId}`)
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('No file provided');
  });

  test('GET /attachments/download/999 - should return 404 for non-existent attachment', async () => {
    const response = await request(app)
      .get('/attachments/download/999')
      .set('Authorization', `Bearer ${authToken}`);

    expect(response.status).toBe(404);
  });
});