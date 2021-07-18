'use strict';

/*
	This line has to be updated to reference checkoutHelpers.js from the site cartridge's checkoutHelpers.js
*/
var base = require('app_storefront_base/cartridge/scripts/checkout/shippingHelpers');

var collections = require('*/cartridge/scripts/util/collections');
var ArrayList = require('dw/util/ArrayList');
var ShippingMgr = require('dw/order/ShippingMgr');
var ShippingMethodModel = require('*/cartridge/models/shipping/shippingMethod');

/**
 * Plain JS object that represents a DW Script API dw.order.ShippingMethod object
 * @param {dw.order.Shipment} shipment - the target Shipment
 * @param {Object} [address] - optional address object
 * @returns {dw.util.Collection} an array of ShippingModels
 */
function getApplicableShippingMethods(shipment, address) {
    if (!shipment) return null;

    var shipmentShippingModel = ShippingMgr.getShipmentShippingModel(shipment);

    var shippingMethods;

    if (address) {
        shippingMethods = shipmentShippingModel.getApplicableShippingMethods(address);
    } else {
        shippingMethods = shipmentShippingModel.getApplicableShippingMethods();
    }

    if (shipment.shippingAddress) {
        var Zonos = require('*/cartridge/scripts/zonos.js');
        var Money = require('dw/value/Money');
        
        var zonosShipping = Zonos.getShippingMethods(shipment.shippingAddress, shipment.productLineItems);
        if (zonosShipping && zonosShipping.shippingQuotes && !('messages' in zonosShipping.shippingQuotes[0])) {
            // Loop through line items to find shipping line item, so a custom message can be displayed.
            var lineItems = shipment.allLineItems;
            var shippingLineItem;
            for each(lineItem in lineItems) {
                if ('shippingPriceAdjustments' in lineItem) {
                    shippingLineItem = lineItem;
                    break;
                }
            }

            // Clear OOB shipping methods (Future state may need to make this configurable.)
            var zonosShippingMethods = new ArrayList();

            zonosShipping.shippingQuotes.forEach(function (zonosShippingMethod) {                        
                var updatedShippingMethod = zonosShippingMethod;
                updatedShippingMethod.ID = zonosShippingMethod.carrierServiceId;
                updatedShippingMethod.estimatedArrivalTime = zonosShippingMethod.minTransit + '-' + zonosShippingMethod.maxTransit + ' ' + zonosShippingMethod.transitTimeType;
                updatedShippingMethod.shippingCost = new Money(zonosShippingMethod.shippingTotal, "USD").toFormattedString(); // TODO: Unhardcode currency code 
                updatedShippingMethod.custom = { storePickupEnabled: false, zonosMessage: shippingLineItem.custom.zonosMessage };
                zonosShippingMethods.push(updatedShippingMethod);
            });

            return zonosShippingMethods;
        }
    }
    
    // Filter out whatever the method associated with in store pickup
    var filteredMethods = [];
    collections.forEach(shippingMethods, function (shippingMethod) {
        if (!shippingMethod.custom.storePickupEnabled) {
            filteredMethods.push(new ShippingMethodModel(shippingMethod, shipment));
        }
    });

    return filteredMethods;
}

base.getApplicableShippingMethods = getApplicableShippingMethods;

module.exports = base;
