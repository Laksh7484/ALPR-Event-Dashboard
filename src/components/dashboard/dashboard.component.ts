import { Component, ChangeDetectionStrategy, inject, signal, computed, effect } from '@angular/core';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { LprDataService, Detection, DetectionsResponse } from '../../services/lpr-data.service';
import { AuthService } from '../../services/auth.service';
import { switchMap, finalize, of } from 'rxjs';
import { DetectionDetailsModalComponent } from '../detection-details-modal/detection-details-modal.component';
// Removed unused visualization component imports
import { LoaderComponent } from '../loader/loader.component';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DetectionDetailsModalComponent, LoaderComponent],
})
export class DashboardComponent {
  private lprDataService = inject(LprDataService);
  private authService = inject(AuthService);
  private router = inject(Router);

  currentUser = this.authService.getCurrentUser();

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
  hasPerformedSearch = signal(false);
  searchTrigger = signal(0); // Increment this to trigger new searches

  // Date validation state
  showDateError = signal(false);
  dateErrorMessage = signal('');

  // Advanced filters state
  showAdvancedFilters = signal(false);

  // Pagination
  currentPage = signal(1);
  itemsPerPage = signal(50);

  private pageAndLimitAndFilters = computed(() => ({
    page: this.currentPage(),
    limit: this.itemsPerPage(),
    camera: this.selectedCamera(),
    carMake: this.selectedCarMake(),
    hasPerformedSearch: this.hasPerformedSearch(),
    searchTrigger: this.searchTrigger()
  }));

  detectionsResponse = toSignal(
    toObservable(this.pageAndLimitAndFilters).pipe(
      switchMap(({ page, limit, camera, carMake, hasPerformedSearch, searchTrigger }) => {
        if (this.isSearchMode() || !hasPerformedSearch) {
          // Don't fetch if in search mode or no search has been performed
          return of([]);
        }
        const startDate = this.dateRangeStart();
        const endDate = this.dateRangeEnd();

        // Convert dates to Unix timestamps (milliseconds)
        // Use UTC to ensure consistent date filtering regardless of timezone
        const startTimestamp = startDate ? new Date(startDate + 'T00:00:00Z').getTime().toString() : '';
        // For end date, use the start of the next day (which excludes the end date itself)
        let endTimestamp = '';
        if (endDate) {
          const endDateObj = new Date(endDate + 'T00:00:00Z');
          endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
          endTimestamp = (endDateObj.getTime() - 1).toString(); // Subtract 1ms to stay within the selected end date
        }

        console.log('Getting detections with filters:', {
          page, limit, camera, carMake,
          startDate, endDate,
          startTimestamp, endTimestamp,
          searchTrigger
        });
        this.loading.set(true);
        return this.lprDataService.getDetections(page, limit, camera, carMake, startTimestamp, endTimestamp).pipe(
          finalize(() => this.loading.set(false))
        );
      })
    ),
    { initialValue: [] }
  );

  private filtersForCount = computed(() => ({
    camera: this.selectedCamera(),
    carMake: this.selectedCarMake(),
    hasPerformedSearch: this.hasPerformedSearch(),
    searchTrigger: this.searchTrigger()
  }));

  totalItems = computed(() => {
    if (this.isSearchMode() && this.searchResults() !== null) {
      // In search mode, count the filtered search results
      return { total: this.filteredDetections().length };
    } else if (this.hasPerformedSearch()) {
      // In general filter mode, use the API count (this will be reactive to searchTrigger)
      return this.apiTotalItems();
    } else {
      // No search performed yet
      return { total: 0 };
    }
  });

  private apiTotalItems = toSignal(
    toObservable(this.filtersForCount).pipe(
      switchMap(({ camera, carMake, hasPerformedSearch, searchTrigger }) => {
        if (!hasPerformedSearch || this.isSearchMode()) {
          return of({ total: 0 });
        }
        const startDate = this.dateRangeStart();
        const endDate = this.dateRangeEnd();

        // Convert dates to Unix timestamps (milliseconds)
        // Use UTC to ensure consistent date filtering regardless of timezone
        const startTimestamp = startDate ? new Date(startDate + 'T00:00:00Z').getTime().toString() : '';
        // For end date, use the start of the next day (which excludes the end date itself)
        let endTimestamp = '';
        if (endDate) {
          const endDateObj = new Date(endDate + 'T00:00:00Z');
          endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
          endTimestamp = (endDateObj.getTime() - 1).toString(); // Subtract 1ms to stay within the selected end date
        }

        console.log('Getting count with filters:', {
          camera, carMake,
          startDate, endDate,
          startTimestamp, endTimestamp,
          searchTrigger
        });
        return this.lprDataService.getDetectionsCount(camera, carMake, startTimestamp, endTimestamp);
      })
    ),
    { initialValue: { total: 0 } }
  );

