import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface RoleRef {
  id: string;
  name: string;
}

export interface AdminUser {
  id: string;
  email: string;
  enabled: boolean;
  roles: RoleRef[];
  self: boolean;
  manageable: boolean;
}

export interface AdminRole {
  id: string;
  name: string;
  system: boolean;
  permissions: string[];
  userCount: number;
  assignable: boolean;
  editable: boolean;
}

export interface PermissionInfo {
  code: string;
  description: string;
}

export interface CreateUserBody {
  email: string;
  password: string;
  roleIds: string[];
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly http = inject(HttpClient);

  users(): Observable<AdminUser[]> {
    return this.http.get<AdminUser[]>('/api/users');
  }

  createUser(body: CreateUserBody): Observable<AdminUser> {
    return this.http.post<AdminUser>('/api/users', body);
  }

  setUserRoles(id: string, roleIds: string[]): Observable<AdminUser> {
    return this.http.put<AdminUser>(`/api/users/${id}/roles`, { roleIds });
  }

  setUserEnabled(id: string, enabled: boolean): Observable<AdminUser> {
    return this.http.put<AdminUser>(`/api/users/${id}/enabled`, { enabled });
  }

  setUserPassword(id: string, password: string): Observable<void> {
    return this.http.put<void>(`/api/users/${id}/password`, { password });
  }

  roles(): Observable<AdminRole[]> {
    return this.http.get<AdminRole[]>('/api/roles');
  }

  createRole(name: string, permissions: string[]): Observable<AdminRole> {
    return this.http.post<AdminRole>('/api/roles', { name, permissions });
  }

  renameRole(id: string, name: string): Observable<AdminRole> {
    return this.http.put<AdminRole>(`/api/roles/${id}`, { name });
  }

  setRolePermissions(id: string, permissions: string[]): Observable<AdminRole> {
    return this.http.put<AdminRole>(`/api/roles/${id}/permissions`, { permissions });
  }

  deleteRole(id: string): Observable<void> {
    return this.http.delete<void>(`/api/roles/${id}`);
  }

  permissions(): Observable<PermissionInfo[]> {
    return this.http.get<PermissionInfo[]>('/api/permissions');
  }
}
