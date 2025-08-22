// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { Client } from '@elastic/elasticsearch';
import { DatabaseService } from './database';

// Elasticsearch configuration from environment variables
const ELASTICSEARCH_NODE = process.env.ELASTICSEARCH_NODE || 'http://localhost:9200';
const ELASTICSEARCH_USERNAME = process.env.ELASTICSEARCH_USERNAME;
const ELASTICSEARCH_PASSWORD = process.env.ELASTICSEARCH_PASSWORD;
const ELASTICSEARCH_INDEX = process.env.ELASTICSEARCH_INDEX || 'acs-chat-analytics';

export class ElasticsearchService {
  private static client: Client | null = null;

  static getClient(): Client {
    if (!this.client) {
      const config: any = {
        node: ELASTICSEARCH_NODE
      };

      if (ELASTICSEARCH_USERNAME && ELASTICSEARCH_PASSWORD) {
        config.auth = {
          username: ELASTICSEARCH_USERNAME,
          password: ELASTICSEARCH_PASSWORD
        };
      }

      // Add timeout configuration for faster failures in testing
      config.requestTimeout = 2000;
      config.pingTimeout = 1000;

      this.client = new Client(config);
    }

    return this.client;
  }

  /**
   * Test connection to Elasticsearch
   */
  static async testConnection(): Promise<boolean> {
    try {
      const client = this.getClient();
      await client.ping();
      return true;
    } catch (error) {
      console.error('Elasticsearch connection test failed:', error);
      return false;
    }
  }

  /**
   * Create index with mapping for analytics data
   */
  static async createIndexIfNotExists(): Promise<void> {
    try {
      const client = this.getClient();
      
      const exists = await client.indices.exists({
        index: ELASTICSEARCH_INDEX
      });

      if (!exists) {
        await client.indices.create({
          index: ELASTICSEARCH_INDEX,
          mappings: {
            properties: {
              timestamp: { type: 'date' },
              period: { type: 'keyword' },
              totalConversations: { type: 'long' },
              openConversations: { type: 'long' },
              onHoldConversations: { type: 'long' },
              totalVisitors: { type: 'long' },
              avgConversationsPerDay: { type: 'double' },
              busiestDay: {
                properties: {
                  date: { type: 'date' },
                  count: { type: 'long' }
                }
              },
              busiestTime: {
                properties: {
                  hour: { type: 'keyword' },
                  count: { type: 'long' }
                }
              },
              conversationsPerDay: {
                type: 'nested',
                properties: {
                  date: { type: 'date' },
                  count: { type: 'long' }
                }
              },
              conversationsByHour: {
                type: 'nested',
                properties: {
                  hour: { type: 'keyword' },
                  count: { type: 'long' }
                }
              },
              conversationsByStatus: {
                type: 'nested',
                properties: {
                  status: { type: 'keyword' },
                  count: { type: 'long' }
                }
              }
            }
          }
        });
        console.log(`Created Elasticsearch index: ${ELASTICSEARCH_INDEX}`);
      }
    } catch (error) {
      console.error('Failed to create Elasticsearch index:', error);
      throw error;
    }
  }

  /**
   * Export analytics data to Elasticsearch
   */
  static async exportAnalytics(
    startDate?: string,
    endDate?: string,
    period: string = 'summary'
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Test connection first
      const connected = await this.testConnection();
      if (!connected) {
        return {
          success: false,
          message: 'Unable to connect to Elasticsearch'
        };
      }

      // Ensure index exists
      await this.createIndexIfNotExists();

      // Get analytics data
      const analyticsData = await DatabaseService.getAnalytics(startDate, endDate);
      
      // Prepare document for Elasticsearch
      const document = {
        timestamp: new Date().toISOString(),
        period: period,
        startDate: startDate || null,
        endDate: endDate || null,
        ...analyticsData
      };

      // Index the document
      const client = this.getClient();
      await client.index({
        index: ELASTICSEARCH_INDEX,
        document: document
      });

      return {
        success: true,
        message: 'Analytics data exported to Elasticsearch successfully'
      };
    } catch (error) {
      console.error('Failed to export analytics to Elasticsearch:', error);
      return {
        success: false,
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Export today's analytics data to Elasticsearch
   */
  static async exportTodayAnalytics(): Promise<{ success: boolean; message: string }> {
    try {
      const connected = await this.testConnection();
      if (!connected) {
        return {
          success: false,
          message: 'Unable to connect to Elasticsearch'
        };
      }

      await this.createIndexIfNotExists();

      const analyticsData = await DatabaseService.getCurrentDayAnalytics();
      
      const document = {
        timestamp: new Date().toISOString(),
        period: 'today',
        date: new Date().toISOString().split('T')[0],
        ...analyticsData
      };

      const client = this.getClient();
      await client.index({
        index: ELASTICSEARCH_INDEX,
        document: document
      });

      return {
        success: true,
        message: 'Today\'s analytics data exported to Elasticsearch successfully'
      };
    } catch (error) {
      console.error('Failed to export today\'s analytics to Elasticsearch:', error);
      return {
        success: false,
        message: `Export failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}