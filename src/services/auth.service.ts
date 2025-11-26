import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

export interface User {
  id: string;
  email: string;
  name?: string;
}

export interface AuthResponse {
  success: boolean;
  sessionToken?: string;
  user?: User;
  message?: string;
  error?: string;
  requiresSignup?: boolean;
}

export interface CheckUserResponse {
  exists: boolean;
  user?: User;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3001/api';
  private sessionTokenKey = 'alpr_session_token';
  private userSubject = new BehaviorSubject<User | null>(this.getStoredUser());

  public user$ = this.userSubject.asObservable();
  public isAuthenticated = signal(!!this.getSessionToken());

  constructor(private http: HttpClient) {
    // Check session validity on initialization
    if (this.getSessionToken()) {
      this.validateSession().subscribe({
        next: () => this.isAuthenticated.set(true),
        error: () => {
          this.clearSession();
          this.isAuthenticated.set(false);
        }
      });
    }
  }

  private getHeaders(): HttpHeaders {
    const token = this.getSessionToken();
    if (token) {
      return new HttpHeaders({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      });
    }
    return new HttpHeaders({ 'Content-Type': 'application/json' });
  }

  private getSessionToken(): string | null {
    return localStorage.getItem(this.sessionTokenKey);
  }

  private setSessionToken(token: string): void {
    localStorage.setItem(this.sessionTokenKey, token);
  }

  private clearSession(): void {
    localStorage.removeItem(this.sessionTokenKey);
    localStorage.removeItem('alpr_user');
    this.userSubject.next(null);
    this.isAuthenticated.set(false);
  }

  private getStoredUser(): User | null {
    const userData = localStorage.getItem('alpr_user');
    return userData ? JSON.parse(userData) : null;
  }

  private storeUser(user: User): void {
    localStorage.setItem('alpr_user', JSON.stringify(user));
    this.userSubject.next(user);
  }

  checkUser(email: string): Observable<CheckUserResponse> {
    return this.http.post<CheckUserResponse>(`${this.apiUrl}/auth/check-user`, { email });
  }

  sendOTP(email: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/send-otp`, { email });
  }

  verifyOTP(email: string, otp: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/verify-otp`, { email, otp }).pipe(
      tap(response => {
        if (response.success && response.sessionToken && response.user) {
          this.setSessionToken(response.sessionToken);
          this.storeUser(response.user);
          this.isAuthenticated.set(true);
        }
      })
    );
  }

  signup(email: string, name: string, otp: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/signup`, { email, name, otp }).pipe(
      tap(response => {
        if (response.success && response.sessionToken && response.user) {
          this.setSessionToken(response.sessionToken);
          this.storeUser(response.user);
          this.isAuthenticated.set(true);
        }
      })
    );
  }

  validateSession(): Observable<{ user: User }> {
    return this.http.get<{ user: User }>(`${this.apiUrl}/auth/session`, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => {
        if (response.user) {
          this.storeUser(response.user);
          this.isAuthenticated.set(true);
        }
      })
    );
  }

  logout(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/logout`, {}, {
      headers: this.getHeaders()
    }).pipe(
      tap(() => {
        this.clearSession();
      })
    );
  }

  getCurrentUser(): User | null {
    return this.userSubject.value;
  }
}
