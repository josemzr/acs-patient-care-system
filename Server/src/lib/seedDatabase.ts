// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

import { DatabaseService, UserRole } from '../lib/database';

export const createDemoUsers = async (): Promise<void> => {
  try {
    // Check if demo users already exist
    const existingDoctor = await DatabaseService.getUserByEmail('doctor@example.com');
    const existingPatient = await DatabaseService.getUserByEmail('patient@example.com');

    if (!existingDoctor) {
      await DatabaseService.createUser('doctor@example.com', 'doctor123', UserRole.DOCTOR, 'Dr. Sarah Johnson');
      console.log('Demo doctor created: doctor@example.com / doctor123');
    }

    if (!existingPatient) {
      await DatabaseService.createUser('patient@example.com', 'patient123', UserRole.PATIENT, 'John Smith');
      console.log('Demo patient created: patient@example.com / patient123');
    }

    // Create additional demo users
    const existingDoctor2 = await DatabaseService.getUserByEmail('doctor2@example.com');
    if (!existingDoctor2) {
      await DatabaseService.createUser('doctor2@example.com', 'doctor123', UserRole.DOCTOR, 'Dr. Michael Brown');
      console.log('Demo doctor 2 created: doctor2@example.com / doctor123');
    }

    const existingPatient2 = await DatabaseService.getUserByEmail('patient2@example.com');
    if (!existingPatient2) {
      await DatabaseService.createUser('patient2@example.com', 'patient123', UserRole.PATIENT, 'Emily Davis');
      console.log('Demo patient 2 created: patient2@example.com / patient123');
    }
  } catch (error) {
    console.error('Error creating demo users:', error);
  }
};
