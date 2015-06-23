
var
    // variable was made global on purpose, so that we can change it from browser's console at run time
    testModel = {
        firstName: 'Ze',
        lastName: 'das Couves',
        fullName: ['firstName', 'lastName', function () {
            return this.firstName + ' ' + this.lastName;
        }],
        resources: [
            {
                name: 'Iron',
                quantity: 1000
            },
            {
                name: 'Wood',
                quantity: 300
            },
            {
                name: 'Stone',
                quantity: 800
            }
        ],
        totalAmount: ['resources', function getTotalAmount() {
            return this.resources.reduce(function (sum, resource) {
                return sum + resource.quantity;
            }, 0);
        }]
    };

$(function () {

    $.databind(testModel);
});
