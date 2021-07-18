'use strict';

var server = require('server');
var csrfProtection = require('*/cartridge/scripts/middleware/csrf');

server.extend(module.superModule);

server.replace('SelectShippingMethod', server.middleware.https, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Resource = require('dw/web/Resource');
    var Transaction = require('dw/system/Transaction');
    var AccountModel = require('*/cartridge/models/account');
    var OrderModel = require('*/cartridge/models/order');
    var URLUtils = require('dw/web/URLUtils');
    var ShippingHelper = require('*/cartridge/scripts/checkout/shippingHelpers');
    var Locale = require('dw/util/Locale');
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');
    var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.json({
            error: true,
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    var shipmentUUID = req.querystring.shipmentUUID || req.form.shipmentUUID;
    var shippingMethodID = req.querystring.methodID || req.form.methodID;
    var shipment;
    if (shipmentUUID) {
        shipment = ShippingHelper.getShipmentByUUID(currentBasket, shipmentUUID);
    } else {
        shipment = currentBasket.defaultShipment;
    }

    var viewData = res.getViewData();
    viewData.address = ShippingHelper.getAddressFromRequest(req);
    viewData.isGift = req.form.isGift === 'true';
    viewData.giftMessage = req.form.isGift ? req.form.giftMessage : null;
    res.setViewData(viewData);

    this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
        var shippingData = res.getViewData();
        var address = shippingData.address;

        try {
            Transaction.wrap(function () {
                var shippingAddress = shipment.shippingAddress;

                if (!shippingAddress) {
                    shippingAddress = shipment.createShippingAddress();
                }

                shippingAddress.setFirstName(address.firstName || '');
                shippingAddress.setLastName(address.lastName || '');
                shippingAddress.setAddress1(address.address1 || '');
                shippingAddress.setAddress2(address.address2 || '');
                shippingAddress.setCity(address.city || '');
                shippingAddress.setPostalCode(address.postalCode || '');
                shippingAddress.setStateCode(address.stateCode || '');
                shippingAddress.setCountryCode(address.countryCode || '');
                shippingAddress.setPhone(address.phone || '');

                ShippingHelper.selectShippingMethod(shipment, shippingMethodID);

                basketCalculationHelpers.calculateTotals(currentBasket);
            });
        } catch (err) {
            res.setStatusCode(500);
            res.json({
                error: true,
                errorMessage: Resource.msg('error.cannot.select.shipping.method', 'cart', null)
            });

            return;
        }

        COHelpers.setGift(shipment, shippingData.isGift, shippingData.giftMessage);

        var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
        var currentLocale = Locale.getLocale(req.locale.id);

        var basketModel = new OrderModel(
            currentBasket,
            { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' }
        );

        // Loop through line items to find shipping line item, so we can clear the custom message.
        var lineItems = currentBasket.allLineItems;
        for (var i = 0; i < lineItems.length; i++) {
            if ('shippingPriceAdjustments' in lineItems[i]) {
                Transaction.wrap(function () {
                    lineItems[i].custom.zonosMessage = '';
                });
            }
        }

        // If applicable shipping method list is a list of Zonos shipping methods, loop through applicable shipping 
        // methods to find selected one, so that selectedShippingMethod can be updated with attributes needed to update UI.
        if (Object.prototype.toString.call(basketModel.shipping[0].applicableShippingMethods) === '[object JavaObject]')
        {
            var iterator = basketModel.shipping[0].applicableShippingMethods.iterator();
            var shippingMethod;
            
            while (iterator.hasNext()) {
                shippingMethod = iterator.next();
            
                if (shippingMethod.ID === basketModel.shipping[0].selectedShippingMethod.ID) {
                    var Money = require('dw/value/Money');
                    basketModel.shipping[0].selectedShippingMethod.shippingCost = shippingMethod.shippingTotal;
                    basketModel.shipping[0].selectedShippingMethod.shippingCostFormatted = new Money(shippingMethod.shippingTotal, "USD").toFormattedString(); // basketModel.currencyCode
                    basketModel.shipping[0].selectedShippingMethod.isZonos = true;
                    basketModel.shipping[0].selectedShippingMethod.dutyTaxEnabled = shippingMethod.dutyTaxEnabled;
                    basketModel.shipping[0].selectedShippingMethod.dutyTaxForced = shippingMethod.dutyTaxForced;
                    basketModel.shipping[0].selectedShippingMethod.dutyTaxUnderDeminimus = shippingMethod.dutyTaxUnderDeminimus;
                    basketModel.shipping[0].selectedShippingMethod.dutyTaxTotal = shippingMethod.dutyTaxTotal;
                    basketModel.shipping[0].selectedShippingMethod.dutyTaxTotalFormatted = new Money(shippingMethod.dutyTaxTotal, "USD").toFormattedString(); // basketModel.currencyCode
                    basketModel.shipping[0].selectedShippingMethod.zonosMessage = shippingMethod.custom.zonosMessage;

                    break;
                }
            }

            // Finally, convert to a simple array, so that this object can be serialized and returned to client.
            basketModel.shipping[0].applicableShippingMethods = basketModel.shipping[0].applicableShippingMethods.toArray();
        }

        res.json({
            customer: new AccountModel(req.currentCustomer),
            order: basketModel
        });
    });

    return next();
});

