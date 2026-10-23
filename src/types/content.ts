export type ContentKind = 'legal' | 'help' | 'copy';

export interface ContentDoc {
  id: string;
  slug: string;
  kind: ContentKind;
  title: string;
  summary: string;
  /** Live, published text shown in the consumer app. */
  body: string;
  /** Unpublished edits. null when there are none. */
  draft: string | null;
  version: number;
  updatedAt: string;
  updatedBy: string;
}