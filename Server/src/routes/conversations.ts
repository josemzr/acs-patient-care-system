// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import express from 'express';
import { DatabaseService, ConversationType, ConversationStatus, UserRole } from '../lib/database';
import { AuthRequest, authenticateToken, requirePatient, requireDoctorOrAdmin, requireAnyRole } from '../lib/auth';
import { createThread, getThreadMessages } from '../lib/chat/moderator';

const router = express.Router();

interface CreateConversationRequest {
  title: string;
  type: ConversationType;
  assigned_doctor_id?: number;
}

interface UpdateConversationRequest {
  status?: ConversationStatus;
}

/**
 * route: /conversations
 * purpose: Get conversations for the authenticated user
 */
router.get('/', authenticateToken, requireAnyRole, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    let conversations;

    if (user.role === UserRole.PATIENT) {
      // Patients see only their own conversations
      conversations = await DatabaseService.getConversationsByUserId(user.id);
    } else if (user.role === UserRole.DOCTOR) {
      // Doctors see conversations assigned to them or open to any doctor
      conversations = await DatabaseService.getConversationsForDoctor(user.id);
    } else if (user.role === UserRole.ADMIN) {
      // Admins see all conversations
      conversations = await DatabaseService.getAllConversations();
    }

    // Get additional information for each conversation
    const conversationsWithDetails = await Promise.all(
      conversations!.map(async (conv) => {
        const participants = await DatabaseService.getConversationParticipants(conv.id);
        const creator = await DatabaseService.getUserById(conv.creator_id);
        const assignedDoctor = conv.assigned_doctor_id
          ? await DatabaseService.getUserById(conv.assigned_doctor_id)
          : null;

        return {
          ...conv,
          creator: creator ? { id: creator.id, display_name: creator.display_name, email: creator.email } : null,
          assigned_doctor: assignedDoctor ? { id: assignedDoctor.id, display_name: assignedDoctor.display_name } : null,
          participants: participants.map((p) => ({ id: p.id, display_name: p.display_name, role: p.role }))
        };
      })
    );

    res.json({
      success: true,
      conversations: conversationsWithDetails
    });
  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversations'
    });
  }
});

/**
 * route: /conversations
 * purpose: Create a new conversation (patients only)
 */
router.post('/', authenticateToken, requirePatient, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const { title, type, assigned_doctor_id }: CreateConversationRequest = req.body;

    if (!title || !type) {
      return res.status(400).json({
        success: false,
        message: 'Title and type are required'
      });
    }

    // Validate conversation type
    if (!Object.values(ConversationType).includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation type'
      });
    }

    // If it's a 1:1 conversation, validate that assigned_doctor_id is provided and is a doctor
    if (type === ConversationType.ONE_TO_ONE) {
      if (!assigned_doctor_id) {
        return res.status(400).json({
          success: false,
          message: 'Doctor assignment required for 1:1 conversations'
        });
      }

      const doctor = await DatabaseService.getUserById(assigned_doctor_id);
      if (!doctor || doctor.role !== UserRole.DOCTOR) {
        return res.status(400).json({
          success: false,
          message: 'Invalid doctor assignment'
        });
      }
    }

    // Create Azure Communication Services thread
    const threadId = await createThread();
    if (!threadId) {
      return res.status(500).json({
        success: false,
        message: 'Failed to create chat thread'
      });
    }

    // Create conversation in database
    const conversationId = await DatabaseService.createConversation(title, type, user.id, threadId, assigned_doctor_id);

    // Add creator as participant
    await DatabaseService.addParticipantToConversation(conversationId, user.id);

    // If it's a 1:1 conversation, add the assigned doctor as participant
    if (type === ConversationType.ONE_TO_ONE && assigned_doctor_id) {
      await DatabaseService.addParticipantToConversation(conversationId, assigned_doctor_id);
    }

    const conversation = await DatabaseService.getConversationById(conversationId);

    res.status(201).json({
      success: true,
      conversation,
      thread_id: threadId
    });
  } catch (error) {
    console.error('Create conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create conversation'
    });
  }
});

/**
 * route: /conversations/:id
 * purpose: Get a specific conversation
 */
router.get('/:id', authenticateToken, requireAnyRole, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const conversationId = parseInt(req.params.id);

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    const conversation = await DatabaseService.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if user has access to this conversation
    const participants = await DatabaseService.getConversationParticipants(conversationId);
    const hasAccess =
      user.role === UserRole.ADMIN ||
      participants.some((p) => p.id === user.id) ||
      conversation.creator_id === user.id ||
      (user.role === UserRole.DOCTOR &&
        (conversation.type === ConversationType.ONE_TO_MANY || conversation.assigned_doctor_id === user.id));

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get additional details
    const creator = await DatabaseService.getUserById(conversation.creator_id);
    const assignedDoctor = conversation.assigned_doctor_id
      ? await DatabaseService.getUserById(conversation.assigned_doctor_id)
      : null;

    res.json({
      success: true,
      conversation: {
        ...conversation,
        creator: creator ? { id: creator.id, display_name: creator.display_name, email: creator.email } : null,
        assigned_doctor: assignedDoctor ? { id: assignedDoctor.id, display_name: assignedDoctor.display_name } : null,
        participants: participants.map((p) => ({ id: p.id, display_name: p.display_name, role: p.role }))
      }
    });
  } catch (error) {
    console.error('Get conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get conversation'
    });
  }
});

