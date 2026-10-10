import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

export interface Department {
  id: string;
  name: string;
  parentId: string | null;
  employeeCount: number;
  childCount: number;
}

export interface DepartmentBody {
  name: string;
  parentId: string | null;
}

export interface Position {
  id: string;
  name: string;
  employeeCount: number;
}

export interface PositionBody {
  name: string;
}

export interface DepartmentNode {
  department: Department;
  depth: number;
  /** Calea completă, de forma „Părinte / Copil”. */
  path: string;
}

/** Ordonează departamentele ierarhic (părinte urmat de copii). Nodurile orfane sunt tratate ca rădăcini. */
export function flattenDepartments(list: readonly Department[]): DepartmentNode[] {
  const ids = new Set(list.map((d) => d.id));
  const byParent = new Map<string | null, Department[]>();
  for (const d of list) {
    const key = d.parentId && ids.has(d.parentId) ? d.parentId : null;
    byParent.set(key, [...(byParent.get(key) ?? []), d]);
  }
  const out: DepartmentNode[] = [];
  const seen = new Set<string>();
  const walk = (parent: string | null, depth: number, prefix: string): void => {
    const children = [...(byParent.get(parent) ?? [])].sort((a, b) => a.name.localeCompare(b.name, 'ro'));
    for (const d of children) {
      if (seen.has(d.id)) {
        continue;
      }
      seen.add(d.id);
      const path = prefix ? `${prefix} / ${d.name}` : d.name;
      out.push({ department: d, depth, path });
      walk(d.id, depth + 1, path);
    }
  };
  walk(null, 0, '');
  return out;
}

@Injectable({ providedIn: 'root' })
export class OrgService {
  private readonly http = inject(HttpClient);

  departments(): Observable<Department[]> {
    return this.http.get<Department[]>('/api/departments');
  }

  createDepartment(body: DepartmentBody): Observable<Department> {
    return this.http.post<Department>('/api/departments', body);
  }

  updateDepartment(id: string, body: DepartmentBody): Observable<Department> {
    return this.http.put<Department>(`/api/departments/${id}`, body);
  }

  deleteDepartment(id: string): Observable<void> {
    return this.http.delete<void>(`/api/departments/${id}`);
  }

  positions(): Observable<Position[]> {
    return this.http.get<Position[]>('/api/positions');
  }

  createPosition(body: PositionBody): Observable<Position> {
    return this.http.post<Position>('/api/positions', body);
  }

  updatePosition(id: string, body: PositionBody): Observable<Position> {
    return this.http.put<Position>(`/api/positions/${id}`, body);
  }

  deletePosition(id: string): Observable<void> {
    return this.http.delete<void>(`/api/positions/${id}`);
  }
}
