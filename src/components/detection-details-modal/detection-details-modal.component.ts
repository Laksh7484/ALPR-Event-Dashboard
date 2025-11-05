import { Component, ChangeDetectionStrategy, input, output, effect, OnDestroy } from '@angular/core';
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

  constructor() {
    effect(() => {
      if (this.detection()) {
        document.body.style.overflow = 'hidden';
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
}