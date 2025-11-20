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
  analyticsData = input<{name: string, count: number}[]>([]);
  orientationAnalyticsData = input<{name: string, count: number}[]>([]);
  isSearchMode = input<boolean>(false);

  private readonly colorPalette = [
    '#22d3ee', // cyan-400
  ];

  private calculateChartData(grouper: (det: Detection) => string): ChartData[] {
    const counts = new Map<string, number>();
    for (const det of this.detections()) {
      let key = grouper(det);
      // Normalize empty, null, undefined, or 'Unknown' to 'N/A'
      if (!key || key.trim() === '' || key === 'Unknown' || key === 'unknown') {
        key = 'N/A';
      }
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

  private calculateChartDataFromAnalytics(analyticsData: {name: string, count: number}[]): ChartData[] {
    const total = analyticsData.reduce((sum, item) => sum + item.count, 0);
    if (total === 0) return [];

    return analyticsData.map((item, index) => {
      // Normalize the name to ensure consistency
      let name = item.name;
      if (!name || name.trim() === '' || name === 'Unknown' || name === 'unknown') {
        name = 'N/A';
      }
      
      return {
        name,
        count: item.count,
        percentage: (item.count / total) * 100,
        color: this.colorPalette[index % this.colorPalette.length],
      };
    });
  }

  typeChartData = computed(() => {
    if (this.isSearchMode()) {
      return this.calculateChartData(det => det.vehicle?.type?.name || 'Unknown');
    } else {
      return this.calculateChartDataFromAnalytics(this.analyticsData());
    }
  });

  orientationChartData = computed(() => {
    if (this.isSearchMode()) {
      return this.calculateChartData(det => det.vehicle?.orientation?.name || 'Unknown');
    } else {
      return this.calculateChartDataFromAnalytics(this.orientationAnalyticsData());
    }
  });
}