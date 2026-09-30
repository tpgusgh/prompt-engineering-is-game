// electron/renderer/log.js
// The battle log: plain lines appended at the bottom, kept scrolled down.
import { $ } from './dom.js';

export const logEl = $('log');

export function scrollLogToBottom() {
  logEl.scrollTop = logEl.scrollHeight;
}

export function appendLog(text, className) {
  const line = document.createElement('div');
  if (className) line.className = className;
  line.textContent = text;
  logEl.appendChild(line);
  scrollLogToBottom();
  return line;
}
