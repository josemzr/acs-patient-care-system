// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import request from 'supertest';
import app from '../app';
import { DatabaseService } from '../lib/database';

describe('Import Routes', () => {
  beforeEach(async () => {
    // Mock database methods for testing
    jest.spyOn(DatabaseService, 'createUser').mockResolvedValue(1);
    jest.spyOn(DatabaseService, 'getUserByEmail').mockResolvedValue(null);
    jest.spyOn(DatabaseService, 'getUserById').mockResolvedValue({
      id: 1,
      email: 'admin@example.com',
      password_hash: 'hash',
      role: 'admin' as any,
      display_name: 'Admin User',
      created_at: '2023-01-01'
    });
    jest.spyOn(DatabaseService, 'createConversation').mockResolvedValue(1);
    jest.spyOn(DatabaseService, 'addConversationParticipant').mockResolvedValue();
    jest.spyOn(DatabaseService, 'addConversationMetadata').mockResolvedValue();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /import/conversations', () => {
    it('should reject requests without admin role', async () => {
      // Mock non-admin user
      jest.spyOn(DatabaseService, 'getUserById').mockResolvedValue({
        id: 2,
        email: 'patient@example.com',
        password_hash: 'hash',
        role: 'patient' as any,
        display_name: 'Patient User',
        created_at: '2023-01-01'
      });

      const importData = [{
        source: 'test',
        source_id: 'test-1',
        title: 'Test Conversation',
        type: '1to1',
        participants: [] as any[],
        messages: [] as any[],
        created_at: '2023-01-01T00:00:00Z',
        exported_at: '2023-01-01T00:00:00Z',
        message_count: 0
      }];

      const response = await request(app)
        .post('/import/conversations')
        .set('Authorization', 'Bearer valid-token')
        .attach('importFile', Buffer.from(JSON.stringify(importData)), 'test.json')
        .expect(403);

      expect(response.body.message).toBe('Insufficient permissions');
    });

    it('should require import file', async () => {
      const response = await request(app)
        .post('/import/conversations')
        .set('Authorization', 'Bearer valid-token')
        .expect(400);

      expect(response.body.message).toBe('Import file is required');
    });

    it('should validate JSON format', async () => {
      const response = await request(app)
        .post('/import/conversations')
        .set('Authorization', 'Bearer valid-token')
        .attach('importFile', Buffer.from('invalid json'), 'test.json')
        .expect(400);

      expect(response.body.message).toBe('Invalid JSON file format');
    });

    it('should import valid conversations', async () => {
      // Mock createThread to return a thread ID
      const mockCreateThread = jest.fn().mockResolvedValue('test-thread-id');
      jest.doMock('../lib/chat/moderator', () => ({
        createThread: mockCreateThread
      }));

      const importData = [{
        source: 'rocketchat',
        source_id: 'rc-room-1',
        title: 'Patient - Doctor Chat',
        type: '1to1',
        participants: [
          {
            id: 'patient-1',
            username: 'patient1',
            display_name: 'John Doe',
            email: 'john@example.com',
            role: 'patient'
          },
          {
            id: 'doctor-1',
            username: 'doctor1',
            display_name: 'Dr. Smith',
            email: 'dr.smith@example.com',
            role: 'doctor'
          }
        ],
        messages: [
          {
            id: 'msg-1',
            content: 'Hello doctor',
            sender_id: 'patient-1',
            sender_display_name: 'John Doe',
            created_on: '2023-01-01T10:00:00Z',
            type: 'text'
          }
        ],
        created_at: '2023-01-01T09:00:00Z',
        exported_at: '2023-01-01T11:00:00Z',
        message_count: 1
      }];

      const response = await request(app)
        .post('/import/conversations')
        .set('Authorization', 'Bearer valid-token')
        .attach('importFile', Buffer.from(JSON.stringify(importData)), 'import.json')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('1 conversations imported');
    });
  });

  describe('POST /import/rocketchat/export', () => {
    it('should require admin role', async () => {
      // Mock non-admin user
      jest.spyOn(DatabaseService, 'getUserById').mockResolvedValue({
        id: 2,
        email: 'patient@example.com',
        password_hash: 'hash',
        role: 'patient' as any,
        display_name: 'Patient User',
        created_at: '2023-01-01'
      });

      const response = await request(app)
        .post('/import/rocketchat/export')
        .set('Authorization', 'Bearer valid-token')
        .send({
          serverUrl: 'https://rocket.example.com',
          username: 'admin',
          password: 'password'
        })
        .expect(403);

      expect(response.body.message).toBe('Insufficient permissions');
    });

    it('should require connection parameters', async () => {
      const response = await request(app)
        .post('/import/rocketchat/export')
        .set('Authorization', 'Bearer valid-token')
        .send({})
        .expect(400);

      expect(response.body.message).toBe('Server URL, username, and password are required');
    });
  });

  describe('POST /import/conversations/direct', () => {
    it('should require admin role', async () => {
      // Mock non-admin user
      jest.spyOn(DatabaseService, 'getUserById').mockResolvedValue({
        id: 2,
        email: 'doctor@example.com',
        password_hash: 'hash',
        role: 'doctor' as any,
        display_name: 'Doctor User',
        created_at: '2023-01-01'
      });

      const response = await request(app)
        .post('/import/conversations/direct')
        .set('Authorization', 'Bearer valid-token')
        .send({
          serverUrl: 'https://rocket.example.com',
          username: 'admin',
          password: 'password'
        })
        .expect(403);

      expect(response.body.message).toBe('Insufficient permissions');
    });

    it('should require connection parameters', async () => {
      const response = await request(app)
        .post('/import/conversations/direct')
        .set('Authorization', 'Bearer valid-token')
        .send({
          serverUrl: 'https://rocket.example.com'
          // missing username and password
        })
        .expect(400);

      expect(response.body.message).toBe('Server URL, username, and password are required');
    });
  });
});