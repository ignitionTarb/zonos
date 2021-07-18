$(document).ready(function () {

    resetHello();

    toggleCartTotal();

    $('body').on('z-country-change', function () {
        toggleEstimates();

        toggleCartTotal();
    }); 

    $('body').on('product:statusUpdate', function (e, data) {
        resetHello();
    });

    $('body').on('shipping:updateShippingSummaryInformation', function (e, data) {
        // Update the Zonos conversion element so it has the new total
        $('.grand-total-sum.zonos-conversion').html(data.order.totals.grandTotal.replace('$', ''));
        $('.grand-total-sum.zonos-conversion').attr('data-usd', data.order.totals.grandTotal.replace('$', ''));

        resetHello();

        $('.shipping-summary .shipping-method-price').html(data.order.totals.totalShippingCost);

        $('#zonosMessage').remove();
        $('#taxLabel').show();

        if (data.order.zonosMessage) {
            $('<span id="zonosMessage">' + data.order.zonosMessage + '</span>').insertAfter('#taxLabel');
            $('#taxLabel').hide();
        }
    });
});

function toggleCartTotal() {
    if ($('.cart-page .grand-total').html() !== '-' && !zonos.isDomestic()) {
        $('.zonos-conversion-row').show();
    }
    else {
        $('.zonos-conversion-row').hide();
    }
}

function toggleEstimates() {
    if (zonos.isDomestic()) {
        $('.grand-total-row .zonos-conversion-container, .product-body .zonos-conversion-container, .product-heading .zonos-conversion-container, .cart-price-line .zonos-conversion-container').hide();
    }
    else {
        $('.grand-total-row .zonos-conversion-container, .product-body .zonos-conversion-container, .product-heading .zonos-conversion-container, .cart-price-line .zonos-conversion-container').show();

        // hide any 0 estimates
        $('.zonos-conversion-container').each( function () {
            if ($(this).find('.zonos-conversion').attr('data-zintl') === '0' || $(this).find('.zonos-conversion').attr('data-zintl') === '-') {
                $(this).hide();
            }
        });
    }
}

function resetHello() {
    if (zonos) {
        zonos.displayCurrency();

        toggleEstimates();
    }
}
