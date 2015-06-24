(function ($) {
    var
        model,
        ROOT_PROPERTY = '',
        // a map of property -> [observers]
        bindings = {};

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
     * Elements annotated with attributes [model] or [model-array] will be added to the bindings map.
     */
    function scanDOMForBindings(root) {

        root = root || $(document);

        root.find('[model]').each(function () {
            var
                path = $(this).attr('model');

            if (!/\[]/.test(path)) { // avoid array templates (model attributes containing "[]")
                addObserver(path, $(this));
                console.info('Registered <' + $(this).prop('tagName') + '> as observer for property "' + path + '"');
            }
        });

        // TODO implement a system for binding [model-array]s
//        $('[model-array]').each(function () {
//            addObserver($(this).attr('model'), $(this));
//            console.info('Registered <' + $(this).prop('tagName') + '> as array observer for property "' + $(this).attr('model-array') + '"');
//        });

        // TODO: listen for future elements (MutationObserver)
    }

    /**
     * A computed value, based on other properties' values.
     *
     * @param path full canonical name of the property
     * @param arrayModel a special array consisting of [dependencyStr1, dependencyStr2, ..., dependencyStrN, function]
     * @param parentModel the parent object
     */
    function observeComputed(path, arrayModel, parentModel) {
        var
            fn;

        // TODO this is changing the original array - not the best way to do it - it would be better if the array was left unchanged
        // TODO other option here would be to update the property, assigning it to the function rather than the array - the array would be discarded
        fn = arrayModel.pop();

        arrayModel.forEach(function (dependency) {
            addObserver(dependency, function () {
                var
                    oldValue,
                    result = fn.call(model);

                // TODO is it viable to recover the old value and pass it too? For now, just pass undefined
                trigger(path, oldValue, result);
            });
        });
    }

    function observeArray(path, objModel, parentModel) {

        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/observe
        Array.observe(objModel, function (changes) {
            changes.forEach(function (change) {
                var
                    caname = canonicalArray(path, change.name);

                switch (change.type) {
                    case 'add':
                        // TODO this trigger should in fact trigger the entire array too, so that [model-array]s could update its loops accordingly
                        trigger(caname, change.oldValue, objModel[change.name]);
                        // must also observe new child and its descendants - if it is an object
                        observe(caname, objModel[change.name], objModel);
                        break;
                    case 'update':
                        // TODO this trigger should in fact trigger the entire array too, so that [model-array]s could update its loops accordingly
                        trigger(caname, change.oldValue, objModel[change.name]);
                        break;
                    case 'delete':
                        // TODO this trigger should in fact trigger the entire array too, so that [model-array]s could update its loops accordingly
                        trigger(caname, change.oldValue, objModel[change.name]);
                        // TODO should all descendants be unobserved somehow?
                        // unobserve(objModel[change.name], objModel);
                        break;
                    case 'splice':
                        console.info('Splice index: ' + change.index);
                        console.info('Splice removed:');
                        console.dir(change.removed);
                        console.info('Splice added count: ' + change.addedCount);
                        triggerArray(caname, change.oldValue, change.object, change.index, change.removed, change.addedCount);
                        // TODO see what was added and observe that too
                        break;
                }
            })
        });

        // Recursively call each array item
        objModel.forEach(function (arrayItem, index) {
            observe(canonicalArray(path, index), arrayItem, objModel);
        });
    }

    function observeObject(path, objModel, parentModel) {

        // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/observe
        Object.observe(objModel, function (changes) {
            changes.forEach(function (change) {
                var
                    newPath = canonical(path, change.name);

                switch (change.type) {
                    case 'add':
                        trigger(newPath, change.oldValue, change.object[change.name]);
                        // must observe the new value and all its descendants - if it is an object:
                        observe(newPath, objModel[change.name], objModel);
                        break;
                    case 'update':
                        trigger(newPath, change.oldValue, change.object[change.name]);
                        break;
                    case 'delete':
                        trigger(newPath, change.oldValue, change.object[change.name]);
                        // TODO should all descendants be unobserved somehow?
                        // unobserve(objModel[change.name], objModel);
                        break;
                }
            });
        });

        // Recursively call each object's property
        Object.keys(objModel).forEach(function (propName) {
            observe(canonical(path, propName), objModel[propName], objModel);
        });
    }

    function observe(path, objModel, parentModel) {

        console.info('Observing <' + path + '>');

        /*
         Observes only non-null objects and arrays. Every other type of variable is silently ignored.
         Reference on variable types:
         https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/typeof
         */
        if ($.isArray(objModel)) {

            /*
             If the array contains a function as its last item, it is interpreted as a special object.
             This special object has the format [dependency_1, dependency_2, ..., dependency_N, fn].
             For every dependency, every time one of them changes, the function fn must be called.
             */
            if (typeof objModel[objModel.length - 1] == 'function') {
                observeComputed(path, objModel, parentModel);
            } else {
                observeArray(path, objModel, parentModel);
            }

        } else if ((typeof objModel === 'object') && (objModel !== null)) {
            observeObject(path, objModel, parentModel);
        }

        // TODO must trigger a forced update in the first pass, so that all observers are aware of each initial value
        // I think the easier way is to iterate over Object.keys(bindings) and trigger everybody manually
    }

    function triggerArray(canonicalName, oldValue, newValue, index, removed, addedCount) {
        var
            existingClonedItems,
            caname,
            elemIndex,
            elem;

        if (bindings[canonicalName]) {
            bindings[canonicalName].forEach(function (observer) {

                console.info('Triggering observer ' + observer.prop('tagName') + ' for array ' + canonicalName);

                if (observer instanceof jQuery) {

                    observer.hide(); // make sure the template is hidden

                    existingClonedItems = observer.nextAll('[model^="' + canonicalName + '["]'); // matches all siblings with attribute "model=name[*]"

                    // first update removed items...
                    if (removed.length > 0) {
                        existingClonedItems.slice(index, index + removed.length).remove();
                    }

                    // ...then update added items
                    if (addedCount > 0) {
                        if (existingClonedItems.length == 0) {
                            while (addedCount--) {

                                elemIndex = index + addedCount;
                                caname = canonicalArray(canonicalName, elemIndex);

                                elem = observer.clone();
                                elem.attr('model', caname);
                                elem.insertAfter(observer);

                                elem.find('[model^="' + canonicalName + '[]"]').each(function () {
                                    $(this).attr('model', $(this).attr('model').replace(/\[]/, '['+ elemIndex + ']'));
                                });

                                scanDOMForBindings(elem);

                                elem.show();
                            }
                        }
                    }

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
        } else {
            trigger(path, null, objModel);
        }
    }

    $.databind = function DataBindFactory(_model) {
        model = _model;
        scanDOMForBindings();
        console.dir(bindings);
        observe(ROOT_PROPERTY, model);
        triggerAll(ROOT_PROPERTY, model);
    };

//    $.databind = function DataBindFactory(annotatedModel) {
//        var
//            databind = {
//                bindings: {},
//                model: {}
//            };
//
//        Object.keys(annotatedModel).forEach(function (propName) {
//            var
//                prop = annotatedModel[propName];
//
//            databind.model[propName] = prop.value;
//            databind.bindings[propName] = $.isArray(prop.bindings) ? prop.bindings : [];
//        });
//
//        // Model -> View binding
//        Object.observe(databind.model, function (changes) {
//            changes.forEach(function (change) {
//                databind.bindings[change.name].forEach(function (binding) {
//
//                    if ($(binding).is('input,select,textarea')) {
//                        $(binding).val(databind.model[change.name]);
//                    } else {
//                        $(binding).text(databind.model[change.name]);
//                    }
//                });
//            });
//        });
//
//        // View -> Model binding
//        Object.keys(bindings).forEach(function (propName) {
//            var
//                bindingSelectors = databind.bindings[propName];
//
//            bindingSelectors.forEach(function (bindingSelector) {
//                // account for future elements, binding the event on `document` rather than the direct element
//                $(document).on('change keyup', bindingSelector, function () {
//                    var
//                        elem = $(this);
//
//                    // only cares to bind if element is some kind of input
//                    if (elem.is('input,select,textarea')) {
//                        databind.model[propName] = elem.val();
//                    }
//                });
//            });
//        });
//
//        return databind;
//    };

})(jQuery);
