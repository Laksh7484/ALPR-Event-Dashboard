import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

const API_BASE_URL = 'http://localhost:3001/api';

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
  constructor(private http: HttpClient) {}

  getKpis(): Observable<Kpi[]> {
    return this.http.get<Kpi[]>(`${API_BASE_URL}/kpis`);
  }

  getDetections(page: number, limit: number): Observable<Detection[]> {
    return this.http.get<Detection[]>(`${API_BASE_URL}/detections?page=${page}&limit=${limit}`);
  }

  getDetectionsCount(): Observable<{ total: number }> {
    return this.http.get<{ total: number }>(`${API_BASE_URL}/detections/count`);
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