import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Get the session token from localStorage
  const sessionToken = localStorage.getItem('alpr_session_token');

  // Clone the request and add the Authorization header if token exists
  if (sessionToken) {
    const authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${sessionToken}`
      }
    });
    return next(authReq);
  }

  // If no token, proceed with the original request
  return next(req);
};
