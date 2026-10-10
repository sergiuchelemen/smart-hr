import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { EvaluationStatus } from '../evaluation/evaluation.service';
import { TimesheetStatus } from '../timesheet/timesheet.service';

export interface Dashboard {
  me: { firstName: string | null; companyName: string | null } | null;
  leaveBalance: {
    entitled: number;
    carriedOver: number;
    used: number;
    pending: number;
    available: number;
    myPendingRequests: number;
    nextApprovedLeave: { startDate: string; endDate: string; workingDays: number } | null;
  } | null;
  timesheet: { month: string; status: TimesheetStatus; workedMinutes: number; normMinutes: number } | null;
  evaluation: { cycleName: string; status: EvaluationStatus } | null;
  approvals: { leavePending: number | null; timesheetSubmitted: number | null; evaluationsPending: number | null } | null;
  absences: { items: { employeeName: string; from: string; to: string }[]; onLeaveToday: number } | null;
  headcount: { total: number; hiredLast90Days: number; byDepartment: { name: string; count: number }[] } | null;
  leaveByMonth: { month: number; days: number }[] | null;
  upcomingHolidays: { date: string; name: string }[] | null;
  recentDocuments: { id: string; title: string; category: string; updatedAt: string }[] | null;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);

  get(): Observable<Dashboard> {
    return this.http.get<Dashboard>('/api/dashboard');
  }
}
