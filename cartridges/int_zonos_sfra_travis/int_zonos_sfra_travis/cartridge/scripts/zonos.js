/**
 * Helps connect SFCC to Zonos services
 */

'use strict';

var HTTPClient = require('dw/net/HTTPClient');
var Site = require('dw/system/Site');

function sendZonosOrderData(orderId) {
	var zonosService = require('*/cartridge/scripts/services/ZonosOrderCompleteService');
	
	var endpointParam = {
		"store": Site.current.getCustomPreferenceValue('zonos_storeId'),
		"secret": Site.current.getCustomPreferenceValue('zonos_secret'),
		"orderId": orderId,
		"trackingList": []
	};

	var service = zonosService.createService();
	var response = service.call(endpointParam);
	if (response.error) {
		var result = {
			"message": "An error occurred with status code " + response.error,
			"error": true
		};

		return result;
	}
	else {
		return JSON.parse(service.getClient().text);
	}
}

function getTax(shippingAddress, productLineItems, shippingMethod, shippingPrice) {
	var serializedLineItems = serializeLineItems(productLineItems);

	var zonosService = require('*/cartridge/scripts/services/ZonosLandedCostService');
	var endpointParam = {
		"currency": "USD",
		"items": serializedLineItems,
		"shipFromAddress": null,
		"ship_to": {
			"city": shippingAddress.city,
			"country": shippingAddress.countryCode.value,
			"postal_code": shippingAddress.postalCode,
			"state": shippingAddress.stateCode
		},
		"not_for_resale": true,
		"packages": null,
		"ship_from_country": "US",
		"shipping": {
		  "amount": shippingPrice,
		  "carrier": shippingMethod.custom.carrier,
		  "service_level": shippingMethod.custom.serviceLevel,
		  "isDdp": shippingMethod.custom.isDdp
		}
	};

	var service = zonosService.createService();
	var response = service.call(endpointParam);
	if (response.error) {
		var result = {
			"message": "An error occurred with status code " + response.error,
			"error": true
		};

		return result;
	}
	else {
		return JSON.parse(service.getClient().text);
	}
}

function serializeLineItems(productLineItems) {
	var serializedLineItems = [];

	for each(productLineItem in productLineItems) {
		var li = productLineItem;

		var lineItem = {
			"id": productLineItem.productID,
			"description_retail": productLineItem.lineItemText,
			"amount": productLineItem.basePrice.value,
			"category": productLineItem.category, // optional
			"dimensions": {},
			"quantity": productLineItem.quantity.value
		};

		if ('dimHeight' in productLineItem.product.custom) {
			lineItem.dimensions.height = productLineItem.product.custom.dimHeight;
		}

		if ('dimWidth' in productLineItem.product.custom) {
			lineItem.dimensions.width = productLineItem.product.custom.dimWidth;
		}

		if ('dimDepth' in productLineItem.product.custom) {
			lineItem.dimensions.length = productLineItem.product.custom.dimDepth;
		}

		if ('dimUnit' in productLineItem.product.custom) {
			lineItem.dimensions.unit = productLineItem.product.custom.dimUnit.value;
		}

		if ('dimWeight' in productLineItem.product.custom) {
			lineItem.weight = productLineItem.product.custom.dimWeight;
		}

		if ('dimWeightUnit' in productLineItem.product.custom) {
			lineItem.weight_unit = productLineItem.product.custom.dimWeightUnit.value;
		}

		serializedLineItems.push(lineItem);
	}

	return serializedLineItems;
}

//module exports
module.exports = {
	sendZonosOrderData: sendZonosOrderData,
	getTax: getTax
}
