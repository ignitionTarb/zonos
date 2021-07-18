/**
 * @function init
 * @description Initialize the tag manager functionality
 * @param {String} nameSpace The current name space
 */
$(document).ready(function () {

    resetHello();

    $('body').on('z-country-change', function () {
        if (zonos.isDomestic()) {
            $('.grand-total-row .zonos-conversion-container').hide();
            $('.product-body .zonos-conversion-container').hide();
        }
        else {
            $('.grand-total-row .zonos-conversion-container').show();
            $('.product-body .zonos-conversion-container').show();
        }
    }); 

    $('body').on('checkout:updateCheckoutView', function (e, data) {
        // Update the Zonos conversion element so it has the new total
        $('.zonos-conversion').html(data.order.totals.value);
        $('.zonos-conversion').attr('data-usd', data.order.totals.value);

        resetHello();

        $('#zonosMessage').remove();
        $('#taxLabel').show();

        if (data.order.shipping[0].selectedShippingMethod.isZonos) {
            $('.shipping-summary .shipping-method-price').html(data.order.shipping[0].selectedShippingMethod.shippingCostFormatted);

            if (data.order.shipping[0].selectedShippingMethod.zonosMessage) {
                $('<span id="zonosMessage">' + data.order.shipping[0].selectedShippingMethod.zonosMessage + '</span>').insertAfter('#taxLabel');
                $('#taxLabel').hide();
            }
        }
    });

    $('body').on('shipping:updateShippingSummaryInformation', function (e, data) {
        // Update the Zonos conversion element so it has the new total
        $('.zonos-conversion').html(data.order.totals.value);
        $('.zonos-conversion').attr('data-usd', data.order.totals.value);

        resetHello();

        $('.shipping-summary .shipping-method-price').html(data.order.totals.totalShippingCost);

        $('#zonosMessage').remove();
        $('#taxLabel').show();

        if (data.order.shipping[0].selectedShippingMethod.isZonos) {
            $('<span id="zonosMessage">' + data.order.shipping[0].selectedShippingMethod.zonosMessage + '</span>').insertAfter('#taxLabel');
            $('#taxLabel').hide();
        }
    });
});

function resetHello() {
    if (zonos) {
        zonos.displayCurrency();

        if (zonos.isDomestic()) {
            $('.grand-total-row .zonos-conversion-container').hide();
            $('.product-body .zonos-conversion-container').hide();
        }
        else {
            $('.grand-total-row .zonos-conversion-container').show();
            $('.product-body .zonos-conversion-container').show();
        }
    }
}