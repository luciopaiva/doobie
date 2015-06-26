(function ($, console) {
    var
        model,
        ROOT_PROPERTY = '',
        computedWrappers = {},
        // a map of canonical property name -> value
        modelParents = {};
        // a map of canonical property name -> [observers]
        bindings = {};

    function splitCanonical(path) {
        var
            splitIndex = path.search(/\.[^.]+$/);

        if (splitIndex == -1) {
            return ['', path];
        } else {
            return [path.substring(0, splitIndex), path.substring(splitIndex + 1)];
        }
    }

    function canonical(path, prop) {
        return path.length ? path + '.' + prop : prop;
    }

    function canonicalArray(path, index) {
        var
            prop = '[' + index + ']';
        return path.length ? path + prop : prop;
    }

    /**
     * @param propName the property being observed
     * @param observer can be a jQuery object (instanceof jQuery) or a function. When a function, will be called upon property update.
     */
    function addObserver(propName, observer) {

        if (!bindings[propName]) {
            bindings[propName]= [];
        }
        bindings[propName].push(observer);
    }

    /**
     * Elements annotated with attribute [doobie] will be added to the bindings map.
     */
    function scanDOMForBindings(root) {

        root = root || $(document);

        root.find('[doobie]').each(function () {
            var
                self = $(this),
                path = self.attr('doobie');

            if (!/\[]/.test(path)) { // avoid array templates (doobie attributes containing "[]")
                addObserver(path, self);
                console.info('Registered <' + self.prop('tagName') + '> as observer for property "' + path + '"');

                // two-way binding elements:
                if (self.is('input,select,textarea')) {
                    self.on('keyup change', function() {
                        var
                            parent, prop, canArr = splitCanonical(path);

                        parent = canArr[0];
                        prop = canArr[1];

                        // trigger change only if value differs from current one:
                        if (self.val() !== modelParents[parent][prop]) {
                            // must access its parent and then access the property related to it
                            modelParents[parent][prop] = self.val();
                        }
                    });
                }
            }
        });

        // TODO: listen for future elements (MutationObserver)
    }

    /**
     * A computed value, based on other properties' values.
     *
     * @param path full canonical name of the property
     * @param fn the function to run to obtain the computed value
     * @param parentModel the parent object
     */
    function observeComputed(path, fn, parentModel) {
        var
            dependencies;

        dependencies = fn.toString().match(/function\s*[^(]*\(([^)]*)\)/);

        if (dependencies) {
            dependencies = dependencies[1].replace(/\s+/g, '').split(',');

            dependencies.forEach(function (dependency) {

                computedWrappers[path] = function () {
                    var
                        oldValue,
                        result;

                    /*
                     Call the computed function and obtain its return value.
                     */
                    // TODO add parameters from list of dependencies
                    result = fn.call(model);

                    /*
                     Triggers DOM elements that are bound to this computed property.
                     */
                    // TODO is it viable to recover the old value and pass it too? For now, just pass undefined
                    trigger(path, oldValue, result);
                };

                /*
                    For each dependency, we add an observer for that dependency and watch it for changes.
                    Every time a dependency changes, our observer is called and then we should call fn() and get its
                    return value, which in turn should be passed to the DOM elements that are bound to this
                    computed property.
                 */
                addObserver(dependency, computedWrappers[path]);
            });
        }

        // TODO what to do if the function has no parameters, i.e., no dependencies were specified? Should the
        // function be called every time some observed changes or should it be ignored?
    }

    function observeObject(path, objModel, parentModel) {
        var
            Base = Array.isArray(objModel) ? Array : Object;

        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe
        Base.observe(objModel, function (changes) {
            changes.forEach(function (change) {
                var
                    newPath;

                // See http://stackoverflow.com/a/31016527/778272 for a discussion on Array's change types
                switch (change.type) {
                    case 'add':
                        newPath = canonical(path, change.name);
                        trigger(newPath, change.oldValue, change.object[change.name]);
                        // must observe the new value and all its descendants - if it is an object:
                        observe(newPath, objModel[change.name], objModel);
                        break;
                    case 'update':
                        newPath = canonical(path, change.name);
                        trigger(newPath, change.oldValue, change.object[change.name]);
                        // TODO when a property is updated, probably we should also descend on it (if it is an
                        // object) and observe everything down there too
                        break;
                    case 'delete':
                        newPath = canonical(path, change.name);
                        trigger(newPath, change.oldValue, change.object[change.name]);
                        // TODO should all descendants be unobserved somehow?
                        // unobserve(objModel[change.name], objModel);
                        break;
                    case 'splice':
                        newPath = path; // because change.name is undefined in this case, as the change occurred to the array itself
                        console.info(newPath);
                        console.info('Splice index: ' + change.index);
                        console.info('Splice removed:');
                        console.dir(change.removed);
                        console.info('Splice added count: ' + change.addedCount);
                        triggerArray(newPath, change.oldValue, change.object, change.index, change.removed, change.addedCount);
                        // TODO see what was added and observe that too
                        break;
                }
            });
        });

        modelParents[path] = objModel;

        if (Array.isArray(objModel)) {
            // Recursively call each array item
            objModel.forEach(function (arrayItem, index) {
                // TODO check if canonicalArray() is the best way to represent the array item
                observe(canonicalArray(path, index), arrayItem, objModel);
            });
        } else {
            // Recursively call each object's property
            Object.keys(objModel).forEach(function (propName) {
                observe(canonical(path, propName), objModel[propName], objModel);
            });
        }
    }

    /**
     * Receives a new model `objModel` and adds an observer to it.
     *
     * Recursively descends on each property of the new model, checking if it points to another object and observing
     * it too (Object.observe() doesn't do that for you automatically and you won't be notified in object foo if
     * some property foo.bar.baz changes, unless you explicitly observe foo.bar).
     *
     * If you are observing `foo` and `foo.bar` is a
     * [primitive](https://developer.mozilla.org/en-US/docs/Glossary/Primitive), you don't need to bother observing it
     * directly (in fact, you can't - you can only observe Objects) because `foo` is already going to be notified for
     * it.
     *
     * Arrays are a special kind of Object that have their own Array.observe(), which descends from Object.observe()
     * and adds the change type `splice`. See http://stackoverflow.com/a/31016869/778272.
     *
     * @param path
     * @param objModel
     * @param parentModel
     */
    function observe(path, objModel, parentModel) {

        console.info('Observing <' + path + '>');

        if ((typeof objModel == 'object') && (objModel !== null)) {
            observeObject(path, objModel, parentModel);
        } else if (typeof objModel == 'function') { // TODO function may also be of type $.doobie.computed()
            observeComputed(path, objModel, parentModel);
        }
    }

    function triggerArray(canonicalName, oldValue, newValue, index, removed, addedCount) {
        var
            existingClonedItems,
            caname,
            elemIndex,
            elem;

        if (bindings[canonicalName]) {
            bindings[canonicalName].forEach(function (observer) {
                var
                    insertionMarker;

                if (observer instanceof jQuery) {

                    console.info('Triggering observer ' + observer.prop('tagName') + ' for array ' + canonicalName);

                    observer.hide(); // make sure the template is hidden

                    existingClonedItems = observer.nextAll('[doobie^="' + canonicalName + '["]'); // matches all
                    // siblings with attribute "model=name[*]"

                    console.info('Cloned object count: ' + existingClonedItems.length);

                    // first update removed items...
                    if (removed.length > 0) {
                        existingClonedItems.slice(index, index + removed.length).remove();
                    }

                    insertionMarker = existingClonedItems.length ? existingClonedItems.eq(-1) : observer;

                    // ...then update added items
                    if (addedCount > 0) {
                        //if (existingClonedItems.length == 0) {
                            while (addedCount--) {

                                elemIndex = index + addedCount;
                                caname = canonicalArray(canonicalName, elemIndex);

                                elem = observer.clone();
                                elem.attr('doobie', caname);

                                elem.insertAfter(insertionMarker);

                                elem.find('[doobie^="' + canonicalName + '[]"]').each(function () {
                                    $(this).attr('doobie', $(this).attr('doobie').replace(/\[]/, '['+ elemIndex + ']'));
                                });

                                scanDOMForBindings(elem);

                                elem.show();
                            }
                        //}
                    }

                    // TODO MAJOR every time elements are added/removed, every previously existing element displaced
                    // after the new element should have its indices updated in the DOM. Another option is to remove
                    // those indices completely. Are they really necessary?

                } else if (typeof observer == 'function') {

                    observer();
                }
            });

            // TODO should also trigger all ascendants, a.k.a. "bubble up" the event
        }
    }

    function trigger(canonicalName, oldValue, newValue) {
        console.info('TRIGGER <' + canonicalName + '>');

        if (bindings[canonicalName]) {
            bindings[canonicalName].forEach(function (observer) {

                console.info('Triggering observer ' + observer + ' for ' + canonicalName);

                if (observer instanceof jQuery) {

                    if ($(observer).is('input,select,textarea')) {
                        $(observer).val(newValue);
                    } else {
                        $(observer).text(newValue);
                    }

                } else if (typeof observer == 'function') {

                    observer();
                }
            });

            // TODO should also trigger all ascendants? (a.k.a. "bubble up" the event?)
        }
    }

    function triggerAll(path, objModel) {
        console.info('TRIGGER ALL: <' + path + '>');

        if ($.isArray(objModel)) {
            triggerArray(path, [], objModel, 0, [], objModel.length);
            objModel.forEach(function (arrayItem, arrayIndex) {
                triggerAll(canonicalArray(path, arrayIndex), arrayItem);
            });
        } else if (typeof objModel == 'object' && objModel !== null) {
            Object.keys(objModel).forEach(function (propName) {
                triggerAll(canonical(path, propName), objModel[propName]);
            })
        } else if (typeof objModel == 'function') {
            // if the value is a function, we should not call it directly, but instead call the wrapper that was
            // made in observeComputed(), which adds a this context, among other things.
            trigger(path, null, computedWrappers[path]);
        } else {
            trigger(path, null, objModel);
        }
    }

    $.doobie = function DoobieFactory(_model) {
        model = _model;

        console.info('-------------------- Scanning DOM --------------------');
        scanDOMForBindings();

        console.info('-------------------- Bindings --------------------');
        console.dir(bindings);

        console.info('-------------------- Creating observers --------------------');
        console.dir(model);
        observe(ROOT_PROPERTY, model);

        console.info('-------------------- Triggering for the first time --------------------');
        triggerAll(ROOT_PROPERTY, model);
    };

})(jQuery, console);
