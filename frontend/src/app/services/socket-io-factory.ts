import { InjectionToken } from '@angular/core';
import { io, ManagerOptions, Socket, SocketOptions } from 'socket.io-client';

export type SocketIoFactory = (uri: string, opts?: Partial<ManagerOptions & SocketOptions>) => Socket;

/**
 * Wraps socket.io-client's `io()` behind Angular DI so tests can substitute a fake via
 * `TestBed`'s provider overrides instead of module-level mocking (`vi.mock`).
 *
 * This project's Vitest runner (`@angular/build:unit-test`) runs with `isolate: false`, so every
 * spec file shares one module registry. `vi.mock('socket.io-client', ...)` is only reliable if
 * nothing else resolves the real package first - but several unrelated spec files import
 * `LiftService` purely for its DI token, which transitively imports 'socket.io-client'. Depending
 * on the Vitest scheduler's file execution order (itself influenced by cached historical
 * durations), that unmocked import can win the race and get permanently linked for the whole
 * shared registry, making module-level mocking flaky. DI substitution has no such race: it's a
 * plain object reference resolved through Angular's injector, independent of module timing.
 */
export const SOCKET_IO_FACTORY = new InjectionToken<SocketIoFactory>('SOCKET_IO_FACTORY', {
  providedIn: 'root',
  factory: () => io,
});
