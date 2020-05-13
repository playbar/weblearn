(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
/*global define:false */
/**
 * Copyright 2012-2017 Craig Campbell
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * Mousetrap is a simple keyboard shortcut library for Javascript with
 * no external dependencies
 *
 * @version 1.6.5
 * @url craig.is/killing/mice
 */
(function(window, document, undefined) {

    // Check if mousetrap is used inside browser, if not, return
    if (!window) {
        return;
    }

    /**
     * mapping of special keycodes to their corresponding keys
     *
     * everything in this dictionary cannot use keypress events
     * so it has to be here to map to the correct keycodes for
     * keyup/keydown events
     *
     * @type {Object}
     */
    var _MAP = {
        8: 'backspace',
        9: 'tab',
        13: 'enter',
        16: 'shift',
        17: 'ctrl',
        18: 'alt',
        20: 'capslock',
        27: 'esc',
        32: 'space',
        33: 'pageup',
        34: 'pagedown',
        35: 'end',
        36: 'home',
        37: 'left',
        38: 'up',
        39: 'right',
        40: 'down',
        45: 'ins',
        46: 'del',
        91: 'meta',
        93: 'meta',
        224: 'meta'
    };

    /**
     * mapping for special characters so they can support
     *
     * this dictionary is only used incase you want to bind a
     * keyup or keydown event to one of these keys
     *
     * @type {Object}
     */
    var _KEYCODE_MAP = {
        106: '*',
        107: '+',
        109: '-',
        110: '.',
        111 : '/',
        186: ';',
        187: '=',
        188: ',',
        189: '-',
        190: '.',
        191: '/',
        192: '`',
        219: '[',
        220: '\\',
        221: ']',
        222: '\''
    };

    /**
     * this is a mapping of keys that require shift on a US keypad
     * back to the non shift equivelents
     *
     * this is so you can use keyup events with these keys
     *
     * note that this will only work reliably on US keyboards
     *
     * @type {Object}
     */
    var _SHIFT_MAP = {
        '~': '`',
        '!': '1',
        '@': '2',
        '#': '3',
        '$': '4',
        '%': '5',
        '^': '6',
        '&': '7',
        '*': '8',
        '(': '9',
        ')': '0',
        '_': '-',
        '+': '=',
        ':': ';',
        '\"': '\'',
        '<': ',',
        '>': '.',
        '?': '/',
        '|': '\\'
    };

    /**
     * this is a list of special strings you can use to map
     * to modifier keys when you specify your keyboard shortcuts
     *
     * @type {Object}
     */
    var _SPECIAL_ALIASES = {
        'option': 'alt',
        'command': 'meta',
        'return': 'enter',
        'escape': 'esc',
        'plus': '+',
        'mod': /Mac|iPod|iPhone|iPad/.test(navigator.platform) ? 'meta' : 'ctrl'
    };

    /**
     * variable to store the flipped version of _MAP from above
     * needed to check if we should use keypress or not when no action
     * is specified
     *
     * @type {Object|undefined}
     */
    var _REVERSE_MAP;

    /**
     * loop through the f keys, f1 to f19 and add them to the map
     * programatically
     */
    for (var i = 1; i < 20; ++i) {
        _MAP[111 + i] = 'f' + i;
    }

    /**
     * loop through to map numbers on the numeric keypad
     */
    for (i = 0; i <= 9; ++i) {

        // This needs to use a string cause otherwise since 0 is falsey
        // mousetrap will never fire for numpad 0 pressed as part of a keydown
        // event.
        //
        // @see https://github.com/ccampbell/mousetrap/pull/258
        _MAP[i + 96] = i.toString();
    }

    /**
     * cross browser add event method
     *
     * @param {Element|HTMLDocument} object
     * @param {string} type
     * @param {Function} callback
     * @returns void
     */
    function _addEvent(object, type, callback) {
        if (object.addEventListener) {
            object.addEventListener(type, callback, false);
            return;
        }

        object.attachEvent('on' + type, callback);
    }

    /**
     * takes the event and returns the key character
     *
     * @param {Event} e
     * @return {string}
     */
    function _characterFromEvent(e) {

        // for keypress events we should return the character as is
        if (e.type == 'keypress') {
            var character = String.fromCharCode(e.which);

            // if the shift key is not pressed then it is safe to assume
            // that we want the character to be lowercase.  this means if
            // you accidentally have caps lock on then your key bindings
            // will continue to work
            //
            // the only side effect that might not be desired is if you
            // bind something like 'A' cause you want to trigger an
            // event when capital A is pressed caps lock will no longer
            // trigger the event.  shift+a will though.
            if (!e.shiftKey) {
                character = character.toLowerCase();
            }

            return character;
        }

        // for non keypress events the special maps are needed
        if (_MAP[e.which]) {
            return _MAP[e.which];
        }

        if (_KEYCODE_MAP[e.which]) {
            return _KEYCODE_MAP[e.which];
        }

        // if it is not in the special map

        // with keydown and keyup events the character seems to always
        // come in as an uppercase character whether you are pressing shift
        // or not.  we should make sure it is always lowercase for comparisons
        return String.fromCharCode(e.which).toLowerCase();
    }

    /**
     * checks if two arrays are equal
     *
     * @param {Array} modifiers1
     * @param {Array} modifiers2
     * @returns {boolean}
     */
    function _modifiersMatch(modifiers1, modifiers2) {
        return modifiers1.sort().join(',') === modifiers2.sort().join(',');
    }

    /**
     * takes a key event and figures out what the modifiers are
     *
     * @param {Event} e
     * @returns {Array}
     */
    function _eventModifiers(e) {
        var modifiers = [];

        if (e.shiftKey) {
            modifiers.push('shift');
        }

        if (e.altKey) {
            modifiers.push('alt');
        }

        if (e.ctrlKey) {
            modifiers.push('ctrl');
        }

        if (e.metaKey) {
            modifiers.push('meta');
        }

        return modifiers;
    }

    /**
     * prevents default for this event
     *
     * @param {Event} e
     * @returns void
     */
    function _preventDefault(e) {
        if (e.preventDefault) {
            e.preventDefault();
            return;
        }

        e.returnValue = false;
    }

    /**
     * stops propogation for this event
     *
     * @param {Event} e
     * @returns void
     */
    function _stopPropagation(e) {
        if (e.stopPropagation) {
            e.stopPropagation();
            return;
        }

        e.cancelBubble = true;
    }

    /**
     * determines if the keycode specified is a modifier key or not
     *
     * @param {string} key
     * @returns {boolean}
     */
    function _isModifier(key) {
        return key == 'shift' || key == 'ctrl' || key == 'alt' || key == 'meta';
    }

    /**
     * reverses the map lookup so that we can look for specific keys
     * to see what can and can't use keypress
     *
     * @return {Object}
     */
    function _getReverseMap() {
        if (!_REVERSE_MAP) {
            _REVERSE_MAP = {};
            for (var key in _MAP) {

                // pull out the numeric keypad from here cause keypress should
                // be able to detect the keys from the character
                if (key > 95 && key < 112) {
                    continue;
                }

                if (_MAP.hasOwnProperty(key)) {
                    _REVERSE_MAP[_MAP[key]] = key;
                }
            }
        }
        return _REVERSE_MAP;
    }

    /**
     * picks the best action based on the key combination
     *
     * @param {string} key - character for key
     * @param {Array} modifiers
     * @param {string=} action passed in
     */
    function _pickBestAction(key, modifiers, action) {

        // if no action was picked in we should try to pick the one
        // that we think would work best for this key
        if (!action) {
            action = _getReverseMap()[key] ? 'keydown' : 'keypress';
        }

        // modifier keys don't work as expected with keypress,
        // switch to keydown
        if (action == 'keypress' && modifiers.length) {
            action = 'keydown';
        }

        return action;
    }

    /**
     * Converts from a string key combination to an array
     *
     * @param  {string} combination like "command+shift+l"
     * @return {Array}
     */
    function _keysFromString(combination) {
        if (combination === '+') {
            return ['+'];
        }

        combination = combination.replace(/\+{2}/g, '+plus');
        return combination.split('+');
    }

    /**
     * Gets info for a specific key combination
     *
     * @param  {string} combination key combination ("command+s" or "a" or "*")
     * @param  {string=} action
     * @returns {Object}
     */
    function _getKeyInfo(combination, action) {
        var keys;
        var key;
        var i;
        var modifiers = [];

        // take the keys from this pattern and figure out what the actual
        // pattern is all about
        keys = _keysFromString(combination);

        for (i = 0; i < keys.length; ++i) {
            key = keys[i];

            // normalize key names
            if (_SPECIAL_ALIASES[key]) {
                key = _SPECIAL_ALIASES[key];
            }

            // if this is not a keypress event then we should
            // be smart about using shift keys
            // this will only work for US keyboards however
            if (action && action != 'keypress' && _SHIFT_MAP[key]) {
                key = _SHIFT_MAP[key];
                modifiers.push('shift');
            }

            // if this key is a modifier then add it to the list of modifiers
            if (_isModifier(key)) {
                modifiers.push(key);
            }
        }

        // depending on what the key combination is
        // we will try to pick the best event for it
        action = _pickBestAction(key, modifiers, action);

        return {
            key: key,
            modifiers: modifiers,
            action: action
        };
    }

    function _belongsTo(element, ancestor) {
        if (element === null || element === document) {
            return false;
        }

        if (element === ancestor) {
            return true;
        }

        return _belongsTo(element.parentNode, ancestor);
    }

    function Mousetrap(targetElement) {
        var self = this;

        targetElement = targetElement || document;

        if (!(self instanceof Mousetrap)) {
            return new Mousetrap(targetElement);
        }

        /**
         * element to attach key events to
         *
         * @type {Element}
         */
        self.target = targetElement;

        /**
         * a list of all the callbacks setup via Mousetrap.bind()
         *
         * @type {Object}
         */
        self._callbacks = {};

        /**
         * direct map of string combinations to callbacks used for trigger()
         *
         * @type {Object}
         */
        self._directMap = {};

        /**
         * keeps track of what level each sequence is at since multiple
         * sequences can start out with the same sequence
         *
         * @type {Object}
         */
        var _sequenceLevels = {};

        /**
         * variable to store the setTimeout call
         *
         * @type {null|number}
         */
        var _resetTimer;

        /**
         * temporary state where we will ignore the next keyup
         *
         * @type {boolean|string}
         */
        var _ignoreNextKeyup = false;

        /**
         * temporary state where we will ignore the next keypress
         *
         * @type {boolean}
         */
        var _ignoreNextKeypress = false;

        /**
         * are we currently inside of a sequence?
         * type of action ("keyup" or "keydown" or "keypress") or false
         *
         * @type {boolean|string}
         */
        var _nextExpectedAction = false;

        /**
         * resets all sequence counters except for the ones passed in
         *
         * @param {Object} doNotReset
         * @returns void
         */
        function _resetSequences(doNotReset) {
            doNotReset = doNotReset || {};

            var activeSequences = false,
                key;

            for (key in _sequenceLevels) {
                if (doNotReset[key]) {
                    activeSequences = true;
                    continue;
                }
                _sequenceLevels[key] = 0;
            }

            if (!activeSequences) {
                _nextExpectedAction = false;
            }
        }

        /**
         * finds all callbacks that match based on the keycode, modifiers,
         * and action
         *
         * @param {string} character
         * @param {Array} modifiers
         * @param {Event|Object} e
         * @param {string=} sequenceName - name of the sequence we are looking for
         * @param {string=} combination
         * @param {number=} level
         * @returns {Array}
         */
        function _getMatches(character, modifiers, e, sequenceName, combination, level) {
            var i;
            var callback;
            var matches = [];
            var action = e.type;

            // if there are no events related to this keycode
            if (!self._callbacks[character]) {
                return [];
            }

            // if a modifier key is coming up on its own we should allow it
            if (action == 'keyup' && _isModifier(character)) {
                modifiers = [character];
            }

            // loop through all callbacks for the key that was pressed
            // and see if any of them match
            for (i = 0; i < self._callbacks[character].length; ++i) {
                callback = self._callbacks[character][i];

                // if a sequence name is not specified, but this is a sequence at
                // the wrong level then move onto the next match
                if (!sequenceName && callback.seq && _sequenceLevels[callback.seq] != callback.level) {
                    continue;
                }

                // if the action we are looking for doesn't match the action we got
                // then we should keep going
                if (action != callback.action) {
                    continue;
                }

                // if this is a keypress event and the meta key and control key
                // are not pressed that means that we need to only look at the
                // character, otherwise check the modifiers as well
                //
                // chrome will not fire a keypress if meta or control is down
                // safari will fire a keypress if meta or meta+shift is down
                // firefox will fire a keypress if meta or control is down
                if ((action == 'keypress' && !e.metaKey && !e.ctrlKey) || _modifiersMatch(modifiers, callback.modifiers)) {

                    // when you bind a combination or sequence a second time it
                    // should overwrite the first one.  if a sequenceName or
                    // combination is specified in this call it does just that
                    //
                    // @todo make deleting its own method?
                    var deleteCombo = !sequenceName && callback.combo == combination;
                    var deleteSequence = sequenceName && callback.seq == sequenceName && callback.level == level;
                    if (deleteCombo || deleteSequence) {
                        self._callbacks[character].splice(i, 1);
                    }

                    matches.push(callback);
                }
            }

            return matches;
        }

        /**
         * actually calls the callback function
         *
         * if your callback function returns false this will use the jquery
         * convention - prevent default and stop propogation on the event
         *
         * @param {Function} callback
         * @param {Event} e
         * @returns void
         */
        function _fireCallback(callback, e, combo, sequence) {

            // if this event should not happen stop here
            if (self.stopCallback(e, e.target || e.srcElement, combo, sequence)) {
                return;
            }

            if (callback(e, combo) === false) {
                _preventDefault(e);
                _stopPropagation(e);
            }
        }

        /**
         * handles a character key event
         *
         * @param {string} character
         * @param {Array} modifiers
         * @param {Event} e
         * @returns void
         */
        self._handleKey = function(character, modifiers, e) {
            var callbacks = _getMatches(character, modifiers, e);
            var i;
            var doNotReset = {};
            var maxLevel = 0;
            var processedSequenceCallback = false;

            // Calculate the maxLevel for sequences so we can only execute the longest callback sequence
            for (i = 0; i < callbacks.length; ++i) {
                if (callbacks[i].seq) {
                    maxLevel = Math.max(maxLevel, callbacks[i].level);
                }
            }

            // loop through matching callbacks for this key event
            for (i = 0; i < callbacks.length; ++i) {

                // fire for all sequence callbacks
                // this is because if for example you have multiple sequences
                // bound such as "g i" and "g t" they both need to fire the
                // callback for matching g cause otherwise you can only ever
                // match the first one
                if (callbacks[i].seq) {

                    // only fire callbacks for the maxLevel to prevent
                    // subsequences from also firing
                    //
                    // for example 'a option b' should not cause 'option b' to fire
                    // even though 'option b' is part of the other sequence
                    //
                    // any sequences that do not match here will be discarded
                    // below by the _resetSequences call
                    if (callbacks[i].level != maxLevel) {
                        continue;
                    }

                    processedSequenceCallback = true;

                    // keep a list of which sequences were matches for later
                    doNotReset[callbacks[i].seq] = 1;
                    _fireCallback(callbacks[i].callback, e, callbacks[i].combo, callbacks[i].seq);
                    continue;
                }

                // if there were no sequence matches but we are still here
                // that means this is a regular match so we should fire that
                if (!processedSequenceCallback) {
                    _fireCallback(callbacks[i].callback, e, callbacks[i].combo);
                }
            }

            // if the key you pressed matches the type of sequence without
            // being a modifier (ie "keyup" or "keypress") then we should
            // reset all sequences that were not matched by this event
            //
            // this is so, for example, if you have the sequence "h a t" and you
            // type "h e a r t" it does not match.  in this case the "e" will
            // cause the sequence to reset
            //
            // modifier keys are ignored because you can have a sequence
            // that contains modifiers such as "enter ctrl+space" and in most
            // cases the modifier key will be pressed before the next key
            //
            // also if you have a sequence such as "ctrl+b a" then pressing the
            // "b" key will trigger a "keypress" and a "keydown"
            //
            // the "keydown" is expected when there is a modifier, but the
            // "keypress" ends up matching the _nextExpectedAction since it occurs
            // after and that causes the sequence to reset
            //
            // we ignore keypresses in a sequence that directly follow a keydown
            // for the same character
            var ignoreThisKeypress = e.type == 'keypress' && _ignoreNextKeypress;
            if (e.type == _nextExpectedAction && !_isModifier(character) && !ignoreThisKeypress) {
                _resetSequences(doNotReset);
            }

            _ignoreNextKeypress = processedSequenceCallback && e.type == 'keydown';
        };

        /**
         * handles a keydown event
         *
         * @param {Event} e
         * @returns void
         */
        function _handleKeyEvent(e) {

            // normalize e.which for key events
            // @see http://stackoverflow.com/questions/4285627/javascript-keycode-vs-charcode-utter-confusion
            if (typeof e.which !== 'number') {
                e.which = e.keyCode;
            }

            var character = _characterFromEvent(e);

            // no character found then stop
            if (!character) {
                return;
            }

            // need to use === for the character check because the character can be 0
            if (e.type == 'keyup' && _ignoreNextKeyup === character) {
                _ignoreNextKeyup = false;
                return;
            }

            self.handleKey(character, _eventModifiers(e), e);
        }

        /**
         * called to set a 1 second timeout on the specified sequence
         *
         * this is so after each key press in the sequence you have 1 second
         * to press the next key before you have to start over
         *
         * @returns void
         */
        function _resetSequenceTimer() {
            clearTimeout(_resetTimer);
            _resetTimer = setTimeout(_resetSequences, 1000);
        }

        /**
         * binds a key sequence to an event
         *
         * @param {string} combo - combo specified in bind call
         * @param {Array} keys
         * @param {Function} callback
         * @param {string=} action
         * @returns void
         */
        function _bindSequence(combo, keys, callback, action) {

            // start off by adding a sequence level record for this combination
            // and setting the level to 0
            _sequenceLevels[combo] = 0;

            /**
             * callback to increase the sequence level for this sequence and reset
             * all other sequences that were active
             *
             * @param {string} nextAction
             * @returns {Function}
             */
            function _increaseSequence(nextAction) {
                return function() {
                    _nextExpectedAction = nextAction;
                    ++_sequenceLevels[combo];
                    _resetSequenceTimer();
                };
            }

            /**
             * wraps the specified callback inside of another function in order
             * to reset all sequence counters as soon as this sequence is done
             *
             * @param {Event} e
             * @returns void
             */
            function _callbackAndReset(e) {
                _fireCallback(callback, e, combo);

                // we should ignore the next key up if the action is key down
                // or keypress.  this is so if you finish a sequence and
                // release the key the final key will not trigger a keyup
                if (action !== 'keyup') {
                    _ignoreNextKeyup = _characterFromEvent(e);
                }

                // weird race condition if a sequence ends with the key
                // another sequence begins with
                setTimeout(_resetSequences, 10);
            }

            // loop through keys one at a time and bind the appropriate callback
            // function.  for any key leading up to the final one it should
            // increase the sequence. after the final, it should reset all sequences
            //
            // if an action is specified in the original bind call then that will
            // be used throughout.  otherwise we will pass the action that the
            // next key in the sequence should match.  this allows a sequence
            // to mix and match keypress and keydown events depending on which
            // ones are better suited to the key provided
            for (var i = 0; i < keys.length; ++i) {
                var isFinal = i + 1 === keys.length;
                var wrappedCallback = isFinal ? _callbackAndReset : _increaseSequence(action || _getKeyInfo(keys[i + 1]).action);
                _bindSingle(keys[i], wrappedCallback, action, combo, i);
            }
        }

        /**
         * binds a single keyboard combination
         *
         * @param {string} combination
         * @param {Function} callback
         * @param {string=} action
         * @param {string=} sequenceName - name of sequence if part of sequence
         * @param {number=} level - what part of the sequence the command is
         * @returns void
         */
        function _bindSingle(combination, callback, action, sequenceName, level) {

            // store a direct mapped reference for use with Mousetrap.trigger
            self._directMap[combination + ':' + action] = callback;

            // make sure multiple spaces in a row become a single space
            combination = combination.replace(/\s+/g, ' ');

            var sequence = combination.split(' ');
            var info;

            // if this pattern is a sequence of keys then run through this method
            // to reprocess each pattern one key at a time
            if (sequence.length > 1) {
                _bindSequence(combination, sequence, callback, action);
                return;
            }

            info = _getKeyInfo(combination, action);

            // make sure to initialize array if this is the first time
            // a callback is added for this key
            self._callbacks[info.key] = self._callbacks[info.key] || [];

            // remove an existing match if there is one
            _getMatches(info.key, info.modifiers, {type: info.action}, sequenceName, combination, level);

            // add this call back to the array
            // if it is a sequence put it at the beginning
            // if not put it at the end
            //
            // this is important because the way these are processed expects
            // the sequence ones to come first
            self._callbacks[info.key][sequenceName ? 'unshift' : 'push']({
                callback: callback,
                modifiers: info.modifiers,
                action: info.action,
                seq: sequenceName,
                level: level,
                combo: combination
            });
        }

        /**
         * binds multiple combinations to the same callback
         *
         * @param {Array} combinations
         * @param {Function} callback
         * @param {string|undefined} action
         * @returns void
         */
        self._bindMultiple = function(combinations, callback, action) {
            for (var i = 0; i < combinations.length; ++i) {
                _bindSingle(combinations[i], callback, action);
            }
        };

        // start!
        _addEvent(targetElement, 'keypress', _handleKeyEvent);
        _addEvent(targetElement, 'keydown', _handleKeyEvent);
        _addEvent(targetElement, 'keyup', _handleKeyEvent);
    }

    /**
     * binds an event to mousetrap
     *
     * can be a single key, a combination of keys separated with +,
     * an array of keys, or a sequence of keys separated by spaces
     *
     * be sure to list the modifier keys first to make sure that the
     * correct key ends up getting bound (the last key in the pattern)
     *
     * @param {string|Array} keys
     * @param {Function} callback
     * @param {string=} action - 'keypress', 'keydown', or 'keyup'
     * @returns void
     */
    Mousetrap.prototype.bind = function(keys, callback, action) {
        var self = this;
        keys = keys instanceof Array ? keys : [keys];
        self._bindMultiple.call(self, keys, callback, action);
        return self;
    };

    /**
     * unbinds an event to mousetrap
     *
     * the unbinding sets the callback function of the specified key combo
     * to an empty function and deletes the corresponding key in the
     * _directMap dict.
     *
     * TODO: actually remove this from the _callbacks dictionary instead
     * of binding an empty function
     *
     * the keycombo+action has to be exactly the same as
     * it was defined in the bind method
     *
     * @param {string|Array} keys
     * @param {string} action
     * @returns void
     */
    Mousetrap.prototype.unbind = function(keys, action) {
        var self = this;
        return self.bind.call(self, keys, function() {}, action);
    };

    /**
     * triggers an event that has already been bound
     *
     * @param {string} keys
     * @param {string=} action
     * @returns void
     */
    Mousetrap.prototype.trigger = function(keys, action) {
        var self = this;
        if (self._directMap[keys + ':' + action]) {
            self._directMap[keys + ':' + action]({}, keys);
        }
        return self;
    };

    /**
     * resets the library back to its initial state.  this is useful
     * if you want to clear out the current keyboard shortcuts and bind
     * new ones - for example if you switch to another page
     *
     * @returns void
     */
    Mousetrap.prototype.reset = function() {
        var self = this;
        self._callbacks = {};
        self._directMap = {};
        return self;
    };

    /**
     * should we stop this event before firing off callbacks
     *
     * @param {Event} e
     * @param {Element} element
     * @return {boolean}
     */
    Mousetrap.prototype.stopCallback = function(e, element) {
        var self = this;

        // if the element has the class "mousetrap" then no need to stop
        if ((' ' + element.className + ' ').indexOf(' mousetrap ') > -1) {
            return false;
        }

        if (_belongsTo(element, self.target)) {
            return false;
        }

        // Events originating from a shadow DOM are re-targetted and `e.target` is the shadow host,
        // not the initial event target in the shadow tree. Note that not all events cross the
        // shadow boundary.
        // For shadow trees with `mode: 'open'`, the initial event target is the first element in
        // the event’s composed path. For shadow trees with `mode: 'closed'`, the initial event
        // target cannot be obtained.
        if ('composedPath' in e && typeof e.composedPath === 'function') {
            // For open shadow trees, update `element` so that the following check works.
            var initialEventTarget = e.composedPath()[0];
            if (initialEventTarget !== e.target) {
                element = initialEventTarget;
            }
        }

        // stop for input, select, and textarea
        return element.tagName == 'INPUT' || element.tagName == 'SELECT' || element.tagName == 'TEXTAREA' || element.isContentEditable;
    };

    /**
     * exposes _handleKey publicly so it can be overwritten by extensions
     */
    Mousetrap.prototype.handleKey = function() {
        var self = this;
        return self._handleKey.apply(self, arguments);
    };

    /**
     * allow custom key mappings
     */
    Mousetrap.addKeycodes = function(object) {
        for (var key in object) {
            if (object.hasOwnProperty(key)) {
                _MAP[key] = object[key];
            }
        }
        _REVERSE_MAP = null;
    };

    /**
     * Init the global mousetrap functions
     *
     * This method is needed to allow the global mousetrap functions to work
     * now that mousetrap is a constructor function.
     */
    Mousetrap.init = function() {
        var documentMousetrap = Mousetrap(document);
        for (var method in documentMousetrap) {
            if (method.charAt(0) !== '_') {
                Mousetrap[method] = (function(method) {
                    return function() {
                        return documentMousetrap[method].apply(documentMousetrap, arguments);
                    };
                } (method));
            }
        }
    };

    Mousetrap.init();

    // expose mousetrap to the global object
    window.Mousetrap = Mousetrap;

    // expose as a common js module
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = Mousetrap;
    }

    // expose mousetrap as an AMD module
    if (typeof define === 'function' && define.amd) {
        define(function() {
            return Mousetrap;
        });
    }
}) (typeof window !== 'undefined' ? window : null, typeof  window !== 'undefined' ? document : null);

},{}],2:[function(require,module,exports){
'use strict';

var m = require('./matrix');
var mousetrap = require('mousetrap');

var _require = require('./models'),
    makeModel = _require.makeModel,
    drawModel = _require.drawModel;

var aquariumSize = {
  x: 10 * 0.8,
  y: 7 * 0.7,
  z: 10 * 0.8
};

var aquariumSizeOri = {
  x: 10,
  y: 7,
  z: 10
};

function toRad(angle) {
  return angle * Math.PI / 180.0;
}

function timeNow() {
  return new Date().getTime() / 1000.0;
}

var fishes = [];
var turnTime = 10;
var currentViewFish = 0;
var fishViewOn = false;

mousetrap.bind('left', function () {
  return currentViewFish = (fishes.length + currentViewFish + 1) % fishes.length;
});
mousetrap.bind('right', function () {
  return currentViewFish = (fishes.length + currentViewFish - 1) % fishes.length;
});

function fishFront() {
  var fish = fishes[currentViewFish];
  var x = fish.lookx - fish.x;
  var y = fish.looky - fish.y;
  var z = fish.lookz - fish.z;
  var magnitude = Math.sqrt(x * x + y * y + z * z);
  fish.x += 0.05 * x / magnitude;
  fish.y += 0.05 * y / magnitude;
  fish.z += 0.05 * z / magnitude;
  fish.lookx += 0.05 * x / magnitude;
  fish.looky += 0.05 * y / magnitude;
  fish.lookz += 0.05 * z / magnitude;
}

function fishLeft() {
  var fish = fishes[currentViewFish];
  var r = (fish.x - fish.lookx) * (fish.x - fish.lookx) + (fish.z - fish.lookz) * (fish.z - fish.lookz);
  r = Math.sqrt(r);
  var theta = Math.atan2(fish.z - fish.lookz, fish.x - fish.lookx);
  theta -= 0.02;
  fish.lookx = fish.x + r * Math.cos(theta);
  fish.lookz = fish.z + r * Math.sin(theta);
}

function fishRight() {
  var fish = fishes[currentViewFish];
  var r = (fish.x - fish.lookx) * (fish.x - fish.lookx) + (fish.z - fish.lookz) * (fish.z - fish.lookz);
  r = Math.sqrt(r);
  var theta = Math.atan2(fish.z - fish.lookz, fish.x - fish.lookx);
  theta += 0.02;
  fish.lookx = fish.x + r * Math.cos(theta);
  fish.lookz = fish.z + r * Math.sin(theta);
}

function Fish(x, y, z, lookx, looky, lookz, alive, type, id, scale, lastTurnTime, triggerReverse, angley) {
  return {
    x: x,
    y: y,
    z: z,
    lookx: lookx,
    looky: looky,
    lookz: lookz,
    alive: alive,
    type: type,
    id: id,
    scale: scale,
    lastTurnTime: lastTurnTime,
    triggerReverse: triggerReverse,
    angley: angley
    // tempLook,
    // isRotating,
  };
}

function cycleFish() {
  fishViewOn = true;
  var temp = [fishes[currentViewFish].x, fishes[currentViewFish].y, fishes[currentViewFish].z];
  var ret = temp.concat([fishes[currentViewFish].lookx, fishes[currentViewFish].looky, fishes[currentViewFish].lookz]);
  // currentViewFish = (currentViewFish + 1) % fishes.length
  return ret;
}

function cancelFishView() {
  currentViewFish = 0;
  fishViewOn = false;
}

function initFish() {
  var fish1 = Fish(0, 0, 0, 1, 1, 1, true, 1, 1, [0.7, 0.7, 0.7], timeNow(), 0, 0);
  var fish2 = Fish(3, 3, 3, -1, -1, -1, true, 2, 2, [0.7, 0.7, 0.7], timeNow(), 0, 0);
  var fish3 = Fish(-2, -2, -2, 1, 0, 0, true, 3, 3, [0.7, 0.7, 0.7], timeNow(), 0, 0);
  var fish4 = Fish(-1, 2, -2, 0, 0, 1, true, 4, 4, [0.7, 0.7, 0.7], timeNow(), 0, 0);

  fishes = [fish1, fish2, fish3, fish4];

  fishes.map(function (fish) {
    makeModel('fish' + fish.type.toString(), 'assets/fish' + fish.type, [fish.x, fish.y, fish.z], fish.scale);
  });
  makeModel('egg', 'assets/food', [0, 0, 0], [0.3, 0.3, 0.3]);
}

function fishMoveTowardsFood(foodx, foody, foodz) {
  fishes.map(function (fish) {
    fish.lookx = foodx;
    fish.looky = foody;
    fish.lookz = foodz;
  });
}

mousetrap.bind('k', function () {
  fishes.splice(currentViewFish || 0, 1);
  currentViewFish = (currentViewFish + 1) % fishes.length;
});

var eggData = {
  timeBeforeShrink: 3,
  startTime: 0,
  active: false
};

mousetrap.bind('e', function () {
  if (!eggData.active) {
    models.egg['center'][0] = fishes[currentViewFish || 0].x;
    models.egg['center'][1] = fishes[currentViewFish || 0].y;
    models.egg['center'][2] = fishes[currentViewFish || 0].z;
    eggData.active = true;
    eggData.startTime = new Date().getTime() / 1000.0;
  }
  // console.log('eggs');
});

function drawFish() {
  fishes.map(function (fish, idx) {
    if (!fishViewOn || fishViewOn && idx != currentViewFish) {
      var mfish = models['fish' + fish.type.toString()];
      var eggs = models['egg'];
      // var x = fish.lookx - fish.x
      // var y = fish.looky - fish.y
      // var z = fish.lookz - fish.z
      //
      // var theta = Math.atan2(z, x)
      // var phi = Math.atan2(y, Math.sqrt(x*x + z*z))
      // console.log("HIIII", theta, phi)
      Matrices.model = m.scale(fish.scale);
      Matrices.model = m.multiply(m.rotateY(fish.angley * Math.PI / 180), Matrices.model);
      Matrices.model = m.multiply(m.inverse(m.lookAt([fish.x, fish.y, fish.z], [-fish.lookx, -fish.looky, -fish.lookz], [0, 1, 0])), Matrices.model);
      drawModel(mfish);
    }

    if (eggData.active) {
      Matrices.model = m.multiply(m.translate(eggs.center), m.scale(eggs.scale));
      drawModel(eggs);
    }
  });
}

function updateFish() {

  fishes.map(function (fish) {
    // if(fish.isRotating){
    //   if(fish.isRotating==1){
    //     fish.lookx -= fish.tempLook /10
    //   }
    //   else if(fish.isRotating == 2){
    //     fish.looky -= fish.tempLook/10
    //   }
    //   else if(fish.isRotating == 3){
    //     fish.lookz -= fish.tempLook/10
    //   }
    //   if(fish.lookx == -1 * fish.templook || fish.looky == -1 * fish.templook || fish.lookz == -1 * fish.templook){
    //     fish.isRotating = 0
    //     fish.tempLook = 0
    //   }
    // }
    // if(!fish.isRotating) {

    //Wiggling
    // console.log(fish.angley, fish.triggerReverse)
    if (fish.angley.toFixed(1) <= 10 && fish.triggerReverse == 1) {
      fish.angley += 1;
      fish.angley += Math.random() / 2;
      if (fish.angley.toFixed(1) >= 10) {
        fish.angley = 10;
        fish.triggerReverse = 0;
      }
    }
    if (fish.angley.toFixed(1) >= -10 && fish.triggerReverse == 0) {
      fish.angley -= 1;
      fish.angley -= Math.random() / 2;
      if (fish.angley.toFixed(1) <= -10) {
        fish.angley = -10;
        fish.triggerReverse = 1;
      }
    }

    if (fish.x >= aquariumSize.x - 1.2 || fish.x <= -aquariumSize.x + 1.2) {
      fish.lookx = -1 * fish.lookx;
      // fish.isRotating = 1
      // fish.tempLook = fish.lookx
    }
    if (fish.y >= aquariumSize.y - 1.2 || fish.y <= -aquariumSize.y + 1.2) {
      fish.looky = -1 * fish.looky;
      // fish.isRotating = 2
      // fish.tempLook = fish.looky
    }
    if (fish.z >= aquariumSize.z - 1.2 || fish.z <= -aquariumSize.z + 1.2) {
      fish.lookz = -1 * fish.lookz;
      // fish.isRotating = 3
      // fish.tempLook = fish.lookz
    }
    if (timeNow() - fish.lastTurnTime <= turnTime) {
      var x = fish.lookx - fish.x;
      var y = fish.looky - fish.y;
      var z = fish.lookz - fish.z;
      var magnitude = Math.sqrt(x * x + y * y + z * z);
      fish.x += 0.07 * x / magnitude;
      fish.y += 0.07 * y / magnitude;
      fish.z += 0.07 * z / magnitude;
      fish.lookx += 0.07 * x / magnitude;
      fish.looky += 0.07 * y / magnitude;
      fish.lookz += 0.07 * z / magnitude;
    } else {
      fish.lookx = fish.x + 3 * (Math.random() - 0.5);
      fish.looky = fish.y + 3 * (Math.random() - 0.5);
      fish.lookz = fish.z + 3 * (Math.random() - 0.5);
      fish.lastTurnTime = timeNow();
    }

    if (fish.scale[0] < 0.7) fish.scale[0] = fish.scale[1] = fish.scale[2] = fish.scale[0] + 0.001;
    // }
  });
}

function updateEgg() {
  if (eggData.active) {
    if (models.egg['center'][1] >= -aquariumSize.y + 1) {
      models.egg['center'][1] -= 0.2;
    } else {
      var time = new Date().getTime() / 1000.0;
      if (time - eggData.startTime <= eggData.timeBeforeShrink) {
        for (var i = 0; i <= 2; i++) {
          models.egg['scale'][i] -= 0.008;
        }
      } else {
        for (var j = 0; j <= 2; j++) {
          models.egg['scale'][j] = 1;
        }eggData.active = false;
        var fish5 = Fish(models.egg['center'][0], models.egg['center'][1] - 1, models.egg['center'][2], -1, -1, -1, true, 2, 2, [0.1, 0.1, 0.1], timeNow(), 0, 0);
        fishes.push(fish5);
      }
    }
  } else {
    models.egg['center'][1] = aquariumSize.y - 1;
  }
}

module.exports = {
  initFish: initFish,
  drawFish: drawFish,
  updateFish: updateFish,
  cycleFish: cycleFish,
  cancelFishView: cancelFishView,
  fishMoveTowardsFood: fishMoveTowardsFood,
  aquariumSize: aquariumSizeOri,
  updateEgg: updateEgg,
  fishFront: fishFront,
  fishLeft: fishLeft,
  fishRight: fishRight
};

},{"./matrix":4,"./models":5,"mousetrap":1}],3:[function(require,module,exports){
'use strict';

var shaders = require('./shaders');

var _require = require('./models'),
    drawModel = _require.drawModel,
    makeModel = _require.makeModel,
    drawLight = _require.drawLight;

var m = require('./matrix');
var vec = require('./vector');
var weedStart = 0;
var movepositivex = 1;
var pebblesN = 15;

var _require2 = require('./fish'),
    initFish = _require2.initFish,
    drawFish = _require2.drawFish,
    updateFish = _require2.updateFish,
    cycleFish = _require2.cycleFish,
    cancelFishView = _require2.cancelFishView,
    fishMoveTowardsFood = _require2.fishMoveTowardsFood,
    aquariumSize = _require2.aquariumSize,
    updateEgg = _require2.updateEgg,
    fishFront = _require2.fishFront,
    fishLeft = _require2.fishLeft,
    fishRight = _require2.fishRight;

var fishMovingTowardsFood = false;

var mousetrap = require('mousetrap');

mousetrap.bind('c', function () {
  if (!Camera.fishView) {
    Camera.mouseUpdate = !Camera.mouseUpdate;
  }
});

mousetrap.bind('f', function () {
  // Camera.fishLens = !Camera.fishLens;
  // console.log('BIIIII', Camera)
  if (!Camera.fishView) {
    Camera.fishView = true;
  } else {
    cancelFishView();
    Camera.fishView = false;
  }
});

mousetrap.bind('v', function () {
  // Camera.fishLens = !Camera.fishLens;
  // console.log('BIIIII', Camera)
  Camera.fishLens = !Camera.fishLens;
});

mousetrap.bind('s', function () {
  if (!Camera.fishView) {
    var xd = Camera.lookx - Camera.x;
    var yd = Camera.looky - Camera.y;
    var zd = Camera.lookz - Camera.z;
    var magnitude = Math.sqrt(xd * xd + yd * yd + zd * zd);
    Camera.x -= 0.8 * xd / magnitude;
    Camera.y -= 0.8 * yd / magnitude;
    Camera.z -= 0.8 * zd / magnitude;
    updateCameraTarget();
  }
});

mousetrap.bind('w', function () {
  if (!Camera.fishView) {
    var xd = Camera.lookx - Camera.x;
    var yd = Camera.looky - Camera.y;
    var zd = Camera.lookz - Camera.z;
    var magnitude = Math.sqrt(xd * xd + yd * yd + zd * zd);
    Camera.x += 0.8 * xd / magnitude;
    Camera.y += 0.8 * yd / magnitude;
    Camera.z += 0.8 * zd / magnitude;
    updateCameraTarget();
  } else {
    fishFront();
  }
});

mousetrap.bind('a', function () {
  if (Camera.fishView) {
    fishLeft();
  }
});

mousetrap.bind('d', function () {
  if (Camera.fishView) {
    fishRight();
  }
});

function updateCameraTarget(e) {
  if (!Camera.mouseUpdate || Camera.fishView) return;
  var rect = window.canvas.getBoundingClientRect();
  if (e) {
    Camera.mouseX = e.clientX;
    Camera.mouseY = e.clientY;
  }
  var x = Camera.mouseX - rect.left,
      y = Camera.mouseY - rect.top;
  x = x - window.canvas.width / 2.0, y = window.canvas.height / 2.0 - y;

  var theta = -180.0 / window.canvas.height * y + 90.0;
  var phi = 360.0 / window.canvas.width * x + 180.0;

  var dx = 1 * Math.sin(toRadians(theta)) * Math.cos(toRadians(phi));
  var dy = 1 * Math.cos(toRadians(theta));
  var dz = 1 * Math.sin(toRadians(theta)) * Math.sin(toRadians(phi));

  Camera.lookx = Camera.x + dx;
  Camera.looky = Camera.y + dy;
  Camera.lookz = Camera.z + dz;
}

var bubbles = {
  activeBubbles: [],
  num: 0
};

var foodData = {
  timeBeforeShrink: 3,
  startTime: 0,
  active: false
};

var Camera = {
  x: 19,
  y: 9,
  z: 12,
  lookx: 0,
  looky: 0,
  lookz: 0,
  mouseUpdate: true,
  fishLens: false,
  fishView: false,
  mouseX: 0,
  mouseY: 0
};

function toRadians(angle) {
  return angle * (Math.PI / 180);
}

// window.$ = require('jquery')
window.Matrices = {};
window.models = {};

function resizeCanvas() {
  canvas.height = canvas.width = Math.min($(document).height(), $(document).width());
}

function Initialize() {
  document.getElementById('backaudio').play();
  window.canvas = document.getElementById("canvas");
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  window.canvas.oncontextmenu = function () {
    bubbles.num++;
    bubbles.activeBubbles.push(bubbles.num);
    var x = Math.floor(Math.random() * (2 * aquariumSize.x + 1) - aquariumSize.x);
    var z = Math.floor(Math.random() * (2 * aquariumSize.z + 1) - aquariumSize.z);
    makeModel('bubble' + bubbles.num.toString(), 'assets/bubble', [x, -aquariumSize.y + 2, z], [0.3, 0.3, 0.3]);

    return false;
  };

  window.canvas.onmousemove = updateCameraTarget;

  window.canvas.onclick = function () {
    if (!foodData.active) {
      models.food['center'][0] = Math.floor(Math.random() * (2 * aquariumSize.x + 1 - 1.6) - aquariumSize.x);
      models.food['center'][2] = Math.floor(Math.random() * (2 * aquariumSize.z + 1 - 1.6) - aquariumSize.z);
      foodData.active = true;
      foodData.startTime = new Date().getTime() / 1000.0;
      fishMovingTowardsFood = true;
      fishMoveTowardsFood();
    }
  };

  window.gl = canvas.getContext("experimental-webgl");
  gl.clearColor(0.0, 0.0, 0.0, 1.0);

  // setup a GLSL program
  shaders.createShader('material');

  // makeModel('table','assets/Table',[0, -aquariumSize.y*2.7, -2],[12,8,10])

  for (var i = 0; i < pebblesN; i++) {
    makeModel('pebble' + i, 'assets/pebble', [-aquariumSize.x * 0.9 + 1.8 * aquariumSize.x * Math.random(), -aquariumSize.y + 0.1, -aquariumSize.z * 0.9 + 1.8 * aquariumSize.z * Math.random()], [0.4, 0.4, 0.4]);
  }

  makeModel('rock', 'assets/rock', [6, -aquariumSize.y + 1, 6], [0.4, 0.4, 0.4]);

  makeModel('wall', 'assets/wall', [0, 0, 0], [30, 30, 30]);

  makeModel('light', 'assets/cube', [28, 25, 0], [1, 1, 4]);

  makeModel('fish', 'assets/fish', [0, 0, 0]);
  makeModel('xaxis', 'assets/cube', [1, 0, 0], [1, 0.1, 0.1]);
  makeModel('yaxis', 'assets/cube', [0, 1, 0], [0.1, 1, 0.1]);
  makeModel('aquarium', 'assets/aquarium', [0, 0, 0], [aquariumSize.x, aquariumSize.y, aquariumSize.z]);
  makeModel('sand', 'assets/sand', [0, -aquariumSize.y - 1, 0], [aquariumSize.x, -1, aquariumSize.z]);
  makeModel('metal', 'assets/metal', [0, aquariumSize.y + 0.2, 0], [aquariumSize.x, 0.2, aquariumSize.z]);
  makeModel('table', 'assets/table', [0, -(26 - aquariumSize.y), 0], [1.5 * aquariumSize.x, 28 - aquariumSize.y, 2.5 * aquariumSize.z]);
  makeModel('weed', 'assets/weed', [-aquariumSize.x + 3.2, -aquariumSize.y, 1], [0.04, 0.04, 0.04]);
  makeModel('ship', 'assets/ship', [1.5, -aquariumSize.y + 0.3, -aquariumSize.z * 0.7], [2, 2, 2]);
  makeModel('food', 'assets/food', [0, 0, 0], [1, 1, 1]);

  makeModel('cubetex', 'assets/cubetex', [15, 10, 5]);

  initFish();

  tick();
}
window.Initialize = Initialize;

window.Camera = Camera;

var lastTime = 0;
function animate() {
  var timeNow = new Date().getTime();
  if (lastTime == 0) {
    lastTime = timeNow;return;
  }
  // var d = (timeNow - lastTime) / 50;
  updateFishView();
  updateCamera();
  updateBubbles();
  tickWeed();
  updateFood();
  updateFish();
  updateEgg();
  lastTime = timeNow;
}

function updateFishView() {
  if (Camera.fishView) {
    var eyetarget = cycleFish();
    // console.log(eyetarget)
    Camera.x = eyetarget[0], Camera.y = eyetarget[1], Camera.z = eyetarget[2];
    Camera.lookx = eyetarget[3], Camera.looky = eyetarget[4], Camera.lookz = eyetarget[5];
  }
}

function updateBubbles() {
  bubbles.activeBubbles.map(function (n, i) {
    var bubble = models['bubble' + n.toString()];
    var y = bubble['center'][1];

    if (y <= aquariumSize.y - 0.8) {
      bubble['center'][1] += 0.2;
    } else {
      bubbles.activeBubbles.splice(i, 1);
    }
  });
}

function updateFood() {
  if (foodData.active) {
    if (fishMovingTowardsFood) {
      fishMoveTowardsFood(models.food['center'][0], models.food['center'][1], models.food['center'][2]);
    }
    if (models.food['center'][1] >= -aquariumSize.y + 1) {
      models.food['center'][1] -= 0.2;
    } else {
      var time = new Date().getTime() / 1000.0;
      if (time - foodData.startTime <= foodData.timeBeforeShrink) {
        for (var i = 0; i <= 2; i++) {
          models.food['scale'][i] -= 0.008;
        }
      } else {
        for (var j = 0; j <= 2; j++) {
          models.food['scale'][j] = 1;
        }fishMovingTowardsFood = false;
        foodData.active = false;
      }
    }
  } else {
    models.food['center'][1] = aquariumSize.y - 1;
  }
}

function tickWeed() {
  var _models = models,
      weed = _models.weed;


  if (weed.anglex <= 10 && movepositivex == 1) {
    weed.anglex += 0.2;
    if (weed.anglex > 10) {
      movepositivex = 0;
    }
  }
  if (weed.anglex >= -10 && movepositivex == 0) {
    weed.anglex -= 0.2;
    if (weed.anglex < -10) {
      movepositivex = 1;
    }
  }
}

function drawScene() {
  var _models2 = models,
      aquarium = _models2.aquarium,
      sand = _models2.sand,
      metal = _models2.metal,
      ship = _models2.ship;
  var _models3 = models,
      weed = _models3.weed,
      wall = _models3.wall,
      light = _models3.light,
      rock = _models3.rock,
      food = _models3.food,
      table = _models3.table;
  // var { cubetex } = models
  //console.log(fishRotationY, fishRotationX);

  if (!weedStart) {
    weed.anglex = 0;
    weed.angley = 0;
    weed.anglez = 0;
    weedStart = 1;
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.1, 0.1, 0.1, 1.0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  shaders.useShader('material');

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);

  // Matrices.model = m.multiply(m.translate(cubetex.center), m.scale(cubetex.scale))
  // drawModel(cubetex)

  Matrices.model = m.scale(weed.scale);
  Matrices.model = m.multiply(Matrices.model, m.rotateX(weed.anglex * Math.PI / 180));
  //console.log(weed.center);
  Matrices.model = m.multiply(m.translate(weed.center), Matrices.model);
  drawModel(weed);

  Matrices.model = m.multiply(m.translate(rock.center), m.scale(rock.scale));
  drawModel(rock);

  Matrices.model = m.multiply(m.translate(sand.center), m.scale(sand.scale));
  drawModel(sand);

  Matrices.model = m.multiply(m.translate(metal.center), m.scale(metal.scale));
  drawModel(metal);

  // Matrices.model = m.scale(table.scale)
  // //Matrices.model = m.multiply(Matrices.model, m.rotateZ(10*Math.PI/180))
  // //Matrices.model = m.multiply(Matrices.model, m.rotateX(1*Math.PI/180))
  // Matrices.model = m.multiply(m.translate(table.center), Matrices.model)
  // drawModel(table)

  for (var i = 0; i < pebblesN; i++) {
    var pebble = models['pebble' + i];
    Matrices.model = m.multiply(m.translate(pebble.center), m.scale(pebble.scale));
    drawModel(pebble);
  }

  bubbles.activeBubbles.map(function (n) {
    var bubble = models['bubble' + n.toString()];
    Matrices.model = m.multiply(m.translate(bubble.center), m.scale(bubble.scale));
    drawModel(bubble);
  });

  Matrices.model = m.multiply(m.translate(wall.center), m.scale(wall.scale));
  drawModel(wall);

  Matrices.model = m.rotateZ(Math.PI * 15 / 180);
  Matrices.model = m.multiply(m.scale(ship.scale), Matrices.model);
  Matrices.model = m.multiply(m.translate(ship.center), Matrices.model);
  drawModel(ship);

  Matrices.model = m.multiply(m.translate(table.center), m.scale(table.scale));
  drawModel(table);

  Matrices.model = m.multiply(m.translate(light.center), m.scale(light.scale));
  drawLight(light);

  if (foodData.active) {
    Matrices.model = m.multiply(m.translate(food.center), m.scale(food.scale));
    drawModel(food);
  }

  drawFish();

  gl.enable(gl.BLEND);
  gl.blendFunc(gl.ONE, gl.ONE);
  if (Camera.x > aquariumSize.x || Camera.x < -aquariumSize.x || Camera.y > aquariumSize.y || Camera.y < -aquariumSize.y || Camera.z > aquariumSize.z || Camera.z < -aquariumSize.z) {
    gl.enable(gl.CULL_FACE);
  }
  Matrices.model = m.multiply(m.translate(aquarium.center), m.scale(aquarium.scale));
  drawModel(aquarium);
  gl.disable(gl.CULL_FACE);
  gl.disable(gl.BLEND);
}

function updateCamera() {
  var up = [0, 1, 0];
  var eye = [Camera.x, Camera.y, Camera.z];
  var target = [Camera.lookx, Camera.looky, Camera.lookz];
  Matrices.view = m.lookAt(eye, target, up);
  Matrices.projection = m.perspective(Math.PI / 2, canvas.width / canvas.height, 0.1, 500);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "view"), false, Matrices.view);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "projection"), false, Matrices.projection);
  gl.uniform1i(gl.getUniformLocation(program, "isFishLens"), Camera.fishLens && Camera.fishView);
  // return m.multiply(Matrices.projection, Matrices.view);

  var lightPos = models.light.center;
  var lightPosLoc = gl.getUniformLocation(program, "light.position");
  var viewPosLoc = gl.getUniformLocation(program, "viewPos");
  gl.uniform3f(lightPosLoc, lightPos[0], lightPos[1], lightPos[2]);
  gl.uniform3f(viewPosLoc, eye[0], eye[1], eye[2]);
  var lightColor = [];
  lightColor[0] = 1;
  lightColor[1] = 1;
  lightColor[2] = 1;
  var diffuseColor = vec.multiplyScalar(lightColor, 0.5); // Decrease the influence
  var ambientColor = vec.multiplyScalar(diffuseColor, 1); // Low influence
  gl.uniform3f(gl.getUniformLocation(program, "light.ambient"), ambientColor[0], ambientColor[1], ambientColor[2]);
  gl.uniform3f(gl.getUniformLocation(program, "light.diffuse"), diffuseColor[0], diffuseColor[1], diffuseColor[2]);
  gl.uniform3f(gl.getUniformLocation(program, "light.specular"), 1.0, 1.0, 1.0);
}

