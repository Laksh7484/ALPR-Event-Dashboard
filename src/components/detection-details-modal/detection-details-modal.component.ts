import { Component, ChangeDetectionStrategy, input, output, effect, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Detection } from '../../services/lpr-data.service';

@Component({
  selector: 'app-detection-details-modal',
  templateUrl: './detection-details-modal.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
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

  // Formats timestamp in EST as 'MMM d, yyyy, h:mm:ss a'
  formatTimestamp(timestamp: string | number | Date): string {
    if (!timestamp) return 'N/A';
    try {
      const date = new Date(timestamp);
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }).format(date);
    } catch {
      return 'N/A';
    }
  }
}