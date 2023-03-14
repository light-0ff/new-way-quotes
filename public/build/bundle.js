
(function(l, r) { if (!l || l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (self.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(self.document);
(function () {
    'use strict';

    function noop() { }
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
    function empty() {
        return text('');
    }
    function children(element) {
        return Array.from(element.childNodes);
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
            update: noop,
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
            this.$destroy = noop;
        }
        $on(type, callback) {
            if (!is_function(callback)) {
                return noop;
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

    const subscriber_queue = [];
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
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
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.add(subscriber);
            if (subscribers.size === 1) {
                stop = start(set) || noop;
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
    const getChartData = async (chartOptions) => {
      updateChartWidget({ loading: true });
      try {
        await new Promise((resolve, reject) => {
          resolve(mockData);
        }).then(({ data }) => {
          updateChartWidget({ data });
        });
      } catch (error) {
        updateChartWidget({ error: error });
      }
      updateChartWidget({ loading: false });
    };

    /* src/components/chartWidget/ChartWidget.svelte generated by Svelte v3.56.0 */

    function create_fragment$1(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			div.innerHTML = `<h3>Chart widget5</h3>`;
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { widgetOptions } = $$props;

    	onMount(() => {
    		getChartData();
    	});

    	mainStore.subscribe(store => {
    		store[widgetNames.CHART_WIDGET].data;
    		console.log('>>>chartData', store[widgetNames.CHART_WIDGET]);
    	});

    	$$self.$$set = $$props => {
    		if ('widgetOptions' in $$props) $$invalidate(0, widgetOptions = $$props.widgetOptions);
    	};

    	return [widgetOptions];
    }

    class ChartWidget extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, { widgetOptions: 0 });
    	}
    }

    /* src/App.svelte generated by Svelte v3.56.0 */

    function create_if_block(ctx) {
    	let chartwidget;
    	let current;

    	chartwidget = new ChartWidget({
    			props: { widgetOptions: /*widgetOptions*/ ctx[1] }
    		});

    	return {
    		c() {
    			create_component(chartwidget.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(chartwidget, target, anchor);
    			current = true;
    		},
    		p(ctx, dirty) {
    			const chartwidget_changes = {};
    			if (dirty & /*widgetOptions*/ 2) chartwidget_changes.widgetOptions = /*widgetOptions*/ ctx[1];
    			chartwidget.$set(chartwidget_changes);
    		},
    		i(local) {
    			if (current) return;
    			transition_in(chartwidget.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(chartwidget.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(chartwidget, detaching);
    		}
    	};
    }

    function create_fragment(ctx) {
    	let if_block_anchor;
    	let current;
    	let if_block = /*widgetName*/ ctx[0] === widgetNames.CHART_WIDGET && create_if_block(ctx);

    	return {
    		c() {
    			if (if_block) if_block.c();
    			if_block_anchor = empty();
    		},
    		m(target, anchor) {
    			if (if_block) if_block.m(target, anchor);
    			insert(target, if_block_anchor, anchor);
    			current = true;
    		},
    		p(ctx, [dirty]) {
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
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (if_block) if_block.d(detaching);
    			if (detaching) detach(if_block_anchor);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
    	let { widgetName } = $$props;
    	let { widgetOptions } = $$props;

    	$$self.$$set = $$props => {
    		if ('widgetName' in $$props) $$invalidate(0, widgetName = $$props.widgetName);
    		if ('widgetOptions' in $$props) $$invalidate(1, widgetOptions = $$props.widgetOptions);
    	};

    	return [widgetName, widgetOptions];
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance, create_fragment, safe_not_equal, { widgetName: 0, widgetOptions: 1 });
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

    console.log(">>> getApp initialized");
    window.getApp = getApp;

    window.setWidgetOptions = setOptionsToStore;

})();
//# sourceMappingURL=bundle.js.map
