export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface MeResponse {
  user: { id: string; email: string };
  company: { id: string; name: string; code: string };
  permissions: string[];
  employee: EmployeeInfo | null;
  hasDirectReports: boolean;
}

export interface EmployeeInfo {
  id: string;
  firstName: string;
  lastName: string;
  managerId: string | null;
}

export interface TokenPayload {
  exp?: number;
  perms?: string[];
  cid?: string;
  typ?: string;
}

export interface LoginRequest {
  companyCode: string;
  email: string;
  password: string;
}
