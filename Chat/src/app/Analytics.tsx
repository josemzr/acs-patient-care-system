// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import React, { useState, useEffect } from 'react';
import {
  Stack,
  Text,
  MessageBar,
  MessageBarType,
  Dropdown,
  IDropdownOption,
  DatePicker,
  PrimaryButton,
  Spinner,
  SpinnerSize,
  StackItem,
  DefaultPalette,
  mergeStyles
} from '@fluentui/react';
import { analyticsAPI, AnalyticsData, TodayAnalyticsData, AnalyticsSummary } from './utils/patientCareAPI';

interface AnalyticsProps {
  isVisible: boolean;
}

const cardStyle = mergeStyles({
  padding: '20px',
  margin: '10px',
  backgroundColor: DefaultPalette.white,
  border: `1px solid ${DefaultPalette.neutralLight}`,
  borderRadius: '4px',
  boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
});

const metricStyle = mergeStyles({
  fontSize: '32px',
  fontWeight: 'bold',
  color: DefaultPalette.themePrimary
});

const labelStyle = mergeStyles({
  fontSize: '14px',
  color: DefaultPalette.neutralSecondary,
  fontWeight: '600'
});

const chartStyle = mergeStyles({
  height: '200px',
  display: 'flex',
  alignItems: 'end',
  justifyContent: 'space-around',
  padding: '10px',
  border: `1px solid ${DefaultPalette.neutralLight}`,
  borderRadius: '4px',
  backgroundColor: DefaultPalette.neutralLighterAlt
});

const barStyle = (height: number, maxHeight: number) => mergeStyles({
  width: '20px',
  height: `${(height / maxHeight) * 150}px`,
  backgroundColor: DefaultPalette.themePrimary,
  borderRadius: '2px 2px 0 0',
  margin: '0 2px'
});

