# RocketChat Import/Export Documentation

This document explains how to export conversations from RocketChat and import them into the patient care system.

## Overview

The system provides two main approaches for importing RocketChat conversations:

1. **Direct Import** - Connect directly to RocketChat through the admin interface
2. **File-based Import** - Export from RocketChat using CLI tools, then import the JSON file

## Prerequisites

- Administrator access to both RocketChat and the patient care system
- Network access to the RocketChat server (for direct import)
- RocketChat user account with sufficient permissions to access direct messages

## Option 1: Direct Import (Recommended)

### Steps:

1. **Access Admin Dashboard**
   - Log in to the patient care system as an administrator
   - Navigate to the Administration Dashboard

2. **Start Import Process**
   - Click the "Import Conversations" button in the command bar
   - Select the "Direct Import" tab

3. **Configure RocketChat Connection**
   - **RocketChat Server URL**: Enter your RocketChat server URL (e.g., `https://your-rocketchat-server.com`)
   - **Username**: Your RocketChat username (must have access to direct messages)
   - **Password**: Your RocketChat password

4. **Import Options**
   - **Import Conversations**: Directly imports all 1:1 conversations into the system
   - **Export Only**: Downloads the conversations as a JSON file without importing

5. **Review Results**
   - The system will show import statistics
   - Review any errors or warnings
   - Check created/skipped users

## Option 2: File-based Import

### Step 1: Export from RocketChat using CLI

```bash
cd Server
node rocketchat-export-cli.js --server https://your-rocketchat-server.com --username admin --password yourpassword --output export.json
```

**CLI Options:**
- `--server`: RocketChat server URL
- `--username`: RocketChat username with admin privileges
- `--password`: RocketChat password  
- `--output`: Output file path (optional, defaults to `rocketchat_export_YYYY-MM-DD.json`)

**Example:**
```bash
node rocketchat-export-cli.js --server https://rocket.example.com --username admin --password secret --output my_export.json
```

### Step 2: Import JSON file through Admin Interface

1. **Access Admin Dashboard**
   - Log in as administrator
   - Click "Import Conversations" button

2. **Select File Import**
   - Choose the "File Import" tab
   - Select your exported JSON file
   - Click "Import File"

## What Gets Imported

### Conversations
- **1:1 conversations only** (direct messages between two users)
- Conversation title and metadata
- Creation timestamp
- Participant information

### Users
- **Automatic user creation** for participants not already in the system
- **Role assignment** based on username patterns or RocketChat roles:
  - Users with "admin" role → Admin
  - Users with "doctor" in username/role → Doctor  
  - All others → Patient
- **Temporary passwords** generated for new users (users must reset)

### Messages
- Message content and timestamps
- Sender information
- **Note**: Messages are stored as metadata for reference but not imported into Azure Communication Services

### Import Metadata
- Source system information (RocketChat)
- Original conversation/room IDs
- Import timestamp and administrator who performed the import
- Original message counts

## Role Mapping

The system automatically maps RocketChat users to system roles:

| RocketChat Role/Username | System Role |
|-------------------------|-------------|
| Admin role              | Admin       |
| Contains "doctor"/"dr"  | Doctor      |
| Default                 | Patient     |

You can modify role assignments after import through user management.

## Troubleshooting

### Common Issues

**Authentication Failed**
- Verify RocketChat credentials
- Ensure user has sufficient permissions
- Check server URL format (include `https://`)

**No Conversations Found**
- Verify the user has access to direct messages
- Check if there are actually 1:1 conversations in RocketChat
- Ensure conversations contain messages

**Import Errors**
- Check the JSON file format if using file import
- Verify network connectivity for direct import
- Review error messages in the import results

**User Creation Issues**
- Duplicate email addresses will be skipped
- Invalid email formats cause user creation to fail
- Check import results for detailed user creation status

### File Size Limits

- **Import files**: Maximum 50MB
- **Large exports**: Use CLI tool to break exports into smaller batches if needed

## Security Considerations

- **Administrator access required** for all import operations
- **Temporary passwords** are generated for new users - inform them to reset immediately
- **Import logs** track who imported what and when
- **Network security** - ensure RocketChat server is accessible securely

## Support

For issues with the import process:

1. Check the import results for detailed error messages
2. Review the server logs for technical details
3. Verify RocketChat server accessibility and permissions
4. Contact your system administrator for assistance

## API Endpoints

For programmatic access:

- `POST /import/rocketchat/export` - Export from RocketChat (admin only)
- `POST /import/conversations` - Import from JSON file (admin only) 
- `POST /import/conversations/direct` - Direct import from RocketChat (admin only)

All endpoints require administrator authentication via Bearer token.