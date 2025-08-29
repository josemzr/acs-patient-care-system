// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import express from 'express';
import { DatabaseService } from '../lib/database';
import { AuthRequest, authenticateToken, requireAdminOrQuality } from '../lib/auth';
import { ElasticsearchService } from '../lib/elasticsearch';

const router = express.Router();

/**
 * route: /analytics
 * purpose: Get analytics data for administrators and quality users
 */
router.get('/', authenticateToken, requireAdminOrQuality, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, period } = req.query;

    let analytics;
    
    if (period === 'today') {
      analytics = await DatabaseService.getCurrentDayAnalytics();
    } else {
      analytics = await DatabaseService.getAnalytics(
        startDate as string, 
        endDate as string
      );
    }

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics data'
    });
  }
});

/**
 * route: /analytics/summary
 * purpose: Get high-level summary analytics
 */
router.get('/summary', authenticateToken, requireAdminOrQuality, async (req: AuthRequest, res) => {
  try {
    const [generalAnalytics, todayAnalytics] = await Promise.all([
      DatabaseService.getAnalytics(),
      DatabaseService.getCurrentDayAnalytics()
    ]);

    res.json({
      success: true,
      data: {
        general: generalAnalytics,
        today: todayAnalytics
      }
    });
  } catch (error) {
    console.error('Error fetching analytics summary:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics summary'
    });
  }
});

/**
 * route: /analytics/export
 * purpose: Export analytics data to Elasticsearch
 */
router.post('/export', authenticateToken, requireAdminOrQuality, async (req: AuthRequest, res) => {
  try {
    const { startDate, endDate, period } = req.body;

    const result = await ElasticsearchService.exportAnalytics(
      startDate,
      endDate,
      period || 'manual'
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error exporting analytics to Elasticsearch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export analytics data to Elasticsearch'
    });
  }
});

/**
 * route: /analytics/export/today
 * purpose: Export today's analytics data to Elasticsearch
 */
router.post('/export/today', authenticateToken, requireAdminOrQuality, async (req: AuthRequest, res) => {
  try {
    const result = await ElasticsearchService.exportTodayAnalytics();

    if (result.success) {
      res.json(result);
    } else {
      res.status(500).json(result);
    }
  } catch (error) {
    console.error('Error exporting today\'s analytics to Elasticsearch:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export today\'s analytics data to Elasticsearch'
    });
  }
});

export default router;