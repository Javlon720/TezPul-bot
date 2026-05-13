
import { getUserState } from '../../../db/queries/users.queries.js';

export async function getCurrentState(client, telegramId) {
  return getUserState(client, telegramId);
}

export function isWaitingPhone(stateRecord) {
  return stateRecord?.state === 'WAITING_PHONE';
}
