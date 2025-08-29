// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import fetch from 'node-fetch';

export interface RocketChatConfig {
  serverUrl: string;
  username: string;
  password: string;
}

export interface RocketChatMessage {
  _id: string;
  rid: string; // room id
  msg: string;
  ts: string; // timestamp
  u: {
    _id: string;
    username: string;
    name?: string;
  };
  _updatedAt: string;
  mentions?: any[];
  channels?: any[];
}

export interface RocketChatRoom {
  _id: string;
  name?: string;
  fname?: string;
  t: string; // room type (d = direct/1:1, c = channel, p = private group)
  msgs: number; // message count
  usersCount: number;
  lm: string; // last message timestamp
  ts: string; // created timestamp
  usernames?: string[];
  u?: {
    _id: string;
    username: string;
  };
}

export interface RocketChatUser {
  _id: string;
  username: string;
  name?: string;
  emails?: Array<{ address: string; verified: boolean }>;
  active: boolean;
  type: string;
  roles: string[];
}

export class RocketChatExporter {
  private authToken: string | null = null;
  private userId: string | null = null;
  
  constructor(private config: RocketChatConfig) {}

  async authenticate(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.serverUrl}/api/v1/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: this.config.username,
          password: this.config.password,
        }),
      });

      const result = await response.json() as any;
      
      if (result.status === 'success') {
        this.authToken = result.data.authToken;
        this.userId = result.data.userId;
        return true;
      }
      
      console.error('RocketChat authentication failed:', result.message);
      return false;
    } catch (error) {
      console.error('RocketChat authentication error:', error);
      return false;
    }
  }

  private getAuthHeaders() {
    if (!this.authToken || !this.userId) {
      throw new Error('Not authenticated. Call authenticate() first.');
    }
    
    return {
      'X-Auth-Token': this.authToken,
      'X-User-Id': this.userId,
      'Content-Type': 'application/json',
    };
  }

  async getDirectMessageRooms(): Promise<RocketChatRoom[]> {
    try {
      const response = await fetch(`${this.config.serverUrl}/api/v1/im.list`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json() as any;
      
      if (result.success) {
        // Filter for 1:1 conversations (type 'd' = direct messages)
        return result.ims.filter((room: RocketChatRoom) => room.t === 'd');
      }
      
      throw new Error(`Failed to get direct message rooms: ${result.error}`);
    } catch (error) {
      console.error('Error getting direct message rooms:', error);
      throw error;
    }
  }

  async getMessagesFromRoom(roomId: string, oldest?: string): Promise<RocketChatMessage[]> {
    try {
      const params = new URLSearchParams({
        roomId,
        count: '1000', // Maximum messages per request
      });
      
      if (oldest) {
        params.append('oldest', oldest);
      }

      const response = await fetch(`${this.config.serverUrl}/api/v1/im.messages?${params}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json() as any;
      
      if (result.success) {
        return result.messages;
      }
      
      throw new Error(`Failed to get messages: ${result.error}`);
    } catch (error) {
      console.error('Error getting messages from room:', error);
      throw error;
    }
  }

  async getAllMessagesFromRoom(roomId: string): Promise<RocketChatMessage[]> {
    const allMessages: RocketChatMessage[] = [];
    let oldest: string | undefined = undefined;
    
    try {
      while (true) {
        const messages = await this.getMessagesFromRoom(roomId, oldest);
        
        if (messages.length === 0) {
          break;
        }
        
        allMessages.push(...messages);
        
        // Set oldest to the timestamp of the oldest message we just received
        const oldestMessage = messages[messages.length - 1];
        if (oldestMessage && oldestMessage.ts) {
          oldest = oldestMessage.ts;
        } else {
          break;
        }
        
        // If we got less than the max, we've reached the end
        if (messages.length < 1000) {
          break;
        }
      }
      
      return allMessages.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
    } catch (error) {
      console.error('Error getting all messages from room:', error);
      throw error;
    }
  }

  async getUserInfo(userId: string): Promise<RocketChatUser | null> {
    try {
      const response = await fetch(`${this.config.serverUrl}/api/v1/users.info?userId=${userId}`, {
        headers: this.getAuthHeaders(),
      });

      const result = await response.json() as any;
      
      if (result.success) {
        return result.user;
      }
      
      return null;
    } catch (error) {
      console.error('Error getting user info:', error);
      return null;
    }
  }

  async exportDirectMessages(): Promise<any[]> {
    try {
      if (!await this.authenticate()) {
        throw new Error('Failed to authenticate with RocketChat');
      }

      const rooms = await this.getDirectMessageRooms();
      console.log(`Found ${rooms.length} direct message rooms to export`);

      const exportedConversations = [];

      for (const room of rooms) {
        try {
          console.log(`Exporting room ${room._id}...`);
          
          const messages = await this.getAllMessagesFromRoom(room._id);
          
          if (messages.length === 0) {
            console.log(`Skipping empty room ${room._id}`);
            continue;
          }

          // Get participant information
          const participantIds = [...new Set(messages.map(m => m.u._id))];
          const participants = [];
          
          for (const participantId of participantIds) {
            const user = await this.getUserInfo(participantId);
            if (user) {
              participants.push({
                id: user._id,
                username: user.username,
                display_name: user.name || user.username,
                email: user.emails?.[0]?.address || `${user.username}@rocketchat.local`,
                // Try to determine role based on username patterns or other heuristics
                role: this.determineUserRole(user)
              });
            }
          }

          // Create conversation export in our system's format
          const conversation = {
            source: 'rocketchat',
            source_id: room._id,
            title: room.fname || room.name || `Conversation ${room._id}`,
            type: '1to1', // Direct messages are always 1:1
            participants,
            messages: messages.map(msg => ({
              id: msg._id,
              content: msg.msg,
              sender_id: msg.u._id,
              sender_display_name: msg.u.name || msg.u.username,
              created_on: new Date(msg.ts).toISOString(),
              type: 'text'
            })),
            created_at: new Date(room.ts).toISOString(),
            exported_at: new Date().toISOString(),
            message_count: messages.length
          };

          exportedConversations.push(conversation);
          
        } catch (roomError) {
          console.error(`Error exporting room ${room._id}:`, roomError);
        }
      }

      console.log(`Successfully exported ${exportedConversations.length} conversations`);
      return exportedConversations;
      
    } catch (error) {
      console.error('Error exporting direct messages:', error);
      throw error;
    }
  }

  private determineUserRole(user: RocketChatUser): string {
    // Basic role determination logic - can be enhanced based on specific needs
    if (user.roles.includes('admin')) return 'admin';
    if (user.roles.includes('doctor') || user.username.toLowerCase().includes('doctor') || user.username.toLowerCase().includes('dr')) return 'doctor';
    return 'patient'; // Default to patient
  }
}