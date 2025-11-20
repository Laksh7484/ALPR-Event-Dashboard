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
  analyticsData = input<{name: string, count: number}[]>([]);
  isSearchMode = input<boolean>(false);

  private readonly colorMap: Record<string, string> = {
    'white': '#ffffff',
    'black': '#000000',
    'gray': '#808080',
    'grey': '#808080',
    'red': '#ef4444',
    'blue': '#3b82f6',
    'green': '#22c55e',
    'yellow': '#eab308',
    'orange': '#f97316',
    'purple': '#a855f7',
    'pink': '#ec4899',
    'brown': '#92400e',
    'silver': '#c0c0c0',
    'gold': '#ffd700',
    'beige': '#f5f5dc',
    'tan': '#d2b48c',
    'maroon': '#800000',
    'navy': '#000080',
    'teal': '#008080',
    'cyan': '#22d3ee',
    'lime': '#84cc16',
    'unknown': '#9ca3af',
  };

  private getColorHex(colorName: string): string {
    const normalized = colorName.toLowerCase();
    return this.colorMap[normalized] || '#9ca3af';
  }

  chartData = computed<VehicleColorStat[]>(() => {
    let sortedData: Array<{name: string, count: number, percentage: number, color: string}> = [];

    if (this.isSearchMode()) {
      // Calculate from search results (full detections)
      const counts = new Map<string, number>();
      for (const det of this.detections()) {
        let colorName = det.vehicle?.color?.code;
        // Normalize empty, null, undefined, or 'unknown' to 'N/A'
        if (!colorName || colorName.trim() === '' || colorName === 'unknown') {
          colorName = 'N/A';
        }
        counts.set(colorName, (counts.get(colorName) || 0) + 1);
      }

      const total = this.detections().length;
      if (total === 0) return [];

      sortedData = Array.from(counts.entries())
        .map(([name, count]) => ({
          name: name.charAt(0).toUpperCase() + name.slice(1),
          count,
          percentage: (count / total) * 100,
          color: this.getColorHex(name),
        }))
        .sort((a, b) => b.count - a.count);
    } else {
      // Use analytics data
      const analyticsData = this.analyticsData();
      const total = analyticsData.reduce((sum, item) => sum + item.count, 0);
      if (total === 0) return [];

      sortedData = analyticsData
        .map(item => {
          // Normalize the name to ensure consistency
          let name = item.name;
          if (!name || name.trim() === '' || name === 'unknown') {
            name = 'N/A';
          }
          
          return {
            name: name.charAt(0).toUpperCase() + name.slice(1),
            count: item.count,
            percentage: (item.count / total) * 100,
            color: this.getColorHex(name),
          };
        })
        .sort((a, b) => b.count - a.count);
    }
    
    let cumulativeOffset = 0;
    return sortedData.map(item => {
      const stat = { ...item, offset: cumulativeOffset };
      cumulativeOffset += item.percentage;
      return stat;
    });
  });

  readonly circumference = 2 * Math.PI * 40;
}