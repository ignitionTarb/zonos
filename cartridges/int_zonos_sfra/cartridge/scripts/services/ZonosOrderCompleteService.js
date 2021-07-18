'use strict';

var LocalServiceRegistry = require('dw/svc/LocalServiceRegistry');
var OrderMgr = require('dw/order/OrderMgr');
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
            var order = OrderMgr.getOrder(params.orderId);

            svc.setURL(credentials.getURL());
            svc.setRequestMethod('POST');
            svc.addHeader('serviceToken', Site.current.getCustomPreferenceValue('zonos_api_key'));
            svc.addHeader('zonos-version', Site.current.getCustomPreferenceValue('zonos_order_complete_version'));
            svc.addHeader('Content-Type', 'application/json');
            var test = Site.current.getCustomPreferenceValue('zonos_order_complete_version');
           
            var data = {};
            data.account_order_id = params.orderId;
            data.landed_cost_id = order.custom.zonosLandedCostId;
            
            var parties = [];
            data.parties = parties;
            var iterator = order.getShipments().iterator();
            while (iterator.hasNext()) {
                var shipment = iterator.next();
            	var party = {};
            	
            	party.city = shipment.getShippingAddress().getCity();
            	party.contact_email = order.getCustomerEmail();
            	party.contact_name = shipment.getShippingAddress().getFullName();
            	party.contact_phone = shipment.getShippingAddress().getPhone();
            	party.country = shipment.getShippingAddress().getCountryCode().value;
            	party.line1 = shipment.getShippingAddress().getAddress1();
            	party.line2 = shipment.getShippingAddress().getAddress2();
            	party.postal_code = shipment.getShippingAddress().getPostalCode();
            	party.type = "ship_to";
            	
            	parties.push(party);
            }

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
