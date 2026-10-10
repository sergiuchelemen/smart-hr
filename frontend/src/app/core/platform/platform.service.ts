import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface PlatformCompany {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  enabled: boolean;
}

export interface PlatformCompanyDetail extends PlatformCompany {
  usersTotal: number;
  usersActive: number;
  adminsActive: number;
}

export interface CreateCompanyRequest {
  name: string;
  code: string;
  adminEmail: string;
  adminPassword: string;
}

@Injectable({ providedIn: 'root' })
export class PlatformService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/platform/companies';

  companies(): Observable<PlatformCompany[]> {
    return this.http.get<PlatformCompany[]>(this.base);
  }

  company(id: string): Observable<PlatformCompanyDetail> {
    return this.http.get<PlatformCompanyDetail>(`${this.base}/${encodeURIComponent(id)}`);
  }

  createCompany(request: CreateCompanyRequest): Observable<PlatformCompany> {
    return this.http.post<PlatformCompany>(this.base, request);
  }

  setEnabled(id: string, enabled: boolean): Observable<PlatformCompanyDetail> {
    return this.http.put<PlatformCompanyDetail>(`${this.base}/${encodeURIComponent(id)}/enabled`, { enabled });
  }

  addAdmin(id: string, request: { email: string; password: string }): Observable<{ id: string }> {
    return this.http.post<{ id: string }>(`${this.base}/${encodeURIComponent(id)}/admins`, request);
  }
}
