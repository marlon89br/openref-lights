import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SessionIdPromptComponent } from './session-id-prompt';

describe('SessionIdPromptComponent', () => {
  let component: SessionIdPromptComponent;
  let fixture: ComponentFixture<SessionIdPromptComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SessionIdPromptComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(SessionIdPromptComponent);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should be invalid when empty', () => {
    expect(component.isValid()).toBe(false);
  });

  it('should be invalid when too short', () => {
    component.value.set('AB');
    expect(component.isValid()).toBe(false);
  });

  it('should be valid for a well-formed ID', () => {
    component.value.set('K7XM2P');
    expect(component.isValid()).toBe(true);
  });

  it('should trim and uppercase before validating', () => {
    component.value.set('  k7xm2p  ');
    expect(component.isValid()).toBe(true);
  });

  it('should emit the normalized session ID on submit', () => {
    const emitted: string[] = [];

    component.submitted.subscribe((id) => emitted.push(id));

    component.value.set('  k7xm2p  ');
    component.submit();

    expect(emitted).toEqual(['K7XM2P']);
  });

  it('should not emit when the value is invalid', () => {
    const emitted: string[] = [];

    component.submitted.subscribe((id) => emitted.push(id));

    component.value.set('!!');
    component.submit();

    expect(emitted).toEqual([]);
  });
});
