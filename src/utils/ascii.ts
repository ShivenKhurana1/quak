/** Strip emoji and other pictographs from user-facing strings. */
export function stripEmoji(text: string): string {
  return text
    .replace(
      /[\u{1F300}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1F1E0}-\u{1F1FF}]/gu,
      '',
    )
    .trim();
}

export function asciiBar(percent: number, width = 10, fill = '#', empty = '.'): string {
  const clamped = Math.min(100, Math.max(0, percent));
  const filled = Math.min(width, Math.floor(clamped / (100 / width)));
  return fill.repeat(filled) + empty.repeat(width - filled);
}
