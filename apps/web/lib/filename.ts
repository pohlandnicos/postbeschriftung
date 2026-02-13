import type { ProcessResult } from './types';

export function filenamePreview(result: ProcessResult): string {
  return result.suggested_filename;
}
