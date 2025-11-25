import '@angular/compiler';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { AppComponent, routes } from './src/app.component';
import { provideZonelessChangeDetection } from '@angular/core';
import { authInterceptor } from './src/interceptors/auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideZonelessChangeDetection(),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideRouter(routes)
  ]
}).catch(err => console.error(err));


// AI Studio always uses an `index.tsx` file for all project types.
