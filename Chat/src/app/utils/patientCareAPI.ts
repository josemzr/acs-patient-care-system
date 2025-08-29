// Copyright (c) Microsoft Corporation.
// Licensed under the MIT License.

export interface User {
  id: number;
  email: string;
  role: 'patient' | 'doctor' | 'admin' | 'quality';
  display_name: string;
}

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: User;
  message?: string;
}

export interface RegisterResponse {
  success: boolean;
  user?: User;
  message?: string;
}

export interface Conversation {
  id: number;
  title: string;
  type: '1to1' | '1toN';
  creator_id: number;
  status: 'active' | 'readonly' | 'archived';
  thread_id: string;
  created_at: string;
  creator?: {
    id: number;
    display_name: string;
    email: string;
  };
  assigned_doctor?: {
    id: number;
    display_name: string;
  };
  participants?: Array<{
    id: number;
    display_name: string;
    role: string;
  }>;
}

export interface Doctor {
  id: number;
  display_name: string;
  email: string;
}

const API_BASE = '/';

// Helper function to get auth headers
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Authentication API
export const authAPI = {
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await fetch(`${API_BASE}auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });
    return response.json();
  },

  async register(
    email: string,
    password: string,
    role: 'patient' | 'doctor' | 'admin' | 'quality',
    display_name: string
  ): Promise<RegisterResponse> {
    const response = await fetch(`${API_BASE}auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password, role, display_name })
    });
    return response.json();
  },

  async verifyToken(): Promise<{ success: boolean; user?: User; message?: string }> {
    const response = await fetch(`${API_BASE}auth/verify`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  logout(): void {
    localStorage.removeItem('auth_token');
  },

  setToken(token: string): void {
    localStorage.setItem('auth_token', token);
  },

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }
};

// Conversations API
export const conversationsAPI = {
  async getConversations(): Promise<{ success: boolean; conversations?: Conversation[]; message?: string }> {
    const response = await fetch(`${API_BASE}conversations`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async createConversation(
    title: string,
    type: '1to1' | '1toN',
    assigned_doctor_id?: number
  ): Promise<{ success: boolean; conversation?: Conversation; thread_id?: string; message?: string }> {
    const response = await fetch(`${API_BASE}conversations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ title, type, assigned_doctor_id })
    });
    return response.json();
  },

  async getConversation(id: number): Promise<{ success: boolean; conversation?: Conversation; message?: string }> {
    const response = await fetch(`${API_BASE}conversations/${id}`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async updateConversation(
    id: number,
    status: 'active' | 'readonly' | 'archived'
  ): Promise<{ success: boolean; conversation?: Conversation; message?: string }> {
    const response = await fetch(`${API_BASE}conversations/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ status })
    });
    return response.json();
  },

  async joinConversation(id: number): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${API_BASE}conversations/${id}/join`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async deleteConversation(id: number): Promise<{ success: boolean; message?: string }> {
    const response = await fetch(`${API_BASE}conversations/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async exportConversation(id: number): Promise<Blob> {
    const response = await fetch(`${API_BASE}conversations/${id}/export`, {
      headers: getAuthHeaders()
    });
    return response.blob();
  }
};

// Users API
export const usersAPI = {
  async getDoctors(): Promise<{ success: boolean; doctors?: Doctor[]; message?: string }> {
    const response = await fetch(`${API_BASE}users/doctors`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async getProfile(): Promise<{ success: boolean; user?: User; message?: string }> {
    const response = await fetch(`${API_BASE}users/profile`, {
      headers: getAuthHeaders()
    });
    return response.json();
  }
};

// Analytics API interfaces
export interface AnalyticsData {
  totalConversations: number;
  openConversations: number;
  onHoldConversations: number;
  totalVisitors: number;
  conversationsPerDay: Array<{ date: string; count: number }>;
  avgConversationsPerDay: number;
  busiestDay: { date: string; count: number };
  conversationsByHour: Array<{ hour: string; count: number }>;
  busiestTime: { hour: string; count: number };
  conversationsByStatus: Array<{ status: string; count: number }>;
}

export interface TodayAnalyticsData {
  todayConversations: number;
  todayNewUsers: number;
  currentActiveConversations: number;
  avgConversationDurationHours: number;
  todayConversationsByHour: Array<{ hour: string; count: number }>;
  avgResponseTimeMinutes: number;
}

export interface AnalyticsSummary {
  general: AnalyticsData;
  today: TodayAnalyticsData;
}

// Analytics API
export const analyticsAPI = {
  async getAnalytics(
    startDate?: string, 
    endDate?: string, 
    period?: string
  ): Promise<{ success: boolean; data?: AnalyticsData | TodayAnalyticsData; message?: string }> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (period) params.append('period', period);

    const response = await fetch(`${API_BASE}analytics?${params.toString()}`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async getAnalyticsSummary(): Promise<{ success: boolean; data?: AnalyticsSummary; message?: string }> {
    const response = await fetch(`${API_BASE}analytics/summary`, {
      headers: getAuthHeaders()
    });
    return response.json();
  },

  async exportAnalytics(
    startDate?: string,
    endDate?: string,
    period?: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}analytics/export`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ startDate, endDate, period })
    });
    return response.json();
  },

  async exportTodayAnalytics(): Promise<{ success: boolean; message: string }> {
    const response = await fetch(`${API_BASE}analytics/export/today`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    return response.json();
  }
};

// Import API (admin only)
export const importAPI = {
  async exportFromRocketChat(
    serverUrl: string,
    username: string,
    password: string
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    const response = await fetch(`${API_BASE}import/rocketchat/export`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ serverUrl, username, password })
    });
    return response.json();
  },

  async importConversationsFile(file: File): Promise<{ success: boolean; data?: any; message?: string }> {
    const formData = new FormData();
    formData.append('importFile', file);

    const response = await fetch(`${API_BASE}import/conversations`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData
    });
    return response.json();
  },

  async importDirectFromRocketChat(
    serverUrl: string,
    username: string,
    password: string
  ): Promise<{ success: boolean; data?: any; message?: string }> {
    const response = await fetch(`${API_BASE}import/conversations/direct`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify({ serverUrl, username, password })
    });
    return response.json();
  }
};
