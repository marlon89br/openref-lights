import { ComponentFixture, TestBed } from '@angular/core/testing';
import { QrCodeComponent } from './qr-code';

const toCanvasMock = vi.fn().mockResolvedValue(undefined);

vi.mock('qrcode', () => ({
  toCanvas: (...args: unknown[]) => toCanvasMock(...args),
}));

describe('QrCodeComponent', () => {
  let component: QrCodeComponent;
  let fixture: ComponentFixture<QrCodeComponent>;

  beforeEach(async () => {
    toCanvasMock.mockClear();

    await TestBed.configureTestingModule({
      imports: [QrCodeComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(QrCodeComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    fixture.componentRef.setInput('value', 'https://example.com/display/ABC123');
    fixture.detectChanges();

    expect(component).toBeTruthy();
  });

  it('should render the QR code for the given value', () => {
    fixture.componentRef.setInput('value', 'https://example.com/display/ABC123');
    fixture.detectChanges();

    expect(toCanvasMock).toHaveBeenCalledWith(
      expect.anything(),
      'https://example.com/display/ABC123',
      expect.objectContaining({ width: 160 }),
    );
  });

  it('should re-render when the value changes', () => {
    fixture.componentRef.setInput('value', 'https://example.com/display/ABC123');
    fixture.detectChanges();
    toCanvasMock.mockClear();

    fixture.componentRef.setInput('value', 'https://example.com/display/XYZ999');
    fixture.detectChanges();

    expect(toCanvasMock).toHaveBeenCalledWith(expect.anything(), 'https://example.com/display/XYZ999', expect.anything());
  });

  it('should use a custom size when provided', () => {
    fixture.componentRef.setInput('value', 'https://example.com/display/ABC123');
    fixture.componentRef.setInput('size', 240);
    fixture.detectChanges();

    expect(toCanvasMock).toHaveBeenCalledWith(expect.anything(), expect.anything(), expect.objectContaining({ width: 240 }));
  });
});
