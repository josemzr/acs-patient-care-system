// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import express from 'express';
import multer from 'multer';
import { DatabaseService, UserRole } from '../lib/database';
import { AuthRequest, authenticateToken, requireAnyRole } from '../lib/auth';
import { getAzureBlobStorageConnectionString } from '../lib/envHelper';
import { BlobServiceClient, BlobSASPermissions, SASProtocol } from '@azure/storage-blob';
import path from 'path';

const router = express.Router();
const upload = multer({
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
});

// Allowed file types
const ALLOWED_FILE_TYPES = [
  'image/jpeg',
  'image/jpg', 
  'image/png',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/csv',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  // Audio types for voice messages
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'audio/mp3',
  'audio/webm',
  'audio/mp4'
];

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * route: /attachments/upload/:conversationId
 * purpose: Upload a file attachment to a conversation
 */
router.post('/upload/:conversationId', authenticateToken, requireAnyRole, upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const conversationId = parseInt(req.params.conversationId);
    const fileData = req.file;

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    if (!fileData) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    // Validate file size
    if (fileData.size > MAX_FILE_SIZE) {
      return res.status(400).json({
        success: false,
        message: 'File size exceeds 50MB limit'
      });
    }

    // Validate file type
    if (!ALLOWED_FILE_TYPES.includes(fileData.mimetype)) {
      return res.status(400).json({
        success: false,
        message: 'File type not allowed'
      });
    }

    // Check if conversation exists and user has access
    const conversation = await DatabaseService.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check user has access to this conversation
    const participants = await DatabaseService.getConversationParticipants(conversationId);
    const hasAccess =
      user.role === UserRole.ADMIN ||
      participants.some((p) => p.id === user.id) ||
      conversation.creator_id === user.id ||
      (user.role === UserRole.DOCTOR && conversation.assigned_doctor_id === user.id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate unique filename
    const fileExtension = path.extname(fileData.originalname);
    const storedFilename = `${Date.now()}_${Math.random().toString(36).substring(7)}${fileExtension}`;
    const containerName = `conversation-${conversationId}`;

    // Upload to Azure Blob Storage
    let connectionString: string;
    try {
      connectionString = getAzureBlobStorageConnectionString();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Azure Blob Storage not configured'
      });
    }

    try {
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(containerName);
      
      // Create container if it doesn't exist
      await containerClient.createIfNotExists();
      
      const blockBlobClient = containerClient.getBlockBlobClient(storedFilename);
      
      // Upload file
      await blockBlobClient.upload(fileData.buffer, fileData.size);
      
      // Generate SAS URL with longer expiry for attachments (30 days)
      const expiresOn = new Date();
      expiresOn.setDate(expiresOn.getDate() + 30);
      
      const sasUrl = await blockBlobClient.generateSasUrl({
        expiresOn: expiresOn,
        permissions: BlobSASPermissions.parse('r'),
        protocol: SASProtocol.Https
      });

      // Save attachment metadata to database
      const attachmentId = await DatabaseService.createAttachment(
        conversationId,
        user.id,
        fileData.originalname,
        storedFilename,
        fileData.size,
        fileData.mimetype,
        sasUrl,
        containerName
      );

      res.status(201).json({
        success: true,
        attachment: {
          id: attachmentId,
          conversation_id: conversationId,
          original_filename: fileData.originalname,
          file_size: fileData.size,
          file_type: fileData.mimetype,
          uploader_name: user.display_name,
          created_at: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Blob storage upload error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to upload file'
      });
    }
  } catch (error) {
    console.error('Upload attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload attachment'
    });
  }
});

/**
 * route: /attachments/:conversationId
 * purpose: List attachments for a conversation
 */
