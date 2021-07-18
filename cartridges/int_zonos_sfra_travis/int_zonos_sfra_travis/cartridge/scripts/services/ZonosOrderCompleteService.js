'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Site = require('dw/system/Site');

/**
 * @return {Object} - The Zonos Order Complete service
 */
function createService() {
    this.serviceToCall = null;
    this.requestObject = null;
    var service = LocalServiceRegistry.createService('Zonos_OrderComplete', {
        createRequest: function (svc, params) {
            var Logger = require('dw/system/Logger');
            Logger.debug('Params: ' + JSON.stringify(params));
            var credentials = service.getConfiguration().getCredential();

            svc.setURL(credentials.getURL());
            svc.setRequestMethod('POST');
            svc.addHeader('serviceToken', Site.current.getCustomPreferenceValue('zonos_token'));
            svc.addHeader('Content-Type', 'application/json');

            var data = {
                "store": Site.current.getCustomPreferenceValue('zonos_storeId'),
                "secret": Site.current.getCustomPreferenceValue('zonos_secret'),
                "orderId": params.orderId,
                "trackingList": []
            };

            data = JSON.stringify(data);

            var client = svc.getClient();
            client.open('POST', credentials.getURL());

            return data;
        },
        parseResponse: function (svc, response) {
            if (response.statusMessage && response.statusMessage === 'OK') {
                return JSON.parse(service.getClient().text);
            } else {
                return { error: true };
            }
        },
        mockCall: function (svc, request) {
            return { status: 'MOCKED' };
        }
    });
    return service;
}

exports.createService = createService;
