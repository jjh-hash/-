function extractFloorFromAddress(addressObj) {
  const text = [
    addressObj && addressObj.buildingName,
    addressObj && addressObj.houseNumber,
    addressObj && addressObj.addressDetail,
    addressObj && addressObj.address
  ].filter(Boolean).join(' ');
  if (!text) return null;

  const floorMatch = text.match(/([1-6])\s*楼/);
  if (floorMatch) return parseInt(floorMatch[1], 10);

  const roomMatch = text.match(/\b([1-6])\d{2,3}\b/);
  if (roomMatch) return parseInt(roomMatch[1], 10);

  return null;
}

function calculateDeliveryFeeFenByAddress(addressObj) {
  const floor = extractFloorFromAddress(addressObj);
  if (floor >= 1 && floor <= 3) return 150;
  if (floor >= 4 && floor <= 6) return 200;
  return 200;
}

function calculateRiderIncomeFenByAddress(addressObj) {
  const floor = extractFloorFromAddress(addressObj);
  if (floor >= 1 && floor <= 3) return 100;
  if (floor >= 4 && floor <= 6) return 130;
  return 130;
}

function getRiderIncomeFenFromOrder(order) {
  if (order && typeof order.riderIncome === 'number') {
    return order.riderIncome;
  }
  const deliveryFen = order && typeof order.amountDelivery === 'number' ? order.amountDelivery : 0;
  if (deliveryFen === 150) return 100;
  if (deliveryFen === 200) return 130;
  return 130;
}

module.exports = {
  extractFloorFromAddress,
  calculateDeliveryFeeFenByAddress,
  calculateRiderIncomeFenByAddress,
  getRiderIncomeFenFromOrder
};
