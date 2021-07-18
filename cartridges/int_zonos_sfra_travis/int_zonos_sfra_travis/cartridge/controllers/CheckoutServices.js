'use strict';

var server = require('server');

server.extend(module.superModule);

server.append('PlaceOrder', server.middleware.https, function (req, res, next) {
    if ('zonos_enabled' in dw.system.Site.current.preferences.custom && dw.system.Site.current.preferences.custom.zonos_enabled) {
        var Zonos = require('*/cartridge/scripts/zonos.js');
    
        var viewData = res.getViewData();
        var orderId = viewData.orderID;
        
        Zonos.sendZonosOrderData(orderId);
    }

    return next();
});

module.exports = server.exports();
