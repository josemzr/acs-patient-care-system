// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import express from 'express';
import { DatabaseService, UserRole } from '../lib/database';
import { AuthRequest, authenticateToken, requireAnyRole } from '../lib/auth';

const router = express.Router();

/**
 * route: /users/doctors
 * purpose: Get list of available doctors (for patients to select for 1:1 conversations)
 */
router.get('/doctors', authenticateToken, requireAnyRole, async (req: AuthRequest, res) => {
  try {
    const doctors = await DatabaseService.getUsersByRole(UserRole.DOCTOR);

    const doctorList = doctors.map((doctor) => ({
      id: doctor.id,
      display_name: doctor.display_name,
      email: doctor.email
    }));

    res.json({
      success: true,
      doctors: doctorList
    });
  } catch (error) {
    console.error('Get doctors error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get doctors list'
    });
  }
});

/**
 * route: /users/profile
 * purpose: Get current user profile
 */
router.get('/profile', authenticateToken, requireAnyRole, async (req: AuthRequest, res) => {
  try {
    const user = req.user!;

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        display_name: user.display_name,
        created_at: user.created_at
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user profile'
    });
  }
});

export default router;
