'use strict';

var server = require('server');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

server.extend(module.superModule);

server.append(
    'Begin',
    server.middleware.https,
    consentTracking.consent,
    csrfProtection.generateToken,
    function (req, res, next) {
        var viewData = res.getViewData();
        viewData.order.shipping[0].selectedShippingMethod.shippingCost = viewData.order.totals.totalShippingCost;

        // Load custom Zonos tax/duty message
        var BasketMgr = require('dw/order/BasketMgr');
        var currentBasket = BasketMgr.getCurrentBasket();
        if (currentBasket) {
            // Loop through line items to find shipping line item, so a custom message can be set.
            var lineItems = currentBasket.allLineItems;
            for (var i = 0; i < lineItems.length; i++) {
                if ('shippingPriceAdjustments' in lineItems[i]) {
                    viewData.zonosMessage = lineItems[i].custom.zonosMessage;
                    break;
                }
            }
        }

        res.setViewData(viewData);

        return next();
    }
);

module.exports = server.exports();
