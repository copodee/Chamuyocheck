export type UserSession = {
  id: string;
  name: string;
  email: string;
  plan: 'starter' | 'pro';
};

export async function connectGooglePlaceholder(): Promise<UserSession> {
  return {
    id: 'local-user',
    name: 'Usuario ChamuyoCheck',
    email: 'usuario@example.com',
    plan: 'pro',
  };
}