/**
 * route: /conversations/:id
 * purpose: Update conversation (status, etc.) - doctors and admins only
 */
router.patch('/:id', authenticateToken, requireDoctorOrAdmin, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const conversationId = parseInt(req.params.id);
    const { status }: UpdateConversationRequest = req.body;

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    const conversation = await DatabaseService.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check if doctor has access to this conversation
    if (user.role === UserRole.DOCTOR) {
      const participants = await DatabaseService.getConversationParticipants(conversationId);
      const hasAccess =
        participants.some((p) => p.id === user.id) ||
        conversation.assigned_doctor_id === user.id ||
        conversation.type === ConversationType.ONE_TO_MANY;

      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }
    }

    // Update status if provided
    if (status) {
      if (!Object.values(ConversationStatus).includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid status'
        });
      }

      await DatabaseService.updateConversationStatus(conversationId, status);
    }

    const updatedConversation = await DatabaseService.getConversationById(conversationId);

    res.json({
      success: true,
      conversation: updatedConversation
    });
  } catch (error) {
    console.error('Update conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update conversation'
    });
  }
});

/**
 * route: /conversations/:id/join
 * purpose: Join a conversation (doctors joining 1:N conversations)
 */
router.post('/:id/join', authenticateToken, requireDoctorOrAdmin, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const conversationId = parseInt(req.params.id);

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    const conversation = await DatabaseService.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Only allow joining 1:N conversations or admin can join any
    if (user.role === UserRole.DOCTOR && conversation.type !== ConversationType.ONE_TO_MANY) {
      return res.status(403).json({
        success: false,
        message: 'Cannot join this type of conversation'
      });
    }

    // Add user as participant
    await DatabaseService.addParticipantToConversation(conversationId, user.id);

    res.json({
      success: true,
      message: 'Successfully joined conversation'
    });
  } catch (error) {
    console.error('Join conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to join conversation'
    });
  }
});

/**
 * route: /conversations/:id
 * purpose: Delete conversation (admins only)
 */
router.delete('/:id', authenticateToken, requireDoctorOrAdmin, async (req: AuthRequest, res) => {
  try {
    const conversationId = parseInt(req.params.id);

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    const conversation = await DatabaseService.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    await DatabaseService.deleteConversation(conversationId);

    res.json({
      success: true,
      message: 'Conversation deleted successfully'
    });
  } catch (error) {
    console.error('Delete conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete conversation'
    });
  }
});

/**
 * route: /conversations/:id/export
 * purpose: Export conversation messages as JSON (admins only)
 */
router.get('/:id/export', authenticateToken, requireDoctorOrAdmin, async (req: AuthRequest, res) => {
  try {
    const conversationId = parseInt(req.params.id);

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    const conversation = await DatabaseService.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Get conversation details
    const participants = await DatabaseService.getConversationParticipants(conversationId);
    const creator = await DatabaseService.getUserById(conversation.creator_id);
    const attachments = await DatabaseService.getAttachmentsByConversationId(conversationId);

    // Get messages from Azure Communication Services
    const messages = await getThreadMessages(conversation.thread_id);

    // Format messages for export
    const formattedMessages = messages.map((message) => ({
      id: message.id,
      type: message.type,
      content: message.content?.message || '',
      sender_display_name: message.senderDisplayName || 'Unknown',
      sender_id: message.sender?.kind === 'communicationUser' ? message.sender.communicationUserId : null,
      created_on: message.createdOn?.toISOString() || null,
      sequence_id: message.sequenceId || null
    }));

    const exportData = {
      conversation: {
        id: conversation.id,
        title: conversation.title,
        type: conversation.type,
        status: conversation.status,
        created_at: conversation.created_at,
        thread_id: conversation.thread_id
      },
      creator: creator
        ? {
            id: creator.id,
            display_name: creator.display_name,
            email: creator.email
          }
        : null,
      participants: participants.map((p) => ({
        id: p.id,
        display_name: p.display_name,
        role: p.role
      })),
      attachments: attachments.map((att) => ({
        id: att.id,
        original_filename: att.original_filename,
        file_size: att.file_size,
        file_type: att.file_type,
        uploader_name: (att as any).uploader_name,
        created_at: att.created_at
      })),
      messages: formattedMessages,
      exported_at: new Date().toISOString(),
      exported_by: {
        id: req.user!.id,
        display_name: req.user!.display_name
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="conversation_${conversationId}_export.json"`);
    res.json(exportData);
  } catch (error) {
    console.error('Export conversation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export conversation'
    });
  }
});

export default router;
