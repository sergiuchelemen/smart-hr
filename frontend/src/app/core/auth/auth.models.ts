export type Permission = 'EMPLOYEE_READ' | 'EMPLOYEE_WRITE' | 'USER_READ' | 'USER_MANAGE' | 'ROLE_MANAGE';

export interface TokenResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
}

export interface MeResponse {
  user: { id: string; email: string };
  company: { id: string; name: string; code: string };
  permissions: string[];
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
