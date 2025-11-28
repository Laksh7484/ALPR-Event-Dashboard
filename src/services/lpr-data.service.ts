import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { CacheService } from './cache.service';

const API_BASE_URL = 'https://solenoidally-polygenistic-billi.ngrok-free.dev/api';

export interface Kpi {
  title: string;
  value: string;
  icon: string;
  color: string;
}

export interface DetectionsResponse {
  detections: Detection[];
  total: number;
}

export interface Detection {
  id: string;
  image: {
    height: number;
    id: string;
    width: number;
  };
  location: {
    lat: number;
    lon: number;
  };
  plate: {
    code: string;
    region: {
      height: number;
      width: number;
      x: number;
      y: number;
    };
    tag: string;
  };
  source: {
    id: string;
    name: string;
    type: string;
  };
  timeOfDay: number;
  timestamp: number;
  type: string;
  vehicle: {
    bearing: number;
    color: {
      code: string;
    };
    occlusion: number;
    make?: {
      code: string;
      name: string;
    };
    orientation: {
      code: string;
      name: string;
    };
    type: {
      code: string;
      name: string;
    };
  };
  version: string;
}

@Injectable({ providedIn: 'root' })
export class LprDataService {
  constructor(private http: HttpClient, private cacheService: CacheService) { }

  private getHeaders(): HttpHeaders {
    const token = localStorage.getItem('alpr_session_token');
    const headers: any = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return new HttpHeaders(headers);
  }

  getKpis(): Observable<Kpi[]> {
    const cacheKey = 'kpis';
    const cached = this.cacheService.get<Kpi[]>(cacheKey);

    if (cached) {
      console.log('Using cached KPIs');
      return of(cached);
    }

    console.log('Fetching KPIs from API');
    return this.http.get<Kpi[]>(`${API_BASE_URL}/kpis`, { headers: this.getHeaders() }).pipe(
      tap(data => this.cacheService.set(cacheKey, data, 30))
    );
  }

