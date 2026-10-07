/**
 * Server tablet features that plug into the server shell. Each lives in its
 * own folder; the shell (index.tsx) only imports from here.
 */
export { MenuReferenceButton } from './menu/MenuReferenceButton';
export { ResidentsView } from './residents/ResidentsView';
export { ResidentProfileSheet } from './residents/ResidentProfileSheet';
export { ShiftReviewView } from './shift/ShiftReviewView';
export { SideWorkChip } from './sidework/SideWorkChip';
export { SideWorkManager } from './sidework/SideWorkManager';
export { PointsChip } from './points/PointsChip';
export { NoticesButton } from './notices/NoticesButton';
export { VoiceButton } from './voice/VoiceButton';
export { TriviaButton } from './trivia/TriviaButton';

// Also available for the order screen: the mic for one check, and Good to know for a seated resident.
export { MicButton } from './voice/VoiceButton';
export { GoodToKnow } from './residents/GoodToKnow';
