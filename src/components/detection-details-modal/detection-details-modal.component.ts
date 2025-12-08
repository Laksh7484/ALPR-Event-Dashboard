import { Component, ChangeDetectionStrategy, input, output, effect, OnDestroy, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { Detection } from '../../services/lpr-data.service';

@Component({
  selector: 'app-detection-details-modal',
  templateUrl: './detection-details-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, DatePipe],
})
export class DetectionDetailsModalComponent implements OnDestroy {
  detection = input.required<Detection>();
  close = output<void>();

  // Track image loading errors
  imageLoadError = signal(false);

  constructor() {
    effect(() => {
      if (this.detection()) {
        document.body.style.overflow = 'hidden';
        // Reset image error state when detection changes
        this.imageLoadError.set(false);
      }
    });
  }

  ngOnDestroy(): void {
    document.body.style.overflow = 'auto';
  }

  onClose(): void {
    document.body.style.overflow = 'auto';
    this.close.emit();
  }

  stopPropagation(event: Event): void {
    event.stopPropagation();
  }

  onImageError(): void {
    this.imageLoadError.set(true);
  }

  // Formats timestamp in GMT/UTC as 'MMM d, yyyy, h:mm:ss a'
  formatTimestampToGMT(timestamp: string | number | Date): string {
    if (!timestamp) return 'N/A';
    try {
      // Parse the input timestamp
      const date = new Date(timestamp);
      // Format as 'MMM d, yyyy, h:mm:ss a' in UTC
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const month = months[date.getUTCMonth()];
      const day = date.getUTCDate();
      const year = date.getUTCFullYear();
      let hour = date.getUTCHours();
      const minute = date.getUTCMinutes().toString().padStart(2, '0');
      const second = date.getUTCSeconds().toString().padStart(2, '0');
      const ampm = hour >= 12 ? 'AM' : 'PM';
      hour = hour % 12;
      if (hour === 0) hour = 12;
      return `${month} ${day}, ${year}, ${hour}:${minute}:${second} ${ampm}`;
    } catch {
      return 'N/A';
    }
  }
}