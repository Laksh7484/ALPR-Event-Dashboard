import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { LprDataService, Detection, DetectionsResponse } from '../../services/lpr-data.service';
import { switchMap, finalize } from 'rxjs';
import { DetectionDetailsModalComponent } from '../detection-details-modal/detection-details-modal.component';
import { VehicleColorDistributionComponent } from '../vehicle-color-distribution/vehicle-color-distribution.component';
import { VehicleDistributionComponent } from '../vehicle-distribution/vehicle-distribution.component';
import { LoaderComponent } from '../loader/loader.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DetectionDetailsModalComponent, VehicleColorDistributionComponent, VehicleDistributionComponent, LoaderComponent],
})
export class DashboardComponent {
  private lprDataService = inject(LprDataService);

  kpis = toSignal(this.lprDataService.getKpis(), { initialValue: [] });
  
  // Filters
  plateTagSearch = signal('');
  selectedCamera = signal('All Cameras');
  dateRangeStart = signal('');
  dateRangeEnd = signal('');
  
  // Modal state
  selectedDetection = signal<Detection | null>(null);
  loading = signal(false);
  
  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(50);

  private pageAndLimit = computed(() => ({ page: this.currentPage(), limit: this.itemsPerPage() }));

  detectionsResponse = toSignal(
    toObservable(this.pageAndLimit).pipe(
      switchMap(({ page, limit }) => {
        this.loading.set(true);
        return this.lprDataService.getDetections(page, limit).pipe(
          finalize(() => this.loading.set(false))
        );
      })
    ),
    { initialValue: [] }
  );

  totalItems = toSignal(this.lprDataService.getDetectionsCount(), { initialValue: { total: 0 } });

  constructor() {
    effect(() => {
      console.log('Detections Response:', this.detectionsResponse());
      console.log('Total Items:', this.totalItems());
    });
  }

  paginatedDetections = computed(() => this.detectionsResponse());

  filteredDetections = computed(() => {
    // This will be replaced with server-side filtering
    return this.paginatedDetections();
  });

  uniqueCameraNames = computed(() => {
    const names = this.paginatedDetections().map(d => d.source.name);
    return ['All Cameras', ...Array.from(new Set(names)).sort()];
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

  totalPages = computed(() => 
    Math.ceil(this.totalItems().total / this.itemsPerPage())
  );

  // Calculate display range
  startItem = computed(() => {
    const total = this.totalItems().total;
    if (total === 0) return 0;
    return (this.currentPage() - 1) * this.itemsPerPage() + 1;
  });

  endItem = computed(() => {
    const total = this.totalItems().total;
    const end = this.currentPage() * this.itemsPerPage();
    return end > total ? total : end;
  });

  // Pagination methods
  goToPage(page: number) {
    const total = this.totalPages();
    if (page >= 1 && page <= total) {
      this.currentPage.set(page);
    }
  }

  nextPage() {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.set(this.currentPage() + 1);
    }
  }

  previousPage() {
    if (this.currentPage() > 1) {
      this.currentPage.set(this.currentPage() - 1);
    }
  }

  onItemsPerPageChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.itemsPerPage.set(parseInt(select.value));
    this.currentPage.set(1); // Reset to first page when changing items per page
  }
  
  onPlateTagChange(event: Event) {
    const input = event.target as HTMLInputElement;
    this.plateTagSearch.set(input.value);
    this.currentPage.set(1); // Reset to first page when filter changes
  }

  onCameraChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedCamera.set(select.value);
    this.currentPage.set(1); // Reset to first page when filter changes
  }

  onDateChange(type: 'start' | 'end', event: Event) {
    const input = event.target as HTMLInputElement;
    if (type === 'start') {
      this.dateRangeStart.set(input.value);
    } else {
      this.dateRangeEnd.set(input.value);
    }
    this.currentPage.set(1); // Reset to first page when filter changes
  }

  clearFilters(): void {
    this.plateTagSearch.set('');
    this.selectedCamera.set('All Cameras');
    this.dateRangeStart.set('');
    this.dateRangeEnd.set('');
    this.currentPage.set(1); // Reset to first page when clearing filters
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
