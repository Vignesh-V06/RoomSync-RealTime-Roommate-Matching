const test = require('node:test');
const assert = require('node:assert/strict');
const zlib = require('node:zlib');
const { createWorkbook } = require('../utils/xlsxWorkbook');

const readZipEntries = (archive) => {
  const entries = new Map();
  let offset = 0;
  while (offset + 4 <= archive.length && archive.readUInt32LE(offset) === 0x04034B50) {
    const method = archive.readUInt16LE(offset + 8);
    const compressedSize = archive.readUInt32LE(offset + 18);
    const nameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = archive.subarray(nameStart, nameStart + nameLength).toString('utf8');
    const compressed = archive.subarray(dataStart, dataStart + compressedSize);
    assert.equal(method, 8, 'workbook entries should use deflate compression');
    entries.set(name, zlib.inflateRawSync(compressed).toString('utf8'));
    offset = dataStart + compressedSize;
  }
  return entries;
};

test('creates a readable multi-sheet XLSX package', () => {
  const workbook = createWorkbook([
    { name: 'Overview', rows: [{ metric: 'Student accounts', value: 12 }] },
    { name: 'Users', rows: [{ name: 'Alice & Bob', email: 'alice@example.com' }] },
    { name: 'Rooms', rows: [{ room_id: 7, status: 'open' }] }
  ]);

  assert.ok(Buffer.isBuffer(workbook));
  assert.equal(workbook.readUInt32LE(0), 0x04034B50, 'file begins with a ZIP local-file header');

  const entries = readZipEntries(workbook);
  assert.ok(entries.has('[Content_Types].xml'));
  assert.ok(entries.has('xl/workbook.xml'));
  assert.ok(entries.has('xl/worksheets/sheet1.xml'));
  assert.ok(entries.has('xl/worksheets/sheet2.xml'));
  assert.ok(entries.has('xl/worksheets/sheet3.xml'));
  assert.match(entries.get('xl/workbook.xml'), /name="Overview"/);
  assert.match(entries.get('xl/workbook.xml'), /name="Users"/);
  assert.match(entries.get('xl/worksheets/sheet2.xml'), /Alice &amp; Bob/);
  assert.match(entries.get('xl/worksheets/sheet1.xml'), /Student accounts/);
});

test('rejects an empty workbook definition', () => {
  assert.throws(() => createWorkbook([]), /between 1 and 20 sheets/);
});

test('rejects more than twenty worksheets', () => {
  const sheets = Array.from({ length: 21 }, (_, index) => ({ name: 'S' + index, rows: [] }));
  assert.throws(() => createWorkbook(sheets), /between 1 and 20 sheets/);
});
