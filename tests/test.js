
var
    // variable was made global on purpose, so that we can change it from browser's console at run time
    testModel = {
        firstName: 'Ze',
        lastName: 'das Couves',
        fullName: function (firstName, lastName) {
            console.info(this.firstName + ' ' + this.lastName);
            return this.firstName + ' ' + this.lastName;
        },
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
        totalAmount: function getTotalAmount(resources) {
            return this.resources.reduce(function (sum, resource) {
                return sum + resource.quantity;
            }, 0);
        }
    };

$(function () {

    $.doobie(testModel);
});
