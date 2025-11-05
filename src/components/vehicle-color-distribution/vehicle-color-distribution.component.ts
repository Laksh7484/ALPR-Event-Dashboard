import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Detection } from '../../services/lpr-data.service';

interface VehicleColorStat {
  name: string;
  count: number;
  percentage: number;
  color: string;
  offset: number;
}

@Component({
  selector: 'app-vehicle-color-distribution',
  templateUrl: './vehicle-color-distribution.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class VehicleColorDistributionComponent {
  detections = input.required<Detection[]>();

  chartData = computed<VehicleColorStat[]>(() => {
    const counts = new Map<string, number>();
    for (const det of this.detections()) {
      const colorName = det.vehicle.color.code || 'unknown';
      counts.set(colorName, (counts.get(colorName) || 0) + 1);
    }

    const total = this.detections().length;
    if (total === 0) return [];

    const sortedData = Array.from(counts.entries())
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
        percentage: (count / total) * 100,
        color: name === 'unknown' ? '#9ca3af' : name,
      }))
      .sort((a, b) => b.count - a.count);
    
    let cumulativeOffset = 0;
    return sortedData.map(item => {
      const stat = { ...item, offset: cumulativeOffset };
      cumulativeOffset += item.percentage;
      return stat;
    });
  });

  readonly circumference = 2 * Math.PI * 40;
}