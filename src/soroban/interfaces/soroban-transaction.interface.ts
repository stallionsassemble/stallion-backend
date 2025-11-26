export interface SorobanTransaction {
  id: string;
  from: string;
  to: string;
  amount: number;
  timestamp: number;
  status: 'pending' | 'completed' | 'failed';
}
