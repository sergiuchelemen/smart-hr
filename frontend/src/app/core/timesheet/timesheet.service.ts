import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type EntryType = 'LUCRAT' | 'TELEMUNCA' | 'ABSENT';
export type TimesheetStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
export type BlockedKind = 'CONCEDIU' | 'SARBATOARE';

export const ENTRY_TYPE_LABELS: Record<EntryType, string> = {
  LUCRAT: 'Lucrat',
  TELEMUNCA: 'Telemuncă',
  ABSENT: 'Absent',
};

export const BLOCKED_LABELS: Record<BlockedKind, string> = {
  CONCEDIU: 'Concediu',
  SARBATOARE: 'Sărbătoare',
};

export const TIMESHEET_STATUS_LABELS: Record<TimesheetStatus, string> = {
  DRAFT: 'Ciornă',
  SUBMITTED: 'Trimis spre aprobare',
  APPROVED: 'Aprobat',
  REJECTED: 'Respins',
};

export interface EmployeeRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TimesheetDay {
  date: string;
  minutes: number | null;
  type: EntryType | null;
  note: string | null;
  blocked: BlockedKind | null;
}

export interface TimesheetSummary {
  workedMinutes: number;
  normMinutes: number;
  leaveDays: number;
  holidayDays: number;
  absentDays: number;
}

export interface TimesheetMonth {
  month: string;
  employee: EmployeeRef;
  status: TimesheetStatus;
  submittedAt: string | null;
  decidedAt: string | null;
  rejectionReason: string | null;
  approvedMinutes: number | null;
  days: TimesheetDay[];
  summary: TimesheetSummary;
}

export interface EntryInput {
  date: string;
  minutes: number;
  type: EntryType;
  note: string | null;
}

export interface TeamRow {
  employee: EmployeeRef;
  status: TimesheetStatus;
  summary: TimesheetSummary;
}

export interface TeamPage {
  items: TeamRow[];
  page: number;
  size: number;
  totalElements: number;
}

export interface TeamQuery {
  month: string;
  status: TimesheetStatus | null;
  page: number;
  size: number;
}

/** "450" => "7h 30m"; "480" => "8h"; "0" => "0h". */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h` : h === 0 ? `${m}m` : `${h}h ${m}m`;
}

@Injectable({ providedIn: 'root' })
export class TimesheetService {
  private readonly http = inject(HttpClient);

  mine(month: string): Observable<TimesheetMonth> {
    return this.http.get<TimesheetMonth>('/api/timesheet/me', { params: new HttpParams().set('month', month) });
  }

  save(entries: EntryInput[]): Observable<{ entries: TimesheetDay[] }> {
    return this.http.put<{ entries: TimesheetDay[] }>('/api/timesheet/me/entries', { entries });
  }

  deleteDay(date: string): Observable<void> {
    return this.http.delete<void>(`/api/timesheet/me/entries/${date}`);
  }

  submit(month: string): Observable<TimesheetMonth> {
    return this.http.post<TimesheetMonth>(`/api/timesheet/me/${month}/submit`, null);
  }

  team(q: TeamQuery): Observable<TeamPage> {
    return this.http.get<TeamPage>('/api/timesheet/team', { params: this.params(q) });
  }

  all(q: TeamQuery): Observable<TeamPage> {
    return this.http.get<TeamPage>('/api/timesheet/all', { params: this.params(q) });
  }

  employee(employeeId: string, month: string): Observable<TimesheetMonth> {
    return this.http.get<TimesheetMonth>(`/api/timesheet/employees/${employeeId}`, {
      params: new HttpParams().set('month', month),
    });
  }

  approve(employeeId: string, month: string): Observable<TimesheetMonth> {
    return this.http.post<TimesheetMonth>(`/api/timesheet/employees/${employeeId}/${month}/approve`, null);
  }

  reject(employeeId: string, month: string, reason: string): Observable<TimesheetMonth> {
    return this.http.post<TimesheetMonth>(`/api/timesheet/employees/${employeeId}/${month}/reject`, { reason });
  }

  private params(q: TeamQuery): HttpParams {
    let params = new HttpParams().set('month', q.month).set('page', q.page).set('size', q.size);
    if (q.status) {
      params = params.set('status', q.status);
    }
    return params;
  }
}
