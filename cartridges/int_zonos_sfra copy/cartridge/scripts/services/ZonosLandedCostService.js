'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var Site = require('dw/system/Site');

/**
 * @return {Object} - The Zonos Landed Cost service
 */
function createService() {
    this.serviceToCall = null;
    this.requestObject = null;
    var service = LocalServiceRegistry.createService('Zonos_LandedCost', {
        createRequest: function (svc, params) {
            var Logger = require('dw/system/Logger');
            Logger.debug('Params: ' + JSON.stringify(params));
            var credentials = service.getConfiguration().getCredential();

            var storeId = encodeURIComponent(Site.getCurrent().getCustomPreferenceValue('zonos_storeId'));
            svc.setURL(credentials.getURL() + '?storeId=' + storeId);
            svc.setRequestMethod('POST');
            svc.addHeader('serviceToken', Site.current.getCustomPreferenceValue('zonos_api_key'));
            svc.addHeader('zonos-version', Site.current.getCustomPreferenceValue('zonos_landed_cost_version'));
            svc.addHeader('Content-Type', 'application/json');

            var data = JSON.stringify(params);

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
