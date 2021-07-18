'use strict';

//API includes
var Site = require('dw/system/Site');
var Status = require('dw/system/Status');

//script includes
var Zonos = require('*/cartridge/scripts/zonos');

/**
 * Retrieves shipping cost from Zonos API.
 * @params - basket Object
 */
exports.calculateShipping = function(basket) {

	// Default to calling OOB calculation
	require('*/cartridge/scripts/hooks/cart/calculate').calculateShipping(basket);

	// If Address and products, call API, save shipping cost back to basket
	if (basket.shipments[0].shippingAddress && basket.productLineItems.length > 0) {
		var zonosShipping = Zonos.getShippingMethods(basket.shipments[0].shippingAddress, basket.allProductLineItems);
		if (zonosShipping && zonosShipping.shippingQuotes && !('messages' in zonosShipping.shippingQuotes[0])) {

			var shippingMethod = basket.shipments[0].shippingMethod;

			if (shippingMethod.custom.isZonos) {
				// Loop through shipping methods in response, look for a match to the basket's selected shipping method.
				zonosShipping.shippingQuotes.forEach(function (zonosShippingMethod) {
					if (zonosShippingMethod.carrierServiceId === shippingMethod.ID) {

						var Transaction = require('dw/system/Transaction');

						Transaction.wrap(function () {
							var lineItems = basket.getAllLineItems();

							for each(lineItem in lineItems) {
								if ('shippingPriceAdjustments' in lineItem) {
									lineItem.setPriceValue(zonosShippingMethod.shippingTotal);
								}
							}
						});					
					}
				});
			}
		}
	}

	return new Status(Status.OK);
}

/**
 * Retrieves duty/taxes from Zonos API.
 * @params - basket Object
 */
exports.calculateTax = function(basket) {
	
	// Default to calling OOB calculation
	require('*/cartridge/scripts/hooks/cart/calculate').calculateTax(basket);

	// If Address and products, call API, save shipping cost back to basket
	if (basket.shipments[0].shippingAddress && basket.productLineItems.length > 0) {
		var zonosShipping = Zonos.getShippingMethods(basket.shipments[0].shippingAddress, basket.allProductLineItems);
		if (zonosShipping && zonosShipping.shippingQuotes && !('messages' in zonosShipping.shippingQuotes[0])) {

			var shippingMethod = basket.shipments[0].shippingMethod;

			if (shippingMethod.custom.isZonos) {
				// Loop through shipping methods in response, look for a match to the basket's selected shipping method.
				zonosShipping.shippingQuotes.forEach(function (zonosShippingMethod) {
					if (zonosShippingMethod.carrierServiceId === shippingMethod.ID) {

						// Loop through line items to find shipping line item, so a custom message can be displayed.
						var lineItems = basket.getAllLineItems();
						var shippingLineItem;
						for each(lineItem in lineItems) {
							if ('shippingPriceAdjustments' in lineItem) {
								shippingLineItem = lineItem;
								break;
							}
						}

						// PSEUDO CODE FOR TAX APPLICATION LOGIC
						var checkoutDutyTax = 0;
						
						if (!zonosShippingMethod.dutyTaxEnabled) {
							checkoutDutyTax = 0;
							// Hide duty tax prepay option
							// Display: Duty taxes may be due upon delivery
							shippingLineItem.custom.zonosMessage = "Duty taxes may be due upon delivery"; // TODO: Resourceificate this
							// Order.ddp = false
						}
						else {
							if (zonosShippingMethod.dutyTaxUnderDeminimus) {
								checkoutDutyTax = 0; // Not required == 0 ???
								// Hide duty tax prepay option
								// Display: No Duty or Taxes Due
								shippingLineItem.custom.zonosMessage = "No Duty or Taxes Due"; // TODO: Resourceificate this
								// Order.ddp = false
							}
							else {
								checkoutDutyTax = zonosShippingMethod.dutyTaxTotal;
								// Hide duty tax prepay option
								// Display: Duty taxes prepaid
								shippingLineItem.custom.zonosMessage = "Duty and Tax Included"; // TODO: Resourceificate this
								// Order.ddp = true
							}
						}

						calcLineItemTaxes(checkoutDutyTax, basket);
					}
				});
			}
		}
	}

	return new Status(Status.OK);
}

function calcLineItemTaxes(checkoutDutyTax, basket) {
	var Transaction = require('dw/system/Transaction');
	var Money = require('dw/value/Money');
	Transaction.wrap(function () {

		var lineItems = basket.getAllLineItems();

		for each(lineItem in lineItems) {
			if ('shippingPriceAdjustments' in lineItem) {
				lineItem.setTax(new Money(0, basket.currencyCode));
				// Setting Gross Price so basket total is calculated properly.
				lineItem.setGrossPrice(lineItem.netPrice);
			}
			else {
				var newTaxValue = checkoutDutyTax * (lineItem.adjustedPrice / basket.merchandizeTotalPrice);
				lineItem.setTax(new Money(newTaxValue, basket.currencyCode));
				// Setting Gross Price so basket total is calculated properly.
				lineItem.setGrossPrice(new Money(lineItem.netPrice + newTaxValue, basket.currencyCode));
				// Setting tax rate, so order details don't show an inaccurate (ignored) value
				lineItem.setTaxRate(0);
			}
		}
	});
}