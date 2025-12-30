const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

class ApiClient {
  private baseURL: string;
  private getAuthToken: () => string | null;
  private getRefreshToken: () => string | null;
  private setTokens: (accessToken: string, refreshToken: string) => void;
  private clearTokens: () => void;

  constructor(
    getAuthToken: () => string | null,
    getRefreshToken: () => string | null,
    setTokens: (accessToken: string, refreshToken: string) => void,
    clearTokens: () => void
  ) {
    this.baseURL = API_BASE_URL;
    this.getAuthToken = getAuthToken;
    this.getRefreshToken = getRefreshToken;
    this.setTokens = setTokens;
    this.clearTokens = clearTokens;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAuthToken();
    const url = `${this.baseURL}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Handle token refresh on 401
      if (response.status === 401 && token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry request with new token
          const newToken = this.getAuthToken();
          if (newToken) {
            headers['Authorization'] = `Bearer ${newToken}`;
            const retryResponse = await fetch(url, {
              ...options,
              headers,
            });
            if (!retryResponse.ok) {
              throw new Error(`HTTP error! status: ${retryResponse.status}`);
            }
            return retryResponse.json();
          }
        }
        this.clearTokens();
        throw new Error('Authentication failed');
      }

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error('API request error:', error);
      throw error;
    }
  }

  private async refreshToken(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) return false;

    try {
      const response = await fetch(`${this.baseURL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (response.ok) {
        const data = await response.json();
        this.setTokens(data.accessToken, data.refreshToken);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  // Auth endpoints
  async signup(data: {
    name: string;
    email: string;
    password: string;
    phone: string;
    role?: 'admin' | 'member';
  }) {
    return this.request<{
      message: string;
      accessToken: string;
      refreshToken: string;
      user: any;
    }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: { email: string; password: string }) {
    return this.request<{
      message: string;
      accessToken?: string;
      refreshToken?: string;
      mustChangePassword?: boolean;
      userId?: string;
      user?: any;
      member?: any;
    }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async changePassword(data: { userId: string; currentPassword: string; newPassword: string }) {
    return this.request<{
      message: string;
      accessToken: string;
      refreshToken: string;
      user: any;
      member: any;
    }>('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async logout() {
    const refreshToken = this.getRefreshToken();
    if (refreshToken) {
      await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      });
    }
    this.clearTokens();
  }

  // Members
  async getMembers() {
    return this.request<any[]>('/members');
  }

  async getMember(id: string) {
    return this.request<any>(`/members/${id}`);
  }

  async createMember(data: any) {
    return this.request<any>('/members', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMember(id: string, data: any) {
    return this.request<any>(`/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMember(id: string) {
    return this.request<{ message: string }>(`/members/${id}`, {
      method: 'DELETE',
    });
  }

  // Bookings
  async getBookings(params?: { date?: string; startDate?: string; endDate?: string }) {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    const queryString = query.toString();
    return this.request<any[]>(`/bookings${queryString ? `?${queryString}` : ''}`);
  }

  async getBooking(id: string) {
    return this.request<any>(`/bookings/${id}`);
  }

  async createBooking(data: any) {
    return this.request<any>('/bookings', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateBooking(id: string, data: any) {
    return this.request<any>(`/bookings/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteBooking(id: string) {
    return this.request<{ message: string }>(`/bookings/${id}`, {
      method: 'DELETE',
    });
  }

  // Attendance
  async getAttendance(params?: { date?: string; startDate?: string; endDate?: string; memberId?: string }) {
    const query = new URLSearchParams();
    if (params?.date) query.append('date', params.date);
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.memberId) query.append('memberId', params.memberId);
    const queryString = query.toString();
    return this.request<any[]>(`/attendance${queryString ? `?${queryString}` : ''}`);
  }

  async getAttendanceByDate(date: string) {
    return this.request<any[]>(`/attendance/date/${date}`);
  }

  async createAttendance(data: any | any[]) {
    return this.request<any | any[]>('/attendance', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Expenses
  async getExpenses(params?: { startDate?: string; endDate?: string; category?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.category) query.append('category', params.category);
    if (params?.status) query.append('status', params.status);
    const queryString = query.toString();
    return this.request<any[]>(`/expenses${queryString ? `?${queryString}` : ''}`);
  }

  async getExpense(id: string) {
    return this.request<any>(`/expenses/${id}`);
  }

  async createExpense(data: any) {
    return this.request<any>('/expenses', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateExpense(id: string, data: any) {
    return this.request<any>(`/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteExpense(id: string) {
    return this.request<{ message: string }>(`/expenses/${id}`, {
      method: 'DELETE',
    });
  }

  // Reports
  async getReports() {
    return this.request<any[]>('/reports');
  }

  async getReport(id: string) {
    return this.request<any>(`/reports/${id}`);
  }

  async generateReport(data: { type: string; period: { start: string; end: string } }) {
    return this.request<any>('/reports/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Payments
  async markPaymentPaid(data: { expenseId: string; memberId: string }) {
    return this.request<any>('/payments/mark-paid', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getMemberPayments(memberId: string) {
    return this.request<{
      expenseShares: any[];
      summary: {
        totalShare: number;
        totalPaid: number;
        totalUnpaid: number;
        paidCount: number;
        unpaidCount: number;
      };
    }>(`/payments/member/${memberId}`);
  }

  async getAllPayments() {
    return this.request<{
      memberPayments: any[];
    }>('/payments/all');
  }
}

// Create a factory function to create API client instances
export const createApiClient = (
  getAuthToken: () => string | null,
  getRefreshToken: () => string | null,
  setTokens: (accessToken: string, refreshToken: string) => void,
  clearTokens: () => void
) => {
  return new ApiClient(getAuthToken, getRefreshToken, setTokens, clearTokens);
};

