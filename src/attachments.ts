// Files and pictures attached to a prompt: images go to Claude as image
// blocks (it sees them), PDFs as document blocks, and text/code files inline
// as text. Anything else is refused with a reason.
import path from 'node:path';

export const MAX_ATTACHMENTS = 5;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_PDF_BYTES = 30 * 1024 * 1024;
const MAX_TEXT_BYTES = 200 * 1024;

const IMAGE_TYPES: Record<string, string> = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

export type Attachment =
  | { name: string; kind: 'image'; mediaType: string; data: string }
  | { name: string; kind: 'pdf'; mediaType: 'application/pdf'; data: string }
  | { name: string; kind: 'text'; text: string };

const mb = (n: number) => `${Math.round(n / 1024 / 1024)}MB`;

// Bytes that decode as UTF-8 text without NULs (a cheap "is this binary?").
function asText(bytes: Buffer): string | null {
  if (bytes.includes(0)) return null;
  const text = bytes.toString('utf-8');
  return text.includes('�') ? null : text;
}

export function toAttachment(name: string, bytes: Buffer): Attachment | { error: string } {
  const ext = path.extname(name).toLowerCase();
  const image = IMAGE_TYPES[ext];
  if (image) {
    if (bytes.length > MAX_IMAGE_BYTES) return { error: `${name}: 이미지는 ${mb(MAX_IMAGE_BYTES)}까지 첨부할 수 있다` };
    return { name, kind: 'image', mediaType: image, data: bytes.toString('base64') };
  }
  if (ext === '.pdf') {
    if (bytes.length > MAX_PDF_BYTES) return { error: `${name}: PDF는 ${mb(MAX_PDF_BYTES)}까지 첨부할 수 있다` };
    return { name, kind: 'pdf', mediaType: 'application/pdf', data: bytes.toString('base64') };
  }
  if (bytes.length > MAX_TEXT_BYTES) return { error: `${name}: 텍스트 파일은 ${MAX_TEXT_BYTES / 1024}KB까지 첨부할 수 있다` };
  const text = asText(bytes);
  if (text === null) return { error: `${name}: 이미지·PDF·텍스트 파일만 첨부할 수 있다` };
  return { name, kind: 'text', text };
}

// The user message content for a turn: plain text when nothing is attached.
export function buildUserContent(prompt: string, attachments: Attachment[]): string | unknown[] {
  if (!attachments.length) return prompt;
  const blocks: unknown[] = attachments.map((a) =>
    a.kind === 'image'
      ? { type: 'image', source: { type: 'base64', media_type: a.mediaType, data: a.data } }
      : a.kind === 'pdf'
        ? { type: 'document', source: { type: 'base64', media_type: a.mediaType, data: a.data }, title: a.name }
        : { type: 'text', text: `첨부 파일 ${a.name}:\n\`\`\`\n${a.text}\n\`\`\`` },
  );
  blocks.push({ type: 'text', text: prompt });
  return blocks;
}
