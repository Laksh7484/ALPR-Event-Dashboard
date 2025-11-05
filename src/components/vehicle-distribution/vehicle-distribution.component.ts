import { Component, ChangeDetectionStrategy, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Detection } from '../../services/lpr-data.service';

interface ChartData {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

@Component({
  selector: 'app-vehicle-distribution',
  templateUrl: './vehicle-distribution.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
})
export class VehicleDistributionComponent {
  detections = input.required<Detection[]>();

  private readonly colorPalette = [
    '#22d3ee', // cyan-400
  ];

  private calculateChartData(grouper: (det: Detection) => string): ChartData[] {
    const counts = new Map<string, number>();
    for (const det of this.detections()) {
      const key = grouper(det) || 'Unknown';
      counts.set(key, (counts.get(key) || 0) + 1);
    }

    const total = this.detections().length;
    if (total === 0) return [];

    const sortedData = Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);

    return sortedData.map(([name, count], index) => ({
      name,
      count,
      percentage: (count / total) * 100,
      color: this.colorPalette[index % this.colorPalette.length],
    }));
  }

  typeChartData = computed(() => this.calculateChartData(det => det.vehicle.type.name));
  orientationChartData = computed(() => this.calculateChartData(det => det.vehicle.orientation.name));
}