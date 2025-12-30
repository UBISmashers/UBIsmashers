import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { createApiClient } from '@/lib/api';

interface User {
  id: string;
  email: string;
  role: 'admin' | 'member';
  memberId?: string;
}

interface Member {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'admin' | 'member';
  status: 'active' | 'inactive';
  balance: number;
}

interface AuthContextType {
  user: User | null;
  member: Member | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<{ mustChangePassword?: boolean; userId?: string }>;
  changePassword: (userId: string, currentPassword: string, newPassword: string) => Promise<void>;
  signup: (data: { name: string; email: string; password: string; phone: string; role?: 'admin' | 'member' }) => Promise<void>;
  logout: () => Promise<void>;
  api: ReturnType<typeof createApiClient>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'auth_user';
const MEMBER_KEY = 'auth_member';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getAuthToken = () => localStorage.getItem(TOKEN_KEY);
  const getRefreshToken = () => localStorage.getItem(REFRESH_TOKEN_KEY);
  
  const setTokens = (accessToken: string, refreshToken: string) => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  };

  const clearTokens = () => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(MEMBER_KEY);
    setUser(null);
    setMember(null);
  };

  const api = createApiClient(getAuthToken, getRefreshToken, setTokens, clearTokens);

  useEffect(() => {
    // Check for stored user data on mount
    const storedUser = localStorage.getItem(USER_KEY);
    const storedMember = localStorage.getItem(MEMBER_KEY);
    
    if (storedUser && storedMember) {
      try {
        setUser(JSON.parse(storedUser));
        setMember(JSON.parse(storedMember));
      } catch (error) {
        console.error('Error parsing stored user data:', error);
        clearTokens();
      }
    }
    
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.login({ email, password });
    
    // Check if password change is required
    if (response.mustChangePassword) {
      return { mustChangePassword: true, userId: response.userId! };
    }
    
    // Normal login flow
    if (response.accessToken && response.refreshToken) {
      setTokens(response.accessToken, response.refreshToken);
      setUser(response.user);
      if (response.member) {
        setMember(response.member);
        localStorage.setItem(MEMBER_KEY, JSON.stringify(response.member));
      }
      localStorage.setItem(USER_KEY, JSON.stringify(response.user));
    }
    
    return { mustChangePassword: false };
  };

  const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
    const response = await api.changePassword({ userId, currentPassword, newPassword });
    setTokens(response.accessToken, response.refreshToken);
    setUser(response.user);
    if (response.member) {
      setMember(response.member);
      localStorage.setItem(MEMBER_KEY, JSON.stringify(response.member));
    }
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  };

  const signup = async (data: { name: string; email: string; password: string; phone: string; role?: 'admin' | 'member' }) => {
    const response = await api.signup(data);
    setTokens(response.accessToken, response.refreshToken);
    setUser(response.user);
    localStorage.setItem(USER_KEY, JSON.stringify(response.user));
  };

  const logout = async () => {
    await api.logout();
    clearTokens();
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        member,
        isAuthenticated: !!user,
        isLoading,
        login,
        changePassword,
        signup,
        logout,
        api,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

