import { Context } from 'grammy';

export type SessionState =
  | { step: 'IDLE'; data: {} }
  | { step: 'DEP_METHOD'; data: {} }
  | { step: 'DEP_AMOUNT'; data: { methodId: string } }
  | { step: 'DEP_SCREEN'; data: { methodId: string; amount: number } }
  | { step: 'RED_USER'; data: {} }
  | { step: 'RED_GAME'; data: { username: string } }
  | { step: 'RED_AMOUNT'; data: { username: string; game: string } }
  | { step: 'RED_METHOD'; data: { username: string; game: string; amount: number } }
  | { step: 'FREE_USER'; data: {} }
  | { step: 'FREE_GAME'; data: { username: string } }
  | { step: 'ACC_GAME'; data: {} }
  | { step: 'ACC_USER'; data: { game: string } };

export interface BotContext extends Context {
  session: SessionState;
}
