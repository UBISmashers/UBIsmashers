const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

class ApiClient {
  private baseURL: string;
  private getAuthToken: () => string | null;
  private clearTokens: () => void;

  constructor(getAuthToken: () => string | null, clearTokens: () => void) {
    this.baseURL = API_BASE_URL;
    this.getAuthToken = getAuthToken;
    this.clearTokens = clearTokens;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getAuthToken();
    const url = `${this.baseURL}${endpoint}`;

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...options.headers,
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const response = await fetch(url, { ...options, headers });

    if (response.status === 401 && token) {
      this.clearTokens();
      throw new Error("Authentication failed");
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: "Unknown error" }));
      throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  async login(data: { email: string; password: string }) {
    return this.request<{
      message: string;
      accessToken: string;
      user: any;
    }>("/auth/login", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async logout() {
    await this.request<{ message: string }>("/auth/logout", {
      method: "POST",
    });
    this.clearTokens();
  }

  async getPublicBills() {
    return this.request<{
      updatedAt: string;
      summary: {
        totalShare: number;
        totalPaid: number;
        totalOutstanding: number;
      };
      members: Array<{
        memberId: string;
        name: string;
        status: "active" | "inactive";
        totalExpenseShare: number;
        amountPaid: number;
        outstandingBalance: number;
        paidExpenses: number;
        unpaidExpenses: number;
      }>;
    }>("/public/bills");
  }

  async getEquipmentPurchases() {
    return this.request<any[]>("/equipment");
  }

  async createEquipmentPurchase(data: any) {
    return this.request<any>("/equipment", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateEquipmentUsage(id: string, quantityUsed: number) {
    return this.request<any>(`/equipment/${id}/usage`, {
      method: "PATCH",
      body: JSON.stringify({ quantityUsed }),
    });
  }

  async deleteEquipmentPurchase(id: string) {
    return this.request<{ message: string }>(`/equipment/${id}`, {
      method: "DELETE",
    });
  }

  async getJoiningFees() {
    return this.request<any[]>("/joining-fees");
  }

  async createJoiningFee(data: any) {
    return this.request<any>("/joining-fees", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async deleteJoiningFee(id: string) {
    return this.request<{ message: string }>(`/joining-fees/${id}`, {
      method: "DELETE",
    });
  }

  async getMembers() {
    return this.request<any[]>("/members");
  }

  async getMember(id: string) {
    return this.request<any>(`/members/${id}`);
  }

  async createMember(data: any) {
    return this.request<any>("/members", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateMember(id: string, data: any) {
    return this.request<any>(`/members/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteMember(id: string) {
    return this.request<{ message: string }>(`/members/${id}`, {
      method: "DELETE",
    });
  }

  async getBookings(params?: { date?: string; startDate?: string; endDate?: string }) {
    const query = new URLSearchParams();
    if (params?.date) query.append("date", params.date);
    if (params?.startDate) query.append("startDate", params.startDate);
    if (params?.endDate) query.append("endDate", params.endDate);
    const queryString = query.toString();
    return this.request<any[]>(`/bookings${queryString ? `?${queryString}` : ""}`);
  }

  async createBooking(data: any) {
    return this.request<any>("/bookings", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateBooking(id: string, data: any) {
    return this.request<any>(`/bookings/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteBooking(id: string) {
    return this.request<{ message: string }>(`/bookings/${id}`, {
      method: "DELETE",
    });
  }

  async getAttendance(params?: { date?: string; startDate?: string; endDate?: string; memberId?: string }) {
    const query = new URLSearchParams();
    if (params?.date) query.append("date", params.date);
    if (params?.startDate) query.append("startDate", params.startDate);
    if (params?.endDate) query.append("endDate", params.endDate);
    if (params?.memberId) query.append("memberId", params.memberId);
    const queryString = query.toString();
    return this.request<any[]>(`/attendance${queryString ? `?${queryString}` : ""}`);
  }

  async getAttendanceByDate(date: string) {
    return this.request<any[]>(`/attendance/date/${date}`);
  }

  async createAttendance(data: any | any[]) {
    return this.request<any | any[]>("/attendance", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getExpenses(params?: { startDate?: string; endDate?: string; category?: string; status?: string }) {
    const query = new URLSearchParams();
    if (params?.startDate) query.append("startDate", params.startDate);
    if (params?.endDate) query.append("endDate", params.endDate);
    if (params?.category) query.append("category", params.category);
    if (params?.status) query.append("status", params.status);
    const queryString = query.toString();
    return this.request<any[]>(`/expenses${queryString ? `?${queryString}` : ""}`);
  }

  async createExpense(data: any) {
    return this.request<any>("/expenses", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateExpense(id: string, data: any) {
    return this.request<any>(`/expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async getExpenseDetails(id: string) {
    return this.request<{ expense: any; shares: any[] }>(`/expenses/${id}/details`);
  }

  async deleteExpense(id: string) {
    return this.request<{ message: string }>(`/expenses/${id}`, {
      method: "DELETE",
    });
  }

  async getReports() {
    return this.request<any[]>("/reports");
  }

  async getReport(id: string) {
    return this.request<any>(`/reports/${id}`);
  }

  async generateReport(data: { type: string; period: { start: string; end: string } }) {
    return this.request<any>("/reports/generate", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async markPaymentPaid(data: { expenseId: string; memberId: string }) {
    return this.request<any>("/payments/mark-paid", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getMemberPayments(memberId: string) {
    return this.request<any>(`/payments/member/${memberId}`);
  }

  async getAllPayments() {
    return this.request<{ memberPayments: any[] }>("/payments/all");
  }

  async getNotifications() {
    return this.request<{ notifications: any[]; unreadCount: number }>("/notifications");
  }

  async getUnreadNotificationCount() {
    return this.request<{ count: number }>("/notifications/unread-count");
  }

  async markNotificationRead(id: string) {
    return this.request<{ message: string; notification: any }>(`/notifications/${id}/read`, {
      method: "PATCH",
    });
  }

  async markAllNotificationsRead() {
    return this.request<{ message: string }>("/notifications/read-all", {
      method: "PATCH",
    });
  }

  async deleteNotification(id: string) {
    return this.request<{ message: string }>(`/notifications/${id}`, {
      method: "DELETE",
    });
  }
}

export const createApiClient = (getAuthToken: () => string | null, clearTokens: () => void) => {
  return new ApiClient(getAuthToken, clearTokens);
};
