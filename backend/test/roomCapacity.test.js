const test = require('node:test');
const assert = require('node:assert/strict');
const {
  isRoomFull,
  getInitialRoomStatus,
  getRoomStatusAfterAdmission,
  getRoomStatusAfterRemoval,
  getOccupancyAfterRemoval
} = require('../utils/roomCapacity');

test('a room closes immediately when its owner already fills the only bed', () => {
  assert.equal(getInitialRoomStatus(1, 1), 'closed');
  assert.equal(getInitialRoomStatus(1, 2), 'open');
});

test('admitting the final roommate closes an open room', () => {
  assert.equal(getRoomStatusAfterAdmission('open', 1, 3), 'open');
  assert.equal(getRoomStatusAfterAdmission('open', 2, 2), 'closed');
  assert.equal(isRoomFull(2, 2), true);
});

test('removing a roommate reopens a room that was closed at capacity', () => {
  assert.equal(getRoomStatusAfterRemoval('closed', 2, 2), 'open');
});

test('removing a roommate does not reopen a listing manually closed below capacity', () => {
  assert.equal(getRoomStatusAfterRemoval('closed', 2, 4), 'closed');
  assert.equal(getRoomStatusAfterRemoval('open', 2, 4), 'open');
});

test('room occupancy never falls below the owner-only bed', () => {
  assert.equal(getOccupancyAfterRemoval(3), 2);
  assert.equal(getOccupancyAfterRemoval(2), 1);
  assert.equal(getOccupancyAfterRemoval(1), 1);
});
