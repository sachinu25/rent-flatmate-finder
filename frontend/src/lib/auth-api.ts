import { api } from "./api";
import type { TenantProfile, User } from "./types";

export type UserData = User;

export interface AuthResponse {
  accessToken: string;
  user: User;
}

export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "TENANT" | "OWNER";
  phone?: string;
}

export const registerUser = (data: RegisterRequest) => api.post<AuthResponse>("/auth/register", data);
export const loginUser = (data: { email: string; password: string }) => api.post<AuthResponse>("/auth/login", data);
export const logoutUser = () => api.post("/auth/logout");
export const getMe = () => api.get<{ user: User & { tenantProfile: TenantProfile | null; createdAt: string } }>("/auth/me");
export const updateMe = (data: { firstName?: string; lastName?: string; phone?: string | null }) =>
  api.patch<{ user: User }>("/auth/me", data);
export const changePassword = (data: { currentPassword: string; newPassword: string }) =>
  api.post<{ accessToken: string }>("/auth/change-password", data);
