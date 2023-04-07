
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
(function () {
    'use strict';

    function noop$1() { }
    function assign$1(tar, src) {
        // @ts-ignore
        for (const k in src)
            tar[k] = src[k];
        return tar;
    }
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function create_slot(definition, ctx, $$scope, fn) {
        if (definition) {
            const slot_ctx = get_slot_context(definition, ctx, $$scope, fn);
            return definition[0](slot_ctx);
        }
    }
    function get_slot_context(definition, ctx, $$scope, fn) {
        return definition[1] && fn
            ? assign$1($$scope.ctx.slice(), definition[1](fn(ctx)))
            : $$scope.ctx;
    }
    function get_slot_changes(definition, $$scope, dirty, fn) {
        if (definition[2] && fn) {
            const lets = definition[2](fn(dirty));
            if ($$scope.dirty === undefined) {
                return lets;
            }
            if (typeof lets === 'object') {
                const merged = [];
                const len = Math.max($$scope.dirty.length, lets.length);
                for (let i = 0; i < len; i += 1) {
                    merged[i] = $$scope.dirty[i] | lets[i];
                }
                return merged;
            }
            return $$scope.dirty | lets;
        }
        return $$scope.dirty;
    }
    function update_slot_base(slot, slot_definition, ctx, $$scope, slot_changes, get_slot_context_fn) {
        if (slot_changes) {
            const slot_context = get_slot_context(slot_definition, ctx, $$scope, get_slot_context_fn);
            slot.p(slot_context, slot_changes);
        }
    }
    function get_all_dirty_from_scope($$scope) {
        if ($$scope.ctx.length > 32) {
            const dirty = [];
            const length = $$scope.ctx.length / 32;
            for (let i = 0; i < length; i++) {
                dirty[i] = -1;
            }
            return dirty;
        }
        return -1;
    }
    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        if (node.parentNode) {
            node.parentNode.removeChild(node);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function empty() {
        return text('');
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function custom_event(type, detail, { bubbles = false, cancelable = false } = {}) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, bubbles, cancelable, detail);
        return e;
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    /**
     * The `onMount` function schedules a callback to run as soon as the component has been mounted to the DOM.
     * It must be called during the component's initialisation (but doesn't need to live *inside* the component;
     * it can be called from an external module).
     *
     * `onMount` does not run inside a [server-side component](/docs#run-time-server-side-component-api).
     *
     * https://svelte.dev/docs#run-time-svelte-onmount
     */
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    /**
     * Schedules a callback to run immediately after the component has been updated.
     *
     * The first time the callback runs will be after the initial `onMount`
     */
    function afterUpdate(fn) {
        get_current_component().$$.after_update.push(fn);
    }

    const dirty_components = [];
    const binding_callbacks = [];
    let render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = /* @__PURE__ */ Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    // flush() calls callbacks in this order:
    // 1. All beforeUpdate callbacks, in order: parents before children
    // 2. All bind:this callbacks, in reverse order: children before parents.
    // 3. All afterUpdate callbacks, in order: parents before children. EXCEPT
    //    for afterUpdates called during the initial onMount, which are called in
    //    reverse order: children before parents.
    // Since callbacks might update component values, which could trigger another
    // call to flush(), the following steps guard against this:
    // 1. During beforeUpdate, any updated components will be added to the
    //    dirty_components array and will cause a reentrant call to flush(). Because
    //    the flush index is kept outside the function, the reentrant call will pick
    //    up where the earlier call left off and go through all dirty components. The
    //    current_component value is saved and restored so that the reentrant call will
    //    not interfere with the "parent" flush() call.
    // 2. bind:this callbacks cannot trigger new flush() calls.
    // 3. During afterUpdate, any updated components will NOT have their afterUpdate
    //    callback called a second time; the seen_callbacks set, outside the flush()
    //    function, guarantees this behavior.
    const seen_callbacks = new Set();
    let flushidx = 0; // Do *not* move this inside the flush() function
    function flush() {
        // Do not reenter flush while dirty components are updated, as this can
        // result in an infinite loop. Instead, let the inner flush handle it.
        // Reentrancy is ok afterwards for bindings etc.
        if (flushidx !== 0) {
            return;
        }
        const saved_component = current_component;
        do {
            // first, call beforeUpdate functions
            // and update components
            try {
                while (flushidx < dirty_components.length) {
                    const component = dirty_components[flushidx];
                    flushidx++;
                    set_current_component(component);
                    update$1(component.$$);
                }
            }
            catch (e) {
                // reset dirty state to not end up in a deadlocked state and then rethrow
                dirty_components.length = 0;
                flushidx = 0;
                throw e;
            }
            set_current_component(null);
            dirty_components.length = 0;
            flushidx = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        seen_callbacks.clear();
        set_current_component(saved_component);
    }
    function update$1($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }
    /**
     * Useful for example to execute remaining `afterUpdate` callbacks before executing `destroy`.
     */
    function flush_render_callbacks(fns) {
        const filtered = [];
        const targets = [];
        render_callbacks.forEach((c) => fns.indexOf(c) === -1 ? filtered.push(c) : targets.push(c));
        targets.forEach((c) => c());
        render_callbacks = filtered;
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
        else if (callback) {
            callback();
        }
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
                // if the component was destroyed immediately
                // it will update the `$$.on_destroy` reference to `null`.
                // the destructured on_destroy may still reference to the old array
                if (component.$$.on_destroy) {
                    component.$$.on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            flush_render_callbacks($$.after_update);
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, append_styles, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: [],
            // state
            props,
            update: noop$1,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(options.context || (parent_component ? parent_component.$$.context : [])),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false,
            root: options.target || parent_component.$$.root
        };
        append_styles && append_styles($$.root);
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop$1;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop$1;
            }
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.56.0' }, detail), { bubbles: true }));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    /**
    * Copyright (c) 2023, Leon Sorokin
    * All rights reserved. (MIT Licensed)
    *
    * uPlot.js (μPlot)
    * A small, fast chart for time series, lines, areas, ohlc & bars
    * https://github.com/leeoniya/uPlot (v1.6.24)
    */

    const FEAT_TIME          = true;

    const pre = "u-";

    const UPLOT          =       "uplot";
    const ORI_HZ         = pre + "hz";
    const ORI_VT         = pre + "vt";
    const TITLE          = pre + "title";
    const WRAP           = pre + "wrap";
    const UNDER          = pre + "under";
    const OVER           = pre + "over";
    const AXIS           = pre + "axis";
    const OFF            = pre + "off";
    const SELECT         = pre + "select";
    const CURSOR_X       = pre + "cursor-x";
    const CURSOR_Y       = pre + "cursor-y";
    const CURSOR_PT      = pre + "cursor-pt";
    const LEGEND         = pre + "legend";
    const LEGEND_LIVE    = pre + "live";
    const LEGEND_INLINE  = pre + "inline";
    const LEGEND_THEAD   = pre + "thead";
    const LEGEND_SERIES  = pre + "series";
    const LEGEND_MARKER  = pre + "marker";
    const LEGEND_LABEL   = pre + "label";
    const LEGEND_VALUE   = pre + "value";

    const WIDTH       = "width";
    const HEIGHT      = "height";
    const TOP         = "top";
    const BOTTOM      = "bottom";
    const LEFT        = "left";
    const RIGHT       = "right";
    const hexBlack    = "#000";
    const transparent = hexBlack + "0";

    const mousemove   = "mousemove";
    const mousedown   = "mousedown";
    const mouseup     = "mouseup";
    const mouseenter  = "mouseenter";
    const mouseleave  = "mouseleave";
    const dblclick    = "dblclick";
    const resize      = "resize";
    const scroll      = "scroll";

    const change      = "change";
    const dppxchange  = "dppxchange";

    const LEGEND_DISP = "--";

    const domEnv = typeof window != 'undefined';

    const doc = domEnv ? document  : null;
    const win = domEnv ? window    : null;
    const nav = domEnv ? navigator : null;

    let pxRatio;

    //export const canHover = domEnv && !win.matchMedia('(hover: none)').matches;

    let query;

    function setPxRatio() {
    	let _pxRatio = devicePixelRatio;

    	// during print preview, Chrome fires off these dppx queries even without changes
    	if (pxRatio != _pxRatio) {
    		pxRatio = _pxRatio;

    		query && off(change, query, setPxRatio);
    		query = matchMedia(`(min-resolution: ${pxRatio - 0.001}dppx) and (max-resolution: ${pxRatio + 0.001}dppx)`);
    		on(change, query, setPxRatio);

    		win.dispatchEvent(new CustomEvent(dppxchange));
    	}
    }

    function addClass(el, c) {
    	if (c != null) {
    		let cl = el.classList;
    		!cl.contains(c) && cl.add(c);
    	}
    }

    function remClass(el, c) {
    	let cl = el.classList;
    	cl.contains(c) && cl.remove(c);
    }

    function setStylePx(el, name, value) {
    	el.style[name] = value + "px";
    }

    function placeTag(tag, cls, targ, refEl) {
    	let el = doc.createElement(tag);

    	if (cls != null)
    		addClass(el, cls);

    	if (targ != null)
    		targ.insertBefore(el, refEl);

    	return el;
    }

    function placeDiv(cls, targ) {
    	return placeTag("div", cls, targ);
    }

    const xformCache = new WeakMap();

    function elTrans(el, xPos, yPos, xMax, yMax) {
    	let xform = "translate(" + xPos + "px," + yPos + "px)";
    	let xformOld = xformCache.get(el);

    	if (xform != xformOld) {
    		el.style.transform = xform;
    		xformCache.set(el, xform);

    		if (xPos < 0 || yPos < 0 || xPos > xMax || yPos > yMax)
    			addClass(el, OFF);
    		else
    			remClass(el, OFF);
    	}
    }

    const colorCache = new WeakMap();

    function elColor(el, background, borderColor) {
    	let newColor = background + borderColor;
    	let oldColor = colorCache.get(el);

    	if (newColor != oldColor) {
    		colorCache.set(el, newColor);
    		el.style.background = background;
    		el.style.borderColor = borderColor;
    	}
    }

    const sizeCache = new WeakMap();

    function elSize(el, newWid, newHgt, centered) {
    	let newSize = newWid + "" + newHgt;
    	let oldSize = sizeCache.get(el);

    	if (newSize != oldSize) {
    		sizeCache.set(el, newSize);
    		el.style.height = newHgt + "px";
    		el.style.width = newWid + "px";
    		el.style.marginLeft = centered ? -newWid/2 + "px" : 0;
    		el.style.marginTop = centered ? -newHgt/2 + "px" : 0;
    	}
    }

    const evOpts = {passive: true};
    const evOpts2 = {...evOpts, capture: true};

    function on(ev, el, cb, capt) {
    	el.addEventListener(ev, cb, capt ? evOpts2 : evOpts);
    }

    function off(ev, el, cb, capt) {
    	el.removeEventListener(ev, cb, capt ? evOpts2 : evOpts);
    }

    domEnv && setPxRatio();

    // binary search for index of closest value
    function closestIdx(num, arr, lo, hi) {
    	let mid;
    	lo = lo || 0;
    	hi = hi || arr.length - 1;
    	let bitwise = hi <= 2147483647;

    	while (hi - lo > 1) {
    		mid = bitwise ? (lo + hi) >> 1 : floor((lo + hi) / 2);

    		if (arr[mid] < num)
    			lo = mid;
    		else
    			hi = mid;
    	}

    	if (num - arr[lo] <= arr[hi] - num)
    		return lo;

    	return hi;
    }

    function nonNullIdx(data, _i0, _i1, dir) {
    	for (let i = dir == 1 ? _i0 : _i1; i >= _i0 && i <= _i1; i += dir) {
    		if (data[i] != null)
    			return i;
    	}

    	return -1;
    }

    function getMinMax(data, _i0, _i1, sorted) {
    //	console.log("getMinMax()");

    	let _min = inf;
    	let _max = -inf;

    	if (sorted == 1) {
    		_min = data[_i0];
    		_max = data[_i1];
    	}
    	else if (sorted == -1) {
    		_min = data[_i1];
    		_max = data[_i0];
    	}
    	else {
    		for (let i = _i0; i <= _i1; i++) {
    			if (data[i] != null) {
    				_min = min(_min, data[i]);
    				_max = max(_max, data[i]);
    			}
    		}
    	}

    	return [_min, _max];
    }

    function getMinMaxLog(data, _i0, _i1) {
    //	console.log("getMinMax()");

    	let _min = inf;
    	let _max = -inf;

    	for (let i = _i0; i <= _i1; i++) {
    		if (data[i] > 0) {
    			_min = min(_min, data[i]);
    			_max = max(_max, data[i]);
    		}
    	}

    	return [
    		_min ==  inf ?  1 : _min,
    		_max == -inf ? 10 : _max,
    	];
    }

    function rangeLog(min, max, base, fullMags) {
    	let minSign = sign(min);
    	let maxSign = sign(max);

    	let logFn = base == 10 ? log10 : log2;

    	if (min == max) {
    		if (minSign == -1) {
    			min *= base;
    			max /= base;
    		}
    		else {
    			min /= base;
    			max *= base;
    		}
    	}

    	let growMinAbs = minSign == 1 ? floor : ceil;
    	let growMaxAbs = maxSign == 1 ? ceil : floor;

    	let minExp = growMinAbs(logFn(abs(min)));
    	let maxExp = growMaxAbs(logFn(abs(max)));

    	let minIncr = pow(base, minExp);
    	let maxIncr = pow(base, maxExp);

    	// fix values like Math.pow(10, -5) === 0.000009999999999999999
    	if (base == 10) {
    		if (minExp < 0)
    			minIncr = roundDec(minIncr, -minExp);
    		if (maxExp < 0)
    			maxIncr = roundDec(maxIncr, -maxExp);
    	}

    	if (fullMags || base == 2) {
    		min = minIncr * minSign;
    		max = maxIncr * maxSign;
    	}
    	else {
    		min = incrRoundDn(min, minIncr);
    		max = incrRoundUp(max, maxIncr);
    	}

    	return [min, max];
    }

    function rangeAsinh(min, max, base, fullMags) {
    	let minMax = rangeLog(min, max, base, fullMags);

    	if (min == 0)
    		minMax[0] = 0;

    	if (max == 0)
    		minMax[1] = 0;

    	return minMax;
    }

    const rangePad = 0.1;

    const autoRangePart = {
    	mode: 3,
    	pad: rangePad,
    };

    const _eqRangePart = {
    	pad:  0,
    	soft: null,
    	mode: 0,
    };

    const _eqRange = {
    	min: _eqRangePart,
    	max: _eqRangePart,
    };

    // this ensures that non-temporal/numeric y-axes get multiple-snapped padding added above/below
    // TODO: also account for incrs when snapping to ensure top of axis gets a tick & value
    function rangeNum(_min, _max, mult, extra) {
    	if (isObj(mult))
    		return _rangeNum(_min, _max, mult);

    	_eqRangePart.pad  = mult;
    	_eqRangePart.soft = extra ? 0 : null;
    	_eqRangePart.mode = extra ? 3 : 0;

    	return _rangeNum(_min, _max, _eqRange);
    }

    // nullish coalesce
    function ifNull(lh, rh) {
    	return lh == null ? rh : lh;
    }

    // checks if given index range in an array contains a non-null value
    // aka a range-bounded Array.some()
    function hasData(data, idx0, idx1) {
    	idx0 = ifNull(idx0, 0);
    	idx1 = ifNull(idx1, data.length - 1);

    	while (idx0 <= idx1) {
    		if (data[idx0] != null)
    			return true;
    		idx0++;
    	}

    	return false;
    }

    function _rangeNum(_min, _max, cfg) {
    	let cmin = cfg.min;
    	let cmax = cfg.max;

    	let padMin = ifNull(cmin.pad, 0);
    	let padMax = ifNull(cmax.pad, 0);

    	let hardMin = ifNull(cmin.hard, -inf);
    	let hardMax = ifNull(cmax.hard,  inf);

    	let softMin = ifNull(cmin.soft,  inf);
    	let softMax = ifNull(cmax.soft, -inf);

    	let softMinMode = ifNull(cmin.mode, 0);
    	let softMaxMode = ifNull(cmax.mode, 0);

    	let delta = _max - _min;
    	let deltaMag = log10(delta);

    	let scalarMax = max(abs(_min), abs(_max));
    	let scalarMag = log10(scalarMax);

    	let scalarMagDelta = abs(scalarMag - deltaMag);

    	// this handles situations like 89.7, 89.69999999999999
    	// by assuming 0.001x deltas are precision errors
    //	if (delta > 0 && delta < abs(_max) / 1e3)
    //		delta = 0;

    	// treat data as flat if delta is less than 1 billionth
    	// or range is 11+ orders of magnitude below raw values, e.g. 99999999.99999996 - 100000000.00000004
    	if (delta < 1e-9 || scalarMagDelta > 10) {
    		delta = 0;

    		// if soft mode is 2 and all vals are flat at 0, avoid the 0.1 * 1e3 fallback
    		// this prevents 0,0,0 from ranging to -100,100 when softMin/softMax are -1,1
    		if (_min == 0 || _max == 0) {
    			delta = 1e-9;

    			if (softMinMode == 2 && softMin != inf)
    				padMin = 0;

    			if (softMaxMode == 2 && softMax != -inf)
    				padMax = 0;
    		}
    	}

    	let nonZeroDelta = delta || scalarMax || 1e3;
    	let mag          = log10(nonZeroDelta);
    	let base         = pow(10, floor(mag));

    	let _padMin  = nonZeroDelta * (delta == 0 ? (_min == 0 ? .1 : 1) : padMin);
    	let _newMin  = roundDec(incrRoundDn(_min - _padMin, base/10), 9);
    	let _softMin = _min >= softMin && (softMinMode == 1 || softMinMode == 3 && _newMin <= softMin || softMinMode == 2 && _newMin >= softMin) ? softMin : inf;
    	let minLim   = max(hardMin, _newMin < _softMin && _min >= _softMin ? _softMin : min(_softMin, _newMin));

    	let _padMax  = nonZeroDelta * (delta == 0 ? (_max == 0 ? .1 : 1) : padMax);
    	let _newMax  = roundDec(incrRoundUp(_max + _padMax, base/10), 9);
    	let _softMax = _max <= softMax && (softMaxMode == 1 || softMaxMode == 3 && _newMax >= softMax || softMaxMode == 2 && _newMax <= softMax) ? softMax : -inf;
    	let maxLim   = min(hardMax, _newMax > _softMax && _max <= _softMax ? _softMax : max(_softMax, _newMax));

    	if (minLim == maxLim && minLim == 0)
    		maxLim = 100;

    	return [minLim, maxLim];
    }

    // alternative: https://stackoverflow.com/a/2254896
    const numFormatter = new Intl.NumberFormat(domEnv ? nav.language : 'en-US');
    const fmtNum = val => numFormatter.format(val);

    const M = Math;

    const PI = M.PI;
    const abs = M.abs;
    const floor = M.floor;
    const round = M.round;
    const ceil = M.ceil;
    const min = M.min;
    const max = M.max;
    const pow = M.pow;
    const sign = M.sign;
    const log10 = M.log10;
    const log2 = M.log2;
    // TODO: seems like this needs to match asinh impl if the passed v is tweaked?
    const sinh =  (v, linthresh = 1) => M.sinh(v) * linthresh;
    const asinh = (v, linthresh = 1) => M.asinh(v / linthresh);

    const inf = Infinity;

    function numIntDigits(x) {
    	return (log10((x ^ (x >> 31)) - (x >> 31)) | 0) + 1;
    }

    function clamp(num, _min, _max) {
    	return min(max(num, _min), _max);
    }

    function fnOrSelf(v) {
    	return typeof v == "function" ? v : () => v;
    }

    const noop = () => {};

    const retArg0 = _0 => _0;

    const retArg1 = (_0, _1) => _1;

    const retNull = _ => null;

    const retTrue = _ => true;

    const retEq = (a, b) => a == b;

    // this will probably prevent tick incrs > 14 decimal places
    // (we generate up to 17 dec, see fixedDec const)
    const fixFloat = v => roundDec(v, 14);

    function incrRound(num, incr) {
    	return fixFloat(roundDec(fixFloat(num/incr))*incr);
    }

    function incrRoundUp(num, incr) {
    	return fixFloat(ceil(fixFloat(num/incr))*incr);
    }

    function incrRoundDn(num, incr) {
    	return fixFloat(floor(fixFloat(num/incr))*incr);
    }

    // https://stackoverflow.com/a/48764436
    // rounds half away from zero
    function roundDec(val, dec = 0) {
    	if (isInt(val))
    		return val;
    //	else if (dec == 0)
    //		return round(val);

    	let p = 10 ** dec;
    	let n = (val * p) * (1 + Number.EPSILON);
    	return round(n) / p;
    }

    const fixedDec = new Map();

    function guessDec(num) {
    	return ((""+num).split(".")[1] || "").length;
    }

    function genIncrs(base, minExp, maxExp, mults) {
    	let incrs = [];

    	let multDec = mults.map(guessDec);

    	for (let exp = minExp; exp < maxExp; exp++) {
    		let expa = abs(exp);
    		let mag = roundDec(pow(base, exp), expa);

    		for (let i = 0; i < mults.length; i++) {
    			let _incr = mults[i] * mag;
    			let dec = (_incr >= 0 && exp >= 0 ? 0 : expa) + (exp >= multDec[i] ? 0 : multDec[i]);
    			let incr = roundDec(_incr, dec);
    			incrs.push(incr);
    			fixedDec.set(incr, dec);
    		}
    	}

    	return incrs;
    }

    //export const assign = Object.assign;

    const EMPTY_OBJ = {};
    const EMPTY_ARR = [];

    const nullNullTuple = [null, null];

    const isArr = Array.isArray;
    const isInt = Number.isInteger;
    const isUndef = v => v === void 0;

    function isStr(v) {
    	return typeof v == 'string';
    }

    function isObj(v) {
    	let is = false;

    	if (v != null) {
    		let c = v.constructor;
    		is = c == null || c == Object;
    	}

    	return is;
    }

    function fastIsObj(v) {
    	return v != null && typeof v == 'object';
    }

    const TypedArray = Object.getPrototypeOf(Uint8Array);

    function copy(o, _isObj = isObj) {
    	let out;

    	if (isArr(o)) {
    		let val = o.find(v => v != null);

    		if (isArr(val) || _isObj(val)) {
    			out = Array(o.length);
    			for (let i = 0; i < o.length; i++)
    				out[i] = copy(o[i], _isObj);
    		}
    		else
    			out = o.slice();
    	}
    	else if (o instanceof TypedArray) // also (ArrayBuffer.isView(o) && !(o instanceof DataView))
    		out = o.slice();
    	else if (_isObj(o)) {
    		out = {};
    		for (let k in o)
    			out[k] = copy(o[k], _isObj);
    	}
    	else
    		out = o;

    	return out;
    }

    function assign(targ) {
    	let args = arguments;

    	for (let i = 1; i < args.length; i++) {
    		let src = args[i];

    		for (let key in src) {
    			if (isObj(targ[key]))
    				assign(targ[key], copy(src[key]));
    			else
    				targ[key] = copy(src[key]);
    		}
    	}

    	return targ;
    }

    // nullModes
    const NULL_REMOVE = 0;  // nulls are converted to undefined (e.g. for spanGaps: true)
    const NULL_RETAIN = 1;  // nulls are retained, with alignment artifacts set to undefined (default)
    const NULL_EXPAND = 2;  // nulls are expanded to include any adjacent alignment artifacts

    // sets undefined values to nulls when adjacent to existing nulls (minesweeper)
    function nullExpand(yVals, nullIdxs, alignedLen) {
    	for (let i = 0, xi, lastNullIdx = -1; i < nullIdxs.length; i++) {
    		let nullIdx = nullIdxs[i];

    		if (nullIdx > lastNullIdx) {
    			xi = nullIdx - 1;
    			while (xi >= 0 && yVals[xi] == null)
    				yVals[xi--] = null;

    			xi = nullIdx + 1;
    			while (xi < alignedLen && yVals[xi] == null)
    				yVals[lastNullIdx = xi++] = null;
    		}
    	}
    }

    // nullModes is a tables-matched array indicating how to treat nulls in each series
    // output is sorted ASC on the joined field (table[0]) and duplicate join values are collapsed
    function join(tables, nullModes) {
    	let xVals = new Set();

    	for (let ti = 0; ti < tables.length; ti++) {
    		let t = tables[ti];
    		let xs = t[0];
    		let len = xs.length;

    		for (let i = 0; i < len; i++)
    			xVals.add(xs[i]);
    	}

    	let data = [Array.from(xVals).sort((a, b) => a - b)];

    	let alignedLen = data[0].length;

    	let xIdxs = new Map();

    	for (let i = 0; i < alignedLen; i++)
    		xIdxs.set(data[0][i], i);

    	for (let ti = 0; ti < tables.length; ti++) {
    		let t = tables[ti];
    		let xs = t[0];

    		for (let si = 1; si < t.length; si++) {
    			let ys = t[si];

    			let yVals = Array(alignedLen).fill(undefined);

    			let nullMode = nullModes ? nullModes[ti][si] : NULL_RETAIN;

    			let nullIdxs = [];

    			for (let i = 0; i < ys.length; i++) {
    				let yVal = ys[i];
    				let alignedIdx = xIdxs.get(xs[i]);

    				if (yVal === null) {
    					if (nullMode != NULL_REMOVE) {
    						yVals[alignedIdx] = yVal;

    						if (nullMode == NULL_EXPAND)
    							nullIdxs.push(alignedIdx);
    					}
    				}
    				else
    					yVals[alignedIdx] = yVal;
    			}

    			nullExpand(yVals, nullIdxs, alignedLen);

    			data.push(yVals);
    		}
    	}

    	return data;
    }

    const microTask = typeof queueMicrotask == "undefined" ? fn => Promise.resolve().then(fn) : queueMicrotask;

    const months = [
    	"January",
    	"February",
    	"March",
    	"April",
    	"May",
    	"June",
    	"July",
    	"August",
    	"September",
    	"October",
    	"November",
    	"December",
    ];

    const days = [
    	"Sunday",
    	"Monday",
    	"Tuesday",
    	"Wednesday",
    	"Thursday",
    	"Friday",
    	"Saturday",
    ];

    function slice3(str) {
    	return str.slice(0, 3);
    }

    const days3 = days.map(slice3);

    const months3 = months.map(slice3);

    const engNames = {
    	MMMM: months,
    	MMM:  months3,
    	WWWW: days,
    	WWW:  days3,
    };

    function zeroPad2(int) {
    	return (int < 10 ? '0' : '') + int;
    }

    function zeroPad3(int) {
    	return (int < 10 ? '00' : int < 100 ? '0' : '') + int;
    }

    /*
    function suffix(int) {
    	let mod10 = int % 10;

    	return int + (
    		mod10 == 1 && int != 11 ? "st" :
    		mod10 == 2 && int != 12 ? "nd" :
    		mod10 == 3 && int != 13 ? "rd" : "th"
    	);
    }
    */

    const subs = {
    	// 2019
    	YYYY:	d => d.getFullYear(),
    	// 19
    	YY:		d => (d.getFullYear()+'').slice(2),
    	// July
    	MMMM:	(d, names) => names.MMMM[d.getMonth()],
    	// Jul
    	MMM:	(d, names) => names.MMM[d.getMonth()],
    	// 07
    	MM:		d => zeroPad2(d.getMonth()+1),
    	// 7
    	M:		d => d.getMonth()+1,
    	// 09
    	DD:		d => zeroPad2(d.getDate()),
    	// 9
    	D:		d => d.getDate(),
    	// Monday
    	WWWW:	(d, names) => names.WWWW[d.getDay()],
    	// Mon
    	WWW:	(d, names) => names.WWW[d.getDay()],
    	// 03
    	HH:		d => zeroPad2(d.getHours()),
    	// 3
    	H:		d => d.getHours(),
    	// 9 (12hr, unpadded)
    	h:		d => {let h = d.getHours(); return h == 0 ? 12 : h > 12 ? h - 12 : h;},
    	// AM
    	AA:		d => d.getHours() >= 12 ? 'PM' : 'AM',
    	// am
    	aa:		d => d.getHours() >= 12 ? 'pm' : 'am',
    	// a
    	a:		d => d.getHours() >= 12 ? 'p' : 'a',
    	// 09
    	mm:		d => zeroPad2(d.getMinutes()),
    	// 9
    	m:		d => d.getMinutes(),
    	// 09
    	ss:		d => zeroPad2(d.getSeconds()),
    	// 9
    	s:		d => d.getSeconds(),
    	// 374
    	fff:	d => zeroPad3(d.getMilliseconds()),
    };

    function fmtDate(tpl, names) {
    	names = names || engNames;
    	let parts = [];

    	let R = /\{([a-z]+)\}|[^{]+/gi, m;

    	while (m = R.exec(tpl))
    		parts.push(m[0][0] == '{' ? subs[m[1]] : m[0]);

    	return d => {
    		let out = '';

    		for (let i = 0; i < parts.length; i++)
    			out += typeof parts[i] == "string" ? parts[i] : parts[i](d, names);

    		return out;
    	}
    }

    const localTz = new Intl.DateTimeFormat().resolvedOptions().timeZone;

    // https://stackoverflow.com/questions/15141762/how-to-initialize-a-javascript-date-to-a-particular-time-zone/53652131#53652131
    function tzDate$1(date, tz) {
    	let date2;

    	// perf optimization
    	if (tz == 'UTC' || tz == 'Etc/UTC')
    		date2 = new Date(+date + date.getTimezoneOffset() * 6e4);
    	else if (tz == localTz)
    		date2 = date;
    	else {
    		date2 = new Date(date.toLocaleString('en-US', {timeZone: tz}));
    		date2.setMilliseconds(date.getMilliseconds());
    	}

    	return date2;
    }

    //export const series = [];

    // default formatters:

    const onlyWhole = v => v % 1 == 0;

    const allMults = [1,2,2.5,5];

    // ...0.01, 0.02, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5
    const decIncrs = genIncrs(10, -16, 0, allMults);

    // 1, 2, 2.5, 5, 10, 20, 25, 50...
    const oneIncrs = genIncrs(10, 0, 16, allMults);

    // 1, 2,      5, 10, 20, 25, 50...
    const wholeIncrs = oneIncrs.filter(onlyWhole);

    const numIncrs = decIncrs.concat(oneIncrs);

    const NL = "\n";

    const yyyy    = "{YYYY}";
    const NLyyyy  = NL + yyyy;
    const md      = "{M}/{D}";
    const NLmd    = NL + md;
    const NLmdyy  = NLmd + "/{YY}";

    const aa      = "{aa}";
    const hmm     = "{h}:{mm}";
    const hmmaa   = hmm + aa;
    const NLhmmaa = NL + hmmaa;
    const ss      = ":{ss}";

    const _ = null;

    function genTimeStuffs(ms) {
    	let	s  = ms * 1e3,
    		m  = s  * 60,
    		h  = m  * 60,
    		d  = h  * 24,
    		mo = d  * 30,
    		y  = d  * 365;

    	// min of 1e-3 prevents setting a temporal x ticks too small since Date objects cannot advance ticks smaller than 1ms
    	let subSecIncrs = ms == 1 ? genIncrs(10, 0, 3, allMults).filter(onlyWhole) : genIncrs(10, -3, 0, allMults);

    	let timeIncrs = subSecIncrs.concat([
    		// minute divisors (# of secs)
    		s,
    		s * 5,
    		s * 10,
    		s * 15,
    		s * 30,
    		// hour divisors (# of mins)
    		m,
    		m * 5,
    		m * 10,
    		m * 15,
    		m * 30,
    		// day divisors (# of hrs)
    		h,
    		h * 2,
    		h * 3,
    		h * 4,
    		h * 6,
    		h * 8,
    		h * 12,
    		// month divisors TODO: need more?
    		d,
    		d * 2,
    		d * 3,
    		d * 4,
    		d * 5,
    		d * 6,
    		d * 7,
    		d * 8,
    		d * 9,
    		d * 10,
    		d * 15,
    		// year divisors (# months, approx)
    		mo,
    		mo * 2,
    		mo * 3,
    		mo * 4,
    		mo * 6,
    		// century divisors
    		y,
    		y * 2,
    		y * 5,
    		y * 10,
    		y * 25,
    		y * 50,
    		y * 100,
    	]);

    	// [0]:   minimum num secs in the tick incr
    	// [1]:   default tick format
    	// [2-7]: rollover tick formats
    	// [8]:   mode: 0: replace [1] -> [2-7], 1: concat [1] + [2-7]
    	const _timeAxisStamps = [
    	//   tick incr    default          year                    month   day                   hour    min       sec   mode
    		[y,           yyyy,            _,                      _,      _,                    _,      _,        _,       1],
    		[d * 28,      "{MMM}",         NLyyyy,                 _,      _,                    _,      _,        _,       1],
    		[d,           md,              NLyyyy,                 _,      _,                    _,      _,        _,       1],
    		[h,           "{h}" + aa,      NLmdyy,                 _,      NLmd,                 _,      _,        _,       1],
    		[m,           hmmaa,           NLmdyy,                 _,      NLmd,                 _,      _,        _,       1],
    		[s,           ss,              NLmdyy + " " + hmmaa,   _,      NLmd + " " + hmmaa,   _,      NLhmmaa,  _,       1],
    		[ms,          ss + ".{fff}",   NLmdyy + " " + hmmaa,   _,      NLmd + " " + hmmaa,   _,      NLhmmaa,  _,       1],
    	];

    	// the ensures that axis ticks, values & grid are aligned to logical temporal breakpoints and not an arbitrary timestamp
    	// https://www.timeanddate.com/time/dst/
    	// https://www.timeanddate.com/time/dst/2019.html
    	// https://www.epochconverter.com/timezones
    	function timeAxisSplits(tzDate) {
    		return (self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace) => {
    			let splits = [];
    			let isYr = foundIncr >= y;
    			let isMo = foundIncr >= mo && foundIncr < y;

    			// get the timezone-adjusted date
    			let minDate = tzDate(scaleMin);
    			let minDateTs = roundDec(minDate * ms, 3);

    			// get ts of 12am (this lands us at or before the original scaleMin)
    			let minMin = mkDate(minDate.getFullYear(), isYr ? 0 : minDate.getMonth(), isMo || isYr ? 1 : minDate.getDate());
    			let minMinTs = roundDec(minMin * ms, 3);

    			if (isMo || isYr) {
    				let moIncr = isMo ? foundIncr / mo : 0;
    				let yrIncr = isYr ? foundIncr / y  : 0;
    			//	let tzOffset = scaleMin - minDateTs;		// needed?
    				let split = minDateTs == minMinTs ? minDateTs : roundDec(mkDate(minMin.getFullYear() + yrIncr, minMin.getMonth() + moIncr, 1) * ms, 3);
    				let splitDate = new Date(round(split / ms));
    				let baseYear = splitDate.getFullYear();
    				let baseMonth = splitDate.getMonth();

    				for (let i = 0; split <= scaleMax; i++) {
    					let next = mkDate(baseYear + yrIncr * i, baseMonth + moIncr * i, 1);
    					let offs = next - tzDate(roundDec(next * ms, 3));

    					split = roundDec((+next + offs) * ms, 3);

    					if (split <= scaleMax)
    						splits.push(split);
    				}
    			}
    			else {
    				let incr0 = foundIncr >= d ? d : foundIncr;
    				let tzOffset = floor(scaleMin) - floor(minDateTs);
    				let split = minMinTs + tzOffset + incrRoundUp(minDateTs - minMinTs, incr0);
    				splits.push(split);

    				let date0 = tzDate(split);

    				let prevHour = date0.getHours() + (date0.getMinutes() / m) + (date0.getSeconds() / h);
    				let incrHours = foundIncr / h;

    				let minSpace = self.axes[axisIdx]._space;
    				let pctSpace = foundSpace / minSpace;

    				while (1) {
    					split = roundDec(split + foundIncr, ms == 1 ? 0 : 3);

    					if (split > scaleMax)
    						break;

    					if (incrHours > 1) {
    						let expectedHour = floor(roundDec(prevHour + incrHours, 6)) % 24;
    						let splitDate = tzDate(split);
    						let actualHour = splitDate.getHours();

    						let dstShift = actualHour - expectedHour;

    						if (dstShift > 1)
    							dstShift = -1;

    						split -= dstShift * h;

    						prevHour = (prevHour + incrHours) % 24;

    						// add a tick only if it's further than 70% of the min allowed label spacing
    						let prevSplit = splits[splits.length - 1];
    						let pctIncr = roundDec((split - prevSplit) / foundIncr, 3);

    						if (pctIncr * pctSpace >= .7)
    							splits.push(split);
    					}
    					else
    						splits.push(split);
    				}
    			}

    			return splits;
    		}
    	}

    	return [
    		timeIncrs,
    		_timeAxisStamps,
    		timeAxisSplits,
    	];
    }

    const [ timeIncrsMs, _timeAxisStampsMs, timeAxisSplitsMs ] = genTimeStuffs(1);
    const [ timeIncrsS,  _timeAxisStampsS,  timeAxisSplitsS  ] = genTimeStuffs(1e-3);

    // base 2
    genIncrs(2, -53, 53, [1]);

    /*
    console.log({
    	decIncrs,
    	oneIncrs,
    	wholeIncrs,
    	numIncrs,
    	timeIncrs,
    	fixedDec,
    });
    */

    function timeAxisStamps(stampCfg, fmtDate) {
    	return stampCfg.map(s => s.map((v, i) =>
    		i == 0 || i == 8 || v == null ? v : fmtDate(i == 1 || s[8] == 0 ? v : s[1] + v)
    	));
    }

    // TODO: will need to accept spaces[] and pull incr into the loop when grid will be non-uniform, eg for log scales.
    // currently we ignore this for months since they're *nearly* uniform and the added complexity is not worth it
    function timeAxisVals(tzDate, stamps) {
    	return (self, splits, axisIdx, foundSpace, foundIncr) => {
    		let s = stamps.find(s => foundIncr >= s[0]) || stamps[stamps.length - 1];

    		// these track boundaries when a full label is needed again
    		let prevYear;
    		let prevMnth;
    		let prevDate;
    		let prevHour;
    		let prevMins;
    		let prevSecs;

    		return splits.map(split => {
    			let date = tzDate(split);

    			let newYear = date.getFullYear();
    			let newMnth = date.getMonth();
    			let newDate = date.getDate();
    			let newHour = date.getHours();
    			let newMins = date.getMinutes();
    			let newSecs = date.getSeconds();

    			let stamp = (
    				newYear != prevYear && s[2] ||
    				newMnth != prevMnth && s[3] ||
    				newDate != prevDate && s[4] ||
    				newHour != prevHour && s[5] ||
    				newMins != prevMins && s[6] ||
    				newSecs != prevSecs && s[7] ||
    				                       s[1]
    			);

    			prevYear = newYear;
    			prevMnth = newMnth;
    			prevDate = newDate;
    			prevHour = newHour;
    			prevMins = newMins;
    			prevSecs = newSecs;

    			return stamp(date);
    		});
    	}
    }

    // for when axis.values is defined as a static fmtDate template string
    function timeAxisVal(tzDate, dateTpl) {
    	let stamp = fmtDate(dateTpl);
    	return (self, splits, axisIdx, foundSpace, foundIncr) => splits.map(split => stamp(tzDate(split)));
    }

    function mkDate(y, m, d) {
    	return new Date(y, m, d);
    }

    function timeSeriesStamp(stampCfg, fmtDate) {
    	return fmtDate(stampCfg);
    }
    const _timeSeriesStamp = '{YYYY}-{MM}-{DD} {h}:{mm}{aa}';

    function timeSeriesVal(tzDate, stamp) {
    	return (self, val, seriesIdx, dataIdx) => dataIdx == null ? LEGEND_DISP : stamp(tzDate(val));
    }

    function legendStroke(self, seriesIdx) {
    	let s = self.series[seriesIdx];
    	return s.width ? s.stroke(self, seriesIdx) : s.points.width ? s.points.stroke(self, seriesIdx) : null;
    }

    function legendFill(self, seriesIdx) {
    	return self.series[seriesIdx].fill(self, seriesIdx);
    }

    const legendOpts = {
    	show: true,
    	live: true,
    	isolate: false,
    	mount: noop,
    	markers: {
    		show: true,
    		width: 2,
    		stroke: legendStroke,
    		fill: legendFill,
    		dash: "solid",
    	},
    	idx: null,
    	idxs: null,
    	values: [],
    };

    function cursorPointShow(self, si) {
    	let o = self.cursor.points;

    	let pt = placeDiv();

    	let size = o.size(self, si);
    	setStylePx(pt, WIDTH, size);
    	setStylePx(pt, HEIGHT, size);

    	let mar = size / -2;
    	setStylePx(pt, "marginLeft", mar);
    	setStylePx(pt, "marginTop", mar);

    	let width = o.width(self, si, size);
    	width && setStylePx(pt, "borderWidth", width);

    	return pt;
    }

    function cursorPointFill(self, si) {
    	let sp = self.series[si].points;
    	return sp._fill || sp._stroke;
    }

    function cursorPointStroke(self, si) {
    	let sp = self.series[si].points;
    	return sp._stroke || sp._fill;
    }

    function cursorPointSize(self, si) {
    	let sp = self.series[si].points;
    	return sp.size;
    }

    function dataIdx(self, seriesIdx, cursorIdx) {
    	return cursorIdx;
    }

    const moveTuple = [0,0];

    function cursorMove(self, mouseLeft1, mouseTop1) {
    	moveTuple[0] = mouseLeft1;
    	moveTuple[1] = mouseTop1;
    	return moveTuple;
    }

    function filtBtn0(self, targ, handle) {
    	return e => {
    		e.button == 0 && handle(e);
    	};
    }

    function passThru(self, targ, handle) {
    	return handle;
    }

    const cursorOpts = {
    	show: true,
    	x: true,
    	y: true,
    	lock: false,
    	move: cursorMove,
    	points: {
    		show:   cursorPointShow,
    		size:   cursorPointSize,
    		width:  0,
    		stroke: cursorPointStroke,
    		fill:   cursorPointFill,
    	},

    	bind: {
    		mousedown:   filtBtn0,
    		mouseup:     filtBtn0,
    		click:       filtBtn0,
    		dblclick:    filtBtn0,

    		mousemove:   passThru,
    		mouseleave:  passThru,
    		mouseenter:  passThru,
    	},

    	drag: {
    		setScale: true,
    		x: true,
    		y: false,
    		dist: 0,
    		uni: null,
    		click: (self, e) => {
    		//	e.preventDefault();
    			e.stopPropagation();
    			e.stopImmediatePropagation();
    		},
    		_x: false,
    		_y: false,
    	},

    	focus: {
    		prox: -1,
    		bias: 0,
    	},

    	left: -10,
    	top: -10,
    	idx: null,
    	dataIdx,
    	idxs: null,
    };

    const axisLines = {
    	show: true,
    	stroke: "rgba(0,0,0,0.07)",
    	width: 2,
    //	dash: [],
    };

    const grid = assign({}, axisLines, {
    	filter: retArg1,
    });

    const ticks = assign({}, grid, {
    	size: 10,
    });

    const border = assign({}, axisLines, {
    	show: false,
    });

    const font      = '12px system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"';
    const labelFont = "bold " + font;
    const lineMult = 1.5;		// font-size multiplier

    const xAxisOpts = {
    	show: true,
    	scale: "x",
    	stroke: hexBlack,
    	space: 50,
    	gap: 5,
    	size: 50,
    	labelGap: 0,
    	labelSize: 30,
    	labelFont,
    	side: 2,
    //	class: "x-vals",
    //	incrs: timeIncrs,
    //	values: timeVals,
    //	filter: retArg1,
    	grid,
    	ticks,
    	border,
    	font,
    	rotate: 0,
    };

    const numSeriesLabel = "Value";
    const timeSeriesLabel = "Time";

    const xSeriesOpts = {
    	show: true,
    	scale: "x",
    	auto: false,
    	sorted: 1,
    //	label: "Time",
    //	value: v => stamp(new Date(v * 1e3)),

    	// internal caches
    	min: inf,
    	max: -inf,
    	idxs: [],
    };

    function numAxisVals(self, splits, axisIdx, foundSpace, foundIncr) {
    	return splits.map(v => v == null ? "" : fmtNum(v));
    }

    function numAxisSplits(self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace, forceMin) {
    	let splits = [];

    	let numDec = fixedDec.get(foundIncr) || 0;

    	scaleMin = forceMin ? scaleMin : roundDec(incrRoundUp(scaleMin, foundIncr), numDec);

    	for (let val = scaleMin; val <= scaleMax; val = roundDec(val + foundIncr, numDec))
    		splits.push(Object.is(val, -0) ? 0 : val);		// coalesces -0

    	return splits;
    }

    // this doesnt work for sin, which needs to come off from 0 independently in pos and neg dirs
    function logAxisSplits(self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace, forceMin) {
    	const splits = [];

    	const logBase = self.scales[self.axes[axisIdx].scale].log;

    	const logFn = logBase == 10 ? log10 : log2;

    	const exp = floor(logFn(scaleMin));

    	foundIncr = pow(logBase, exp);

    	if (logBase == 10 && exp < 0)
    		foundIncr = roundDec(foundIncr, -exp);

    	let split = scaleMin;

    	do {
    		splits.push(split);
    		split = split + foundIncr;

    		if (logBase == 10)
    			split = roundDec(split, fixedDec.get(foundIncr));

    		if (split >= foundIncr * logBase)
    			foundIncr = split;

    	} while (split <= scaleMax);

    	return splits;
    }

    function asinhAxisSplits(self, axisIdx, scaleMin, scaleMax, foundIncr, foundSpace, forceMin) {
    	let sc = self.scales[self.axes[axisIdx].scale];

    	let linthresh = sc.asinh;

    	let posSplits = scaleMax > linthresh ? logAxisSplits(self, axisIdx, max(linthresh, scaleMin), scaleMax, foundIncr) : [linthresh];
    	let zero = scaleMax >= 0 && scaleMin <= 0 ? [0] : [];
    	let negSplits = scaleMin < -linthresh ? logAxisSplits(self, axisIdx, max(linthresh, -scaleMax), -scaleMin, foundIncr): [linthresh];

    	return negSplits.reverse().map(v => -v).concat(zero, posSplits);
    }

    const RE_ALL   = /./;
    const RE_12357 = /[12357]/;
    const RE_125   = /[125]/;
    const RE_1     = /1/;

    function log10AxisValsFilt(self, splits, axisIdx, foundSpace, foundIncr) {
    	let axis = self.axes[axisIdx];
    	let scaleKey = axis.scale;
    	let sc = self.scales[scaleKey];

    	if (sc.distr == 3 && sc.log == 2)
    		return splits;

    	let valToPos = self.valToPos;

    	let minSpace = axis._space;

    	let _10 = valToPos(10, scaleKey);

    	let re = (
    		valToPos(9, scaleKey) - _10 >= minSpace ? RE_ALL :
    		valToPos(7, scaleKey) - _10 >= minSpace ? RE_12357 :
    		valToPos(5, scaleKey) - _10 >= minSpace ? RE_125 :
    		RE_1
    	);

    	return splits.map(v => ((sc.distr == 4 && v == 0) || re.test(v)) ? v : null);
    }

    function numSeriesVal(self, val, seriesIdx, dataIdx) {
    	return dataIdx == null ? LEGEND_DISP : val == null ? "" : fmtNum(val);
    }

    const yAxisOpts = {
    	show: true,
    	scale: "y",
    	stroke: hexBlack,
    	space: 30,
    	gap: 5,
    	size: 50,
    	labelGap: 0,
    	labelSize: 30,
    	labelFont,
    	side: 3,
    //	class: "y-vals",
    //	incrs: numIncrs,
    //	values: (vals, space) => vals,
    //	filter: retArg1,
    	grid,
    	ticks,
    	border,
    	font,
    	rotate: 0,
    };

    // takes stroke width
    function ptDia(width, mult) {
    	let dia = 3 + (width || 1) * 2;
    	return roundDec(dia * mult, 3);
    }

    function seriesPointsShow(self, si) {
    	let { scale, idxs } = self.series[0];
    	let xData = self._data[0];
    	let p0 = self.valToPos(xData[idxs[0]], scale, true);
    	let p1 = self.valToPos(xData[idxs[1]], scale, true);
    	let dim = abs(p1 - p0);

    	let s = self.series[si];
    //	const dia = ptDia(s.width, pxRatio);
    	let maxPts = dim / (s.points.space * pxRatio);
    	return idxs[1] - idxs[0] <= maxPts;
    }

    const facet = {
    	scale: null,
    	auto: true,
    	sorted: 0,

    	// internal caches
    	min: inf,
    	max: -inf,
    };

    const gaps = (self, seriesIdx, idx0, idx1, nullGaps) => nullGaps;

    const xySeriesOpts = {
    	show: true,
    	auto: true,
    	sorted: 0,
    	gaps,
    	alpha: 1,
    	facets: [
    		assign({}, facet, {scale: 'x'}),
    		assign({}, facet, {scale: 'y'}),
    	],
    };

    const ySeriesOpts = {
    	scale: "y",
    	auto: true,
    	sorted: 0,
    	show: true,
    	spanGaps: false,
    	gaps,
    	alpha: 1,
    	points: {
    		show: seriesPointsShow,
    		filter: null,
    	//  paths:
    	//	stroke: "#000",
    	//	fill: "#fff",
    	//	width: 1,
    	//	size: 10,
    	},
    //	label: "Value",
    //	value: v => v,
    	values: null,

    	// internal caches
    	min: inf,
    	max: -inf,
    	idxs: [],

    	path: null,
    	clip: null,
    };

    function clampScale(self, val, scaleMin, scaleMax, scaleKey) {
    /*
    	if (val < 0) {
    		let cssHgt = self.bbox.height / pxRatio;
    		let absPos = self.valToPos(abs(val), scaleKey);
    		let fromBtm = cssHgt - absPos;
    		return self.posToVal(cssHgt + fromBtm, scaleKey);
    	}
    */
    	return scaleMin / 10;
    }

    const xScaleOpts = {
    	time: FEAT_TIME,
    	auto: true,
    	distr: 1,
    	log: 10,
    	asinh: 1,
    	min: null,
    	max: null,
    	dir: 1,
    	ori: 0,
    };

    const yScaleOpts = assign({}, xScaleOpts, {
    	time: false,
    	ori: 1,
    });

    const syncs = {};

    function _sync(key, opts) {
    	let s = syncs[key];

    	if (!s) {
    		s = {
    			key,
    			plots: [],
    			sub(plot) {
    				s.plots.push(plot);
    			},
    			unsub(plot) {
    				s.plots = s.plots.filter(c => c != plot);
    			},
    			pub(type, self, x, y, w, h, i) {
    				for (let j = 0; j < s.plots.length; j++)
    					s.plots[j] != self && s.plots[j].pub(type, self, x, y, w, h, i);
    			},
    		};

    		if (key != null)
    			syncs[key] = s;
    	}

    	return s;
    }

    const BAND_CLIP_FILL   = 1 << 0;
    const BAND_CLIP_STROKE = 1 << 1;

    function orient(u, seriesIdx, cb) {
    	const mode = u.mode;
    	const series = u.series[seriesIdx];
    	const data = mode == 2 ? u._data[seriesIdx] : u._data;
    	const scales = u.scales;
    	const bbox   = u.bbox;

    	let dx = data[0],
    		dy = mode == 2 ? data[1] : data[seriesIdx],
    		sx = mode == 2 ? scales[series.facets[0].scale] : scales[u.series[0].scale],
    		sy = mode == 2 ? scales[series.facets[1].scale] : scales[series.scale],
    		l = bbox.left,
    		t = bbox.top,
    		w = bbox.width,
    		h = bbox.height,
    		H = u.valToPosH,
    		V = u.valToPosV;

    	return (sx.ori == 0
    		? cb(
    			series,
    			dx,
    			dy,
    			sx,
    			sy,
    			H,
    			V,
    			l,
    			t,
    			w,
    			h,
    			moveToH,
    			lineToH,
    			rectH,
    			arcH,
    			bezierCurveToH,
    		)
    		: cb(
    			series,
    			dx,
    			dy,
    			sx,
    			sy,
    			V,
    			H,
    			t,
    			l,
    			h,
    			w,
    			moveToV,
    			lineToV,
    			rectV,
    			arcV,
    			bezierCurveToV,
    		)
    	);
    }

    function bandFillClipDirs(self, seriesIdx) {
    	let fillDir = 0;

    	// 2 bits, -1 | 1
    	let clipDirs = 0;

    	let bands = ifNull(self.bands, EMPTY_ARR);

    	for (let i = 0; i < bands.length; i++) {
    		let b = bands[i];

    		// is a "from" band edge
    		if (b.series[0] == seriesIdx)
    			fillDir = b.dir;
    		// is a "to" band edge
    		else if (b.series[1] == seriesIdx) {
    			if (b.dir == 1)
    				clipDirs |= 1;
    			else
    				clipDirs |= 2;
    		}
    	}

    	return [
    		fillDir,
    		(
    			clipDirs == 1 ? -1 : // neg only
    			clipDirs == 2 ?  1 : // pos only
    			clipDirs == 3 ?  2 : // both
    			                 0   // neither
    		)
    	];
    }

    function seriesFillTo(self, seriesIdx, dataMin, dataMax, bandFillDir) {
    	let mode = self.mode;
    	let series = self.series[seriesIdx];
    	let scaleKey = mode == 2 ? series.facets[1].scale : series.scale;
    	let scale = self.scales[scaleKey];

    	return (
    		bandFillDir == -1 ? scale.min :
    		bandFillDir ==  1 ? scale.max :
    		scale.distr ==  3 ? (
    			scale.dir == 1 ? scale.min :
    			scale.max
    		) : 0
    	);
    }

    // creates inverted band clip path (from stroke path -> yMax || yMin)
    // clipDir is always inverse of fillDir
    // default clip dir is upwards (1), since default band fill is downwards/fillBelowTo (-1) (highIdx -> lowIdx)
    function clipBandLine(self, seriesIdx, idx0, idx1, strokePath, clipDir) {
    	return orient(self, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
    		let pxRound = series.pxRound;

    		const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);
    		const lineTo = scaleX.ori == 0 ? lineToH : lineToV;

    		let frIdx, toIdx;

    		if (dir == 1) {
    			frIdx = idx0;
    			toIdx = idx1;
    		}
    		else {
    			frIdx = idx1;
    			toIdx = idx0;
    		}

    		// path start
    		let x0 = pxRound(valToPosX(dataX[frIdx], scaleX, xDim, xOff));
    		let y0 = pxRound(valToPosY(dataY[frIdx], scaleY, yDim, yOff));
    		// path end x
    		let x1 = pxRound(valToPosX(dataX[toIdx], scaleX, xDim, xOff));
    		// upper or lower y limit
    		let yLimit = pxRound(valToPosY(clipDir == 1 ? scaleY.max : scaleY.min, scaleY, yDim, yOff));

    		let clip = new Path2D(strokePath);

    		lineTo(clip, x1, yLimit);
    		lineTo(clip, x0, yLimit);
    		lineTo(clip, x0, y0);

    		return clip;
    	});
    }

    function clipGaps(gaps, ori, plotLft, plotTop, plotWid, plotHgt) {
    	let clip = null;

    	// create clip path (invert gaps and non-gaps)
    	if (gaps.length > 0) {
    		clip = new Path2D();

    		const rect = ori == 0 ? rectH : rectV;

    		let prevGapEnd = plotLft;

    		for (let i = 0; i < gaps.length; i++) {
    			let g = gaps[i];

    			if (g[1] > g[0]) {
    				let w = g[0] - prevGapEnd;

    				w > 0 && rect(clip, prevGapEnd, plotTop, w, plotTop + plotHgt);

    				prevGapEnd = g[1];
    			}
    		}

    		let w = plotLft + plotWid - prevGapEnd;

    		w > 0 && rect(clip, prevGapEnd, plotTop, w, plotTop + plotHgt);
    	}

    	return clip;
    }

    function addGap(gaps, fromX, toX) {
    	let prevGap = gaps[gaps.length - 1];

    	if (prevGap && prevGap[0] == fromX)			// TODO: gaps must be encoded at stroke widths?
    		prevGap[1] = toX;
    	else
    		gaps.push([fromX, toX]);
    }

    function findGaps(xs, ys, idx0, idx1, dir, pixelForX, align) {
    	let gaps = [];
    	let len = xs.length;

    	for (let i = dir == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += dir) {
    		let yVal = ys[i];

    		if (yVal === null) {
    			let fr = i, to = i;

    			if (dir == 1) {
    				while (++i <= idx1 && ys[i] === null)
    					to = i;
    			}
    			else {
    				while (--i >= idx0 && ys[i] === null)
    					to = i;
    			}

    			let frPx = pixelForX(xs[fr]);
    			let toPx = to == fr ? frPx : pixelForX(xs[to]);

    			// if value adjacent to edge null is same pixel, then it's partially
    			// filled and gap should start at next pixel
    			let fri2 = fr - dir;
    			let frPx2 = align <= 0 && fri2 >= 0 && fri2 < len ? pixelForX(xs[fri2]) : frPx;
    		//	if (frPx2 == frPx)
    		//		frPx++;
    		//	else
    				frPx = frPx2;

    			let toi2 = to + dir;
    			let toPx2 = align >= 0 && toi2 >= 0 && toi2 < len ? pixelForX(xs[toi2]) : toPx;
    		//	if (toPx2 == toPx)
    		//		toPx--;
    		//	else
    				toPx = toPx2;

    			if (toPx >= frPx)
    				gaps.push([frPx, toPx]); // addGap
    		}
    	}

    	return gaps;
    }

    function pxRoundGen(pxAlign) {
    	return pxAlign == 0 ? retArg0 : pxAlign == 1 ? round : v => incrRound(v, pxAlign);
    }

    function rect(ori) {
    	let moveTo = ori == 0 ?
    		moveToH :
    		moveToV;

    	let arcTo = ori == 0 ?
    		(p, x1, y1, x2, y2, r) => { p.arcTo(x1, y1, x2, y2, r); } :
    		(p, y1, x1, y2, x2, r) => { p.arcTo(x1, y1, x2, y2, r); };

    	let rect = ori == 0 ?
    		(p, x, y, w, h) => { p.rect(x, y, w, h); } :
    		(p, y, x, h, w) => { p.rect(x, y, w, h); };

    	// TODO (pending better browser support): https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/roundRect
    	return (p, x, y, w, h, endRad = 0, baseRad = 0) => {
    		if (endRad == 0 && baseRad == 0)
    			rect(p, x, y, w, h);
    		else {
    			endRad  = min(endRad,  w / 2, h / 2);
    			baseRad = min(baseRad, w / 2, h / 2);

    			// adapted from https://stackoverflow.com/questions/1255512/how-to-draw-a-rounded-rectangle-using-html-canvas/7838871#7838871
    			moveTo(p, x + endRad, y);
    			arcTo(p, x + w, y, x + w, y + h, endRad);
    			arcTo(p, x + w, y + h, x, y + h, baseRad);
    			arcTo(p, x, y + h, x, y, baseRad);
    			arcTo(p, x, y, x + w, y, endRad);
    			p.closePath();
    		}
    	};
    }

    // orientation-inverting canvas functions
    const moveToH = (p, x, y) => { p.moveTo(x, y); };
    const moveToV = (p, y, x) => { p.moveTo(x, y); };
    const lineToH = (p, x, y) => { p.lineTo(x, y); };
    const lineToV = (p, y, x) => { p.lineTo(x, y); };
    const rectH = rect(0);
    const rectV = rect(1);
    const arcH = (p, x, y, r, startAngle, endAngle) => { p.arc(x, y, r, startAngle, endAngle); };
    const arcV = (p, y, x, r, startAngle, endAngle) => { p.arc(x, y, r, startAngle, endAngle); };
    const bezierCurveToH = (p, bp1x, bp1y, bp2x, bp2y, p2x, p2y) => { p.bezierCurveTo(bp1x, bp1y, bp2x, bp2y, p2x, p2y); };
    const bezierCurveToV = (p, bp1y, bp1x, bp2y, bp2x, p2y, p2x) => { p.bezierCurveTo(bp1x, bp1y, bp2x, bp2y, p2x, p2y); };

    // TODO: drawWrap(seriesIdx, drawPoints) (save, restore, translate, clip)
    function points(opts) {
    	return (u, seriesIdx, idx0, idx1, filtIdxs) => {
    	//	log("drawPoints()", arguments);

    		return orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
    			let { pxRound, points } = series;

    			let moveTo, arc;

    			if (scaleX.ori == 0) {
    				moveTo = moveToH;
    				arc = arcH;
    			}
    			else {
    				moveTo = moveToV;
    				arc = arcV;
    			}

    			const width = roundDec(points.width * pxRatio, 3);

    			let rad = (points.size - points.width) / 2 * pxRatio;
    			let dia = roundDec(rad * 2, 3);

    			let fill = new Path2D();
    			let clip = new Path2D();

    			let { left: lft, top: top, width: wid, height: hgt } = u.bbox;

    			rectH(clip,
    				lft - dia,
    				top - dia,
    				wid + dia * 2,
    				hgt + dia * 2,
    			);

    			const drawPoint = pi => {
    				if (dataY[pi] != null) {
    					let x = pxRound(valToPosX(dataX[pi], scaleX, xDim, xOff));
    					let y = pxRound(valToPosY(dataY[pi], scaleY, yDim, yOff));

    					moveTo(fill, x + rad, y);
    					arc(fill, x, y, rad, 0, PI * 2);
    				}
    			};

    			if (filtIdxs)
    				filtIdxs.forEach(drawPoint);
    			else {
    				for (let pi = idx0; pi <= idx1; pi++)
    					drawPoint(pi);
    			}

    			return {
    				stroke: width > 0 ? fill : null,
    				fill,
    				clip,
    				flags: BAND_CLIP_FILL | BAND_CLIP_STROKE,
    			};
    		});
    	};
    }

    function _drawAcc(lineTo) {
    	return (stroke, accX, minY, maxY, inY, outY) => {
    		if (minY != maxY) {
    			if (inY != minY && outY != minY)
    				lineTo(stroke, accX, minY);
    			if (inY != maxY && outY != maxY)
    				lineTo(stroke, accX, maxY);

    			lineTo(stroke, accX, outY);
    		}
    	};
    }

    const drawAccH = _drawAcc(lineToH);
    const drawAccV = _drawAcc(lineToV);

    function linear(opts) {
    	const alignGaps = ifNull(opts?.alignGaps, 0);

    	return (u, seriesIdx, idx0, idx1) => {
    		return orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
    			let pxRound = series.pxRound;

    			let pixelForX = val => pxRound(valToPosX(val, scaleX, xDim, xOff));
    			let pixelForY = val => pxRound(valToPosY(val, scaleY, yDim, yOff));

    			let lineTo, drawAcc;

    			if (scaleX.ori == 0) {
    				lineTo = lineToH;
    				drawAcc = drawAccH;
    			}
    			else {
    				lineTo = lineToV;
    				drawAcc = drawAccV;
    			}

    			const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);

    			const _paths = {stroke: new Path2D(), fill: null, clip: null, band: null, gaps: null, flags: BAND_CLIP_FILL};
    			const stroke = _paths.stroke;

    			let minY = inf,
    				maxY = -inf,
    				inY, outY, drawnAtX;

    			let accX = pixelForX(dataX[dir == 1 ? idx0 : idx1]);

    			// data edges
    			let lftIdx = nonNullIdx(dataY, idx0, idx1,  1 * dir);
    			let rgtIdx = nonNullIdx(dataY, idx0, idx1, -1 * dir);
    			let lftX   =  pixelForX(dataX[lftIdx]);
    			let rgtX   =  pixelForX(dataX[rgtIdx]);

    			let hasGap = false;

    			for (let i = dir == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += dir) {
    				let x = pixelForX(dataX[i]);
    				let yVal = dataY[i];

    				if (x == accX) {
    					if (yVal != null) {
    						outY = pixelForY(yVal);

    						if (minY == inf) {
    							lineTo(stroke, x, outY);
    							inY = outY;
    						}

    						minY = min(outY, minY);
    						maxY = max(outY, maxY);
    					}
    					else {
    						if (yVal === null)
    							hasGap = true;
    					}
    				}
    				else {
    					if (minY != inf) {
    						drawAcc(stroke, accX, minY, maxY, inY, outY);
    						drawnAtX = accX;
    					}

    					if (yVal != null) {
    						outY = pixelForY(yVal);
    						lineTo(stroke, x, outY);
    						minY = maxY = inY = outY;
    					}
    					else {
    						minY = inf;
    						maxY = -inf;

    						if (yVal === null)
    							hasGap = true;
    					}

    					accX = x;
    				}
    			}

    			if (minY != inf && minY != maxY && drawnAtX != accX)
    				drawAcc(stroke, accX, minY, maxY, inY, outY);

    			let [ bandFillDir, bandClipDir ] = bandFillClipDirs(u, seriesIdx);

    			if (series.fill != null || bandFillDir != 0) {
    				let fill = _paths.fill = new Path2D(stroke);

    				let fillToVal = series.fillTo(u, seriesIdx, series.min, series.max, bandFillDir);
    				let fillToY = pixelForY(fillToVal);

    				lineTo(fill, rgtX, fillToY);
    				lineTo(fill, lftX, fillToY);
    			}

    			if (!series.spanGaps) {
    			//	console.time('gaps');
    				let gaps = [];

    				hasGap && gaps.push(...findGaps(dataX, dataY, idx0, idx1, dir, pixelForX, alignGaps));

    			//	console.timeEnd('gaps');

    			//	console.log('gaps', JSON.stringify(gaps));

    				_paths.gaps = gaps = series.gaps(u, seriesIdx, idx0, idx1, gaps);

    				_paths.clip = clipGaps(gaps, scaleX.ori, xOff, yOff, xDim, yDim);
    			}

    			if (bandClipDir != 0) {
    				_paths.band = bandClipDir == 2 ? [
    					clipBandLine(u, seriesIdx, idx0, idx1, stroke, -1),
    					clipBandLine(u, seriesIdx, idx0, idx1, stroke,  1),
    				] : clipBandLine(u, seriesIdx, idx0, idx1, stroke, bandClipDir);
    			}

    			return _paths;
    		});
    	};
    }

    // BUG: align: -1 behaves like align: 1 when scale.dir: -1
    function stepped(opts) {
    	const align = ifNull(opts.align, 1);
    	// whether to draw ascenders/descenders at null/gap bondaries
    	const ascDesc = ifNull(opts.ascDesc, false);
    	const alignGaps = ifNull(opts.alignGaps, 0);
    	const extend = ifNull(opts.extend, false);

    	return (u, seriesIdx, idx0, idx1) => {
    		return orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
    			let pxRound = series.pxRound;

    			let { left, width } = u.bbox;

    			let pixelForX = val => pxRound(valToPosX(val, scaleX, xDim, xOff));
    			let pixelForY = val => pxRound(valToPosY(val, scaleY, yDim, yOff));

    			let lineTo = scaleX.ori == 0 ? lineToH : lineToV;

    			const _paths = {stroke: new Path2D(), fill: null, clip: null, band: null, gaps: null, flags: BAND_CLIP_FILL};
    			const stroke = _paths.stroke;

    			const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);

    			idx0 = nonNullIdx(dataY, idx0, idx1,  1);
    			idx1 = nonNullIdx(dataY, idx0, idx1, -1);

    			let prevYPos  = pixelForY(dataY[dir == 1 ? idx0 : idx1]);
    			let firstXPos = pixelForX(dataX[dir == 1 ? idx0 : idx1]);
    			let prevXPos = firstXPos;

    			let firstXPosExt = firstXPos;

    			if (extend && align == -1) {
    				firstXPosExt = left;
    				lineTo(stroke, firstXPosExt, prevYPos);
    			}

    			lineTo(stroke, firstXPos, prevYPos);

    			for (let i = dir == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += dir) {
    				let yVal1 = dataY[i];

    				if (yVal1 == null)
    					continue;

    				let x1 = pixelForX(dataX[i]);
    				let y1 = pixelForY(yVal1);

    				if (align == 1)
    					lineTo(stroke, x1, prevYPos);
    				else
    					lineTo(stroke, prevXPos, y1);

    				lineTo(stroke, x1, y1);

    				prevYPos = y1;
    				prevXPos = x1;
    			}

    			let prevXPosExt = prevXPos;

    			if (extend && align == 1) {
    				prevXPosExt = left + width;
    				lineTo(stroke, prevXPosExt, prevYPos);
    			}

    			let [ bandFillDir, bandClipDir ] = bandFillClipDirs(u, seriesIdx);

    			if (series.fill != null || bandFillDir != 0) {
    				let fill = _paths.fill = new Path2D(stroke);

    				let fillTo = series.fillTo(u, seriesIdx, series.min, series.max, bandFillDir);
    				let fillToY = pixelForY(fillTo);

    				lineTo(fill, prevXPosExt, fillToY);
    				lineTo(fill, firstXPosExt, fillToY);
    			}

    			if (!series.spanGaps) {
    			//	console.time('gaps');
    				let gaps = [];

    				gaps.push(...findGaps(dataX, dataY, idx0, idx1, dir, pixelForX, alignGaps));

    			//	console.timeEnd('gaps');

    			//	console.log('gaps', JSON.stringify(gaps));

    				// expand/contract clips for ascenders/descenders
    				let halfStroke = (series.width * pxRatio) / 2;
    				let startsOffset = (ascDesc || align ==  1) ?  halfStroke : -halfStroke;
    				let endsOffset   = (ascDesc || align == -1) ? -halfStroke :  halfStroke;

    				gaps.forEach(g => {
    					g[0] += startsOffset;
    					g[1] += endsOffset;
    				});

    				_paths.gaps = gaps = series.gaps(u, seriesIdx, idx0, idx1, gaps);

    				_paths.clip = clipGaps(gaps, scaleX.ori, xOff, yOff, xDim, yDim);
    			}

    			if (bandClipDir != 0) {
    				_paths.band = bandClipDir == 2 ? [
    					clipBandLine(u, seriesIdx, idx0, idx1, stroke, -1),
    					clipBandLine(u, seriesIdx, idx0, idx1, stroke,  1),
    				] : clipBandLine(u, seriesIdx, idx0, idx1, stroke, bandClipDir);
    			}

    			return _paths;
    		});
    	};
    }

    function bars(opts) {
    	opts = opts || EMPTY_OBJ;
    	const size = ifNull(opts.size, [0.6, inf, 1]);
    	const align = opts.align || 0;
    	const extraGap = (opts.gap || 0) * pxRatio;

    	let ro = opts.radius;

    	ro =
    		// [valueRadius, baselineRadius]
    		ro == null ? [0, 0] :
    		typeof ro == 'number' ? [ro, 0] : ro;

    	const radiusFn = fnOrSelf(ro);

    	const gapFactor = 1 - size[0];
    	const maxWidth  = ifNull(size[1], inf) * pxRatio;
    	const minWidth  = ifNull(size[2], 1) * pxRatio;

    	const disp = ifNull(opts.disp, EMPTY_OBJ);
    	const _each = ifNull(opts.each, _ => {});

    	const { fill: dispFills, stroke: dispStrokes } = disp;

    	return (u, seriesIdx, idx0, idx1) => {
    		return orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
    			let pxRound = series.pxRound;

    			let valRadius, baseRadius;

    			if (scaleX.ori == 0)
    				[valRadius, baseRadius] = radiusFn(u, seriesIdx);
    			else
    				[baseRadius, valRadius] = radiusFn(u, seriesIdx);

    			const _dirX = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);
    			const _dirY = scaleY.dir * (scaleY.ori == 1 ? 1 : -1);

    			let rect = scaleX.ori == 0 ? rectH : rectV;

    			let each = scaleX.ori == 0 ? _each : (u, seriesIdx, i, top, lft, hgt, wid) => {
    				_each(u, seriesIdx, i, lft, top, wid, hgt);
    			};

    			let [ bandFillDir, bandClipDir ] = bandFillClipDirs(u, seriesIdx);

    		//	let fillToY = series.fillTo(u, seriesIdx, series.min, series.max, bandFillDir);
    			let fillToY = scaleY.distr == 3 ? (bandFillDir == 1 ? scaleY.max : scaleY.min) : 0;

    			let y0Pos = valToPosY(fillToY, scaleY, yDim, yOff);

    			// barWid is to center of stroke
    			let xShift, barWid;

    			let strokeWidth = pxRound(series.width * pxRatio);

    			let multiPath = false;

    			let fillColors = null;
    			let fillPaths = null;
    			let strokeColors = null;
    			let strokePaths = null;

    			if (dispFills != null && (strokeWidth == 0 || dispStrokes != null)) {
    				multiPath = true;

    				fillColors = dispFills.values(u, seriesIdx, idx0, idx1);
    				fillPaths = new Map();
    				(new Set(fillColors)).forEach(color => {
    					if (color != null)
    						fillPaths.set(color, new Path2D());
    				});

    				if (strokeWidth > 0) {
    					strokeColors = dispStrokes.values(u, seriesIdx, idx0, idx1);
    					strokePaths = new Map();
    					(new Set(strokeColors)).forEach(color => {
    						if (color != null)
    							strokePaths.set(color, new Path2D());
    					});
    				}
    			}

    			let { x0, size } = disp;

    			if (x0 != null && size != null) {
    				dataX = x0.values(u, seriesIdx, idx0, idx1);

    				if (x0.unit == 2)
    					dataX = dataX.map(pct => u.posToVal(xOff + pct * xDim, scaleX.key, true));

    				// assumes uniform sizes, for now
    				let sizes = size.values(u, seriesIdx, idx0, idx1);

    				if (size.unit == 2)
    					barWid = sizes[0] * xDim;
    				else
    					barWid = valToPosX(sizes[0], scaleX, xDim, xOff) - valToPosX(0, scaleX, xDim, xOff); // assumes linear scale (delta from 0)

    				barWid = pxRound(barWid - strokeWidth);

    				xShift = (_dirX == 1 ? -strokeWidth / 2 : barWid + strokeWidth / 2);
    			}
    			else {
    				let colWid = xDim;

    				if (dataX.length > 1) {
    					// prior index with non-undefined y data
    					let prevIdx = null;

    					// scan full dataset for smallest adjacent delta
    					// will not work properly for non-linear x scales, since does not do expensive valToPosX calcs till end
    					for (let i = 0, minDelta = Infinity; i < dataX.length; i++) {
    						if (dataY[i] !== undefined) {
    							if (prevIdx != null) {
    								let delta = abs(dataX[i] - dataX[prevIdx]);

    								if (delta < minDelta) {
    									minDelta = delta;
    									colWid = abs(valToPosX(dataX[i], scaleX, xDim, xOff) - valToPosX(dataX[prevIdx], scaleX, xDim, xOff));
    								}
    							}

    							prevIdx = i;
    						}
    					}
    				}

    				let gapWid = colWid * gapFactor;

    				barWid = pxRound(min(maxWidth, max(minWidth, colWid - gapWid)) - strokeWidth - extraGap);

    				xShift = (align == 0 ? barWid / 2 : align == _dirX ? 0 : barWid) - align * _dirX * extraGap / 2;
    			}

    			const _paths = {stroke: null, fill: null, clip: null, band: null, gaps: null, flags: BAND_CLIP_FILL | BAND_CLIP_STROKE};  // disp, geom

    			let yLimit;

    			if (bandClipDir != 0) {
    				_paths.band = new Path2D();
    				yLimit = pxRound(valToPosY(bandClipDir == 1 ? scaleY.max : scaleY.min, scaleY, yDim, yOff));
    			}

    			const stroke = multiPath ? null : new Path2D();
    			const band = _paths.band;

    			let { y0, y1 } = disp;

    			let dataY0 = null;

    			if (y0 != null && y1 != null) {
    				dataY = y1.values(u, seriesIdx, idx0, idx1);
    				dataY0 = y0.values(u, seriesIdx, idx0, idx1);
    			}

    			let radVal = valRadius * barWid;
    			let radBase = baseRadius * barWid;

    			for (let i = _dirX == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += _dirX) {
    				let yVal = dataY[i];

    				// we can skip both, drawing and band clipping for alignment artifacts
    				if (yVal === undefined)
    					continue;

    			/*
    				// interpolate upwards band clips
    				if (yVal == null) {
    				//	if (hasBands)
    				//		yVal = costlyLerp(i, idx0, idx1, _dirX, dataY);
    				//	else
    						continue;
    				}
    			*/

    				let xVal = scaleX.distr != 2 || disp != null ? dataX[i] : i;

    				// TODO: all xPos can be pre-computed once for all series in aligned set
    				let xPos = valToPosX(xVal, scaleX, xDim, xOff);
    				let yPos = valToPosY(ifNull(yVal, fillToY), scaleY, yDim, yOff);

    				if (dataY0 != null && yVal != null)
    					y0Pos = valToPosY(dataY0[i], scaleY, yDim, yOff);

    				let lft = pxRound(xPos - xShift);
    				let btm = pxRound(max(yPos, y0Pos));
    				let top = pxRound(min(yPos, y0Pos));
    				// this includes the stroke
    				let barHgt = btm - top;

    				if (yVal != null) {  // && yVal != fillToY (0 height bar)
    					let rv = yVal < 0 ? radBase : radVal;
    					let rb = yVal < 0 ? radVal : radBase;

    					if (multiPath) {
    						if (strokeWidth > 0 && strokeColors[i] != null)
    							rect(strokePaths.get(strokeColors[i]), lft, top + floor(strokeWidth / 2), barWid, max(0, barHgt - strokeWidth), rv, rb);

    						if (fillColors[i] != null)
    							rect(fillPaths.get(fillColors[i]), lft, top + floor(strokeWidth / 2), barWid, max(0, barHgt - strokeWidth), rv, rb);
    					}
    					else
    						rect(stroke, lft, top + floor(strokeWidth / 2), barWid, max(0, barHgt - strokeWidth), rv, rb);

    					each(u, seriesIdx, i,
    						lft    - strokeWidth / 2,
    						top,
    						barWid + strokeWidth,
    						barHgt,
    					);
    				}

    				if (bandClipDir != 0) {
    					if (_dirY * bandClipDir == 1) {
    						btm = top;
    						top = yLimit;
    					}
    					else {
    						top = btm;
    						btm = yLimit;
    					}

    					barHgt = btm - top;

    					rect(band, lft - strokeWidth / 2, top, barWid + strokeWidth, max(0, barHgt), 0, 0);  // radius here?
    				}
    			}

    			if (strokeWidth > 0)
    				_paths.stroke = multiPath ? strokePaths : stroke;

    			_paths.fill = multiPath ? fillPaths : stroke;

    			return _paths;
    		});
    	};
    }

    function splineInterp(interp, opts) {
    	const alignGaps = ifNull(opts?.alignGaps, 0);

    	return (u, seriesIdx, idx0, idx1) => {
    		return orient(u, seriesIdx, (series, dataX, dataY, scaleX, scaleY, valToPosX, valToPosY, xOff, yOff, xDim, yDim) => {
    			let pxRound = series.pxRound;

    			let pixelForX = val => pxRound(valToPosX(val, scaleX, xDim, xOff));
    			let pixelForY = val => pxRound(valToPosY(val, scaleY, yDim, yOff));

    			let moveTo, bezierCurveTo, lineTo;

    			if (scaleX.ori == 0) {
    				moveTo = moveToH;
    				lineTo = lineToH;
    				bezierCurveTo = bezierCurveToH;
    			}
    			else {
    				moveTo = moveToV;
    				lineTo = lineToV;
    				bezierCurveTo = bezierCurveToV;
    			}

    			const dir = scaleX.dir * (scaleX.ori == 0 ? 1 : -1);

    			idx0 = nonNullIdx(dataY, idx0, idx1,  1);
    			idx1 = nonNullIdx(dataY, idx0, idx1, -1);

    			let firstXPos = pixelForX(dataX[dir == 1 ? idx0 : idx1]);
    			let prevXPos = firstXPos;

    			let xCoords = [];
    			let yCoords = [];

    			for (let i = dir == 1 ? idx0 : idx1; i >= idx0 && i <= idx1; i += dir) {
    				let yVal = dataY[i];

    				if (yVal != null) {
    					let xVal = dataX[i];
    					let xPos = pixelForX(xVal);

    					xCoords.push(prevXPos = xPos);
    					yCoords.push(pixelForY(dataY[i]));
    				}
    			}

    			const _paths = {stroke: interp(xCoords, yCoords, moveTo, lineTo, bezierCurveTo, pxRound), fill: null, clip: null, band: null, gaps: null, flags: BAND_CLIP_FILL};
    			const stroke = _paths.stroke;

    			let [ bandFillDir, bandClipDir ] = bandFillClipDirs(u, seriesIdx);

    			if (series.fill != null || bandFillDir != 0) {
    				let fill = _paths.fill = new Path2D(stroke);

    				let fillTo = series.fillTo(u, seriesIdx, series.min, series.max, bandFillDir);
    				let fillToY = pixelForY(fillTo);

    				lineTo(fill, prevXPos, fillToY);
    				lineTo(fill, firstXPos, fillToY);
    			}

    			if (!series.spanGaps) {
    			//	console.time('gaps');
    				let gaps = [];

    				gaps.push(...findGaps(dataX, dataY, idx0, idx1, dir, pixelForX, alignGaps));

    			//	console.timeEnd('gaps');

    			//	console.log('gaps', JSON.stringify(gaps));

    				_paths.gaps = gaps = series.gaps(u, seriesIdx, idx0, idx1, gaps);

    				_paths.clip = clipGaps(gaps, scaleX.ori, xOff, yOff, xDim, yDim);
    			}

    			if (bandClipDir != 0) {
    				_paths.band = bandClipDir == 2 ? [
    					clipBandLine(u, seriesIdx, idx0, idx1, stroke, -1),
    					clipBandLine(u, seriesIdx, idx0, idx1, stroke,  1),
    				] : clipBandLine(u, seriesIdx, idx0, idx1, stroke, bandClipDir);
    			}

    			return _paths;

    			//  if FEAT_PATHS: false in rollup.config.js
    			//	u.ctx.save();
    			//	u.ctx.beginPath();
    			//	u.ctx.rect(u.bbox.left, u.bbox.top, u.bbox.width, u.bbox.height);
    			//	u.ctx.clip();
    			//	u.ctx.strokeStyle = u.series[sidx].stroke;
    			//	u.ctx.stroke(stroke);
    			//	u.ctx.fillStyle = u.series[sidx].fill;
    			//	u.ctx.fill(fill);
    			//	u.ctx.restore();
    			//	return null;
    		});
    	};
    }

    function monotoneCubic(opts) {
    	return splineInterp(_monotoneCubic, opts);
    }

    // Monotone Cubic Spline interpolation, adapted from the Chartist.js implementation:
    // https://github.com/gionkunz/chartist-js/blob/e7e78201bffe9609915e5e53cfafa29a5d6c49f9/src/scripts/interpolation.js#L240-L369
    function _monotoneCubic(xs, ys, moveTo, lineTo, bezierCurveTo, pxRound) {
    	const n = xs.length;

    	if (n < 2)
    		return null;

    	const path = new Path2D();

    	moveTo(path, xs[0], ys[0]);

    	if (n == 2)
    		lineTo(path, xs[1], ys[1]);
    	else {
    		let ms  = Array(n),
    			ds  = Array(n - 1),
    			dys = Array(n - 1),
    			dxs = Array(n - 1);

    		// calc deltas and derivative
    		for (let i = 0; i < n - 1; i++) {
    			dys[i] = ys[i + 1] - ys[i];
    			dxs[i] = xs[i + 1] - xs[i];
    			ds[i]  = dys[i] / dxs[i];
    		}

    		// determine desired slope (m) at each point using Fritsch-Carlson method
    		// http://math.stackexchange.com/questions/45218/implementation-of-monotone-cubic-interpolation
    		ms[0] = ds[0];

    		for (let i = 1; i < n - 1; i++) {
    			if (ds[i] === 0 || ds[i - 1] === 0 || (ds[i - 1] > 0) !== (ds[i] > 0))
    				ms[i] = 0;
    			else {
    				ms[i] = 3 * (dxs[i - 1] + dxs[i]) / (
    					(2 * dxs[i] + dxs[i - 1]) / ds[i - 1] +
    					(dxs[i] + 2 * dxs[i - 1]) / ds[i]
    				);

    				if (!isFinite(ms[i]))
    					ms[i] = 0;
    			}
    		}

    		ms[n - 1] = ds[n - 2];

    		for (let i = 0; i < n - 1; i++) {
    			bezierCurveTo(
    				path,
    				xs[i] + dxs[i] / 3,
    				ys[i] + ms[i] * dxs[i] / 3,
    				xs[i + 1] - dxs[i] / 3,
    				ys[i + 1] - ms[i + 1] * dxs[i] / 3,
    				xs[i + 1],
    				ys[i + 1],
    			);
    		}
    	}

    	return path;
    }

    const cursorPlots = new Set();

    function invalidateRects() {
    	for (let u of cursorPlots)
    		u.syncRect(true);
    }

    if (domEnv) {
    	on(resize, win, invalidateRects);
    	on(scroll, win, invalidateRects, true);
    	on(dppxchange, win, () => { uPlot.pxRatio = pxRatio; });
    }

    const linearPath = linear() ;
    const pointsPath = points() ;

    function setDefaults(d, xo, yo, initY) {
    	let d2 = initY ? [d[0], d[1]].concat(d.slice(2)) : [d[0]].concat(d.slice(1));
    	return d2.map((o, i) => setDefault(o, i, xo, yo));
    }

    function setDefaults2(d, xyo) {
    	return d.map((o, i) => i == 0 ? null : assign({}, xyo, o));  // todo: assign() will not merge facet arrays
    }

    function setDefault(o, i, xo, yo) {
    	return assign({}, (i == 0 ? xo : yo), o);
    }

    function snapNumX(self, dataMin, dataMax) {
    	return dataMin == null ? nullNullTuple : [dataMin, dataMax];
    }

    const snapTimeX = snapNumX;

    // this ensures that non-temporal/numeric y-axes get multiple-snapped padding added above/below
    // TODO: also account for incrs when snapping to ensure top of axis gets a tick & value
    function snapNumY(self, dataMin, dataMax) {
    	return dataMin == null ? nullNullTuple : rangeNum(dataMin, dataMax, rangePad, true);
    }

    function snapLogY(self, dataMin, dataMax, scale) {
    	return dataMin == null ? nullNullTuple : rangeLog(dataMin, dataMax, self.scales[scale].log, false);
    }

    const snapLogX = snapLogY;

    function snapAsinhY(self, dataMin, dataMax, scale) {
    	return dataMin == null ? nullNullTuple : rangeAsinh(dataMin, dataMax, self.scales[scale].log, false);
    }

    const snapAsinhX = snapAsinhY;

    // dim is logical (getClientBoundingRect) pixels, not canvas pixels
    function findIncr(minVal, maxVal, incrs, dim, minSpace) {
    	let intDigits = max(numIntDigits(minVal), numIntDigits(maxVal));

    	let delta = maxVal - minVal;

    	let incrIdx = closestIdx((minSpace / dim) * delta, incrs);

    	do {
    		let foundIncr = incrs[incrIdx];
    		let foundSpace = dim * foundIncr / delta;

    		if (foundSpace >= minSpace && intDigits + (foundIncr < 5 ? fixedDec.get(foundIncr) : 0) <= 17)
    			return [foundIncr, foundSpace];
    	} while (++incrIdx < incrs.length);

    	return [0, 0];
    }

    function pxRatioFont(font) {
    	let fontSize, fontSizeCss;
    	font = font.replace(/(\d+)px/, (m, p1) => (fontSize = round((fontSizeCss = +p1) * pxRatio)) + 'px');
    	return [font, fontSize, fontSizeCss];
    }

    function syncFontSize(axis) {
    	if (axis.show) {
    		[axis.font, axis.labelFont].forEach(f => {
    			let size = roundDec(f[2] * pxRatio, 1);
    			f[0] = f[0].replace(/[0-9.]+px/, size + 'px');
    			f[1] = size;
    		});
    	}
    }

    function uPlot(opts, data, then) {
    	const self = {
    		mode: ifNull(opts.mode, 1),
    	};

    	const mode = self.mode;

    	// TODO: cache denoms & mins scale.cache = {r, min, }
    	function getValPct(val, scale) {
    		let _val = (
    			scale.distr == 3 ? log10(val > 0 ? val : scale.clamp(self, val, scale.min, scale.max, scale.key)) :
    			scale.distr == 4 ? asinh(val, scale.asinh) :
    			val
    		);

    		return (_val - scale._min) / (scale._max - scale._min);
    	}

    	function getHPos(val, scale, dim, off) {
    		let pct = getValPct(val, scale);
    		return off + dim * (scale.dir == -1 ? (1 - pct) : pct);
    	}

    	function getVPos(val, scale, dim, off) {
    		let pct = getValPct(val, scale);
    		return off + dim * (scale.dir == -1 ? pct : (1 - pct));
    	}

    	function getPos(val, scale, dim, off) {
    		return scale.ori == 0 ? getHPos(val, scale, dim, off) : getVPos(val, scale, dim, off);
    	}

    	self.valToPosH = getHPos;
    	self.valToPosV = getVPos;

    	let ready = false;
    	self.status = 0;

    	const root = self.root = placeDiv(UPLOT);

    	if (opts.id != null)
    		root.id = opts.id;

    	addClass(root, opts.class);

    	if (opts.title) {
    		let title = placeDiv(TITLE, root);
    		title.textContent = opts.title;
    	}

    	const can = placeTag("canvas");
    	const ctx = self.ctx = can.getContext("2d");

    	const wrap = placeDiv(WRAP, root);

    	on("click", wrap, e => {
    		let didDrag = mouseLeft1 != mouseLeft0 || mouseTop1 != mouseTop0;
    		didDrag && drag.click(self, e);
    	}, true);

    	const under = self.under = placeDiv(UNDER, wrap);
    	wrap.appendChild(can);
    	const over = self.over = placeDiv(OVER, wrap);

    	opts = copy(opts);

    	const pxAlign = +ifNull(opts.pxAlign, 1);

    	const pxRound = pxRoundGen(pxAlign);

    	(opts.plugins || []).forEach(p => {
    		if (p.opts)
    			opts = p.opts(self, opts) || opts;
    	});

    	const ms = opts.ms || 1e-3;

    	const series  = self.series = mode == 1 ?
    		setDefaults(opts.series || [], xSeriesOpts, ySeriesOpts, false) :
    		setDefaults2(opts.series || [null], xySeriesOpts);
    	const axes    = self.axes   = setDefaults(opts.axes   || [], xAxisOpts,   yAxisOpts,    true);
    	const scales  = self.scales = {};
    	const bands   = self.bands  = opts.bands || [];

    	bands.forEach(b => {
    		b.fill = fnOrSelf(b.fill || null);
    		b.dir = ifNull(b.dir, -1);
    	});

    	const xScaleKey = mode == 2 ? series[1].facets[0].scale : series[0].scale;

    	const drawOrderMap = {
    		axes: drawAxesGrid,
    		series: drawSeries,
    	};

    	const drawOrder = (opts.drawOrder || ["axes", "series"]).map(key => drawOrderMap[key]);

    	function initScale(scaleKey) {
    		let sc = scales[scaleKey];

    		if (sc == null) {
    			let scaleOpts = (opts.scales || EMPTY_OBJ)[scaleKey] || EMPTY_OBJ;

    			if (scaleOpts.from != null) {
    				// ensure parent is initialized
    				initScale(scaleOpts.from);
    				// dependent scales inherit
    				scales[scaleKey] = assign({}, scales[scaleOpts.from], scaleOpts, {key: scaleKey});
    			}
    			else {
    				sc = scales[scaleKey] = assign({}, (scaleKey == xScaleKey ? xScaleOpts : yScaleOpts), scaleOpts);

    				sc.key = scaleKey;

    				let isTime = sc.time;

    				let rn = sc.range;

    				let rangeIsArr = isArr(rn);

    				if (scaleKey != xScaleKey || (mode == 2 && !isTime)) {
    					// if range array has null limits, it should be auto
    					if (rangeIsArr && (rn[0] == null || rn[1] == null)) {
    						rn = {
    							min: rn[0] == null ? autoRangePart : {
    								mode: 1,
    								hard: rn[0],
    								soft: rn[0],
    							},
    							max: rn[1] == null ? autoRangePart : {
    								mode: 1,
    								hard: rn[1],
    								soft: rn[1],
    							},
    						};
    						rangeIsArr = false;
    					}

    					if (!rangeIsArr && isObj(rn)) {
    						let cfg = rn;
    						// this is similar to snapNumY
    						rn = (self, dataMin, dataMax) => dataMin == null ? nullNullTuple : rangeNum(dataMin, dataMax, cfg);
    					}
    				}

    				sc.range = fnOrSelf(rn || (isTime ? snapTimeX : scaleKey == xScaleKey ?
    					(sc.distr == 3 ? snapLogX : sc.distr == 4 ? snapAsinhX : snapNumX) :
    					(sc.distr == 3 ? snapLogY : sc.distr == 4 ? snapAsinhY : snapNumY)
    				));

    				sc.auto = fnOrSelf(rangeIsArr ? false : sc.auto);

    				sc.clamp = fnOrSelf(sc.clamp || clampScale);

    				// caches for expensive ops like asinh() & log()
    				sc._min = sc._max = null;
    			}
    		}
    	}

    	initScale("x");
    	initScale("y");

    	// TODO: init scales from facets in mode: 2
    	if (mode == 1) {
    		series.forEach(s => {
    			initScale(s.scale);
    		});
    	}

    	axes.forEach(a => {
    		initScale(a.scale);
    	});

    	for (let k in opts.scales)
    		initScale(k);

    	const scaleX = scales[xScaleKey];

    	const xScaleDistr = scaleX.distr;

    	let valToPosX, valToPosY;

    	if (scaleX.ori == 0) {
    		addClass(root, ORI_HZ);
    		valToPosX = getHPos;
    		valToPosY = getVPos;
    		/*
    		updOriDims = () => {
    			xDimCan = plotWid;
    			xOffCan = plotLft;
    			yDimCan = plotHgt;
    			yOffCan = plotTop;

    			xDimCss = plotWidCss;
    			xOffCss = plotLftCss;
    			yDimCss = plotHgtCss;
    			yOffCss = plotTopCss;
    		};
    		*/
    	}
    	else {
    		addClass(root, ORI_VT);
    		valToPosX = getVPos;
    		valToPosY = getHPos;
    		/*
    		updOriDims = () => {
    			xDimCan = plotHgt;
    			xOffCan = plotTop;
    			yDimCan = plotWid;
    			yOffCan = plotLft;

    			xDimCss = plotHgtCss;
    			xOffCss = plotTopCss;
    			yDimCss = plotWidCss;
    			yOffCss = plotLftCss;
    		};
    		*/
    	}

    	const pendScales = {};

    	// explicitly-set initial scales
    	for (let k in scales) {
    		let sc = scales[k];

    		if (sc.min != null || sc.max != null) {
    			pendScales[k] = {min: sc.min, max: sc.max};
    			sc.min = sc.max = null;
    		}
    	}

    //	self.tz = opts.tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
    	const _tzDate  = (opts.tzDate || (ts => new Date(round(ts / ms))));
    	const _fmtDate = (opts.fmtDate || fmtDate);

    	const _timeAxisSplits = (ms == 1 ? timeAxisSplitsMs(_tzDate) : timeAxisSplitsS(_tzDate));
    	const _timeAxisVals   = timeAxisVals(_tzDate, timeAxisStamps((ms == 1 ? _timeAxisStampsMs : _timeAxisStampsS), _fmtDate));
    	const _timeSeriesVal  = timeSeriesVal(_tzDate, timeSeriesStamp(_timeSeriesStamp, _fmtDate));

    	const activeIdxs = [];

    	const legend     = (self.legend = assign({}, legendOpts, opts.legend));
    	const showLegend = legend.show;
    	const markers    = legend.markers;

    	{
    		legend.idxs = activeIdxs;

    		markers.width  = fnOrSelf(markers.width);
    		markers.dash   = fnOrSelf(markers.dash);
    		markers.stroke = fnOrSelf(markers.stroke);
    		markers.fill   = fnOrSelf(markers.fill);
    	}

    	let legendEl;
    	let legendRows = [];
    	let legendCells = [];
    	let legendCols;
    	let multiValLegend = false;
    	let NULL_LEGEND_VALUES = {};

    	if (legend.live) {
    		const getMultiVals = series[1] ? series[1].values : null;
    		multiValLegend = getMultiVals != null;
    		legendCols = multiValLegend ? getMultiVals(self, 1, 0) : {_: 0};

    		for (let k in legendCols)
    			NULL_LEGEND_VALUES[k] = LEGEND_DISP;
    	}

    	if (showLegend) {
    		legendEl = placeTag("table", LEGEND, root);

    		legend.mount(self, legendEl);

    		if (multiValLegend) {
    			let head = placeTag("tr", LEGEND_THEAD, legendEl);
    			placeTag("th", null, head);

    			for (var key in legendCols)
    				placeTag("th", LEGEND_LABEL, head).textContent = key;
    		}
    		else {
    			addClass(legendEl, LEGEND_INLINE);
    			legend.live && addClass(legendEl, LEGEND_LIVE);
    		}
    	}

    	const son  = {show: true};
    	const soff = {show: false};

    	function initLegendRow(s, i) {
    		if (i == 0 && (multiValLegend || !legend.live || mode == 2))
    			return nullNullTuple;

    		let cells = [];

    		let row = placeTag("tr", LEGEND_SERIES, legendEl, legendEl.childNodes[i]);

    		addClass(row, s.class);

    		if (!s.show)
    			addClass(row, OFF);

    		let label = placeTag("th", null, row);

    		if (markers.show) {
    			let indic = placeDiv(LEGEND_MARKER, label);

    			if (i > 0) {
    				let width  = markers.width(self, i);

    				if (width)
    					indic.style.border = width + "px " + markers.dash(self, i) + " " + markers.stroke(self, i);

    				indic.style.background = markers.fill(self, i);
    			}
    		}

    		let text = placeDiv(LEGEND_LABEL, label);
    		text.textContent = s.label;

    		if (i > 0) {
    			if (!markers.show)
    				text.style.color = s.width > 0 ? markers.stroke(self, i) : markers.fill(self, i);

    			onMouse("click", label, e => {
    				if (cursor._lock)
    					return;

    				let seriesIdx = series.indexOf(s);

    				if ((e.ctrlKey || e.metaKey) != legend.isolate) {
    					// if any other series is shown, isolate this one. else show all
    					let isolate = series.some((s, i) => i > 0 && i != seriesIdx && s.show);

    					series.forEach((s, i) => {
    						i > 0 && setSeries(i, isolate ? (i == seriesIdx ? son : soff) : son, true, syncOpts.setSeries);
    					});
    				}
    				else
    					setSeries(seriesIdx, {show: !s.show}, true, syncOpts.setSeries);
    			});

    			if (cursorFocus) {
    				onMouse(mouseenter, label, e => {
    					if (cursor._lock)
    						return;

    					setSeries(series.indexOf(s), FOCUS_TRUE, true, syncOpts.setSeries);
    				});
    			}
    		}

    		for (var key in legendCols) {
    			let v = placeTag("td", LEGEND_VALUE, row);
    			v.textContent = "--";
    			cells.push(v);
    		}

    		return [row, cells];
    	}

    	const mouseListeners = new Map();

    	function onMouse(ev, targ, fn) {
    		const targListeners = mouseListeners.get(targ) || {};
    		const listener = cursor.bind[ev](self, targ, fn);

    		if (listener) {
    			on(ev, targ, targListeners[ev] = listener);
    			mouseListeners.set(targ, targListeners);
    		}
    	}

    	function offMouse(ev, targ, fn) {
    		const targListeners = mouseListeners.get(targ) || {};

    		for (let k in targListeners) {
    			if (ev == null || k == ev) {
    				off(k, targ, targListeners[k]);
    				delete targListeners[k];
    			}
    		}

    		if (ev == null)
    			mouseListeners.delete(targ);
    	}

    	let fullWidCss = 0;
    	let fullHgtCss = 0;

    	let plotWidCss = 0;
    	let plotHgtCss = 0;

    	// plot margins to account for axes
    	let plotLftCss = 0;
    	let plotTopCss = 0;

    	let plotLft = 0;
    	let plotTop = 0;
    	let plotWid = 0;
    	let plotHgt = 0;

    	self.bbox = {};

    	let shouldSetScales = false;
    	let shouldSetSize = false;
    	let shouldConvergeSize = false;
    	let shouldSetCursor = false;
    	let shouldSetSelect = false;
    	let shouldSetLegend = false;

    	function _setSize(width, height, force) {
    		if (force || (width != self.width || height != self.height))
    			calcSize(width, height);

    		resetYSeries(false);

    		shouldConvergeSize = true;
    		shouldSetSize = true;

    		if (cursor.left >= 0)
    			shouldSetCursor = shouldSetLegend = true;

    		commit();
    	}

    	function calcSize(width, height) {
    	//	log("calcSize()", arguments);

    		self.width  = fullWidCss = plotWidCss = width;
    		self.height = fullHgtCss = plotHgtCss = height;
    		plotLftCss  = plotTopCss = 0;

    		calcPlotRect();
    		calcAxesRects();

    		let bb = self.bbox;

    		plotLft = bb.left   = incrRound(plotLftCss * pxRatio, 0.5);
    		plotTop = bb.top    = incrRound(plotTopCss * pxRatio, 0.5);
    		plotWid = bb.width  = incrRound(plotWidCss * pxRatio, 0.5);
    		plotHgt = bb.height = incrRound(plotHgtCss * pxRatio, 0.5);

    	//	updOriDims();
    	}

    	// ensures size calc convergence
    	const CYCLE_LIMIT = 3;

    	function convergeSize() {
    		let converged = false;

    		let cycleNum = 0;

    		while (!converged) {
    			cycleNum++;

    			let axesConverged = axesCalc(cycleNum);
    			let paddingConverged = paddingCalc(cycleNum);

    			converged = cycleNum == CYCLE_LIMIT || (axesConverged && paddingConverged);

    			if (!converged) {
    				calcSize(self.width, self.height);
    				shouldSetSize = true;
    			}
    		}
    	}

    	function setSize({width, height}) {
    		_setSize(width, height);
    	}

    	self.setSize = setSize;

    	// accumulate axis offsets, reduce canvas width
    	function calcPlotRect() {
    		// easements for edge labels
    		let hasTopAxis = false;
    		let hasBtmAxis = false;
    		let hasRgtAxis = false;
    		let hasLftAxis = false;

    		axes.forEach((axis, i) => {
    			if (axis.show && axis._show) {
    				let {side, _size} = axis;
    				let isVt = side % 2;
    				let labelSize = axis.label != null ? axis.labelSize : 0;

    				let fullSize = _size + labelSize;

    				if (fullSize > 0) {
    					if (isVt) {
    						plotWidCss -= fullSize;

    						if (side == 3) {
    							plotLftCss += fullSize;
    							hasLftAxis = true;
    						}
    						else
    							hasRgtAxis = true;
    					}
    					else {
    						plotHgtCss -= fullSize;

    						if (side == 0) {
    							plotTopCss += fullSize;
    							hasTopAxis = true;
    						}
    						else
    							hasBtmAxis = true;
    					}
    				}
    			}
    		});

    		sidesWithAxes[0] = hasTopAxis;
    		sidesWithAxes[1] = hasRgtAxis;
    		sidesWithAxes[2] = hasBtmAxis;
    		sidesWithAxes[3] = hasLftAxis;

    		// hz padding
    		plotWidCss -= _padding[1] + _padding[3];
    		plotLftCss += _padding[3];

    		// vt padding
    		plotHgtCss -= _padding[2] + _padding[0];
    		plotTopCss += _padding[0];
    	}

    	function calcAxesRects() {
    		// will accum +
    		let off1 = plotLftCss + plotWidCss;
    		let off2 = plotTopCss + plotHgtCss;
    		// will accum -
    		let off3 = plotLftCss;
    		let off0 = plotTopCss;

    		function incrOffset(side, size) {
    			switch (side) {
    				case 1: off1 += size; return off1 - size;
    				case 2: off2 += size; return off2 - size;
    				case 3: off3 -= size; return off3 + size;
    				case 0: off0 -= size; return off0 + size;
    			}
    		}

    		axes.forEach((axis, i) => {
    			if (axis.show && axis._show) {
    				let side = axis.side;

    				axis._pos = incrOffset(side, axis._size);

    				if (axis.label != null)
    					axis._lpos = incrOffset(side, axis.labelSize);
    			}
    		});
    	}

    	const cursor = (self.cursor = assign({}, cursorOpts, {drag: {y: mode == 2}}, opts.cursor));

    	{
    		cursor.idxs = activeIdxs;

    		cursor._lock = false;

    		let points = cursor.points;

    		points.show   = fnOrSelf(points.show);
    		points.size   = fnOrSelf(points.size);
    		points.stroke = fnOrSelf(points.stroke);
    		points.width  = fnOrSelf(points.width);
    		points.fill   = fnOrSelf(points.fill);
    	}

    	const focus = self.focus = assign({}, opts.focus || {alpha: 0.3}, cursor.focus);

    	if (focus.bias != 0)
    		focus.prox = 1e5; // big, but < Infinity

    	const cursorFocus = focus.prox >= 0;

    	// series-intersection markers
    	let cursorPts = [null];

    	function initCursorPt(s, si) {
    		if (si > 0) {
    			let pt = cursor.points.show(self, si);

    			if (pt) {
    				addClass(pt, CURSOR_PT);
    				addClass(pt, s.class);
    				elTrans(pt, -10, -10, plotWidCss, plotHgtCss);
    				over.insertBefore(pt, cursorPts[si]);

    				return pt;
    			}
    		}
    	}

    	function initSeries(s, i) {
    		if (mode == 1 || i > 0) {
    			let isTime = mode == 1 && scales[s.scale].time;

    			let sv = s.value;
    			s.value = isTime ? (isStr(sv) ? timeSeriesVal(_tzDate, timeSeriesStamp(sv, _fmtDate)) : sv || _timeSeriesVal) : sv || numSeriesVal;
    			s.label = s.label || (isTime ? timeSeriesLabel : numSeriesLabel);
    		}

    		if (i > 0) {
    			s.width  = s.width == null ? 1 : s.width;
    			s.paths  = s.paths || linearPath || retNull;
    			s.fillTo = fnOrSelf(s.fillTo || seriesFillTo);
    			s.pxAlign = +ifNull(s.pxAlign, pxAlign);
    			s.pxRound = pxRoundGen(s.pxAlign);

    			s.stroke = fnOrSelf(s.stroke || null);
    			s.fill   = fnOrSelf(s.fill || null);
    			s._stroke = s._fill = s._paths = s._focus = null;

    			let _ptDia = ptDia(max(1, s.width), 1);
    			let points = s.points = assign({}, {
    				size: _ptDia,
    				width: max(1, _ptDia * .2),
    				stroke: s.stroke,
    				space: _ptDia * 2,
    				paths: pointsPath,
    				_stroke: null,
    				_fill: null,
    			}, s.points);
    			points.show   = fnOrSelf(points.show);
    			points.filter = fnOrSelf(points.filter);
    			points.fill   = fnOrSelf(points.fill);
    			points.stroke = fnOrSelf(points.stroke);
    			points.paths  = fnOrSelf(points.paths);
    			points.pxAlign = s.pxAlign;
    		}

    		if (showLegend) {
    			let rowCells = initLegendRow(s, i);
    			legendRows.splice(i, 0, rowCells[0]);
    			legendCells.splice(i, 0, rowCells[1]);
    			legend.values.push(null);	// NULL_LEGEND_VALS not yet avil here :(
    		}

    		if (cursor.show) {
    			activeIdxs.splice(i, 0, null);

    			let pt = initCursorPt(s, i);
    			pt && cursorPts.splice(i, 0, pt);
    		}

    		fire("addSeries", i);
    	}

    	function addSeries(opts, si) {
    		si = si == null ? series.length : si;

    		opts = mode == 1 ? setDefault(opts, si, xSeriesOpts, ySeriesOpts) : setDefault(opts, si, null, xySeriesOpts);

    		series.splice(si, 0, opts);
    		initSeries(series[si], si);
    	}

    	self.addSeries = addSeries;

    	function delSeries(i) {
    		series.splice(i, 1);

    		if (showLegend) {
    			legend.values.splice(i, 1);

    			legendCells.splice(i, 1);
    			let tr = legendRows.splice(i, 1)[0];
    			offMouse(null, tr.firstChild);
    			tr.remove();
    		}

    		if (cursor.show) {
    			activeIdxs.splice(i, 1);

    			cursorPts.length > 1 && cursorPts.splice(i, 1)[0].remove();
    		}

    		// TODO: de-init no-longer-needed scales?

    		fire("delSeries", i);
    	}

    	self.delSeries = delSeries;

    	const sidesWithAxes = [false, false, false, false];

    	function initAxis(axis, i) {
    		axis._show = axis.show;

    		if (axis.show) {
    			let isVt = axis.side % 2;

    			let sc = scales[axis.scale];

    			// this can occur if all series specify non-default scales
    			if (sc == null) {
    				axis.scale = isVt ? series[1].scale : xScaleKey;
    				sc = scales[axis.scale];
    			}

    			// also set defaults for incrs & values based on axis distr
    			let isTime = sc.time;

    			axis.size   = fnOrSelf(axis.size);
    			axis.space  = fnOrSelf(axis.space);
    			axis.rotate = fnOrSelf(axis.rotate);
    			axis.incrs  = fnOrSelf(axis.incrs  || (          sc.distr == 2 ? wholeIncrs : (isTime ? (ms == 1 ? timeIncrsMs : timeIncrsS) : numIncrs)));
    			axis.splits = fnOrSelf(axis.splits || (isTime && sc.distr == 1 ? _timeAxisSplits : sc.distr == 3 ? logAxisSplits : sc.distr == 4 ? asinhAxisSplits : numAxisSplits));

    			axis.stroke        = fnOrSelf(axis.stroke);
    			axis.grid.stroke   = fnOrSelf(axis.grid.stroke);
    			axis.ticks.stroke  = fnOrSelf(axis.ticks.stroke);
    			axis.border.stroke = fnOrSelf(axis.border.stroke);

    			let av = axis.values;

    			axis.values = (
    				// static array of tick values
    				isArr(av) && !isArr(av[0]) ? fnOrSelf(av) :
    				// temporal
    				isTime ? (
    					// config array of fmtDate string tpls
    					isArr(av) ?
    						timeAxisVals(_tzDate, timeAxisStamps(av, _fmtDate)) :
    					// fmtDate string tpl
    					isStr(av) ?
    						timeAxisVal(_tzDate, av) :
    					av || _timeAxisVals
    				) : av || numAxisVals
    			);

    			axis.filter = fnOrSelf(axis.filter || (          sc.distr >= 3 && sc.log == 10 ? log10AxisValsFilt : retArg1));

    			axis.font      = pxRatioFont(axis.font);
    			axis.labelFont = pxRatioFont(axis.labelFont);

    			axis._size   = axis.size(self, null, i, 0);

    			axis._space  =
    			axis._rotate =
    			axis._incrs  =
    			axis._found  =	// foundIncrSpace
    			axis._splits =
    			axis._values = null;

    			if (axis._size > 0) {
    				sidesWithAxes[i] = true;
    				axis._el = placeDiv(AXIS, wrap);
    			}

    			// debug
    		//	axis._el.style.background = "#"  + Math.floor(Math.random()*16777215).toString(16) + '80';
    		}
    	}

    	function autoPadSide(self, side, sidesWithAxes, cycleNum) {
    		let [hasTopAxis, hasRgtAxis, hasBtmAxis, hasLftAxis] = sidesWithAxes;

    		let ori = side % 2;
    		let size = 0;

    		if (ori == 0 && (hasLftAxis || hasRgtAxis))
    			size = (side == 0 && !hasTopAxis || side == 2 && !hasBtmAxis ? round(xAxisOpts.size / 3) : 0);
    		if (ori == 1 && (hasTopAxis || hasBtmAxis))
    			size = (side == 1 && !hasRgtAxis || side == 3 && !hasLftAxis ? round(yAxisOpts.size / 2) : 0);

    		return size;
    	}

    	const padding = self.padding = (opts.padding || [autoPadSide,autoPadSide,autoPadSide,autoPadSide]).map(p => fnOrSelf(ifNull(p, autoPadSide)));
    	const _padding = self._padding = padding.map((p, i) => p(self, i, sidesWithAxes, 0));

    	let dataLen;

    	// rendered data window
    	let i0 = null;
    	let i1 = null;
    	const idxs = mode == 1 ? series[0].idxs : null;

    	let data0 = null;

    	let viaAutoScaleX = false;

    	function setData(_data, _resetScales) {
    		data = _data == null ? [] : copy(_data, fastIsObj);

    		if (mode == 2) {
    			dataLen = 0;
    			for (let i = 1; i < series.length; i++)
    				dataLen += data[i][0].length;
    			self.data = data = _data;
    		}
    		else {
    			if (data[0] == null)
    				data[0] = [];

    			self.data = data.slice();

    			data0 = data[0];
    			dataLen = data0.length;

    			if (xScaleDistr == 2) {
    				data[0] = Array(dataLen);
    				for (let i = 0; i < dataLen; i++)
    					data[0][i] = i;
    			}
    		}

    		self._data = data;

    		resetYSeries(true);

    		fire("setData");

    		// forces x axis tick values to re-generate when neither x scale nor y scale changes
    		// in ordinal mode, scale range is by index, so will not change if new data has same length, but tick values are from data
    		if (xScaleDistr == 2) {
    			shouldConvergeSize = true;

    			/* or somewhat cheaper, and uglier:
    			if (ready) {
    				// logic extracted from axesCalc()
    				let i = 0;
    				let axis = axes[i];
    				let _splits = axis._splits.map(i => data0[i]);
    				let [_incr, _space] = axis._found;
    				let incr = data0[_splits[1]] - data0[_splits[0]];
    				axis._values = axis.values(self, axis.filter(self, _splits, i, _space, incr), i, _space, incr);
    			}
    			*/
    		}

    		if (_resetScales !== false) {
    			let xsc = scaleX;

    			if (xsc.auto(self, viaAutoScaleX))
    				autoScaleX();
    			else
    				_setScale(xScaleKey, xsc.min, xsc.max);

    			shouldSetCursor = cursor.left >= 0;
    			shouldSetLegend = true;
    			commit();
    		}
    	}

    	self.setData = setData;

    	function autoScaleX() {
    		viaAutoScaleX = true;

    		let _min, _max;

    		if (mode == 1) {
    			if (dataLen > 0) {
    				i0 = idxs[0] = 0;
    				i1 = idxs[1] = dataLen - 1;

    				_min = data[0][i0];
    				_max = data[0][i1];

    				if (xScaleDistr == 2) {
    					_min = i0;
    					_max = i1;
    				}
    				else if (dataLen == 1) {
    					if (xScaleDistr == 3)
    						[_min, _max] = rangeLog(_min, _min, scaleX.log, false);
    					else if (xScaleDistr == 4)
    						[_min, _max] = rangeAsinh(_min, _min, scaleX.log, false);
    					else if (scaleX.time)
    						_max = _min + round(86400 / ms);
    					else
    						[_min, _max] = rangeNum(_min, _max, rangePad, true);
    				}
    			}
    			else {
    				i0 = idxs[0] = _min = null;
    				i1 = idxs[1] = _max = null;
    			}
    		}

    		_setScale(xScaleKey, _min, _max);
    	}

    	let ctxStroke, ctxFill, ctxWidth, ctxDash, ctxJoin, ctxCap, ctxFont, ctxAlign, ctxBaseline;
    	let ctxAlpha;

    	function setCtxStyle(stroke, width, dash, cap, fill, join) {
    		stroke ??= transparent;
    		dash   ??= EMPTY_ARR;
    		cap    ??= "butt"; // (‿|‿)
    		fill   ??= transparent;
    		join   ??= "round";

    		if (stroke != ctxStroke)
    			ctx.strokeStyle = ctxStroke = stroke;
    		if (fill != ctxFill)
    			ctx.fillStyle = ctxFill = fill;
    		if (width != ctxWidth)
    			ctx.lineWidth = ctxWidth = width;
    		if (join != ctxJoin)
    			ctx.lineJoin = ctxJoin = join;
    		if (cap != ctxCap)
    			ctx.lineCap = ctxCap = cap;
    		if (dash != ctxDash)
    			ctx.setLineDash(ctxDash = dash);
    	}

    	function setFontStyle(font, fill, align, baseline) {
    		if (fill != ctxFill)
    			ctx.fillStyle = ctxFill = fill;
    		if (font != ctxFont)
    			ctx.font = ctxFont = font;
    		if (align != ctxAlign)
    			ctx.textAlign = ctxAlign = align;
    		if (baseline != ctxBaseline)
    			ctx.textBaseline = ctxBaseline = baseline;
    	}

    	function accScale(wsc, psc, facet, data, sorted = 0) {
    		if (data.length > 0 && wsc.auto(self, viaAutoScaleX) && (psc == null || psc.min == null)) {
    			let _i0 = ifNull(i0, 0);
    			let _i1 = ifNull(i1, data.length - 1);

    			// only run getMinMax() for invalidated series data, else reuse
    			let minMax = facet.min == null ? (wsc.distr == 3 ? getMinMaxLog(data, _i0, _i1) : getMinMax(data, _i0, _i1, sorted)) : [facet.min, facet.max];

    			// initial min/max
    			wsc.min = min(wsc.min, facet.min = minMax[0]);
    			wsc.max = max(wsc.max, facet.max = minMax[1]);
    		}
    	}

    	function setScales() {
    	//	log("setScales()", arguments);

    		// wip scales
    		let wipScales = copy(scales, fastIsObj);

    		for (let k in wipScales) {
    			let wsc = wipScales[k];
    			let psc = pendScales[k];

    			if (psc != null && psc.min != null) {
    				assign(wsc, psc);

    				// explicitly setting the x-scale invalidates everything (acts as redraw)
    				if (k == xScaleKey)
    					resetYSeries(true);
    			}
    			else if (k != xScaleKey || mode == 2) {
    				if (dataLen == 0 && wsc.from == null) {
    					let minMax = wsc.range(self, null, null, k);
    					wsc.min = minMax[0];
    					wsc.max = minMax[1];
    				}
    				else {
    					wsc.min = inf;
    					wsc.max = -inf;
    				}
    			}
    		}

    		if (dataLen > 0) {
    			// pre-range y-scales from y series' data values
    			series.forEach((s, i) => {
    				if (mode == 1) {
    					let k = s.scale;
    					let wsc = wipScales[k];
    					let psc = pendScales[k];

    					if (i == 0) {
    						let minMax = wsc.range(self, wsc.min, wsc.max, k);

    						wsc.min = minMax[0];
    						wsc.max = minMax[1];

    						i0 = closestIdx(wsc.min, data[0]);
    						i1 = closestIdx(wsc.max, data[0]);

    						// don't try to contract same or adjacent idxs
    						if (i1 - i0 > 1) {
    							// closest indices can be outside of view
    							if (data[0][i0] < wsc.min)
    								i0++;
    							if (data[0][i1] > wsc.max)
    								i1--;
    						}

    						s.min = data0[i0];
    						s.max = data0[i1];
    					}
    					else if (s.show && s.auto)
    						accScale(wsc, psc, s, data[i], s.sorted);

    					s.idxs[0] = i0;
    					s.idxs[1] = i1;
    				}
    				else {
    					if (i > 0) {
    						if (s.show && s.auto) {
    							// TODO: only handles, assumes and requires facets[0] / 'x' scale, and facets[1] / 'y' scale
    							let [ xFacet, yFacet ] = s.facets;
    							let xScaleKey = xFacet.scale;
    							let yScaleKey = yFacet.scale;
    							let [ xData, yData ] = data[i];

    							accScale(wipScales[xScaleKey], pendScales[xScaleKey], xFacet, xData, xFacet.sorted);
    							accScale(wipScales[yScaleKey], pendScales[yScaleKey], yFacet, yData, yFacet.sorted);

    							// temp
    							s.min = yFacet.min;
    							s.max = yFacet.max;
    						}
    					}
    				}
    			});

    			// range independent scales
    			for (let k in wipScales) {
    				let wsc = wipScales[k];
    				let psc = pendScales[k];

    				if (wsc.from == null && (psc == null || psc.min == null)) {
    					let minMax = wsc.range(
    						self,
    						wsc.min ==  inf ? null : wsc.min,
    						wsc.max == -inf ? null : wsc.max,
    						k
    					);
    					wsc.min = minMax[0];
    					wsc.max = minMax[1];
    				}
    			}
    		}

    		// range dependent scales
    		for (let k in wipScales) {
    			let wsc = wipScales[k];

    			if (wsc.from != null) {
    				let base = wipScales[wsc.from];

    				if (base.min == null)
    					wsc.min = wsc.max = null;
    				else {
    					let minMax = wsc.range(self, base.min, base.max, k);
    					wsc.min = minMax[0];
    					wsc.max = minMax[1];
    				}
    			}
    		}

    		let changed = {};
    		let anyChanged = false;

    		for (let k in wipScales) {
    			let wsc = wipScales[k];
    			let sc = scales[k];

    			if (sc.min != wsc.min || sc.max != wsc.max) {
    				sc.min = wsc.min;
    				sc.max = wsc.max;

    				let distr = sc.distr;

    				sc._min = distr == 3 ? log10(sc.min) : distr == 4 ? asinh(sc.min, sc.asinh) : sc.min;
    				sc._max = distr == 3 ? log10(sc.max) : distr == 4 ? asinh(sc.max, sc.asinh) : sc.max;

    				changed[k] = anyChanged = true;
    			}
    		}

    		if (anyChanged) {
    			// invalidate paths of all series on changed scales
    			series.forEach((s, i) => {
    				if (mode == 2) {
    					if (i > 0 && changed.y)
    						s._paths = null;
    				}
    				else {
    					if (changed[s.scale])
    						s._paths = null;
    				}
    			});

    			for (let k in changed) {
    				shouldConvergeSize = true;
    				fire("setScale", k);
    			}

    			if (cursor.show && cursor.left >= 0)
    				shouldSetCursor = shouldSetLegend = true;
    		}

    		for (let k in pendScales)
    			pendScales[k] = null;
    	}

    	// grabs the nearest indices with y data outside of x-scale limits
    	function getOuterIdxs(ydata) {
    		let _i0 = clamp(i0 - 1, 0, dataLen - 1);
    		let _i1 = clamp(i1 + 1, 0, dataLen - 1);

    		while (ydata[_i0] == null && _i0 > 0)
    			_i0--;

    		while (ydata[_i1] == null && _i1 < dataLen - 1)
    			_i1++;

    		return [_i0, _i1];
    	}

    	function drawSeries() {
    		if (dataLen > 0) {
    			series.forEach((s, i) => {
    				if (i > 0 && s.show && s._paths == null) {
    					let _idxs = mode == 2 ? [0, data[i][0].length - 1] : getOuterIdxs(data[i]);
    					s._paths = s.paths(self, i, _idxs[0], _idxs[1]);
    				}
    			});

    			series.forEach((s, i) => {
    				if (i > 0 && s.show) {
    					if (ctxAlpha != s.alpha)
    						ctx.globalAlpha = ctxAlpha = s.alpha;

    					{
    						cacheStrokeFill(i, false);
    						s._paths && drawPath(i, false);
    					}

    					{
    						cacheStrokeFill(i, true);

    						let _gaps = s._paths ? s._paths.gaps : null;

    						let show = s.points.show(self, i, i0, i1, _gaps);
    						let idxs = s.points.filter(self, i, show, _gaps);

    						if (show || idxs) {
    							s.points._paths = s.points.paths(self, i, i0, i1, idxs);
    							drawPath(i, true);
    						}
    					}

    					if (ctxAlpha != 1)
    						ctx.globalAlpha = ctxAlpha = 1;

    					fire("drawSeries", i);
    				}
    			});
    		}
    	}

    	function cacheStrokeFill(si, _points) {
    		let s = _points ? series[si].points : series[si];

    		s._stroke = s.stroke(self, si);
    		s._fill   = s.fill(self, si);
    	}

    	function drawPath(si, _points) {
    		let s = _points ? series[si].points : series[si];

    		let strokeStyle = s._stroke;
    		let fillStyle   = s._fill;

    		let { stroke, fill, clip: gapsClip, flags } = s._paths;
    		let boundsClip = null;
    		let width = roundDec(s.width * pxRatio, 3);
    		let offset = (width % 2) / 2;

    		if (_points && fillStyle == null)
    			fillStyle = width > 0 ? "#fff" : strokeStyle;

    		let _pxAlign = s.pxAlign == 1;

    		_pxAlign && ctx.translate(offset, offset);

    		if (!_points) {
    			let lft = plotLft,
    				top = plotTop,
    				wid = plotWid,
    				hgt = plotHgt;

    			let halfWid = width * pxRatio / 2;

    			if (s.min == 0)
    				hgt += halfWid;

    			if (s.max == 0) {
    				top -= halfWid;
    				hgt += halfWid;
    			}

    			boundsClip = new Path2D();
    			boundsClip.rect(lft, top, wid, hgt);
    		}

    		// the points pathbuilder's gapsClip is its boundsClip, since points dont need gaps clipping, and bounds depend on point size
    		if (_points)
    			strokeFill(strokeStyle, width, s.dash, s.cap, fillStyle, stroke, fill, flags, gapsClip);
    		else
    			fillStroke(si, strokeStyle, width, s.dash, s.cap, fillStyle, stroke, fill, flags, boundsClip, gapsClip);

    		_pxAlign && ctx.translate(-offset, -offset);
    	}

    	function fillStroke(si, strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip) {
    		let didStrokeFill = false;

    		// for all bands where this series is the top edge, create upwards clips using the bottom edges
    		// and apply clips + fill with band fill or dfltFill
    		bands.forEach((b, bi) => {
    			// isUpperEdge?
    			if (b.series[0] == si) {
    				let lowerEdge = series[b.series[1]];
    				let lowerData = data[b.series[1]];

    				let bandClip = (lowerEdge._paths || EMPTY_OBJ).band;

    				if (isArr(bandClip))
    					bandClip = b.dir == 1 ? bandClip[0] : bandClip[1];

    				let gapsClip2;

    				let _fillStyle = null;

    				// hasLowerEdge?
    				if (lowerEdge.show && bandClip && hasData(lowerData, i0, i1)) {
    					_fillStyle = b.fill(self, bi) || fillStyle;
    					gapsClip2 = lowerEdge._paths.clip;
    				}
    				else
    					bandClip = null;

    				strokeFill(strokeStyle, lineWidth, lineDash, lineCap, _fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip, gapsClip2, bandClip);

    				didStrokeFill = true;
    			}
    		});

    		if (!didStrokeFill)
    			strokeFill(strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip);
    	}

    	const CLIP_FILL_STROKE = BAND_CLIP_FILL | BAND_CLIP_STROKE;

    	function strokeFill(strokeStyle, lineWidth, lineDash, lineCap, fillStyle, strokePath, fillPath, flags, boundsClip, gapsClip, gapsClip2, bandClip) {
    		setCtxStyle(strokeStyle, lineWidth, lineDash, lineCap, fillStyle);

    		if (boundsClip || gapsClip || bandClip) {
    			ctx.save();
    			boundsClip && ctx.clip(boundsClip);
    			gapsClip && ctx.clip(gapsClip);
    		}

    		if (bandClip) {
    			if ((flags & CLIP_FILL_STROKE) == CLIP_FILL_STROKE) {
    				ctx.clip(bandClip);
    				gapsClip2 && ctx.clip(gapsClip2);
    				doFill(fillStyle, fillPath);
    				doStroke(strokeStyle, strokePath, lineWidth);
    			}
    			else if (flags & BAND_CLIP_STROKE) {
    				doFill(fillStyle, fillPath);
    				ctx.clip(bandClip);
    				doStroke(strokeStyle, strokePath, lineWidth);
    			}
    			else if (flags & BAND_CLIP_FILL) {
    				ctx.save();
    				ctx.clip(bandClip);
    				gapsClip2 && ctx.clip(gapsClip2);
    				doFill(fillStyle, fillPath);
    				ctx.restore();
    				doStroke(strokeStyle, strokePath, lineWidth);
    			}
    		}
    		else {
    			doFill(fillStyle, fillPath);
    			doStroke(strokeStyle, strokePath, lineWidth);
    		}

    		if (boundsClip || gapsClip || bandClip)
    			ctx.restore();
    	}

    	function doStroke(strokeStyle, strokePath, lineWidth) {
    		if (lineWidth > 0) {
    			if (strokePath instanceof Map) {
    				strokePath.forEach((strokePath, strokeStyle) => {
    					ctx.strokeStyle = ctxStroke = strokeStyle;
    					ctx.stroke(strokePath);
    				});
    			}
    			else
    				strokePath != null && strokeStyle && ctx.stroke(strokePath);
    		}
    	}

    	function doFill(fillStyle, fillPath) {
    		if (fillPath instanceof Map) {
    			fillPath.forEach((fillPath, fillStyle) => {
    				ctx.fillStyle = ctxFill = fillStyle;
    				ctx.fill(fillPath);
    			});
    		}
    		else
    			fillPath != null && fillStyle && ctx.fill(fillPath);
    	}

    	function getIncrSpace(axisIdx, min, max, fullDim) {
    		let axis = axes[axisIdx];

    		let incrSpace;

    		if (fullDim <= 0)
    			incrSpace = [0, 0];
    		else {
    			let minSpace = axis._space = axis.space(self, axisIdx, min, max, fullDim);
    			let incrs    = axis._incrs = axis.incrs(self, axisIdx, min, max, fullDim, minSpace);
    			incrSpace    = findIncr(min, max, incrs, fullDim, minSpace);
    		}

    		return (axis._found = incrSpace);
    	}

    	function drawOrthoLines(offs, filts, ori, side, pos0, len, width, stroke, dash, cap) {
    		let offset = (width % 2) / 2;

    		pxAlign == 1 && ctx.translate(offset, offset);

    		setCtxStyle(stroke, width, dash, cap, stroke);

    		ctx.beginPath();

    		let x0, y0, x1, y1, pos1 = pos0 + (side == 0 || side == 3 ? -len : len);

    		if (ori == 0) {
    			y0 = pos0;
    			y1 = pos1;
    		}
    		else {
    			x0 = pos0;
    			x1 = pos1;
    		}

    		for (let i = 0; i < offs.length; i++) {
    			if (filts[i] != null) {
    				if (ori == 0)
    					x0 = x1 = offs[i];
    				else
    					y0 = y1 = offs[i];

    				ctx.moveTo(x0, y0);
    				ctx.lineTo(x1, y1);
    			}
    		}

    		ctx.stroke();

    		pxAlign == 1 && ctx.translate(-offset, -offset);
    	}

    	function axesCalc(cycleNum) {
    	//	log("axesCalc()", arguments);

    		let converged = true;

    		axes.forEach((axis, i) => {
    			if (!axis.show)
    				return;

    			let scale = scales[axis.scale];

    			if (scale.min == null) {
    				if (axis._show) {
    					converged = false;
    					axis._show = false;
    					resetYSeries(false);
    				}
    				return;
    			}
    			else {
    				if (!axis._show) {
    					converged = false;
    					axis._show = true;
    					resetYSeries(false);
    				}
    			}

    			let side = axis.side;
    			let ori = side % 2;

    			let {min, max} = scale;		// 		// should this toggle them ._show = false

    			let [_incr, _space] = getIncrSpace(i, min, max, ori == 0 ? plotWidCss : plotHgtCss);

    			if (_space == 0)
    				return;

    			// if we're using index positions, force first tick to match passed index
    			let forceMin = scale.distr == 2;

    			let _splits = axis._splits = axis.splits(self, i, min, max, _incr, _space, forceMin);

    			// tick labels
    			// BOO this assumes a specific data/series
    			let splits = scale.distr == 2 ? _splits.map(i => data0[i]) : _splits;
    			let incr   = scale.distr == 2 ? data0[_splits[1]] - data0[_splits[0]] : _incr;

    			let values = axis._values = axis.values(self, axis.filter(self, splits, i, _space, incr), i, _space, incr);

    			// rotating of labels only supported on bottom x axis
    			axis._rotate = side == 2 ? axis.rotate(self, values, i, _space) : 0;

    			let oldSize = axis._size;

    			axis._size = ceil(axis.size(self, values, i, cycleNum));

    			if (oldSize != null && axis._size != oldSize)			// ready && ?
    				converged = false;
    		});

    		return converged;
    	}

    	function paddingCalc(cycleNum) {
    		let converged = true;

    		padding.forEach((p, i) => {
    			let _p = p(self, i, sidesWithAxes, cycleNum);

    			if (_p != _padding[i])
    				converged = false;

    			_padding[i] = _p;
    		});

    		return converged;
    	}

    	function drawAxesGrid() {
    		for (let i = 0; i < axes.length; i++) {
    			let axis = axes[i];

    			if (!axis.show || !axis._show)
    				continue;

    			let side = axis.side;
    			let ori = side % 2;

    			let x, y;

    			let fillStyle = axis.stroke(self, i);

    			let shiftDir = side == 0 || side == 3 ? -1 : 1;

    			// axis label
    			if (axis.label) {
    				let shiftAmt = axis.labelGap * shiftDir;
    				let baseLpos = round((axis._lpos + shiftAmt) * pxRatio);

    				setFontStyle(axis.labelFont[0], fillStyle, "center", side == 2 ? TOP : BOTTOM);

    				ctx.save();

    				if (ori == 1) {
    					x = y = 0;

    					ctx.translate(
    						baseLpos,
    						round(plotTop + plotHgt / 2),
    					);
    					ctx.rotate((side == 3 ? -PI : PI) / 2);

    				}
    				else {
    					x = round(plotLft + plotWid / 2);
    					y = baseLpos;
    				}

    				ctx.fillText(axis.label, x, y);

    				ctx.restore();
    			}

    			let [_incr, _space] = axis._found;

    			if (_space == 0)
    				continue;

    			let scale = scales[axis.scale];

    			let plotDim = ori == 0 ? plotWid : plotHgt;
    			let plotOff = ori == 0 ? plotLft : plotTop;

    			let axisGap = round(axis.gap * pxRatio);

    			let _splits = axis._splits;

    			// tick labels
    			// BOO this assumes a specific data/series
    			let splits = scale.distr == 2 ? _splits.map(i => data0[i]) : _splits;
    			let incr   = scale.distr == 2 ? data0[_splits[1]] - data0[_splits[0]] : _incr;

    			let ticks = axis.ticks;
    			let border = axis.border;
    			let tickSize = ticks.show ? round(ticks.size * pxRatio) : 0;

    			// rotating of labels only supported on bottom x axis
    			let angle = axis._rotate * -PI/180;

    			let basePos  = pxRound(axis._pos * pxRatio);
    			let shiftAmt = (tickSize + axisGap) * shiftDir;
    			let finalPos = basePos + shiftAmt;
    			    y        = ori == 0 ? finalPos : 0;
    			    x        = ori == 1 ? finalPos : 0;

    			let font         = axis.font[0];
    			let textAlign    = axis.align == 1 ? LEFT :
    			                   axis.align == 2 ? RIGHT :
    			                   angle > 0 ? LEFT :
    			                   angle < 0 ? RIGHT :
    			                   ori == 0 ? "center" : side == 3 ? RIGHT : LEFT;
    			let textBaseline = angle ||
    			                   ori == 1 ? "middle" : side == 2 ? TOP   : BOTTOM;

    			setFontStyle(font, fillStyle, textAlign, textBaseline);

    			let lineHeight = axis.font[1] * lineMult;

    			let canOffs = _splits.map(val => pxRound(getPos(val, scale, plotDim, plotOff)));

    			let _values = axis._values;

    			for (let i = 0; i < _values.length; i++) {
    				let val = _values[i];

    				if (val != null) {
    					if (ori == 0)
    						x = canOffs[i];
    					else
    						y = canOffs[i];

    					val = "" + val;

    					let _parts = val.indexOf("\n") == -1 ? [val] : val.split(/\n/gm);

    					for (let j = 0; j < _parts.length; j++) {
    						let text = _parts[j];

    						if (angle) {
    							ctx.save();
    							ctx.translate(x, y + j * lineHeight); // can this be replaced with position math?
    							ctx.rotate(angle); // can this be done once?
    							ctx.fillText(text, 0, 0);
    							ctx.restore();
    						}
    						else
    							ctx.fillText(text, x, y + j * lineHeight);
    					}
    				}
    			}

    			// ticks
    			if (ticks.show) {
    				drawOrthoLines(
    					canOffs,
    					ticks.filter(self, splits, i, _space, incr),
    					ori,
    					side,
    					basePos,
    					tickSize,
    					roundDec(ticks.width * pxRatio, 3),
    					ticks.stroke(self, i),
    					ticks.dash,
    					ticks.cap,
    				);
    			}

    			// grid
    			let grid = axis.grid;

    			if (grid.show) {
    				drawOrthoLines(
    					canOffs,
    					grid.filter(self, splits, i, _space, incr),
    					ori,
    					ori == 0 ? 2 : 1,
    					ori == 0 ? plotTop : plotLft,
    					ori == 0 ? plotHgt : plotWid,
    					roundDec(grid.width * pxRatio, 3),
    					grid.stroke(self, i),
    					grid.dash,
    					grid.cap,
    				);
    			}

    			if (border.show) {
    				drawOrthoLines(
    					[basePos],
    					[1],
    					ori == 0 ? 1 : 0,
    					ori == 0 ? 1 : 2,
    					ori == 1 ? plotTop : plotLft,
    					ori == 1 ? plotHgt : plotWid,
    					roundDec(border.width * pxRatio, 3),
    					border.stroke(self, i),
    					border.dash,
    					border.cap,
    				);
    			}
    		}

    		fire("drawAxes");
    	}

    	function resetYSeries(minMax) {
    	//	log("resetYSeries()", arguments);

    		series.forEach((s, i) => {
    			if (i > 0) {
    				s._paths = null;

    				if (minMax) {
    					if (mode == 1) {
    						s.min = null;
    						s.max = null;
    					}
    					else {
    						s.facets.forEach(f => {
    							f.min = null;
    							f.max = null;
    						});
    					}
    				}
    			}
    		});
    	}

    	let queuedCommit = false;

    	function commit() {
    		if (!queuedCommit) {
    			microTask(_commit);
    			queuedCommit = true;
    		}
    	}

    	function _commit() {
    	//	log("_commit()", arguments);

    		if (shouldSetScales) {
    			setScales();
    			shouldSetScales = false;
    		}

    		if (shouldConvergeSize) {
    			convergeSize();
    			shouldConvergeSize = false;
    		}

    		if (shouldSetSize) {
    			setStylePx(under, LEFT,   plotLftCss);
    			setStylePx(under, TOP,    plotTopCss);
    			setStylePx(under, WIDTH,  plotWidCss);
    			setStylePx(under, HEIGHT, plotHgtCss);

    			setStylePx(over, LEFT,    plotLftCss);
    			setStylePx(over, TOP,     plotTopCss);
    			setStylePx(over, WIDTH,   plotWidCss);
    			setStylePx(over, HEIGHT,  plotHgtCss);

    			setStylePx(wrap, WIDTH,   fullWidCss);
    			setStylePx(wrap, HEIGHT,  fullHgtCss);

    			// NOTE: mutating this during print preview in Chrome forces transparent
    			// canvas pixels to white, even when followed up with clearRect() below
    			can.width  = round(fullWidCss * pxRatio);
    			can.height = round(fullHgtCss * pxRatio);

    			axes.forEach(({ _el, _show, _size, _pos, side }) => {
    				if (_el != null) {
    					if (_show) {
    						let posOffset = (side === 3 || side === 0 ? _size : 0);
    						let isVt = side % 2 == 1;

    						setStylePx(_el, isVt ? "left"   : "top",    _pos - posOffset);
    						setStylePx(_el, isVt ? "width"  : "height", _size);
    						setStylePx(_el, isVt ? "top"    : "left",   isVt ? plotTopCss : plotLftCss);
    						setStylePx(_el, isVt ? "height" : "width",  isVt ? plotHgtCss : plotWidCss);

    						remClass(_el, OFF);
    					}
    					else
    						addClass(_el, OFF);
    				}
    			});

    			// invalidate ctx style cache
    			ctxStroke = ctxFill = ctxWidth = ctxJoin = ctxCap = ctxFont = ctxAlign = ctxBaseline = ctxDash = null;
    			ctxAlpha = 1;

    			syncRect(true);

    			fire("setSize");

    			shouldSetSize = false;
    		}

    		if (fullWidCss > 0 && fullHgtCss > 0) {
    			ctx.clearRect(0, 0, can.width, can.height);
    			fire("drawClear");
    			drawOrder.forEach(fn => fn());
    			fire("draw");
    		}

    		if (select.show && shouldSetSelect) {
    			setSelect(select);
    			shouldSetSelect = false;
    		}

    		if (cursor.show && shouldSetCursor) {
    			updateCursor(null, true, false);
    			shouldSetCursor = false;
    		}

    		if (legend.show && legend.live && shouldSetLegend) {
    			setLegend();
    			shouldSetLegend = false; // redundant currently
    		}

    		if (!ready) {
    			ready = true;
    			self.status = 1;

    			fire("ready");
    		}

    		viaAutoScaleX = false;

    		queuedCommit = false;
    	}

    	self.redraw = (rebuildPaths, recalcAxes) => {
    		shouldConvergeSize = recalcAxes || false;

    		if (rebuildPaths !== false)
    			_setScale(xScaleKey, scaleX.min, scaleX.max);
    		else
    			commit();
    	};

    	// redraw() => setScale('x', scales.x.min, scales.x.max);

    	// explicit, never re-ranged (is this actually true? for x and y)
    	function setScale(key, opts) {
    		let sc = scales[key];

    		if (sc.from == null) {
    			if (dataLen == 0) {
    				let minMax = sc.range(self, opts.min, opts.max, key);
    				opts.min = minMax[0];
    				opts.max = minMax[1];
    			}

    			if (opts.min > opts.max) {
    				let _min = opts.min;
    				opts.min = opts.max;
    				opts.max = _min;
    			}

    			if (dataLen > 1 && opts.min != null && opts.max != null && opts.max - opts.min < 1e-16)
    				return;

    			if (key == xScaleKey) {
    				if (sc.distr == 2 && dataLen > 0) {
    					opts.min = closestIdx(opts.min, data[0]);
    					opts.max = closestIdx(opts.max, data[0]);

    					if (opts.min == opts.max)
    						opts.max++;
    				}
    			}

    		//	log("setScale()", arguments);

    			pendScales[key] = opts;

    			shouldSetScales = true;
    			commit();
    		}
    	}

    	self.setScale = setScale;

    //	INTERACTION

    	let xCursor;
    	let yCursor;
    	let vCursor;
    	let hCursor;

    	// starting position before cursor.move
    	let rawMouseLeft0;
    	let rawMouseTop0;

    	// starting position
    	let mouseLeft0;
    	let mouseTop0;

    	// current position before cursor.move
    	let rawMouseLeft1;
    	let rawMouseTop1;

    	// current position
    	let mouseLeft1;
    	let mouseTop1;

    	let dragging = false;

    	const drag = cursor.drag;

    	let dragX = drag.x;
    	let dragY = drag.y;

    	if (cursor.show) {
    		if (cursor.x)
    			xCursor = placeDiv(CURSOR_X, over);
    		if (cursor.y)
    			yCursor = placeDiv(CURSOR_Y, over);

    		if (scaleX.ori == 0) {
    			vCursor = xCursor;
    			hCursor = yCursor;
    		}
    		else {
    			vCursor = yCursor;
    			hCursor = xCursor;
    		}

    		mouseLeft1 = cursor.left;
    		mouseTop1 = cursor.top;
    	}

    	const select = self.select = assign({
    		show:   true,
    		over:   true,
    		left:   0,
    		width:  0,
    		top:    0,
    		height: 0,
    	}, opts.select);

    	const selectDiv = select.show ? placeDiv(SELECT, select.over ? over : under) : null;

    	function setSelect(opts, _fire) {
    		if (select.show) {
    			for (let prop in opts) {
    				select[prop] = opts[prop];

    				if (prop in _hideProps)
    					setStylePx(selectDiv, prop, opts[prop]);
    			}

    			_fire !== false && fire("setSelect");
    		}
    	}

    	self.setSelect = setSelect;

    	function toggleDOM(i, onOff) {
    		let s = series[i];
    		let label = showLegend ? legendRows[i] : null;

    		if (s.show)
    			label && remClass(label, OFF);
    		else {
    			label && addClass(label, OFF);
    			cursorPts.length > 1 && elTrans(cursorPts[i], -10, -10, plotWidCss, plotHgtCss);
    		}
    	}

    	function _setScale(key, min, max) {
    		setScale(key, {min, max});
    	}

    	function setSeries(i, opts, _fire, _pub) {
    	//	log("setSeries()", arguments);

    		if (opts.focus != null)
    			setFocus(i);

    		if (opts.show != null) {
    			series.forEach((s, si) => {
    				if (si > 0 && (i == si || i == null)) {
    					s.show = opts.show;
    					toggleDOM(si, opts.show);

    					_setScale(mode == 2 ? s.facets[1].scale : s.scale, null, null);
    					commit();
    				}
    			});
    		}

    		_fire !== false && fire("setSeries", i, opts);

    		_pub && pubSync("setSeries", self, i, opts);
    	}

    	self.setSeries = setSeries;

    	function setBand(bi, opts) {
    		assign(bands[bi], opts);
    	}

    	function addBand(opts, bi) {
    		opts.fill = fnOrSelf(opts.fill || null);
    		opts.dir = ifNull(opts.dir, -1);
    		bi = bi == null ? bands.length : bi;
    		bands.splice(bi, 0, opts);
    	}

    	function delBand(bi) {
    		if (bi == null)
    			bands.length = 0;
    		else
    			bands.splice(bi, 1);
    	}

    	self.addBand = addBand;
    	self.setBand = setBand;
    	self.delBand = delBand;

    	function setAlpha(i, value) {
    		series[i].alpha = value;

    		if (cursor.show && cursorPts[i])
    			cursorPts[i].style.opacity = value;

    		if (showLegend && legendRows[i])
    			legendRows[i].style.opacity = value;
    	}

    	// y-distance
    	let closestDist;
    	let closestSeries;
    	let focusedSeries;
    	const FOCUS_TRUE  = {focus: true};

    	function setFocus(i) {
    		if (i != focusedSeries) {
    		//	log("setFocus()", arguments);

    			let allFocused = i == null;

    			let _setAlpha = focus.alpha != 1;

    			series.forEach((s, i2) => {
    				let isFocused = allFocused || i2 == 0 || i2 == i;
    				s._focus = allFocused ? null : isFocused;
    				_setAlpha && setAlpha(i2, isFocused ? 1 : focus.alpha);
    			});

    			focusedSeries = i;
    			_setAlpha && commit();
    		}
    	}

    	if (showLegend && cursorFocus) {
    		on(mouseleave, legendEl, e => {
    			if (cursor._lock)
    				return;

    			if (focusedSeries != null)
    				setSeries(null, FOCUS_TRUE, true, syncOpts.setSeries);
    		});
    	}

    	function posToVal(pos, scale, can) {
    		let sc = scales[scale];

    		if (can)
    			pos = pos / pxRatio - (sc.ori == 1 ? plotTopCss : plotLftCss);

    		let dim = plotWidCss;

    		if (sc.ori == 1) {
    			dim = plotHgtCss;
    			pos = dim - pos;
    		}

    		if (sc.dir == -1)
    			pos = dim - pos;

    		let _min = sc._min,
    			_max = sc._max,
    			pct = pos / dim;

    		let sv = _min + (_max - _min) * pct;

    		let distr = sc.distr;

    		return (
    			distr == 3 ? pow(10, sv) :
    			distr == 4 ? sinh(sv, sc.asinh) :
    			sv
    		);
    	}

    	function closestIdxFromXpos(pos, can) {
    		let v = posToVal(pos, xScaleKey, can);
    		return closestIdx(v, data[0], i0, i1);
    	}

    	self.valToIdx = val => closestIdx(val, data[0]);
    	self.posToIdx = closestIdxFromXpos;
    	self.posToVal = posToVal;
    	self.valToPos = (val, scale, can) => (
    		scales[scale].ori == 0 ?
    		getHPos(val, scales[scale],
    			can ? plotWid : plotWidCss,
    			can ? plotLft : 0,
    		) :
    		getVPos(val, scales[scale],
    			can ? plotHgt : plotHgtCss,
    			can ? plotTop : 0,
    		)
    	);

    	// defers calling expensive functions
    	function batch(fn) {
    		fn(self);
    		commit();
    	}

    	self.batch = batch;

    	(self.setCursor = (opts, _fire, _pub) => {
    		mouseLeft1 = opts.left;
    		mouseTop1 = opts.top;
    	//	assign(cursor, opts);
    		updateCursor(null, _fire, _pub);
    	});

    	function setSelH(off, dim) {
    		setStylePx(selectDiv, LEFT,  select.left = off);
    		setStylePx(selectDiv, WIDTH, select.width = dim);
    	}

    	function setSelV(off, dim) {
    		setStylePx(selectDiv, TOP,    select.top = off);
    		setStylePx(selectDiv, HEIGHT, select.height = dim);
    	}

    	let setSelX = scaleX.ori == 0 ? setSelH : setSelV;
    	let setSelY = scaleX.ori == 1 ? setSelH : setSelV;

    	function syncLegend() {
    		if (showLegend && legend.live) {
    			for (let i = mode == 2 ? 1 : 0; i < series.length; i++) {
    				if (i == 0 && multiValLegend)
    					continue;

    				let vals = legend.values[i];

    				let j = 0;

    				for (let k in vals)
    					legendCells[i][j++].firstChild.nodeValue = vals[k];
    			}
    		}
    	}

    	function setLegend(opts, _fire) {
    		if (opts != null) {
    			if (opts.idxs) {
    				opts.idxs.forEach((didx, sidx) => {
    					activeIdxs[sidx] = didx;
    				});
    			}
    			else if (!isUndef(opts.idx))
    				activeIdxs.fill(opts.idx);

    			legend.idx = activeIdxs[0];
    		}

    		for (let sidx = 0; sidx < series.length; sidx++) {
    			if (sidx > 0 || mode == 1 && !multiValLegend)
    				setLegendValues(sidx, activeIdxs[sidx]);
    		}

    		if (showLegend && legend.live)
    			syncLegend();

    		shouldSetLegend = false;

    		_fire !== false && fire("setLegend");
    	}

    	self.setLegend = setLegend;

    	function setLegendValues(sidx, idx) {
    		let s = series[sidx];
    		let src = sidx == 0 && xScaleDistr == 2 ? data0 : data[sidx];
    		let val;

    		if (multiValLegend)
    			val = s.values(self, sidx, idx) ?? NULL_LEGEND_VALUES;
    		else {
    			val = s.value(self, idx == null ? null : src[idx], sidx, idx);
    			val = val == null ? NULL_LEGEND_VALUES : {_: val};
    		}

    		legend.values[sidx] = val;
    	}

    	function updateCursor(src, _fire, _pub) {
    	//	ts == null && log("updateCursor()", arguments);

    		rawMouseLeft1 = mouseLeft1;
    		rawMouseTop1 = mouseTop1;

    		[mouseLeft1, mouseTop1] = cursor.move(self, mouseLeft1, mouseTop1);

    		if (cursor.show) {
    			vCursor && elTrans(vCursor, round(mouseLeft1), 0, plotWidCss, plotHgtCss);
    			hCursor && elTrans(hCursor, 0, round(mouseTop1), plotWidCss, plotHgtCss);
    		}

    		let idx;

    		// when zooming to an x scale range between datapoints the binary search
    		// for nearest min/max indices results in this condition. cheap hack :D
    		let noDataInRange = i0 > i1; // works for mode 1 only

    		closestDist = inf;

    		// TODO: extract
    		let xDim = scaleX.ori == 0 ? plotWidCss : plotHgtCss;
    		let yDim = scaleX.ori == 1 ? plotWidCss : plotHgtCss;

    		// if cursor hidden, hide points & clear legend vals
    		if (mouseLeft1 < 0 || dataLen == 0 || noDataInRange) {
    			idx = null;

    			for (let i = 0; i < series.length; i++) {
    				if (i > 0) {
    					cursorPts.length > 1 && elTrans(cursorPts[i], -10, -10, plotWidCss, plotHgtCss);
    				}
    			}

    			if (cursorFocus)
    				setSeries(null, FOCUS_TRUE, true, src == null && syncOpts.setSeries);

    			if (legend.live) {
    				activeIdxs.fill(idx);
    				shouldSetLegend = true;
    			}
    		}
    		else {
    		//	let pctY = 1 - (y / rect.height);

    			let mouseXPos, valAtPosX, xPos;

    			if (mode == 1) {
    				mouseXPos = scaleX.ori == 0 ? mouseLeft1 : mouseTop1;
    				valAtPosX = posToVal(mouseXPos, xScaleKey);
    				idx = closestIdx(valAtPosX, data[0], i0, i1);
    				xPos = valToPosX(data[0][idx], scaleX, xDim, 0);
    			}

    			for (let i = mode == 2 ? 1 : 0; i < series.length; i++) {
    				let s = series[i];

    				let idx1  = activeIdxs[i];
    				let yVal1 = mode == 1 ? data[i][idx1] : data[i][1][idx1];

    				let idx2  = cursor.dataIdx(self, i, idx, valAtPosX);
    				let yVal2 = mode == 1 ? data[i][idx2] : data[i][1][idx2];

    				shouldSetLegend = shouldSetLegend || yVal2 != yVal1 || idx2 != idx1;

    				activeIdxs[i] = idx2;

    				let xPos2 = incrRoundUp(idx2 == idx ? xPos : valToPosX(mode == 1 ? data[0][idx2] : data[i][0][idx2], scaleX, xDim, 0), 1);

    				if (i > 0 && s.show) {
    					let yPos = yVal2 == null ? -10 : incrRoundUp(valToPosY(yVal2, mode == 1 ? scales[s.scale] : scales[s.facets[1].scale], yDim, 0), 1);

    					if (cursorFocus && yPos >= 0 && mode == 1) {
    						let dist = abs(yPos - mouseTop1);
    						let bias = focus.bias;

    						if (bias != 0) {
    							let mouseYPos = scaleX.ori == 1 ? mouseLeft1 : mouseTop1;
    							let mouseYVal = posToVal(mouseYPos, s.scale);

    							let seriesYValSign = yVal2     >= 0 ? 1 : -1;
    							let mouseYValSign  = mouseYVal >= 0 ? 1 : -1;

    							// with a focus bias, we will never cross zero when prox testing
    							// it's either closest towards zero, or closest away from zero
    							if (mouseYValSign == seriesYValSign) {
    								if (
    									dist < closestDist
    									&& (
    										mouseYValSign == 1 ?
    											(bias == 1 ? yVal2 >= mouseYVal : yVal2 <= mouseYVal) :  // >= 0
    											(bias == 1 ? yVal2 <= mouseYVal : yVal2 >= mouseYVal)    //  < 0
    									)
    								) {
    									closestDist = dist;
    									closestSeries = i;
    								}
    							}
    						}
    						else {
    							if (dist < closestDist) {
    								closestDist = dist;
    								closestSeries = i;
    							}
    						}
    					}

    					let hPos, vPos;

    					if (scaleX.ori == 0) {
    						hPos = xPos2;
    						vPos = yPos;
    					}
    					else {
    						hPos = yPos;
    						vPos = xPos2;
    					}

    					if (shouldSetLegend && cursorPts.length > 1) {
    						elColor(cursorPts[i], cursor.points.fill(self, i), cursor.points.stroke(self, i));

    						let ptWid, ptHgt, ptLft, ptTop,
    							centered = true,
    							getBBox = cursor.points.bbox;

    						if (getBBox != null) {
    							centered = false;

    							let bbox = getBBox(self, i);

    							ptLft = bbox.left;
    							ptTop = bbox.top;
    							ptWid = bbox.width;
    							ptHgt = bbox.height;
    						}
    						else {
    							ptLft = hPos;
    							ptTop = vPos;
    							ptWid = ptHgt = cursor.points.size(self, i);
    						}

    						elSize(cursorPts[i], ptWid, ptHgt, centered);
    						elTrans(cursorPts[i], ptLft, ptTop, plotWidCss, plotHgtCss);
    					}
    				}
    			}
    		}

    		cursor.idx = idx;
    		cursor.left = mouseLeft1;
    		cursor.top = mouseTop1;

    		if (shouldSetLegend) {
    			legend.idx = idx;
    			setLegend();
    		}

    		// nit: cursor.drag.setSelect is assumed always true
    		if (select.show && dragging) {
    			if (src != null) {
    				let [xKey, yKey] = syncOpts.scales;
    				let [matchXKeys, matchYKeys] = syncOpts.match;
    				let [xKeySrc, yKeySrc] = src.cursor.sync.scales;

    				// match the dragX/dragY implicitness/explicitness of src
    				let sdrag = src.cursor.drag;
    				dragX = sdrag._x;
    				dragY = sdrag._y;

    				if (dragX || dragY) {
    					let { left, top, width, height } = src.select;

    					let sori = src.scales[xKey].ori;
    					let sPosToVal = src.posToVal;

    					let sOff, sDim, sc, a, b;

    					let matchingX = xKey != null && matchXKeys(xKey, xKeySrc);
    					let matchingY = yKey != null && matchYKeys(yKey, yKeySrc);

    					if (matchingX && dragX) {
    						if (sori == 0) {
    							sOff = left;
    							sDim = width;
    						}
    						else {
    							sOff = top;
    							sDim = height;
    						}

    						sc = scales[xKey];

    						a = valToPosX(sPosToVal(sOff, xKeySrc),        sc, xDim, 0);
    						b = valToPosX(sPosToVal(sOff + sDim, xKeySrc), sc, xDim, 0);

    						setSelX(min(a,b), abs(b-a));
    					}
    					else
    						setSelX(0, xDim);

    					if (matchingY && dragY) {
    						if (sori == 1) {
    							sOff = left;
    							sDim = width;
    						}
    						else {
    							sOff = top;
    							sDim = height;
    						}

    						sc = scales[yKey];

    						a = valToPosY(sPosToVal(sOff, yKeySrc),        sc, yDim, 0);
    						b = valToPosY(sPosToVal(sOff + sDim, yKeySrc), sc, yDim, 0);

    						setSelY(min(a,b), abs(b-a));
    					}
    					else
    						setSelY(0, yDim);
    				}
    				else
    					hideSelect();
    			}
    			else {
    				let rawDX = abs(rawMouseLeft1 - rawMouseLeft0);
    				let rawDY = abs(rawMouseTop1 - rawMouseTop0);

    				if (scaleX.ori == 1) {
    					let _rawDX = rawDX;
    					rawDX = rawDY;
    					rawDY = _rawDX;
    				}

    				dragX = drag.x && rawDX >= drag.dist;
    				dragY = drag.y && rawDY >= drag.dist;

    				let uni = drag.uni;

    				if (uni != null) {
    					// only calc drag status if they pass the dist thresh
    					if (dragX && dragY) {
    						dragX = rawDX >= uni;
    						dragY = rawDY >= uni;

    						// force unidirectionality when both are under uni limit
    						if (!dragX && !dragY) {
    							if (rawDY > rawDX)
    								dragY = true;
    							else
    								dragX = true;
    						}
    					}
    				}
    				else if (drag.x && drag.y && (dragX || dragY))
    					// if omni with no uni then both dragX / dragY should be true if either is true
    					dragX = dragY = true;

    				let p0, p1;

    				if (dragX) {
    					if (scaleX.ori == 0) {
    						p0 = mouseLeft0;
    						p1 = mouseLeft1;
    					}
    					else {
    						p0 = mouseTop0;
    						p1 = mouseTop1;
    					}

    					setSelX(min(p0, p1), abs(p1 - p0));

    					if (!dragY)
    						setSelY(0, yDim);
    				}

    				if (dragY) {
    					if (scaleX.ori == 1) {
    						p0 = mouseLeft0;
    						p1 = mouseLeft1;
    					}
    					else {
    						p0 = mouseTop0;
    						p1 = mouseTop1;
    					}

    					setSelY(min(p0, p1), abs(p1 - p0));

    					if (!dragX)
    						setSelX(0, xDim);
    				}

    				// the drag didn't pass the dist requirement
    				if (!dragX && !dragY) {
    					setSelX(0, 0);
    					setSelY(0, 0);
    				}
    			}
    		}

    		drag._x = dragX;
    		drag._y = dragY;

    		if (src == null) {
    			if (_pub) {
    				if (syncKey != null) {
    					let [xSyncKey, ySyncKey] = syncOpts.scales;

    					syncOpts.values[0] = xSyncKey != null ? posToVal(scaleX.ori == 0 ? mouseLeft1 : mouseTop1, xSyncKey) : null;
    					syncOpts.values[1] = ySyncKey != null ? posToVal(scaleX.ori == 1 ? mouseLeft1 : mouseTop1, ySyncKey) : null;
    				}

    				pubSync(mousemove, self, mouseLeft1, mouseTop1, plotWidCss, plotHgtCss, idx);
    			}

    			if (cursorFocus) {
    				let shouldPub = _pub && syncOpts.setSeries;
    				let p = focus.prox;

    				if (focusedSeries == null) {
    					if (closestDist <= p)
    						setSeries(closestSeries, FOCUS_TRUE, true, shouldPub);
    				}
    				else {
    					if (closestDist > p)
    						setSeries(null, FOCUS_TRUE, true, shouldPub);
    					else if (closestSeries != focusedSeries)
    						setSeries(closestSeries, FOCUS_TRUE, true, shouldPub);
    				}
    			}
    		}

    		_fire !== false && fire("setCursor");
    	}

    	let rect = null;

    	function syncRect(defer) {
    		if (defer === true)
    			rect = null;
    		else {
    			rect = over.getBoundingClientRect();
    			fire("syncRect", rect);
    		}
    	}

    	function mouseMove(e, src, _l, _t, _w, _h, _i) {
    		if (cursor._lock)
    			return;

    		// Chrome on Windows has a bug which triggers a stray mousemove event after an initial mousedown event
    		// when clicking into a plot as part of re-focusing the browser window.
    		// we gotta ignore it to avoid triggering a phantom drag / setSelect
    		// However, on touch-only devices Chrome-based browsers trigger a 0-distance mousemove before mousedown
    		// so we don't ignore it when mousedown has set the dragging flag
    		if (dragging && e != null && e.movementX == 0 && e.movementY == 0)
    			return;

    		cacheMouse(e, src, _l, _t, _w, _h, _i, false, e != null);

    		if (e != null)
    			updateCursor(null, true, true);
    		else
    			updateCursor(src, true, false);
    	}

    	function cacheMouse(e, src, _l, _t, _w, _h, _i, initial, snap) {
    		if (rect == null)
    			syncRect(false);

    		if (e != null) {
    			_l = e.clientX - rect.left;
    			_t = e.clientY - rect.top;
    		}
    		else {
    			if (_l < 0 || _t < 0) {
    				mouseLeft1 = -10;
    				mouseTop1 = -10;
    				return;
    			}

    			let [xKey, yKey] = syncOpts.scales;

    			let syncOptsSrc = src.cursor.sync;
    			let [xValSrc, yValSrc] = syncOptsSrc.values;
    			let [xKeySrc, yKeySrc] = syncOptsSrc.scales;
    			let [matchXKeys, matchYKeys] = syncOpts.match;

    			let rotSrc = src.axes[0].side % 2 == 1;

    			let xDim = scaleX.ori == 0 ? plotWidCss : plotHgtCss,
    				yDim = scaleX.ori == 1 ? plotWidCss : plotHgtCss,
    				_xDim = rotSrc ? _h : _w,
    				_yDim = rotSrc ? _w : _h,
    				_xPos = rotSrc ? _t : _l,
    				_yPos = rotSrc ? _l : _t;

    			if (xKeySrc != null)
    				_l = matchXKeys(xKey, xKeySrc) ? getPos(xValSrc, scales[xKey], xDim, 0) : -10;
    			else
    				_l = xDim * (_xPos/_xDim);

    			if (yKeySrc != null)
    				_t = matchYKeys(yKey, yKeySrc) ? getPos(yValSrc, scales[yKey], yDim, 0) : -10;
    			else
    				_t = yDim * (_yPos/_yDim);

    			if (scaleX.ori == 1) {
    				let __l = _l;
    				_l = _t;
    				_t = __l;
    			}
    		}

    		if (snap) {
    			if (_l <= 1 || _l >= plotWidCss - 1)
    				_l = incrRound(_l, plotWidCss);

    			if (_t <= 1 || _t >= plotHgtCss - 1)
    				_t = incrRound(_t, plotHgtCss);
    		}

    		if (initial) {
    			rawMouseLeft0 = _l;
    			rawMouseTop0 = _t;

    			[mouseLeft0, mouseTop0] = cursor.move(self, _l, _t);
    		}
    		else {
    			mouseLeft1 = _l;
    			mouseTop1 = _t;
    		}
    	}

    	const _hideProps = {
    		width: 0,
    		height: 0,
    		left: 0,
    		top: 0,
    	};

    	function hideSelect() {
    		setSelect(_hideProps, false);
    	}

    	function mouseDown(e, src, _l, _t, _w, _h, _i) {
    		dragging = true;
    		dragX = dragY = drag._x = drag._y = false;

    		cacheMouse(e, src, _l, _t, _w, _h, _i, true, false);

    		if (e != null) {
    			onMouse(mouseup, doc, mouseUp);
    			pubSync(mousedown, self, mouseLeft0, mouseTop0, plotWidCss, plotHgtCss, null);
    		}
    	}

    	function mouseUp(e, src, _l, _t, _w, _h, _i) {
    		dragging = drag._x = drag._y = false;

    		cacheMouse(e, src, _l, _t, _w, _h, _i, false, true);

    		let { left, top, width, height } = select;

    		let hasSelect = width > 0 || height > 0;

    		hasSelect && setSelect(select);

    		if (drag.setScale && hasSelect) {
    		//	if (syncKey != null) {
    		//		dragX = drag.x;
    		//		dragY = drag.y;
    		//	}

    			let xOff = left,
    				xDim = width,
    				yOff = top,
    				yDim = height;

    			if (scaleX.ori == 1) {
    				xOff = top,
    				xDim = height,
    				yOff = left,
    				yDim = width;
    			}

    			if (dragX) {
    				_setScale(xScaleKey,
    					posToVal(xOff, xScaleKey),
    					posToVal(xOff + xDim, xScaleKey)
    				);
    			}

    			if (dragY) {
    				for (let k in scales) {
    					let sc = scales[k];

    					if (k != xScaleKey && sc.from == null && sc.min != inf) {
    						_setScale(k,
    							posToVal(yOff + yDim, k),
    							posToVal(yOff, k)
    						);
    					}
    				}
    			}

    			hideSelect();
    		}
    		else if (cursor.lock) {
    			cursor._lock = !cursor._lock;

    			if (!cursor._lock)
    				updateCursor(null, true, false);
    		}

    		if (e != null) {
    			offMouse(mouseup, doc);
    			pubSync(mouseup, self, mouseLeft1, mouseTop1, plotWidCss, plotHgtCss, null);
    		}
    	}

    	function mouseLeave(e, src, _l, _t, _w, _h, _i) {
    		if (!cursor._lock) {
    			let _dragging = dragging;

    			if (dragging) {
    				// handle case when mousemove aren't fired all the way to edges by browser
    				let snapH = true;
    				let snapV = true;
    				let snapProx = 10;

    				let dragH, dragV;

    				if (scaleX.ori == 0) {
    					dragH = dragX;
    					dragV = dragY;
    				}
    				else {
    					dragH = dragY;
    					dragV = dragX;
    				}

    				if (dragH && dragV) {
    					// maybe omni corner snap
    					snapH = mouseLeft1 <= snapProx || mouseLeft1 >= plotWidCss - snapProx;
    					snapV = mouseTop1  <= snapProx || mouseTop1  >= plotHgtCss - snapProx;
    				}

    				if (dragH && snapH)
    					mouseLeft1 = mouseLeft1 < mouseLeft0 ? 0 : plotWidCss;

    				if (dragV && snapV)
    					mouseTop1 = mouseTop1 < mouseTop0 ? 0 : plotHgtCss;

    				updateCursor(null, true, true);

    				dragging = false;
    			}

    			mouseLeft1 = -10;
    			mouseTop1 = -10;

    			// passing a non-null timestamp to force sync/mousemove event
    			updateCursor(null, true, true);

    			if (_dragging)
    				dragging = _dragging;
    		}
    	}

    	function dblClick(e, src, _l, _t, _w, _h, _i) {
    		autoScaleX();

    		hideSelect();

    		if (e != null)
    			pubSync(dblclick, self, mouseLeft1, mouseTop1, plotWidCss, plotHgtCss, null);
    	}

    	function syncPxRatio() {
    		axes.forEach(syncFontSize);
    		_setSize(self.width, self.height, true);
    	}

    	on(dppxchange, win, syncPxRatio);

    	// internal pub/sub
    	const events = {};

    	events.mousedown = mouseDown;
    	events.mousemove = mouseMove;
    	events.mouseup = mouseUp;
    	events.dblclick = dblClick;
    	events["setSeries"] = (e, src, idx, opts) => {
    		setSeries(idx, opts, true, false);
    	};

    	if (cursor.show) {
    		onMouse(mousedown,  over, mouseDown);
    		onMouse(mousemove,  over, mouseMove);
    		onMouse(mouseenter, over, syncRect);
    		onMouse(mouseleave, over, mouseLeave);

    		onMouse(dblclick, over, dblClick);

    		cursorPlots.add(self);

    		self.syncRect = syncRect;
    	}

    	// external on/off
    	const hooks = self.hooks = opts.hooks || {};

    	function fire(evName, a1, a2) {
    		if (evName in hooks) {
    			hooks[evName].forEach(fn => {
    				fn.call(null, self, a1, a2);
    			});
    		}
    	}

    	(opts.plugins || []).forEach(p => {
    		for (let evName in p.hooks)
    			hooks[evName] = (hooks[evName] || []).concat(p.hooks[evName]);
    	});

    	const syncOpts = assign({
    		key: null,
    		setSeries: false,
    		filters: {
    			pub: retTrue,
    			sub: retTrue,
    		},
    		scales: [xScaleKey, series[1] ? series[1].scale : null],
    		match: [retEq, retEq],
    		values: [null, null],
    	}, cursor.sync);

    	(cursor.sync = syncOpts);

    	const syncKey = syncOpts.key;

    	const sync = _sync(syncKey);

    	function pubSync(type, src, x, y, w, h, i) {
    		if (syncOpts.filters.pub(type, src, x, y, w, h, i))
    			sync.pub(type, src, x, y, w, h, i);
    	}

    	sync.sub(self);

    	function pub(type, src, x, y, w, h, i) {
    		if (syncOpts.filters.sub(type, src, x, y, w, h, i))
    			events[type](null, src, x, y, w, h, i);
    	}

    	(self.pub = pub);

    	function destroy() {
    		sync.unsub(self);
    		cursorPlots.delete(self);
    		mouseListeners.clear();
    		off(dppxchange, win, syncPxRatio);
    		root.remove();
    		legendEl?.remove(); // in case mounted outside of root
    		fire("destroy");
    	}

    	self.destroy = destroy;

    	function _init() {
    		fire("init", opts, data);

    		setData(data || opts.data, false);

    		if (pendScales[xScaleKey])
    			setScale(xScaleKey, pendScales[xScaleKey]);
    		else
    			autoScaleX();

    		shouldSetSelect = select.show;
    		shouldSetCursor = shouldSetLegend = true;

    		_setSize(opts.width, opts.height);
    	}

    	series.forEach(initSeries);

    	axes.forEach(initAxis);

    	if (then) {
    		if (then instanceof HTMLElement) {
    			then.appendChild(root);
    			_init();
    		}
    		else
    			then(self, _init);
    	}
    	else
    		_init();

    	return self;
    }

    uPlot.assign = assign;
    uPlot.fmtNum = fmtNum;
    uPlot.rangeNum = rangeNum;
    uPlot.rangeLog = rangeLog;
    uPlot.rangeAsinh = rangeAsinh;
    uPlot.orient   = orient;
    uPlot.pxRatio = pxRatio;

    {
    	uPlot.join = join;
    }

    {
    	uPlot.fmtDate = fmtDate;
    	uPlot.tzDate  = tzDate$1;
    }

    {
    	uPlot.sync = _sync;
    }

    {
    	uPlot.addGap = addGap;
    	uPlot.clipGaps = clipGaps;

    	let paths = uPlot.paths = {
    		points,
    	};

    	(paths.linear  = linear);
    	(paths.stepped = stepped);
    	(paths.bars    = bars);
    	(paths.spline  = monotoneCubic);
    }

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop$1) {
        let stop;
        const subscribers = new Set();
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (const subscriber of subscribers) {
                        subscriber[1]();
                        subscriber_queue.push(subscriber, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop$1) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop$1;
            }
            run(value);
            return () => {
                subscribers.delete(subscriber);
                if (subscribers.size === 0 && stop) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }

    const widgetNames = {
        CHART_WIDGET: 'chart-widget',
    };

    const storeState = {
      options: {},
      [widgetNames.CHART_WIDGET]: {
        loading: false,
        data: [],
        error: [],
      },
    };
    const mainStore = writable(storeState);

    const { update } = mainStore;

    const updateOptions = (options) => {
      update((store) => ({ ...store, options }));
    };

    const updateChartWidget = (chartWidget) => {
      update((store) => ({
        ...store,
        [widgetNames.CHART_WIDGET]: {
          ...store[widgetNames.CHART_WIDGET],
          ...chartWidget,
        },
      }));
    };

    const mockData = {
      data: [
        {
          open: "0.0708000000000000",
          high: "0.0710450000000000",
          low: "0.0706434000000000",
          close: "0.0708350100000000",
          volume: "1818.1433015300000000",
          period: 1530720000000,
        },
        {
          open: "0.0708316700000000",
          high: "0.0715192000000000",
          low: "0.0706544100000000",
          close: "0.0712472600000000",
          volume: "1649.2534471200000000",
          period: 1530748800000,
        },
        {
          open: "0.0712452600000000",
          high: "0.0717550000000000",
          low: "0.0709818600000000",
          close: "0.0713202600000000",
          volume: "1727.3015548300000000",
          period: 1530777600000,
        },
        {
          open: "0.0713400000000000",
          high: "0.0716440200000000",
          low: "0.0709436400000000",
          close: "0.0716373500000000",
          volume: "832.2377254200000000",
          period: 1530806400000,
        },
        {
          open: "0.0716852400000000",
          high: "0.0717850000000000",
          low: "0.0700000000000000",
          close: "0.0703750000000000",
          volume: "2791.1439402600000000",
          period: 1530835200000,
        },
        {
          open: "0.0703750000000000",
          high: "0.0714796800000000",
          low: "0.0702492000000000",
          close: "0.0712949900000000",
          volume: "1878.1581776500000000",
          period: 1530864000000,
        },
        {
          open: "0.0711771600000000",
          high: "0.0717000000000000",
          low: "0.0708528700000000",
          close: "0.0711200000000000",
          volume: "1368.7725389300000000",
          period: 1530892800000,
        },
        {
          open: "0.0711300000000000",
          high: "0.0714714300000000",
          low: "0.0707802600000000",
          close: "0.0712365000000000",
          volume: "865.5540202300000000",
          period: 1530921600000,
        },
        {
          open: "0.0712364900000000",
          high: "0.0716181400000000",
          low: "0.0708000000000000",
          close: "0.0711000100000000",
          volume: "1228.4198248600000000",
          period: 1530950400000,
        },
        {
          open: "0.0711894700000000",
          high: "0.0718431700000000",
          low: "0.0702000000000000",
          close: "0.0718431700000000",
          volume: "2143.3020698900000000",
          period: 1530979200000,
        },
        {
          open: "0.0719900000000000",
          high: "0.0731662700000000",
          low: "0.0717050100000000",
          close: "0.0719200000000000",
          volume: "1663.2797136100000000",
          period: 1531008000000,
        },
        {
          open: "0.0719250000000000",
          high: "0.0729799900000000",
          low: "0.0718556400000000",
          close: "0.0727000100000000",
          volume: "1462.4665687900000000",
          period: 1531036800000,
        },
        {
          open: "0.0727000100000000",
          high: "0.0729700000000000",
          low: "0.0721251500000000",
          close: "0.0724850100000000",
          volume: "1809.6590769100000000",
          period: 1531065600000,
        },
        {
          open: "0.0725550000000000",
          high: "0.0726932200000000",
          low: "0.0715000100000000",
          close: "0.0719300000000000",
          volume: "1489.4695856800000000",
          period: 1531094400000,
        },
        {
          open: "0.0719350000000000",
          high: "0.0720063800000000",
          low: "0.0712516100000000",
          close: "0.0714000000000000",
          volume: "1305.2166636100000000",
          period: 1531123200000,
        },
        {
          open: "0.0713949900000000",
          high: "0.0714000000000000",
          low: "0.0706850100000000",
          close: "0.0707060000000000",
          volume: "1757.5901286100000000",
          period: 1531152000000,
        },
        {
          open: "0.0706850100000000",
          high: "0.0709288900000000",
          low: "0.0690000000000000",
          close: "0.0692376500000000",
          volume: "4134.9898355400000000",
          period: 1531180800000,
        },
        {
          open: "0.0692004800000000",
          high: "0.0695000000000000",
          low: "0.0674380600000000",
          close: "0.0690250000000000",
          volume: "4217.5220123100000000",
          period: 1531209600000,
        },
        {
          open: "0.0690250000000000",
          high: "0.0692500000000000",
          low: "0.0681924800000000",
          close: "0.0686250000000000",
          volume: "1564.4274571600000000",
          period: 1531238400000,
        },
        {
          open: "0.0686302400000000",
          high: "0.0689979800000000",
          low: "0.0676004000000000",
          close: "0.0687697400000000",
          volume: "1897.3264469400000000",
          period: 1531267200000,
        },
        {
          open: "0.0686358400000000",
          high: "0.0699000000000000",
          low: "0.0685351500000000",
          close: "0.0691300000000000",
          volume: "3554.7047582000000000",
          period: 1531296000000,
        },
        {
          open: "0.0690850000000000",
          high: "0.0699119000000000",
          low: "0.0686500200000000",
          close: "0.0697500000000000",
          volume: "1254.6803122500000000",
          period: 1531324800000,
        },
        {
          open: "0.0696900000000000",
          high: "0.0701733300000000",
          low: "0.0691920000000000",
          close: "0.0698973300000000",
          volume: "1560.8181853000000000",
          period: 1531353600000,
        },
        {
          open: "0.0698973300000000",
          high: "0.0702000000000000",
          low: "0.0691950900000000",
          close: "0.0697030000000000",
          volume: "4291.7702089600000000",
          period: 1531382400000,
        },
        {
          open: "0.0697029900000000",
          high: "0.0701000000000000",
          low: "0.0686529500000000",
          close: "0.0688606500000000",
          volume: "1700.7687711700000000",
          period: 1531411200000,
        },
        {
          open: "0.0688604300000000",
          high: "0.0700562200000000",
          low: "0.0688604300000000",
          close: "0.0698850000000000",
          volume: "4853.9876114100000000",
          period: 1531440000000,
        },
        {
          open: "0.0698652400000000",
          high: "0.0704701500000000",
          low: "0.0697304100000000",
          close: "0.0700050000000000",
          volume: "1717.8862759500000000",
          period: 1531468800000,
        },
        {
          open: "0.0699774400000000",
          high: "0.0700500000000000",
          low: "0.0693500000000000",
          close: "0.0694784500000000",
          volume: "1700.4209570200000000",
          period: 1531497600000,
        },
        {
          open: "0.0695054900000000",
          high: "0.0697200000000000",
          low: "0.0692284000000000",
          close: "0.0694482600000000",
          volume: "819.9396176500000000",
          period: 1531526400000,
        },
        {
          open: "0.0694512800000000",
          high: "0.0699999800000000",
          low: "0.0693163000000000",
          close: "0.0697800000000000",
          volume: "513.2843779900000000",
          period: 1531555200000,
        },
        {
          open: "0.0697800000000000",
          high: "0.0701231000000000",
          low: "0.0690950200000000",
          close: "0.0693935200000000",
          volume: "1018.4489863700000000",
          period: 1531584000000,
        },
        {
          open: "0.0692600000000000",
          high: "0.0696019800000000",
          low: "0.0690873800000000",
          close: "0.0694412600000000",
          volume: "427.9522534700000000",
          period: 1531612800000,
        },
        {
          open: "0.0694450000000000",
          high: "0.0709350000000000",
          low: "0.0694400000000000",
          close: "0.0709350000000000",
          volume: "1189.5625595600000000",
          period: 1531641600000,
        },
        {
          open: "0.0709350000000000",
          high: "0.0711370000000000",
          low: "0.0704796500000000",
          close: "0.0706550000000000",
          volume: "640.3759941800000000",
          period: 1531670400000,
        },
      ],
      timestamp: 1533581190540,
    };

    const mockData1 = [
      [1546300800, 1546387200, 1546473600],
      [1284.7, 1319.9, 1318.7],
      [1284.75, 1320.6, 1327],
      [1282.85, 1315, 1318.7],
      [1283.35, 1315.3, 1326.1],
      [324, 231, 233],
    ];

    const getChartData = async (chartOptions) => {
      updateChartWidget({ loading: true });
      try {
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve(mockData);
          }, 1000);
        }).then(({ data }) => {
          updateChartWidget({ data });
        });
      } catch (error) {
        updateChartWidget({ error: error });
      }
      updateChartWidget({ loading: false });
    };

    const fixEqualMinMax = ({ min, max }) => {
      if (min == max) {
        min = Math.floor(min);
        max = Math.ceil(max);

        if (min == max) {
          max = max + 1;
        }
      }
      return { min, max };
    };

    const getMinMaxData = (data) => {
      // Date, Open, High, Low, Close, Volume
      const max = Math.max(...(data[2] || []));
      const min = Math.min(...(data[3] || []));
      return { max, min };
    };

    const convertApiResponseToChartData = (response) => {
      const date = [];
      const open = [];
      const high = [];
      const low = [];
      const close = [];
      const volume = [];

      response.forEach((quote) => {
        date.push(quote.period);
        open.push(quote.open);
        high.push(quote.high);
        low.push(quote.low);
        close.push(quote.close);
        volume.push(quote.volume);
      });

      return [date, open, high, low, close, volume];
    };

    const tzDate = (ts) => uPlot.tzDate(new Date(ts * 1e3), "Etc/UTC");

    const xAxesIncrs = [
      // minute divisors (# of secs)
      1,
      5,
      10,
      15,
      30,
      // hour divisors
      60,
      60 * 5,
      60 * 10,
      60 * 15,
      60 * 30,
      // day divisors
      3600,
      // ...
    ];

    // [0]:   minimum num secs in found axis split (tick incr)
    // [1]:   default tick format
    // [2-7]: rollover tick formats
    // [8]:   mode: 0: replace [1] -> [2-7], 1: concat [1] + [2-7]
    // Before add new date format as MMMM / WWWW/ WWW please add translates for these periods to getDateTranslates

    const xAxesValues = [
      // tick incr        default        year               month    day            hour     min      sec    mode
      [3600 * 24 * 365, "{YYYY}", null, null, null, null, null, null, 1],
      [3600 * 24 * 28, "{MMM}", "\n{YYYY}", null, null, null, null, null, 1],
      [3600 * 24, "{M}/{D}", "\n{YYYY}", null, null, null, null, null, 1],
      [3600, "{HH}:{mm}", "\n{M}/{D}/{YY}", null, "\n{M}/{D}", null, null, null, 1],
      [60, "{HH}:{mm}", "\n{M}/{D}/{YY}", null, "\n{M}/{D}", null, null, null, 1],
    ];

    const defaultCandleChartConfig = {
      width: 0,
      height: 0,
      xAxisSize: 50,
      yAxisSize: 65,
      xAxisFont: "10px Arial",
      yAxisFont: "10px Arial",
      yAxisDecimalsInFloat: 3,
      candleGap: 2,
      candleBearishColor: "#fc3c5f",
      candleBullishColor: "#48b479",
      candleMaxWidth: 20,
      candleShadowWidth: 2,
      candleOutline: 1,
      tooltipDateFormat: "{MM}/{DD}/{YYYY} {HH}:{MM}",
      tooltipDecimalsInFloat: 3,
      heightToWidthRatio: 0.6,
      isResizable: true,
    };

    const getCandleChartOptions = ({ min, max, chartConfigs }) => {
      const config = { ...defaultCandleChartConfig, ...chartConfigs };
      const fixedMinMax = fixEqualMinMax({ min, max });
      min = fixedMinMax.min;
      max = fixedMinMax.max;

      // if (config.isResizable) {
      //   plugins.push(resize({ heightToWidthRatio: config.heightToWidthRatio }));
      // }

      return {
        width: config.width,
        height: config.height,
        tzDate,
        // fmtDate: (tpl) => (date) => {
        //   console.log(">>>", date);
        //   return !isNaN(date.getTime())
        //     ? uPlot.fmtDate(tpl, getDateTranslates())(date)
        //     : "";
        // },
        // plugins,
        scales: {
          x: { distr: 2 },
          y: { min, max },
        },
        series: [
          {
            label: "Date",
            value: (u, ts) => console.log("Date", ts) || "",
            // uPlot.fmtDate(config.tooltipDateFormat)(tzDate(ts)),
          },
          {
            label: "Open",
            value: (u, value) =>
              console.log("Open", value, u) ||
              value.toFixed(config.tooltipDecimalsInFloat),
          },
          {
            label: "High",
            value: (u, value) => value.toFixed(config.tooltipDecimalsInFloat),
          },
          {
            label: "Low",
            value: (u, value) => value.toFixed(config.tooltipDecimalsInFloat),
          },
          {
            label: "Close",
            value: (u, value) => value.toFixed(config.tooltipDecimalsInFloat),
          },
          {
            label: "Volume",
            value: (u, value) => value.toFixed(config.tooltipDecimalsInFloat),
          },
        ],
        axes: [
          {
            size: config.xAxisSize,
            font: config.xAxisFont,
            incrs: xAxesIncrs,
            values: xAxesValues,
          },
          {
            side: 1,
            size: config.yAxisSize,
            font: config.yAxisFont,
            values: (self, ticks) =>
              ticks.map((rawValue) =>
                rawValue.toFixed(config.yAxisDecimalsInFloat)
              ),
          },
        ],
      };
    };

    /* src/components/chartWidget/ChartWidgetWrapper.svelte generated by Svelte v3.56.0 */

    const file$1 = "src/components/chartWidget/ChartWidgetWrapper.svelte";

    // (7:4) {#if !chartDataLoading && chartDataError.length === 0 }
    function create_if_block_2(ctx) {
    	let current;
    	const default_slot_template = /*#slots*/ ctx[3].default;
    	const default_slot = create_slot(default_slot_template, ctx, /*$$scope*/ ctx[2], null);

    	const block = {
    		c: function create() {
    			if (default_slot) default_slot.c();
    		},
    		m: function mount(target, anchor) {
    			if (default_slot) {
    				default_slot.m(target, anchor);
    			}

    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if (default_slot) {
    				if (default_slot.p && (!current || dirty & /*$$scope*/ 4)) {
    					update_slot_base(
    						default_slot,
    						default_slot_template,
    						ctx,
    						/*$$scope*/ ctx[2],
    						!current
    						? get_all_dirty_from_scope(/*$$scope*/ ctx[2])
    						: get_slot_changes(default_slot_template, /*$$scope*/ ctx[2], dirty, null),
    						null
    					);
    				}
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(default_slot, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(default_slot, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (default_slot) default_slot.d(detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_2.name,
    		type: "if",
    		source: "(7:4) {#if !chartDataLoading && chartDataError.length === 0 }",
    		ctx
    	});

    	return block;
    }

    // (10:4) {#if chartDataLoading}
    function create_if_block_1(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			div.textContent = "Loading....";
    			attr_dev(div, "class", "chart-wrapper__loading");
    			add_location(div, file$1, 10, 8, 239);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block_1.name,
    		type: "if",
    		source: "(10:4) {#if chartDataLoading}",
    		ctx
    	});

    	return block;
    }

    // (13:4) {#if chartDataError.length > 0}
    function create_if_block$1(ctx) {
    	let div;
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			div = element("div");
    			t0 = text("Error: ");
    			t1 = text(/*chartDataError*/ ctx[1]);
    			attr_dev(div, "class", "chart-wrapper__error");
    			add_location(div, file$1, 13, 8, 347);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, t0);
    			append_dev(div, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*chartDataError*/ 2) set_data_dev(t1, /*chartDataError*/ ctx[1]);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(13:4) {#if chartDataError.length > 0}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div;
    	let t0;
    	let t1;
    	let current;
    	let if_block0 = !/*chartDataLoading*/ ctx[0] && /*chartDataError*/ ctx[1].length === 0 && create_if_block_2(ctx);
    	let if_block1 = /*chartDataLoading*/ ctx[0] && create_if_block_1(ctx);
    	let if_block2 = /*chartDataError*/ ctx[1].length > 0 && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			if (if_block0) if_block0.c();
    			t0 = space();
    			if (if_block1) if_block1.c();
    			t1 = space();
    			if (if_block2) if_block2.c();
    			attr_dev(div, "class", "chart-wrapper");
    			add_location(div, file$1, 5, 0, 84);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			if (if_block0) if_block0.m(div, null);
    			append_dev(div, t0);
    			if (if_block1) if_block1.m(div, null);
    			append_dev(div, t1);
    			if (if_block2) if_block2.m(div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (!/*chartDataLoading*/ ctx[0] && /*chartDataError*/ ctx[1].length === 0) {
    				if (if_block0) {
    					if_block0.p(ctx, dirty);

    					if (dirty & /*chartDataLoading, chartDataError*/ 3) {
    						transition_in(if_block0, 1);
    					}
    				} else {
    					if_block0 = create_if_block_2(ctx);
    					if_block0.c();
    					transition_in(if_block0, 1);
    					if_block0.m(div, t0);
    				}
    			} else if (if_block0) {
    				group_outros();

    				transition_out(if_block0, 1, 1, () => {
    					if_block0 = null;
    				});

    				check_outros();
    			}

    			if (/*chartDataLoading*/ ctx[0]) {
    				if (if_block1) ; else {
    					if_block1 = create_if_block_1(ctx);
    					if_block1.c();
    					if_block1.m(div, t1);
    				}
    			} else if (if_block1) {
    				if_block1.d(1);
    				if_block1 = null;
    			}

    			if (/*chartDataError*/ ctx[1].length > 0) {
    				if (if_block2) {
    					if_block2.p(ctx, dirty);
    				} else {
    					if_block2 = create_if_block$1(ctx);
    					if_block2.c();
    					if_block2.m(div, null);
    				}
    			} else if (if_block2) {
    				if_block2.d(1);
    				if_block2 = null;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block0);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block0) if_block0.d();
    			if (if_block1) if_block1.d();
    			if (if_block2) if_block2.d();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ChartWidgetWrapper', slots, ['default']);
    	let { chartDataLoading } = $$props;
    	let { chartDataError } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (chartDataLoading === undefined && !('chartDataLoading' in $$props || $$self.$$.bound[$$self.$$.props['chartDataLoading']])) {
    			console.warn("<ChartWidgetWrapper> was created without expected prop 'chartDataLoading'");
    		}

    		if (chartDataError === undefined && !('chartDataError' in $$props || $$self.$$.bound[$$self.$$.props['chartDataError']])) {
    			console.warn("<ChartWidgetWrapper> was created without expected prop 'chartDataError'");
    		}
    	});

    	const writable_props = ['chartDataLoading', 'chartDataError'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<ChartWidgetWrapper> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('chartDataLoading' in $$props) $$invalidate(0, chartDataLoading = $$props.chartDataLoading);
    		if ('chartDataError' in $$props) $$invalidate(1, chartDataError = $$props.chartDataError);
    		if ('$$scope' in $$props) $$invalidate(2, $$scope = $$props.$$scope);
    	};

    	$$self.$capture_state = () => ({ chartDataLoading, chartDataError });

    	$$self.$inject_state = $$props => {
    		if ('chartDataLoading' in $$props) $$invalidate(0, chartDataLoading = $$props.chartDataLoading);
    		if ('chartDataError' in $$props) $$invalidate(1, chartDataError = $$props.chartDataError);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [chartDataLoading, chartDataError, $$scope, slots];
    }

    class ChartWidgetWrapper extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { chartDataLoading: 0, chartDataError: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ChartWidgetWrapper",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get chartDataLoading() {
    		throw new Error("<ChartWidgetWrapper>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set chartDataLoading(value) {
    		throw new Error("<ChartWidgetWrapper>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get chartDataError() {
    		throw new Error("<ChartWidgetWrapper>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set chartDataError(value) {
    		throw new Error("<ChartWidgetWrapper>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/components/chartWidget/ChartWidget.svelte generated by Svelte v3.56.0 */

    const { console: console_1 } = globals;
    const file = "src/components/chartWidget/ChartWidget.svelte";

    // (63:4) <ChartWidgetWrapper chartDataLoading={chartDataLoading} chartDataError={chartDataError}>
    function create_default_slot(ctx) {
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div2;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			div0.textContent = "Period buttons";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "Chart type buttons";
    			t3 = space();
    			div2 = element("div");
    			add_location(div0, file, 63, 8, 1892);
    			add_location(div1, file, 64, 8, 1926);
    			attr_dev(div2, "class", "chart-widget svelte-4zegu");
    			attr_dev(div2, "id", 'chart-widget');
    			add_location(div2, file, 66, 8, 1965);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);
    			/*div2_binding*/ ctx[4](div2);
    		},
    		p: noop$1,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    			/*div2_binding*/ ctx[4](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_default_slot.name,
    		type: "slot",
    		source: "(63:4) <ChartWidgetWrapper chartDataLoading={chartDataLoading} chartDataError={chartDataError}>",
    		ctx
    	});

    	return block;
    }

    function create_fragment$1(ctx) {
    	let div;
    	let h3;
    	let t1;
    	let chartwidgetwrapper;
    	let current;

    	chartwidgetwrapper = new ChartWidgetWrapper({
    			props: {
    				chartDataLoading: /*chartDataLoading*/ ctx[1],
    				chartDataError: /*chartDataError*/ ctx[2],
    				$$slots: { default: [create_default_slot] },
    				$$scope: { ctx }
    			},
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			div = element("div");
    			h3 = element("h3");
    			h3.textContent = "Chart widget";
    			t1 = space();
    			create_component(chartwidgetwrapper.$$.fragment);
    			add_location(h3, file, 61, 4, 1769);
    			attr_dev(div, "class", "chart-widget svelte-4zegu");
    			add_location(div, file, 60, 0, 1738);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h3);
    			append_dev(div, t1);
    			mount_component(chartwidgetwrapper, div, null);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			const chartwidgetwrapper_changes = {};
    			if (dirty & /*chartDataLoading*/ 2) chartwidgetwrapper_changes.chartDataLoading = /*chartDataLoading*/ ctx[1];
    			if (dirty & /*chartDataError*/ 4) chartwidgetwrapper_changes.chartDataError = /*chartDataError*/ ctx[2];

    			if (dirty & /*$$scope, chartElement*/ 513) {
    				chartwidgetwrapper_changes.$$scope = { dirty, ctx };
    			}

    			chartwidgetwrapper.$set(chartwidgetwrapper_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(chartwidgetwrapper.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(chartwidgetwrapper.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			destroy_component(chartwidgetwrapper);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('ChartWidget', slots, []);
    	let { widgetOptions } = $$props;
    	let { chartElement } = $$props;
    	const chartOptions = {};
    	let chart;
    	let { chartData, chartDataLoading, chartDataError } = {};

    	onMount(() => {
    		console.log('>>>widgetOptions', widgetOptions);
    		getChartData();
    	});

    	mainStore.subscribe(store => {
    		chartData = store[widgetNames.CHART_WIDGET].data;
    		$$invalidate(1, chartDataLoading = store[widgetNames.CHART_WIDGET].loading);
    		$$invalidate(2, chartDataError = store[widgetNames.CHART_WIDGET].error);
    	});

    	const renderChart = () => {
    		if (!chartElement) return;

    		// const serializedChartData = convertApiResponseToChartData(chartData.slice(1,4));
    		const { min, max } = getMinMaxData(mockData1);

    		const options = getCandleChartOptions({
    			min,
    			max,
    			chartConfigs: { height: 300, width: 600 }
    		});

    		console.log('>>> options', options);
    		console.log('>>>formalizedChartData', mockData1);
    		chart = new uPlot(options, mockData1, chartElement);
    	};

    	afterUpdate(async () => {
    		await renderChart();
    	});

    	$$self.$$.on_mount.push(function () {
    		if (widgetOptions === undefined && !('widgetOptions' in $$props || $$self.$$.bound[$$self.$$.props['widgetOptions']])) {
    			console_1.warn("<ChartWidget> was created without expected prop 'widgetOptions'");
    		}

    		if (chartElement === undefined && !('chartElement' in $$props || $$self.$$.bound[$$self.$$.props['chartElement']])) {
    			console_1.warn("<ChartWidget> was created without expected prop 'chartElement'");
    		}
    	});

    	const writable_props = ['widgetOptions', 'chartElement'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console_1.warn(`<ChartWidget> was created with unknown prop '${key}'`);
    	});

    	function div2_binding($$value) {
    		binding_callbacks[$$value ? 'unshift' : 'push'](() => {
    			chartElement = $$value;
    			$$invalidate(0, chartElement);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ('widgetOptions' in $$props) $$invalidate(3, widgetOptions = $$props.widgetOptions);
    		if ('chartElement' in $$props) $$invalidate(0, chartElement = $$props.chartElement);
    	};

    	$$self.$capture_state = () => ({
    		uPlot,
    		onMount,
    		afterUpdate,
    		mainStore,
    		getChartData,
    		getCandleChartOptions,
    		widgetNames,
    		ChartWidgetWrapper,
    		convertApiResponseToChartData,
    		getMinMaxData,
    		mockData1,
    		widgetOptions,
    		chartElement,
    		chartOptions,
    		chart,
    		chartData,
    		chartDataLoading,
    		chartDataError,
    		renderChart
    	});

    	$$self.$inject_state = $$props => {
    		if ('widgetOptions' in $$props) $$invalidate(3, widgetOptions = $$props.widgetOptions);
    		if ('chartElement' in $$props) $$invalidate(0, chartElement = $$props.chartElement);
    		if ('chart' in $$props) chart = $$props.chart;
    		if ('chartData' in $$props) chartData = $$props.chartData;
    		if ('chartDataLoading' in $$props) $$invalidate(1, chartDataLoading = $$props.chartDataLoading);
    		if ('chartDataError' in $$props) $$invalidate(2, chartDataError = $$props.chartDataError);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [chartElement, chartDataLoading, chartDataError, widgetOptions, div2_binding];
    }

    class ChartWidget extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { widgetOptions: 3, chartElement: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "ChartWidget",
    			options,
    			id: create_fragment$1.name
    		});
    	}

    	get widgetOptions() {
    		throw new Error("<ChartWidget>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set widgetOptions(value) {
    		throw new Error("<ChartWidget>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get chartElement() {
    		throw new Error("<ChartWidget>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set chartElement(value) {
    		throw new Error("<ChartWidget>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/App.svelte generated by Svelte v3.56.0 */

    // (9:0) {#if widgetName === widgetNames.CHART_WIDGET}
    function create_if_block(ctx) {
    	let chartwidget;
    	let current;

    	chartwidget = new ChartWidget({
    			props: { widgetOptions: /*widgetOptions*/ ctx[1] },
    			$$inline: true
    		});

    	const block = {
    		c: function create() {
    			create_component(chartwidget.$$.fragment);
    		},
    		m: function mount(target, anchor) {
    			mount_component(chartwidget, target, anchor);
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			const chartwidget_changes = {};
    			if (dirty & /*widgetOptions*/ 2) chartwidget_changes.widgetOptions = /*widgetOptions*/ ctx[1];
    			chartwidget.$set(chartwidget_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(chartwidget.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(chartwidget.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(chartwidget, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(9:0) {#if widgetName === widgetNames.CHART_WIDGET}",
    		ctx
    	});

    	return block;
    }

    function create_fragment(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*widgetName*/ ctx[0] === widgetNames.CHART_WIDGET && create_if_block(ctx);

    	const block = {
    		c: function create() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert_dev(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*widgetName*/ ctx[0] === widgetNames.CHART_WIDGET) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*widgetName*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(if_block_anchor.parentNode, if_block_anchor);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach_dev(if_block_anchor);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots('App', slots, []);
    	let { widgetName } = $$props;
    	let { widgetOptions } = $$props;

    	$$self.$$.on_mount.push(function () {
    		if (widgetName === undefined && !('widgetName' in $$props || $$self.$$.bound[$$self.$$.props['widgetName']])) {
    			console.warn("<App> was created without expected prop 'widgetName'");
    		}

    		if (widgetOptions === undefined && !('widgetOptions' in $$props || $$self.$$.bound[$$self.$$.props['widgetOptions']])) {
    			console.warn("<App> was created without expected prop 'widgetOptions'");
    		}
    	});

    	const writable_props = ['widgetName', 'widgetOptions'];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== '$$' && key !== 'slot') console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$$set = $$props => {
    		if ('widgetName' in $$props) $$invalidate(0, widgetName = $$props.widgetName);
    		if ('widgetOptions' in $$props) $$invalidate(1, widgetOptions = $$props.widgetOptions);
    	};

    	$$self.$capture_state = () => ({
    		ChartWidget,
    		widgetName,
    		widgetOptions,
    		widgetNames
    	});

    	$$self.$inject_state = $$props => {
    		if ('widgetName' in $$props) $$invalidate(0, widgetName = $$props.widgetName);
    		if ('widgetOptions' in $$props) $$invalidate(1, widgetOptions = $$props.widgetOptions);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [widgetName, widgetOptions];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance, create_fragment, safe_not_equal, { widgetName: 0, widgetOptions: 1 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment.name
    		});
    	}

    	get widgetName() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set widgetName(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get widgetOptions() {
    		throw new Error("<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set widgetOptions(value) {
    		throw new Error("<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    const setOptionsToStore = (options) => {
      updateOptions(options);
    };

    const getApp = ({ elementId, widgetName, widgetOptions }) => {
      if (!elementId) {
        console.warn("Element id is not specified");
      }
      if (!widgetName) {
        console.warn("Name of chart is not specified");
      }

      return new App({
        target: document.getElementById(elementId),
        props: {
          widgetName,
          widgetOptions,
        },
      });
    };

    window.getApp = getApp;

    window.setWidgetOptions = setOptionsToStore;

})();
//# sourceMappingURL=bundle.js.map
