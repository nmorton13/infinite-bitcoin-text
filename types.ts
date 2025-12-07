export interface TextChunk {
  id: string;
  content: string;
  topic: string;
}

export enum LoadingState {
  IDLE = 'IDLE',
  LOADING = 'LOADING',
  ERROR = 'ERROR'
}