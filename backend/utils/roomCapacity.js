const isRoomFull = (currentOccupancy, totalCapacity) =>
  Number(currentOccupancy) >= Number(totalCapacity);

const getInitialRoomStatus = (initialOccupancy, totalCapacity) =>
  isRoomFull(initialOccupancy, totalCapacity) ? 'closed' : 'open';

const getRoomStatusAfterAdmission = (currentStatus, nextOccupancy, totalCapacity) =>
  isRoomFull(nextOccupancy, totalCapacity) ? 'closed' : currentStatus;

const getRoomStatusAfterRemoval = (currentStatus, currentOccupancy, totalCapacity) =>
  isRoomFull(currentOccupancy, totalCapacity) ? 'open' : currentStatus;

const getOccupancyAfterRemoval = (currentOccupancy) =>
  Math.max(1, Number(currentOccupancy) - 1);

module.exports = {
  isRoomFull,
  getInitialRoomStatus,
  getRoomStatusAfterAdmission,
  getRoomStatusAfterRemoval,
  getOccupancyAfterRemoval
};
