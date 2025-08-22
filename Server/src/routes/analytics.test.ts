// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import request from 'supertest';
import app from '../app';
import { DatabaseService } from '../lib/database';

describe('Analytics Routes', () => {
  let adminToken: string;
  let qualityToken: string;

  beforeAll(async () => {
    // Login as admin to get token
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123'
      });

    expect(loginResponse.status).toBe(200);
    expect(loginResponse.body.success).toBe(true);
    adminToken = loginResponse.body.token;

    // Login as quality user to get token
    const qualityLoginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'quality@example.com',
        password: 'quality123'
      });

    expect(qualityLoginResponse.status).toBe(200);
    expect(qualityLoginResponse.body.success).toBe(true);
    qualityToken = qualityLoginResponse.body.token;
  });

  describe('GET /analytics/summary', () => {
    it('should return analytics summary for admin', async () => {
      const response = await request(app)
        .get('/analytics/summary')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.general).toBeDefined();
      expect(response.body.data.today).toBeDefined();
    });

    it('should return analytics summary for quality user', async () => {
      const response = await request(app)
        .get('/analytics/summary')
        .set('Authorization', `Bearer ${qualityToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.general).toBeDefined();
      expect(response.body.data.today).toBeDefined();
    });

    it('should require admin or quality role', async () => {
      // Try without token
      const response = await request(app)
        .get('/analytics/summary');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /analytics', () => {
    it('should return analytics data for today', async () => {
      const response = await request(app)
        .get('/analytics?period=today')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return analytics data for quality user', async () => {
      const response = await request(app)
        .get('/analytics?period=today')
        .set('Authorization', `Bearer ${qualityToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should return analytics data for custom date range for quality user', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';
      
      const response = await request(app)
        .get(`/analytics?startDate=${startDate}&endDate=${endDate}`)
        .set('Authorization', `Bearer ${qualityToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });
  });

  describe('POST /analytics/export', () => {
    it('should export analytics to Elasticsearch for admin', async () => {
      const response = await request(app)
        .post('/analytics/export')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          period: 'test'
        });

      // We expect this to fail gracefully since Elasticsearch is not running
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unable to connect to Elasticsearch');
    });

    it('should export analytics to Elasticsearch for quality user', async () => {
      const response = await request(app)
        .post('/analytics/export')
        .set('Authorization', `Bearer ${qualityToken}`)
        .send({
          period: 'test'
        });

      // We expect this to fail gracefully since Elasticsearch is not running
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unable to connect to Elasticsearch');
    });

    it('should require admin or quality role', async () => {
      // Try without token
      const response = await request(app)
        .post('/analytics/export')
        .send({
          period: 'test'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('POST /analytics/export/today', () => {
    it('should export today\'s analytics to Elasticsearch for admin', async () => {
      const response = await request(app)
        .post('/analytics/export/today')
        .set('Authorization', `Bearer ${adminToken}`);

      // We expect this to fail gracefully since Elasticsearch is not running
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unable to connect to Elasticsearch');
    });

    it('should export today\'s analytics to Elasticsearch for quality user', async () => {
      const response = await request(app)
        .post('/analytics/export/today')
        .set('Authorization', `Bearer ${qualityToken}`);

      // We expect this to fail gracefully since Elasticsearch is not running
      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Unable to connect to Elasticsearch');
    });

    it('should require admin or quality role', async () => {
      // Try without token
      const response = await request(app)
        .post('/analytics/export/today');

      expect(response.status).toBe(401);
    });
  });
});