function tick() {
  window.requestAnimationFrame(tick);
  if (!window.program) return;
  drawScene();
  animate();
}

},{"./fish":2,"./matrix":4,"./models":5,"./shaders":6,"./vector":7,"mousetrap":1}],4:[function(require,module,exports){
'use strict';

var vec = require('./vector');

// 0 1 2 3        0 1 2 3
// 4 5 6 7        4 5 6 7
// 8 9 10 11      8 9 10 11
// 12 13 14 15    12 13 14 15
function matrixMultiply(mat2, mat1) {
  return [mat1[0] * mat2[0] + mat1[1] * mat2[4] + mat1[2] * mat2[8] + mat1[3] * mat2[12], mat1[0] * mat2[1] + mat1[1] * mat2[5] + mat1[2] * mat2[9] + mat1[3] * mat2[13], mat1[0] * mat2[2] + mat1[1] * mat2[6] + mat1[2] * mat2[10] + mat1[3] * mat2[14], mat1[0] * mat2[3] + mat1[1] * mat2[7] + mat1[2] * mat2[11] + mat1[3] * mat2[15], mat1[4] * mat2[0] + mat1[5] * mat2[4] + mat1[6] * mat2[8] + mat1[7] * mat2[12], mat1[4] * mat2[1] + mat1[5] * mat2[5] + mat1[6] * mat2[9] + mat1[7] * mat2[13], mat1[4] * mat2[2] + mat1[5] * mat2[6] + mat1[6] * mat2[10] + mat1[7] * mat2[14], mat1[4] * mat2[3] + mat1[5] * mat2[7] + mat1[6] * mat2[11] + mat1[7] * mat2[15], mat1[8] * mat2[0] + mat1[9] * mat2[4] + mat1[10] * mat2[8] + mat1[11] * mat2[12], mat1[8] * mat2[1] + mat1[9] * mat2[5] + mat1[10] * mat2[9] + mat1[11] * mat2[13], mat1[8] * mat2[2] + mat1[9] * mat2[6] + mat1[10] * mat2[10] + mat1[11] * mat2[14], mat1[8] * mat2[3] + mat1[9] * mat2[7] + mat1[10] * mat2[11] + mat1[11] * mat2[15], mat1[12] * mat2[0] + mat1[13] * mat2[4] + mat1[14] * mat2[8] + mat1[15] * mat2[12], mat1[12] * mat2[1] + mat1[13] * mat2[5] + mat1[14] * mat2[9] + mat1[15] * mat2[13], mat1[12] * mat2[2] + mat1[13] * mat2[6] + mat1[14] * mat2[10] + mat1[15] * mat2[14], mat1[12] * mat2[3] + mat1[13] * mat2[7] + mat1[14] * mat2[11] + mat1[15] * mat2[15]];
}

function matrixMultiply4x1(mat1, mat2) {
  return [mat1[0] * mat2[0] + mat1[1] * mat2[1] + mat1[2] * mat2[2] + mat1[3] * mat1[3], mat1[4] * mat2[0] + mat1[5] * mat2[1] + mat1[6] * mat2[2] + mat1[7] * mat1[3], mat1[8] * mat2[0] + mat1[9] * mat2[1] + mat1[10] * mat2[2] + mat1[11] * mat1[3], mat1[12] * mat2[0] + mat1[13] * mat2[1] + mat1[14] * mat2[2] + mat1[15] * mat1[3]];
}

function multiply(m1, m2) {
  if (m2.length == 4) return matrixMultiply4x1(m1, m2);else return matrixMultiply(m1, m2);
}

function inverse(a) {
  var s0 = a[0] * a[5] - a[4] * a[1];
  var s1 = a[0] * a[6] - a[4] * a[2];
  var s2 = a[0] * a[7] - a[4] * a[3];
  var s3 = a[1] * a[6] - a[5] * a[2];
  var s4 = a[1] * a[7] - a[5] * a[3];
  var s5 = a[2] * a[7] - a[6] * a[3];

  var c5 = a[10] * a[15] - a[14] * a[11];
  var c4 = a[9] * a[15] - a[13] * a[11];
  var c3 = a[9] * a[14] - a[13] * a[10];
  var c2 = a[8] * a[15] - a[12] * a[11];
  var c1 = a[8] * a[14] - a[12] * a[10];
  var c0 = a[8] * a[13] - a[12] * a[9];

  //console.log(c5,s5,s4);

  // Should check for 0 determinant
  var invdet = 1.0 / (s0 * c5 - s1 * c4 + s2 * c3 + s3 * c2 - s4 * c1 + s5 * c0);

  var b = [[], [], [], []];

  b[0] = (a[5] * c5 - a[6] * c4 + a[7] * c3) * invdet;
  b[1] = (-a[1] * c5 + a[2] * c4 - a[3] * c3) * invdet;
  b[2] = (a[13] * s5 - a[14] * s4 + a[15] * s3) * invdet;
  b[3] = (-a[9] * s5 + a[10] * s4 - a[11] * s3) * invdet;

  b[4] = (-a[4] * c5 + a[6] * c2 - a[7] * c1) * invdet;
  b[5] = (a[0] * c5 - a[2] * c2 + a[3] * c1) * invdet;
  b[6] = (-a[12] * s5 + a[14] * s2 - a[15] * s1) * invdet;
  b[7] = (a[8] * s5 - a[10] * s2 + a[11] * s1) * invdet;

  b[8] = (a[4] * c4 - a[5] * c2 + a[7] * c0) * invdet;
  b[9] = (-a[0] * c4 + a[1] * c2 - a[3] * c0) * invdet;
  b[10] = (a[12] * s4 - a[13] * s2 + a[15] * s0) * invdet;
  b[11] = (-a[8] * s4 + a[9] * s2 - a[11] * s0) * invdet;

  b[12] = (-a[4] * c3 + a[5] * c1 - a[6] * c0) * invdet;
  b[13] = (a[0] * c3 - a[1] * c1 + a[2] * c0) * invdet;
  b[14] = (-a[12] * s3 + a[13] * s1 - a[14] * s0) * invdet;
  b[15] = (a[8] * s3 - a[9] * s1 + a[10] * s0) * invdet;

  return b;
}

function perspective(fieldOfViewInRadians, aspect, near, far) {
  var f = Math.tan(Math.PI * 0.5 - 0.5 * fieldOfViewInRadians);
  var rangeInv = 1.0 / (near - far);

  return [f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (near + far) * rangeInv, -1, 0, 0, near * far * rangeInv * 2, 0];
}

function makeZToWMatrix(fudgeFactor) {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, fudgeFactor, 0, 0, 0, 1];
}

function translate(tx, ty, tz) {
  if (typeof tx != 'number') {
    var old = tx;
    tx = old[0];
    ty = old[1];
    tz = old[2];
  }
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, tx, ty, tz, 1];
}

function rotateX(angleInRadians) {
  var c = Math.cos(angleInRadians);
  var s = Math.sin(angleInRadians);

  return [1, 0, 0, 0, 0, c, s, 0, 0, -s, c, 0, 0, 0, 0, 1];
}

function rotateY(angleInRadians) {
  var c = Math.cos(angleInRadians);
  var s = Math.sin(angleInRadians);

  return [c, 0, -s, 0, 0, 1, 0, 0, s, 0, c, 0, 0, 0, 0, 1];
}

function rotateZ(angleInRadians) {
  var c = Math.cos(angleInRadians);
  var s = Math.sin(angleInRadians);

  return [c, s, 0, 0, -s, c, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
}

function scale(sx, sy, sz) {
  if (typeof sx != 'number') {
    var old = sx;
    sx = old[0];
    sy = old[1];
    sz = old[2];
  }
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
}

function lookAt(eye, target, up) {
  var f = vec.normalize(vec.subtract(target, eye));
  var s = vec.normalize(vec.cross(f, up));
  var u = vec.cross(s, f);

  var result = identity();
  result[4 * 0 + 0] = s[0];
  result[4 * 1 + 0] = s[1];
  result[4 * 2 + 0] = s[2];
  result[4 * 0 + 1] = u[0];
  result[4 * 1 + 1] = u[1];
  result[4 * 2 + 1] = u[2];
  result[4 * 0 + 2] = -f[0];
  result[4 * 1 + 2] = -f[1];
  result[4 * 2 + 2] = -f[2];
  result[4 * 3 + 0] = -vec.dot(s, eye);
  result[4 * 3 + 1] = -vec.dot(u, eye);
  result[4 * 3 + 2] = vec.dot(f, eye);
  return result;
}

function identity() {
  return scale(1, 1, 1);
}

module.exports = {
  multiply: multiply,
  inverse: inverse,
  identity: identity,

  perspective: perspective,
  makeZToWMatrix: makeZToWMatrix,
  lookAt: lookAt,

  translate: translate,
  rotateX: rotateX, rotateY: rotateY, rotateZ: rotateZ,
  scale: scale
};

},{"./vector":7}],5:[function(require,module,exports){
'use strict';

var m = require('./matrix');

function openFile(name, filename) {
  var datastring;
  $.ajax({
    url: filename + '.obj',
    dataType: "text",
    success: function success(data) {
      datastring = data;
      $.ajax({
        url: filename + '.mtl',
        dataType: "text",
        success: function success(mtlstring) {
          createModel(name, datastring, mtlstring);
        }
      });
    }
  });
}

function makeModel(name, filename) {
  var center = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : [0, 0, 0];
  var scale = arguments.length > 3 && arguments[3] !== undefined ? arguments[3] : [1, 1, 1];

  models[name] = { name: name, center: center, scale: scale };
  openFile(name, filename);
}

function parseMtl(mtlstring) {
  var mtllib = {};
  var lines = mtlstring.split('\n');
  var curmtl = '';
  for (var j = 0; j < lines.length; j++) {
    var words = lines[j].split(' ');
    if (words[0] == 'newmtl') {
      curmtl = words[1];
      mtllib[curmtl] = {};
    } else if (words[0] == 'Kd') {
      mtllib[curmtl].diffuse = [parseFloat(words[1]), parseFloat(words[2]), parseFloat(words[3])];
    } else if (words[0] == 'Ks') {
      mtllib[curmtl].specular = [parseFloat(words[1]), parseFloat(words[2]), parseFloat(words[3])];
    } else if (words[0] == 'Ka') {
      mtllib[curmtl].ambient = [parseFloat(words[1]), parseFloat(words[2]), parseFloat(words[3])];
    } else if (words[0] == 'Ns') {
      mtllib[curmtl].shininess = parseFloat(words[1]);
    } else if (words[0] == 'map_Kd') {
      loadTexture(words[1], mtllib[curmtl]);
    }
  }
  return mtllib;
}

function handleLoadedTexture(texture) {
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, texture.image);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_NEAREST);
  gl.generateMipmap(gl.TEXTURE_2D);

  gl.bindTexture(gl.TEXTURE_2D, null);
}

function loadTexture(src, material) {
  var texture = gl.createTexture();
  texture.image = new Image();
  texture.image.onload = function () {
    handleLoadedTexture(texture);
    material.texture = texture;
  };
  texture.image.src = src;
  return texture;
}

function createModel(name, filedata, mtlstring) //Create object from blender
{
  var model = models[name];
  var mtllib = parseMtl(mtlstring);
  var vertex_buffer_data = [];
  var points = [];
  var minX = 1000000;
  var maxX = -1000000;
  var minY = 1000000;
  var maxY = -1000000;
  var minZ = 1000000;
  var maxZ = -1000000;

  var invertNormals = false;
  var normals = [];
  var normal_buffer_data = [];

  var textures = [];
  var texture_buffer_data = [];

  model.vaos = [];

  var lines = filedata.split('\n');
  lines = lines.map(function (s) {
    return s.trim();
  });
  lines.push('usemtl');
  for (var j = 0; j < lines.length; j++) {
    var words = lines[j].split(' ');
    if (words[0] == "v") {
      var cur_point = {};
      cur_point['x'] = parseFloat(words[1]);
      if (cur_point['x'] > maxX) {
        maxX = cur_point['x'];
      }
      if (cur_point['x'] < minX) {
        minX = cur_point['x'];
      }
      cur_point['y'] = parseFloat(words[2]);
      if (cur_point['y'] > maxY) {
        maxY = cur_point['y'];
      }
      if (cur_point['y'] < minY) {
        minY = cur_point['y'];
      }
      cur_point['z'] = parseFloat(words[3]);
      if (cur_point['z'] > maxZ) {
        maxZ = cur_point['z'];
      }
      if (cur_point['z'] < minZ) {
        minZ = cur_point['z'];
      }
      //console.log(words);
      points.push(cur_point);
    } else if (words[0] == "vn") {
      var _cur_point = {};
      _cur_point['x'] = parseFloat(words[1]);
      _cur_point['y'] = parseFloat(words[2]);
      _cur_point['z'] = parseFloat(words[3]);
      //console.log(words);
      normals.push(_cur_point);
    } else if (words[0] == "vt") {
      var _cur_point2 = {};
      _cur_point2.s = parseFloat(words[1]);
      _cur_point2.t = parseFloat(words[2]);
      textures.push(_cur_point2);
    }
  }
  model.minX = minX;
  model.maxX = maxX;
  model.minY = minY;
  model.maxY = maxY;
  model.minZ = minZ;
  model.maxZ = maxZ;
  //console.log(points);
  // let lines = filedata.split('\n');
  var curmtl = '';
  for (var jj = 0; jj < lines.length; jj++) {
    var _words = lines[jj].split(' ');
    if (_words[0] == "f") {
      for (var wc = 1; wc < 4; wc++) {
        var vxdata = _words[wc].split('/');
        var p = parseInt(vxdata[0]) - 1;
        var t = parseInt(vxdata[1]) - 1;
        var n = parseInt(vxdata[2]) - 1;
        vertex_buffer_data.push(points[p].x);
        vertex_buffer_data.push(points[p].y);
        vertex_buffer_data.push(points[p].z);

        if (!isNaN(t)) {
          texture_buffer_data.push(textures[t].s);
          texture_buffer_data.push(textures[t].t);
        }

        if (invertNormals) {
          normal_buffer_data.push(-normals[n].x);
          normal_buffer_data.push(-normals[n].y);
          normal_buffer_data.push(-normals[n].z);
        } else {
          normal_buffer_data.push(normals[n].x);
          normal_buffer_data.push(normals[n].y);
          normal_buffer_data.push(normals[n].z);
        }
      }
    } else if (_words[0] == 'usemtl') {
      var vao = {};
      vao.numVertex = vertex_buffer_data.length / 3;
      if (vao.numVertex != 0) {
        var vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertex_buffer_data), gl.STATIC_DRAW);
        vao.vertexBuffer = vertexBuffer;

        var normalBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, normalBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normal_buffer_data), gl.STATIC_DRAW);
        vao.normalBuffer = normalBuffer;

        var textureBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, textureBuffer);
        if (texture_buffer_data.length > 0) {
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texture_buffer_data), gl.STATIC_DRAW);
          vao.isTextured = true;
        } else {
          for (var i = 0; i < 2 * vao.numVertex; i++) {
            texture_buffer_data.push(0);
          }gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(texture_buffer_data), gl.STATIC_DRAW);
          vao.isTextured = false;
        }
        vao.textureBuffer = textureBuffer;

        vao.material = mtllib[curmtl];

        model.vaos.push(vao);
        vertex_buffer_data = [];
        normal_buffer_data = [];
        texture_buffer_data = [];
      } else if (_words[0] == 'invertNormals') {
        invertNormals = !invertNormals;
      }
      curmtl = _words[1];
    }
  }
}

function drawModel(model) {
  if (!model.vaos) return;
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "model"), false, Matrices.model);
  gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelInv"), false, m.inverse(Matrices.model));

  model.vaos.map(drawVAO);
}

function drawLight(model) {
  gl.uniform1i(gl.getUniformLocation(program, "isLight"), 1);
  drawModel(model);
  gl.uniform1i(gl.getUniformLocation(program, "isLight"), 0);
}

function drawVAO(vao) {
  if (!vao.vertexBuffer) return;

  loadMaterial(vao.material);

  gl.bindBuffer(gl.ARRAY_BUFFER, vao.vertexBuffer);
  gl.vertexAttribPointer(program.positionAttribute, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, vao.normalBuffer);
  gl.vertexAttribPointer(program.normalAttribute, 3, gl.FLOAT, false, 0, 0);

  var isTextured = vao.material.texture && vao.isTextured;
  // console.log(isTextured)
  gl.uniform1i(gl.getUniformLocation(program, "isTextured"), isTextured);
  gl.bindBuffer(gl.ARRAY_BUFFER, vao.textureBuffer);
  gl.vertexAttribPointer(program.textureAttribute, 2, gl.FLOAT, false, 0, 0);
  if (isTextured) {
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, vao.material.texture);
    gl.uniform1i(gl.getUniformLocation(program, "sampler"), 0);
  }

  // draw
  gl.drawArrays(gl.TRIANGLES, 0, vao.numVertex);
}

function loadMaterial(material) {
  if (!material) material = {
    ambient: [1, 1, 1],
    diffuse: [1, 1, 1],
    specular: [1, 1, 1],
    shininess: 0
  };
  // Set material properties
  gl.uniform3f(gl.getUniformLocation(program, "material.ambient"), material.ambient[0], material.ambient[1], material.ambient[2]);
  gl.uniform3f(gl.getUniformLocation(program, "material.diffuse"), material.diffuse[0], material.diffuse[1], material.diffuse[2]);
  gl.uniform3f(gl.getUniformLocation(program, "material.specular"), material.specular[0], material.specular[1], material.specular[2]);
  gl.uniform1f(gl.getUniformLocation(program, "material.shininess"), material.shininess);
}

