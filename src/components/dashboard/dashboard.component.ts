import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { LprDataService, Detection, DetectionsResponse } from '../../services/lpr-data.service';
import { switchMap, finalize, of } from 'rxjs';
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
  cameras = toSignal(this.lprDataService.getCameras(), { initialValue: [] });
  carMakes = toSignal(this.lprDataService.getCarMakes(), { initialValue: [] });
  
  // Filters
  plateTagSearch = signal('');
  selectedCamera = signal('All Cameras');
  selectedCarMake = signal('All Makes');
  dateRangeStart = signal('');
  dateRangeEnd = signal('');
  
  // Modal state
  selectedDetection = signal<Detection | null>(null);
  loading = signal(false);
  searching = signal(false);
  
  // Search state
  searchResults = signal<Detection[] | null>(null);
  isSearchMode = signal(false);
  
  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(50);

  private pageAndLimitAndFilters = computed(() => ({ 
    page: this.currentPage(), 
    limit: this.itemsPerPage(),
    camera: this.selectedCamera(),
    carMake: this.selectedCarMake()
  }));

  detectionsResponse = toSignal(
    toObservable(this.pageAndLimitAndFilters).pipe(
      switchMap(({ page, limit, camera, carMake }) => {
        if (this.isSearchMode()) {
          // Don't fetch if in search mode, return empty array as observable
          return of([]);
        }
        this.loading.set(true);
        return this.lprDataService.getDetections(page, limit, camera, carMake).pipe(
          finalize(() => this.loading.set(false))
        );
      })
    ),
    { initialValue: [] }
  );

  private filtersForCount = computed(() => ({ 
    camera: this.selectedCamera(), 
    carMake: this.selectedCarMake() 
  }));

  totalItems = toSignal(
    toObservable(this.filtersForCount).pipe(
      switchMap(({ camera, carMake }) => this.lprDataService.getDetectionsCount(camera, carMake))
    ),
    { initialValue: { total: 0 } }
  );

  formatValue(value: string | null | undefined): string {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    const trimmed = value.toString().trim();
    if (!trimmed) {
      return 'N/A';
    }
    const lower = trimmed.toLowerCase();
    if (lower === 'unknown' || lower === 'n/a' || lower === 'na') {
      return 'N/A';
    }
    return trimmed;
  }

  private normalizeForCompare(value: string | null | undefined): string {
    return this.formatValue(value).toLowerCase();
  }

  constructor() {
    effect(() => {
      console.log('Detections Response:', this.detectionsResponse());
      console.log('Total Items:', this.totalItems());
    });
  }

  paginatedDetections = computed(() => this.detectionsResponse());

  filteredDetections = computed(() => {
    // If in search mode, use search results (filtered by camera and car make on frontend since search API doesn't support filters)
    if (this.isSearchMode() && this.searchResults() !== null) {
      let detections = this.searchResults() || [];
      // Apply camera filter to search results on frontend
      const camera = this.selectedCamera();
      if (camera && camera !== 'All Cameras') {
        const normalizedCamera = this.normalizeForCompare(camera);
        detections = detections.filter(det => this.normalizeForCompare(det.source.name) === normalizedCamera);
      }
      // Apply car make filter to search results on frontend
      const carMake = this.selectedCarMake();
      if (carMake && carMake !== 'All Makes') {
        const normalizedCarMake = this.normalizeForCompare(carMake);
        detections = detections.filter(det => this.normalizeForCompare(det.vehicle?.make?.name) === normalizedCarMake);
      }
      return detections;
    }
    // For normal pagination, backend already applies filters, so just return paginated detections
    return this.paginatedDetections();
  });

  uniqueCameraNames = computed(() => {
    const allCameras = new Set(this.cameras());
    return ['All Cameras', ...Array.from(allCameras)];
  });

  uniqueCarMakes = computed(() => {
    const makeSet = new Set(this.carMakes());
    return ['All Makes', ...Array.from(makeSet)];
  });

  detectionsByCamera = computed(() => {
    const counts = new Map<string, number>();
    for (const det of this.filteredDetections()) {
      const cameraName = this.formatValue(det.source.name);
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
    // Clear search mode when changing camera filter
    if (this.isSearchMode()) {
      this.clearSearch();
    }
  }

  onCarMakeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedCarMake.set(select.value);
    this.currentPage.set(1); // Reset to first page when filter changes
    // Clear search mode when changing car make filter
    if (this.isSearchMode()) {
      this.clearSearch();
    }
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
    this.selectedCarMake.set('All Makes');
    this.dateRangeStart.set('');
    this.dateRangeEnd.set('');
    this.currentPage.set(1); // Reset to first page when clearing filters
  }

  searchPlate(): void {
    const plateTag = this.plateTagSearch().trim();
    
    if (!plateTag) {
      // If empty, clear search and return to normal mode
      this.clearSearch();
      return;
    }

    this.searching.set(true);
    this.isSearchMode.set(true);
    this.searchResults.set(null);

    this.lprDataService.searchPlate(plateTag).subscribe({
      next: (detections) => {
        this.searchResults.set(detections);
        this.searching.set(false);
      },
      error: (error) => {
        console.error('Error searching plate:', error);
        this.searchResults.set([]);
        this.searching.set(false);
      }
    });
  }

  clearSearch(): void {
    this.isSearchMode.set(false);
    this.searchResults.set(null);
    this.plateTagSearch.set('');
    this.currentPage.set(1);
    // Trigger refresh of detections
    this.currentPage.set(1);
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
