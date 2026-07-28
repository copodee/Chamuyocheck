import { verifyPost } from './verifyHandler';

export async function POST(request: Request) {
  return verifyPost(request);
}
