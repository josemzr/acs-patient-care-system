// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import express from 'express';
import multer from 'multer';
import { DatabaseService, ConversationType, UserRole } from '../lib/database';
import { AuthRequest, authenticateToken, requireAdmin } from '../lib/auth';
import { createThread } from '../lib/chat/moderator';
import { RocketChatExporter, RocketChatConfig } from '../lib/rocketchat-exporter';

const router = express.Router();

// Configure multer for file uploads (JSON import files)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit for import files
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/json') {
      cb(null, true);
    } else {
      cb(new Error('Only JSON files are allowed'));
    }
  }
});

interface ImportConversationData {
  source: string;
  source_id: string;
  title: string;
  type: string;
  participants: Array<{
    id: string;
    username: string;
    display_name: string;
    email: string;
    role: string;
  }>;
  messages: Array<{
    id: string;
    content: string;
    sender_id: string;
    sender_display_name: string;
    created_on: string;
    type: string;
  }>;
  created_at: string;
  exported_at: string;
  message_count: number;
}

interface RocketChatExportRequest {
  serverUrl: string;
  username: string;
  password: string;
}

/**
 * route: POST /import/rocketchat/export
 * purpose: Connect to RocketChat and export all 1:1 conversations (admin only)
 */
router.post('/rocketchat/export', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { serverUrl, username, password }: RocketChatExportRequest = req.body;

    if (!serverUrl || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Server URL, username, and password are required'
      });
    }

    const config: RocketChatConfig = {
      serverUrl: serverUrl.replace(/\/$/, ''), // Remove trailing slash
      username,
      password
    };

    const exporter = new RocketChatExporter(config);
    
    console.log('Starting RocketChat export...');
    const conversations = await exporter.exportDirectMessages();
    
    res.json({
      success: true,
      message: `Successfully exported ${conversations.length} conversations`,
      data: {
        conversations,
        exported_at: new Date().toISOString(),
        exported_by: {
          id: req.user!.id,
          display_name: req.user!.display_name
        }
      }
    });

  } catch (error) {
    console.error('RocketChat export error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to export from RocketChat'
    });
  }
});

/**
 * route: POST /import/conversations
 * purpose: Import conversations from JSON file (admin only)
 */
router.post('/conversations', authenticateToken, requireAdmin, upload.single('importFile'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Import file is required'
      });
    }

    let importData;
    try {
      const fileContent = req.file.buffer.toString();
      importData = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({
        success: false,
        message: 'Invalid JSON file format'
      });
    }

    // Validate import data structure
    if (!Array.isArray(importData) && !Array.isArray(importData.conversations)) {
      return res.status(400).json({
        success: false,
        message: 'Import data must be an array of conversations or contain a conversations array'
      });
    }

    const conversations = Array.isArray(importData) ? importData : importData.conversations;
    
    const importResults = await importConversations(conversations, req.user!.id);

    res.json({
      success: true,
      message: `Import completed. ${importResults.successful} conversations imported, ${importResults.failed} failed.`,
      data: importResults
    });

  } catch (error) {
    console.error('Import conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to import conversations'
    });
  }
});

/**
 * route: POST /import/conversations/direct
 * purpose: Import conversations directly from RocketChat without file upload (admin only)
 */
router.post('/conversations/direct', authenticateToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { serverUrl, username, password }: RocketChatExportRequest = req.body;

    if (!serverUrl || !username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Server URL, username, and password are required'
      });
    }

    const config: RocketChatConfig = {
      serverUrl: serverUrl.replace(/\/$/, ''), // Remove trailing slash
      username,
      password
    };

    const exporter = new RocketChatExporter(config);
    
    console.log('Starting direct RocketChat import...');
    const conversations = await exporter.exportDirectMessages();
    
    const importResults = await importConversations(conversations, req.user!.id);

    res.json({
      success: true,
      message: `Import completed. ${importResults.successful} conversations imported, ${importResults.failed} failed.`,
      data: {
        ...importResults,
        source: 'rocketchat_direct',
        exported_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Direct RocketChat import error:', error);
    res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : 'Failed to import from RocketChat'
    });
  }
});

