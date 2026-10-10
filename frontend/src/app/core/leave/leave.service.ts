import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type LeaveType = 'ODIHNA' | 'MEDICAL' | 'FARA_PLATA' | 'EVENIMENT_SPECIAL';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  ODIHNA: 'Concediu de odihnă',
  MEDICAL: 'Concediu medical',
  FARA_PLATA: 'Concediu fără plată',
  EVENIMENT_SPECIAL: 'Eveniment special',
};

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  PENDING: 'În așteptare',
  APPROVED: 'Aprobată',
  REJECTED: 'Respinsă',
  CANCELLED: 'Anulată',
};

export interface LeaveRequest {
  id: string;
  employee: { id: string; firstName: string; lastName: string };
  type: LeaveType;
  startDate: string;
  endDate: string;
  workingDays: number;
  note: string | null;
  status: LeaveStatus;
  createdAt: string;
  decidedBy: { name: string } | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  cancelledAt: string | null;
}

export interface LeavePage {
  items: LeaveRequest[];
  page: number;
  size: number;
  totalElements: number;
}

export interface LeaveBalance {
  year: number;
  entitled: number;
  carriedOver: number;
  used: number;
  pending: number;
  available: number;
}

export interface CreateLeaveRequest {
  type: LeaveType;
  startDate: string;
  endDate: string;
  note: string | null;
}

export interface LeaveQuery {
  status: LeaveStatus | null;
  year: number | null;
  page: number;
  size: number;
}

/** Extrage mesajul `detail` dintr-un ProblemDetail; altfel un mesaj generic în funcție de status. */
export function problemDetail(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const detail = (err.error as { detail?: unknown } | null)?.detail;
    if (typeof detail === 'string' && detail.trim()) {
      return detail;
    }
    if (err.status === 0) {
      return 'Nu ne-am putut conecta la server. Verifică conexiunea și încearcă din nou.';
    }
    if (err.status === 403) {
      return 'Nu ai dreptul să faci această operațiune.';
    }
    if (err.status === 404) {
      return 'Cererea nu a fost găsită.';
    }
  }
  return 'A apărut o eroare neașteptată. Încearcă din nou.';
}

@Injectable({ providedIn: 'root' })
export class LeaveService {
  private readonly http = inject(HttpClient);

  mine(q: LeaveQuery): Observable<LeavePage> {
    return this.http.get<LeavePage>('/api/leave-requests/mine', { params: this.params(q, true) });
  }

  team(q: LeaveQuery): Observable<LeavePage> {
    return this.http.get<LeavePage>('/api/leave-requests/team', { params: this.params(q, false) });
  }

  all(q: LeaveQuery): Observable<LeavePage> {
    return this.http.get<LeavePage>('/api/leave-requests', { params: this.params(q, true) });
  }

  balance(year: number): Observable<LeaveBalance> {
    return this.http.get<LeaveBalance>('/api/leave/balance', { params: new HttpParams().set('year', year) });
  }

  workingDays(start: string, end: string): Observable<{ workingDays: number }> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http.get<{ workingDays: number }>('/api/leave/working-days', { params });
  }

  create(body: CreateLeaveRequest): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>('/api/leave-requests', body);
  }

  cancel(id: string): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(`/api/leave-requests/${id}/cancel`, null);
  }

  approve(id: string): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(`/api/leave-requests/${id}/approve`, null);
  }

  reject(id: string, reason: string): Observable<LeaveRequest> {
    return this.http.post<LeaveRequest>(`/api/leave-requests/${id}/reject`, { reason });
  }

  private params(q: LeaveQuery, withYear: boolean): HttpParams {
    let params = new HttpParams().set('page', q.page).set('size', q.size);
    if (q.status) {
      params = params.set('status', q.status);
    }
    if (withYear && q.year !== null) {
      params = params.set('year', q.year);
    }
    return params;
  }
}
