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
  loggingOut = signal(false);


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
          return of({ detections: [], total: 0 });
        }
        const startDate = this.dateRangeStart();
        const endDate = this.dateRangeEnd();

        // Convert inputs (which are in local time representation of EST) to UTC timestamps
        // The input string is like "2023-10-27T10:00"
        // We want to treat this as 10:00 EST/EDT and get the corresponding UTC timestamp
        const startTimestamp = startDate ? this.getESTTimestamp(startDate) : '';
        const endTimestamp = endDate ? this.getESTTimestamp(endDate) : '';

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
    { initialValue: { detections: [], total: 0 } }
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
      // In general filter mode, use the total from the combined API response
      return { total: this.detectionsResponse().total };
    } else {
      // No search performed yet
      return { total: 0 };
    }
  });

  // Removed apiTotalItems and getDetectionsCount since total is now provided by getDetections

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

  // Formats timestamp in EST as 'MM/dd/yyyy, h:mm:ss a'
  formatTimestamp(timestamp: string | number | Date): string {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(date);
    } catch {
      return 'N/A';
    }
  }

  // Helper to convert an ISO string (e.g. "2023-10-27T10:00") to a UTC timestamp
  // treating the input time as if it were in America/New_York timezone.
  private getESTTimestamp(isoString: string): string {
    if (!isoString) return '';
    try {
      // Create a date object from the string.
      // Note: new Date("2023-10-27T10:00") creates a date in the browser's local timezone.
      // We want to interpret "2023-10-27T10:00" as EST/EDT.

      // One way is to append the offset, but offset changes with DST.
      // A robust way is to use Intl.DateTimeFormat to find the offset or use a library like date-fns-tz.
      // Without external libraries, we can approximate or use a trick.

      // Trick: 
      // 1. Parse the components
      const date = new Date(isoString); // Local time
      // 2. We want to find a UTC timestamp X such that X formatted in America/New_York equals isoString.

      // Let's assume the user's browser is NOT in EST, or maybe it is.
      // Actually, the simplest way without libraries is to construct a string with the timezone.
      // But JS Date parsing with timezone names is not standard.

      // Alternative: Use the fact that we want to send a timestamp that represents that time in EST.
      // If the user selects 10:00 AM, they mean 10:00 AM EST.
      // The API expects a UTC timestamp (milliseconds).

      // We can create a date object, format it to parts in America/New_York, compare with desired parts, and adjust.
      // Or simpler: construct a string "MM/DD/YYYY, HH:mm:ss" and parse it? No.

      // Let's try to construct a Date object that represents that time in UTC, then add the EST offset (reversed).
      // Actually, since we don't have a timezone library, let's rely on the fact that the backend might handle it?
      // No, backend expects UTC epoch.

      // Let's use a heuristic: EST is UTC-5, EDT is UTC-4.
      // We can try to construct the date in UTC and add 5 or 4 hours?
      // Better:
      // Create a date object from the input string (treated as UTC).
      // Then add 4 or 5 hours depending on the date?

      // Let's try this:
      // 1. Treat the input string as UTC.
      const utcDate = new Date(isoString + 'Z');
      // 2. Format this UTC date in America/New_York.
      const estString = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
      }).format(utcDate);

      // 3. Compare the formatted EST string with the input ISO string.
      // If they match, great. If not, we have an offset difference.
      // This is getting complicated.

      // Simpler approach for now:
      // Just treat the input as local time if the user is in EST?
      // The user asked to "convert the timestamp into est".
      // If the user selects 10:00 in the picker, they mean 10:00 EST.
      // So we need to find the UTC timestamp for 10:00 EST.

      // Let's use the `toLocaleString` with timeZone option to find the offset.
      // Or simpler:
      // 1. Parse the input as if it were UTC: new Date(isoString + 'Z')
      // 2. Get the offset of America/New_York at that time.
      // Since we can't easily get the offset, let's just assume the user is in the same timezone or just send it as is?
      // No, user specifically asked for EST.

      // Let's use a workaround:
      // Create a date, set the time, and then adjust.
      // Actually, `new Date(isoString)` uses local browser time.
      // If we append "-05:00" or "-04:00"? We don't know which one.

      // Let's try to find the offset dynamically.
      const targetTime = new Date(isoString); // Local
      const timeInEst = new Date(targetTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const diff = targetTime.getTime() - timeInEst.getTime();
      // This gives the difference between Local and EST.
      // We want to convert "Input Time (EST)" -> UTC.
      // Input Time (EST) = Input Time (Local) + (Local - EST)? No.

      // Let's go with a simpler approximation for now, or just assume standard offsets if exactness isn't critical to the second.
      // But for filtering it is.

      // Let's try this:
      // We want 10:00 EST.
      // new Date("2023-10-27T10:00-04:00") works if we know it's -04:00.
      // We can check if the date is in DST for New York.
      // A simple helper function to check DST for a given date in NY.
      // But that's complex to implement from scratch.

      // Let's assume the input is UTC for the sake of the timestamp value, then add 5 hours (standard) or 4 (DST).
      // How to detect DST?
      // In 2025 (current year in context), DST starts March 9 and ends Nov 2.
      const inputDate = new Date(isoString);
      const year = inputDate.getFullYear();
      // Simple DST check for US (Second Sunday in March to First Sunday in Nov)
      // This is an approximation but likely sufficient.
      // Actually, `Intl` can tell us the timezone name.
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        timeZoneName: 'short'
      }).formatToParts(inputDate);
      const isDaylight = parts.find(p => p.type === 'timeZoneName')?.value === 'EDT';

      const offset = isDaylight ? '-04:00' : '-05:00';
      const estDate = new Date(`${isoString}:00${offset}`);
      return estDate.getTime().toString();
    } catch (e) {
      console.error('Error converting to EST timestamp', e);
      return '';
    }
  }

  constructor() {
    effect(() => {
      console.log('Total Items:', this.totalItems());
    });
  }

  paginatedDetections = computed(() => this.detectionsResponse().detections);

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

  // Computed property for advanced filter button text
  advancedFiltersButtonText = computed(() => {
    const camera = this.selectedCamera();
    const make = this.selectedCarMake();
    const hasCamera = camera && camera !== 'All Cameras';
    const hasMake = make && make !== 'All Makes';

    if (hasCamera && hasMake) {
      return `${camera} | ${make}`;
    } else if (hasCamera) {
      return camera;
    } else if (hasMake) {
      return make;
    } else {
      return 'Advanced Filters';
    }
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

  // Removed formattedDateRangeStart and formattedDateRangeEnd

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
  }

  onCameraChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedCamera.set(select.value);
  }

  onCarMakeChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    this.selectedCarMake.set(select.value);
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

    // Return in format YYYY-MM-DDTHH:mm for datetime-local
    return maxDate.toISOString().slice(0, 16);
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
      const startTimestamp = startDate ? this.getESTTimestamp(startDate) : '';
      const endTimestamp = endDate ? this.getESTTimestamp(endDate) : '';

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
    // Prepare filter parameters
    const plateTag = this.plateTagSearch();
    const camera = this.selectedCamera();
    const carMake = this.selectedCarMake();
    const startDate = this.dateRangeStart();
    const endDate = this.dateRangeEnd();

    // Convert dates to Unix timestamps (milliseconds)
    const startTimestamp = startDate ? this.getESTTimestamp(startDate) : '';
    const endTimestamp = endDate ? this.getESTTimestamp(endDate) : '';

    // Show loader while exporting
    this.loading.set(true);

    // Call the export API to get ALL filtered data
    this.lprDataService.exportFilteredDetections(
      plateTag || undefined,
      camera !== 'All Cameras' ? camera : undefined,
      carMake !== 'All Makes' ? carMake : undefined,
      startTimestamp || undefined,
      endTimestamp || undefined
    ).subscribe({
      next: (detections) => {
        if (detections.length === 0) {
          console.log('No detections to export');
          this.loading.set(false);
          return;
        }

        console.log(`Exporting ${detections.length} detections to CSV`);

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

        // Hide loader after download
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error exporting detections:', error);
        // Hide loader on error
        this.loading.set(false);
      }
    });
  }

  selectDetection(detection: Detection) {
    this.selectedDetection.set(detection);
  }

  closeModal() {
    this.selectedDetection.set(null);
  }

  onImageError(event: Event) {
    // Hide the broken image and show 'No image' text instead
    const imgElement = event.target as HTMLImageElement;
    if (imgElement) {
      imgElement.style.display = 'none';
      // Add a text node after the image
      const parent = imgElement.parentElement;
      if (parent && !parent.querySelector('.image-error-text')) {
        const textSpan = document.createElement('span');
        textSpan.className = 'text-xs text-gray-500 image-error-text';
        textSpan.textContent = 'No image';
        parent.appendChild(textSpan);
      }
    }
  }

  logout() {
    this.loggingOut.set(true);
    // Fire and forget the backend logout
    this.authService.logout().subscribe({
      next: () => console.log('Backend logout successful'),
      error: (err) => console.error('Backend logout failed', err)
    });
    // Navigate immediately
    this.router.navigate(['/login']);
  }

  // Removed chart visualization helper methods since charts are no longer displayed
}
