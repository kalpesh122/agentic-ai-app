import { getTime } from './get-time.ts';
import { httpFetch } from './http-fetch.ts';
import { saveNote } from './save-note.ts';
import { searchNotes } from './search-notes.ts';
import type { ToolDef } from './types.ts';

/** Every tool the app knows about. Add new tools here; ALLOWED_TOOLS decides which ones an agent may use. */
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous schemas; each def is typed at its definition
export const allTools: ToolDef<any>[] = [getTime, searchNotes, saveNote, httpFetch];
