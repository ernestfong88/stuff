/** "Ann", "Ann and Bob", "Ann, Bob and Cy" */
export function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1];
}

/**
 * The line read out after the reveal: who got it right, or the answer when
 * nobody played.
 */
export function revealHeadline(played: string[], right: string[], answerText: string): string {
  if (!played.length) return `The answer is ${answerText}.`;
  if (right.length === played.length) return played.length === 1 ? `${right[0]} is right!` : 'Everyone is right!';
  if (right.length) return `${joinNames(right)} got it right!`;
  return 'A tricky one. Nobody got it right today.';
}
