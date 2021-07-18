'use strict';

exports.afterPATCH = function(order, orderInput) {
	var trackingList = [];
	
	if (orderInput.shipments != null) {
		for (var iCtr = 0; iCtr < orderInput.shipments.length; iCtr++) {
			var shipment = orderInput.shipments[iCtr];
			if (shipment != null && shipment.trackingNumber != null) {
				var trackingNumber = {};
				trackingNumber.number = shipment.trackingNumber;
				trackingList.push(trackingNumber);
			}
		}
	}

	if (trackingList.length > 0) {
		var Zonos = require('*/cartridge/scripts/zonos.js');
		Zonos.sendZonosUpdateTracking(order.custom.zonosOrderId, trackingList);
	}
};