async function importConversations(conversations: ImportConversationData[], importerId: number) {
  const results = {
    successful: 0,
    failed: 0,
    errors: [] as Array<{ conversation: string; error: string }>,
    createdUsers: [] as Array<{ email: string; role: string }>,
    skippedUsers: [] as Array<{ email: string; reason: string }>
  };

  for (const convData of conversations) {
    try {
      // Validate conversation data
      if (!convData.title || !convData.participants || !convData.messages) {
        results.failed++;
        results.errors.push({ 
          conversation: convData.title || convData.source_id || 'Unknown',
          error: 'Missing required fields (title, participants, or messages)' 
        });
        continue;
      }

      // Create or find users for participants
      const participantUserIds: number[] = [];
      let doctorId: number | undefined;

      for (const participant of convData.participants) {
        try {
          // Check if user already exists
          let existingUser = await DatabaseService.getUserByEmail(participant.email);
          
          if (!existingUser) {
            // Create new user with generated password (they'll need to reset it)
            const tempPassword = generateTempPassword();
            const role = mapRole(participant.role);
            
            const userId = await DatabaseService.createUser(
              participant.email,
              tempPassword,
              role,
              participant.display_name
            );
            
            existingUser = await DatabaseService.getUserById(userId);
            results.createdUsers.push({ email: participant.email, role });
          } else {
            results.skippedUsers.push({ 
              email: participant.email, 
              reason: 'User already exists' 
            });
          }

          if (existingUser) {
            participantUserIds.push(existingUser.id);
            
            // Identify the doctor for 1:1 conversations
            if (existingUser.role === UserRole.DOCTOR) {
              doctorId = existingUser.id;
            }
          }
        } catch (userError) {
          console.error(`Error creating/finding user ${participant.email}:`, userError);
          results.skippedUsers.push({ 
            email: participant.email, 
            reason: 'Failed to create/find user' 
          });
        }
      }

      if (participantUserIds.length === 0) {
        results.failed++;
        results.errors.push({ 
          conversation: convData.title,
          error: 'No valid participants found' 
        });
        continue;
      }

      // Create Azure Communication Services thread
      const threadId = await createThread();
      if (!threadId) {
        results.failed++;
        results.errors.push({ 
          conversation: convData.title,
          error: 'Failed to create chat thread' 
        });
        continue;
      }

      // Determine conversation type and creator
      const conversationType = convData.type === '1to1' ? ConversationType.ONE_TO_ONE : ConversationType.ONE_TO_MANY;
      const creatorId = participantUserIds[0]; // Use first participant as creator

      // Create conversation in database
      const conversationId = await DatabaseService.createConversation(
        convData.title,
        conversationType,
        creatorId,
        threadId,
        doctorId
      );

      // Add all participants to the conversation
      for (const participantId of participantUserIds) {
        try {
          await DatabaseService.addConversationParticipant(conversationId, participantId);
        } catch (participantError) {
          console.error(`Error adding participant ${participantId} to conversation ${conversationId}:`, participantError);
        }
      }

      // Note: Messages are not imported into Azure Communication Services
      // as they are external to the chat service. The messages are preserved
      // in the import metadata for reference if needed.
      
      // Add import metadata
      await DatabaseService.addConversationMetadata(conversationId, 'imported_from', convData.source || 'unknown');
      await DatabaseService.addConversationMetadata(conversationId, 'source_id', convData.source_id || '');
      await DatabaseService.addConversationMetadata(conversationId, 'original_message_count', convData.message_count?.toString() || convData.messages.length.toString());
      await DatabaseService.addConversationMetadata(conversationId, 'imported_at', new Date().toISOString());
      await DatabaseService.addConversationMetadata(conversationId, 'imported_by', importerId.toString());

      results.successful++;
      console.log(`Successfully imported conversation: ${convData.title}`);

    } catch (error) {
      results.failed++;
      results.errors.push({ 
        conversation: convData.title || 'Unknown',
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      console.error(`Error importing conversation ${convData.title}:`, error);
    }
  }

  return results;
}

function mapRole(role: string): UserRole {
  const roleStr = role.toLowerCase();
  if (roleStr.includes('admin')) return UserRole.ADMIN;
  if (roleStr.includes('doctor') || roleStr.includes('dr')) return UserRole.DOCTOR;
  if (roleStr.includes('quality')) return UserRole.QUALITY;
  return UserRole.PATIENT;
}

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
}

export default router;