  getDetections(page: number, limit: number, cameraName?: string, carMake?: string, startTimestamp?: string, endTimestamp?: string): Observable<Detection[]> {
    let url = `${API_BASE_URL}/detections?page=${page}&limit=${limit}`;
    if (cameraName && cameraName !== 'All Cameras') {
      url += `&cameraName=${encodeURIComponent(cameraName)}`;
    }
    if (carMake && carMake !== 'All Makes') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const apiCarMake = normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      url += `&carMake=${encodeURIComponent(apiCarMake)}`;
    }
    if (startTimestamp) {
      url += `&startTimestamp=${encodeURIComponent(startTimestamp)}`;
    }
    if (endTimestamp) {
      url += `&endTimestamp=${encodeURIComponent(endTimestamp)}`;
    }
    return this.http.get<Detection[]>(url, { headers: this.getHeaders() });
  }

  getDetectionsCount(cameraName?: string, carMake?: string, startTimestamp?: string, endTimestamp?: string): Observable<{ total: number }> {
    const params: string[] = [];
    if (cameraName && cameraName !== 'All Cameras') {
      params.push(`cameraName=${encodeURIComponent(cameraName)}`);
    }
    if (carMake && carMake !== 'All Makes') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const apiCarMake = normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      params.push(`carMake=${encodeURIComponent(apiCarMake)}`);
    }
    if (startTimestamp) {
      params.push(`startTimestamp=${encodeURIComponent(startTimestamp)}`);
    }
    if (endTimestamp) {
      params.push(`endTimestamp=${encodeURIComponent(endTimestamp)}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';
    return this.http.get<{ total: number }>(`${API_BASE_URL}/detections/count${queryString}`, { headers: this.getHeaders() });
  }

  getCameras(): Observable<string[]> {
    const cacheKey = 'cameras';
    const cached = this.cacheService.get<string[]>(cacheKey);

    if (cached) {
      console.log('Using cached cameras');
      return of(cached);
    }

    console.log('Fetching cameras from API');
    return this.http.get<string[]>(`${API_BASE_URL}/cameras`, { headers: this.getHeaders() }).pipe(
      tap(data => this.cacheService.set(cacheKey, data, 60))
    );
  }

  getCarMakes(): Observable<string[]> {
    const cacheKey = 'car-makes';
    const cached = this.cacheService.get<string[]>(cacheKey);

    if (cached) {
      console.log('Using cached car makes');
      return of(cached);
    }

    console.log('Fetching car makes from API');
    return this.http.get<string[]>(`${API_BASE_URL}/car-makes`, { headers: this.getHeaders() }).pipe(
      tap(data => this.cacheService.set(cacheKey, data, 60))
    );
  }

  searchPlate(plateTag: string, cameraName?: string, carMake?: string, startTimestamp?: string, endTimestamp?: string): Observable<Detection[]> {
    let url = `${API_BASE_URL}/detections/search?plateTag=${encodeURIComponent(plateTag)}`;
    if (cameraName && cameraName !== 'All Cameras') {
      url += `&cameraName=${encodeURIComponent(cameraName)}`;
    }
    if (carMake && carMake !== 'All Makes') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const apiCarMake = normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      url += `&carMake=${encodeURIComponent(apiCarMake)}`;
    }
    if (startTimestamp) {
      url += `&startTimestamp=${encodeURIComponent(startTimestamp)}`;
    }
    if (endTimestamp) {
      url += `&endTimestamp=${encodeURIComponent(endTimestamp)}`;
    }
    return this.http.get<Detection[]>(url, { headers: this.getHeaders() });
  }

  exportFilteredDetections(plateTag?: string, cameraName?: string, carMake?: string, startTimestamp?: string, endTimestamp?: string): Observable<Detection[]> {
    let url = `${API_BASE_URL}/detections/export?`;
    const params: string[] = [];

    if (plateTag && plateTag.trim() !== '') {
      params.push(`plateTag=${encodeURIComponent(plateTag)}`);
    }
    if (cameraName && cameraName !== 'All Cameras') {
      params.push(`cameraName=${encodeURIComponent(cameraName)}`);
    }
    if (carMake && carMake !== 'All Makes') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const apiCarMake = normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      params.push(`carMake=${encodeURIComponent(apiCarMake)}`);
    }
    if (startTimestamp) {
      params.push(`startTimestamp=${encodeURIComponent(startTimestamp)}`);
    }
    if (endTimestamp) {
      params.push(`endTimestamp=${encodeURIComponent(endTimestamp)}`);
    }

    url += params.join('&');
    return this.http.get<Detection[]>(url, { headers: this.getHeaders() });
  }

  getDetectionsByCamera(cameraName?: string, carMake?: string): Observable<{ camera: string, detections: number }[]> {
    const cacheKey = `detections-by-camera-${cameraName || 'all'}-${carMake || 'all'}`;
    const cached = this.cacheService.get<{ camera: string, detections: number }[]>(cacheKey);

    if (cached) {
      console.log('Using cached detections by camera');
      return of(cached);
    }

    const params: string[] = [];
    if (cameraName && cameraName !== 'All Cameras') {
      params.push(`cameraName=${encodeURIComponent(cameraName)}`);
    }
    if (carMake && carMake !== 'All Makes') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const apiCarMake = normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      params.push(`carMake=${encodeURIComponent(apiCarMake)}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';

    console.log('Fetching detections by camera from API');
    return this.http.get<{ camera: string, detections: number }[]>(`${API_BASE_URL}/analytics/detections-by-camera${queryString}`, { headers: this.getHeaders() }).pipe(
      tap(data => this.cacheService.set(cacheKey, data, 10))
    );
  }

  getVehicleTypeDistribution(cameraName?: string, carMake?: string): Observable<{ name: string, count: number }[]> {
    const cacheKey = `vehicle-types-${cameraName || 'all'}-${carMake || 'all'}`;
    const cached = this.cacheService.get<{ name: string, count: number }[]>(cacheKey);

    if (cached) {
      console.log('Using cached vehicle types');
      return of(cached);
    }

    const params: string[] = [];
    if (cameraName && cameraName !== 'All Cameras') {
      params.push(`cameraName=${encodeURIComponent(cameraName)}`);
    }
    if (carMake && carMake !== 'All Makes') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const apiCarMake = normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      params.push(`carMake=${encodeURIComponent(apiCarMake)}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';

    console.log('Fetching vehicle types from API');
    return this.http.get<{ name: string, count: number }[]>(`${API_BASE_URL}/analytics/vehicle-types${queryString}`, { headers: this.getHeaders() }).pipe(
      tap(data => this.cacheService.set(cacheKey, data, 10))
    );
  }

  getVehicleColorDistribution(cameraName?: string, carMake?: string): Observable<{ name: string, count: number }[]> {
    const cacheKey = `vehicle-colors-${cameraName || 'all'}-${carMake || 'all'}`;
    const cached = this.cacheService.get<{ name: string, count: number }[]>(cacheKey);

    if (cached) {
      console.log('Using cached vehicle colors');
      return of(cached);
    }

    const params: string[] = [];
    if (cameraName && cameraName !== 'All Cameras') {
      params.push(`cameraName=${encodeURIComponent(cameraName)}`);
    }
    if (carMake && carMake !== 'All Makes') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const apiCarMake = normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      params.push(`carMake=${encodeURIComponent(apiCarMake)}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';

    console.log('Fetching vehicle colors from API');
    return this.http.get<{ name: string, count: number }[]>(`${API_BASE_URL}/analytics/vehicle-colors${queryString}`, { headers: this.getHeaders() }).pipe(
      tap(data => this.cacheService.set(cacheKey, data, 10))
    );
  }

  getVehicleOrientationDistribution(cameraName?: string, carMake?: string): Observable<{ name: string, count: number }[]> {
    const cacheKey = `vehicle-orientations-${cameraName || 'all'}-${carMake || 'all'}`;
    const cached = this.cacheService.get<{ name: string, count: number }[]>(cacheKey);

    if (cached) {
      console.log('Using cached vehicle orientations');
      return of(cached);
    }

    const params: string[] = [];
    if (cameraName && cameraName !== 'All Cameras') {
      params.push(`cameraName=${encodeURIComponent(cameraName)}`);
    }
    if (carMake && carMake !== 'All Makes') {
      const normalizedCarMake = carMake.trim().toLowerCase();
      const apiCarMake = normalizedCarMake === 'n/a' ? 'unknown' : carMake;
      params.push(`carMake=${encodeURIComponent(apiCarMake)}`);
    }
    const queryString = params.length > 0 ? `?${params.join('&')}` : '';

    console.log('Fetching vehicle orientations from API');
    return this.http.get<{ name: string, count: number }[]>(`${API_BASE_URL}/analytics/vehicle-orientations${queryString}`, { headers: this.getHeaders() }).pipe(
      tap(data => this.cacheService.set(cacheKey, data, 10))
    );
  }

  getHeatmapData() {
    const data = Array.from({ length: 7 }, () =>
      Array.from({ length: 24 }, () => Math.floor(Math.random() * 50))
    );
    return new Observable(observer => {
      observer.next(data);
      observer.complete();
    });
  }
}