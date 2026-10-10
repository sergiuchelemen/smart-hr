import { HttpClient, HttpEvent, HttpEventType, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, filter, map } from 'rxjs';

export type DocumentVisibility = 'ALL' | 'MANAGERS' | 'HR';
export type DocumentContentType = 'application/pdf' | 'text/plain';

export const VISIBILITY_LABELS: Record<DocumentVisibility, string> = {
  ALL: 'Toți angajații',
  MANAGERS: 'Manageri',
  HR: 'Resurse umane',
};

export const TYPE_LABELS: Record<DocumentContentType, string> = {
  'application/pdf': 'PDF',
  'text/plain': 'TXT',
};

export const MAX_FILE_BYTES = 10 * 1024 * 1024;

export interface LibraryDocument {
  id: string;
  title: string;
  description: string | null;
  category: string;
  visibility: DocumentVisibility;
  fileName: string;
  contentType: DocumentContentType;
  sizeBytes: number;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentPage {
  items: LibraryDocument[];
  page: number;
  size: number;
  totalElements: number;
}

export interface CategoryCount {
  category: string;
  count: number;
}

export interface DocumentMeta {
  title: string;
  description: string | null;
  category: string;
  visibility: DocumentVisibility;
}

export interface DocumentQuery {
  q: string;
  category: string | null;
  page: number;
  size: number;
}

/** Rezultat de încărcare: progres (0-100) sau documentul salvat. */
export type UploadEvent = { progress: number } | { document: LibraryDocument };

const sizeFormat = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 });

/** 1258291 => "1,2 MB". */
export function formatSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${sizeFormat.format(bytes / 1024)} KB`;
  }
  return `${sizeFormat.format(bytes / (1024 * 1024))} MB`;
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  private readonly http = inject(HttpClient);

  list(q: DocumentQuery): Observable<DocumentPage> {
    let params = new HttpParams().set('page', q.page).set('size', q.size);
    if (q.q.trim()) {
      params = params.set('q', q.q.trim());
    }
    if (q.category) {
      params = params.set('category', q.category);
    }
    return this.http.get<DocumentPage>('/api/documents', { params });
  }

  categories(): Observable<CategoryCount[]> {
    return this.http.get<CategoryCount[]>('/api/documents/categories');
  }

  get(id: string): Observable<LibraryDocument> {
    return this.http.get<LibraryDocument>(`/api/documents/${id}`);
  }

  /** Conținutul pentru previzualizare, ca blob (trece prin HttpClient ca să primească tokenul Bearer). */
  content(id: string): Observable<Blob> {
    return this.http.get(`/api/documents/${id}/content`, { responseType: 'blob' });
  }

  download(id: string): Observable<Blob> {
    return this.http.get(`/api/documents/${id}/download`, { responseType: 'blob' });
  }

  upload(file: File, meta: DocumentMeta): Observable<UploadEvent> {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('meta', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    return this.track(this.http.post<LibraryDocument>('/api/documents', form, { observe: 'events', reportProgress: true }));
  }

  replaceFile(id: string, file: File): Observable<UploadEvent> {
    const form = new FormData();
    form.append('file', file, file.name);
    return this.track(this.http.put<LibraryDocument>(`/api/documents/${id}/file`, form, { observe: 'events', reportProgress: true }));
  }

  update(id: string, meta: DocumentMeta): Observable<LibraryDocument> {
    return this.http.put<LibraryDocument>(`/api/documents/${id}`, meta);
  }

  remove(id: string): Observable<void> {
    return this.http.delete<void>(`/api/documents/${id}`);
  }

  private track(events: Observable<HttpEvent<LibraryDocument>>): Observable<UploadEvent> {
    return events.pipe(
      map((e): UploadEvent | null => {
        if (e.type === HttpEventType.UploadProgress) {
          return { progress: e.total ? Math.round((100 * e.loaded) / e.total) : 0 };
        }
        if (e.type === HttpEventType.Response && e.body) {
          return { document: e.body };
        }
        return null;
      }),
      filter((e): e is UploadEvent => e !== null),
    );
  }
}