server.replace('UpdateShippingMethodsList', server.middleware.https, function (req, res, next) {
    var BasketMgr = require('dw/order/BasketMgr');
    var Transaction = require('dw/system/Transaction');
    var AccountModel = require('*/cartridge/models/account');
    var OrderModel = require('*/cartridge/models/order');
    var URLUtils = require('dw/web/URLUtils');
    var ShippingHelper = require('*/cartridge/scripts/checkout/shippingHelpers');
    var Locale = require('dw/util/Locale');
    var basketCalculationHelpers = require('*/cartridge/scripts/helpers/basketCalculationHelpers');

    var currentBasket = BasketMgr.getCurrentBasket();

    if (!currentBasket) {
        res.json({
            error: true,
            cartError: true,
            fieldErrors: [],
            serverErrors: [],
            redirectUrl: URLUtils.url('Cart-Show').toString()
        });
        return next();
    }

    var shipmentUUID = req.querystring.shipmentUUID || req.form.shipmentUUID;
    var shipment;
    if (shipmentUUID) {
        shipment = ShippingHelper.getShipmentByUUID(currentBasket, shipmentUUID);
    } else {
        shipment = currentBasket.defaultShipment;
    }

    var address = ShippingHelper.getAddressFromRequest(req);

    var shippingMethodID;

    if (shipment.shippingMethod) {
        shippingMethodID = shipment.shippingMethod.ID;
    }

    Transaction.wrap(function () {
        var shippingAddress = shipment.shippingAddress;

        if (!shippingAddress) {
            shippingAddress = shipment.createShippingAddress();
        }

        Object.keys(address).forEach(function (key) {
            var value = address[key];
            if (value) {
                shippingAddress[key] = value;
            } else {
                shippingAddress[key] = null;
            }
        });

        ShippingHelper.selectShippingMethod(shipment, shippingMethodID);

        basketCalculationHelpers.calculateTotals(currentBasket);
    });

    var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
    var currentLocale = Locale.getLocale(req.locale.id);

    var basketModel = new OrderModel(
        currentBasket,
        { usingMultiShipping: usingMultiShipping, countryCode: currentLocale.country, containerView: 'basket' }
    );

    // If applicable shipping method list is a list of Zonos shipping methods, loop through applicable shipping 
    // methods to find selected one, so that selectedShippingMethod can be updated with attributes needed to update UI.
    if (Object.prototype.toString.call(basketModel.shipping[0].applicableShippingMethods) === '[object JavaObject]')
    {
        var iterator = basketModel.shipping[0].applicableShippingMethods.iterator();
        var shippingMethod;
        
        while (iterator.hasNext()) {
            shippingMethod = iterator.next();
        
            if (shippingMethod.ID === basketModel.shipping[0].selectedShippingMethod.ID) {
                var Money = require('dw/value/Money');
                basketModel.shipping[0].selectedShippingMethod.shippingCost = shippingMethod.shippingTotal;
                basketModel.shipping[0].selectedShippingMethod.shippingCostFormatted = new Money(shippingMethod.shippingTotal, "USD").toFormattedString(); // basketModel.currencyCode
                basketModel.shipping[0].selectedShippingMethod.isZonos = true;
                basketModel.shipping[0].selectedShippingMethod.dutyTaxEnabled = shippingMethod.dutyTaxEnabled;
                basketModel.shipping[0].selectedShippingMethod.dutyTaxForced = shippingMethod.dutyTaxForced;
                basketModel.shipping[0].selectedShippingMethod.dutyTaxUnderDeminimus = shippingMethod.dutyTaxUnderDeminimus;
                basketModel.shipping[0].selectedShippingMethod.dutyTaxTotal = shippingMethod.dutyTaxTotal;
                basketModel.shipping[0].selectedShippingMethod.dutyTaxTotalFormatted = new Money(shippingMethod.dutyTaxTotal, "USD").toFormattedString(); // basketModel.currencyCode
                basketModel.shipping[0].selectedShippingMethod.zonosMessage = shippingMethod.custom.zonosMessage;

                break;
            }
        }

        basketModel.shipping[0].applicableShippingMethods = basketModel.shipping[0].applicableShippingMethods.toArray();
    }

    res.json({
        customer: new AccountModel(req.currentCustomer),
        order: basketModel,
        shippingForm: server.forms.getForm('shipping')
    });

    return next();
});