module.exports = {
  makeModel: makeModel,
  createModel: createModel,
  drawModel: drawModel,
  drawLight: drawLight
};

},{"./matrix":4}],6:[function(require,module,exports){
"use strict";

var shaders = {};

function compileShader(gl, shaderSource, shaderType) {
  // Create the shader object
  var shader = gl.createShader(shaderType);

  // Set the shader source code.
  gl.shaderSource(shader, shaderSource);

  // Compile the shader
  gl.compileShader(shader);

  // Check if it compiled
  var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
  if (!success) {
    // Something went wrong during compilation; get the error
    throw "could not compile shader:" + gl.getShaderInfoLog(shader);
  }

  return shader;
}

function createProgram(gl, name, vertexShader, fragmentShader) {
  // create a program.
  var progra = gl.createProgram();

  // attach the shaders.
  gl.attachShader(progra, vertexShader);
  gl.attachShader(progra, fragmentShader);

  // link the program.
  gl.linkProgram(progra);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  // Check if it linked.
  var success = gl.getProgramParameter(progra, gl.LINK_STATUS);
  if (!success) {
    // something went wrong with the link
    throw "program filed to link:" + gl.getProgramInfoLog(progra);
  }

  window.program = progra;
  program.positionAttribute = gl.getAttribLocation(program, "a_position");
  gl.enableVertexAttribArray(program.vertexAttribute);

  program.normalAttribute = gl.getAttribLocation(program, "a_normal");
  gl.enableVertexAttribArray(program.normalAttribute);

  program.textureAttribute = gl.getAttribLocation(program, "a_texture");
  gl.enableVertexAttribArray(program.textureAttribute);

  shaders[name] = progra;
}

function openFile(name, filename) {
  $.get(filename + '.vs', function (vxShaderData) {
    var vxShader = compileShader(gl, vxShaderData, gl.VERTEX_SHADER);
    $.get(filename + '.frag', function (fragShaderData) {
      console.log(vxShaderData, fragShaderData);
      var fragShader = compileShader(gl, fragShaderData, gl.FRAGMENT_SHADER);
      createProgram(gl, name, vxShader, fragShader);
    }, 'text');
  }, 'text');
}

function createShader(shadername) {
  openFile(shadername, 'shaders/' + shadername);
}

function useShader(shadername) {
  window.program = shaders[shadername];
  gl.useProgram(window.program);
}

module.exports = {
  compileShader: compileShader,
  createShader: createShader,
  useShader: useShader
};

},{}],7:[function(require,module,exports){
"use strict";

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

function dot(_ref, _ref2) {
  var _ref4 = _slicedToArray(_ref, 3),
      x = _ref4[0],
      y = _ref4[1],
      z = _ref4[2];

  var _ref3 = _slicedToArray(_ref2, 3),
      p = _ref3[0],
      q = _ref3[1],
      r = _ref3[2];

  return x * p + y * q + z * r;
}

function cross(_ref5, _ref6) {
  var _ref8 = _slicedToArray(_ref5, 3),
      ux = _ref8[0],
      uy = _ref8[1],
      uz = _ref8[2];

  var _ref7 = _slicedToArray(_ref6, 3),
      vx = _ref7[0],
      vy = _ref7[1],
      vz = _ref7[2];

  var x = uy * vz - uz * vy;
  var y = uz * vx - ux * vz;
  var z = ux * vy - uy * vx;
  return [x, y, z];
}

function add(_ref9, _ref10) {
  var _ref12 = _slicedToArray(_ref9, 3),
      x = _ref12[0],
      y = _ref12[1],
      z = _ref12[2];

  var _ref11 = _slicedToArray(_ref10, 3),
      p = _ref11[0],
      q = _ref11[1],
      r = _ref11[2];

  return [x + p, y + q, z + r];
}

function subtract(_ref13, _ref14) {
  var _ref16 = _slicedToArray(_ref13, 3),
      x = _ref16[0],
      y = _ref16[1],
      z = _ref16[2];

  var _ref15 = _slicedToArray(_ref14, 3),
      p = _ref15[0],
      q = _ref15[1],
      r = _ref15[2];

  return [x - p, y - q, z - r];
}

function abs(_ref17) {
  var _ref18 = _slicedToArray(_ref17, 3),
      x = _ref18[0],
      y = _ref18[1],
      z = _ref18[2];

  return Math.sqrt(x * x + y * y + z * z);
}

function normalize(_ref19) {
  var _ref20 = _slicedToArray(_ref19, 3),
      x = _ref20[0],
      y = _ref20[1],
      z = _ref20[2];

  var t = abs([x, y, z]);
  return [x / t, y / t, z / t];
}

function multiplyScalar(_ref21, c) {
  var _ref22 = _slicedToArray(_ref21, 3),
      x = _ref22[0],
      y = _ref22[1],
      z = _ref22[2];

  return [x * c, y * c, z * c];
}

module.exports = {
  dot: dot,
  cross: cross,
  add: add,
  subtract: subtract,
  abs: abs,
  normalize: normalize,
  multiplyScalar: multiplyScalar
};

},{}]},{},[3])
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIm5vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCJub2RlX21vZHVsZXMvbW91c2V0cmFwL21vdXNldHJhcC5qcyIsInNyYy9maXNoLmpzIiwic3JjL21haW4uanMiLCJzcmMvbWF0cml4LmpzIiwic3JjL21vZGVscy5qcyIsInNyYy9zaGFkZXJzLmpzIiwic3JjL3ZlY3Rvci5qcyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTtBQ0FBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtB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QiIsImZpbGUiOiJnZW5lcmF0ZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlc0NvbnRlbnQiOlsiKGZ1bmN0aW9uKCl7ZnVuY3Rpb24gcihlLG4sdCl7ZnVuY3Rpb24gbyhpLGYpe2lmKCFuW2ldKXtpZighZVtpXSl7dmFyIGM9XCJmdW5jdGlvblwiPT10eXBlb2YgcmVxdWlyZSYmcmVxdWlyZTtpZighZiYmYylyZXR1cm4gYyhpLCEwKTtpZih1KXJldHVybiB1KGksITApO3ZhciBhPW5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIraStcIidcIik7dGhyb3cgYS5jb2RlPVwiTU9EVUxFX05PVF9GT1VORFwiLGF9dmFyIHA9bltpXT17ZXhwb3J0czp7fX07ZVtpXVswXS5jYWxsKHAuZXhwb3J0cyxmdW5jdGlvbihyKXt2YXIgbj1lW2ldWzFdW3JdO3JldHVybiBvKG58fHIpfSxwLHAuZXhwb3J0cyxyLGUsbix0KX1yZXR1cm4gbltpXS5leHBvcnRzfWZvcih2YXIgdT1cImZ1bmN0aW9uXCI9PXR5cGVvZiByZXF1aXJlJiZyZXF1aXJlLGk9MDtpPHQubGVuZ3RoO2krKylvKHRbaV0pO3JldHVybiBvfXJldHVybiByfSkoKSIsIi8qZ2xvYmFsIGRlZmluZTpmYWxzZSAqL1xuLyoqXG4gKiBDb3B5cmlnaHQgMjAxMi0yMDE3IENyYWlnIENhbXBiZWxsXG4gKlxuICogTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMCAodGhlIFwiTGljZW5zZVwiKTtcbiAqIHlvdSBtYXkgbm90IHVzZSB0aGlzIGZpbGUgZXhjZXB0IGluIGNvbXBsaWFuY2Ugd2l0aCB0aGUgTGljZW5zZS5cbiAqIFlvdSBtYXkgb2J0YWluIGEgY29weSBvZiB0aGUgTGljZW5zZSBhdFxuICpcbiAqIGh0dHA6Ly93d3cuYXBhY2hlLm9yZy9saWNlbnNlcy9MSUNFTlNFLTIuMFxuICpcbiAqIFVubGVzcyByZXF1aXJlZCBieSBhcHBsaWNhYmxlIGxhdyBvciBhZ3JlZWQgdG8gaW4gd3JpdGluZywgc29mdHdhcmVcbiAqIGRpc3RyaWJ1dGVkIHVuZGVyIHRoZSBMaWNlbnNlIGlzIGRpc3RyaWJ1dGVkIG9uIGFuIFwiQVMgSVNcIiBCQVNJUyxcbiAqIFdJVEhPVVQgV0FSUkFOVElFUyBPUiBDT05ESVRJT05TIE9GIEFOWSBLSU5ELCBlaXRoZXIgZXhwcmVzcyBvciBpbXBsaWVkLlxuICogU2VlIHRoZSBMaWNlbnNlIGZvciB0aGUgc3BlY2lmaWMgbGFuZ3VhZ2UgZ292ZXJuaW5nIHBlcm1pc3Npb25zIGFuZFxuICogbGltaXRhdGlvbnMgdW5kZXIgdGhlIExpY2Vuc2UuXG4gKlxuICogTW91c2V0cmFwIGlzIGEgc2ltcGxlIGtleWJvYXJkIHNob3J0Y3V0IGxpYnJhcnkgZm9yIEphdmFzY3JpcHQgd2l0aFxuICogbm8gZXh0ZXJuYWwgZGVwZW5kZW5jaWVzXG4gKlxuICogQHZlcnNpb24gMS42LjVcbiAqIEB1cmwgY3JhaWcuaXMva2lsbGluZy9taWNlXG4gKi9cbihmdW5jdGlvbih3aW5kb3csIGRvY3VtZW50LCB1bmRlZmluZWQpIHtcblxuICAgIC8vIENoZWNrIGlmIG1vdXNldHJhcCBpcyB1c2VkIGluc2lkZSBicm93c2VyLCBpZiBub3QsIHJldHVyblxuICAgIGlmICghd2luZG93KSB7XG4gICAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBtYXBwaW5nIG9mIHNwZWNpYWwga2V5Y29kZXMgdG8gdGhlaXIgY29ycmVzcG9uZGluZyBrZXlzXG4gICAgICpcbiAgICAgKiBldmVyeXRoaW5nIGluIHRoaXMgZGljdGlvbmFyeSBjYW5ub3QgdXNlIGtleXByZXNzIGV2ZW50c1xuICAgICAqIHNvIGl0IGhhcyB0byBiZSBoZXJlIHRvIG1hcCB0byB0aGUgY29ycmVjdCBrZXljb2RlcyBmb3JcbiAgICAgKiBrZXl1cC9rZXlkb3duIGV2ZW50c1xuICAgICAqXG4gICAgICogQHR5cGUge09iamVjdH1cbiAgICAgKi9cbiAgICB2YXIgX01BUCA9IHtcbiAgICAgICAgODogJ2JhY2tzcGFjZScsXG4gICAgICAgIDk6ICd0YWInLFxuICAgICAgICAxMzogJ2VudGVyJyxcbiAgICAgICAgMTY6ICdzaGlmdCcsXG4gICAgICAgIDE3OiAnY3RybCcsXG4gICAgICAgIDE4OiAnYWx0JyxcbiAgICAgICAgMjA6ICdjYXBzbG9jaycsXG4gICAgICAgIDI3OiAnZXNjJyxcbiAgICAgICAgMzI6ICdzcGFjZScsXG4gICAgICAgIDMzOiAncGFnZXVwJyxcbiAgICAgICAgMzQ6ICdwYWdlZG93bicsXG4gICAgICAgIDM1OiAnZW5kJyxcbiAgICAgICAgMzY6ICdob21lJyxcbiAgICAgICAgMzc6ICdsZWZ0JyxcbiAgICAgICAgMzg6ICd1cCcsXG4gICAgICAgIDM5OiAncmlnaHQnLFxuICAgICAgICA0MDogJ2Rvd24nLFxuICAgICAgICA0NTogJ2lucycsXG4gICAgICAgIDQ2OiAnZGVsJyxcbiAgICAgICAgOTE6ICdtZXRhJyxcbiAgICAgICAgOTM6ICdtZXRhJyxcbiAgICAgICAgMjI0OiAnbWV0YSdcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogbWFwcGluZyBmb3Igc3BlY2lhbCBjaGFyYWN0ZXJzIHNvIHRoZXkgY2FuIHN1cHBvcnRcbiAgICAgKlxuICAgICAqIHRoaXMgZGljdGlvbmFyeSBpcyBvbmx5IHVzZWQgaW5jYXNlIHlvdSB3YW50IHRvIGJpbmQgYVxuICAgICAqIGtleXVwIG9yIGtleWRvd24gZXZlbnQgdG8gb25lIG9mIHRoZXNlIGtleXNcbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgdmFyIF9LRVlDT0RFX01BUCA9IHtcbiAgICAgICAgMTA2OiAnKicsXG4gICAgICAgIDEwNzogJysnLFxuICAgICAgICAxMDk6ICctJyxcbiAgICAgICAgMTEwOiAnLicsXG4gICAgICAgIDExMSA6ICcvJyxcbiAgICAgICAgMTg2OiAnOycsXG4gICAgICAgIDE4NzogJz0nLFxuICAgICAgICAxODg6ICcsJyxcbiAgICAgICAgMTg5OiAnLScsXG4gICAgICAgIDE5MDogJy4nLFxuICAgICAgICAxOTE6ICcvJyxcbiAgICAgICAgMTkyOiAnYCcsXG4gICAgICAgIDIxOTogJ1snLFxuICAgICAgICAyMjA6ICdcXFxcJyxcbiAgICAgICAgMjIxOiAnXScsXG4gICAgICAgIDIyMjogJ1xcJydcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogdGhpcyBpcyBhIG1hcHBpbmcgb2Yga2V5cyB0aGF0IHJlcXVpcmUgc2hpZnQgb24gYSBVUyBrZXlwYWRcbiAgICAgKiBiYWNrIHRvIHRoZSBub24gc2hpZnQgZXF1aXZlbGVudHNcbiAgICAgKlxuICAgICAqIHRoaXMgaXMgc28geW91IGNhbiB1c2Uga2V5dXAgZXZlbnRzIHdpdGggdGhlc2Uga2V5c1xuICAgICAqXG4gICAgICogbm90ZSB0aGF0IHRoaXMgd2lsbCBvbmx5IHdvcmsgcmVsaWFibHkgb24gVVMga2V5Ym9hcmRzXG4gICAgICpcbiAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAqL1xuICAgIHZhciBfU0hJRlRfTUFQID0ge1xuICAgICAgICAnfic6ICdgJyxcbiAgICAgICAgJyEnOiAnMScsXG4gICAgICAgICdAJzogJzInLFxuICAgICAgICAnIyc6ICczJyxcbiAgICAgICAgJyQnOiAnNCcsXG4gICAgICAgICclJzogJzUnLFxuICAgICAgICAnXic6ICc2JyxcbiAgICAgICAgJyYnOiAnNycsXG4gICAgICAgICcqJzogJzgnLFxuICAgICAgICAnKCc6ICc5JyxcbiAgICAgICAgJyknOiAnMCcsXG4gICAgICAgICdfJzogJy0nLFxuICAgICAgICAnKyc6ICc9JyxcbiAgICAgICAgJzonOiAnOycsXG4gICAgICAgICdcXFwiJzogJ1xcJycsXG4gICAgICAgICc8JzogJywnLFxuICAgICAgICAnPic6ICcuJyxcbiAgICAgICAgJz8nOiAnLycsXG4gICAgICAgICd8JzogJ1xcXFwnXG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIHRoaXMgaXMgYSBsaXN0IG9mIHNwZWNpYWwgc3RyaW5ncyB5b3UgY2FuIHVzZSB0byBtYXBcbiAgICAgKiB0byBtb2RpZmllciBrZXlzIHdoZW4geW91IHNwZWNpZnkgeW91ciBrZXlib2FyZCBzaG9ydGN1dHNcbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICovXG4gICAgdmFyIF9TUEVDSUFMX0FMSUFTRVMgPSB7XG4gICAgICAgICdvcHRpb24nOiAnYWx0JyxcbiAgICAgICAgJ2NvbW1hbmQnOiAnbWV0YScsXG4gICAgICAgICdyZXR1cm4nOiAnZW50ZXInLFxuICAgICAgICAnZXNjYXBlJzogJ2VzYycsXG4gICAgICAgICdwbHVzJzogJysnLFxuICAgICAgICAnbW9kJzogL01hY3xpUG9kfGlQaG9uZXxpUGFkLy50ZXN0KG5hdmlnYXRvci5wbGF0Zm9ybSkgPyAnbWV0YScgOiAnY3RybCdcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogdmFyaWFibGUgdG8gc3RvcmUgdGhlIGZsaXBwZWQgdmVyc2lvbiBvZiBfTUFQIGZyb20gYWJvdmVcbiAgICAgKiBuZWVkZWQgdG8gY2hlY2sgaWYgd2Ugc2hvdWxkIHVzZSBrZXlwcmVzcyBvciBub3Qgd2hlbiBubyBhY3Rpb25cbiAgICAgKiBpcyBzcGVjaWZpZWRcbiAgICAgKlxuICAgICAqIEB0eXBlIHtPYmplY3R8dW5kZWZpbmVkfVxuICAgICAqL1xuICAgIHZhciBfUkVWRVJTRV9NQVA7XG5cbiAgICAvKipcbiAgICAgKiBsb29wIHRocm91Z2ggdGhlIGYga2V5cywgZjEgdG8gZjE5IGFuZCBhZGQgdGhlbSB0byB0aGUgbWFwXG4gICAgICogcHJvZ3JhbWF0aWNhbGx5XG4gICAgICovXG4gICAgZm9yICh2YXIgaSA9IDE7IGkgPCAyMDsgKytpKSB7XG4gICAgICAgIF9NQVBbMTExICsgaV0gPSAnZicgKyBpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIGxvb3AgdGhyb3VnaCB0byBtYXAgbnVtYmVycyBvbiB0aGUgbnVtZXJpYyBrZXlwYWRcbiAgICAgKi9cbiAgICBmb3IgKGkgPSAwOyBpIDw9IDk7ICsraSkge1xuXG4gICAgICAgIC8vIFRoaXMgbmVlZHMgdG8gdXNlIGEgc3RyaW5nIGNhdXNlIG90aGVyd2lzZSBzaW5jZSAwIGlzIGZhbHNleVxuICAgICAgICAvLyBtb3VzZXRyYXAgd2lsbCBuZXZlciBmaXJlIGZvciBudW1wYWQgMCBwcmVzc2VkIGFzIHBhcnQgb2YgYSBrZXlkb3duXG4gICAgICAgIC8vIGV2ZW50LlxuICAgICAgICAvL1xuICAgICAgICAvLyBAc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9jY2FtcGJlbGwvbW91c2V0cmFwL3B1bGwvMjU4XG4gICAgICAgIF9NQVBbaSArIDk2XSA9IGkudG9TdHJpbmcoKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBjcm9zcyBicm93c2VyIGFkZCBldmVudCBtZXRob2RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7RWxlbWVudHxIVE1MRG9jdW1lbnR9IG9iamVjdFxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlXG4gICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgZnVuY3Rpb24gX2FkZEV2ZW50KG9iamVjdCwgdHlwZSwgY2FsbGJhY2spIHtcbiAgICAgICAgaWYgKG9iamVjdC5hZGRFdmVudExpc3RlbmVyKSB7XG4gICAgICAgICAgICBvYmplY3QuYWRkRXZlbnRMaXN0ZW5lcih0eXBlLCBjYWxsYmFjaywgZmFsc2UpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgb2JqZWN0LmF0dGFjaEV2ZW50KCdvbicgKyB0eXBlLCBjYWxsYmFjayk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogdGFrZXMgdGhlIGV2ZW50IGFuZCByZXR1cm5zIHRoZSBrZXkgY2hhcmFjdGVyXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9jaGFyYWN0ZXJGcm9tRXZlbnQoZSkge1xuXG4gICAgICAgIC8vIGZvciBrZXlwcmVzcyBldmVudHMgd2Ugc2hvdWxkIHJldHVybiB0aGUgY2hhcmFjdGVyIGFzIGlzXG4gICAgICAgIGlmIChlLnR5cGUgPT0gJ2tleXByZXNzJykge1xuICAgICAgICAgICAgdmFyIGNoYXJhY3RlciA9IFN0cmluZy5mcm9tQ2hhckNvZGUoZS53aGljaCk7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBzaGlmdCBrZXkgaXMgbm90IHByZXNzZWQgdGhlbiBpdCBpcyBzYWZlIHRvIGFzc3VtZVxuICAgICAgICAgICAgLy8gdGhhdCB3ZSB3YW50IHRoZSBjaGFyYWN0ZXIgdG8gYmUgbG93ZXJjYXNlLiAgdGhpcyBtZWFucyBpZlxuICAgICAgICAgICAgLy8geW91IGFjY2lkZW50YWxseSBoYXZlIGNhcHMgbG9jayBvbiB0aGVuIHlvdXIga2V5IGJpbmRpbmdzXG4gICAgICAgICAgICAvLyB3aWxsIGNvbnRpbnVlIHRvIHdvcmtcbiAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAvLyB0aGUgb25seSBzaWRlIGVmZmVjdCB0aGF0IG1pZ2h0IG5vdCBiZSBkZXNpcmVkIGlzIGlmIHlvdVxuICAgICAgICAgICAgLy8gYmluZCBzb21ldGhpbmcgbGlrZSAnQScgY2F1c2UgeW91IHdhbnQgdG8gdHJpZ2dlciBhblxuICAgICAgICAgICAgLy8gZXZlbnQgd2hlbiBjYXBpdGFsIEEgaXMgcHJlc3NlZCBjYXBzIGxvY2sgd2lsbCBubyBsb25nZXJcbiAgICAgICAgICAgIC8vIHRyaWdnZXIgdGhlIGV2ZW50LiAgc2hpZnQrYSB3aWxsIHRob3VnaC5cbiAgICAgICAgICAgIGlmICghZS5zaGlmdEtleSkge1xuICAgICAgICAgICAgICAgIGNoYXJhY3RlciA9IGNoYXJhY3Rlci50b0xvd2VyQ2FzZSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICByZXR1cm4gY2hhcmFjdGVyO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gZm9yIG5vbiBrZXlwcmVzcyBldmVudHMgdGhlIHNwZWNpYWwgbWFwcyBhcmUgbmVlZGVkXG4gICAgICAgIGlmIChfTUFQW2Uud2hpY2hdKSB7XG4gICAgICAgICAgICByZXR1cm4gX01BUFtlLndoaWNoXTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfS0VZQ09ERV9NQVBbZS53aGljaF0pIHtcbiAgICAgICAgICAgIHJldHVybiBfS0VZQ09ERV9NQVBbZS53aGljaF07XG4gICAgICAgIH1cblxuICAgICAgICAvLyBpZiBpdCBpcyBub3QgaW4gdGhlIHNwZWNpYWwgbWFwXG5cbiAgICAgICAgLy8gd2l0aCBrZXlkb3duIGFuZCBrZXl1cCBldmVudHMgdGhlIGNoYXJhY3RlciBzZWVtcyB0byBhbHdheXNcbiAgICAgICAgLy8gY29tZSBpbiBhcyBhbiB1cHBlcmNhc2UgY2hhcmFjdGVyIHdoZXRoZXIgeW91IGFyZSBwcmVzc2luZyBzaGlmdFxuICAgICAgICAvLyBvciBub3QuICB3ZSBzaG91bGQgbWFrZSBzdXJlIGl0IGlzIGFsd2F5cyBsb3dlcmNhc2UgZm9yIGNvbXBhcmlzb25zXG4gICAgICAgIHJldHVybiBTdHJpbmcuZnJvbUNoYXJDb2RlKGUud2hpY2gpLnRvTG93ZXJDYXNlKCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogY2hlY2tzIGlmIHR3byBhcnJheXMgYXJlIGVxdWFsXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0FycmF5fSBtb2RpZmllcnMxXG4gICAgICogQHBhcmFtIHtBcnJheX0gbW9kaWZpZXJzMlxuICAgICAqIEByZXR1cm5zIHtib29sZWFufVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9tb2RpZmllcnNNYXRjaChtb2RpZmllcnMxLCBtb2RpZmllcnMyKSB7XG4gICAgICAgIHJldHVybiBtb2RpZmllcnMxLnNvcnQoKS5qb2luKCcsJykgPT09IG1vZGlmaWVyczIuc29ydCgpLmpvaW4oJywnKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiB0YWtlcyBhIGtleSBldmVudCBhbmQgZmlndXJlcyBvdXQgd2hhdCB0aGUgbW9kaWZpZXJzIGFyZVxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfZXZlbnRNb2RpZmllcnMoZSkge1xuICAgICAgICB2YXIgbW9kaWZpZXJzID0gW107XG5cbiAgICAgICAgaWYgKGUuc2hpZnRLZXkpIHtcbiAgICAgICAgICAgIG1vZGlmaWVycy5wdXNoKCdzaGlmdCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGUuYWx0S2V5KSB7XG4gICAgICAgICAgICBtb2RpZmllcnMucHVzaCgnYWx0Jyk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoZS5jdHJsS2V5KSB7XG4gICAgICAgICAgICBtb2RpZmllcnMucHVzaCgnY3RybCcpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGUubWV0YUtleSkge1xuICAgICAgICAgICAgbW9kaWZpZXJzLnB1c2goJ21ldGEnKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiBtb2RpZmllcnM7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcHJldmVudHMgZGVmYXVsdCBmb3IgdGhpcyBldmVudFxuICAgICAqXG4gICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBmdW5jdGlvbiBfcHJldmVudERlZmF1bHQoZSkge1xuICAgICAgICBpZiAoZS5wcmV2ZW50RGVmYXVsdCkge1xuICAgICAgICAgICAgZS5wcmV2ZW50RGVmYXVsdCgpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZS5yZXR1cm5WYWx1ZSA9IGZhbHNlO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHN0b3BzIHByb3BvZ2F0aW9uIGZvciB0aGlzIGV2ZW50XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9zdG9wUHJvcGFnYXRpb24oZSkge1xuICAgICAgICBpZiAoZS5zdG9wUHJvcGFnYXRpb24pIHtcbiAgICAgICAgICAgIGUuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBlLmNhbmNlbEJ1YmJsZSA9IHRydWU7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogZGV0ZXJtaW5lcyBpZiB0aGUga2V5Y29kZSBzcGVjaWZpZWQgaXMgYSBtb2RpZmllciBrZXkgb3Igbm90XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30ga2V5XG4gICAgICogQHJldHVybnMge2Jvb2xlYW59XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2lzTW9kaWZpZXIoa2V5KSB7XG4gICAgICAgIHJldHVybiBrZXkgPT0gJ3NoaWZ0JyB8fCBrZXkgPT0gJ2N0cmwnIHx8IGtleSA9PSAnYWx0JyB8fCBrZXkgPT0gJ21ldGEnO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIHJldmVyc2VzIHRoZSBtYXAgbG9va3VwIHNvIHRoYXQgd2UgY2FuIGxvb2sgZm9yIHNwZWNpZmljIGtleXNcbiAgICAgKiB0byBzZWUgd2hhdCBjYW4gYW5kIGNhbid0IHVzZSBrZXlwcmVzc1xuICAgICAqXG4gICAgICogQHJldHVybiB7T2JqZWN0fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9nZXRSZXZlcnNlTWFwKCkge1xuICAgICAgICBpZiAoIV9SRVZFUlNFX01BUCkge1xuICAgICAgICAgICAgX1JFVkVSU0VfTUFQID0ge307XG4gICAgICAgICAgICBmb3IgKHZhciBrZXkgaW4gX01BUCkge1xuXG4gICAgICAgICAgICAgICAgLy8gcHVsbCBvdXQgdGhlIG51bWVyaWMga2V5cGFkIGZyb20gaGVyZSBjYXVzZSBrZXlwcmVzcyBzaG91bGRcbiAgICAgICAgICAgICAgICAvLyBiZSBhYmxlIHRvIGRldGVjdCB0aGUga2V5cyBmcm9tIHRoZSBjaGFyYWN0ZXJcbiAgICAgICAgICAgICAgICBpZiAoa2V5ID4gOTUgJiYga2V5IDwgMTEyKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGlmIChfTUFQLmhhc093blByb3BlcnR5KGtleSkpIHtcbiAgICAgICAgICAgICAgICAgICAgX1JFVkVSU0VfTUFQW19NQVBba2V5XV0gPSBrZXk7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfUkVWRVJTRV9NQVA7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogcGlja3MgdGhlIGJlc3QgYWN0aW9uIGJhc2VkIG9uIHRoZSBrZXkgY29tYmluYXRpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXkgLSBjaGFyYWN0ZXIgZm9yIGtleVxuICAgICAqIEBwYXJhbSB7QXJyYXl9IG1vZGlmaWVyc1xuICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gYWN0aW9uIHBhc3NlZCBpblxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9waWNrQmVzdEFjdGlvbihrZXksIG1vZGlmaWVycywgYWN0aW9uKSB7XG5cbiAgICAgICAgLy8gaWYgbm8gYWN0aW9uIHdhcyBwaWNrZWQgaW4gd2Ugc2hvdWxkIHRyeSB0byBwaWNrIHRoZSBvbmVcbiAgICAgICAgLy8gdGhhdCB3ZSB0aGluayB3b3VsZCB3b3JrIGJlc3QgZm9yIHRoaXMga2V5XG4gICAgICAgIGlmICghYWN0aW9uKSB7XG4gICAgICAgICAgICBhY3Rpb24gPSBfZ2V0UmV2ZXJzZU1hcCgpW2tleV0gPyAna2V5ZG93bicgOiAna2V5cHJlc3MnO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gbW9kaWZpZXIga2V5cyBkb24ndCB3b3JrIGFzIGV4cGVjdGVkIHdpdGgga2V5cHJlc3MsXG4gICAgICAgIC8vIHN3aXRjaCB0byBrZXlkb3duXG4gICAgICAgIGlmIChhY3Rpb24gPT0gJ2tleXByZXNzJyAmJiBtb2RpZmllcnMubGVuZ3RoKSB7XG4gICAgICAgICAgICBhY3Rpb24gPSAna2V5ZG93bic7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gYWN0aW9uO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENvbnZlcnRzIGZyb20gYSBzdHJpbmcga2V5IGNvbWJpbmF0aW9uIHRvIGFuIGFycmF5XG4gICAgICpcbiAgICAgKiBAcGFyYW0gIHtzdHJpbmd9IGNvbWJpbmF0aW9uIGxpa2UgXCJjb21tYW5kK3NoaWZ0K2xcIlxuICAgICAqIEByZXR1cm4ge0FycmF5fVxuICAgICAqL1xuICAgIGZ1bmN0aW9uIF9rZXlzRnJvbVN0cmluZyhjb21iaW5hdGlvbikge1xuICAgICAgICBpZiAoY29tYmluYXRpb24gPT09ICcrJykge1xuICAgICAgICAgICAgcmV0dXJuIFsnKyddO1xuICAgICAgICB9XG5cbiAgICAgICAgY29tYmluYXRpb24gPSBjb21iaW5hdGlvbi5yZXBsYWNlKC9cXCt7Mn0vZywgJytwbHVzJyk7XG4gICAgICAgIHJldHVybiBjb21iaW5hdGlvbi5zcGxpdCgnKycpO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEdldHMgaW5mbyBmb3IgYSBzcGVjaWZpYyBrZXkgY29tYmluYXRpb25cbiAgICAgKlxuICAgICAqIEBwYXJhbSAge3N0cmluZ30gY29tYmluYXRpb24ga2V5IGNvbWJpbmF0aW9uIChcImNvbW1hbmQrc1wiIG9yIFwiYVwiIG9yIFwiKlwiKVxuICAgICAqIEBwYXJhbSAge3N0cmluZz19IGFjdGlvblxuICAgICAqIEByZXR1cm5zIHtPYmplY3R9XG4gICAgICovXG4gICAgZnVuY3Rpb24gX2dldEtleUluZm8oY29tYmluYXRpb24sIGFjdGlvbikge1xuICAgICAgICB2YXIga2V5cztcbiAgICAgICAgdmFyIGtleTtcbiAgICAgICAgdmFyIGk7XG4gICAgICAgIHZhciBtb2RpZmllcnMgPSBbXTtcblxuICAgICAgICAvLyB0YWtlIHRoZSBrZXlzIGZyb20gdGhpcyBwYXR0ZXJuIGFuZCBmaWd1cmUgb3V0IHdoYXQgdGhlIGFjdHVhbFxuICAgICAgICAvLyBwYXR0ZXJuIGlzIGFsbCBhYm91dFxuICAgICAgICBrZXlzID0gX2tleXNGcm9tU3RyaW5nKGNvbWJpbmF0aW9uKTtcblxuICAgICAgICBmb3IgKGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAga2V5ID0ga2V5c1tpXTtcblxuICAgICAgICAgICAgLy8gbm9ybWFsaXplIGtleSBuYW1lc1xuICAgICAgICAgICAgaWYgKF9TUEVDSUFMX0FMSUFTRVNba2V5XSkge1xuICAgICAgICAgICAgICAgIGtleSA9IF9TUEVDSUFMX0FMSUFTRVNba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgdGhpcyBpcyBub3QgYSBrZXlwcmVzcyBldmVudCB0aGVuIHdlIHNob3VsZFxuICAgICAgICAgICAgLy8gYmUgc21hcnQgYWJvdXQgdXNpbmcgc2hpZnQga2V5c1xuICAgICAgICAgICAgLy8gdGhpcyB3aWxsIG9ubHkgd29yayBmb3IgVVMga2V5Ym9hcmRzIGhvd2V2ZXJcbiAgICAgICAgICAgIGlmIChhY3Rpb24gJiYgYWN0aW9uICE9ICdrZXlwcmVzcycgJiYgX1NISUZUX01BUFtrZXldKSB7XG4gICAgICAgICAgICAgICAga2V5ID0gX1NISUZUX01BUFtrZXldO1xuICAgICAgICAgICAgICAgIG1vZGlmaWVycy5wdXNoKCdzaGlmdCcpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBpZiB0aGlzIGtleSBpcyBhIG1vZGlmaWVyIHRoZW4gYWRkIGl0IHRvIHRoZSBsaXN0IG9mIG1vZGlmaWVyc1xuICAgICAgICAgICAgaWYgKF9pc01vZGlmaWVyKGtleSkpIHtcbiAgICAgICAgICAgICAgICBtb2RpZmllcnMucHVzaChrZXkpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gZGVwZW5kaW5nIG9uIHdoYXQgdGhlIGtleSBjb21iaW5hdGlvbiBpc1xuICAgICAgICAvLyB3ZSB3aWxsIHRyeSB0byBwaWNrIHRoZSBiZXN0IGV2ZW50IGZvciBpdFxuICAgICAgICBhY3Rpb24gPSBfcGlja0Jlc3RBY3Rpb24oa2V5LCBtb2RpZmllcnMsIGFjdGlvbik7XG5cbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgIGtleToga2V5LFxuICAgICAgICAgICAgbW9kaWZpZXJzOiBtb2RpZmllcnMsXG4gICAgICAgICAgICBhY3Rpb246IGFjdGlvblxuICAgICAgICB9O1xuICAgIH1cblxuICAgIGZ1bmN0aW9uIF9iZWxvbmdzVG8oZWxlbWVudCwgYW5jZXN0b3IpIHtcbiAgICAgICAgaWYgKGVsZW1lbnQgPT09IG51bGwgfHwgZWxlbWVudCA9PT0gZG9jdW1lbnQpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChlbGVtZW50ID09PSBhbmNlc3Rvcikge1xuICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gX2JlbG9uZ3NUbyhlbGVtZW50LnBhcmVudE5vZGUsIGFuY2VzdG9yKTtcbiAgICB9XG5cbiAgICBmdW5jdGlvbiBNb3VzZXRyYXAodGFyZ2V0RWxlbWVudCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG5cbiAgICAgICAgdGFyZ2V0RWxlbWVudCA9IHRhcmdldEVsZW1lbnQgfHwgZG9jdW1lbnQ7XG5cbiAgICAgICAgaWYgKCEoc2VsZiBpbnN0YW5jZW9mIE1vdXNldHJhcCkpIHtcbiAgICAgICAgICAgIHJldHVybiBuZXcgTW91c2V0cmFwKHRhcmdldEVsZW1lbnQpO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGVsZW1lbnQgdG8gYXR0YWNoIGtleSBldmVudHMgdG9cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0VsZW1lbnR9XG4gICAgICAgICAqL1xuICAgICAgICBzZWxmLnRhcmdldCA9IHRhcmdldEVsZW1lbnQ7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGEgbGlzdCBvZiBhbGwgdGhlIGNhbGxiYWNrcyBzZXR1cCB2aWEgTW91c2V0cmFwLmJpbmQoKVxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7T2JqZWN0fVxuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5fY2FsbGJhY2tzID0ge307XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGRpcmVjdCBtYXAgb2Ygc3RyaW5nIGNvbWJpbmF0aW9ucyB0byBjYWxsYmFja3MgdXNlZCBmb3IgdHJpZ2dlcigpXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtPYmplY3R9XG4gICAgICAgICAqL1xuICAgICAgICBzZWxmLl9kaXJlY3RNYXAgPSB7fTtcblxuICAgICAgICAvKipcbiAgICAgICAgICoga2VlcHMgdHJhY2sgb2Ygd2hhdCBsZXZlbCBlYWNoIHNlcXVlbmNlIGlzIGF0IHNpbmNlIG11bHRpcGxlXG4gICAgICAgICAqIHNlcXVlbmNlcyBjYW4gc3RhcnQgb3V0IHdpdGggdGhlIHNhbWUgc2VxdWVuY2VcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge09iamVjdH1cbiAgICAgICAgICovXG4gICAgICAgIHZhciBfc2VxdWVuY2VMZXZlbHMgPSB7fTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogdmFyaWFibGUgdG8gc3RvcmUgdGhlIHNldFRpbWVvdXQgY2FsbFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVsbHxudW1iZXJ9XG4gICAgICAgICAqL1xuICAgICAgICB2YXIgX3Jlc2V0VGltZXI7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIHRlbXBvcmFyeSBzdGF0ZSB3aGVyZSB3ZSB3aWxsIGlnbm9yZSB0aGUgbmV4dCBrZXl1cFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7Ym9vbGVhbnxzdHJpbmd9XG4gICAgICAgICAqL1xuICAgICAgICB2YXIgX2lnbm9yZU5leHRLZXl1cCA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiB0ZW1wb3Jhcnkgc3RhdGUgd2hlcmUgd2Ugd2lsbCBpZ25vcmUgdGhlIG5leHQga2V5cHJlc3NcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW59XG4gICAgICAgICAqL1xuICAgICAgICB2YXIgX2lnbm9yZU5leHRLZXlwcmVzcyA9IGZhbHNlO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBhcmUgd2UgY3VycmVudGx5IGluc2lkZSBvZiBhIHNlcXVlbmNlP1xuICAgICAgICAgKiB0eXBlIG9mIGFjdGlvbiAoXCJrZXl1cFwiIG9yIFwia2V5ZG93blwiIG9yIFwia2V5cHJlc3NcIikgb3IgZmFsc2VcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge2Jvb2xlYW58c3RyaW5nfVxuICAgICAgICAgKi9cbiAgICAgICAgdmFyIF9uZXh0RXhwZWN0ZWRBY3Rpb24gPSBmYWxzZTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogcmVzZXRzIGFsbCBzZXF1ZW5jZSBjb3VudGVycyBleGNlcHQgZm9yIHRoZSBvbmVzIHBhc3NlZCBpblxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge09iamVjdH0gZG9Ob3RSZXNldFxuICAgICAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICAgICAqL1xuICAgICAgICBmdW5jdGlvbiBfcmVzZXRTZXF1ZW5jZXMoZG9Ob3RSZXNldCkge1xuICAgICAgICAgICAgZG9Ob3RSZXNldCA9IGRvTm90UmVzZXQgfHwge307XG5cbiAgICAgICAgICAgIHZhciBhY3RpdmVTZXF1ZW5jZXMgPSBmYWxzZSxcbiAgICAgICAgICAgICAgICBrZXk7XG5cbiAgICAgICAgICAgIGZvciAoa2V5IGluIF9zZXF1ZW5jZUxldmVscykge1xuICAgICAgICAgICAgICAgIGlmIChkb05vdFJlc2V0W2tleV0pIHtcbiAgICAgICAgICAgICAgICAgICAgYWN0aXZlU2VxdWVuY2VzID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIF9zZXF1ZW5jZUxldmVsc1trZXldID0gMDtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFhY3RpdmVTZXF1ZW5jZXMpIHtcbiAgICAgICAgICAgICAgICBfbmV4dEV4cGVjdGVkQWN0aW9uID0gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogZmluZHMgYWxsIGNhbGxiYWNrcyB0aGF0IG1hdGNoIGJhc2VkIG9uIHRoZSBrZXljb2RlLCBtb2RpZmllcnMsXG4gICAgICAgICAqIGFuZCBhY3Rpb25cbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IGNoYXJhY3RlclxuICAgICAgICAgKiBAcGFyYW0ge0FycmF5fSBtb2RpZmllcnNcbiAgICAgICAgICogQHBhcmFtIHtFdmVudHxPYmplY3R9IGVcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmc9fSBzZXF1ZW5jZU5hbWUgLSBuYW1lIG9mIHRoZSBzZXF1ZW5jZSB3ZSBhcmUgbG9va2luZyBmb3JcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmc9fSBjb21iaW5hdGlvblxuICAgICAgICAgKiBAcGFyYW0ge251bWJlcj19IGxldmVsXG4gICAgICAgICAqIEByZXR1cm5zIHtBcnJheX1cbiAgICAgICAgICovXG4gICAgICAgIGZ1bmN0aW9uIF9nZXRNYXRjaGVzKGNoYXJhY3RlciwgbW9kaWZpZXJzLCBlLCBzZXF1ZW5jZU5hbWUsIGNvbWJpbmF0aW9uLCBsZXZlbCkge1xuICAgICAgICAgICAgdmFyIGk7XG4gICAgICAgICAgICB2YXIgY2FsbGJhY2s7XG4gICAgICAgICAgICB2YXIgbWF0Y2hlcyA9IFtdO1xuICAgICAgICAgICAgdmFyIGFjdGlvbiA9IGUudHlwZTtcblxuICAgICAgICAgICAgLy8gaWYgdGhlcmUgYXJlIG5vIGV2ZW50cyByZWxhdGVkIHRvIHRoaXMga2V5Y29kZVxuICAgICAgICAgICAgaWYgKCFzZWxmLl9jYWxsYmFja3NbY2hhcmFjdGVyXSkge1xuICAgICAgICAgICAgICAgIHJldHVybiBbXTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gaWYgYSBtb2RpZmllciBrZXkgaXMgY29taW5nIHVwIG9uIGl0cyBvd24gd2Ugc2hvdWxkIGFsbG93IGl0XG4gICAgICAgICAgICBpZiAoYWN0aW9uID09ICdrZXl1cCcgJiYgX2lzTW9kaWZpZXIoY2hhcmFjdGVyKSkge1xuICAgICAgICAgICAgICAgIG1vZGlmaWVycyA9IFtjaGFyYWN0ZXJdO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAvLyBsb29wIHRocm91Z2ggYWxsIGNhbGxiYWNrcyBmb3IgdGhlIGtleSB0aGF0IHdhcyBwcmVzc2VkXG4gICAgICAgICAgICAvLyBhbmQgc2VlIGlmIGFueSBvZiB0aGVtIG1hdGNoXG4gICAgICAgICAgICBmb3IgKGkgPSAwOyBpIDwgc2VsZi5fY2FsbGJhY2tzW2NoYXJhY3Rlcl0ubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICBjYWxsYmFjayA9IHNlbGYuX2NhbGxiYWNrc1tjaGFyYWN0ZXJdW2ldO1xuXG4gICAgICAgICAgICAgICAgLy8gaWYgYSBzZXF1ZW5jZSBuYW1lIGlzIG5vdCBzcGVjaWZpZWQsIGJ1dCB0aGlzIGlzIGEgc2VxdWVuY2UgYXRcbiAgICAgICAgICAgICAgICAvLyB0aGUgd3JvbmcgbGV2ZWwgdGhlbiBtb3ZlIG9udG8gdGhlIG5leHQgbWF0Y2hcbiAgICAgICAgICAgICAgICBpZiAoIXNlcXVlbmNlTmFtZSAmJiBjYWxsYmFjay5zZXEgJiYgX3NlcXVlbmNlTGV2ZWxzW2NhbGxiYWNrLnNlcV0gIT0gY2FsbGJhY2subGV2ZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlIGFjdGlvbiB3ZSBhcmUgbG9va2luZyBmb3IgZG9lc24ndCBtYXRjaCB0aGUgYWN0aW9uIHdlIGdvdFxuICAgICAgICAgICAgICAgIC8vIHRoZW4gd2Ugc2hvdWxkIGtlZXAgZ29pbmdcbiAgICAgICAgICAgICAgICBpZiAoYWN0aW9uICE9IGNhbGxiYWNrLmFjdGlvbikge1xuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBpZiB0aGlzIGlzIGEga2V5cHJlc3MgZXZlbnQgYW5kIHRoZSBtZXRhIGtleSBhbmQgY29udHJvbCBrZXlcbiAgICAgICAgICAgICAgICAvLyBhcmUgbm90IHByZXNzZWQgdGhhdCBtZWFucyB0aGF0IHdlIG5lZWQgdG8gb25seSBsb29rIGF0IHRoZVxuICAgICAgICAgICAgICAgIC8vIGNoYXJhY3Rlciwgb3RoZXJ3aXNlIGNoZWNrIHRoZSBtb2RpZmllcnMgYXMgd2VsbFxuICAgICAgICAgICAgICAgIC8vXG4gICAgICAgICAgICAgICAgLy8gY2hyb21lIHdpbGwgbm90IGZpcmUgYSBrZXlwcmVzcyBpZiBtZXRhIG9yIGNvbnRyb2wgaXMgZG93blxuICAgICAgICAgICAgICAgIC8vIHNhZmFyaSB3aWxsIGZpcmUgYSBrZXlwcmVzcyBpZiBtZXRhIG9yIG1ldGErc2hpZnQgaXMgZG93blxuICAgICAgICAgICAgICAgIC8vIGZpcmVmb3ggd2lsbCBmaXJlIGEga2V5cHJlc3MgaWYgbWV0YSBvciBjb250cm9sIGlzIGRvd25cbiAgICAgICAgICAgICAgICBpZiAoKGFjdGlvbiA9PSAna2V5cHJlc3MnICYmICFlLm1ldGFLZXkgJiYgIWUuY3RybEtleSkgfHwgX21vZGlmaWVyc01hdGNoKG1vZGlmaWVycywgY2FsbGJhY2subW9kaWZpZXJzKSkge1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIHdoZW4geW91IGJpbmQgYSBjb21iaW5hdGlvbiBvciBzZXF1ZW5jZSBhIHNlY29uZCB0aW1lIGl0XG4gICAgICAgICAgICAgICAgICAgIC8vIHNob3VsZCBvdmVyd3JpdGUgdGhlIGZpcnN0IG9uZS4gIGlmIGEgc2VxdWVuY2VOYW1lIG9yXG4gICAgICAgICAgICAgICAgICAgIC8vIGNvbWJpbmF0aW9uIGlzIHNwZWNpZmllZCBpbiB0aGlzIGNhbGwgaXQgZG9lcyBqdXN0IHRoYXRcbiAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgLy8gQHRvZG8gbWFrZSBkZWxldGluZyBpdHMgb3duIG1ldGhvZD9cbiAgICAgICAgICAgICAgICAgICAgdmFyIGRlbGV0ZUNvbWJvID0gIXNlcXVlbmNlTmFtZSAmJiBjYWxsYmFjay5jb21ibyA9PSBjb21iaW5hdGlvbjtcbiAgICAgICAgICAgICAgICAgICAgdmFyIGRlbGV0ZVNlcXVlbmNlID0gc2VxdWVuY2VOYW1lICYmIGNhbGxiYWNrLnNlcSA9PSBzZXF1ZW5jZU5hbWUgJiYgY2FsbGJhY2subGV2ZWwgPT0gbGV2ZWw7XG4gICAgICAgICAgICAgICAgICAgIGlmIChkZWxldGVDb21ibyB8fCBkZWxldGVTZXF1ZW5jZSkge1xuICAgICAgICAgICAgICAgICAgICAgICAgc2VsZi5fY2FsbGJhY2tzW2NoYXJhY3Rlcl0uc3BsaWNlKGksIDEpO1xuICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgbWF0Y2hlcy5wdXNoKGNhbGxiYWNrKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIHJldHVybiBtYXRjaGVzO1xuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGFjdHVhbGx5IGNhbGxzIHRoZSBjYWxsYmFjayBmdW5jdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBpZiB5b3VyIGNhbGxiYWNrIGZ1bmN0aW9uIHJldHVybnMgZmFsc2UgdGhpcyB3aWxsIHVzZSB0aGUganF1ZXJ5XG4gICAgICAgICAqIGNvbnZlbnRpb24gLSBwcmV2ZW50IGRlZmF1bHQgYW5kIHN0b3AgcHJvcG9nYXRpb24gb24gdGhlIGV2ZW50XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2ZpcmVDYWxsYmFjayhjYWxsYmFjaywgZSwgY29tYm8sIHNlcXVlbmNlKSB7XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgZXZlbnQgc2hvdWxkIG5vdCBoYXBwZW4gc3RvcCBoZXJlXG4gICAgICAgICAgICBpZiAoc2VsZi5zdG9wQ2FsbGJhY2soZSwgZS50YXJnZXQgfHwgZS5zcmNFbGVtZW50LCBjb21ibywgc2VxdWVuY2UpKSB7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoY2FsbGJhY2soZSwgY29tYm8pID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICAgIF9wcmV2ZW50RGVmYXVsdChlKTtcbiAgICAgICAgICAgICAgICBfc3RvcFByb3BhZ2F0aW9uKGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGhhbmRsZXMgYSBjaGFyYWN0ZXIga2V5IGV2ZW50XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfSBjaGFyYWN0ZXJcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gbW9kaWZpZXJzXG4gICAgICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgc2VsZi5faGFuZGxlS2V5ID0gZnVuY3Rpb24oY2hhcmFjdGVyLCBtb2RpZmllcnMsIGUpIHtcbiAgICAgICAgICAgIHZhciBjYWxsYmFja3MgPSBfZ2V0TWF0Y2hlcyhjaGFyYWN0ZXIsIG1vZGlmaWVycywgZSk7XG4gICAgICAgICAgICB2YXIgaTtcbiAgICAgICAgICAgIHZhciBkb05vdFJlc2V0ID0ge307XG4gICAgICAgICAgICB2YXIgbWF4TGV2ZWwgPSAwO1xuICAgICAgICAgICAgdmFyIHByb2Nlc3NlZFNlcXVlbmNlQ2FsbGJhY2sgPSBmYWxzZTtcblxuICAgICAgICAgICAgLy8gQ2FsY3VsYXRlIHRoZSBtYXhMZXZlbCBmb3Igc2VxdWVuY2VzIHNvIHdlIGNhbiBvbmx5IGV4ZWN1dGUgdGhlIGxvbmdlc3QgY2FsbGJhY2sgc2VxdWVuY2VcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2tzW2ldLnNlcSkge1xuICAgICAgICAgICAgICAgICAgICBtYXhMZXZlbCA9IE1hdGgubWF4KG1heExldmVsLCBjYWxsYmFja3NbaV0ubGV2ZWwpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgLy8gbG9vcCB0aHJvdWdoIG1hdGNoaW5nIGNhbGxiYWNrcyBmb3IgdGhpcyBrZXkgZXZlbnRcbiAgICAgICAgICAgIGZvciAoaSA9IDA7IGkgPCBjYWxsYmFja3MubGVuZ3RoOyArK2kpIHtcblxuICAgICAgICAgICAgICAgIC8vIGZpcmUgZm9yIGFsbCBzZXF1ZW5jZSBjYWxsYmFja3NcbiAgICAgICAgICAgICAgICAvLyB0aGlzIGlzIGJlY2F1c2UgaWYgZm9yIGV4YW1wbGUgeW91IGhhdmUgbXVsdGlwbGUgc2VxdWVuY2VzXG4gICAgICAgICAgICAgICAgLy8gYm91bmQgc3VjaCBhcyBcImcgaVwiIGFuZCBcImcgdFwiIHRoZXkgYm90aCBuZWVkIHRvIGZpcmUgdGhlXG4gICAgICAgICAgICAgICAgLy8gY2FsbGJhY2sgZm9yIG1hdGNoaW5nIGcgY2F1c2Ugb3RoZXJ3aXNlIHlvdSBjYW4gb25seSBldmVyXG4gICAgICAgICAgICAgICAgLy8gbWF0Y2ggdGhlIGZpcnN0IG9uZVxuICAgICAgICAgICAgICAgIGlmIChjYWxsYmFja3NbaV0uc2VxKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgLy8gb25seSBmaXJlIGNhbGxiYWNrcyBmb3IgdGhlIG1heExldmVsIHRvIHByZXZlbnRcbiAgICAgICAgICAgICAgICAgICAgLy8gc3Vic2VxdWVuY2VzIGZyb20gYWxzbyBmaXJpbmdcbiAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgLy8gZm9yIGV4YW1wbGUgJ2Egb3B0aW9uIGInIHNob3VsZCBub3QgY2F1c2UgJ29wdGlvbiBiJyB0byBmaXJlXG4gICAgICAgICAgICAgICAgICAgIC8vIGV2ZW4gdGhvdWdoICdvcHRpb24gYicgaXMgcGFydCBvZiB0aGUgb3RoZXIgc2VxdWVuY2VcbiAgICAgICAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgICAgICAgLy8gYW55IHNlcXVlbmNlcyB0aGF0IGRvIG5vdCBtYXRjaCBoZXJlIHdpbGwgYmUgZGlzY2FyZGVkXG4gICAgICAgICAgICAgICAgICAgIC8vIGJlbG93IGJ5IHRoZSBfcmVzZXRTZXF1ZW5jZXMgY2FsbFxuICAgICAgICAgICAgICAgICAgICBpZiAoY2FsbGJhY2tzW2ldLmxldmVsICE9IG1heExldmVsKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgICAgIHByb2Nlc3NlZFNlcXVlbmNlQ2FsbGJhY2sgPSB0cnVlO1xuXG4gICAgICAgICAgICAgICAgICAgIC8vIGtlZXAgYSBsaXN0IG9mIHdoaWNoIHNlcXVlbmNlcyB3ZXJlIG1hdGNoZXMgZm9yIGxhdGVyXG4gICAgICAgICAgICAgICAgICAgIGRvTm90UmVzZXRbY2FsbGJhY2tzW2ldLnNlcV0gPSAxO1xuICAgICAgICAgICAgICAgICAgICBfZmlyZUNhbGxiYWNrKGNhbGxiYWNrc1tpXS5jYWxsYmFjaywgZSwgY2FsbGJhY2tzW2ldLmNvbWJvLCBjYWxsYmFja3NbaV0uc2VxKTtcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgLy8gaWYgdGhlcmUgd2VyZSBubyBzZXF1ZW5jZSBtYXRjaGVzIGJ1dCB3ZSBhcmUgc3RpbGwgaGVyZVxuICAgICAgICAgICAgICAgIC8vIHRoYXQgbWVhbnMgdGhpcyBpcyBhIHJlZ3VsYXIgbWF0Y2ggc28gd2Ugc2hvdWxkIGZpcmUgdGhhdFxuICAgICAgICAgICAgICAgIGlmICghcHJvY2Vzc2VkU2VxdWVuY2VDYWxsYmFjaykge1xuICAgICAgICAgICAgICAgICAgICBfZmlyZUNhbGxiYWNrKGNhbGxiYWNrc1tpXS5jYWxsYmFjaywgZSwgY2FsbGJhY2tzW2ldLmNvbWJvKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGlmIHRoZSBrZXkgeW91IHByZXNzZWQgbWF0Y2hlcyB0aGUgdHlwZSBvZiBzZXF1ZW5jZSB3aXRob3V0XG4gICAgICAgICAgICAvLyBiZWluZyBhIG1vZGlmaWVyIChpZSBcImtleXVwXCIgb3IgXCJrZXlwcmVzc1wiKSB0aGVuIHdlIHNob3VsZFxuICAgICAgICAgICAgLy8gcmVzZXQgYWxsIHNlcXVlbmNlcyB0aGF0IHdlcmUgbm90IG1hdGNoZWQgYnkgdGhpcyBldmVudFxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIHRoaXMgaXMgc28sIGZvciBleGFtcGxlLCBpZiB5b3UgaGF2ZSB0aGUgc2VxdWVuY2UgXCJoIGEgdFwiIGFuZCB5b3VcbiAgICAgICAgICAgIC8vIHR5cGUgXCJoIGUgYSByIHRcIiBpdCBkb2VzIG5vdCBtYXRjaC4gIGluIHRoaXMgY2FzZSB0aGUgXCJlXCIgd2lsbFxuICAgICAgICAgICAgLy8gY2F1c2UgdGhlIHNlcXVlbmNlIHRvIHJlc2V0XG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gbW9kaWZpZXIga2V5cyBhcmUgaWdub3JlZCBiZWNhdXNlIHlvdSBjYW4gaGF2ZSBhIHNlcXVlbmNlXG4gICAgICAgICAgICAvLyB0aGF0IGNvbnRhaW5zIG1vZGlmaWVycyBzdWNoIGFzIFwiZW50ZXIgY3RybCtzcGFjZVwiIGFuZCBpbiBtb3N0XG4gICAgICAgICAgICAvLyBjYXNlcyB0aGUgbW9kaWZpZXIga2V5IHdpbGwgYmUgcHJlc3NlZCBiZWZvcmUgdGhlIG5leHQga2V5XG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gYWxzbyBpZiB5b3UgaGF2ZSBhIHNlcXVlbmNlIHN1Y2ggYXMgXCJjdHJsK2IgYVwiIHRoZW4gcHJlc3NpbmcgdGhlXG4gICAgICAgICAgICAvLyBcImJcIiBrZXkgd2lsbCB0cmlnZ2VyIGEgXCJrZXlwcmVzc1wiIGFuZCBhIFwia2V5ZG93blwiXG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gdGhlIFwia2V5ZG93blwiIGlzIGV4cGVjdGVkIHdoZW4gdGhlcmUgaXMgYSBtb2RpZmllciwgYnV0IHRoZVxuICAgICAgICAgICAgLy8gXCJrZXlwcmVzc1wiIGVuZHMgdXAgbWF0Y2hpbmcgdGhlIF9uZXh0RXhwZWN0ZWRBY3Rpb24gc2luY2UgaXQgb2NjdXJzXG4gICAgICAgICAgICAvLyBhZnRlciBhbmQgdGhhdCBjYXVzZXMgdGhlIHNlcXVlbmNlIHRvIHJlc2V0XG4gICAgICAgICAgICAvL1xuICAgICAgICAgICAgLy8gd2UgaWdub3JlIGtleXByZXNzZXMgaW4gYSBzZXF1ZW5jZSB0aGF0IGRpcmVjdGx5IGZvbGxvdyBhIGtleWRvd25cbiAgICAgICAgICAgIC8vIGZvciB0aGUgc2FtZSBjaGFyYWN0ZXJcbiAgICAgICAgICAgIHZhciBpZ25vcmVUaGlzS2V5cHJlc3MgPSBlLnR5cGUgPT0gJ2tleXByZXNzJyAmJiBfaWdub3JlTmV4dEtleXByZXNzO1xuICAgICAgICAgICAgaWYgKGUudHlwZSA9PSBfbmV4dEV4cGVjdGVkQWN0aW9uICYmICFfaXNNb2RpZmllcihjaGFyYWN0ZXIpICYmICFpZ25vcmVUaGlzS2V5cHJlc3MpIHtcbiAgICAgICAgICAgICAgICBfcmVzZXRTZXF1ZW5jZXMoZG9Ob3RSZXNldCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIF9pZ25vcmVOZXh0S2V5cHJlc3MgPSBwcm9jZXNzZWRTZXF1ZW5jZUNhbGxiYWNrICYmIGUudHlwZSA9PSAna2V5ZG93bic7XG4gICAgICAgIH07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIGhhbmRsZXMgYSBrZXlkb3duIGV2ZW50XG4gICAgICAgICAqXG4gICAgICAgICAqIEBwYXJhbSB7RXZlbnR9IGVcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2hhbmRsZUtleUV2ZW50KGUpIHtcblxuICAgICAgICAgICAgLy8gbm9ybWFsaXplIGUud2hpY2ggZm9yIGtleSBldmVudHNcbiAgICAgICAgICAgIC8vIEBzZWUgaHR0cDovL3N0YWNrb3ZlcmZsb3cuY29tL3F1ZXN0aW9ucy80Mjg1NjI3L2phdmFzY3JpcHQta2V5Y29kZS12cy1jaGFyY29kZS11dHRlci1jb25mdXNpb25cbiAgICAgICAgICAgIGlmICh0eXBlb2YgZS53aGljaCAhPT0gJ251bWJlcicpIHtcbiAgICAgICAgICAgICAgICBlLndoaWNoID0gZS5rZXlDb2RlO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICB2YXIgY2hhcmFjdGVyID0gX2NoYXJhY3RlckZyb21FdmVudChlKTtcblxuICAgICAgICAgICAgLy8gbm8gY2hhcmFjdGVyIGZvdW5kIHRoZW4gc3RvcFxuICAgICAgICAgICAgaWYgKCFjaGFyYWN0ZXIpIHtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIG5lZWQgdG8gdXNlID09PSBmb3IgdGhlIGNoYXJhY3RlciBjaGVjayBiZWNhdXNlIHRoZSBjaGFyYWN0ZXIgY2FuIGJlIDBcbiAgICAgICAgICAgIGlmIChlLnR5cGUgPT0gJ2tleXVwJyAmJiBfaWdub3JlTmV4dEtleXVwID09PSBjaGFyYWN0ZXIpIHtcbiAgICAgICAgICAgICAgICBfaWdub3JlTmV4dEtleXVwID0gZmFsc2U7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBzZWxmLmhhbmRsZUtleShjaGFyYWN0ZXIsIF9ldmVudE1vZGlmaWVycyhlKSwgZSk7XG4gICAgICAgIH1cblxuICAgICAgICAvKipcbiAgICAgICAgICogY2FsbGVkIHRvIHNldCBhIDEgc2Vjb25kIHRpbWVvdXQgb24gdGhlIHNwZWNpZmllZCBzZXF1ZW5jZVxuICAgICAgICAgKlxuICAgICAgICAgKiB0aGlzIGlzIHNvIGFmdGVyIGVhY2gga2V5IHByZXNzIGluIHRoZSBzZXF1ZW5jZSB5b3UgaGF2ZSAxIHNlY29uZFxuICAgICAgICAgKiB0byBwcmVzcyB0aGUgbmV4dCBrZXkgYmVmb3JlIHlvdSBoYXZlIHRvIHN0YXJ0IG92ZXJcbiAgICAgICAgICpcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX3Jlc2V0U2VxdWVuY2VUaW1lcigpIHtcbiAgICAgICAgICAgIGNsZWFyVGltZW91dChfcmVzZXRUaW1lcik7XG4gICAgICAgICAgICBfcmVzZXRUaW1lciA9IHNldFRpbWVvdXQoX3Jlc2V0U2VxdWVuY2VzLCAxMDAwKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBiaW5kcyBhIGtleSBzZXF1ZW5jZSB0byBhbiBldmVudFxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29tYm8gLSBjb21ibyBzcGVjaWZpZWQgaW4gYmluZCBjYWxsXG4gICAgICAgICAqIEBwYXJhbSB7QXJyYXl9IGtleXNcbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmc9fSBhY3Rpb25cbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2JpbmRTZXF1ZW5jZShjb21ibywga2V5cywgY2FsbGJhY2ssIGFjdGlvbikge1xuXG4gICAgICAgICAgICAvLyBzdGFydCBvZmYgYnkgYWRkaW5nIGEgc2VxdWVuY2UgbGV2ZWwgcmVjb3JkIGZvciB0aGlzIGNvbWJpbmF0aW9uXG4gICAgICAgICAgICAvLyBhbmQgc2V0dGluZyB0aGUgbGV2ZWwgdG8gMFxuICAgICAgICAgICAgX3NlcXVlbmNlTGV2ZWxzW2NvbWJvXSA9IDA7XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogY2FsbGJhY2sgdG8gaW5jcmVhc2UgdGhlIHNlcXVlbmNlIGxldmVsIGZvciB0aGlzIHNlcXVlbmNlIGFuZCByZXNldFxuICAgICAgICAgICAgICogYWxsIG90aGVyIHNlcXVlbmNlcyB0aGF0IHdlcmUgYWN0aXZlXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHBhcmFtIHtzdHJpbmd9IG5leHRBY3Rpb25cbiAgICAgICAgICAgICAqIEByZXR1cm5zIHtGdW5jdGlvbn1cbiAgICAgICAgICAgICAqL1xuICAgICAgICAgICAgZnVuY3Rpb24gX2luY3JlYXNlU2VxdWVuY2UobmV4dEFjdGlvbikge1xuICAgICAgICAgICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICAgICAgICAgICAgX25leHRFeHBlY3RlZEFjdGlvbiA9IG5leHRBY3Rpb247XG4gICAgICAgICAgICAgICAgICAgICsrX3NlcXVlbmNlTGV2ZWxzW2NvbWJvXTtcbiAgICAgICAgICAgICAgICAgICAgX3Jlc2V0U2VxdWVuY2VUaW1lcigpO1xuICAgICAgICAgICAgICAgIH07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8qKlxuICAgICAgICAgICAgICogd3JhcHMgdGhlIHNwZWNpZmllZCBjYWxsYmFjayBpbnNpZGUgb2YgYW5vdGhlciBmdW5jdGlvbiBpbiBvcmRlclxuICAgICAgICAgICAgICogdG8gcmVzZXQgYWxsIHNlcXVlbmNlIGNvdW50ZXJzIGFzIHNvb24gYXMgdGhpcyBzZXF1ZW5jZSBpcyBkb25lXG4gICAgICAgICAgICAgKlxuICAgICAgICAgICAgICogQHBhcmFtIHtFdmVudH0gZVxuICAgICAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgICAgICovXG4gICAgICAgICAgICBmdW5jdGlvbiBfY2FsbGJhY2tBbmRSZXNldChlKSB7XG4gICAgICAgICAgICAgICAgX2ZpcmVDYWxsYmFjayhjYWxsYmFjaywgZSwgY29tYm8pO1xuXG4gICAgICAgICAgICAgICAgLy8gd2Ugc2hvdWxkIGlnbm9yZSB0aGUgbmV4dCBrZXkgdXAgaWYgdGhlIGFjdGlvbiBpcyBrZXkgZG93blxuICAgICAgICAgICAgICAgIC8vIG9yIGtleXByZXNzLiAgdGhpcyBpcyBzbyBpZiB5b3UgZmluaXNoIGEgc2VxdWVuY2UgYW5kXG4gICAgICAgICAgICAgICAgLy8gcmVsZWFzZSB0aGUga2V5IHRoZSBmaW5hbCBrZXkgd2lsbCBub3QgdHJpZ2dlciBhIGtleXVwXG4gICAgICAgICAgICAgICAgaWYgKGFjdGlvbiAhPT0gJ2tleXVwJykge1xuICAgICAgICAgICAgICAgICAgICBfaWdub3JlTmV4dEtleXVwID0gX2NoYXJhY3RlckZyb21FdmVudChlKTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyB3ZWlyZCByYWNlIGNvbmRpdGlvbiBpZiBhIHNlcXVlbmNlIGVuZHMgd2l0aCB0aGUga2V5XG4gICAgICAgICAgICAgICAgLy8gYW5vdGhlciBzZXF1ZW5jZSBiZWdpbnMgd2l0aFxuICAgICAgICAgICAgICAgIHNldFRpbWVvdXQoX3Jlc2V0U2VxdWVuY2VzLCAxMCk7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIC8vIGxvb3AgdGhyb3VnaCBrZXlzIG9uZSBhdCBhIHRpbWUgYW5kIGJpbmQgdGhlIGFwcHJvcHJpYXRlIGNhbGxiYWNrXG4gICAgICAgICAgICAvLyBmdW5jdGlvbi4gIGZvciBhbnkga2V5IGxlYWRpbmcgdXAgdG8gdGhlIGZpbmFsIG9uZSBpdCBzaG91bGRcbiAgICAgICAgICAgIC8vIGluY3JlYXNlIHRoZSBzZXF1ZW5jZS4gYWZ0ZXIgdGhlIGZpbmFsLCBpdCBzaG91bGQgcmVzZXQgYWxsIHNlcXVlbmNlc1xuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIGlmIGFuIGFjdGlvbiBpcyBzcGVjaWZpZWQgaW4gdGhlIG9yaWdpbmFsIGJpbmQgY2FsbCB0aGVuIHRoYXQgd2lsbFxuICAgICAgICAgICAgLy8gYmUgdXNlZCB0aHJvdWdob3V0LiAgb3RoZXJ3aXNlIHdlIHdpbGwgcGFzcyB0aGUgYWN0aW9uIHRoYXQgdGhlXG4gICAgICAgICAgICAvLyBuZXh0IGtleSBpbiB0aGUgc2VxdWVuY2Ugc2hvdWxkIG1hdGNoLiAgdGhpcyBhbGxvd3MgYSBzZXF1ZW5jZVxuICAgICAgICAgICAgLy8gdG8gbWl4IGFuZCBtYXRjaCBrZXlwcmVzcyBhbmQga2V5ZG93biBldmVudHMgZGVwZW5kaW5nIG9uIHdoaWNoXG4gICAgICAgICAgICAvLyBvbmVzIGFyZSBiZXR0ZXIgc3VpdGVkIHRvIHRoZSBrZXkgcHJvdmlkZWRcbiAgICAgICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDwga2V5cy5sZW5ndGg7ICsraSkge1xuICAgICAgICAgICAgICAgIHZhciBpc0ZpbmFsID0gaSArIDEgPT09IGtleXMubGVuZ3RoO1xuICAgICAgICAgICAgICAgIHZhciB3cmFwcGVkQ2FsbGJhY2sgPSBpc0ZpbmFsID8gX2NhbGxiYWNrQW5kUmVzZXQgOiBfaW5jcmVhc2VTZXF1ZW5jZShhY3Rpb24gfHwgX2dldEtleUluZm8oa2V5c1tpICsgMV0pLmFjdGlvbik7XG4gICAgICAgICAgICAgICAgX2JpbmRTaW5nbGUoa2V5c1tpXSwgd3JhcHBlZENhbGxiYWNrLCBhY3Rpb24sIGNvbWJvLCBpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBiaW5kcyBhIHNpbmdsZSBrZXlib2FyZCBjb21iaW5hdGlvblxuICAgICAgICAgKlxuICAgICAgICAgKiBAcGFyYW0ge3N0cmluZ30gY29tYmluYXRpb25cbiAgICAgICAgICogQHBhcmFtIHtGdW5jdGlvbn0gY2FsbGJhY2tcbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmc9fSBhY3Rpb25cbiAgICAgICAgICogQHBhcmFtIHtzdHJpbmc9fSBzZXF1ZW5jZU5hbWUgLSBuYW1lIG9mIHNlcXVlbmNlIGlmIHBhcnQgb2Ygc2VxdWVuY2VcbiAgICAgICAgICogQHBhcmFtIHtudW1iZXI9fSBsZXZlbCAtIHdoYXQgcGFydCBvZiB0aGUgc2VxdWVuY2UgdGhlIGNvbW1hbmQgaXNcbiAgICAgICAgICogQHJldHVybnMgdm9pZFxuICAgICAgICAgKi9cbiAgICAgICAgZnVuY3Rpb24gX2JpbmRTaW5nbGUoY29tYmluYXRpb24sIGNhbGxiYWNrLCBhY3Rpb24sIHNlcXVlbmNlTmFtZSwgbGV2ZWwpIHtcblxuICAgICAgICAgICAgLy8gc3RvcmUgYSBkaXJlY3QgbWFwcGVkIHJlZmVyZW5jZSBmb3IgdXNlIHdpdGggTW91c2V0cmFwLnRyaWdnZXJcbiAgICAgICAgICAgIHNlbGYuX2RpcmVjdE1hcFtjb21iaW5hdGlvbiArICc6JyArIGFjdGlvbl0gPSBjYWxsYmFjaztcblxuICAgICAgICAgICAgLy8gbWFrZSBzdXJlIG11bHRpcGxlIHNwYWNlcyBpbiBhIHJvdyBiZWNvbWUgYSBzaW5nbGUgc3BhY2VcbiAgICAgICAgICAgIGNvbWJpbmF0aW9uID0gY29tYmluYXRpb24ucmVwbGFjZSgvXFxzKy9nLCAnICcpO1xuXG4gICAgICAgICAgICB2YXIgc2VxdWVuY2UgPSBjb21iaW5hdGlvbi5zcGxpdCgnICcpO1xuICAgICAgICAgICAgdmFyIGluZm87XG5cbiAgICAgICAgICAgIC8vIGlmIHRoaXMgcGF0dGVybiBpcyBhIHNlcXVlbmNlIG9mIGtleXMgdGhlbiBydW4gdGhyb3VnaCB0aGlzIG1ldGhvZFxuICAgICAgICAgICAgLy8gdG8gcmVwcm9jZXNzIGVhY2ggcGF0dGVybiBvbmUga2V5IGF0IGEgdGltZVxuICAgICAgICAgICAgaWYgKHNlcXVlbmNlLmxlbmd0aCA+IDEpIHtcbiAgICAgICAgICAgICAgICBfYmluZFNlcXVlbmNlKGNvbWJpbmF0aW9uLCBzZXF1ZW5jZSwgY2FsbGJhY2ssIGFjdGlvbik7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpbmZvID0gX2dldEtleUluZm8oY29tYmluYXRpb24sIGFjdGlvbik7XG5cbiAgICAgICAgICAgIC8vIG1ha2Ugc3VyZSB0byBpbml0aWFsaXplIGFycmF5IGlmIHRoaXMgaXMgdGhlIGZpcnN0IHRpbWVcbiAgICAgICAgICAgIC8vIGEgY2FsbGJhY2sgaXMgYWRkZWQgZm9yIHRoaXMga2V5XG4gICAgICAgICAgICBzZWxmLl9jYWxsYmFja3NbaW5mby5rZXldID0gc2VsZi5fY2FsbGJhY2tzW2luZm8ua2V5XSB8fCBbXTtcblxuICAgICAgICAgICAgLy8gcmVtb3ZlIGFuIGV4aXN0aW5nIG1hdGNoIGlmIHRoZXJlIGlzIG9uZVxuICAgICAgICAgICAgX2dldE1hdGNoZXMoaW5mby5rZXksIGluZm8ubW9kaWZpZXJzLCB7dHlwZTogaW5mby5hY3Rpb259LCBzZXF1ZW5jZU5hbWUsIGNvbWJpbmF0aW9uLCBsZXZlbCk7XG5cbiAgICAgICAgICAgIC8vIGFkZCB0aGlzIGNhbGwgYmFjayB0byB0aGUgYXJyYXlcbiAgICAgICAgICAgIC8vIGlmIGl0IGlzIGEgc2VxdWVuY2UgcHV0IGl0IGF0IHRoZSBiZWdpbm5pbmdcbiAgICAgICAgICAgIC8vIGlmIG5vdCBwdXQgaXQgYXQgdGhlIGVuZFxuICAgICAgICAgICAgLy9cbiAgICAgICAgICAgIC8vIHRoaXMgaXMgaW1wb3J0YW50IGJlY2F1c2UgdGhlIHdheSB0aGVzZSBhcmUgcHJvY2Vzc2VkIGV4cGVjdHNcbiAgICAgICAgICAgIC8vIHRoZSBzZXF1ZW5jZSBvbmVzIHRvIGNvbWUgZmlyc3RcbiAgICAgICAgICAgIHNlbGYuX2NhbGxiYWNrc1tpbmZvLmtleV1bc2VxdWVuY2VOYW1lID8gJ3Vuc2hpZnQnIDogJ3B1c2gnXSh7XG4gICAgICAgICAgICAgICAgY2FsbGJhY2s6IGNhbGxiYWNrLFxuICAgICAgICAgICAgICAgIG1vZGlmaWVyczogaW5mby5tb2RpZmllcnMsXG4gICAgICAgICAgICAgICAgYWN0aW9uOiBpbmZvLmFjdGlvbixcbiAgICAgICAgICAgICAgICBzZXE6IHNlcXVlbmNlTmFtZSxcbiAgICAgICAgICAgICAgICBsZXZlbDogbGV2ZWwsXG4gICAgICAgICAgICAgICAgY29tYm86IGNvbWJpbmF0aW9uXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBiaW5kcyBtdWx0aXBsZSBjb21iaW5hdGlvbnMgdG8gdGhlIHNhbWUgY2FsbGJhY2tcbiAgICAgICAgICpcbiAgICAgICAgICogQHBhcmFtIHtBcnJheX0gY29tYmluYXRpb25zXG4gICAgICAgICAqIEBwYXJhbSB7RnVuY3Rpb259IGNhbGxiYWNrXG4gICAgICAgICAqIEBwYXJhbSB7c3RyaW5nfHVuZGVmaW5lZH0gYWN0aW9uXG4gICAgICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgICAgICovXG4gICAgICAgIHNlbGYuX2JpbmRNdWx0aXBsZSA9IGZ1bmN0aW9uKGNvbWJpbmF0aW9ucywgY2FsbGJhY2ssIGFjdGlvbikge1xuICAgICAgICAgICAgZm9yICh2YXIgaSA9IDA7IGkgPCBjb21iaW5hdGlvbnMubGVuZ3RoOyArK2kpIHtcbiAgICAgICAgICAgICAgICBfYmluZFNpbmdsZShjb21iaW5hdGlvbnNbaV0sIGNhbGxiYWNrLCBhY3Rpb24pO1xuICAgICAgICAgICAgfVxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIHN0YXJ0IVxuICAgICAgICBfYWRkRXZlbnQodGFyZ2V0RWxlbWVudCwgJ2tleXByZXNzJywgX2hhbmRsZUtleUV2ZW50KTtcbiAgICAgICAgX2FkZEV2ZW50KHRhcmdldEVsZW1lbnQsICdrZXlkb3duJywgX2hhbmRsZUtleUV2ZW50KTtcbiAgICAgICAgX2FkZEV2ZW50KHRhcmdldEVsZW1lbnQsICdrZXl1cCcsIF9oYW5kbGVLZXlFdmVudCk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogYmluZHMgYW4gZXZlbnQgdG8gbW91c2V0cmFwXG4gICAgICpcbiAgICAgKiBjYW4gYmUgYSBzaW5nbGUga2V5LCBhIGNvbWJpbmF0aW9uIG9mIGtleXMgc2VwYXJhdGVkIHdpdGggKyxcbiAgICAgKiBhbiBhcnJheSBvZiBrZXlzLCBvciBhIHNlcXVlbmNlIG9mIGtleXMgc2VwYXJhdGVkIGJ5IHNwYWNlc1xuICAgICAqXG4gICAgICogYmUgc3VyZSB0byBsaXN0IHRoZSBtb2RpZmllciBrZXlzIGZpcnN0IHRvIG1ha2Ugc3VyZSB0aGF0IHRoZVxuICAgICAqIGNvcnJlY3Qga2V5IGVuZHMgdXAgZ2V0dGluZyBib3VuZCAodGhlIGxhc3Qga2V5IGluIHRoZSBwYXR0ZXJuKVxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd8QXJyYXl9IGtleXNcbiAgICAgKiBAcGFyYW0ge0Z1bmN0aW9ufSBjYWxsYmFja1xuICAgICAqIEBwYXJhbSB7c3RyaW5nPX0gYWN0aW9uIC0gJ2tleXByZXNzJywgJ2tleWRvd24nLCBvciAna2V5dXAnXG4gICAgICogQHJldHVybnMgdm9pZFxuICAgICAqL1xuICAgIE1vdXNldHJhcC5wcm90b3R5cGUuYmluZCA9IGZ1bmN0aW9uKGtleXMsIGNhbGxiYWNrLCBhY3Rpb24pIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICBrZXlzID0ga2V5cyBpbnN0YW5jZW9mIEFycmF5ID8ga2V5cyA6IFtrZXlzXTtcbiAgICAgICAgc2VsZi5fYmluZE11bHRpcGxlLmNhbGwoc2VsZiwga2V5cywgY2FsbGJhY2ssIGFjdGlvbik7XG4gICAgICAgIHJldHVybiBzZWxmO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiB1bmJpbmRzIGFuIGV2ZW50IHRvIG1vdXNldHJhcFxuICAgICAqXG4gICAgICogdGhlIHVuYmluZGluZyBzZXRzIHRoZSBjYWxsYmFjayBmdW5jdGlvbiBvZiB0aGUgc3BlY2lmaWVkIGtleSBjb21ib1xuICAgICAqIHRvIGFuIGVtcHR5IGZ1bmN0aW9uIGFuZCBkZWxldGVzIHRoZSBjb3JyZXNwb25kaW5nIGtleSBpbiB0aGVcbiAgICAgKiBfZGlyZWN0TWFwIGRpY3QuXG4gICAgICpcbiAgICAgKiBUT0RPOiBhY3R1YWxseSByZW1vdmUgdGhpcyBmcm9tIHRoZSBfY2FsbGJhY2tzIGRpY3Rpb25hcnkgaW5zdGVhZFxuICAgICAqIG9mIGJpbmRpbmcgYW4gZW1wdHkgZnVuY3Rpb25cbiAgICAgKlxuICAgICAqIHRoZSBrZXljb21ibythY3Rpb24gaGFzIHRvIGJlIGV4YWN0bHkgdGhlIHNhbWUgYXNcbiAgICAgKiBpdCB3YXMgZGVmaW5lZCBpbiB0aGUgYmluZCBtZXRob2RcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfEFycmF5fSBrZXlzXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IGFjdGlvblxuICAgICAqIEByZXR1cm5zIHZvaWRcbiAgICAgKi9cbiAgICBNb3VzZXRyYXAucHJvdG90eXBlLnVuYmluZCA9IGZ1bmN0aW9uKGtleXMsIGFjdGlvbikge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHJldHVybiBzZWxmLmJpbmQuY2FsbChzZWxmLCBrZXlzLCBmdW5jdGlvbigpIHt9LCBhY3Rpb24pO1xuICAgIH07XG5cbiAgICAvKipcbiAgICAgKiB0cmlnZ2VycyBhbiBldmVudCB0aGF0IGhhcyBhbHJlYWR5IGJlZW4gYm91bmRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBrZXlzXG4gICAgICogQHBhcmFtIHtzdHJpbmc9fSBhY3Rpb25cbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgTW91c2V0cmFwLnByb3RvdHlwZS50cmlnZ2VyID0gZnVuY3Rpb24oa2V5cywgYWN0aW9uKSB7XG4gICAgICAgIHZhciBzZWxmID0gdGhpcztcbiAgICAgICAgaWYgKHNlbGYuX2RpcmVjdE1hcFtrZXlzICsgJzonICsgYWN0aW9uXSkge1xuICAgICAgICAgICAgc2VsZi5fZGlyZWN0TWFwW2tleXMgKyAnOicgKyBhY3Rpb25dKHt9LCBrZXlzKTtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gc2VsZjtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogcmVzZXRzIHRoZSBsaWJyYXJ5IGJhY2sgdG8gaXRzIGluaXRpYWwgc3RhdGUuICB0aGlzIGlzIHVzZWZ1bFxuICAgICAqIGlmIHlvdSB3YW50IHRvIGNsZWFyIG91dCB0aGUgY3VycmVudCBrZXlib2FyZCBzaG9ydGN1dHMgYW5kIGJpbmRcbiAgICAgKiBuZXcgb25lcyAtIGZvciBleGFtcGxlIGlmIHlvdSBzd2l0Y2ggdG8gYW5vdGhlciBwYWdlXG4gICAgICpcbiAgICAgKiBAcmV0dXJucyB2b2lkXG4gICAgICovXG4gICAgTW91c2V0cmFwLnByb3RvdHlwZS5yZXNldCA9IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc2VsZiA9IHRoaXM7XG4gICAgICAgIHNlbGYuX2NhbGxiYWNrcyA9IHt9O1xuICAgICAgICBzZWxmLl9kaXJlY3RNYXAgPSB7fTtcbiAgICAgICAgcmV0dXJuIHNlbGY7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIHNob3VsZCB3ZSBzdG9wIHRoaXMgZXZlbnQgYmVmb3JlIGZpcmluZyBvZmYgY2FsbGJhY2tzXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0V2ZW50fSBlXG4gICAgICogQHBhcmFtIHtFbGVtZW50fSBlbGVtZW50XG4gICAgICogQHJldHVybiB7Ym9vbGVhbn1cbiAgICAgKi9cbiAgICBNb3VzZXRyYXAucHJvdG90eXBlLnN0b3BDYWxsYmFjayA9IGZ1bmN0aW9uKGUsIGVsZW1lbnQpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuXG4gICAgICAgIC8vIGlmIHRoZSBlbGVtZW50IGhhcyB0aGUgY2xhc3MgXCJtb3VzZXRyYXBcIiB0aGVuIG5vIG5lZWQgdG8gc3RvcFxuICAgICAgICBpZiAoKCcgJyArIGVsZW1lbnQuY2xhc3NOYW1lICsgJyAnKS5pbmRleE9mKCcgbW91c2V0cmFwICcpID4gLTEpIHtcbiAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChfYmVsb25nc1RvKGVsZW1lbnQsIHNlbGYudGFyZ2V0KSkge1xuICAgICAgICAgICAgcmV0dXJuIGZhbHNlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gRXZlbnRzIG9yaWdpbmF0aW5nIGZyb20gYSBzaGFkb3cgRE9NIGFyZSByZS10YXJnZXR0ZWQgYW5kIGBlLnRhcmdldGAgaXMgdGhlIHNoYWRvdyBob3N0LFxuICAgICAgICAvLyBub3QgdGhlIGluaXRpYWwgZXZlbnQgdGFyZ2V0IGluIHRoZSBzaGFkb3cgdHJlZS4gTm90ZSB0aGF0IG5vdCBhbGwgZXZlbnRzIGNyb3NzIHRoZVxuICAgICAgICAvLyBzaGFkb3cgYm91bmRhcnkuXG4gICAgICAgIC8vIEZvciBzaGFkb3cgdHJlZXMgd2l0aCBgbW9kZTogJ29wZW4nYCwgdGhlIGluaXRpYWwgZXZlbnQgdGFyZ2V0IGlzIHRoZSBmaXJzdCBlbGVtZW50IGluXG4gICAgICAgIC8vIHRoZSBldmVudOKAmXMgY29tcG9zZWQgcGF0aC4gRm9yIHNoYWRvdyB0cmVlcyB3aXRoIGBtb2RlOiAnY2xvc2VkJ2AsIHRoZSBpbml0aWFsIGV2ZW50XG4gICAgICAgIC8vIHRhcmdldCBjYW5ub3QgYmUgb2J0YWluZWQuXG4gICAgICAgIGlmICgnY29tcG9zZWRQYXRoJyBpbiBlICYmIHR5cGVvZiBlLmNvbXBvc2VkUGF0aCA9PT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICAgICAgLy8gRm9yIG9wZW4gc2hhZG93IHRyZWVzLCB1cGRhdGUgYGVsZW1lbnRgIHNvIHRoYXQgdGhlIGZvbGxvd2luZyBjaGVjayB3b3Jrcy5cbiAgICAgICAgICAgIHZhciBpbml0aWFsRXZlbnRUYXJnZXQgPSBlLmNvbXBvc2VkUGF0aCgpWzBdO1xuICAgICAgICAgICAgaWYgKGluaXRpYWxFdmVudFRhcmdldCAhPT0gZS50YXJnZXQpIHtcbiAgICAgICAgICAgICAgICBlbGVtZW50ID0gaW5pdGlhbEV2ZW50VGFyZ2V0O1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgLy8gc3RvcCBmb3IgaW5wdXQsIHNlbGVjdCwgYW5kIHRleHRhcmVhXG4gICAgICAgIHJldHVybiBlbGVtZW50LnRhZ05hbWUgPT0gJ0lOUFVUJyB8fCBlbGVtZW50LnRhZ05hbWUgPT0gJ1NFTEVDVCcgfHwgZWxlbWVudC50YWdOYW1lID09ICdURVhUQVJFQScgfHwgZWxlbWVudC5pc0NvbnRlbnRFZGl0YWJsZTtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogZXhwb3NlcyBfaGFuZGxlS2V5IHB1YmxpY2x5IHNvIGl0IGNhbiBiZSBvdmVyd3JpdHRlbiBieSBleHRlbnNpb25zXG4gICAgICovXG4gICAgTW91c2V0cmFwLnByb3RvdHlwZS5oYW5kbGVLZXkgPSBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgICByZXR1cm4gc2VsZi5faGFuZGxlS2V5LmFwcGx5KHNlbGYsIGFyZ3VtZW50cyk7XG4gICAgfTtcblxuICAgIC8qKlxuICAgICAqIGFsbG93IGN1c3RvbSBrZXkgbWFwcGluZ3NcbiAgICAgKi9cbiAgICBNb3VzZXRyYXAuYWRkS2V5Y29kZXMgPSBmdW5jdGlvbihvYmplY3QpIHtcbiAgICAgICAgZm9yICh2YXIga2V5IGluIG9iamVjdCkge1xuICAgICAgICAgICAgaWYgKG9iamVjdC5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICAgICAgX01BUFtrZXldID0gb2JqZWN0W2tleV07XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgX1JFVkVSU0VfTUFQID0gbnVsbDtcbiAgICB9O1xuXG4gICAgLyoqXG4gICAgICogSW5pdCB0aGUgZ2xvYmFsIG1vdXNldHJhcCBmdW5jdGlvbnNcbiAgICAgKlxuICAgICAqIFRoaXMgbWV0aG9kIGlzIG5lZWRlZCB0byBhbGxvdyB0aGUgZ2xvYmFsIG1vdXNldHJhcCBmdW5jdGlvbnMgdG8gd29ya1xuICAgICAqIG5vdyB0aGF0IG1vdXNldHJhcCBpcyBhIGNvbnN0cnVjdG9yIGZ1bmN0aW9uLlxuICAgICAqL1xuICAgIE1vdXNldHJhcC5pbml0ID0gZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBkb2N1bWVudE1vdXNldHJhcCA9IE1vdXNldHJhcChkb2N1bWVudCk7XG4gICAgICAgIGZvciAodmFyIG1ldGhvZCBpbiBkb2N1bWVudE1vdXNldHJhcCkge1xuICAgICAgICAgICAgaWYgKG1ldGhvZC5jaGFyQXQoMCkgIT09ICdfJykge1xuICAgICAgICAgICAgICAgIE1vdXNldHJhcFttZXRob2RdID0gKGZ1bmN0aW9uKG1ldGhvZCkge1xuICAgICAgICAgICAgICAgICAgICByZXR1cm4gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gZG9jdW1lbnRNb3VzZXRyYXBbbWV0aG9kXS5hcHBseShkb2N1bWVudE1vdXNldHJhcCwgYXJndW1lbnRzKTtcbiAgICAgICAgICAgICAgICAgICAgfTtcbiAgICAgICAgICAgICAgICB9IChtZXRob2QpKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH07XG5cbiAgICBNb3VzZXRyYXAuaW5pdCgpO1xuXG4gICAgLy8gZXhwb3NlIG1vdXNldHJhcCB0byB0aGUgZ2xvYmFsIG9iamVjdFxuICAgIHdpbmRvdy5Nb3VzZXRyYXAgPSBNb3VzZXRyYXA7XG5cbiAgICAvLyBleHBvc2UgYXMgYSBjb21tb24ganMgbW9kdWxlXG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICAgIG1vZHVsZS5leHBvcnRzID0gTW91c2V0cmFwO1xuICAgIH1cblxuICAgIC8vIGV4cG9zZSBtb3VzZXRyYXAgYXMgYW4gQU1EIG1vZHVsZVxuICAgIGlmICh0eXBlb2YgZGVmaW5lID09PSAnZnVuY3Rpb24nICYmIGRlZmluZS5hbWQpIHtcbiAgICAgICAgZGVmaW5lKGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgcmV0dXJuIE1vdXNldHJhcDtcbiAgICAgICAgfSk7XG4gICAgfVxufSkgKHR5cGVvZiB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gd2luZG93IDogbnVsbCwgdHlwZW9mICB3aW5kb3cgIT09ICd1bmRlZmluZWQnID8gZG9jdW1lbnQgOiBudWxsKTtcbiIsInZhciBtID0gcmVxdWlyZSgnLi9tYXRyaXgnKVxudmFyIG1vdXNldHJhcCA9IHJlcXVpcmUoJ21vdXNldHJhcCcpXG52YXIgeyBtYWtlTW9kZWwsIGRyYXdNb2RlbCB9ID0gcmVxdWlyZSgnLi9tb2RlbHMnKVxuXG52YXIgYXF1YXJpdW1TaXplID0ge1xuICB4OiAxMCAqIDAuOCxcbiAgeTogNyAqIDAuNyxcbiAgejogMTAgKiAwLjgsXG59XG5cbnZhciBhcXVhcml1bVNpemVPcmkgPSB7XG4gIHg6IDEwLFxuICB5OiA3LFxuICB6OiAxMCxcbn1cblxuZnVuY3Rpb24gdG9SYWQoYW5nbGUpIHtcbiAgcmV0dXJuIGFuZ2xlICogTWF0aC5QSSAvIDE4MC4wXG59XG5cbmZ1bmN0aW9uIHRpbWVOb3coKSB7XG4gIHJldHVybiBuZXcgRGF0ZSgpLmdldFRpbWUoKSAvIDEwMDAuMFxufVxuXG52YXIgZmlzaGVzID0gW11cbnZhciB0dXJuVGltZSA9IDEwXG52YXIgY3VycmVudFZpZXdGaXNoID0gMFxudmFyIGZpc2hWaWV3T24gPSBmYWxzZVxuXG5tb3VzZXRyYXAuYmluZCgnbGVmdCcsICAoKSA9PiBjdXJyZW50Vmlld0Zpc2ggPSAoZmlzaGVzLmxlbmd0aCArIGN1cnJlbnRWaWV3RmlzaCArIDEpICUgZmlzaGVzLmxlbmd0aClcbm1vdXNldHJhcC5iaW5kKCdyaWdodCcsICgpID0+IGN1cnJlbnRWaWV3RmlzaCA9IChmaXNoZXMubGVuZ3RoICsgY3VycmVudFZpZXdGaXNoIC0gMSkgJSBmaXNoZXMubGVuZ3RoKVxuXG5mdW5jdGlvbiBmaXNoRnJvbnQoKSB7XG4gIHZhciBmaXNoID0gZmlzaGVzW2N1cnJlbnRWaWV3RmlzaF1cbiAgdmFyIHggPSBmaXNoLmxvb2t4IC0gZmlzaC54XG4gIHZhciB5ID0gZmlzaC5sb29reSAtIGZpc2gueVxuICB2YXIgeiA9IGZpc2gubG9va3ogLSBmaXNoLnpcbiAgdmFyIG1hZ25pdHVkZSA9IE1hdGguc3FydCh4KnggKyB5KnkgKyB6KnopXG4gIGZpc2gueCArPSAwLjA1ICogeCAvIG1hZ25pdHVkZVxuICBmaXNoLnkgKz0gMC4wNSAqIHkgLyBtYWduaXR1ZGVcbiAgZmlzaC56ICs9IDAuMDUgKiB6IC8gbWFnbml0dWRlXG4gIGZpc2gubG9va3ggKz0gMC4wNSAqIHggLyBtYWduaXR1ZGVcbiAgZmlzaC5sb29reSArPSAwLjA1ICogeSAvIG1hZ25pdHVkZVxuICBmaXNoLmxvb2t6ICs9IDAuMDUgKiB6IC8gbWFnbml0dWRlXG59XG5cbmZ1bmN0aW9uIGZpc2hMZWZ0KCkge1xuICB2YXIgZmlzaCA9IGZpc2hlc1tjdXJyZW50Vmlld0Zpc2hdXG4gIHZhciByID0gKGZpc2gueCAtIGZpc2gubG9va3gpKihmaXNoLnggLSBmaXNoLmxvb2t4KSArIChmaXNoLnogLSBmaXNoLmxvb2t6KSooZmlzaC56IC0gZmlzaC5sb29reilcbiAgciA9IE1hdGguc3FydChyKVxuICB2YXIgdGhldGEgPSBNYXRoLmF0YW4yKGZpc2gueiAtIGZpc2gubG9va3osIGZpc2gueCAtIGZpc2gubG9va3gpXG4gIHRoZXRhIC09IDAuMDJcbiAgZmlzaC5sb29reCA9IGZpc2gueCArIHIgKiBNYXRoLmNvcyh0aGV0YSlcbiAgZmlzaC5sb29reiA9IGZpc2gueiArIHIgKiBNYXRoLnNpbih0aGV0YSlcbn1cblxuZnVuY3Rpb24gZmlzaFJpZ2h0KCkge1xuICB2YXIgZmlzaCA9IGZpc2hlc1tjdXJyZW50Vmlld0Zpc2hdXG4gIHZhciByID0gKGZpc2gueCAtIGZpc2gubG9va3gpKihmaXNoLnggLSBmaXNoLmxvb2t4KSArIChmaXNoLnogLSBmaXNoLmxvb2t6KSooZmlzaC56IC0gZmlzaC5sb29reilcbiAgciA9IE1hdGguc3FydChyKVxuICB2YXIgdGhldGEgPSBNYXRoLmF0YW4yKGZpc2gueiAtIGZpc2gubG9va3osIGZpc2gueCAtIGZpc2gubG9va3gpXG4gIHRoZXRhICs9IDAuMDJcbiAgZmlzaC5sb29reCA9IGZpc2gueCArIHIgKiBNYXRoLmNvcyh0aGV0YSlcbiAgZmlzaC5sb29reiA9IGZpc2gueiArIHIgKiBNYXRoLnNpbih0aGV0YSlcbn1cblxuZnVuY3Rpb24gRmlzaCh4LCB5LCB6LCBsb29reCwgbG9va3ksIGxvb2t6LCBhbGl2ZSwgdHlwZSwgaWQsIHNjYWxlLCBsYXN0VHVyblRpbWUsIHRyaWdnZXJSZXZlcnNlLCBhbmdsZXkpIHtcbiAgcmV0dXJuIHtcbiAgICB4LFxuICAgIHksXG4gICAgeixcbiAgICBsb29reCxcbiAgICBsb29reSxcbiAgICBsb29reixcbiAgICBhbGl2ZSxcbiAgICB0eXBlLFxuICAgIGlkLFxuICAgIHNjYWxlLFxuICAgIGxhc3RUdXJuVGltZSxcbiAgICB0cmlnZ2VyUmV2ZXJzZSxcbiAgICBhbmdsZXlcbiAgICAvLyB0ZW1wTG9vayxcbiAgICAvLyBpc1JvdGF0aW5nLFxuICB9XG59XG5cbmZ1bmN0aW9uIGN5Y2xlRmlzaCgpIHtcbiAgZmlzaFZpZXdPbiA9IHRydWVcbiAgdmFyIHRlbXAgPSBbZmlzaGVzW2N1cnJlbnRWaWV3RmlzaF0ueCwgZmlzaGVzW2N1cnJlbnRWaWV3RmlzaF0ueSwgZmlzaGVzW2N1cnJlbnRWaWV3RmlzaF0uel1cbiAgdmFyIHJldCA9IHRlbXAuY29uY2F0KFtmaXNoZXNbY3VycmVudFZpZXdGaXNoXS5sb29reCwgZmlzaGVzW2N1cnJlbnRWaWV3RmlzaF0ubG9va3ksIGZpc2hlc1tjdXJyZW50Vmlld0Zpc2hdLmxvb2t6XSlcbiAgLy8gY3VycmVudFZpZXdGaXNoID0gKGN1cnJlbnRWaWV3RmlzaCArIDEpICUgZmlzaGVzLmxlbmd0aFxuICByZXR1cm4gcmV0XG59XG5cbmZ1bmN0aW9uIGNhbmNlbEZpc2hWaWV3KCkge1xuICBjdXJyZW50Vmlld0Zpc2ggPSAwXG4gIGZpc2hWaWV3T24gPSBmYWxzZVxufVxuXG5mdW5jdGlvbiBpbml0RmlzaCAoKSB7XG4gIHZhciBmaXNoMSA9IEZpc2goMCwgMCwgMCwgMSwgMSwgMSwgdHJ1ZSwgMSwgMSwgWzAuNywgMC43LCAwLjddLCB0aW1lTm93KCksIDAsIDApXG4gIHZhciBmaXNoMiA9IEZpc2goMywgMywgMywgLTEsIC0xLCAtMSwgdHJ1ZSwgMiwgMiwgWzAuNywgMC43LCAwLjddLCB0aW1lTm93KCksIDAsIDApXG4gIHZhciBmaXNoMyA9IEZpc2goLTIsIC0yLCAtMiwgMSwgMCwgMCwgdHJ1ZSwgMywgMywgWzAuNywgMC43LCAwLjddLCB0aW1lTm93KCksIDAsIDApXG4gIHZhciBmaXNoNCA9IEZpc2goLTEsIDIsIC0yLCAwLCAwLCAxLCB0cnVlLCA0LCA0LCBbMC43LCAwLjcsIDAuN10sIHRpbWVOb3coKSwgMCwgMClcblxuICBmaXNoZXMgPSBbZmlzaDEsIGZpc2gyLCBmaXNoMywgZmlzaDRdXG5cbiAgZmlzaGVzLm1hcChmdW5jdGlvbiAoZmlzaCkge1xuICAgIG1ha2VNb2RlbCgnZmlzaCcgKyBmaXNoLnR5cGUudG9TdHJpbmcoKSwgJ2Fzc2V0cy9maXNoJyArIGZpc2gudHlwZSwgW2Zpc2gueCwgZmlzaC55LCBmaXNoLnpdLCBmaXNoLnNjYWxlKVxuICB9KVxuICBtYWtlTW9kZWwoJ2VnZycsICdhc3NldHMvZm9vZCcsIFswLCAwLCAwXSwgWzAuMywgMC4zLCAwLjNdKVxufVxuXG5mdW5jdGlvbiBmaXNoTW92ZVRvd2FyZHNGb29kKGZvb2R4LCBmb29keSwgZm9vZHopIHtcbiAgZmlzaGVzLm1hcChmdW5jdGlvbiAoZmlzaCkge1xuICAgIGZpc2gubG9va3ggPSBmb29keFxuICAgIGZpc2gubG9va3kgPSBmb29keVxuICAgIGZpc2gubG9va3ogPSBmb29kelxuICB9KVxufVxuXG5tb3VzZXRyYXAuYmluZCgnaycsIGZ1bmN0aW9uICgpIHtcbiAgZmlzaGVzLnNwbGljZShjdXJyZW50Vmlld0Zpc2ggfHwgMCwgMSk7XG4gIGN1cnJlbnRWaWV3RmlzaCA9IChjdXJyZW50Vmlld0Zpc2ggKyAxKSAlIGZpc2hlcy5sZW5ndGhcbn0pXG5cbnZhciBlZ2dEYXRhID0ge1xuICB0aW1lQmVmb3JlU2hyaW5rOiAzLFxuICBzdGFydFRpbWU6IDAsXG4gIGFjdGl2ZTogZmFsc2UsXG59XG5cbm1vdXNldHJhcC5iaW5kKCdlJywgZnVuY3Rpb24gKCkge1xuICBpZiAoIWVnZ0RhdGEuYWN0aXZlKSB7XG4gICAgbW9kZWxzLmVnZ1snY2VudGVyJ11bMF0gPSBmaXNoZXNbY3VycmVudFZpZXdGaXNoIHx8IDBdLnhcbiAgICBtb2RlbHMuZWdnWydjZW50ZXInXVsxXSA9IGZpc2hlc1tjdXJyZW50Vmlld0Zpc2ggfHwgMF0ueVxuICAgIG1vZGVscy5lZ2dbJ2NlbnRlciddWzJdID0gZmlzaGVzW2N1cnJlbnRWaWV3RmlzaCB8fCAwXS56XG4gICAgZWdnRGF0YS5hY3RpdmUgPSB0cnVlO1xuICAgIGVnZ0RhdGEuc3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLyAxMDAwLjBcbiAgfVxuICAvLyBjb25zb2xlLmxvZygnZWdncycpO1xufSlcblxuZnVuY3Rpb24gZHJhd0Zpc2goKSB7XG4gIGZpc2hlcy5tYXAoZnVuY3Rpb24gKGZpc2gsIGlkeCkge1xuICAgIGlmICgoIWZpc2hWaWV3T24pIHx8IChmaXNoVmlld09uICYmIChpZHggIT0gY3VycmVudFZpZXdGaXNoKSkpIHtcbiAgICAgIHZhciBtZmlzaCA9IG1vZGVsc1snZmlzaCcgKyBmaXNoLnR5cGUudG9TdHJpbmcoKV1cbiAgICAgIHZhciBlZ2dzID0gbW9kZWxzWydlZ2cnXVxuICAgICAgLy8gdmFyIHggPSBmaXNoLmxvb2t4IC0gZmlzaC54XG4gICAgICAvLyB2YXIgeSA9IGZpc2gubG9va3kgLSBmaXNoLnlcbiAgICAgIC8vIHZhciB6ID0gZmlzaC5sb29reiAtIGZpc2guelxuICAgICAgLy9cbiAgICAgIC8vIHZhciB0aGV0YSA9IE1hdGguYXRhbjIoeiwgeClcbiAgICAgIC8vIHZhciBwaGkgPSBNYXRoLmF0YW4yKHksIE1hdGguc3FydCh4KnggKyB6KnopKVxuICAgICAgLy8gY29uc29sZS5sb2coXCJISUlJSVwiLCB0aGV0YSwgcGhpKVxuICAgICAgTWF0cmljZXMubW9kZWwgPSBtLnNjYWxlKGZpc2guc2NhbGUpXG4gICAgICBNYXRyaWNlcy5tb2RlbCA9IG0ubXVsdGlwbHkobS5yb3RhdGVZKGZpc2guYW5nbGV5ICogTWF0aC5QSS8xODApLCBNYXRyaWNlcy5tb2RlbClcbiAgICAgIE1hdHJpY2VzLm1vZGVsID0gbS5tdWx0aXBseShtLmludmVyc2UobS5sb29rQXQoW2Zpc2gueCwgZmlzaC55LCBmaXNoLnpdLCBbLWZpc2gubG9va3gsIC1maXNoLmxvb2t5LCAtZmlzaC5sb29rel0sIFswLCAxLCAwXSkpLCBNYXRyaWNlcy5tb2RlbClcbiAgICAgIGRyYXdNb2RlbChtZmlzaCk7XG4gICAgfVxuXG4gICAgaWYgKGVnZ0RhdGEuYWN0aXZlKSB7XG4gICAgICBNYXRyaWNlcy5tb2RlbCA9IG0ubXVsdGlwbHkobS50cmFuc2xhdGUoZWdncy5jZW50ZXIpLCBtLnNjYWxlKGVnZ3Muc2NhbGUpKVxuICAgICAgZHJhd01vZGVsKGVnZ3MpXG4gICAgfVxuICB9KVxufVxuXG5mdW5jdGlvbiB1cGRhdGVGaXNoKCkge1xuXG4gIGZpc2hlcy5tYXAoZnVuY3Rpb24gKGZpc2gpIHtcbiAgICAvLyBpZihmaXNoLmlzUm90YXRpbmcpe1xuICAgIC8vICAgaWYoZmlzaC5pc1JvdGF0aW5nPT0xKXtcbiAgICAvLyAgICAgZmlzaC5sb29reCAtPSBmaXNoLnRlbXBMb29rIC8xMFxuICAgIC8vICAgfVxuICAgIC8vICAgZWxzZSBpZihmaXNoLmlzUm90YXRpbmcgPT0gMil7XG4gICAgLy8gICAgIGZpc2gubG9va3kgLT0gZmlzaC50ZW1wTG9vay8xMFxuICAgIC8vICAgfVxuICAgIC8vICAgZWxzZSBpZihmaXNoLmlzUm90YXRpbmcgPT0gMyl7XG4gICAgLy8gICAgIGZpc2gubG9va3ogLT0gZmlzaC50ZW1wTG9vay8xMFxuICAgIC8vICAgfVxuICAgIC8vICAgaWYoZmlzaC5sb29reCA9PSAtMSAqIGZpc2gudGVtcGxvb2sgfHwgZmlzaC5sb29reSA9PSAtMSAqIGZpc2gudGVtcGxvb2sgfHwgZmlzaC5sb29reiA9PSAtMSAqIGZpc2gudGVtcGxvb2spe1xuICAgIC8vICAgICBmaXNoLmlzUm90YXRpbmcgPSAwXG4gICAgLy8gICAgIGZpc2gudGVtcExvb2sgPSAwXG4gICAgLy8gICB9XG4gICAgLy8gfVxuICAgIC8vIGlmKCFmaXNoLmlzUm90YXRpbmcpIHtcblxuICAgICAgLy9XaWdnbGluZ1xuICAgICAgLy8gY29uc29sZS5sb2coZmlzaC5hbmdsZXksIGZpc2gudHJpZ2dlclJldmVyc2UpXG4gICAgICBpZihmaXNoLmFuZ2xleS50b0ZpeGVkKDEpIDw9IDEwICYmIGZpc2gudHJpZ2dlclJldmVyc2UgPT0gMSkge1xuICAgICAgICAgIGZpc2guYW5nbGV5ICs9IDE7XG4gICAgICAgICAgZmlzaC5hbmdsZXkgKz0gTWF0aC5yYW5kb20oKS8yO1xuICAgICAgICAgIGlmKGZpc2guYW5nbGV5LnRvRml4ZWQoMSkgPj0gMTApXG4gICAgICAgICAge1xuICAgICAgICAgICAgZmlzaC5hbmdsZXkgPSAxMDtcbiAgICAgICAgICAgIGZpc2gudHJpZ2dlclJldmVyc2UgPSAwO1xuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgaWYoZmlzaC5hbmdsZXkudG9GaXhlZCgxKSA+PSAtMTAgJiYgZmlzaC50cmlnZ2VyUmV2ZXJzZSA9PSAwKSB7XG4gICAgICAgIGZpc2guYW5nbGV5IC09IDE7XG4gICAgICAgIGZpc2guYW5nbGV5IC09IE1hdGgucmFuZG9tKCkvMjtcbiAgICAgICAgaWYoZmlzaC5hbmdsZXkudG9GaXhlZCgxKSA8PSAtMTApXG4gICAgICAgIHtcbiAgICAgICAgICBmaXNoLmFuZ2xleSA9IC0xMFxuICAgICAgICAgIGZpc2gudHJpZ2dlclJldmVyc2UgPSAxO1xuICAgICAgICB9XG4gICAgICB9XG5cblxuICAgICAgaWYgKGZpc2gueCA+PSBhcXVhcml1bVNpemUueCAtIDEuMiB8fCBmaXNoLnggPD0gLWFxdWFyaXVtU2l6ZS54ICsgMS4yKSB7XG4gICAgICAgIGZpc2gubG9va3ggPSAtMSAqIGZpc2gubG9va3hcbiAgICAgICAgLy8gZmlzaC5pc1JvdGF0aW5nID0gMVxuICAgICAgICAvLyBmaXNoLnRlbXBMb29rID0gZmlzaC5sb29reFxuICAgICAgfVxuICAgICAgaWYgKGZpc2gueSA+PSBhcXVhcml1bVNpemUueSAtIDEuMiB8fCBmaXNoLnkgPD0gLWFxdWFyaXVtU2l6ZS55ICsgMS4yKSB7XG4gICAgICAgIGZpc2gubG9va3kgPSAtMSAqIGZpc2gubG9va3lcbiAgICAgICAgLy8gZmlzaC5pc1JvdGF0aW5nID0gMlxuICAgICAgICAvLyBmaXNoLnRlbXBMb29rID0gZmlzaC5sb29reVxuICAgICAgfVxuICAgICAgaWYgKGZpc2gueiA+PSBhcXVhcml1bVNpemUueiAtIDEuMiB8fCBmaXNoLnogPD0gLWFxdWFyaXVtU2l6ZS56ICsgMS4yKSB7XG4gICAgICAgIGZpc2gubG9va3ogPSAtMSAqIGZpc2gubG9va3pcbiAgICAgICAgLy8gZmlzaC5pc1JvdGF0aW5nID0gM1xuICAgICAgICAvLyBmaXNoLnRlbXBMb29rID0gZmlzaC5sb29relxuICAgICAgfVxuICAgICAgaWYgKHRpbWVOb3coKSAtIGZpc2gubGFzdFR1cm5UaW1lIDw9IHR1cm5UaW1lKSB7XG4gICAgICAgIHZhciB4ID0gZmlzaC5sb29reCAtIGZpc2gueFxuICAgICAgICB2YXIgeSA9IGZpc2gubG9va3kgLSBmaXNoLnlcbiAgICAgICAgdmFyIHogPSBmaXNoLmxvb2t6IC0gZmlzaC56XG4gICAgICAgIHZhciBtYWduaXR1ZGUgPSBNYXRoLnNxcnQoeCp4ICsgeSp5ICsgeip6KVxuICAgICAgICBmaXNoLnggKz0gMC4wNyAqIHggLyBtYWduaXR1ZGVcbiAgICAgICAgZmlzaC55ICs9IDAuMDcgKiB5IC8gbWFnbml0dWRlXG4gICAgICAgIGZpc2gueiArPSAwLjA3ICogeiAvIG1hZ25pdHVkZVxuICAgICAgICBmaXNoLmxvb2t4ICs9IDAuMDcgKiB4IC8gbWFnbml0dWRlXG4gICAgICAgIGZpc2gubG9va3kgKz0gMC4wNyAqIHkgLyBtYWduaXR1ZGVcbiAgICAgICAgZmlzaC5sb29reiArPSAwLjA3ICogeiAvIG1hZ25pdHVkZVxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGZpc2gubG9va3ggPSBmaXNoLnggKyAzICogKE1hdGgucmFuZG9tKCkgLSAwLjUpXG4gICAgICAgIGZpc2gubG9va3kgPSBmaXNoLnkgKyAzICogKE1hdGgucmFuZG9tKCkgLSAwLjUpXG4gICAgICAgIGZpc2gubG9va3ogPSBmaXNoLnogKyAzICogKE1hdGgucmFuZG9tKCkgLSAwLjUpXG4gICAgICAgIGZpc2gubGFzdFR1cm5UaW1lID0gdGltZU5vdygpXG4gICAgICB9XG5cbiAgICAgIGlmIChmaXNoLnNjYWxlWzBdIDwgMC43KSBmaXNoLnNjYWxlWzBdID0gZmlzaC5zY2FsZVsxXSA9IGZpc2guc2NhbGVbMl0gPSBmaXNoLnNjYWxlWzBdICsgMC4wMDFcbiAgICAvLyB9XG4gIH0pXG5cbn1cblxuZnVuY3Rpb24gdXBkYXRlRWdnICgpIHtcbiAgaWYgKGVnZ0RhdGEuYWN0aXZlKSB7XG4gICAgaWYgKG1vZGVscy5lZ2dbJ2NlbnRlciddWzFdID49ICgtYXF1YXJpdW1TaXplLnkgKyAxKSkge1xuICAgICAgbW9kZWxzLmVnZ1snY2VudGVyJ11bMV0gLT0gMC4yO1xuICAgIH1cbiAgICBlbHNlIHtcbiAgICAgIHZhciB0aW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLyAxMDAwLjBcbiAgICAgIGlmICh0aW1lIC0gZWdnRGF0YS5zdGFydFRpbWUgPD0gZWdnRGF0YS50aW1lQmVmb3JlU2hyaW5rKSB7XG4gICAgICAgIGZvciAodmFyIGkgPSAwOyBpIDw9IDI7IGkrKykgbW9kZWxzLmVnZ1snc2NhbGUnXVtpXSAtPSAwLjAwOFxuICAgICAgfVxuICAgICAgZWxzZSB7XG4gICAgICAgIGZvciAodmFyIGogPSAwOyBqIDw9IDI7IGorKykgbW9kZWxzLmVnZ1snc2NhbGUnXVtqXSA9IDFcbiAgICAgICAgZWdnRGF0YS5hY3RpdmUgPSBmYWxzZVxuICAgICAgICB2YXIgZmlzaDUgPSBGaXNoKG1vZGVscy5lZ2dbJ2NlbnRlciddWzBdLCBtb2RlbHMuZWdnWydjZW50ZXInXVsxXSAtIDEsIG1vZGVscy5lZ2dbJ2NlbnRlciddWzJdLCAtMSwgLTEsIC0xLCB0cnVlLCAyLCAyLCBbMC4xLCAwLjEsIDAuMV0sIHRpbWVOb3coKSwgMCwgMCk7XG4gICAgICAgIGZpc2hlcy5wdXNoKGZpc2g1KTtcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgbW9kZWxzLmVnZ1snY2VudGVyJ11bMV0gPSBhcXVhcml1bVNpemUueSAtIDFcbiAgfVxufVxuXG5tb2R1bGUuZXhwb3J0cyA9IHtcbiAgaW5pdEZpc2gsXG4gIGRyYXdGaXNoLFxuICB1cGRhdGVGaXNoLFxuICBjeWNsZUZpc2gsXG4gIGNhbmNlbEZpc2hWaWV3LFxuICBmaXNoTW92ZVRvd2FyZHNGb29kLFxuICBhcXVhcml1bVNpemU6IGFxdWFyaXVtU2l6ZU9yaSxcbiAgdXBkYXRlRWdnLFxuICBmaXNoRnJvbnQsXG4gIGZpc2hMZWZ0LFxuICBmaXNoUmlnaHQsXG59XG4iLCJ2YXIgc2hhZGVycyA9IHJlcXVpcmUoJy4vc2hhZGVycycpXG52YXIgeyBkcmF3TW9kZWwsIG1ha2VNb2RlbCwgZHJhd0xpZ2h0IH0gPSByZXF1aXJlKCcuL21vZGVscycpXG52YXIgbSA9IHJlcXVpcmUoJy4vbWF0cml4JylcbnZhciB2ZWMgPSByZXF1aXJlKCcuL3ZlY3RvcicpXG52YXIgd2VlZFN0YXJ0ID0gMDtcbnZhciBtb3ZlcG9zaXRpdmV4ID0gMTtcbnZhciBwZWJibGVzTiA9IDE1O1xuXG52YXIgeyBpbml0RmlzaCwgZHJhd0Zpc2gsIHVwZGF0ZUZpc2gsIGN5Y2xlRmlzaCwgY2FuY2VsRmlzaFZpZXcsIGZpc2hNb3ZlVG93YXJkc0Zvb2QsIGFxdWFyaXVtU2l6ZSwgdXBkYXRlRWdnLCBmaXNoRnJvbnQsIGZpc2hMZWZ0LCBmaXNoUmlnaHQgfSA9IHJlcXVpcmUoJy4vZmlzaCcpXG52YXIgZmlzaE1vdmluZ1Rvd2FyZHNGb29kID0gZmFsc2VcblxuXG52YXIgbW91c2V0cmFwID0gcmVxdWlyZSgnbW91c2V0cmFwJylcblxubW91c2V0cmFwLmJpbmQoJ2MnLCBmdW5jdGlvbiAoKSB7XG4gIGlmICghQ2FtZXJhLmZpc2hWaWV3KSB7XG4gICAgQ2FtZXJhLm1vdXNlVXBkYXRlID0gIUNhbWVyYS5tb3VzZVVwZGF0ZTtcbiAgfVxufSlcblxubW91c2V0cmFwLmJpbmQoJ2YnLCBmdW5jdGlvbiAoKSB7XG4gIC8vIENhbWVyYS5maXNoTGVucyA9ICFDYW1lcmEuZmlzaExlbnM7XG4gIC8vIGNvbnNvbGUubG9nKCdCSUlJSUknLCBDYW1lcmEpXG4gIGlmICghQ2FtZXJhLmZpc2hWaWV3KSB7XG4gICAgQ2FtZXJhLmZpc2hWaWV3ID0gdHJ1ZVxuICB9XG4gIGVsc2Uge1xuICAgIGNhbmNlbEZpc2hWaWV3KClcbiAgICBDYW1lcmEuZmlzaFZpZXcgPSBmYWxzZVxuICB9XG59KVxuXG5tb3VzZXRyYXAuYmluZCgndicsIGZ1bmN0aW9uICgpIHtcbiAgLy8gQ2FtZXJhLmZpc2hMZW5zID0gIUNhbWVyYS5maXNoTGVucztcbiAgLy8gY29uc29sZS5sb2coJ0JJSUlJSScsIENhbWVyYSlcbiAgQ2FtZXJhLmZpc2hMZW5zID0gIUNhbWVyYS5maXNoTGVuc1xufSlcblxubW91c2V0cmFwLmJpbmQoJ3MnLCBmdW5jdGlvbiAoKSB7XG4gIGlmICghQ2FtZXJhLmZpc2hWaWV3KSB7XG4gICAgdmFyIHhkID0gQ2FtZXJhLmxvb2t4IC0gQ2FtZXJhLnhcbiAgICB2YXIgeWQgPSBDYW1lcmEubG9va3kgLSBDYW1lcmEueVxuICAgIHZhciB6ZCA9IENhbWVyYS5sb29reiAtIENhbWVyYS56XG4gICAgdmFyIG1hZ25pdHVkZSA9IE1hdGguc3FydCh4ZCp4ZCArIHlkKnlkICsgemQqemQpXG4gICAgQ2FtZXJhLnggLT0gMC44ICogeGQgLyBtYWduaXR1ZGVcbiAgICBDYW1lcmEueSAtPSAwLjggKiB5ZCAvIG1hZ25pdHVkZVxuICAgIENhbWVyYS56IC09IDAuOCAqIHpkIC8gbWFnbml0dWRlXG4gICAgdXBkYXRlQ2FtZXJhVGFyZ2V0KClcbiAgfVxufSlcblxubW91c2V0cmFwLmJpbmQoJ3cnLCBmdW5jdGlvbigpIHtcbiAgaWYgKCFDYW1lcmEuZmlzaFZpZXcpIHtcbiAgICB2YXIgeGQgPSBDYW1lcmEubG9va3ggLSBDYW1lcmEueFxuICAgIHZhciB5ZCA9IENhbWVyYS5sb29reSAtIENhbWVyYS55XG4gICAgdmFyIHpkID0gQ2FtZXJhLmxvb2t6IC0gQ2FtZXJhLnpcbiAgICB2YXIgbWFnbml0dWRlID0gTWF0aC5zcXJ0KHhkKnhkICsgeWQqeWQgKyB6ZCp6ZClcbiAgICBDYW1lcmEueCArPSAwLjggKiB4ZCAvIG1hZ25pdHVkZVxuICAgIENhbWVyYS55ICs9IDAuOCAqIHlkIC8gbWFnbml0dWRlXG4gICAgQ2FtZXJhLnogKz0gMC44ICogemQgLyBtYWduaXR1ZGVcbiAgICB1cGRhdGVDYW1lcmFUYXJnZXQoKVxuICB9IGVsc2Uge1xuICAgIGZpc2hGcm9udCgpXG4gIH1cbn0pXG5cbm1vdXNldHJhcC5iaW5kKCdhJywgZnVuY3Rpb24oKSB7XG4gIGlmIChDYW1lcmEuZmlzaFZpZXcpIHtcbiAgICBmaXNoTGVmdCgpXG4gIH1cbn0pXG5cbm1vdXNldHJhcC5iaW5kKCdkJywgZnVuY3Rpb24oKSB7XG4gIGlmIChDYW1lcmEuZmlzaFZpZXcpIHtcbiAgICBmaXNoUmlnaHQoKVxuICB9XG59KVxuXG5mdW5jdGlvbiB1cGRhdGVDYW1lcmFUYXJnZXQoZSkge1xuICBpZiAoIUNhbWVyYS5tb3VzZVVwZGF0ZSB8fCBDYW1lcmEuZmlzaFZpZXcpIHJldHVybjtcbiAgdmFyIHJlY3QgPSB3aW5kb3cuY2FudmFzLmdldEJvdW5kaW5nQ2xpZW50UmVjdCgpO1xuICBpZiAoZSkge1xuICAgIENhbWVyYS5tb3VzZVggPSBlLmNsaWVudFg7XG4gICAgQ2FtZXJhLm1vdXNlWSA9IGUuY2xpZW50WTtcbiAgfVxuICB2YXIgeCA9IENhbWVyYS5tb3VzZVggLSByZWN0LmxlZnQsIHkgPSBDYW1lcmEubW91c2VZIC0gcmVjdC50b3BcbiAgeCA9IHggLSAod2luZG93LmNhbnZhcy53aWR0aCAvIDIuMCksIHkgPSAod2luZG93LmNhbnZhcy5oZWlnaHQgLyAyLjApIC0geVxuXG4gIHZhciB0aGV0YSA9ICgtMTgwLjAgLyB3aW5kb3cuY2FudmFzLmhlaWdodCkgKiB5ICsgOTAuMFxuICB2YXIgcGhpID0gKDM2MC4wIC8gd2luZG93LmNhbnZhcy53aWR0aCkgKiB4ICsgMTgwLjBcblxuICB2YXIgZHggPSAxICogTWF0aC5zaW4odG9SYWRpYW5zKHRoZXRhKSkgKiBNYXRoLmNvcyh0b1JhZGlhbnMocGhpKSlcbiAgdmFyIGR5ID0gMSAqIE1hdGguY29zKHRvUmFkaWFucyh0aGV0YSkpXG4gIHZhciBkeiA9IDEgKiBNYXRoLnNpbih0b1JhZGlhbnModGhldGEpKSAqIE1hdGguc2luKHRvUmFkaWFucyhwaGkpKVxuXG4gIENhbWVyYS5sb29reCA9IENhbWVyYS54ICsgZHhcbiAgQ2FtZXJhLmxvb2t5ID0gQ2FtZXJhLnkgKyBkeVxuICBDYW1lcmEubG9va3ogPSBDYW1lcmEueiArIGR6XG59XG5cbnZhciBidWJibGVzID0ge1xuICBhY3RpdmVCdWJibGVzOiBbXSxcbiAgbnVtOiAwXG59XG5cbnZhciBmb29kRGF0YSA9IHtcbiAgdGltZUJlZm9yZVNocmluazogMyxcbiAgc3RhcnRUaW1lOiAwLFxuICBhY3RpdmU6IGZhbHNlLFxufVxuXG52YXIgQ2FtZXJhID0ge1xuICB4OiAxOSxcbiAgeTogOSxcbiAgejogMTIsXG4gIGxvb2t4OiAwLFxuICBsb29reTogMCxcbiAgbG9va3o6IDAsXG4gIG1vdXNlVXBkYXRlOiB0cnVlLFxuICBmaXNoTGVuczogZmFsc2UsXG4gIGZpc2hWaWV3OiBmYWxzZSxcbiAgbW91c2VYOiAwLFxuICBtb3VzZVk6IDAsXG59XG5cbmZ1bmN0aW9uIHRvUmFkaWFucyAoYW5nbGUpIHtcbiAgcmV0dXJuIGFuZ2xlICogKE1hdGguUEkgLyAxODApO1xufVxuXG4vLyB3aW5kb3cuJCA9IHJlcXVpcmUoJ2pxdWVyeScpXG53aW5kb3cuTWF0cmljZXMgPSB7fVxud2luZG93Lm1vZGVscyA9IHt9XG5cbmZ1bmN0aW9uIHJlc2l6ZUNhbnZhcygpIHtcbiAgY2FudmFzLmhlaWdodCA9IGNhbnZhcy53aWR0aCA9IE1hdGgubWluKCQoZG9jdW1lbnQpLmhlaWdodCgpLCAkKGRvY3VtZW50KS53aWR0aCgpKVxufVxuXG5mdW5jdGlvbiBJbml0aWFsaXplKClcbntcbiAgZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ2JhY2thdWRpbycpLnBsYXkoKVxuICB3aW5kb3cuY2FudmFzID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoXCJjYW52YXNcIik7XG4gIHJlc2l6ZUNhbnZhcygpO1xuICB3aW5kb3cuYWRkRXZlbnRMaXN0ZW5lcigncmVzaXplJywgcmVzaXplQ2FudmFzKVxuXG4gIHdpbmRvdy5jYW52YXMub25jb250ZXh0bWVudSA9IGZ1bmN0aW9uKCkge1xuICAgIGJ1YmJsZXMubnVtKytcbiAgICBidWJibGVzLmFjdGl2ZUJ1YmJsZXMucHVzaChidWJibGVzLm51bSlcbiAgICB2YXIgeCA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqICgyKmFxdWFyaXVtU2l6ZS54ICsgMSkgLSBhcXVhcml1bVNpemUueClcbiAgICB2YXIgeiA9IE1hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqICgyKmFxdWFyaXVtU2l6ZS56ICsgMSkgLSBhcXVhcml1bVNpemUueilcbiAgICBtYWtlTW9kZWwoJ2J1YmJsZScgKyBidWJibGVzLm51bS50b1N0cmluZygpLCAnYXNzZXRzL2J1YmJsZScsIFt4LCAtYXF1YXJpdW1TaXplLnkgKyAyLCB6XSwgWzAuMywgMC4zLCAwLjNdKVxuXG4gICAgcmV0dXJuIGZhbHNlXG4gIH1cblxuICB3aW5kb3cuY2FudmFzLm9ubW91c2Vtb3ZlID0gdXBkYXRlQ2FtZXJhVGFyZ2V0XG5cbiAgd2luZG93LmNhbnZhcy5vbmNsaWNrID0gZnVuY3Rpb24gKCkge1xuICAgIGlmICghZm9vZERhdGEuYWN0aXZlKSB7XG4gICAgICBtb2RlbHMuZm9vZFsnY2VudGVyJ11bMF0gPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAoMiphcXVhcml1bVNpemUueCArIDEgLSAxLjYpIC0gYXF1YXJpdW1TaXplLngpXG4gICAgICBtb2RlbHMuZm9vZFsnY2VudGVyJ11bMl0gPSBNYXRoLmZsb29yKE1hdGgucmFuZG9tKCkgKiAoMiphcXVhcml1bVNpemUueiArIDEgLSAxLjYpIC0gYXF1YXJpdW1TaXplLnopXG4gICAgICBmb29kRGF0YS5hY3RpdmUgPSB0cnVlO1xuICAgICAgZm9vZERhdGEuc3RhcnRUaW1lID0gbmV3IERhdGUoKS5nZXRUaW1lKCkgLyAxMDAwLjBcbiAgICAgIGZpc2hNb3ZpbmdUb3dhcmRzRm9vZCA9IHRydWVcbiAgICAgIGZpc2hNb3ZlVG93YXJkc0Zvb2QoKVxuICAgIH1cbiAgfVxuXG4gIHdpbmRvdy5nbCA9IGNhbnZhcy5nZXRDb250ZXh0KFwiZXhwZXJpbWVudGFsLXdlYmdsXCIpO1xuICBnbC5jbGVhckNvbG9yKDAuMCwgMC4wLCAwLjAsIDEuMCk7XG5cbiAgLy8gc2V0dXAgYSBHTFNMIHByb2dyYW1cbiAgc2hhZGVycy5jcmVhdGVTaGFkZXIoJ21hdGVyaWFsJylcblxuICAvLyBtYWtlTW9kZWwoJ3RhYmxlJywnYXNzZXRzL1RhYmxlJyxbMCwgLWFxdWFyaXVtU2l6ZS55KjIuNywgLTJdLFsxMiw4LDEwXSlcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHBlYmJsZXNOOyBpKyspIHtcbiAgICBtYWtlTW9kZWwoJ3BlYmJsZScraSwgJ2Fzc2V0cy9wZWJibGUnLCBbLWFxdWFyaXVtU2l6ZS54KjAuOSsxLjgqYXF1YXJpdW1TaXplLngqTWF0aC5yYW5kb20oKSwtYXF1YXJpdW1TaXplLnkrMC4xLCAtYXF1YXJpdW1TaXplLnoqMC45KzEuOCphcXVhcml1bVNpemUueipNYXRoLnJhbmRvbSgpXSwgWzAuNCwgMC40LCAwLjRdKVxuICB9XG5cbiAgbWFrZU1vZGVsKCdyb2NrJywgJ2Fzc2V0cy9yb2NrJyxbNiwtYXF1YXJpdW1TaXplLnkrMSw2XSxbMC40LDAuNCwwLjRdKVxuXG4gIG1ha2VNb2RlbCgnd2FsbCcsICdhc3NldHMvd2FsbCcsIFswLCAwLCAwXSwgWzMwLCAzMCwgMzBdKVxuXG4gIG1ha2VNb2RlbCgnbGlnaHQnLCAnYXNzZXRzL2N1YmUnLCBbMjgsIDI1LCAwXSwgWzEsIDEsIDRdKVxuXG4gIG1ha2VNb2RlbCgnZmlzaCcsICdhc3NldHMvZmlzaCcsIFswLCAwLCAwXSlcbiAgbWFrZU1vZGVsKCd4YXhpcycsICdhc3NldHMvY3ViZScsIFsxLCAwLCAwXSwgWzEsIDAuMSwgMC4xXSlcbiAgbWFrZU1vZGVsKCd5YXhpcycsICdhc3NldHMvY3ViZScsIFswLCAxLCAwXSwgWzAuMSwgMSwgMC4xXSlcbiAgbWFrZU1vZGVsKCdhcXVhcml1bScsICdhc3NldHMvYXF1YXJpdW0nLCBbMCwgMCwgMF0sIFthcXVhcml1bVNpemUueCwgYXF1YXJpdW1TaXplLnksIGFxdWFyaXVtU2l6ZS56XSlcbiAgbWFrZU1vZGVsKCdzYW5kJywgJ2Fzc2V0cy9zYW5kJywgWzAsIC1hcXVhcml1bVNpemUueS0xLCAwXSwgW2FxdWFyaXVtU2l6ZS54LCAtMSwgYXF1YXJpdW1TaXplLnpdKVxuICBtYWtlTW9kZWwoJ21ldGFsJywgJ2Fzc2V0cy9tZXRhbCcsIFswLCBhcXVhcml1bVNpemUueSswLjIsIDBdLCBbYXF1YXJpdW1TaXplLngsIDAuMiwgYXF1YXJpdW1TaXplLnpdKVxuICBtYWtlTW9kZWwoJ3RhYmxlJywgJ2Fzc2V0cy90YWJsZScsIFswLCAtKDI2LWFxdWFyaXVtU2l6ZS55KSwgMF0sIFsxLjUqYXF1YXJpdW1TaXplLngsICgyOC1hcXVhcml1bVNpemUueSksIDIuNSphcXVhcml1bVNpemUuel0pXG4gIG1ha2VNb2RlbCgnd2VlZCcsICdhc3NldHMvd2VlZCcsIFstIGFxdWFyaXVtU2l6ZS54KzMuMiwgLSBhcXVhcml1bVNpemUueSwgMV0sIFswLjA0LCAwLjA0LCAwLjA0XSlcbiAgbWFrZU1vZGVsKCdzaGlwJywgJ2Fzc2V0cy9zaGlwJywgWzEuNSwtYXF1YXJpdW1TaXplLnkrMC4zLCAtYXF1YXJpdW1TaXplLnoqMC43XSwgWzIsIDIsIDJdKVxuICBtYWtlTW9kZWwoJ2Zvb2QnLCAnYXNzZXRzL2Zvb2QnLCBbMCwgMCwgMF0sIFsxLCAxLCAxXSlcblxuICBtYWtlTW9kZWwoJ2N1YmV0ZXgnLCAnYXNzZXRzL2N1YmV0ZXgnLCBbMTUsIDEwLCA1XSlcblxuICBpbml0RmlzaCgpXG5cbiAgdGljaygpO1xufVxud2luZG93LkluaXRpYWxpemUgPSBJbml0aWFsaXplXG5cbndpbmRvdy5DYW1lcmEgPSBDYW1lcmFcblxudmFyIGxhc3RUaW1lID0gMDtcbmZ1bmN0aW9uIGFuaW1hdGUoKSB7XG4gIHZhciB0aW1lTm93ID0gbmV3IERhdGUoKS5nZXRUaW1lKCk7XG4gIGlmIChsYXN0VGltZSA9PSAwKSB7IGxhc3RUaW1lID0gdGltZU5vdzsgcmV0dXJuOyB9XG4gIC8vIHZhciBkID0gKHRpbWVOb3cgLSBsYXN0VGltZSkgLyA1MDtcbiAgdXBkYXRlRmlzaFZpZXcoKTtcbiAgdXBkYXRlQ2FtZXJhKCk7XG4gIHVwZGF0ZUJ1YmJsZXMoKTtcbiAgdGlja1dlZWQoKTtcbiAgdXBkYXRlRm9vZCgpO1xuICB1cGRhdGVGaXNoKCk7XG4gIHVwZGF0ZUVnZygpO1xuICBsYXN0VGltZSA9IHRpbWVOb3c7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUZpc2hWaWV3KCkge1xuICBpZiAoQ2FtZXJhLmZpc2hWaWV3KSB7XG4gICAgdmFyIGV5ZXRhcmdldCA9IGN5Y2xlRmlzaCgpXG4gICAgLy8gY29uc29sZS5sb2coZXlldGFyZ2V0KVxuICAgIENhbWVyYS54ID0gZXlldGFyZ2V0WzBdLCBDYW1lcmEueSA9IGV5ZXRhcmdldFsxXSwgQ2FtZXJhLnogPSBleWV0YXJnZXRbMl1cbiAgICBDYW1lcmEubG9va3ggPSBleWV0YXJnZXRbM10sIENhbWVyYS5sb29reSA9IGV5ZXRhcmdldFs0XSwgQ2FtZXJhLmxvb2t6ID0gZXlldGFyZ2V0WzVdXG4gIH1cbn1cblxuZnVuY3Rpb24gdXBkYXRlQnViYmxlcygpIHtcbiAgYnViYmxlcy5hY3RpdmVCdWJibGVzLm1hcChmdW5jdGlvbiAobiwgaSkge1xuICAgIHZhciBidWJibGUgPSBtb2RlbHNbJ2J1YmJsZScgKyBuLnRvU3RyaW5nKCldXG4gICAgdmFyIHkgPSBidWJibGVbJ2NlbnRlciddWzFdXG5cbiAgICBpZiAoeSA8PSBhcXVhcml1bVNpemUueSAtIDAuOCkge1xuICAgICAgYnViYmxlWydjZW50ZXInXVsxXSArPSAwLjJcbiAgICB9XG4gICAgZWxzZSB7XG4gICAgICBidWJibGVzLmFjdGl2ZUJ1YmJsZXMuc3BsaWNlKGksIDEpXG4gICAgfVxuICB9KVxufVxuXG5mdW5jdGlvbiB1cGRhdGVGb29kICgpIHtcbiAgaWYgKGZvb2REYXRhLmFjdGl2ZSkge1xuICAgIGlmIChmaXNoTW92aW5nVG93YXJkc0Zvb2QpIHtcbiAgICAgIGZpc2hNb3ZlVG93YXJkc0Zvb2QobW9kZWxzLmZvb2RbJ2NlbnRlciddWzBdLCBtb2RlbHMuZm9vZFsnY2VudGVyJ11bMV0sIG1vZGVscy5mb29kWydjZW50ZXInXVsyXSlcbiAgICB9XG4gICAgaWYgKG1vZGVscy5mb29kWydjZW50ZXInXVsxXSA+PSAoLWFxdWFyaXVtU2l6ZS55ICsgMSkpIHtcbiAgICAgIG1vZGVscy5mb29kWydjZW50ZXInXVsxXSAtPSAwLjI7XG4gICAgfVxuICAgIGVsc2Uge1xuICAgICAgdmFyIHRpbWUgPSBuZXcgRGF0ZSgpLmdldFRpbWUoKSAvIDEwMDAuMFxuICAgICAgaWYgKHRpbWUgLSBmb29kRGF0YS5zdGFydFRpbWUgPD0gZm9vZERhdGEudGltZUJlZm9yZVNocmluaykge1xuICAgICAgICBmb3IgKHZhciBpID0gMDsgaSA8PSAyOyBpKyspIG1vZGVscy5mb29kWydzY2FsZSddW2ldIC09IDAuMDA4XG4gICAgICB9XG4gICAgICBlbHNlIHtcbiAgICAgICAgZm9yICh2YXIgaiA9IDA7IGogPD0gMjsgaisrKSBtb2RlbHMuZm9vZFsnc2NhbGUnXVtqXSA9IDFcbiAgICAgICAgZmlzaE1vdmluZ1Rvd2FyZHNGb29kID0gZmFsc2VcbiAgICAgICAgZm9vZERhdGEuYWN0aXZlID0gZmFsc2VcbiAgICAgIH1cbiAgICB9XG4gIH1cbiAgZWxzZSB7XG4gICAgbW9kZWxzLmZvb2RbJ2NlbnRlciddWzFdID0gYXF1YXJpdW1TaXplLnkgLSAxXG4gIH1cbn1cblxuZnVuY3Rpb24gdGlja1dlZWQoKSB7XG4gIHZhciB7IHdlZWQgfSA9IG1vZGVscztcblxuXG4gIGlmKHdlZWQuYW5nbGV4IDw9IDEwICYmIG1vdmVwb3NpdGl2ZXggPT0gMSkge1xuICAgIHdlZWQuYW5nbGV4ICs9IDAuMjtcbiAgICBpZih3ZWVkLmFuZ2xleCA+IDEwKVxuICAgIHtcbiAgICAgIG1vdmVwb3NpdGl2ZXggPSAwO1xuICAgIH1cbiAgfVxuICBpZih3ZWVkLmFuZ2xleCA+PSAtMTAgJiYgbW92ZXBvc2l0aXZleCA9PSAwKSB7XG4gICAgd2VlZC5hbmdsZXggLT0gMC4yO1xuICAgIGlmKHdlZWQuYW5nbGV4IDwgLTEwKVxuICAgIHtcbiAgICAgIG1vdmVwb3NpdGl2ZXggPSAxO1xuICAgIH1cbiAgfVxufVxuXG5mdW5jdGlvbiBkcmF3U2NlbmUoKSB7XG4gIHZhciB7IGFxdWFyaXVtLCBzYW5kLCBtZXRhbCwgc2hpcCB9ID0gbW9kZWxzO1xuICB2YXIgeyB3ZWVkLCB3YWxsLCBsaWdodCwgcm9jaywgZm9vZCwgdGFibGUgfSA9IG1vZGVscztcbiAgLy8gdmFyIHsgY3ViZXRleCB9ID0gbW9kZWxzXG4gIC8vY29uc29sZS5sb2coZmlzaFJvdGF0aW9uWSwgZmlzaFJvdGF0aW9uWCk7XG4gIGlmKCF3ZWVkU3RhcnQpXG4gIHtcbiAgICB3ZWVkLmFuZ2xleCA9IDBcbiAgICB3ZWVkLmFuZ2xleSA9IDBcbiAgICB3ZWVkLmFuZ2xleiA9IDBcbiAgICB3ZWVkU3RhcnQgPSAxO1xuICB9XG5cbiAgZ2wudmlld3BvcnQoMCwgMCwgY2FudmFzLndpZHRoLCBjYW52YXMuaGVpZ2h0KTtcbiAgZ2wuY2xlYXJDb2xvcigwLjEsIDAuMSwgMC4xLCAxLjApO1xuICBnbC5jbGVhcihnbC5DT0xPUl9CVUZGRVJfQklUIHwgZ2wuREVQVEhfQlVGRkVSX0JJVCk7XG4gIHNoYWRlcnMudXNlU2hhZGVyKCdtYXRlcmlhbCcpXG5cbiAgZ2wuZW5hYmxlKGdsLkRFUFRIX1RFU1QpO1xuICBnbC5kZXB0aEZ1bmMoZ2wuTEVRVUFMKTtcblxuICAvLyBNYXRyaWNlcy5tb2RlbCA9IG0ubXVsdGlwbHkobS50cmFuc2xhdGUoY3ViZXRleC5jZW50ZXIpLCBtLnNjYWxlKGN1YmV0ZXguc2NhbGUpKVxuICAvLyBkcmF3TW9kZWwoY3ViZXRleClcblxuICBNYXRyaWNlcy5tb2RlbCA9IG0uc2NhbGUod2VlZC5zY2FsZSlcbiAgTWF0cmljZXMubW9kZWwgPSBtLm11bHRpcGx5KE1hdHJpY2VzLm1vZGVsLCBtLnJvdGF0ZVgod2VlZC5hbmdsZXggKiBNYXRoLlBJIC8gMTgwKSk7XG4gIC8vY29uc29sZS5sb2cod2VlZC5jZW50ZXIpO1xuICBNYXRyaWNlcy5tb2RlbCA9IG0ubXVsdGlwbHkobS50cmFuc2xhdGUod2VlZC5jZW50ZXIpLCBNYXRyaWNlcy5tb2RlbCk7XG4gIGRyYXdNb2RlbCh3ZWVkKTtcblxuICBNYXRyaWNlcy5tb2RlbCA9IG0ubXVsdGlwbHkobS50cmFuc2xhdGUocm9jay5jZW50ZXIpLCBtLnNjYWxlKHJvY2suc2NhbGUpKVxuICBkcmF3TW9kZWwocm9jaylcblxuICBNYXRyaWNlcy5tb2RlbCA9IG0ubXVsdGlwbHkobS50cmFuc2xhdGUoc2FuZC5jZW50ZXIpLCBtLnNjYWxlKHNhbmQuc2NhbGUpKVxuICBkcmF3TW9kZWwoc2FuZClcblxuICBNYXRyaWNlcy5tb2RlbCA9IG0ubXVsdGlwbHkobS50cmFuc2xhdGUobWV0YWwuY2VudGVyKSwgbS5zY2FsZShtZXRhbC5zY2FsZSkpXG4gIGRyYXdNb2RlbChtZXRhbClcblxuICAvLyBNYXRyaWNlcy5tb2RlbCA9IG0uc2NhbGUodGFibGUuc2NhbGUpXG4gIC8vIC8vTWF0cmljZXMubW9kZWwgPSBtLm11bHRpcGx5KE1hdHJpY2VzLm1vZGVsLCBtLnJvdGF0ZVooMTAqTWF0aC5QSS8xODApKVxuICAvLyAvL01hdHJpY2VzLm1vZGVsID0gbS5tdWx0aXBseShNYXRyaWNlcy5tb2RlbCwgbS5yb3RhdGVYKDEqTWF0aC5QSS8xODApKVxuICAvLyBNYXRyaWNlcy5tb2RlbCA9IG0ubXVsdGlwbHkobS50cmFuc2xhdGUodGFibGUuY2VudGVyKSwgTWF0cmljZXMubW9kZWwpXG4gIC8vIGRyYXdNb2RlbCh0YWJsZSlcblxuICBmb3IgKGxldCBpID0gMDsgaSA8IHBlYmJsZXNOOyBpKyspIHtcbiAgICBsZXQgcGViYmxlID0gbW9kZWxzWydwZWJibGUnK2ldXG4gICAgTWF0cmljZXMubW9kZWwgPSBtLm11bHRpcGx5KG0udHJhbnNsYXRlKHBlYmJsZS5jZW50ZXIpLCBtLnNjYWxlKHBlYmJsZS5zY2FsZSkpXG4gICAgZHJhd01vZGVsKHBlYmJsZSlcbiAgfVxuXG4gIGJ1YmJsZXMuYWN0aXZlQnViYmxlcy5tYXAoZnVuY3Rpb24gKG4pIHtcbiAgICB2YXIgYnViYmxlID0gbW9kZWxzWydidWJibGUnICsgbi50b1N0cmluZygpXVxuICAgIE1hdHJpY2VzLm1vZGVsID0gbS5tdWx0aXBseShtLnRyYW5zbGF0ZShidWJibGUuY2VudGVyKSwgbS5zY2FsZShidWJibGUuc2NhbGUpKVxuICAgIGRyYXdNb2RlbChidWJibGUpXG4gIH0pXG5cbiAgTWF0cmljZXMubW9kZWwgPSBtLm11bHRpcGx5KG0udHJhbnNsYXRlKHdhbGwuY2VudGVyKSwgbS5zY2FsZSh3YWxsLnNjYWxlKSlcbiAgZHJhd01vZGVsKHdhbGwpXG5cbiAgTWF0cmljZXMubW9kZWwgPSBtLnJvdGF0ZVooTWF0aC5QSSoxNS8xODApXG4gIE1hdHJpY2VzLm1vZGVsID0gbS5tdWx0aXBseShtLnNjYWxlKHNoaXAuc2NhbGUpLCBNYXRyaWNlcy5tb2RlbClcbiAgTWF0cmljZXMubW9kZWwgPSBtLm11bHRpcGx5KG0udHJhbnNsYXRlKHNoaXAuY2VudGVyKSwgTWF0cmljZXMubW9kZWwpXG4gIGRyYXdNb2RlbChzaGlwKVxuXG4gIE1hdHJpY2VzLm1vZGVsID0gbS5tdWx0aXBseShtLnRyYW5zbGF0ZSh0YWJsZS5jZW50ZXIpLCBtLnNjYWxlKHRhYmxlLnNjYWxlKSlcbiAgZHJhd01vZGVsKHRhYmxlKVxuXG4gIE1hdHJpY2VzLm1vZGVsID0gbS5tdWx0aXBseShtLnRyYW5zbGF0ZShsaWdodC5jZW50ZXIpLCBtLnNjYWxlKGxpZ2h0LnNjYWxlKSlcbiAgZHJhd0xpZ2h0KGxpZ2h0KVxuXG4gIGlmIChmb29kRGF0YS5hY3RpdmUpIHtcbiAgICBNYXRyaWNlcy5tb2RlbCA9IG0ubXVsdGlwbHkobS50cmFuc2xhdGUoZm9vZC5jZW50ZXIpLCBtLnNjYWxlKGZvb2Quc2NhbGUpKVxuICAgIGRyYXdNb2RlbChmb29kKVxuICB9XG5cbiAgZHJhd0Zpc2goKVxuXG4gIGdsLmVuYWJsZShnbC5CTEVORCk7XG4gIGdsLmJsZW5kRnVuYyhnbC5PTkUsIGdsLk9ORSk7XG4gIGlmIChDYW1lcmEueCA+IGFxdWFyaXVtU2l6ZS54IHx8IENhbWVyYS54IDwgLWFxdWFyaXVtU2l6ZS54IHx8XG4gICAgICBDYW1lcmEueSA+IGFxdWFyaXVtU2l6ZS55IHx8IENhbWVyYS55IDwgLWFxdWFyaXVtU2l6ZS55IHx8XG4gICAgICBDYW1lcmEueiA+IGFxdWFyaXVtU2l6ZS56IHx8IENhbWVyYS56IDwgLWFxdWFyaXVtU2l6ZS56KSB7XG4gICAgZ2wuZW5hYmxlKGdsLkNVTExfRkFDRSk7XG4gIH1cbiAgTWF0cmljZXMubW9kZWwgPSBtLm11bHRpcGx5KG0udHJhbnNsYXRlKGFxdWFyaXVtLmNlbnRlciksIG0uc2NhbGUoYXF1YXJpdW0uc2NhbGUpKVxuICBkcmF3TW9kZWwoYXF1YXJpdW0pXG4gIGdsLmRpc2FibGUoZ2wuQ1VMTF9GQUNFKTtcbiAgZ2wuZGlzYWJsZShnbC5CTEVORCk7XG59XG5cbmZ1bmN0aW9uIHVwZGF0ZUNhbWVyYSgpIHtcbiAgdmFyIHVwID0gWzAsIDEsIDBdO1xuICB2YXIgZXllID0gW0NhbWVyYS54LCBDYW1lcmEueSwgQ2FtZXJhLnpdXG4gIHZhciB0YXJnZXQgPSBbQ2FtZXJhLmxvb2t4LCBDYW1lcmEubG9va3ksIENhbWVyYS5sb29rel1cbiAgTWF0cmljZXMudmlldyA9IG0ubG9va0F0KGV5ZSwgdGFyZ2V0LCB1cCk7XG4gIE1hdHJpY2VzLnByb2plY3Rpb24gPSBtLnBlcnNwZWN0aXZlKE1hdGguUEkvMiwgY2FudmFzLndpZHRoIC8gY2FudmFzLmhlaWdodCwgMC4xLCA1MDApO1xuICBnbC51bmlmb3JtTWF0cml4NGZ2KGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCBcInZpZXdcIiksIGZhbHNlLCBNYXRyaWNlcy52aWV3KTtcbiAgZ2wudW5pZm9ybU1hdHJpeDRmdihnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgXCJwcm9qZWN0aW9uXCIpLCBmYWxzZSwgTWF0cmljZXMucHJvamVjdGlvbik7XG4gIGdsLnVuaWZvcm0xaShnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgXCJpc0Zpc2hMZW5zXCIpLCBDYW1lcmEuZmlzaExlbnMgJiYgQ2FtZXJhLmZpc2hWaWV3KTtcbiAgLy8gcmV0dXJuIG0ubXVsdGlwbHkoTWF0cmljZXMucHJvamVjdGlvbiwgTWF0cmljZXMudmlldyk7XG5cbiAgdmFyIGxpZ2h0UG9zID0gbW9kZWxzLmxpZ2h0LmNlbnRlclxuICB2YXIgbGlnaHRQb3NMb2MgICAgPSBnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgXCJsaWdodC5wb3NpdGlvblwiKTtcbiAgdmFyIHZpZXdQb3NMb2MgICAgID0gZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIFwidmlld1Bvc1wiKTtcbiAgZ2wudW5pZm9ybTNmKGxpZ2h0UG9zTG9jLCBsaWdodFBvc1swXSwgbGlnaHRQb3NbMV0sIGxpZ2h0UG9zWzJdKTtcbiAgZ2wudW5pZm9ybTNmKHZpZXdQb3NMb2MsICBleWVbMF0sIGV5ZVsxXSwgZXllWzJdKTtcbiAgdmFyIGxpZ2h0Q29sb3IgPSBbXTtcbiAgbGlnaHRDb2xvclswXSA9IDE7XG4gIGxpZ2h0Q29sb3JbMV0gPSAxO1xuICBsaWdodENvbG9yWzJdID0gMTtcbiAgdmFyIGRpZmZ1c2VDb2xvciA9IHZlYy5tdWx0aXBseVNjYWxhcihsaWdodENvbG9yLCAwLjUpOyAvLyBEZWNyZWFzZSB0aGUgaW5mbHVlbmNlXG4gIHZhciBhbWJpZW50Q29sb3IgPSB2ZWMubXVsdGlwbHlTY2FsYXIoZGlmZnVzZUNvbG9yLCAxKTsgLy8gTG93IGluZmx1ZW5jZVxuICBnbC51bmlmb3JtM2YoZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIFwibGlnaHQuYW1iaWVudFwiKSwgIGFtYmllbnRDb2xvclswXSwgYW1iaWVudENvbG9yWzFdLCBhbWJpZW50Q29sb3JbMl0pO1xuICBnbC51bmlmb3JtM2YoZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIFwibGlnaHQuZGlmZnVzZVwiKSwgIGRpZmZ1c2VDb2xvclswXSwgZGlmZnVzZUNvbG9yWzFdLCBkaWZmdXNlQ29sb3JbMl0pO1xuICBnbC51bmlmb3JtM2YoZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIFwibGlnaHQuc3BlY3VsYXJcIiksIDEuMCwgMS4wLCAxLjApO1xufVxuXG5mdW5jdGlvbiB0aWNrKCkge1xuICB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lKHRpY2spO1xuICBpZiAoIXdpbmRvdy5wcm9ncmFtKSByZXR1cm47XG4gIGRyYXdTY2VuZSgpO1xuICBhbmltYXRlKCk7XG59XG4iLCJ2YXIgdmVjID0gcmVxdWlyZSgnLi92ZWN0b3InKVxuXG4vLyAwIDEgMiAzICAgICAgICAwIDEgMiAzXG4vLyA0IDUgNiA3ICAgICAgICA0IDUgNiA3XG4vLyA4IDkgMTAgMTEgICAgICA4IDkgMTAgMTFcbi8vIDEyIDEzIDE0IDE1ICAgIDEyIDEzIDE0IDE1XG5mdW5jdGlvbiBtYXRyaXhNdWx0aXBseShtYXQyLCBtYXQxKVxue1xuICByZXR1cm4gW1xuICAgIG1hdDFbMF0qbWF0MlswXSttYXQxWzFdKm1hdDJbNF0rbWF0MVsyXSptYXQyWzhdK21hdDFbM10qbWF0MlsxMl0sXG4gICAgbWF0MVswXSptYXQyWzFdK21hdDFbMV0qbWF0Mls1XSttYXQxWzJdKm1hdDJbOV0rbWF0MVszXSptYXQyWzEzXSxcbiAgICBtYXQxWzBdKm1hdDJbMl0rbWF0MVsxXSptYXQyWzZdK21hdDFbMl0qbWF0MlsxMF0rbWF0MVszXSptYXQyWzE0XSxcbiAgICBtYXQxWzBdKm1hdDJbM10rbWF0MVsxXSptYXQyWzddK21hdDFbMl0qbWF0MlsxMV0rbWF0MVszXSptYXQyWzE1XSxcbiAgICBtYXQxWzRdKm1hdDJbMF0rbWF0MVs1XSptYXQyWzRdK21hdDFbNl0qbWF0Mls4XSttYXQxWzddKm1hdDJbMTJdLFxuICAgIG1hdDFbNF0qbWF0MlsxXSttYXQxWzVdKm1hdDJbNV0rbWF0MVs2XSptYXQyWzldK21hdDFbN10qbWF0MlsxM10sXG4gICAgbWF0MVs0XSptYXQyWzJdK21hdDFbNV0qbWF0Mls2XSttYXQxWzZdKm1hdDJbMTBdK21hdDFbN10qbWF0MlsxNF0sXG4gICAgbWF0MVs0XSptYXQyWzNdK21hdDFbNV0qbWF0Mls3XSttYXQxWzZdKm1hdDJbMTFdK21hdDFbN10qbWF0MlsxNV0sXG4gICAgbWF0MVs4XSptYXQyWzBdK21hdDFbOV0qbWF0Mls0XSttYXQxWzEwXSptYXQyWzhdK21hdDFbMTFdKm1hdDJbMTJdLFxuICAgIG1hdDFbOF0qbWF0MlsxXSttYXQxWzldKm1hdDJbNV0rbWF0MVsxMF0qbWF0Mls5XSttYXQxWzExXSptYXQyWzEzXSxcbiAgICBtYXQxWzhdKm1hdDJbMl0rbWF0MVs5XSptYXQyWzZdK21hdDFbMTBdKm1hdDJbMTBdK21hdDFbMTFdKm1hdDJbMTRdLFxuICAgIG1hdDFbOF0qbWF0MlszXSttYXQxWzldKm1hdDJbN10rbWF0MVsxMF0qbWF0MlsxMV0rbWF0MVsxMV0qbWF0MlsxNV0sXG4gICAgbWF0MVsxMl0qbWF0MlswXSttYXQxWzEzXSptYXQyWzRdK21hdDFbMTRdKm1hdDJbOF0rbWF0MVsxNV0qbWF0MlsxMl0sXG4gICAgbWF0MVsxMl0qbWF0MlsxXSttYXQxWzEzXSptYXQyWzVdK21hdDFbMTRdKm1hdDJbOV0rbWF0MVsxNV0qbWF0MlsxM10sXG4gICAgbWF0MVsxMl0qbWF0MlsyXSttYXQxWzEzXSptYXQyWzZdK21hdDFbMTRdKm1hdDJbMTBdK21hdDFbMTVdKm1hdDJbMTRdLFxuICAgIG1hdDFbMTJdKm1hdDJbM10rbWF0MVsxM10qbWF0Mls3XSttYXQxWzE0XSptYXQyWzExXSttYXQxWzE1XSptYXQyWzE1XVxuICBdO1xufVxuXG5mdW5jdGlvbiBtYXRyaXhNdWx0aXBseTR4MShtYXQxLCBtYXQyKVxue1xuICByZXR1cm4gW1xuICAgIG1hdDFbMF0qbWF0MlswXSttYXQxWzFdKm1hdDJbMV0rbWF0MVsyXSptYXQyWzJdK21hdDFbM10qbWF0MVszXSxcbiAgICBtYXQxWzRdKm1hdDJbMF0rbWF0MVs1XSptYXQyWzFdK21hdDFbNl0qbWF0MlsyXSttYXQxWzddKm1hdDFbM10sXG4gICAgbWF0MVs4XSptYXQyWzBdK21hdDFbOV0qbWF0MlsxXSttYXQxWzEwXSptYXQyWzJdK21hdDFbMTFdKm1hdDFbM10sXG4gICAgbWF0MVsxMl0qbWF0MlswXSttYXQxWzEzXSptYXQyWzFdK21hdDFbMTRdKm1hdDJbMl0rbWF0MVsxNV0qbWF0MVszXVxuICBdO1xufVxuXG5mdW5jdGlvbiBtdWx0aXBseShtMSwgbTIpXG57XG4gIGlmIChtMi5sZW5ndGggPT0gNCkgcmV0dXJuIG1hdHJpeE11bHRpcGx5NHgxKG0xLCBtMilcbiAgZWxzZSByZXR1cm4gbWF0cml4TXVsdGlwbHkobTEsIG0yKVxufVxuXG5mdW5jdGlvbiBpbnZlcnNlKGEpXG57XG4gIHZhciBzMCA9IGFbMF0gKiBhWzVdIC0gYVs0XSAqIGFbMV07XG4gIHZhciBzMSA9IGFbMF0gKiBhWzZdIC0gYVs0XSAqIGFbMl07XG4gIHZhciBzMiA9IGFbMF0gKiBhWzddIC0gYVs0XSAqIGFbM107XG4gIHZhciBzMyA9IGFbMV0gKiBhWzZdIC0gYVs1XSAqIGFbMl07XG4gIHZhciBzNCA9IGFbMV0gKiBhWzddIC0gYVs1XSAqIGFbM107XG4gIHZhciBzNSA9IGFbMl0gKiBhWzddIC0gYVs2XSAqIGFbM107XG5cbiAgdmFyIGM1ID0gYVsxMF0gKiBhWzE1XSAtIGFbMTRdICogYVsxMV07XG4gIHZhciBjNCA9IGFbOV0gKiBhWzE1XSAtIGFbMTNdICogYVsxMV07XG4gIHZhciBjMyA9IGFbOV0gKiBhWzE0XSAtIGFbMTNdICogYVsxMF07XG4gIHZhciBjMiA9IGFbOF0gKiBhWzE1XSAtIGFbMTJdICogYVsxMV07XG4gIHZhciBjMSA9IGFbOF0gKiBhWzE0XSAtIGFbMTJdICogYVsxMF07XG4gIHZhciBjMCA9IGFbOF0gKiBhWzEzXSAtIGFbMTJdICogYVs5XTtcblxuICAvL2NvbnNvbGUubG9nKGM1LHM1LHM0KTtcblxuICAvLyBTaG91bGQgY2hlY2sgZm9yIDAgZGV0ZXJtaW5hbnRcbiAgdmFyIGludmRldCA9IDEuMCAvIChzMCAqIGM1IC0gczEgKiBjNCArIHMyICogYzMgKyBzMyAqIGMyIC0gczQgKiBjMSArIHM1ICogYzApO1xuXG4gIHZhciBiID0gW1tdLFtdLFtdLFtdXTtcblxuICBiWzBdID0gKCBhWzVdICogYzUgLSBhWzZdICogYzQgKyBhWzddICogYzMpICogaW52ZGV0O1xuICBiWzFdID0gKC1hWzFdICogYzUgKyBhWzJdICogYzQgLSBhWzNdICogYzMpICogaW52ZGV0O1xuICBiWzJdID0gKCBhWzEzXSAqIHM1IC0gYVsxNF0gKiBzNCArIGFbMTVdICogczMpICogaW52ZGV0O1xuICBiWzNdID0gKC1hWzldICogczUgKyBhWzEwXSAqIHM0IC0gYVsxMV0gKiBzMykgKiBpbnZkZXQ7XG5cbiAgYls0XSA9ICgtYVs0XSAqIGM1ICsgYVs2XSAqIGMyIC0gYVs3XSAqIGMxKSAqIGludmRldDtcbiAgYls1XSA9ICggYVswXSAqIGM1IC0gYVsyXSAqIGMyICsgYVszXSAqIGMxKSAqIGludmRldDtcbiAgYls2XSA9ICgtYVsxMl0gKiBzNSArIGFbMTRdICogczIgLSBhWzE1XSAqIHMxKSAqIGludmRldDtcbiAgYls3XSA9ICggYVs4XSAqIHM1IC0gYVsxMF0gKiBzMiArIGFbMTFdICogczEpICogaW52ZGV0O1xuXG4gIGJbOF0gPSAoIGFbNF0gKiBjNCAtIGFbNV0gKiBjMiArIGFbN10gKiBjMCkgKiBpbnZkZXQ7XG4gIGJbOV0gPSAoLWFbMF0gKiBjNCArIGFbMV0gKiBjMiAtIGFbM10gKiBjMCkgKiBpbnZkZXQ7XG4gIGJbMTBdID0gKCBhWzEyXSAqIHM0IC0gYVsxM10gKiBzMiArIGFbMTVdICogczApICogaW52ZGV0O1xuICBiWzExXSA9ICgtYVs4XSAqIHM0ICsgYVs5XSAqIHMyIC0gYVsxMV0gKiBzMCkgKiBpbnZkZXQ7XG5cbiAgYlsxMl0gPSAoLWFbNF0gKiBjMyArIGFbNV0gKiBjMSAtIGFbNl0gKiBjMCkgKiBpbnZkZXQ7XG4gIGJbMTNdID0gKCBhWzBdICogYzMgLSBhWzFdICogYzEgKyBhWzJdICogYzApICogaW52ZGV0O1xuICBiWzE0XSA9ICgtYVsxMl0gKiBzMyArIGFbMTNdICogczEgLSBhWzE0XSAqIHMwKSAqIGludmRldDtcbiAgYlsxNV0gPSAoIGFbOF0gKiBzMyAtIGFbOV0gKiBzMSArIGFbMTBdICogczApICogaW52ZGV0O1xuXG4gIHJldHVybiBiO1xufVxuXG5mdW5jdGlvbiBwZXJzcGVjdGl2ZShmaWVsZE9mVmlld0luUmFkaWFucywgYXNwZWN0LCBuZWFyLCBmYXIpXG57XG4gIHZhciBmID0gTWF0aC50YW4oTWF0aC5QSSAqIDAuNSAtIDAuNSAqIGZpZWxkT2ZWaWV3SW5SYWRpYW5zKTtcbiAgdmFyIHJhbmdlSW52ID0gMS4wIC8gKG5lYXIgLSBmYXIpO1xuXG4gIHJldHVybiBbXG4gICAgZiAvIGFzcGVjdCwgMCwgMCwgMCxcbiAgICAwLCBmLCAwLCAwLFxuICAgIDAsIDAsIChuZWFyICsgZmFyKSAqIHJhbmdlSW52LCAtMSxcbiAgICAwLCAwLCBuZWFyICogZmFyICogcmFuZ2VJbnYgKiAyLCAwXG4gIF07XG59XG5cbmZ1bmN0aW9uIG1ha2VaVG9XTWF0cml4KGZ1ZGdlRmFjdG9yKVxue1xuICByZXR1cm4gW1xuICAgIDEsIDAsIDAsIDAsXG4gICAgMCwgMSwgMCwgMCxcbiAgICAwLCAwLCAxLCBmdWRnZUZhY3RvcixcbiAgICAwLCAwLCAwLCAxLFxuICBdO1xufVxuXG5mdW5jdGlvbiB0cmFuc2xhdGUodHgsIHR5LCB0eilcbntcbiAgaWYgKHR5cGVvZiB0eCAhPSAnbnVtYmVyJylcbiAge1xuICAgIGxldCBvbGQgPSB0eFxuICAgIHR4ID0gb2xkWzBdXG4gICAgdHkgPSBvbGRbMV1cbiAgICB0eiA9IG9sZFsyXVxuICB9XG4gIHJldHVybiBbXG4gICAgMSwgIDAsICAwLCAgMCxcbiAgICAwLCAgMSwgIDAsICAwLFxuICAgIDAsICAwLCAgMSwgIDAsXG4gICAgdHgsIHR5LCB0eiwgMVxuICBdO1xufVxuXG5mdW5jdGlvbiByb3RhdGVYKGFuZ2xlSW5SYWRpYW5zKVxue1xuICB2YXIgYyA9IE1hdGguY29zKGFuZ2xlSW5SYWRpYW5zKTtcbiAgdmFyIHMgPSBNYXRoLnNpbihhbmdsZUluUmFkaWFucyk7XG5cbiAgcmV0dXJuIFtcbiAgICAxLCAwLCAwLCAwLFxuICAgIDAsIGMsIHMsIDAsXG4gICAgMCwgLXMsIGMsIDAsXG4gICAgMCwgMCwgMCwgMVxuICBdO1xufVxuXG5mdW5jdGlvbiByb3RhdGVZKGFuZ2xlSW5SYWRpYW5zKVxue1xuICB2YXIgYyA9IE1hdGguY29zKGFuZ2xlSW5SYWRpYW5zKTtcbiAgdmFyIHMgPSBNYXRoLnNpbihhbmdsZUluUmFkaWFucyk7XG5cbiAgcmV0dXJuIFtcbiAgICBjLCAwLCAtcywgMCxcbiAgICAwLCAxLCAwLCAwLFxuICAgIHMsIDAsIGMsIDAsXG4gICAgMCwgMCwgMCwgMVxuICBdO1xufVxuXG5mdW5jdGlvbiByb3RhdGVaKGFuZ2xlSW5SYWRpYW5zKSB7XG4gIHZhciBjID0gTWF0aC5jb3MoYW5nbGVJblJhZGlhbnMpO1xuICB2YXIgcyA9IE1hdGguc2luKGFuZ2xlSW5SYWRpYW5zKTtcblxuICByZXR1cm4gW1xuICAgIGMsIHMsIDAsIDAsXG4gICAgLXMsIGMsIDAsIDAsXG4gICAgMCwgMCwgMSwgMCxcbiAgICAwLCAwLCAwLCAxLFxuICBdO1xufVxuXG5mdW5jdGlvbiBzY2FsZShzeCwgc3ksIHN6KSB7XG4gIGlmICh0eXBlb2Ygc3ggIT0gJ251bWJlcicpIHtcbiAgICBsZXQgb2xkID0gc3hcbiAgICBzeCA9IG9sZFswXVxuICAgIHN5ID0gb2xkWzFdXG4gICAgc3ogPSBvbGRbMl1cbiAgfVxuICByZXR1cm4gW1xuICAgIHN4LCAwLCAgMCwgIDAsXG4gICAgMCwgc3ksICAwLCAgMCxcbiAgICAwLCAgMCwgc3osICAwLFxuICAgIDAsICAwLCAgMCwgIDEsXG4gIF07XG59XG5cbmZ1bmN0aW9uIGxvb2tBdChleWUsIHRhcmdldCwgdXApe1xuICB2YXIgZiA9IHZlYy5ub3JtYWxpemUodmVjLnN1YnRyYWN0KHRhcmdldCwgZXllKSk7XG4gIHZhciBzID0gdmVjLm5vcm1hbGl6ZSh2ZWMuY3Jvc3MoZiwgdXApKTtcbiAgdmFyIHUgPSB2ZWMuY3Jvc3MocywgZik7XG5cbiAgdmFyIHJlc3VsdCA9IGlkZW50aXR5KCk7XG4gIHJlc3VsdFs0KjAgKyAwXSA9IHNbMF07XG4gIHJlc3VsdFs0KjEgKyAwXSA9IHNbMV07XG4gIHJlc3VsdFs0KjIgKyAwXSA9IHNbMl07XG4gIHJlc3VsdFs0KjAgKyAxXSA9IHVbMF07XG4gIHJlc3VsdFs0KjEgKyAxXSA9IHVbMV07XG4gIHJlc3VsdFs0KjIgKyAxXSA9IHVbMl07XG4gIHJlc3VsdFs0KjAgKyAyXSA9LWZbMF07XG4gIHJlc3VsdFs0KjEgKyAyXSA9LWZbMV07XG4gIHJlc3VsdFs0KjIgKyAyXSA9LWZbMl07XG4gIHJlc3VsdFs0KjMgKyAwXSA9LXZlYy5kb3QocywgZXllKTtcbiAgcmVzdWx0WzQqMyArIDFdID0tdmVjLmRvdCh1LCBleWUpO1xuICByZXN1bHRbNCozICsgMl0gPSB2ZWMuZG90KGYsIGV5ZSk7XG4gIHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIGlkZW50aXR5KCkge1xuICByZXR1cm4gc2NhbGUoMSwgMSwgMSlcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG11bHRpcGx5LFxuICBpbnZlcnNlLFxuICBpZGVudGl0eSxcblxuICBwZXJzcGVjdGl2ZSxcbiAgbWFrZVpUb1dNYXRyaXgsXG4gIGxvb2tBdCxcblxuICB0cmFuc2xhdGUsXG4gIHJvdGF0ZVgsIHJvdGF0ZVksIHJvdGF0ZVosXG4gIHNjYWxlLFxufVxuIiwidmFyIG0gPSByZXF1aXJlKCcuL21hdHJpeCcpXG5cbmZ1bmN0aW9uIG9wZW5GaWxlKG5hbWUsIGZpbGVuYW1lKXtcbiAgdmFyIGRhdGFzdHJpbmc7XG4gICQuYWpheCh7XG4gICAgdXJsIDogZmlsZW5hbWUgKyAnLm9iaicsXG4gICAgZGF0YVR5cGU6IFwidGV4dFwiLFxuICAgIHN1Y2Nlc3MgOiBmdW5jdGlvbiAoZGF0YSkge1xuICAgICAgZGF0YXN0cmluZyA9IGRhdGE7XG4gICAgICAkLmFqYXgoe1xuICAgICAgICB1cmwgOiBmaWxlbmFtZSArICcubXRsJyxcbiAgICAgICAgZGF0YVR5cGU6IFwidGV4dFwiLFxuICAgICAgICBzdWNjZXNzIDogZnVuY3Rpb24gKG10bHN0cmluZykge1xuICAgICAgICAgIGNyZWF0ZU1vZGVsKG5hbWUsIGRhdGFzdHJpbmcsIG10bHN0cmluZyk7XG4gICAgICAgIH1cbiAgICAgIH0pXG4gICAgfVxuICB9KTtcbn1cblxuZnVuY3Rpb24gbWFrZU1vZGVsKG5hbWUsIGZpbGVuYW1lLCBjZW50ZXIgPSBbMCwgMCwgMF0sIHNjYWxlID0gWzEsIDEsIDFdKSB7XG4gIG1vZGVsc1tuYW1lXSA9IHtuYW1lLCBjZW50ZXIsIHNjYWxlfTtcbiAgb3BlbkZpbGUobmFtZSwgZmlsZW5hbWUpO1xufVxuXG5mdW5jdGlvbiBwYXJzZU10bChtdGxzdHJpbmcpIHtcbiAgdmFyIG10bGxpYiA9IHt9XG4gIHZhciBsaW5lcyA9IG10bHN0cmluZy5zcGxpdCgnXFxuJyk7XG4gIHZhciBjdXJtdGwgPSAnJ1xuICBmb3IgKHZhciBqPTA7IGo8bGluZXMubGVuZ3RoOyBqKyspIHtcbiAgICB2YXIgd29yZHMgPSBsaW5lc1tqXS5zcGxpdCgnICcpO1xuICAgIGlmICh3b3Jkc1swXSA9PSAnbmV3bXRsJykge1xuICAgICAgY3VybXRsID0gd29yZHNbMV1cbiAgICAgIG10bGxpYltjdXJtdGxdID0ge31cbiAgICB9IGVsc2UgaWYgKHdvcmRzWzBdID09ICdLZCcpIHtcbiAgICAgIG10bGxpYltjdXJtdGxdLmRpZmZ1c2UgPSBbXG4gICAgICAgIHBhcnNlRmxvYXQod29yZHNbMV0pLFxuICAgICAgICBwYXJzZUZsb2F0KHdvcmRzWzJdKSxcbiAgICAgICAgcGFyc2VGbG9hdCh3b3Jkc1szXSksXG4gICAgICBdXG4gICAgfSBlbHNlIGlmICh3b3Jkc1swXSA9PSAnS3MnKSB7XG4gICAgICBtdGxsaWJbY3VybXRsXS5zcGVjdWxhciA9IFtcbiAgICAgICAgcGFyc2VGbG9hdCh3b3Jkc1sxXSksXG4gICAgICAgIHBhcnNlRmxvYXQod29yZHNbMl0pLFxuICAgICAgICBwYXJzZUZsb2F0KHdvcmRzWzNdKSxcbiAgICAgIF1cbiAgICB9IGVsc2UgaWYgKHdvcmRzWzBdID09ICdLYScpIHtcbiAgICAgIG10bGxpYltjdXJtdGxdLmFtYmllbnQgPSBbXG4gICAgICAgIHBhcnNlRmxvYXQod29yZHNbMV0pLFxuICAgICAgICBwYXJzZUZsb2F0KHdvcmRzWzJdKSxcbiAgICAgICAgcGFyc2VGbG9hdCh3b3Jkc1szXSksXG4gICAgICBdXG4gICAgfSBlbHNlIGlmICh3b3Jkc1swXSA9PSAnTnMnKSB7XG4gICAgICBtdGxsaWJbY3VybXRsXS5zaGluaW5lc3MgPSBwYXJzZUZsb2F0KHdvcmRzWzFdKVxuICAgIH0gZWxzZSBpZiAod29yZHNbMF0gPT0gJ21hcF9LZCcpIHtcbiAgICAgIGxvYWRUZXh0dXJlKHdvcmRzWzFdLCBtdGxsaWJbY3VybXRsXSlcbiAgICB9XG4gIH1cbiAgcmV0dXJuIG10bGxpYlxufVxuXG5mdW5jdGlvbiBoYW5kbGVMb2FkZWRUZXh0dXJlKHRleHR1cmUpIHtcbiAgZ2wucGl4ZWxTdG9yZWkoZ2wuVU5QQUNLX0ZMSVBfWV9XRUJHTCwgdHJ1ZSk7XG4gIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIHRleHR1cmUpO1xuICBnbC50ZXhJbWFnZTJEKGdsLlRFWFRVUkVfMkQsIDAsIGdsLlJHQkEsIGdsLlJHQkEsIGdsLlVOU0lHTkVEX0JZVEUsIHRleHR1cmUuaW1hZ2UpO1xuICBnbC50ZXhQYXJhbWV0ZXJpKGdsLlRFWFRVUkVfMkQsIGdsLlRFWFRVUkVfTUFHX0ZJTFRFUiwgZ2wuTElORUFSKTtcbiAgZ2wudGV4UGFyYW1ldGVyaShnbC5URVhUVVJFXzJELCBnbC5URVhUVVJFX01JTl9GSUxURVIsIGdsLkxJTkVBUl9NSVBNQVBfTkVBUkVTVCk7XG4gIGdsLmdlbmVyYXRlTWlwbWFwKGdsLlRFWFRVUkVfMkQpO1xuXG4gIGdsLmJpbmRUZXh0dXJlKGdsLlRFWFRVUkVfMkQsIG51bGwpO1xufVxuXG5mdW5jdGlvbiBsb2FkVGV4dHVyZShzcmMsIG1hdGVyaWFsKSB7XG4gIHZhciB0ZXh0dXJlID0gZ2wuY3JlYXRlVGV4dHVyZSgpO1xuICB0ZXh0dXJlLmltYWdlID0gbmV3IEltYWdlKCk7XG4gIHRleHR1cmUuaW1hZ2Uub25sb2FkID0gZnVuY3Rpb24gKCkge1xuICAgIGhhbmRsZUxvYWRlZFRleHR1cmUodGV4dHVyZSlcbiAgICBtYXRlcmlhbC50ZXh0dXJlID0gdGV4dHVyZVxuICB9XG4gIHRleHR1cmUuaW1hZ2Uuc3JjID0gc3JjO1xuICByZXR1cm4gdGV4dHVyZTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTW9kZWwobmFtZSwgZmlsZWRhdGEsIG10bHN0cmluZykgLy9DcmVhdGUgb2JqZWN0IGZyb20gYmxlbmRlclxue1xuICB2YXIgbW9kZWwgPSBtb2RlbHNbbmFtZV07XG4gIHZhciBtdGxsaWIgPSBwYXJzZU10bChtdGxzdHJpbmcpXG4gIHZhciB2ZXJ0ZXhfYnVmZmVyX2RhdGEgPSBbXTtcbiAgdmFyIHBvaW50cyA9IFtdO1xuICB2YXIgbWluWCA9IDEwMDAwMDBcbiAgdmFyIG1heFggPSAtMTAwMDAwMFxuICB2YXIgbWluWSA9IDEwMDAwMDBcbiAgdmFyIG1heFkgPSAtMTAwMDAwMFxuICB2YXIgbWluWiA9IDEwMDAwMDBcbiAgdmFyIG1heFogPSAtMTAwMDAwMFxuXG4gIHZhciBpbnZlcnROb3JtYWxzID0gZmFsc2U7XG4gIHZhciBub3JtYWxzID0gW107XG4gIHZhciBub3JtYWxfYnVmZmVyX2RhdGEgPSBbXTtcblxuICB2YXIgdGV4dHVyZXMgPSBbXTtcbiAgdmFyIHRleHR1cmVfYnVmZmVyX2RhdGEgPSBbXTtcblxuICBtb2RlbC52YW9zID0gW107XG5cbiAgdmFyIGxpbmVzID0gZmlsZWRhdGEuc3BsaXQoJ1xcbicpO1xuICBsaW5lcyA9IGxpbmVzLm1hcChzID0+IHMudHJpbSgpKVxuICBsaW5lcy5wdXNoKCd1c2VtdGwnKVxuICBmb3IgKHZhciBqPTA7IGo8bGluZXMubGVuZ3RoOyBqKyspe1xuICAgIHZhciB3b3JkcyA9IGxpbmVzW2pdLnNwbGl0KCcgJyk7XG4gICAgaWYod29yZHNbMF0gPT0gXCJ2XCIpe1xuICAgICAgdmFyIGN1cl9wb2ludCA9IHt9O1xuICAgICAgY3VyX3BvaW50Wyd4J109cGFyc2VGbG9hdCh3b3Jkc1sxXSk7XG4gICAgICBpZihjdXJfcG9pbnRbJ3gnXT5tYXhYKXtcbiAgICAgICAgbWF4WCA9IGN1cl9wb2ludFsneCddXG4gICAgICB9XG4gICAgICBpZihjdXJfcG9pbnRbJ3gnXTxtaW5YKXtcbiAgICAgICAgbWluWCA9IGN1cl9wb2ludFsneCddXG4gICAgICB9XG4gICAgICBjdXJfcG9pbnRbJ3knXT1wYXJzZUZsb2F0KHdvcmRzWzJdKTtcbiAgICAgIGlmKGN1cl9wb2ludFsneSddPm1heFkpe1xuICAgICAgICBtYXhZID0gY3VyX3BvaW50Wyd5J11cbiAgICAgIH1cbiAgICAgIGlmKGN1cl9wb2ludFsneSddPG1pblkpe1xuICAgICAgICBtaW5ZID0gY3VyX3BvaW50Wyd5J11cbiAgICAgIH1cbiAgICAgIGN1cl9wb2ludFsneiddPXBhcnNlRmxvYXQod29yZHNbM10pO1xuICAgICAgaWYoY3VyX3BvaW50Wyd6J10+bWF4Wil7XG4gICAgICAgIG1heFogPSBjdXJfcG9pbnRbJ3onXVxuICAgICAgfVxuICAgICAgaWYoY3VyX3BvaW50Wyd6J108bWluWil7XG4gICAgICAgIG1pblogPSBjdXJfcG9pbnRbJ3onXVxuICAgICAgfVxuICAgICAgLy9jb25zb2xlLmxvZyh3b3Jkcyk7XG4gICAgICBwb2ludHMucHVzaChjdXJfcG9pbnQpO1xuICAgIH0gZWxzZSBpZiAod29yZHNbMF0gPT0gXCJ2blwiKSB7XG4gICAgICBsZXQgY3VyX3BvaW50ID0ge307XG4gICAgICBjdXJfcG9pbnRbJ3gnXT1wYXJzZUZsb2F0KHdvcmRzWzFdKTtcbiAgICAgIGN1cl9wb2ludFsneSddPXBhcnNlRmxvYXQod29yZHNbMl0pO1xuICAgICAgY3VyX3BvaW50Wyd6J109cGFyc2VGbG9hdCh3b3Jkc1szXSk7XG4gICAgICAvL2NvbnNvbGUubG9nKHdvcmRzKTtcbiAgICAgIG5vcm1hbHMucHVzaChjdXJfcG9pbnQpO1xuICAgIH0gZWxzZSBpZiAod29yZHNbMF0gPT0gXCJ2dFwiKSB7XG4gICAgICBsZXQgY3VyX3BvaW50ID0ge307XG4gICAgICBjdXJfcG9pbnQucyA9IHBhcnNlRmxvYXQod29yZHNbMV0pO1xuICAgICAgY3VyX3BvaW50LnQgPSBwYXJzZUZsb2F0KHdvcmRzWzJdKTtcbiAgICAgIHRleHR1cmVzLnB1c2goY3VyX3BvaW50KTtcbiAgICB9XG4gIH1cbiAgbW9kZWwubWluWCA9IG1pblhcbiAgbW9kZWwubWF4WCA9IG1heFhcbiAgbW9kZWwubWluWSA9IG1pbllcbiAgbW9kZWwubWF4WSA9IG1heFlcbiAgbW9kZWwubWluWiA9IG1pblpcbiAgbW9kZWwubWF4WiA9IG1heFpcbiAgLy9jb25zb2xlLmxvZyhwb2ludHMpO1xuICAvLyBsZXQgbGluZXMgPSBmaWxlZGF0YS5zcGxpdCgnXFxuJyk7XG4gIHZhciBjdXJtdGwgPSAnJ1xuICBmb3IgKHZhciBqaj0wOyBqajxsaW5lcy5sZW5ndGg7IGpqKyspe1xuICAgIGxldCB3b3JkcyA9IGxpbmVzW2pqXS5zcGxpdCgnICcpO1xuICAgIGlmKHdvcmRzWzBdID09IFwiZlwiKSB7XG4gICAgICBmb3IgKGxldCB3YyA9IDE7IHdjIDwgNDsgd2MrKykge1xuICAgICAgICBsZXQgdnhkYXRhID0gd29yZHNbd2NdLnNwbGl0KCcvJylcbiAgICAgICAgbGV0IHAgPSBwYXJzZUludCh2eGRhdGFbMF0pIC0gMVxuICAgICAgICBsZXQgdCA9IHBhcnNlSW50KHZ4ZGF0YVsxXSkgLSAxXG4gICAgICAgIGxldCBuID0gcGFyc2VJbnQodnhkYXRhWzJdKSAtIDFcbiAgICAgICAgdmVydGV4X2J1ZmZlcl9kYXRhLnB1c2gocG9pbnRzW3BdLngpXG4gICAgICAgIHZlcnRleF9idWZmZXJfZGF0YS5wdXNoKHBvaW50c1twXS55KVxuICAgICAgICB2ZXJ0ZXhfYnVmZmVyX2RhdGEucHVzaChwb2ludHNbcF0ueilcblxuICAgICAgICBpZiAoIWlzTmFOKHQpKSB7XG4gICAgICAgICAgdGV4dHVyZV9idWZmZXJfZGF0YS5wdXNoKHRleHR1cmVzW3RdLnMpXG4gICAgICAgICAgdGV4dHVyZV9idWZmZXJfZGF0YS5wdXNoKHRleHR1cmVzW3RdLnQpXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoaW52ZXJ0Tm9ybWFscykge1xuICAgICAgICAgIG5vcm1hbF9idWZmZXJfZGF0YS5wdXNoKC1ub3JtYWxzW25dLngpXG4gICAgICAgICAgbm9ybWFsX2J1ZmZlcl9kYXRhLnB1c2goLW5vcm1hbHNbbl0ueSlcbiAgICAgICAgICBub3JtYWxfYnVmZmVyX2RhdGEucHVzaCgtbm9ybWFsc1tuXS56KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIG5vcm1hbF9idWZmZXJfZGF0YS5wdXNoKG5vcm1hbHNbbl0ueClcbiAgICAgICAgICBub3JtYWxfYnVmZmVyX2RhdGEucHVzaChub3JtYWxzW25dLnkpXG4gICAgICAgICAgbm9ybWFsX2J1ZmZlcl9kYXRhLnB1c2gobm9ybWFsc1tuXS56KVxuICAgICAgICB9XG4gICAgICB9XG4gICAgfSBlbHNlIGlmICh3b3Jkc1swXSA9PSAndXNlbXRsJykge1xuICAgICAgbGV0IHZhbyA9IHt9XG4gICAgICB2YW8ubnVtVmVydGV4ID0gdmVydGV4X2J1ZmZlcl9kYXRhLmxlbmd0aCAvIDM7XG4gICAgICBpZiAodmFvLm51bVZlcnRleCAhPSAwKSB7XG4gICAgICAgIHZhciB2ZXJ0ZXhCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZlcnRleEJ1ZmZlcik7XG4gICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBuZXcgRmxvYXQzMkFycmF5KHZlcnRleF9idWZmZXJfZGF0YSksIGdsLlNUQVRJQ19EUkFXKTtcbiAgICAgICAgdmFvLnZlcnRleEJ1ZmZlciA9IHZlcnRleEJ1ZmZlclxuXG4gICAgICAgIHZhciBub3JtYWxCdWZmZXIgPSBnbC5jcmVhdGVCdWZmZXIoKTtcbiAgICAgICAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIG5vcm1hbEJ1ZmZlcik7XG4gICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBuZXcgRmxvYXQzMkFycmF5KG5vcm1hbF9idWZmZXJfZGF0YSksIGdsLlNUQVRJQ19EUkFXKTtcbiAgICAgICAgdmFvLm5vcm1hbEJ1ZmZlciA9IG5vcm1hbEJ1ZmZlclxuXG4gICAgICAgIHZhciB0ZXh0dXJlQnVmZmVyID0gZ2wuY3JlYXRlQnVmZmVyKCk7XG4gICAgICAgIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB0ZXh0dXJlQnVmZmVyKTtcbiAgICAgICAgaWYgKHRleHR1cmVfYnVmZmVyX2RhdGEubGVuZ3RoID4gMCkge1xuICAgICAgICAgIGdsLmJ1ZmZlckRhdGEoZ2wuQVJSQVlfQlVGRkVSLCBuZXcgRmxvYXQzMkFycmF5KHRleHR1cmVfYnVmZmVyX2RhdGEpLCBnbC5TVEFUSUNfRFJBVyk7XG4gICAgICAgICAgdmFvLmlzVGV4dHVyZWQgPSB0cnVlXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCAyKnZhby5udW1WZXJ0ZXg7IGkrKykgdGV4dHVyZV9idWZmZXJfZGF0YS5wdXNoKDApXG4gICAgICAgICAgZ2wuYnVmZmVyRGF0YShnbC5BUlJBWV9CVUZGRVIsIG5ldyBGbG9hdDMyQXJyYXkodGV4dHVyZV9idWZmZXJfZGF0YSksIGdsLlNUQVRJQ19EUkFXKTtcbiAgICAgICAgICB2YW8uaXNUZXh0dXJlZCA9IGZhbHNlXG4gICAgICAgIH1cbiAgICAgICAgdmFvLnRleHR1cmVCdWZmZXIgPSB0ZXh0dXJlQnVmZmVyXG5cbiAgICAgICAgdmFvLm1hdGVyaWFsID0gbXRsbGliW2N1cm10bF1cblxuICAgICAgICBtb2RlbC52YW9zLnB1c2godmFvKVxuICAgICAgICB2ZXJ0ZXhfYnVmZmVyX2RhdGEgPSBbXVxuICAgICAgICBub3JtYWxfYnVmZmVyX2RhdGEgPSBbXVxuICAgICAgICB0ZXh0dXJlX2J1ZmZlcl9kYXRhID0gW11cbiAgICAgIH0gZWxzZSBpZiAod29yZHNbMF0gPT0gJ2ludmVydE5vcm1hbHMnKSB7XG4gICAgICAgIGludmVydE5vcm1hbHMgPSAhaW52ZXJ0Tm9ybWFsc1xuICAgICAgfVxuICAgICAgY3VybXRsID0gd29yZHNbMV1cbiAgICB9XG4gIH1cbn1cblxuZnVuY3Rpb24gZHJhd01vZGVsIChtb2RlbCkge1xuICBpZiAoIW1vZGVsLnZhb3MpIHJldHVyblxuICBnbC51bmlmb3JtTWF0cml4NGZ2KGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCBcIm1vZGVsXCIpLCBmYWxzZSwgTWF0cmljZXMubW9kZWwpO1xuICBnbC51bmlmb3JtTWF0cml4NGZ2KGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCBcIm1vZGVsSW52XCIpLCBmYWxzZSwgbS5pbnZlcnNlKE1hdHJpY2VzLm1vZGVsKSk7XG5cbiAgbW9kZWwudmFvcy5tYXAoZHJhd1ZBTylcbn1cblxuZnVuY3Rpb24gZHJhd0xpZ2h0KG1vZGVsKSB7XG4gIGdsLnVuaWZvcm0xaShnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgXCJpc0xpZ2h0XCIpLCAxKTtcbiAgZHJhd01vZGVsKG1vZGVsKTtcbiAgZ2wudW5pZm9ybTFpKGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCBcImlzTGlnaHRcIiksIDApO1xufVxuXG5mdW5jdGlvbiBkcmF3VkFPKHZhbykge1xuICBpZiAoIXZhby52ZXJ0ZXhCdWZmZXIpIHJldHVybjtcblxuICBsb2FkTWF0ZXJpYWwodmFvLm1hdGVyaWFsKVxuXG4gIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB2YW8udmVydGV4QnVmZmVyKVxuICBnbC52ZXJ0ZXhBdHRyaWJQb2ludGVyKHByb2dyYW0ucG9zaXRpb25BdHRyaWJ1dGUsIDMsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgZ2wuYmluZEJ1ZmZlcihnbC5BUlJBWV9CVUZGRVIsIHZhby5ub3JtYWxCdWZmZXIpXG4gIGdsLnZlcnRleEF0dHJpYlBvaW50ZXIocHJvZ3JhbS5ub3JtYWxBdHRyaWJ1dGUsIDMsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG5cbiAgdmFyIGlzVGV4dHVyZWQgPSB2YW8ubWF0ZXJpYWwudGV4dHVyZSAmJiB2YW8uaXNUZXh0dXJlZFxuICAvLyBjb25zb2xlLmxvZyhpc1RleHR1cmVkKVxuICBnbC51bmlmb3JtMWkoZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIFwiaXNUZXh0dXJlZFwiKSwgaXNUZXh0dXJlZCk7XG4gIGdsLmJpbmRCdWZmZXIoZ2wuQVJSQVlfQlVGRkVSLCB2YW8udGV4dHVyZUJ1ZmZlcilcbiAgZ2wudmVydGV4QXR0cmliUG9pbnRlcihwcm9ncmFtLnRleHR1cmVBdHRyaWJ1dGUsIDIsIGdsLkZMT0FULCBmYWxzZSwgMCwgMCk7XG4gIGlmIChpc1RleHR1cmVkKSB7XG4gICAgZ2wuYWN0aXZlVGV4dHVyZShnbC5URVhUVVJFMCk7XG4gICAgZ2wuYmluZFRleHR1cmUoZ2wuVEVYVFVSRV8yRCwgdmFvLm1hdGVyaWFsLnRleHR1cmUpO1xuICAgIGdsLnVuaWZvcm0xaShnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgXCJzYW1wbGVyXCIpLCAwKTtcbiAgfVxuXG4gIC8vIGRyYXdcbiAgZ2wuZHJhd0FycmF5cyhnbC5UUklBTkdMRVMsIDAsIHZhby5udW1WZXJ0ZXgpO1xufVxuXG5mdW5jdGlvbiBsb2FkTWF0ZXJpYWwobWF0ZXJpYWwpIHtcbiAgaWYgKCFtYXRlcmlhbCkgbWF0ZXJpYWwgPSB7XG4gICAgYW1iaWVudDogWzEsIDEsIDFdLFxuICAgIGRpZmZ1c2U6IFsxLCAxLCAxXSxcbiAgICBzcGVjdWxhcjogWzEsIDEsIDFdLFxuICAgIHNoaW5pbmVzczogMCxcbiAgfTtcbiAgLy8gU2V0IG1hdGVyaWFsIHByb3BlcnRpZXNcbiAgZ2wudW5pZm9ybTNmKGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCBcIm1hdGVyaWFsLmFtYmllbnRcIiksICAgbWF0ZXJpYWwuYW1iaWVudFswXSwgbWF0ZXJpYWwuYW1iaWVudFsxXSwgbWF0ZXJpYWwuYW1iaWVudFsyXSk7XG4gIGdsLnVuaWZvcm0zZihnbC5nZXRVbmlmb3JtTG9jYXRpb24ocHJvZ3JhbSwgXCJtYXRlcmlhbC5kaWZmdXNlXCIpLCAgIG1hdGVyaWFsLmRpZmZ1c2VbMF0sIG1hdGVyaWFsLmRpZmZ1c2VbMV0sIG1hdGVyaWFsLmRpZmZ1c2VbMl0pO1xuICBnbC51bmlmb3JtM2YoZ2wuZ2V0VW5pZm9ybUxvY2F0aW9uKHByb2dyYW0sIFwibWF0ZXJpYWwuc3BlY3VsYXJcIiksICBtYXRlcmlhbC5zcGVjdWxhclswXSwgbWF0ZXJpYWwuc3BlY3VsYXJbMV0sIG1hdGVyaWFsLnNwZWN1bGFyWzJdKTtcbiAgZ2wudW5pZm9ybTFmKGdsLmdldFVuaWZvcm1Mb2NhdGlvbihwcm9ncmFtLCBcIm1hdGVyaWFsLnNoaW5pbmVzc1wiKSwgbWF0ZXJpYWwuc2hpbmluZXNzKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIG1ha2VNb2RlbCxcbiAgY3JlYXRlTW9kZWwsXG4gIGRyYXdNb2RlbCxcbiAgZHJhd0xpZ2h0LFxufVxuIiwidmFyIHNoYWRlcnMgPSB7fVxuXG5mdW5jdGlvbiBjb21waWxlU2hhZGVyKGdsLCBzaGFkZXJTb3VyY2UsIHNoYWRlclR5cGUpIHtcbiAgLy8gQ3JlYXRlIHRoZSBzaGFkZXIgb2JqZWN0XG4gIHZhciBzaGFkZXIgPSBnbC5jcmVhdGVTaGFkZXIoc2hhZGVyVHlwZSk7XG5cbiAgLy8gU2V0IHRoZSBzaGFkZXIgc291cmNlIGNvZGUuXG4gIGdsLnNoYWRlclNvdXJjZShzaGFkZXIsIHNoYWRlclNvdXJjZSk7XG5cbiAgLy8gQ29tcGlsZSB0aGUgc2hhZGVyXG4gIGdsLmNvbXBpbGVTaGFkZXIoc2hhZGVyKTtcblxuICAvLyBDaGVjayBpZiBpdCBjb21waWxlZFxuICB2YXIgc3VjY2VzcyA9IGdsLmdldFNoYWRlclBhcmFtZXRlcihzaGFkZXIsIGdsLkNPTVBJTEVfU1RBVFVTKTtcbiAgaWYgKCFzdWNjZXNzKSB7XG4gICAgLy8gU29tZXRoaW5nIHdlbnQgd3JvbmcgZHVyaW5nIGNvbXBpbGF0aW9uOyBnZXQgdGhlIGVycm9yXG4gICAgdGhyb3cgXCJjb3VsZCBub3QgY29tcGlsZSBzaGFkZXI6XCIgKyBnbC5nZXRTaGFkZXJJbmZvTG9nKHNoYWRlcik7XG4gIH1cblxuICByZXR1cm4gc2hhZGVyO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVQcm9ncmFtKGdsLCBuYW1lLCB2ZXJ0ZXhTaGFkZXIsIGZyYWdtZW50U2hhZGVyKSB7XG4gIC8vIGNyZWF0ZSBhIHByb2dyYW0uXG4gIHZhciBwcm9ncmEgPSBnbC5jcmVhdGVQcm9ncmFtKCk7XG5cbiAgLy8gYXR0YWNoIHRoZSBzaGFkZXJzLlxuICBnbC5hdHRhY2hTaGFkZXIocHJvZ3JhLCB2ZXJ0ZXhTaGFkZXIpO1xuICBnbC5hdHRhY2hTaGFkZXIocHJvZ3JhLCBmcmFnbWVudFNoYWRlcik7XG5cbiAgLy8gbGluayB0aGUgcHJvZ3JhbS5cbiAgZ2wubGlua1Byb2dyYW0ocHJvZ3JhKTtcblxuICBnbC5kZWxldGVTaGFkZXIodmVydGV4U2hhZGVyKVxuICBnbC5kZWxldGVTaGFkZXIoZnJhZ21lbnRTaGFkZXIpXG5cbiAgLy8gQ2hlY2sgaWYgaXQgbGlua2VkLlxuICB2YXIgc3VjY2VzcyA9IGdsLmdldFByb2dyYW1QYXJhbWV0ZXIocHJvZ3JhLCBnbC5MSU5LX1NUQVRVUyk7XG4gIGlmICghc3VjY2Vzcykge1xuICAgIC8vIHNvbWV0aGluZyB3ZW50IHdyb25nIHdpdGggdGhlIGxpbmtcbiAgICB0aHJvdyAoXCJwcm9ncmFtIGZpbGVkIHRvIGxpbms6XCIgKyBnbC5nZXRQcm9ncmFtSW5mb0xvZyAocHJvZ3JhKSk7XG4gIH1cblxuICB3aW5kb3cucHJvZ3JhbSA9IHByb2dyYTtcbiAgcHJvZ3JhbS5wb3NpdGlvbkF0dHJpYnV0ZSA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHByb2dyYW0sIFwiYV9wb3NpdGlvblwiKTtcbiAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkocHJvZ3JhbS52ZXJ0ZXhBdHRyaWJ1dGUpO1xuXG4gIHByb2dyYW0ubm9ybWFsQXR0cmlidXRlID0gZ2wuZ2V0QXR0cmliTG9jYXRpb24ocHJvZ3JhbSwgXCJhX25vcm1hbFwiKTtcbiAgZ2wuZW5hYmxlVmVydGV4QXR0cmliQXJyYXkocHJvZ3JhbS5ub3JtYWxBdHRyaWJ1dGUpO1xuXG4gIHByb2dyYW0udGV4dHVyZUF0dHJpYnV0ZSA9IGdsLmdldEF0dHJpYkxvY2F0aW9uKHByb2dyYW0sIFwiYV90ZXh0dXJlXCIpO1xuICBnbC5lbmFibGVWZXJ0ZXhBdHRyaWJBcnJheShwcm9ncmFtLnRleHR1cmVBdHRyaWJ1dGUpO1xuXG4gIHNoYWRlcnNbbmFtZV0gPSBwcm9ncmE7XG59XG5cbmZ1bmN0aW9uIG9wZW5GaWxlKG5hbWUsIGZpbGVuYW1lKXtcbiAgJC5nZXQoZmlsZW5hbWUgKyAnLnZzJywgZnVuY3Rpb24gKHZ4U2hhZGVyRGF0YSkge1xuICAgIHZhciB2eFNoYWRlciA9IGNvbXBpbGVTaGFkZXIoZ2wsIHZ4U2hhZGVyRGF0YSwgZ2wuVkVSVEVYX1NIQURFUilcbiAgICAkLmdldChmaWxlbmFtZSArICcuZnJhZycsIGZ1bmN0aW9uIChmcmFnU2hhZGVyRGF0YSkge1xuICAgICAgY29uc29sZS5sb2codnhTaGFkZXJEYXRhLCBmcmFnU2hhZGVyRGF0YSlcbiAgICAgIHZhciBmcmFnU2hhZGVyID0gY29tcGlsZVNoYWRlcihnbCwgZnJhZ1NoYWRlckRhdGEsIGdsLkZSQUdNRU5UX1NIQURFUilcbiAgICAgIGNyZWF0ZVByb2dyYW0oZ2wsIG5hbWUsIHZ4U2hhZGVyLCBmcmFnU2hhZGVyKVxuICAgIH0sICd0ZXh0Jyk7XG4gIH0sICd0ZXh0Jyk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNoYWRlcihzaGFkZXJuYW1lKSB7XG4gIG9wZW5GaWxlKHNoYWRlcm5hbWUsICdzaGFkZXJzLycgKyBzaGFkZXJuYW1lKVxufVxuXG5mdW5jdGlvbiB1c2VTaGFkZXIoc2hhZGVybmFtZSkge1xuICB3aW5kb3cucHJvZ3JhbSA9IHNoYWRlcnNbc2hhZGVybmFtZV1cbiAgZ2wudXNlUHJvZ3JhbSh3aW5kb3cucHJvZ3JhbSk7XG59XG5cbm1vZHVsZS5leHBvcnRzID0ge1xuICBjb21waWxlU2hhZGVyLFxuICBjcmVhdGVTaGFkZXIsXG4gIHVzZVNoYWRlcixcbn1cbiIsImZ1bmN0aW9uIGRvdChbeCwgeSwgel0sIFtwLCBxLCByXSkge1xuICByZXR1cm4geCpwICsgeSpxICsgeipyXG59XG5cbmZ1bmN0aW9uIGNyb3NzKFt1eCwgdXksIHV6XSwgW3Z4LCB2eSwgdnpdKSB7XG4gIHZhciB4ID0gdXkqdnogLSB1eip2eTtcbiAgdmFyIHkgPSB1eip2eCAtIHV4KnZ6O1xuICB2YXIgeiA9IHV4KnZ5IC0gdXkqdng7XG4gIHJldHVybiBbeCwgeSwgel07XG59XG5cbmZ1bmN0aW9uIGFkZChbeCwgeSwgel0sIFtwLCBxLCByXSkge1xuICByZXR1cm4gW3ggKyBwLCB5ICsgcSwgeiArIHJdXG59XG5cbmZ1bmN0aW9uIHN1YnRyYWN0KFt4LCB5LCB6XSwgW3AsIHEsIHJdKSB7XG4gIHJldHVybiBbeCAtIHAsIHkgLSBxLCB6IC0gcl1cbn1cblxuZnVuY3Rpb24gYWJzKFt4LCB5LCB6XSkge1xuICByZXR1cm4gTWF0aC5zcXJ0KHgqeCArIHkqeSArIHoqeilcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplKFt4LCB5LCB6XSkge1xuICB2YXIgdCA9IGFicyhbeCwgeSwgel0pXG4gIHJldHVybiBbeC90LCB5L3QsIHovdF1cbn1cblxuZnVuY3Rpb24gbXVsdGlwbHlTY2FsYXIoW3gsIHksIHpdLCBjKSB7XG4gIHJldHVybiBbeCpjLCB5KmMsIHoqY11cbn1cblxubW9kdWxlLmV4cG9ydHMgPSB7XG4gIGRvdCxcbiAgY3Jvc3MsXG4gIGFkZCxcbiAgc3VidHJhY3QsXG4gIGFicyxcbiAgbm9ybWFsaXplLFxuICBtdWx0aXBseVNjYWxhcixcbn1cbiJdfQ==
