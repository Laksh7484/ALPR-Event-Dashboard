import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

type LoginStep = 'email' | 'otp' | 'signup';
type Mode = 'login' | 'signup';

@Component({
  selector: 'app-login',
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  email = signal('');
  otp = signal('');
  name = signal('');
  step = signal<LoginStep>('email');
  mode = signal<Mode>('login');
  loading = signal(false);
  error = signal('');
  success = signal('');
  otpSent = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) { }

  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async onEmailSubmit() {
    this.error.set('');
    this.success.set('');

    if (!this.isValidEmail(this.email())) {
      this.error.set('Please enter a valid email address');
      return;
    }

    this.loading.set(true);

    try {
      // Check if user exists
      const checkResult = await this.authService.checkUser(this.email()).toPromise();

      if (checkResult?.exists) {
        this.mode.set('login');
      } else {
        this.mode.set('signup');
      }

      // Send OTP
      const otpResult = await this.authService.sendOTP(this.email()).toPromise();

      if (otpResult?.success) {
        this.success.set('OTP sent to your email!');
        this.step.set('otp');
        this.otpSent.set(true);
      } else {
        this.error.set(otpResult?.error || 'Failed to send OTP');
      }
    } catch (err: any) {
      this.error.set(err?.error?.error || 'An error occurred. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async onOTPSubmit() {
    this.error.set('');
    this.success.set('');

    if (!this.otp() || this.otp().length !== 6) {
      this.error.set('Please enter a valid 6-digit OTP');
      return;
    }

    this.loading.set(true);

    try {
      if (this.mode() === 'signup') {
        // Signup flow
        if (!this.name() || this.name().trim() === '') {
          this.error.set('Please enter your name');
          this.loading.set(false);
          return;
        }

        const result = await this.authService.signup(
          this.email(),
          this.name(),
          this.otp()
        ).toPromise();

        if (result?.success) {
          this.success.set('Account created successfully!');
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 500);
        } else {
          this.error.set(result?.error || 'Failed to create account');
        }
      } else {
        // Login flow
        const result = await this.authService.verifyOTP(
          this.email(),
          this.otp()
        ).toPromise();

        if (result?.success) {
          this.success.set('Login successful!');
          setTimeout(() => {
            this.router.navigate(['/dashboard']);
          }, 500);
        } else if (result?.requiresSignup) {
          this.mode.set('signup');
          this.error.set('Please complete signup');
        } else {
          this.error.set(result?.error || 'Invalid OTP');
        }
      }
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Verification failed. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  async resendOTP() {
    this.error.set('');
    this.success.set('');
    this.loading.set(true);

    try {
      const result = await this.authService.sendOTP(this.email()).toPromise();

      if (result?.success) {
        this.success.set('New OTP sent to your email!');
      } else {
        this.error.set(result?.error || 'Failed to resend OTP');
      }
    } catch (err: any) {
      this.error.set(err?.error?.error || 'Failed to resend OTP');
    } finally {
      this.loading.set(false);
    }
  }

  goBack() {
    this.step.set('email');
    this.otp.set('');
    this.name.set('');
    this.error.set('');
    this.success.set('');
    this.otpSent.set(false);
  }
}
