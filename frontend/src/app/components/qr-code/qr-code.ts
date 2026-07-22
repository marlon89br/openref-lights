import { Component, ElementRef, effect, input, viewChild } from '@angular/core';
import * as QRCode from 'qrcode';

/**
 * Renders a scannable QR code for a URL onto a canvas, entirely client-side.
 * Used so referees and the public display can join a session by scanning
 * instead of typing the session ID.
 */
@Component({
  selector: 'app-qr-code',
  template: `<canvas #canvas></canvas>`,
})
export class QrCodeComponent {
  value = input.required<string>();
  size = input(160);

  private canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');

  constructor() {
    effect(() => {
      const value = this.value();
      const size = this.size();
      const canvas = this.canvasRef().nativeElement;

      QRCode.toCanvas(canvas, value, { width: size, margin: 1 }).catch((error: unknown) => {
        console.error('Failed to render QR code:', error);
      });
    });
  }
}
