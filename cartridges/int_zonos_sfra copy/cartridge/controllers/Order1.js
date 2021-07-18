'use strict';

var server = require('server');

var csrfProtection = require('*/cartridge/scripts/middleware/csrf');
var consentTracking = require('*/cartridge/scripts/middleware/consentTracking');

server.extend(module.superModule);

server.append(
    'Confirm',
    server.middleware.https,
    consentTracking.consent,
    csrfProtection.generateToken,
    function (req, res, next) {
        var viewData = res.getViewData();
        
        // Load custom Zonos tax/duty message
        var OrderMgr = require('dw/order/OrderMgr');
        
        var order = OrderMgr.getOrder(req.querystring.ID);
        var token = req.querystring.token ? req.querystring.token : null;

        if (order
            && token
            && token === order.orderToken
            && order.customer.ID === req.currentCustomer.raw.ID
        ) {
            // Loop through line items to find shipping line item, so a custom message can be set.
            var lineItems = order.allLineItems;
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
