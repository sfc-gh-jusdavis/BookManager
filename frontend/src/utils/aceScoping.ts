import type { Account } from '../types'

export function isAceOnAccount(account: Account, userId: string): boolean {
  return account.ace_assigned === userId || account.collaborators.includes(userId)
}

export function getAccountAceIds(account: Account): string[] {
  const ids = [account.ace_assigned, ...account.collaborators]
  return [...new Set(ids)]
}
