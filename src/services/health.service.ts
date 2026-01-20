import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, of } from 'rxjs';
import { catchError, map, startWith, switchMap, tap } from 'rxjs/operators';

export interface HealthStatus {
  status: 'ok' | 'error';
  database: 'connected' | 'disconnected';
  latency?: string;
  timestamp: string;
  uptime?: number;
  error?: string;
}

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  private apiUrl = 'https://solenoidally-polygenistic-billi.ngrok-free.dev/api';
  private http = inject(HttpClient);

  // Signal to store current health state
  public systemHealth = signal<HealthStatus | null>(null);
  public isOnline = signal<boolean>(true);

  constructor() {
    // Start polling every 2 minutes
    this.startHeartbeat();
  }

  private startHeartbeat() {
    interval(1000 * 60 * 2).pipe(
      startWith(0),
      switchMap(() => this.checkHealth())
    ).subscribe();
  }

  public checkHealth(): Observable<HealthStatus> {
    return this.http.get<HealthStatus>(`${this.apiUrl}/health`, {
      headers: { 'ngrok-skip-browser-warning': 'true' }
    }).pipe(
      tap(status => {
        this.systemHealth.set(status);
        this.isOnline.set(status.status === 'ok');
      }),
      catchError(err => {
        const errorStatus: HealthStatus = {
          status: 'error',
          database: 'disconnected',
          timestamp: new Date().toISOString(),
          error: err.message
        };
        this.systemHealth.set(errorStatus);
        this.isOnline.set(false);
        return of(errorStatus);
      })
    );
  }
}
