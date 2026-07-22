import { Component, computed, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { isValidSessionId, normalizeSessionId } from '../../utils/session-id';

/**
 * Shown on the referee and display pages when no session/platform ID is present
 * in the URL - e.g. someone navigated there directly instead of scanning the
 * jury's QR code. Lets them type the ID the jury shared instead.
 */
@Component({
  selector: 'app-session-id-prompt',
  imports: [CommonModule],
  templateUrl: './session-id-prompt.html',
  styleUrl: './session-id-prompt.css',
})
export class SessionIdPromptComponent {
  submitted = output<string>();

  value = signal('');

  isValid = computed(() => isValidSessionId(normalizeSessionId(this.value())));

  onInput(event: Event) {
    this.value.set((event.target as HTMLInputElement).value);
  }

  submit() {
    const sessionId = normalizeSessionId(this.value());

    if (!isValidSessionId(sessionId)) return;

    this.submitted.emit(sessionId);
  }
}
