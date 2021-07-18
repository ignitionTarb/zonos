'use strict';

var base = module.superModule;

/**
 * @constructor
 * @classdesc OrderModel class that represents the current basket
 *
 * @param {dw.order.LineItemCtnr} lineItemContainer - Current users's basket/order
 * @param {Object} options - The current order's line items
 */
function OrderModel(lineItemContainer, options) {
    base.call(this, lineItemContainer, options);

    if ('zonosMessage' in lineItemContainer.custom) {
        this.zonosMessage = lineItemContainer.custom.zonosMessage;
    }
}

OrderModel.prototype = Object.create(base.prototype);

module.exports = OrderModel;