export const Analytics: React.FC<AnalyticsProps> = ({ isVisible }) => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsSummary | null>(null);
  const [customAnalytics, setCustomAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedPeriod, setSelectedPeriod] = useState<string>('summary');
  const [startDate, setStartDate] = useState<Date | undefined>();
  const [endDate, setEndDate] = useState<Date | undefined>();
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string>('');

  const periodOptions: IDropdownOption[] = [
    { key: 'summary', text: 'Summary (All Time + Today)' },
    { key: 'today', text: 'Today Only' },
    { key: 'custom', text: 'Custom Date Range' }
  ];

  const loadAnalytics = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      if (selectedPeriod === 'summary') {
        const response = await analyticsAPI.getAnalyticsSummary();
        if (response.success && response.data) {
          setAnalyticsData(response.data);
          setCustomAnalytics(null);
        } else {
          setError(response.message || 'Failed to load analytics');
        }
      } else if (selectedPeriod === 'today') {
        const response = await analyticsAPI.getAnalytics(undefined, undefined, 'today');
        if (response.success && response.data) {
          setCustomAnalytics(null);
          setAnalyticsData({
            general: {} as AnalyticsData,
            today: response.data as TodayAnalyticsData
          });
        } else {
          setError(response.message || 'Failed to load today analytics');
        }
      } else if (selectedPeriod === 'custom' && startDate && endDate) {
        const response = await analyticsAPI.getAnalytics(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0]
        );
        if (response.success && response.data) {
          setCustomAnalytics(response.data as AnalyticsData);
          setAnalyticsData(null);
        } else {
          setError(response.message || 'Failed to load custom analytics');
        }
      }
    } catch (err) {
      setError('An error occurred while loading analytics');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isVisible && selectedPeriod === 'summary') {
      loadAnalytics();
    }
  }, [isVisible]);

  const exportToElasticsearch = async () => {
    setIsExporting(true);
    setExportMessage('');
    
    try {
      let response;
      if (selectedPeriod === 'today') {
        response = await analyticsAPI.exportTodayAnalytics();
      } else if (selectedPeriod === 'custom' && startDate && endDate) {
        response = await analyticsAPI.exportAnalytics(
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0],
          'custom'
        );
      } else {
        response = await analyticsAPI.exportAnalytics(undefined, undefined, selectedPeriod);
      }
      
      setExportMessage(response.message);
    } catch (err) {
      setExportMessage('An error occurred while exporting to Elasticsearch');
    } finally {
      setIsExporting(false);
    }
  };

  const MetricCard: React.FC<{ title: string; value: number | string; subtitle?: string }> = ({ title, value, subtitle }) => (
    <div className={cardStyle}>
      <Stack>
        <Text className={labelStyle}>{title}</Text>
        <Text className={metricStyle}>{value}</Text>
        {subtitle && <Text variant="small">{subtitle}</Text>}
      </Stack>
    </div>
  );

  const HourlyChart: React.FC<{ data: Array<{ hour: string; count: number }> }> = ({ data }) => {
    const maxCount = Math.max(...data.map(d => d.count), 1);
    
    return (
      <Stack>
        <Text variant="mediumPlus" style={{ marginBottom: '10px' }}>Conversations by Hour</Text>
        <div className={chartStyle}>
          {data.map(item => (
            <Stack key={item.hour} horizontalAlign="center">
              <div className={barStyle(item.count, maxCount)} title={`${item.hour}:00 - ${item.count} conversations`} />
              <Text variant="small">{item.hour}</Text>
            </Stack>
          ))}
        </div>
      </Stack>
    );
  };

  if (!isVisible) return null;

  return (
    <Stack tokens={{ childrenGap: 20 }}>
      <Text variant="xxLarge" style={{ fontWeight: 'bold' }}>Analytics Dashboard</Text>
      
      {error && (
        <MessageBar messageBarType={MessageBarType.error}>
          {error}
        </MessageBar>
      )}

      <Stack horizontal tokens={{ childrenGap: 20 }} style={{ alignItems: 'end' }}>
        <StackItem>
          <Dropdown
            label="Time Period"
            options={periodOptions}
            selectedKey={selectedPeriod}
            onChange={(_, option) => setSelectedPeriod(option?.key as string)}
            style={{ minWidth: '200px' }}
          />
        </StackItem>
        
        {selectedPeriod === 'custom' && (
          <>
            <StackItem>
              <DatePicker
                label="Start Date"
                value={startDate}
                onSelectDate={(date) => setStartDate(date || undefined)}
              />
            </StackItem>
            <StackItem>
              <DatePicker
                label="End Date"
                value={endDate}
                onSelectDate={(date) => setEndDate(date || undefined)}
              />
            </StackItem>
          </>
        )}
        
        <StackItem>
          <PrimaryButton 
            text="Load Analytics" 
            onClick={loadAnalytics}
            disabled={isLoading || (selectedPeriod === 'custom' && (!startDate || !endDate))}
          />
        </StackItem>

        <StackItem>
          <PrimaryButton 
            text="Export to Elasticsearch" 
            onClick={exportToElasticsearch}
            disabled={isExporting || isLoading || (selectedPeriod === 'custom' && (!startDate || !endDate))}
            style={{ marginLeft: '10px' }}
          />
        </StackItem>
      </Stack>

      {exportMessage && (
        <MessageBar messageBarType={exportMessage.includes('success') ? MessageBarType.success : MessageBarType.warning}>
          {exportMessage}
        </MessageBar>
      )}

      {isExporting && (
        <Stack horizontalAlign="center" style={{ padding: '20px' }}>
          <Spinner size={SpinnerSize.medium} label="Exporting to Elasticsearch..." />
        </Stack>
      )}

      {isLoading && (
        <Stack horizontalAlign="center" style={{ padding: '40px' }}>
          <Spinner size={SpinnerSize.large} label="Loading analytics..." />
        </Stack>
      )}

      {/* Summary View */}
      {analyticsData && selectedPeriod === 'summary' && (
        <Stack tokens={{ childrenGap: 30 }}>
          <Stack>
            <Text variant="xLarge" style={{ marginBottom: '20px', fontWeight: '600' }}>Overall Statistics</Text>
            <Stack horizontal wrap tokens={{ childrenGap: 10 }}>
              <MetricCard title="Total Conversations" value={analyticsData.general.totalConversations} />
              <MetricCard title="Open Conversations" value={analyticsData.general.openConversations} />
              <MetricCard title="On Hold Conversations" value={analyticsData.general.onHoldConversations} />
              <MetricCard title="Total Visitors" value={analyticsData.general.totalVisitors} />
              <MetricCard 
                title="Avg Conversations/Day" 
                value={analyticsData.general.avgConversationsPerDay}
                subtitle={`Busiest: ${analyticsData.general.busiestDay?.date || 'N/A'} (${analyticsData.general.busiestDay?.count || 0})`}
              />
              <MetricCard 
                title="Busiest Time" 
                value={`${analyticsData.general.busiestTime?.hour || 'N/A'}:00`}
                subtitle={`${analyticsData.general.busiestTime?.count || 0} conversations`}
              />
            </Stack>
          </Stack>

          <Stack>
            <Text variant="xLarge" style={{ marginBottom: '20px', fontWeight: '600' }}>Today's Performance</Text>
            <Stack horizontal wrap tokens={{ childrenGap: 10 }}>
              <MetricCard title="Today's Conversations" value={analyticsData.today.todayConversations} />
              <MetricCard title="New Users Today" value={analyticsData.today.todayNewUsers} />
              <MetricCard title="Active Conversations" value={analyticsData.today.currentActiveConversations} />
              <MetricCard 
                title="Avg Duration" 
                value={`${analyticsData.today.avgConversationDurationHours.toFixed(1)}h`}
              />
              <MetricCard 
                title="Avg Response Time" 
                value={`${analyticsData.today.avgResponseTimeMinutes.toFixed(1)} min`}
              />
            </Stack>
            
            {analyticsData.today.todayConversationsByHour.length > 0 && (
              <HourlyChart data={analyticsData.today.todayConversationsByHour} />
            )}
          </Stack>
        </Stack>
      )}

      {/* Today Only View */}
      {analyticsData && selectedPeriod === 'today' && (
        <Stack tokens={{ childrenGap: 20 }}>
          <Text variant="xLarge" style={{ marginBottom: '20px', fontWeight: '600' }}>Today's Performance</Text>
          <Stack horizontal wrap tokens={{ childrenGap: 10 }}>
            <MetricCard title="Today's Conversations" value={analyticsData.today.todayConversations} />
            <MetricCard title="New Users Today" value={analyticsData.today.todayNewUsers} />
            <MetricCard title="Active Conversations" value={analyticsData.today.currentActiveConversations} />
            <MetricCard 
              title="Avg Duration" 
              value={`${analyticsData.today.avgConversationDurationHours.toFixed(1)}h`}
            />
            <MetricCard 
              title="Avg Response Time" 
              value={`${analyticsData.today.avgResponseTimeMinutes.toFixed(1)} min`}
            />
          </Stack>
          
          {analyticsData.today.todayConversationsByHour.length > 0 && (
            <HourlyChart data={analyticsData.today.todayConversationsByHour} />
          )}
        </Stack>
      )}

      {/* Custom Date Range View */}
      {customAnalytics && selectedPeriod === 'custom' && (
        <Stack tokens={{ childrenGap: 20 }}>
          <Text variant="xLarge" style={{ marginBottom: '20px', fontWeight: '600' }}>
            Custom Period: {startDate?.toLocaleDateString()} - {endDate?.toLocaleDateString()}
          </Text>
          <Stack horizontal wrap tokens={{ childrenGap: 10 }}>
            <MetricCard title="Total Conversations" value={customAnalytics.totalConversations} />
            <MetricCard title="Open Conversations" value={customAnalytics.openConversations} />
            <MetricCard title="On Hold Conversations" value={customAnalytics.onHoldConversations} />
            <MetricCard title="Total Visitors" value={customAnalytics.totalVisitors} />
            <MetricCard 
              title="Avg Conversations/Day" 
              value={customAnalytics.avgConversationsPerDay}
            />
            <MetricCard 
              title="Busiest Time" 
              value={`${customAnalytics.busiestTime?.hour || 'N/A'}:00`}
              subtitle={`${customAnalytics.busiestTime?.count || 0} conversations`}
            />
          </Stack>
          
          {customAnalytics.conversationsByHour.length > 0 && (
            <HourlyChart data={customAnalytics.conversationsByHour} />
          )}
        </Stack>
      )}
    </Stack>
  );
};