import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Detection } from '../../services/lpr-data.service';

interface VehicleTypeStat {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-vehicle-type-distribution',
  templateUrl: './vehicle-type-distribution.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class VehicleTypeDistributionComponent {
  detections = input.required<Detection[]>();

  private readonly colorMap: { [key: string]: string } = {
    'SUV': '#10b981', // Emerald 500
    'Sedan': '#3b82f6', // Blue 500
    'Truck': '#ef4444', // Red 500
    'Van': '#eab308', // Yellow 500
    'default': '#a855f7' // Purple 500
  };

  chartData = computed<VehicleTypeStat[]>(() => {
    const counts = new Map<string, number>();
    for (const det of this.detections()) {
      const typeName = det.vehicle.type.name || 'Unknown';
      counts.set(typeName, (counts.get(typeName) || 0) + 1);
    }

    const total = this.detections().length;
    if (total === 0) return [];

    return Array.from(counts.entries())
      .map(([name, count]) => ({
        name,
        count,
        percentage: (count / total) * 100,
        color: this.colorMap[name] || this.colorMap['default'],
      }))
      .sort((a, b) => b.count - a.count);
  });
}
