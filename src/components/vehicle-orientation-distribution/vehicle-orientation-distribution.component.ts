import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Detection } from '../../services/lpr-data.service';

interface VehicleOrientationStat {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-vehicle-orientation-distribution',
  templateUrl: './vehicle-orientation-distribution.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class VehicleOrientationDistributionComponent {
  detections = input.required<Detection[]>();

  private readonly colorMap: { [key: string]: string } = {
    'Rear': '#f97316',  // Orange 500
    'Front': '#8b5cf6', // Violet 500
    'Side': '#ec4899',  // Pink 500
    'default': '#6b7280' // Gray 500
  };

  chartData = computed<VehicleOrientationStat[]>(() => {
    const counts = new Map<string, number>();
    for (const det of this.detections()) {
      const orientationName = det.vehicle.orientation.name || 'Unknown';
      counts.set(orientationName, (counts.get(orientationName) || 0) + 1);
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
