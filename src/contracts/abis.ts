// Import ABI files
import YeetGameAbi from './Yeet.abi.json';
import YeetSettingsAbi from './YeetSettingsStruct.abi.json';

// Export typed ABIs
export const YEET_GAME_ABI = YeetGameAbi;
export const YEET_SETTINGS_ABI = YeetSettingsAbi;

// Re-export BGT ABIs
export { BGT_REWARD_ABI, BGT_REDEEM_ABI, ERC20_ABI } from './bgtAbis';

// Export specific event signatures for easy access
export const YEET_EVENTS = {
  YeetEvent: YEET_GAME_ABI.find(item => item.type === 'event' && item.name === 'YeetEvent'),
  RoundStarted: YEET_GAME_ABI.find(item => item.type === 'event' && item.name === 'RoundStarted'),
  BGTTrackerUpdated: YEET_GAME_ABI.find(item => item.type === 'event' && item.name === 'BGTTrackerUpdated'),
};

// Export function signatures
export const YEET_FUNCTIONS = {
  yeet: YEET_GAME_ABI.find(item => item.type === 'function' && item.name === 'yeet'),
  getCurrentYeetPrice: YEET_GAME_ABI.find(item => item.type === 'function' && item.name === 'getCurrentYeetPrice'),
  getPricingInfo: YEET_GAME_ABI.find(item => item.type === 'function' && item.name === 'getPricingInfo'),
  latestYeeter: YEET_GAME_ABI.find(item => item.type === 'function' && item.name === 'latestYeeter'),
  lastYeeted: YEET_GAME_ABI.find(item => item.type === 'function' && item.name === 'lastYeeted'),
  lastYeetedAt: YEET_GAME_ABI.find(item => item.type === 'function' && item.name === 'lastYeetedAt'),
  hasCooldownEnded: YEET_GAME_ABI.find(item => item.type === 'function' && item.name === 'hasCooldownEnded'),
  hasLeaderWon: YEET_GAME_ABI.find(item => item.type === 'function' && item.name === 'hasLeaderWon'),
  isRoundFinished: YEET_GAME_ABI.find(item => item.type === 'function' && item.name === 'isRoundFinished'),
};