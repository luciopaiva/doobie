
---

**Do not download it yet - the library is still under construction!**

---

A minimalist two-way data-binding library for those that are looking for something leaner than big fat frameworks like 
Angular.js.

---

**Do not download it yet - the library is still under construction!**

---

## How to install

    bower install --save doobie

Or if you're using npm:

    npm install --save doobie

Just include it in your HTML file. You will also need to include jQuery *before* including this library:

    <script src="jquery.js" />
    <script src="doobie.js" />

Then all that you have to do is invoke `$.doobie()` and pass your model to the library:

    $.doobie({
        firstName: 'Foo',
        lastName: 'von Bar',
        fullName: function(firstName, lastName) {
            return this.firstName + ' ' + this.lastName;
        }
    });

And then, in your HTML, reference your model using `doobie` attributes. See below. 

## One-way data-binding (model -> view)

For instance:

    <p doobie="firstName"></p>

The `<p>` element's content will immediately be filled with the value from `firstName` and every time it changes. It 
works with every element that is a container.

## Two-way data-binding (model <-> view)

If you bind it to an `<input>` tag, it will work as a two-way binding. Any update to the `<input>` will also trigger 
an update to the property, and vice-versa:

    <input type="text" doobie="lastName" />

It works for `textarea` elements too. `select` is on the roadmap yet.

## Computed properties

For cases that you want to bind to the DOM some processed version of the model you have, you should use a computed 
property. It allows you to specify a function that will be called every time some of its dependencies change. For 
example, say you have the following model:

    $.doobie({
        firstName: 'Foo',
        lastName: 'von Bar',
        fullName: function(firstName, lastName) {
            return this.firstName + ' ' + this.lastName;
        }
    });

And then your HTML has a `div` like this:
 
    Your name is <span doobie="fullName"></span>.

Doobie watches for those function's parameters and parses them as properties of your model. So, every time at least 
one of those properties change, your function is called to update DOM elements that are bound to it.

## Arrays

It is a very common pattern to map an array to rows in a table in HTML. In general, you may want to map an array to a
 list of any element type. To be able to do that, you can the same attribute `doobie` that you use for other bindings.
 The DOM will be kept up to date with the array every time an item is added, updated or removed from it.

Array elements themselves can contain other objects, even other arrays, and the binding will still work as expected.
