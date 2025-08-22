// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { DatabaseService, User, UserRole } from './database';

// JWT secret - in production, this should be in environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRY = '24h';

export interface AuthRequest extends Request {
  user?: User;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: {
    id: number;
    email: string;
    role: UserRole;
    display_name: string;
  };
  message?: string;
}

export interface RegisterResponse {
  success: boolean;
  user?: {
    id: number;
    email: string;
    role: UserRole;
    display_name: string;
  };
  message?: string;
}

export class AuthService {
  static generateToken(user: User): string {
    return jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRY }
    );
  }

  static verifyToken(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  static async login(email: string, password: string): Promise<LoginResponse> {
    try {
      const user = await DatabaseService.getUserByEmail(email);

      if (!user) {
        return {
          success: false,
          message: 'User not found'
        };
      }

      if (!DatabaseService.validatePassword(password, user.password_hash)) {
        return {
          success: false,
          message: 'Invalid password'
        };
      }

      const token = this.generateToken(user);

      return {
        success: true,
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          display_name: user.display_name
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      return {
        success: false,
        message: 'Login failed'
      };
    }
  }

  static async register(
    email: string,
    password: string,
    role: UserRole,
    displayName: string
  ): Promise<RegisterResponse> {
    try {
      // Check if user already exists
      const existingUser = await DatabaseService.getUserByEmail(email);
      if (existingUser) {
        return {
          success: false,
          message: 'User already exists'
        };
      }

      // Create new user
      const userId = await DatabaseService.createUser(email, password, role, displayName);
      const user = await DatabaseService.getUserById(userId);

      if (!user) {
        return {
          success: false,
          message: 'Failed to create user'
        };
      }

      return {
        success: true,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          display_name: user.display_name
        }
      };
    } catch (error) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: 'Registration failed'
      };
    }
  }
}

// Authentication middleware
export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const decoded = AuthService.verifyToken(token);
    const user = await DatabaseService.getUserById(decoded.id);

    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
};

// Role-based authorization middleware
export const requireRole = (roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'Insufficient permissions' });
    }

    next();
  };
};

// Convenience middlewares for specific roles
export const requirePatient = requireRole([UserRole.PATIENT]);
export const requireDoctor = requireRole([UserRole.DOCTOR]);
export const requireAdmin = requireRole([UserRole.ADMIN]);
export const requireQuality = requireRole([UserRole.QUALITY]);
export const requireDoctorOrAdmin = requireRole([UserRole.DOCTOR, UserRole.ADMIN]);
export const requireAdminOrQuality = requireRole([UserRole.ADMIN, UserRole.QUALITY]);
export const requireAnyRole = requireRole([UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN, UserRole.QUALITY]);
