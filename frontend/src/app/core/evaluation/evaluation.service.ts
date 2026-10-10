import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export type EvaluationStatus = 'PENDING_SELF' | 'PENDING_MANAGER' | 'COMPLETED';
export type CycleStatus = 'DRAFT' | 'OPEN' | 'CLOSED';

export const EVALUATION_STATUS_LABELS: Record<EvaluationStatus, string> = {
  PENDING_SELF: 'În așteptare autoevaluare',
  PENDING_MANAGER: 'În așteptarea managerului',
  COMPLETED: 'Finalizată',
};

export const CYCLE_STATUS_LABELS: Record<CycleStatus, string> = {
  DRAFT: 'Ciornă',
  OPEN: 'Deschis',
  CLOSED: 'Închis',
};

export const SCALE_MAX = 5;
export const COMMENT_MAX = 1000;

export interface EmployeeRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Criterion {
  key: string;
  name: string;
  weight: number;
}

export interface Cycle {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: CycleStatus;
  criteria: Criterion[];
  scaleMax: number;
  openedAt: string | null;
  closedAt: string | null;
}

export interface ReviewView {
  scores: Record<string, number>;
  comment: string | null;
  submittedAt: string | null;
}

export interface Evaluation {
  id: string;
  cycle: Cycle;
  employee: EmployeeRef;
  reviewer: EmployeeRef | null;
  status: EvaluationStatus;
  locked: boolean;
  self: ReviewView | null;
  manager: ReviewView | null;
  selfScore: number | null;
  finalScore: number | null;
  trend: number | null;
  completedAt: string | null;
}

export interface TeamRow {
  id: string;
  cycleId: string;
  cycleName: string;
  employee: EmployeeRef;
  status: EvaluationStatus;
  locked: boolean;
  selfSubmitted: boolean;
  finalScore: number | null;
}

export interface PageOf<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
}

export interface ProgressRow {
  id: string;
  employee: EmployeeRef;
  reviewer: EmployeeRef | null;
  status: EvaluationStatus;
  locked: boolean;
  finalScore: number | null;
}

export interface Progress {
  cycle: Cycle;
  counts: { pendingSelf: number; pendingManager: number; completed: number; locked: number };
  excludedCount: number;
  excluded: EmployeeRef[];
  items: ProgressRow[];
  page: number;
  size: number;
  totalElements: number;
}

export interface CycleBody {
  name: string;
  startDate: string;
  endDate: string;
  criteria: Criterion[];
}

export interface ReviewBody {
  scores: Record<string, number>;
  comment: string | null;
}

export interface TeamQuery {
  cycleId: string | null;
  status: EvaluationStatus | null;
  page: number;
  size: number;
}

const fmt = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 4.25 => "4,3". */
export function formatScore(value: number): string {
  return fmt.format(value);
}

/** 0.7 => "+0,7"; -0.3 => "-0,3". */
export function formatTrend(value: number): string {
  const text = fmt.format(Math.abs(value));
  return value > 0 ? `+${text}` : value < 0 ? `-${text}` : text;
}

@Injectable({ providedIn: 'root' })
export class EvaluationService {
  private readonly http = inject(HttpClient);

  cycles(page: number, size: number): Observable<PageOf<Cycle>> {
    return this.http.get<PageOf<Cycle>>('/api/evaluation-cycles', {
      params: new HttpParams().set('page', page).set('size', size),
    });
  }

  createCycle(body: CycleBody): Observable<Cycle> {
    return this.http.post<Cycle>('/api/evaluation-cycles', body);
  }

  updateCycle(id: string, body: CycleBody): Observable<Cycle> {
    return this.http.put<Cycle>(`/api/evaluation-cycles/${id}`, body);
  }

  open(id: string): Observable<Cycle> {
    return this.http.post<Cycle>(`/api/evaluation-cycles/${id}/open`, null);
  }

  close(id: string): Observable<Cycle> {
    return this.http.post<Cycle>(`/api/evaluation-cycles/${id}/close`, null);
  }

  progress(id: string, page: number, size: number): Observable<Progress> {
    return this.http.get<Progress>(`/api/evaluation-cycles/${id}/progress`, {
      params: new HttpParams().set('page', page).set('size', size),
    });
  }

  reassign(evaluationId: string, reviewerEmployeeId: string): Observable<Evaluation> {
    return this.http.put<Evaluation>(`/api/evaluations/${evaluationId}/reviewer`, { reviewerEmployeeId });
  }

  mine(): Observable<Evaluation[]> {
    return this.http.get<Evaluation[]>('/api/evaluations/me');
  }

  selfReview(id: string, body: ReviewBody): Observable<Evaluation> {
    return this.http.post<Evaluation>(`/api/evaluations/${id}/self-review`, body);
  }

  team(q: TeamQuery): Observable<PageOf<TeamRow>> {
    let params = new HttpParams().set('page', q.page).set('size', q.size);
    if (q.cycleId) {
      params = params.set('cycleId', q.cycleId);
    }
    if (q.status) {
      params = params.set('status', q.status);
    }
    return this.http.get<PageOf<TeamRow>>('/api/evaluations/team', { params });
  }

  get(id: string): Observable<Evaluation> {
    return this.http.get<Evaluation>(`/api/evaluations/${id}`);
  }

  managerReview(id: string, body: ReviewBody): Observable<Evaluation> {
    return this.http.post<Evaluation>(`/api/evaluations/${id}/manager-review`, body);
  }
}
