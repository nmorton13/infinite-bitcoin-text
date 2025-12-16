export interface TextChunk {
  id: string;
  content: string;
  topic: string;
}

export interface ConceptNode {
  id: string;
  label: string;
  parentId: string | null;
  summary: string;
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  ERROR = 'ERROR'
}