/**
 * Handle Ajax shipping form submit
 */
server.replace(
    'SubmitShipping',
    server.middleware.https,
    csrfProtection.validateAjaxRequest,
    function (req, res, next) {
        var BasketMgr = require('dw/order/BasketMgr');
        var URLUtils = require('dw/web/URLUtils');
        var COHelpers = require('*/cartridge/scripts/checkout/checkoutHelpers');
        var validationHelpers = require('*/cartridge/scripts/helpers/basketValidationHelpers');

        var currentBasket = BasketMgr.getCurrentBasket();
        var validatedProducts = validationHelpers.validateProducts(currentBasket);
        if (!currentBasket || validatedProducts.error) {
            res.json({
                error: true,
                cartError: true,
                fieldErrors: [],
                serverErrors: [],
                redirectUrl: URLUtils.url('Cart-Show').toString()
            });
            return next();
        }

        var form = server.forms.getForm('shipping');
        var result = {};

        // verify shipping form data
        var shippingFormErrors = COHelpers.validateShippingForm(form.shippingAddress.addressFields);

        if (Object.keys(shippingFormErrors).length > 0) {
            req.session.privacyCache.set(currentBasket.defaultShipment.UUID, 'invalid');

            res.json({
                form: form,
                fieldErrors: [shippingFormErrors],
                serverErrors: [],
                error: true
            });
        } else {
            req.session.privacyCache.set(currentBasket.defaultShipment.UUID, 'valid');

            result.address = {
                firstName: form.shippingAddress.addressFields.firstName.value,
                lastName: form.shippingAddress.addressFields.lastName.value,
                address1: form.shippingAddress.addressFields.address1.value,
                address2: form.shippingAddress.addressFields.address2.value,
                city: form.shippingAddress.addressFields.city.value,
                postalCode: form.shippingAddress.addressFields.postalCode.value,
                countryCode: form.shippingAddress.addressFields.country.value,
                phone: form.shippingAddress.addressFields.phone.value
            };
            if (Object.prototype.hasOwnProperty
                .call(form.shippingAddress.addressFields, 'states')) {
                result.address.stateCode =
                    form.shippingAddress.addressFields.states.stateCode.value;
            }

            result.shippingBillingSame =
                form.shippingAddress.shippingAddressUseAsBillingAddress.value;

            result.shippingMethod = form.shippingAddress.shippingMethodID.value
                ? form.shippingAddress.shippingMethodID.value.toString()
                : null;

            result.isGift = form.shippingAddress.isGift.checked;

            result.giftMessage = result.isGift ? form.shippingAddress.giftMessage.value : null;

            res.setViewData(result);

            this.on('route:BeforeComplete', function (req, res) { // eslint-disable-line no-shadow
                var AccountModel = require('*/cartridge/models/account');
                var OrderModel = require('*/cartridge/models/order');
                var Locale = require('dw/util/Locale');

                var shippingData = res.getViewData();

                COHelpers.copyShippingAddressToShipment(
                    shippingData,
                    currentBasket.defaultShipment
                );

                var giftResult = COHelpers.setGift(
                    currentBasket.defaultShipment,
                    shippingData.isGift,
                    shippingData.giftMessage
                );

                if (giftResult.error) {
                    res.json({
                        error: giftResult.error,
                        fieldErrors: [],
                        serverErrors: [giftResult.errorMessage]
                    });
                    return;
                }

                if (!currentBasket.billingAddress) {
                    if (req.currentCustomer.addressBook
                        && req.currentCustomer.addressBook.preferredAddress) {
                        // Copy over preferredAddress (use addressUUID for matching)
                        COHelpers.copyBillingAddressToBasket(
                            req.currentCustomer.addressBook.preferredAddress, currentBasket);
                    } else {
                        // Copy over first shipping address (use shipmentUUID for matching)
                        COHelpers.copyBillingAddressToBasket(
                            currentBasket.defaultShipment.shippingAddress, currentBasket);
                    }
                }
                var usingMultiShipping = req.session.privacyCache.get('usingMultiShipping');
                if (usingMultiShipping === true && currentBasket.shipments.length < 2) {
                    req.session.privacyCache.set('usingMultiShipping', false);
                    usingMultiShipping = false;
                }

                COHelpers.recalculateBasket(currentBasket);

                var currentLocale = Locale.getLocale(req.locale.id);
                var basketModel = new OrderModel(
                    currentBasket,
                    {
                        usingMultiShipping: usingMultiShipping,
                        shippable: true,
                        countryCode: currentLocale.country,
                        containerView: 'basket'
                    }
                );

                // If applicable shipping method list is a list of Zonos shipping methods, loop through applicable shipping 
                // methods to find selected one, so that selectedShippingMethod can be updated with attributes needed to update UI.
                if (Object.prototype.toString.call(basketModel.shipping[0].applicableShippingMethods) === '[object JavaObject]')
                {
                    var iterator = basketModel.shipping[0].applicableShippingMethods.iterator();
                    var shippingMethod;
                    
                    while (iterator.hasNext()) {
                        shippingMethod = iterator.next();
                    
                        if (shippingMethod.ID === basketModel.shipping[0].selectedShippingMethod.ID) {
                            var Money = require('dw/value/Money');
                            basketModel.shipping[0].selectedShippingMethod.shippingCost = shippingMethod.shippingTotal;
                            basketModel.shipping[0].selectedShippingMethod.shippingCostFormatted = new Money(shippingMethod.shippingTotal, "USD").toFormattedString(); // basketModel.currencyCode
                            basketModel.shipping[0].selectedShippingMethod.isZonos = true;
                            basketModel.shipping[0].selectedShippingMethod.dutyTaxEnabled = shippingMethod.dutyTaxEnabled;
                            basketModel.shipping[0].selectedShippingMethod.dutyTaxForced = shippingMethod.dutyTaxForced;
                            basketModel.shipping[0].selectedShippingMethod.dutyTaxUnderDeminimus = shippingMethod.dutyTaxUnderDeminimus;
                            basketModel.shipping[0].selectedShippingMethod.dutyTaxTotal = shippingMethod.dutyTaxTotal;
                            basketModel.shipping[0].selectedShippingMethod.dutyTaxTotalFormatted = new Money(shippingMethod.dutyTaxTotal, "USD").toFormattedString(); // basketModel.currencyCode
                            basketModel.shipping[0].selectedShippingMethod.zonosMessage = shippingMethod.custom.zonosMessage;

                            break;
                        }
                    }

                    basketModel.shipping[0].applicableShippingMethods = basketModel.shipping[0].applicableShippingMethods.toArray();
                }

                res.json({
                    customer: new AccountModel(req.currentCustomer),
                    order: basketModel,
                    form: server.forms.getForm('shipping')
                });
            });
        }

        return next();
    }
);

module.exports = server.exports();