router.get('/:conversationId', authenticateToken, requireAnyRole, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const conversationId = parseInt(req.params.conversationId);

    if (isNaN(conversationId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid conversation ID'
      });
    }

    // Check if conversation exists and user has access
    const conversation = await DatabaseService.getConversationById(conversationId);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    // Check user has access to this conversation
    const participants = await DatabaseService.getConversationParticipants(conversationId);
    const hasAccess =
      user.role === UserRole.ADMIN ||
      participants.some((p) => p.id === user.id) ||
      conversation.creator_id === user.id ||
      (user.role === UserRole.DOCTOR && conversation.assigned_doctor_id === user.id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    const attachments = await DatabaseService.getAttachmentsByConversationId(conversationId);

    res.json({
      success: true,
      attachments: attachments.map(att => ({
        id: att.id,
        original_filename: att.original_filename,
        file_size: att.file_size,
        file_type: att.file_type,
        uploader_name: (att as any).uploader_name,
        created_at: att.created_at
      }))
    });
  } catch (error) {
    console.error('List attachments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list attachments'
    });
  }
});

/**
 * route: /attachments/download/:attachmentId
 * purpose: Generate download URL for an attachment
 */
router.get('/download/:attachmentId', authenticateToken, requireAnyRole, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const attachmentId = parseInt(req.params.attachmentId);

    if (isNaN(attachmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attachment ID'
      });
    }

    // Get attachment
    const attachment = await DatabaseService.getAttachmentById(attachmentId);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    // Check if user has access to the conversation
    const conversation = await DatabaseService.getConversationById(attachment.conversation_id);
    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    const participants = await DatabaseService.getConversationParticipants(attachment.conversation_id);
    const hasAccess =
      user.role === UserRole.ADMIN ||
      participants.some((p) => p.id === user.id) ||
      conversation.creator_id === user.id ||
      (user.role === UserRole.DOCTOR && conversation.assigned_doctor_id === user.id);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Generate new SAS URL with short expiry (1 hour)
    try {
      const connectionString = getAzureBlobStorageConnectionString();
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(attachment.container_name);
      const blockBlobClient = containerClient.getBlockBlobClient(attachment.stored_filename);

      const expiresOn = new Date();
      expiresOn.setHours(expiresOn.getHours() + 1); // 1 hour expiry

      const downloadUrl = await blockBlobClient.generateSasUrl({
        expiresOn: expiresOn,
        permissions: BlobSASPermissions.parse('r'),
        protocol: SASProtocol.Https
      });

      res.json({
        success: true,
        download_url: downloadUrl,
        filename: attachment.original_filename,
        expires_at: expiresOn.toISOString()
      });
    } catch (error) {
      console.error('Generate download URL error:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate download URL'
      });
    }
  } catch (error) {
    console.error('Download attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process download request'
    });
  }
});

/**
 * route: /attachments/:attachmentId
 * purpose: Delete an attachment (uploader or admin only)
 */
router.delete('/:attachmentId', authenticateToken, requireAnyRole, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;
    const attachmentId = parseInt(req.params.attachmentId);

    if (isNaN(attachmentId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid attachment ID'
      });
    }

    // Get attachment
    const attachment = await DatabaseService.getAttachmentById(attachmentId);
    if (!attachment) {
      return res.status(404).json({
        success: false,
        message: 'Attachment not found'
      });
    }

    // Check permissions - only uploader or admin can delete
    if (user.role !== UserRole.ADMIN && attachment.uploader_id !== user.id) {
      return res.status(403).json({
        success: false,
        message: 'Only the uploader or admin can delete this attachment'
      });
    }

    // Delete from blob storage
    try {
      const connectionString = getAzureBlobStorageConnectionString();
      const blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
      const containerClient = blobServiceClient.getContainerClient(attachment.container_name);
      const blockBlobClient = containerClient.getBlockBlobClient(attachment.stored_filename);
      
      await blockBlobClient.deleteIfExists();
    } catch (error) {
      console.error('Failed to delete blob:', error);
      // Continue with database deletion even if blob deletion fails
    }

    // Delete from database
    await DatabaseService.deleteAttachment(attachmentId);

    res.json({
      success: true,
      message: 'Attachment deleted successfully'
    });
  } catch (error) {
    console.error('Delete attachment error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete attachment'
    });
  }
});

export default router;