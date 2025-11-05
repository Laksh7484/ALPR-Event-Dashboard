import { Injectable } from '@angular/core';
import { of } from 'rxjs';

export interface Kpi {
  title: string;
  value: string;
  icon: string;
  color: string;
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
  getKpis() {
    return of<Kpi[]>([
      { title: 'Total Detections', value: '1,428', icon: 'M3 10h18M3 14h18m-9-4v8', color: 'cyan' },
      { title: 'Active Cameras', value: '24', icon: 'M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z', color: 'purple' },
    ]);
  }

  getDetections() {
    const firstDetection: Detection = {
      "id": "e75151eac93c4bae9a219c3d41d517dc",
      "image": { "height": 1080, "id": "d19ad4eefc3f4dc797fa93b1910ca04a", "width": 1920 },
      "location": { "lat": 27.96064847738516, "lon": -82.77212473568781 },
      "plate": { "code": "US-FL", "region": { "height": 41, "width": 71, "x": 158, "y": 18 }, "tag": "AQ36SP" },
      "source": { "id": "98337a33f5ea4979af33c4b6e895a274", "name": "Camera2", "type": "alpr_processor" },
      "timeOfDay": 0, "timestamp": 1683640785483, "type": "alpr",
      "vehicle": {
        "bearing": 71.79301, "color": { "code": "black" }, "occlusion": 0.0,
        "orientation": { "code": "rear", "name": "Rear" },
        "type": { "code": "suv", "name": "SUV" }
      },
      "version": "1.0"
    };

    const plates = ['8K2L9N', '5B7P3F', '9C1X4Z', '3A6R8E', '7D4V5G'];
    const cameras = ['North Gate', 'South Gate', 'East Garage', 'West Lot', 'Main Entrance'];
    const vehicleTypes = [{code: 'sedan', name: 'Sedan'}, {code: 'truck', name: 'Truck'}, {code: 'suv', name: 'SUV'}, {code: 'van', name: 'Van'}];
    const colors = ['white', 'black', 'gray', 'red', 'blue', 'green', 'yellow'];
    const orientations = [{code: 'rear', name: 'Rear'}, {code: 'front', name: 'Front'}, {code: 'side', name: 'Side'}];

    const detections: Detection[] = [firstDetection];

    for (let i = 0; i < 19; i++) {
      const vehicleType = vehicleTypes[Math.floor(Math.random() * vehicleTypes.length)];
      const orientation = orientations[Math.floor(Math.random() * orientations.length)];
      detections.push({
        id: crypto.randomUUID().replace(/-/g, ''),
        image: { height: 1080, id: crypto.randomUUID().replace(/-/g, ''), width: 1920 },
        location: { lat: 27.96 + (Math.random() - 0.5) * 0.1, lon: -82.77 + (Math.random() - 0.5) * 0.1 },
        plate: {
          code: "US-FL",
          region: { height: 40, width: 70, x: 150, y: 20 },
          tag: plates[Math.floor(Math.random() * plates.length)]
        },
        source: {
          id: crypto.randomUUID().replace(/-/g, ''),
          name: cameras[Math.floor(Math.random() * cameras.length)],
          type: "alpr_processor"
        },
        timeOfDay: Math.floor(Math.random() * 24),
        timestamp: Date.now() - Math.random() * 1000 * 60 * 60 * 72,
        type: "alpr",
        vehicle: {
          bearing: Math.random() * 360,
          color: { code: colors[Math.floor(Math.random() * colors.length)] },
          occlusion: Math.random() * 0.1,
          orientation: orientation,
          type: vehicleType
        },
        version: "1.0"
      });
    }

    return of(detections.sort((a,b) => b.timestamp - a.timestamp));
  }

  getHeatmapData() {
    const data = Array.from({ length: 7 }, () => 
      Array.from({ length: 24 }, () => Math.floor(Math.random() * 50))
    );
    return of(data);
  }
}