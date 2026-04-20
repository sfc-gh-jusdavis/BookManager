import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

const SF_BASE = "https://snowforce.lightning.force.com/lightning/r";

export function sfUseCaseUrl(useCaseId: string): string {
  return `${SF_BASE}/Use_Case__c/${useCaseId}/view`;
}
