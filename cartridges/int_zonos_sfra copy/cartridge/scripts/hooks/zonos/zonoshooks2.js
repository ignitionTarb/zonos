'use strict';

//API includes
var Status = require('dw/system/Status');

//script includes
var Zonos = require('*/cartridge/scripts/zonos');

/**
 * Retrieves duty/taxes from Zonos API.
 * @params - basket Object
 */
exports.calculateTax = function(basket) {
    var currentSite = dw.system.Site.getCurrent();

    if (currentSite.getCustomPreferenceValue('zonos_enabled')) {
		var zonosMessage = '';
		var zonosLandedCostId = '';

		// If Address and products, call API, save taxes, etc. back to basket
		if (basket.shipments[0].shippingAddress && basket.productLineItems.length > 0) {
			var address = basket.shipments[0].shippingAddress;
			var products = basket.allProductLineItems;
			var shippingMethod = basket.shipments[0].shippingMethod;
			var shippingPrice = basket.shipments[0].shippingTotalPrice.value;
			var zonosTax = Zonos.getTax(address, products, shippingMethod, shippingPrice);

			if (zonosTax && !zonosTax.error) {

				var Resource = require('dw/web/Resource');
				if (zonosTax.customs.delivery_duty_paid) {
					if (zonosTax.customs.delivery_duty_paid === "available") {
						if (zonosTax.amount_subtotal.duties + zonosTax.amount_subtotal.fees + zonosTax.amount_subtotal.taxes > 0) {
							zonosMessage = Resource.msg('label.zonos.tax.included', 'pricing', null);
						}
						else {
							zonosMessage = Resource.msg('label.zonos.tax.none', 'pricing', null);
						}

						calcLineItemTaxes(zonosTax, basket);
					}
					else if (zonosTax.customs.delivery_duty_paid === "unknown" || zonosTax.customs.delivery_duty_paid === "disabled") {
						if (zonosTax.amount_subtotal.duties + zonosTax.amount_subtotal.fees + zonosTax.amount_subtotal.taxes > 0) {
							zonosMessage = Resource.msgf('label.zonos.tax.estimated', 'pricing', null, zonosTax.amount_subtotal.duties + zonosTax.amount_subtotal.fees + zonosTax.amount_subtotal.taxes);
						}

						zeroOutTaxes(basket);
					}
				}
				if (zonosTax.id) {
					zonosLandedCostId = zonosTax.id;
				}
			}
			else {
				// Default to calling OOB calculation (or another cartridge hook implementation)
				require('*/cartridge/scripts/hooks/cart/calculate').calculateTax(basket);
			}
		}

		var Transaction = require('dw/system/Transaction');
		Transaction.wrap(function () {
			basket.custom.zonosMessage = zonosMessage;
			basket.custom.zonosLandedCostId = zonosLandedCostId;
		});

		return new Status(Status.OK);
	}
	else {
		// Calling OOB calculation (or another cartridge hook implementation) if Zonos is not enabled
		require('*/cartridge/scripts/hooks/cart/calculate').calculateTax(basket);
	}
}

function calcLineItemTaxes(zonosTax, basket) {
	var Transaction = require('dw/system/Transaction');
	var Money = require('dw/value/Money');

	// Loop through basket PLIs, create dictionary
	var costs = {};
	costs["shipping"] = 0;
	var productLineItems = basket.getAllProductLineItems();
	for (var i = 0; i < productLineItems.length; i++) {
		costs[productLineItems[i].productID] = 0;
	}

	// Loop through API response, total up tax, duty, fee values for products, or shipping for non-product fees
	if (zonosTax.duties) {
		zonosTax.duties.forEach(function(element){
			if (element.item_id) {
				costs[element.item_id] += element.amount;
			}
			else {
				costs["shipping"] += element.amount;
			}
		});
	}

	if (zonosTax.taxes) {
		zonosTax.taxes.forEach(function(element){
			if (element.item_id) {
				costs[element.item_id] += element.amount;
			}
			else {
				costs["shipping"] += element.amount;
			}
		});
	}

	if (zonosTax.fees) {
		zonosTax.fees.forEach(function(element){
			if (element.item_id) {
				costs[element.item_id] += element.amount;
			}
			else {
				costs["shipping"] += element.amount;
			}
		});
	}

	// Loop through basket LIs, apply totals
	Transaction.wrap(function () {
		var lineItems = basket.getAllLineItems();

		for (var i = 0; i < lineItems.length; i++) {
			if ('shippingPriceAdjustments' in lineItems[i]) {
				//lineItems[i].setTax(new Money(costs["shipping"], basket.currencyCode));
				lineItems[i].updateTaxAmount(new Money(costs["shipping"], basket.currencyCode));
				// Setting Gross Price so basket total is calculated properly.
				lineItems[i].setGrossPrice(new Money(lineItems[i].netPrice + costs["shipping"], basket.currencyCode));
			}
			else {
				var newTaxValue = costs[lineItems[i].productID];
				//lineItems[i].setTax(new Money(newTaxValue, basket.currencyCode));
				lineItems[i].updateTaxAmount(new Money(costs["shipping"], basket.currencyCode));
				// Setting Gross Price so basket total is calculated properly.
				lineItems[i].setGrossPrice(new Money(lineItems[i].netPrice + newTaxValue, basket.currencyCode));
				// Setting tax rate, so order details won't show an inaccurate (ignored) value
				lineItems[i].setTaxRate(0);
			}
		}
	});

}

function zeroOutTaxes(basket) {
	var Transaction = require('dw/system/Transaction');
	var Money = require('dw/value/Money');

	Transaction.wrap(function () {

		var lineItems = basket.getAllLineItems();

		for (var i = 0; i < lineItems.length; i++) {
			lineItems[i].setTax(new Money(0, basket.currencyCode));
			 //Setting Gross Price so basket total is calculated properly.
			lineItems[i].setGrossPrice(lineItems[i].netPrice);
			lineItems[i].setTaxRate(0);
		}
	});

}
