// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import sqlite3 from 'sqlite3';
import path from 'path';
import bcrypt from 'bcryptjs';

// Enable verbose mode for debugging
const db = new sqlite3.Database(path.join(__dirname, '../../../patient_care.db'), (err) => {
  if (err) {
    console.error('Error opening database:', err.message);
  } else {
    console.log('Connected to SQLite database');
  }
});

// User roles
export enum UserRole {
  PATIENT = 'patient',
  DOCTOR = 'doctor',
  ADMIN = 'admin',
  QUALITY = 'quality'
}

// Conversation types
export enum ConversationType {
  ONE_TO_ONE = '1to1', // Patient to specific doctor
  ONE_TO_MANY = '1toN' // Patient to any doctor
}

// Conversation status
export enum ConversationStatus {
  ACTIVE = 'active',
  READ_ONLY = 'readonly',
  ARCHIVED = 'archived'
}

// User interface
export interface User {
  id: number;
  email: string;
  password_hash: string;
  role: UserRole;
  display_name: string;
  created_at: string;
}

// Conversation interface
export interface Conversation {
  id: number;
  title: string;
  type: ConversationType;
  creator_id: number;
  status: ConversationStatus;
  thread_id: string;
  created_at: string;
  assigned_doctor_id?: number; // For 1:1 conversations
}

// Attachment interface
export interface Attachment {
  id: number;
  conversation_id: number;
  uploader_id: number;
  original_filename: string;
  stored_filename: string;
  file_size: number;
  file_type: string;
  blob_url: string;
  container_name: string;
  created_at: string;
}

// Initialize database tables
export const initializeDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT NOT NULL,
          role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin', 'quality')),
          display_name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Conversations table
      db.run(`
        CREATE TABLE IF NOT EXISTS conversations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('1to1', '1toN')),
          creator_id INTEGER NOT NULL,
          status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'readonly', 'archived')),
          thread_id TEXT UNIQUE NOT NULL,
          assigned_doctor_id INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (creator_id) REFERENCES users (id),
          FOREIGN KEY (assigned_doctor_id) REFERENCES users (id)
        )
      `);

      // Conversation participants table
      db.run(`
        CREATE TABLE IF NOT EXISTS conversation_participants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations (id),
          FOREIGN KEY (user_id) REFERENCES users (id),
          UNIQUE(conversation_id, user_id)
        )
      `);

      // Conversation metadata table (for tags and custom fields)
      db.run(`
        CREATE TABLE IF NOT EXISTS conversation_metadata (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          FOREIGN KEY (conversation_id) REFERENCES conversations (id)
        )
      `);

      // Attachments table
      db.run(`
        CREATE TABLE IF NOT EXISTS attachments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          conversation_id INTEGER NOT NULL,
          uploader_id INTEGER NOT NULL,
          original_filename TEXT NOT NULL,
          stored_filename TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          file_type TEXT NOT NULL,
          blob_url TEXT NOT NULL,
          container_name TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (conversation_id) REFERENCES conversations (id),
          FOREIGN KEY (uploader_id) REFERENCES users (id)
        )
      `);

      // Create default admin user if not exists
      db.get('SELECT id FROM users WHERE email = ?', ['admin@example.com'], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          // Create default admin user
          const adminPassword = bcrypt.hashSync('admin123', 10);
          db.run(
            'INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
            ['admin@example.com', adminPassword, UserRole.ADMIN, 'System Administrator'],
            (err) => {
              if (err) {
                reject(err);
              } else {
                console.log('Default admin user created: admin@example.com / admin123');
                
                // Create default quality user if not exists
                db.get('SELECT id FROM users WHERE email = ?', ['quality@example.com'], (err, qualityRow) => {
                  if (err) {
                    reject(err);
                  } else if (!qualityRow) {
                    const qualityPassword = bcrypt.hashSync('quality123', 10);
                    db.run(
                      'INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
                      ['quality@example.com', qualityPassword, UserRole.QUALITY, 'Quality Assurance'],
                      (err) => {
                        if (err) {
                          reject(err);
                        } else {
                          console.log('Default quality user created: quality@example.com / quality123');
                          resolve();
                        }
                      }
                    );
                  } else {
                    resolve();
                  }
                });
              }
            }
          );
        } else {
          // Admin exists, check for quality user
          db.get('SELECT id FROM users WHERE email = ?', ['quality@example.com'], (err, qualityRow) => {
            if (err) {
              reject(err);
            } else if (!qualityRow) {
              const qualityPassword = bcrypt.hashSync('quality123', 10);
              db.run(
                'INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
                ['quality@example.com', qualityPassword, UserRole.QUALITY, 'Quality Assurance'],
                (err) => {
                  if (err) {
                    reject(err);
                  } else {
                    console.log('Default quality user created: quality@example.com / quality123');
                    resolve();
                  }
                }
              );
            } else {
              resolve();
            }
          });
        }
      });
    });
  });
};

