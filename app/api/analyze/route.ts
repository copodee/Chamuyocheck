import { analyzePost } from './analyzeHandler';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: Request) {
  return analyzePost(req);
}
