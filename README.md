
A KISS two-way data-binding library.

## How to use

Just include it in your HTML file. You will also need to include jQuery *before* including this library:

    <script src="binding.js" />
    <script src="jquery.js" />

Then all that you have to do is invoke `$.databind()` and pass your model to the library:

    $.databind({
        firstName: 'Foo',
        lastName: 'von Bar',
        fullName: ['firstName', 'lastName', function() {
            return this.firstName + ' ' + this.lastName;
        }]
    });

And then, in your HTML, reference your model using `model` attributes. 

## One-way data-binding (model -> view)

For instance:

    <p model="firstName"></p>

The `<p>` element's content will be filled with the value from `firstName` and everytime it changes, `<p>` will be 
immediately updated.

## Two-way data-binding (model <-> view)

If you bind it to an `<input>` tag, it will work as a two-way binding. Any update to the `<input>` will also trigger 
an update to the property, and vice-versa:

    <input type="text" model="lastName" />

## Computed properties

In the example we have a property named `fullName` whose value is a special array. Array's last element is a function
 which should be called every time at least one of the properties listed in the array (always coming before the 
 function) has changed. Computed properties are one-way bindings, since they can't be set.

## Arrays

It is a very common pattern to map an array to rows in a table in HTML. In general, you may want to map an array to a
 list of any element type. To be able to do that, you can use the special attribute `model-array`, which will use the
  element as a template that will be cloned one time for each element in the array.

Array elements themselves can contain other objects, even arrays, and the binding will still function.
