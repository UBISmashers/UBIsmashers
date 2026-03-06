import type { PublicTournamentPayload, Tournament } from "@/types/tournament";

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

  async getPublicBills(
    period: "all" | "custom" | "this_month" | "last_week" | "last_month" | "last_6_months" | "last_year" = "all",
    customRange?: { customStartDate: string; customEndDate: string }
  ) {
    const query = new URLSearchParams();
    if (period && period !== "all") query.append("period", period);
    if (period === "custom" && customRange) {
      query.append("customStartDate", customRange.customStartDate);
      query.append("customEndDate", customRange.customEndDate);
    }
    const queryString = query.toString();
    return this.request<{
      updatedAt: string;
      period: "all" | "custom" | "this_month" | "last_week" | "last_month" | "last_6_months" | "last_year";
      summary: {
        totalShare: number;
        totalPaid: number;
        totalOutstanding: number;
        totalAdvancePaid: number;
        totalAdvanceUsed: number;
        totalAdvanceRemaining: number;
      };
      members: Array<{
        memberId: string;
        name: string;
        status: "active" | "inactive";
        totalExpenseShare: number;
        amountPaid: number;
        outstandingBalance: number;
        advanceTotalPaid: number;
        advanceUsed: number;
        advanceRemaining: number;
        advanceStatus: "available" | "partially_used" | "fully_used" | "no_advance";
        paidExpenses: number;
        unpaidExpenses: number;
      }>;
      joiningFees: Array<{
        _id: string;
        amount: number;
        remainingAmount: number;
        usedAmount: number;
        status: "available" | "partially_used" | "fully_used";
      }>;
      equipment: any[];
      courtAdvanceBookings: any[];
      sessionHistory: any[];
    }>(`/public/bills${queryString ? `?${queryString}` : ""}`);
  }

  async submitJoiningRequest(data: {
    name: string;
    mobileNumber: string;
    address: string;
    availability: "weekly_twice" | "only_weekends" | "weekdays_only" | "flexible";
  }) {
    return this.request<{ message: string; request: any }>("/joining-requests", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async getJoiningRequests() {
    return this.request<any[]>("/joining-requests");
  }

  async updateJoiningRequestStatus(id: string, status: "new" | "reviewed") {
    return this.request<{ message: string; request: any }>(`/joining-requests/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
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

  async updateEquipmentPurchase(id: string, data: any) {
    return this.request<any>(`/equipment/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteEquipmentPurchase(id: string) {
    return this.request<{ message: string }>(`/equipment/${id}`, {
      method: "DELETE",
    });
  }

  async getCourtAdvanceBookings() {
    return this.request<any[]>("/equipment/court-advance");
  }

  async createCourtAdvanceBooking(data: any) {
    return this.request<any>("/equipment/court-advance", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateCourtAdvanceBooking(id: string, data: any) {
    return this.request<any>(`/equipment/court-advance/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteCourtAdvanceBooking(id: string) {
    return this.request<{ message: string }>(`/equipment/court-advance/${id}`, {
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

  async updatePaymentStatus(data: { expenseId: string; memberId: string; paidStatus: boolean }) {
    return this.request<any>("/payments/update-status", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async markAllMemberPaymentsPaid(memberId: string) {
    return this.request<{ message: string; updatedCount: number }>("/payments/mark-member-paid", {
      method: "POST",
      body: JSON.stringify({ memberId }),
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

  async getTournamentConfig() {
    return this.request<{ enabled: boolean }>("/tournaments/config");
  }

  async updateTournamentConfig(enabled: boolean) {
    return this.request<{ enabled: boolean }>("/tournaments/config", {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    });
  }

  async getTournaments() {
    return this.request<Tournament[]>("/tournaments");
  }

  async getTournament(id: string) {
    return this.request<Tournament>(`/tournaments/${id}`);
  }

  async createTournament(data: {
    name: string;
    date: string;
    location: string;
    type: "singles" | "doubles";
    entryFee?: number;
    status?: "upcoming" | "ongoing" | "completed";
    isVisibleToMembers?: boolean;
  }) {
    return this.request<Tournament>("/tournaments", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async updateTournament(id: string, data: Partial<{
    name: string;
    date: string;
    location: string;
    type: "singles" | "doubles";
    entryFee: number;
    status: "upcoming" | "ongoing" | "completed";
    isVisibleToMembers: boolean;
  }>) {
    return this.request<Tournament>(`/tournaments/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  }

  async deleteTournament(id: string) {
    return this.request<{ message: string }>(`/tournaments/${id}`, {
      method: "DELETE",
    });
  }

  async addTournamentTeam(id: string, data: { name?: string; players: string[] }) {
    return this.request<Tournament>(`/tournaments/${id}/teams`, {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  async removeTournamentTeam(id: string, teamId: string) {
    return this.request<Tournament>(`/tournaments/${id}/teams/${teamId}`, {
      method: "DELETE",
    });
  }

  async generateTournamentBracket(id: string) {
    return this.request<Tournament>(`/tournaments/${id}/generate-bracket`, {
      method: "POST",
    });
  }

  async updateTournamentMatchScore(id: string, matchId: string, data: { scoreA: number; scoreB: number }) {
    return this.request<Tournament>(`/tournaments/${id}/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    });
  }

  async declareTournamentWinner(id: string, teamId: string) {
    return this.request<Tournament>(`/tournaments/${id}/declare-winner`, {
      method: "POST",
      body: JSON.stringify({ teamId }),
    });
  }

  async getPublicTournamentConfig() {
    return this.request<{ enabled: boolean }>("/public/tournaments/config");
  }

  async getPublicTournaments() {
    return this.request<PublicTournamentPayload>("/public/tournaments");
  }

  async getPublicTournamentById(id: string) {
    return this.request<Tournament>(`/public/tournaments/${id}`);
  }
}

export const createApiClient = (getAuthToken: () => string | null, clearTokens: () => void) => {
  return new ApiClient(getAuthToken, clearTokens);
};
