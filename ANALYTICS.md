# Analytics and Quality User Features

## Overview

This system now supports:

1. **Quality User Role**: A specialized role for quality assurance personnel that has access only to analytics and reporting (no access to conversations)
2. **Elasticsearch Export**: Export analytics data to Elasticsearch for advanced analysis in Kibana

## User Roles

### Available Roles
- `PATIENT`: End users who create conversations
- `DOCTOR`: Medical professionals who respond to conversations  
- `ADMIN`: Full system administrators
- `QUALITY`: Quality assurance personnel with access only to analytics/reporting

### Default Users
The system creates these default users automatically:
- `admin@example.com / admin123` (ADMIN role)
- `quality@example.com / quality123` (QUALITY role)

## Analytics API Endpoints

### Existing Endpoints (now accessible by ADMIN and QUALITY roles)
- `GET /analytics/summary` - Get comprehensive analytics summary
- `GET /analytics?period=today` - Get today's analytics
- `GET /analytics?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD` - Get analytics for date range

### New Elasticsearch Export Endpoints
- `POST /analytics/export` - Export analytics data to Elasticsearch
  - Body: `{ "startDate": "YYYY-MM-DD", "endDate": "YYYY-MM-DD", "period": "custom" }`
  - Response: `{ "success": boolean, "message": string }`

- `POST /analytics/export/today` - Export today's analytics to Elasticsearch
  - No body required
  - Response: `{ "success": boolean, "message": string }`

## Elasticsearch Configuration

Set these environment variables to configure Elasticsearch connection:

```bash
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic          # Optional
ELASTICSEARCH_PASSWORD=changeme         # Optional  
ELASTICSEARCH_INDEX=acs-chat-analytics  # Optional, defaults to acs-chat-analytics
```

## Frontend Changes

The Analytics dashboard now includes an "Export to Elasticsearch" button that allows users to:
- Export current analytics view to Elasticsearch
- See export status messages
- Works with all time periods (summary, today, custom range)

## Data Structure in Elasticsearch

Analytics data is stored with this structure:
```json
{
  "timestamp": "2024-01-01T10:00:00.000Z",
  "period": "summary|today|custom",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31", 
  "totalConversations": 150,
  "openConversations": 5,
  "onHoldConversations": 2,
  "totalVisitors": 75,
  "avgConversationsPerDay": 12.5,
  "busiestDay": { "date": "2024-01-15", "count": 25 },
  "busiestTime": { "hour": "14", "count": 8 },
  "conversationsPerDay": [
    { "date": "2024-01-01", "count": 10 },
    { "date": "2024-01-02", "count": 15 }
  ],
  "conversationsByHour": [
    { "hour": "09", "count": 5 },
    { "hour": "10", "count": 8 }
  ],
  "conversationsByStatus": [
    { "status": "active", "count": 5 },
    { "status": "archived", "count": 145 }
  ]
}
```

## Security Considerations

- Quality users can only access analytics endpoints
- Quality users cannot access conversation data or user management
- All analytics exports are logged for audit purposes
- Elasticsearch connection failures are handled gracefully

## Usage Examples

### Creating a Quality User
```javascript
const response = await fetch('/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'qa@company.com',
    password: 'secure-password',
    role: 'quality',
    display_name: 'QA Team Lead'
  })
});
```

### Exporting Analytics to Elasticsearch
```javascript
// Export today's data
const response = await fetch('/analytics/export/today', {
  method: 'POST',
  headers: { 'Authorization': 'Bearer ' + token }
});

// Export custom date range
const response = await fetch('/analytics/export', {
  method: 'POST',
  headers: { 
    'Authorization': 'Bearer ' + token,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    startDate: '2024-01-01',
    endDate: '2024-01-31',
    period: 'january-2024'
  })
});
```