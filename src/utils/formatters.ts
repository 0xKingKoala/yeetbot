import { formatEther } from 'viem';

/**
 * Format BERA values with controlled decimal places
 * @param value - The bigint value to format
 * @param decimals - Number of decimal places (default: 4)
 * @returns Formatted string with specified decimal places
 */
export function formatBera(value: bigint, decimals: number = 4): string {
  const formatted = formatEther(value);
  const num = parseFloat(formatted);
  
  // Handle special cases
  if (num === 0) return '0';
  
  // For very small numbers, use exponential notation
  if (num > 0 && num < 0.0001) {
    return num.toExponential(2);
  }
  
  // For normal numbers, use fixed decimal places
  return num.toFixed(decimals);
}

/**
 * Format percentage with controlled decimal places
 * @param value - The percentage value
 * @param decimals - Number of decimal places (default: 1)
 * @returns Formatted percentage string
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return value.toFixed(decimals);
}

/**
 * Format large numbers with abbreviations (K, M, B)
 * @param value - The number to format
 * @returns Abbreviated string representation
 */
export function formatLargeNumber(value: number): string {
  if (value >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `${(value / 1e3).toFixed(2)}K`;
  return value.toFixed(0);
}

/**
 * Format wallet address for display
 * @param address - The wallet address
 * @returns Shortened address string
 */
export function formatAddress(address: string): string {
  if (!address) return 'Unknown';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}