import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, expand, map, reduce, EMPTY } from 'rxjs';

export interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  workEmail: string | null;
  jobTitle: string | null;
  department: string | null;
  hireDate: string | null;
  userId: string | null;
  managerId: string | null;
  departmentId: string | null;
  positionId: string | null;
}

export interface EmployeePage {
  items: Employee[];
  page: number;
  size: number;
  totalElements: number;
}

export interface EmployeeBody {
  firstName: string;
  lastName: string;
  workEmail: string | null;
  positionId: string | null;
  departmentId: string | null;
  hireDate: string | null;
}

export interface LeaveBalance {
  year: number;
  entitled: number;
  carriedOver: number;
  used: number;
  pending: number;
  available: number;
}

const MAX_PAGE = 100;
const MAX_PAGES = 50;

@Injectable({ providedIn: 'root' })
export class EmployeesService {
  private readonly http = inject(HttpClient);

  page(page: number, size: number): Observable<EmployeePage> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<EmployeePage>('/api/employees', { params });
  }

  /** Toți angajații, pagină cu pagină (backend-ul plafonează la 100 pe pagină). */
  all(): Observable<Employee[]> {
    return this.page(0, MAX_PAGE).pipe(
      expand((res) =>
        (res.page + 1) * res.size < res.totalElements && res.page + 1 < MAX_PAGES
          ? this.page(res.page + 1, MAX_PAGE)
          : EMPTY,
      ),
      map((res) => res.items),
      reduce((acc, items) => acc.concat(items), [] as Employee[]),
    );
  }

  create(body: EmployeeBody): Observable<Employee> {
    return this.http.post<Employee>('/api/employees', body);
  }

  update(id: string, body: EmployeeBody): Observable<Employee> {
    return this.http.put<Employee>(`/api/employees/${id}`, body);
  }

  setAccount(id: string, userId: string | null): Observable<Employee> {
    return this.http.put<Employee>(`/api/employees/${id}/account`, { userId });
  }

  setManager(id: string, managerId: string | null): Observable<Employee> {
    return this.http.put<Employee>(`/api/employees/${id}/manager`, { managerId });
  }

  balance(id: string, year: number): Observable<LeaveBalance> {
    return this.http.get<LeaveBalance>(`/api/employees/${id}/leave-balances/${year}`);
  }

  setBalance(id: string, year: number, entitledDays: number, carriedOverDays: number): Observable<LeaveBalance> {
    return this.http.put<LeaveBalance>(`/api/employees/${id}/leave-balances/${year}`, { entitledDays, carriedOverDays });
  }
}
