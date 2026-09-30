import test from 'node:test';
import assert from 'node:assert/strict';
import { toAttachment, buildUserContent, MAX_ATTACHMENTS } from '../src/attachments.ts';

const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);

test('images become image blocks, PDFs documents, text files inline text', () => {
  const img = toAttachment('shot.png', png);
  assert.ok(!('error' in img) && img.kind === 'image' && img.mediaType === 'image/png');
  const pdf = toAttachment('spec.pdf', Buffer.from('%PDF-1.7 ...'));
  assert.ok(!('error' in pdf) && pdf.kind === 'pdf');
  const code = toAttachment('main.ts', Buffer.from('export const x = 1;\n'));
  assert.ok(!('error' in code) && code.kind === 'text' && code.text === 'export const x = 1;\n');
});

test('unsupported, binary or oversized files are refused with a reason', () => {
  assert.ok('error' in toAttachment('a.zip', Buffer.from([0x50, 0x4b, 3, 4, 0, 0])));
  assert.ok('error' in toAttachment('blob.bin', Buffer.from([0, 1, 2, 0, 0, 255])));
  assert.ok('error' in toAttachment('big.png', Buffer.concat([png, Buffer.alloc(6 * 1024 * 1024)])));
  assert.ok('error' in toAttachment('big.log', Buffer.alloc(300 * 1024, 'a')));
});

test('the user message carries the attachments before the prompt; none = plain text', () => {
  assert.equal(buildUserContent('hi', []), 'hi');
  const img = toAttachment('shot.png', png);
  const code = toAttachment('main.ts', Buffer.from('x'));
  const blocks = buildUserContent('이 화면 고쳐줘', [img as any, code as any]) as any[];
  assert.equal(blocks[0].type, 'image');
  assert.equal(blocks[0].source.media_type, 'image/png');
  assert.equal(blocks[1].type, 'text');
  assert.match(blocks[1].text, /main\.ts/);
  assert.deepEqual(blocks.at(-1), { type: 'text', text: '이 화면 고쳐줘' });
  assert.equal(MAX_ATTACHMENTS, 5);
});
