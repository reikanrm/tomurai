import { LifeServiceError, type LifeCommand, type LifeProjection } from './life-notes-service.ts';
export type LifeMutation = Omit<LifeCommand, 'noteId'>;
/** A session-bound gateway; real authentication supplies the identity, never the form. */
export type LifeNotesPort = { mode: 'connected' | 'development' | 'unavailable'; read(): Promise<LifeProjection>; execute(command: LifeMutation): Promise<LifeProjection> };
export const unavailableLifeNotes: LifeNotesPort = { mode: 'unavailable',
  async read() { throw new LifeServiceError('unavailable'); }, async execute() { throw new LifeServiceError('unavailable'); } };
