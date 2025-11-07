import { Component, ChangeDetectionStrategy, inject, signal, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { LprDataService, Detection } from '../../services/lpr-data.service';
import { DetectionDetailsModalComponent } from '../detection-details-modal/detection-details-modal.component';
import { VehicleColorDistributionComponent } from '../vehicle-color-distribution/vehicle-color-distribution.component';
import { VehicleDistributionComponent } from '../vehicle-distribution/vehicle-distribution.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DetectionDetailsModalComponent, VehicleColorDistributionComponent, VehicleDistributionComponent],
})
export class DashboardComponent {
  private lprDataService = inject(LprDataService);

  kpis = toSignal(this.lprDataService.getKpis(), { initialValue: [] });
  detections = toSignal(this.lprDataService.getDetections(), { initialValue: [] });
  
  // Filters
  plateTagSearch = signal('');
  selectedCamera = signal('All Cameras');
  dateRangeStart = signal('');
  dateRangeEnd = signal('');
  
  // Modal state
  selectedDetection = signal<Detection | null>(null);

  // Pagination state
  currentPage = signal(1);
  itemsPerPage = 10;

  uniqueCameraNames = computed(() => {
    const names = this.detections().map(d => d.source.name);
    return ['All Cameras', ...Array.from(new Set(names)).sort()];
  });

  filteredDetections = computed(() => {
    const plateTerm = this.plateTagSearch().toLowerCase();
    const camera = this.selectedCamera();
    const start = this.dateRangeStart();
    const end = this.dateRangeEnd();
    const allDetections = this.detections();

    const startDate = start ? new Date(start + 'T00:00:00') : null;
    const endDate = end ? new Date(end + 'T23:59:59') : null;

    return allDetections.filter(det => {
      const plateMatch = plateTerm ? det.plate.tag.toLowerCase().includes(plateTerm) : true;
      const cameraMatch = camera !== 'All Cameras' ? det.source.name === camera : true;

      const detDate = new Date(det.timestamp);
      let dateMatch = true;
      if (startDate && endDate) {
        dateMatch = detDate >= startDate && detDate <= endDate;
      } else if (startDate) {
        dateMatch = detDate >= startDate;
      } else if (endDate) {
        dateMatch = detDate <= endDate;
      }

      return plateMatch && cameraMatch && dateMatch;
    });
  });

  totalPages = computed(() => {
    return Math.ceil(this.filteredDetections().length / this.itemsPerPage);
  });

  paginatedDetections = computed(() => {
    const page = this.currentPage();
    const start = (page - 1) * this.itemsPerPage;
    const end = start + this.itemsPerPage;
    return this.filteredDetections().slice(start, end);
  });
  
  paginationSummary = computed(() => {
    const total = this.filteredDetections().length;
    if (total === 0) {
      return '';
    }
    const start = (this.currentPage() - 1) * this.itemsPerPage + 1;
    const end = Math.min(this.currentPage() * this.itemsPerPage, total);
    return `Showing ${start} to ${end} of ${total} results`;
  });

  detectionsByCamera = computed(() => {
    const counts = new Map<string, number>();
    for (const det of this.filteredDetections()) {
      const cameraName = det.source.name || 'Unknown';
      counts.set(cameraName, (counts.get(cameraName) || 0) + 1);
    }

    if (counts.size === 0) return [];

    return Array.from(counts.entries())
      .map(([camera, detections]) => ({
        camera,
        detections,
      }))
      .sort((a, b) => b.detections - a.detections);
  });

  maxDetectionsByCamera = computed(() => 
    Math.max(...this.detectionsByCamera().map(c => c.detections), 0)
  );
  
  onPlateTagChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.plateTagSearch.set(input.value);
    this.currentPage.set(1);
  }

  onCameraChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedCamera.set(select.value);
    this.currentPage.set(1);
  }

  onDateChange(type: 'start' | 'end', event: Event) {
    const input = event.target as HTMLInputElement;
    if (type === 'start') {
      this.dateRangeStart.set(input.value);
    } else {
      this.dateRangeEnd.set(input.value);
    }
    this.currentPage.set(1);
  }

  clearFilters(): void {
    this.plateTagSearch.set('');
    this.selectedCamera.set('All Cameras');
    this.dateRangeStart.set('');
    this.dateRangeEnd.set('');
    this.currentPage.set(1);
  }

  previousPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(page => page - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(page => page + 1);
    }
  }

  exportToCsv(): void {
    const detections = this.filteredDetections();
    if (detections.length === 0) {
      return;
    }

    const headers = ['Plate Tag', 'Camera', 'Timestamp', 'Vehicle Type', 'Vehicle Color', 'Latitude', 'Longitude'];
    const csvRows = [headers.join(',')];
    
    for (const det of detections) {
        const timestamp = new Date(det.timestamp).toLocaleString();
        const values = [
            det.plate.tag,
            det.source.name,
            `"${timestamp}"`,
            det.vehicle.type.name,
            det.vehicle.color.code,
            det.location.lat,
            det.location.lon
        ];
        csvRows.push(values.join(','));
    }

    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', 'detection_history.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  selectDetection(detection: Detection) {
    this.selectedDetection.set(detection);
  }

  closeModal() {
    this.selectedDetection.set(null);
  }
}
