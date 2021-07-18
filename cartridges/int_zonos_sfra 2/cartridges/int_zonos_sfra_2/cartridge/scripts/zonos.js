/**
 * Helps connect SFCC to Zonos services
 */

'use strict';

var HTTPClient = require('dw/net/HTTPClient');
var Site = require('dw/system/Site');

function sendZonosOrderData(orderId) {
    var jsonobj = {
		"store": Site.current.getCustomPreferenceValue('zonos_storeId'),
		"secret": Site.current.getCustomPreferenceValue('zonos_secret'),
		"orderId": orderId,
		"trackingList": []
	};

    var httpClient = new HTTPClient();
    var message;
    httpClient.open('POST', Site.current.getCustomPreferenceValue('zonos_OrderCompleteAPIURL'));
    httpClient.setRequestHeader('serviceToken', Site.current.getCustomPreferenceValue('zonos_token'));
    httpClient.setRequestHeader('Content-Type', 'application/json');
    httpClient.setTimeout(3000);
    httpClient.send(JSON.stringify(jsonobj));
    if (httpClient.statusCode == 200)
    {
        message = httpClient.text;
    }
    else
    {
        // error handling
        message = "An error occurred with status code " + httpClient.statusCode;
    }
    return JSON.parse(message);
}

function getShippingMethods(shippingAddress, productLineItems) {
	var serializedLineItems = serializeLineItems(productLineItems);

	var jsonobj = {
		"shipFromAddress": null,
		"shipToAddress": {
			"name": shippingAddress.lastName ? shippingAddress.firstName + " " + shippingAddress.lastName : null,
			"address1": shippingAddress.address1,
			"address2": shippingAddress.address2,
			"city": shippingAddress.city,
			"stateCode": shippingAddress.stateCode,
			"postalCode": shippingAddress.postalCode,
			"countryCode": shippingAddress.countryCode.value
		},
		"boxCount": null,
		"shippingAmountOverride": null,
		"items": serializedLineItems
	};

	var httpClient = new HTTPClient();
	var message;
	httpClient.open('POST', Site.current.getCustomPreferenceValue('zonos_LandedCostAPIURL'));
	httpClient.setRequestHeader('serviceToken', Site.current.getCustomPreferenceValue('zonos_token'));
	httpClient.setRequestHeader('Content-Type', 'application/json');
	httpClient.setTimeout(3000);
	httpClient.send(JSON.stringify(jsonobj));
	if (httpClient.statusCode == 200)
	{
		message = httpClient.text;
	}
	else
	{
		// error handling
		var result = {
			"message": "An error occurred with status code " + httpClient.statusCode,
			"error": true
		};

		return result;
	}

	return JSON.parse(message);
}

function serializeLineItems(productLineItems) {
	var serializedLineItems = [];

	var i = 1;
	for each(productLineItem in productLineItems) {
		var li = productLineItem;

		// TODO: make these other properties optional (if they exist on the produce, then set them)
		var lineItem = {
			"cartItemId": i++,
			"detailedDescription": productLineItem.lineItemText,
			//"category": "sunglasses",
			"productId": productLineItem.productID,
			// "sku": "oakley-123",
			"unitPrice": productLineItem.basePrice.value,
			"quantity": productLineItem.quantity.value
			// "length": 2.5,
			// "width": 6.5,
			// "height": 2.5,
			// "dimensionalUnits": null,
			// "weight": 4,
			// "weightUnits": "OZ",
			// "hsCode": null,
			// "brandName": "Oakley",
			// "countryOfOrigin": "CN"
		};

		serializedLineItems.push(lineItem);
	}

	return serializedLineItems;
}

//module exports
module.exports = {
	getShippingMethods: getShippingMethods,
	sendZonosOrderData: sendZonosOrderData
}