// Database utility functions
export class DatabaseService {
  // User management
  static createUser(email: string, password: string, role: UserRole, displayName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const passwordHash = bcrypt.hashSync(password, 10);
      db.run(
        'INSERT INTO users (email, password_hash, role, display_name) VALUES (?, ?, ?, ?)',
        [email, passwordHash, role, displayName],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  static getUserByEmail(email: string): Promise<User | null> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE email = ?', [email], (err, row: User) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  static getUserById(id: number): Promise<User | null> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM users WHERE id = ?', [id], (err, row: User) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  static getUsersByRole(role: UserRole): Promise<User[]> {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM users WHERE role = ? ORDER BY display_name', [role], (err, rows: User[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  static validatePassword(plainPassword: string, hashedPassword: string): boolean {
    return bcrypt.compareSync(plainPassword, hashedPassword);
  }

  // Conversation management
  static createConversation(
    title: string,
    type: ConversationType,
    creatorId: number,
    threadId: string,
    assignedDoctorId?: number
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO conversations (title, type, creator_id, thread_id, assigned_doctor_id) VALUES (?, ?, ?, ?, ?)',
        [title, type, creatorId, threadId, assignedDoctorId],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  static getConversationById(id: number): Promise<Conversation | null> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM conversations WHERE id = ?', [id], (err, row: Conversation) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  static getConversationsByUserId(userId: number): Promise<Conversation[]> {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT c.* FROM conversations c
         LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE c.creator_id = ? OR cp.user_id = ?
         ORDER BY c.created_at DESC`,
        [userId, userId],
        (err, rows: Conversation[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  static updateConversationStatus(id: number, status: ConversationStatus): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run('UPDATE conversations SET status = ? WHERE id = ?', [status, id], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  static addParticipantToConversation(conversationId: number, userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT OR IGNORE INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
        [conversationId, userId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  static getConversationParticipants(conversationId: number): Promise<User[]> {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT u.* FROM users u
         JOIN conversation_participants cp ON u.id = cp.user_id
         WHERE cp.conversation_id = ?`,
        [conversationId],
        (err, rows: User[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // Get all conversations for doctors (to see patient requests)
  static getConversationsForDoctor(doctorId: number): Promise<Conversation[]> {
    return new Promise((resolve, reject) => {
      db.all(
        `SELECT DISTINCT c.* FROM conversations c
         LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id
         WHERE (c.type = '1toN' AND c.assigned_doctor_id IS NULL) 
            OR c.assigned_doctor_id = ? 
            OR cp.user_id = ?
         ORDER BY c.created_at DESC`,
        [doctorId, doctorId],
        (err, rows: Conversation[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  // Admin functions
  static getAllConversations(): Promise<Conversation[]> {
    return new Promise((resolve, reject) => {
      db.all('SELECT * FROM conversations ORDER BY created_at DESC', [], (err, rows: Conversation[]) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  static deleteConversation(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        db.run('DELETE FROM conversation_participants WHERE conversation_id = ?', [id]);
        db.run('DELETE FROM conversation_metadata WHERE conversation_id = ?', [id]);
        db.run('DELETE FROM attachments WHERE conversation_id = ?', [id]);
        db.run('DELETE FROM conversations WHERE id = ?', [id], (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  static addConversationParticipant(conversationId: number, userId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO conversation_participants (conversation_id, user_id) VALUES (?, ?)',
        [conversationId, userId],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  static addConversationMetadata(conversationId: number, key: string, value: string): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO conversation_metadata (conversation_id, key, value) VALUES (?, ?, ?)',
        [conversationId, key, value],
        (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        }
      );
    });
  }

  // Attachment management
  static createAttachment(
    conversationId: number,
    uploaderId: number,
    originalFilename: string,
    storedFilename: string,
    fileSize: number,
    fileType: string,
    blobUrl: string,
    containerName: string
  ): Promise<number> {
    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO attachments (conversation_id, uploader_id, original_filename, stored_filename, file_size, file_type, blob_url, container_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [conversationId, uploaderId, originalFilename, storedFilename, fileSize, fileType, blobUrl, containerName],
        function (err) {
          if (err) {
            reject(err);
          } else {
            resolve(this.lastID);
          }
        }
      );
    });
  }

  static getAttachmentsByConversationId(conversationId: number): Promise<Attachment[]> {
    return new Promise((resolve, reject) => {
      db.all(
        'SELECT a.*, u.display_name as uploader_name FROM attachments a JOIN users u ON a.uploader_id = u.id WHERE a.conversation_id = ? ORDER BY a.created_at ASC',
        [conversationId],
        (err, rows: (Attachment & { uploader_name: string })[]) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        }
      );
    });
  }

  static getAttachmentById(id: number): Promise<Attachment | null> {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM attachments WHERE id = ?', [id], (err, row: Attachment) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || null);
        }
      });
    });
  }

  static deleteAttachment(id: number): Promise<void> {
    return new Promise((resolve, reject) => {
      db.run('DELETE FROM attachments WHERE id = ?', [id], (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  // Analytics methods
  
  static getAnalytics(startDate?: string, endDate?: string): Promise<any> {
    const dateFilter = startDate && endDate 
      ? `WHERE created_at BETWEEN '${startDate}' AND '${endDate}'`
      : '';

    return new Promise((resolve, reject) => {
      const analytics = {};
      let completedQueries = 0;
      const totalQueries = 8;

      const checkComplete = () => {
        completedQueries++;
        if (completedQueries === totalQueries) {
          resolve(analytics);
        }
      };

      // Total conversations
      db.get(
        `SELECT COUNT(*) as total FROM conversations ${dateFilter}`,
        (err, row: any) => {
          if (err) reject(err);
          else {
            (analytics as any).totalConversations = row.total;
            checkComplete();
          }
        }
      );

      // Open conversations (active status)
      db.get(
        `SELECT COUNT(*) as total FROM conversations WHERE status = 'active' ${dateFilter ? dateFilter.replace('WHERE', 'AND') : ''}`,
        (err, row: any) => {
          if (err) reject(err);
          else {
            (analytics as any).openConversations = row.total;
            checkComplete();
          }
        }
      );

      // On hold conversations (conversations with no recent activity - approximation)
      db.get(
        `SELECT COUNT(*) as total FROM conversations 
         WHERE status = 'active' AND created_at < datetime('now', '-1 hour') 
         ${dateFilter ? dateFilter.replace('WHERE', 'AND') : ''}`,
        (err, row: any) => {
          if (err) reject(err);
          else {
            (analytics as any).onHoldConversations = row.total;
            checkComplete();
          }
        }
      );

      // Total users (visitors)
      db.get(
        `SELECT COUNT(*) as total FROM users WHERE role = 'patient' ${dateFilter ? dateFilter.replace('WHERE', 'AND') : ''}`,
        (err, row: any) => {
          if (err) reject(err);
          else {
            (analytics as any).totalVisitors = row.total;
            checkComplete();
          }
        }
      );

      // Conversations per day
      db.all(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM conversations ${dateFilter} 
         GROUP BY DATE(created_at) 
         ORDER BY date DESC`,
        (err, rows: any[]) => {
          if (err) reject(err);
          else {
            (analytics as any).conversationsPerDay = rows;
            const avg = rows.length > 0 
              ? rows.reduce((sum, row) => sum + row.count, 0) / rows.length 
              : 0;
            (analytics as any).avgConversationsPerDay = Math.round(avg * 100) / 100;
            checkComplete();
          }
        }
      );

      // Busiest day
      db.get(
        `SELECT DATE(created_at) as date, COUNT(*) as count 
         FROM conversations ${dateFilter} 
         GROUP BY DATE(created_at) 
         ORDER BY count DESC 
         LIMIT 1`,
        (err, row: any) => {
          if (err) reject(err);
          else {
            (analytics as any).busiestDay = row || { date: null, count: 0 };
            checkComplete();
          }
        }
      );

      // Conversations by hour (busiest time)
      db.all(
        `SELECT strftime('%H', created_at) as hour, COUNT(*) as count 
         FROM conversations ${dateFilter} 
         GROUP BY strftime('%H', created_at) 
         ORDER BY count DESC`,
        (err, rows: any[]) => {
          if (err) reject(err);
          else {
            (analytics as any).conversationsByHour = rows;
            (analytics as any).busiestTime = rows.length > 0 ? rows[0] : { hour: null, count: 0 };
            checkComplete();
          }
        }
      );

      // Conversation status breakdown
      db.all(
        `SELECT status, COUNT(*) as count 
         FROM conversations ${dateFilter} 
         GROUP BY status`,
        (err, rows: any[]) => {
          if (err) reject(err);
          else {
            (analytics as any).conversationsByStatus = rows;
            checkComplete();
          }
        }
      );
    });
  }

  static getCurrentDayAnalytics(): Promise<any> {
    const today = new Date().toISOString().split('T')[0];
    const startOfDay = `${today} 00:00:00`;
    const endOfDay = `${today} 23:59:59`;

    return new Promise((resolve, reject) => {
      const analytics = {};
      let completedQueries = 0;
      const totalQueries = 6;

      const checkComplete = () => {
        completedQueries++;
        if (completedQueries === totalQueries) {
          resolve(analytics);
        }
      };

      // Today's conversations
      db.get(
        `SELECT COUNT(*) as total FROM conversations WHERE created_at BETWEEN ? AND ?`,
        [startOfDay, endOfDay],
        (err, row: any) => {
          if (err) reject(err);
          else {
            (analytics as any).todayConversations = row.total;
            checkComplete();
          }
        }
      );

      // Today's new users
      db.get(
        `SELECT COUNT(*) as total FROM users WHERE created_at BETWEEN ? AND ?`,
        [startOfDay, endOfDay],
        (err, row: any) => {
          if (err) reject(err);
          else {
            (analytics as any).todayNewUsers = row.total;
            checkComplete();
          }
        }
      );

      // Current active conversations
      db.get(
        `SELECT COUNT(*) as total FROM conversations WHERE status = 'active'`,
        (err, row: any) => {
          if (err) reject(err);
          else {
            (analytics as any).currentActiveConversations = row.total;
            checkComplete();
          }
        }
      );

      // Average conversation duration (approximation based on creation time)
      db.get(
        `SELECT AVG(
           CASE 
             WHEN status = 'archived' OR status = 'readonly' 
             THEN julianday('now') - julianday(created_at)
             ELSE julianday('now') - julianday(created_at)
           END
         ) * 24 as avgHours
         FROM conversations 
         WHERE created_at BETWEEN ? AND ?`,
        [startOfDay, endOfDay],
        (err, row: any) => {
          if (err) reject(err);
          else {
            (analytics as any).avgConversationDurationHours = row.avgHours ? Math.round(row.avgHours * 100) / 100 : 0;
            checkComplete();
          }
        }
      );

      // Today's conversations by hour
      db.all(
        `SELECT strftime('%H', created_at) as hour, COUNT(*) as count 
         FROM conversations 
         WHERE created_at BETWEEN ? AND ?
         GROUP BY strftime('%H', created_at) 
         ORDER BY hour`,
        [startOfDay, endOfDay],
        (err, rows: any[]) => {
          if (err) reject(err);
          else {
            (analytics as any).todayConversationsByHour = rows;
            checkComplete();
          }
        }
      );

      // Response time approximation (time between conversation creation and first doctor join)
      db.get(
        `SELECT AVG(
           julianday(cp.joined_at) - julianday(c.created_at)
         ) * 24 * 60 as avgMinutes
         FROM conversations c
         JOIN conversation_participants cp ON c.id = cp.conversation_id
         JOIN users u ON cp.user_id = u.id
         WHERE u.role = 'doctor' 
         AND c.created_at BETWEEN ? AND ?`,
        [startOfDay, endOfDay],
        (err, row: any) => {
          if (err) reject(err);
          else {
            (analytics as any).avgResponseTimeMinutes = row.avgMinutes ? Math.round(row.avgMinutes * 100) / 100 : 0;
            checkComplete();
          }
        }
      );
    });
  }
}

export default db;