  // Removed analytics API calls since visualizations are no longer displayed

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

  // Converts IST timestamp to EST and formats as 'MM/dd/yyyy, h:mm:ss a'
  formatTimestampToEST(timestamp: string | number | Date): string {
    if (!timestamp) return 'N/A';
    try {
      // Parse the input timestamp (assume it's in IST)
      const istDate = new Date(timestamp);
      // IST is UTC+5:30, EST is UTC-5:00 (difference = 10.5 hours)
      // Convert IST to UTC, then subtract 5 hours to get EST
      // So IST - 10.5 hours = EST
      const estTime = istDate.getTime() - (10.5 * 60 * 60 * 1000);
      const estDate = new Date(estTime);
      // Format as MM/dd/yyyy, h:mm:ss a
      const pad = (n: number) => n.toString().padStart(2, '0');
      const month = pad(estDate.getMonth() + 1);
      const day = pad(estDate.getDate());
      const year = estDate.getFullYear();
      let hour = estDate.getHours();
      const minute = pad(estDate.getMinutes());
      const second = pad(estDate.getSeconds());
      const ampm = hour >= 12 ? 'PM' : 'AM';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${month}/${day}/${year}, ${hour}:${minute}:${second} ${ampm}`;
    } catch {
      return 'N/A';
    }
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

  // Removed searchModeVisualizationData since visualizations are no longer displayed

  uniqueCameraNames = computed(() => {
    const allCameras = new Set(this.cameras());
    return ['All Cameras', ...Array.from(allCameras)];
  });

  uniqueCarMakes = computed(() => {
    const makeSet = new Set(this.carMakes());
    return ['All Makes', ...Array.from(makeSet)];
  });

  // Removed detectionsByCamera and maxDetectionsByCamera since camera chart is no longer displayed

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

  // Format dates to mm-dd-yyyy for display
  formattedDateRangeStart = computed(() => {
    const date = this.dateRangeStart();
    if (!date) return '';
    // date is in yyyy-mm-dd format from input, convert to mm-dd-yyyy
    const [year, month, day] = date.split('-');
    return `${month}-${day}-${year}`;
  });

  formattedDateRangeEnd = computed(() => {
    const date = this.dateRangeEnd();
    if (!date) return '';
    // date is in yyyy-mm-dd format from input, convert to mm-dd-yyyy
    const [year, month, day] = date.split('-');
    return `${month}-${day}-${year}`;
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
      // Clear end date if start date changes
      if (this.dateRangeEnd()) {
        this.dateRangeEnd.set('');
      }
    } else {
      // Validate end date selection
      if (!this.dateRangeStart()) {
        this.showDateErrorPopup('You must select a start date first before selecting an end date.');
        input.value = '';
        return;
      }

      const startDate = new Date(this.dateRangeStart());
      const endDate = new Date(input.value);
      const daysDifference = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDifference > 90) {
        this.showDateErrorPopup('Date range cannot exceed 90 days. Please select an end date within 90 days of the start date.');
        input.value = '';
        return;
      }

      if (endDate < startDate) {
        this.showDateErrorPopup('End date cannot be earlier than the start date.');
        input.value = '';
        return;
      }

      this.dateRangeEnd.set(input.value);
    }
    this.currentPage.set(1); // Reset to first page when filter changes
  }

  onEndDateClick(event: Event) {
    if (!this.dateRangeStart()) {
      event.preventDefault();
      this.showDateErrorPopup('You must select a start date first before selecting an end date.');
    }
  }

  getMaxEndDate(): string {
    if (!this.dateRangeStart()) return '';

    const startDate = new Date(this.dateRangeStart());
    const maxDate = new Date(startDate);
    maxDate.setDate(maxDate.getDate() + 90);

    return maxDate.toISOString().split('T')[0];
  }

  showDateErrorPopup(message: string) {
    this.dateErrorMessage.set(message);
    this.showDateError.set(true);
  }

  closeDateError() {
    this.showDateError.set(false);
    this.dateErrorMessage.set('');
  }

  toggleAdvancedFilters() {
    this.showAdvancedFilters.set(!this.showAdvancedFilters());
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

    if (plateTag) {
      // If plate tag is provided, use plate search mode
      this.searching.set(true);
      this.isSearchMode.set(true);
      this.searchResults.set(null);
      this.hasPerformedSearch.set(true);

      // Prepare filter parameters
      const camera = this.selectedCamera();
      const carMake = this.selectedCarMake();
      const startDate = this.dateRangeStart();
      const endDate = this.dateRangeEnd();

      // Convert dates to Unix timestamps (milliseconds)
      // Use UTC to ensure consistent date filtering regardless of timezone
      const startTimestamp = startDate ? new Date(startDate + 'T00:00:00Z').getTime().toString() : '';
      // For end date, use the start of the next day (which excludes the end date itself)
      let endTimestamp = '';
      if (endDate) {
        const endDateObj = new Date(endDate + 'T00:00:00Z');
        endDateObj.setUTCDate(endDateObj.getUTCDate() + 1);
        endTimestamp = (endDateObj.getTime() - 1).toString(); // Subtract 1ms to stay within the selected end date
      }

      this.lprDataService.searchPlate(plateTag, camera, carMake, startTimestamp, endTimestamp).subscribe({
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
    } else {
      // If no plate tag, perform general search with filters
      this.performGeneralSearch();
    }
  }

  performGeneralSearch(): void {
    // Check if at least one filter is provided
    const hasDateFilter = this.dateRangeStart() && this.dateRangeEnd();
    const hasCameraFilter = this.selectedCamera() && this.selectedCamera() !== 'All Cameras';
    const hasCarMakeFilter = this.selectedCarMake() && this.selectedCarMake() !== 'All Makes';

    if (!hasDateFilter && !hasCameraFilter && !hasCarMakeFilter) {
      this.showDateErrorPopup('Please select at least one filter before searching:\n• Date range (From Date + To Date)\n• Camera Name\n• Vehicle Make');
      return;
    }

    this.isSearchMode.set(false);
    this.searchResults.set(null);
    this.hasPerformedSearch.set(true);
    this.currentPage.set(1); // Reset to first page
    this.searchTrigger.set(this.searchTrigger() + 1); // Trigger new search
  }

  clearSearch(): void {
    this.isSearchMode.set(false);
    this.searchResults.set(null);
    this.plateTagSearch.set('');
    this.dateRangeStart.set('');
    this.dateRangeEnd.set('');
    this.selectedCamera.set('All Cameras');
    this.selectedCarMake.set('All Makes');
    this.hasPerformedSearch.set(false);
    this.currentPage.set(1);
  }

  hasActiveFilters(): boolean {
    const hasDateFilter = this.dateRangeStart() && this.dateRangeEnd();
    const hasCameraFilter = this.selectedCamera() && this.selectedCamera() !== 'All Cameras';
    const hasCarMakeFilter = this.selectedCarMake() && this.selectedCarMake() !== 'All Makes';

    return (hasDateFilter || hasCameraFilter || hasCarMakeFilter) && this.hasPerformedSearch() && !this.isSearchMode();
  }

  clearAllFilters(): void {
    this.plateTagSearch.set('');
    this.dateRangeStart.set('');
    this.dateRangeEnd.set('');
    this.selectedCamera.set('All Cameras');
    this.selectedCarMake.set('All Makes');
    this.isSearchMode.set(false);
    this.searchResults.set(null);
    this.hasPerformedSearch.set(false);
    this.currentPage.set(1);
  }

  exportToCsv(): void {
    const detections = this.filteredDetections();
    if (detections.length === 0) {
      return;
    }

    const headers = [
      'Detection ID', 'Timestamp', 'Time of Day',
      'Plate Tag', 'Plate Code',
      'Source ID', 'Source Name', 'Source Type',
      'Latitude', 'Longitude',
      'Vehicle Make', 'Vehicle Type', 'Vehicle Color', 'Vehicle Orientation', 'Vehicle Bearing', 'Vehicle Occlusion',
      'Image ID', 'Image Width', 'Image Height'
    ];
    const csvRows = [headers.join(',')];

    for (const det of detections) {
      const timestamp = new Date(det.timestamp).toLocaleString();
      const values = [
        det.id || 'N/A',
        `"${timestamp}"`,
        det.timeOfDay || 'N/A',
        det.plate?.tag || 'N/A',
        det.plate?.code || 'N/A',
        det.source?.id || 'N/A',
        det.source?.name || 'N/A',
        det.source?.type || 'N/A',
        det.location?.lat || 'N/A',
        det.location?.lon || 'N/A',
        det.vehicle?.make?.name || 'N/A',
        det.vehicle?.type?.name || 'N/A',
        det.vehicle?.color?.code || 'N/A',
        det.vehicle?.orientation?.name || 'N/A',
        det.vehicle?.bearing || 'N/A',
        det.vehicle?.occlusion || 'N/A',
        det.image?.id || 'N/A',
        det.image?.width || 'N/A',
        det.image?.height || 'N/A',
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

  logout() {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        // Even if logout fails, redirect to login
        this.router.navigate(['/login']);
      }
    });
  }

  // Removed chart visualization helper methods since charts are no longer displayed
}
