(function (l, r) {
  if (l.getElementById("livereloadscript")) return;
  r = l.createElement("script");
  r.async = 1;
  r.src =
    "//" +
    (window.location.host || "localhost").split(":")[0] +
    ":35729/livereload.js?snipver=1";
  r.id = "livereloadscript";
  l.getElementsByTagName("head")[0].appendChild(r);
})(window.document);
function noop() {}
function add_location(element, file, line, column, char) {
  element.__svelte_meta = {
    loc: { file, line, column, char },
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
  return typeof thing === "function";
}
function safe_not_equal(a, b) {
  return a != a
    ? b == b
    : a !== b || (a && typeof a === "object") || typeof a === "function";
}
function null_to_empty(value) {
  return value == null ? "" : value;
}

function append(target, node) {
  target.appendChild(node);
}
function insert(target, node, anchor) {
  target.insertBefore(node, anchor || null);
}
function detach(node) {
  node.parentNode.removeChild(node);
}
function destroy_each(iterations, detaching) {
  for (let i = 0; i < iterations.length; i += 1) {
    if (iterations[i]) iterations[i].d(detaching);
  }
}
function element(name) {
  return document.createElement(name);
}
function svg_element(name) {
  return document.createElementNS("http://www.w3.org/2000/svg", name);
}
function text(data) {
  return document.createTextNode(data);
}
function space() {
  return text(" ");
}
function empty() {
  return text("");
}
function listen(node, event, handler, options) {
  node.addEventListener(event, handler, options);
  return () => node.removeEventListener(event, handler, options);
}
function attr(node, attribute, value) {
  if (value == null) node.removeAttribute(attribute);
  else if (node.getAttribute(attribute) !== value)
    node.setAttribute(attribute, value);
}
function children(element) {
  return Array.from(element.childNodes);
}
function custom_event(type, detail) {
  const e = document.createEvent("CustomEvent");
  e.initCustomEvent(type, false, false, detail);
  return e;
}

let current_component;
function set_current_component(component) {
  current_component = component;
}
function get_current_component() {
  if (!current_component)
    throw new Error(`Function called outside component initialization`);
  return current_component;
}
function onMount(fn) {
  get_current_component().$$.on_mount.push(fn);
}

const dirty_components = [];
const binding_callbacks = [];
const render_callbacks = [];
const flush_callbacks = [];
const resolved_promise = Promise.resolve();
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
let flushing = false;
const seen_callbacks = new Set();
function flush() {
  if (flushing) return;
  flushing = true;
  do {
    // first, call beforeUpdate functions
    // and update components
    for (let i = 0; i < dirty_components.length; i += 1) {
      const component = dirty_components[i];
      set_current_component(component);
      update(component.$$);
    }
    dirty_components.length = 0;
    while (binding_callbacks.length) binding_callbacks.pop()();
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
  flushing = false;
  seen_callbacks.clear();
}
function update($$) {
  if ($$.fragment !== null) {
    $$.update();
    run_all($$.before_update);
    const dirty = $$.dirty;
    $$.dirty = [-1];
    $$.fragment && $$.fragment.p($$.ctx, dirty);
    $$.after_update.forEach(add_render_callback);
  }
}
const outroing = new Set();
let outros;
function group_outros() {
  outros = {
    r: 0,
    c: [],
    p: outros, // parent group
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
    if (outroing.has(block)) return;
    outroing.add(block);
    outros.c.push(() => {
      outroing.delete(block);
      if (callback) {
        if (detach) block.d(1);
        callback();
      }
    });
    block.o(local);
  }
}

const globals =
  typeof window !== "undefined"
    ? window
    : typeof globalThis !== "undefined"
    ? globalThis
    : global;
function create_component(block) {
  block && block.c();
}
function mount_component(component, target, anchor) {
  const { fragment, on_mount, on_destroy, after_update } = component.$$;
  fragment && fragment.m(target, anchor);
  // onMount happens before the initial afterUpdate
  add_render_callback(() => {
    const new_on_destroy = on_mount.map(run).filter(is_function);
    if (on_destroy) {
      on_destroy.push(...new_on_destroy);
    } else {
      // Edge case - component was destroyed immediately,
      // most likely as a result of a binding initialising
      run_all(new_on_destroy);
    }
    component.$$.on_mount = [];
  });
  after_update.forEach(add_render_callback);
}
function destroy_component(component, detaching) {
  const $$ = component.$$;
  if ($$.fragment !== null) {
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
  component.$$.dirty[(i / 31) | 0] |= 1 << i % 31;
}
function init(
  component,
  options,
  instance,
  create_fragment,
  not_equal,
  props,
  dirty = [-1]
) {
  const parent_component = current_component;
  set_current_component(component);
  const prop_values = options.props || {};
  const $$ = (component.$$ = {
    fragment: null,
    ctx: null,
    // state
    props,
    update: noop,
    not_equal,
    bound: blank_object(),
    // lifecycle
    on_mount: [],
    on_destroy: [],
    before_update: [],
    after_update: [],
    context: new Map(parent_component ? parent_component.$$.context : []),
    // everything else
    callbacks: blank_object(),
    dirty,
  });
  let ready = false;
  $$.ctx = instance
    ? instance(component, prop_values, (i, ret, ...rest) => {
        const value = rest.length ? rest[0] : ret;
        if ($$.ctx && not_equal($$.ctx[i], ($$.ctx[i] = value))) {
          if ($$.bound[i]) $$.bound[i](value);
          if (ready) make_dirty(component, i);
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
    } else {
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      $$.fragment && $$.fragment.c();
    }
    if (options.intro) transition_in(component.$$.fragment);
    mount_component(component, options.target, options.anchor);
    flush();
  }
  set_current_component(parent_component);
}
class SvelteComponent {
  $destroy() {
    destroy_component(this, 1);
    this.$destroy = noop;
  }
  $on(type, callback) {
    const callbacks = this.$$.callbacks[type] || (this.$$.callbacks[type] = []);
    callbacks.push(callback);
    return () => {
      const index = callbacks.indexOf(callback);
      if (index !== -1) callbacks.splice(index, 1);
    };
  }
  $set() {
    // overridden by instance, if it has props
  }
}

function dispatch_dev(type, detail) {
  document.dispatchEvent(
    custom_event(type, Object.assign({ version: "3.23.2" }, detail))
  );
}
function append_dev(target, node) {
  dispatch_dev("SvelteDOMInsert", { target, node });
  append(target, node);
}
function insert_dev(target, node, anchor) {
  dispatch_dev("SvelteDOMInsert", { target, node, anchor });
  insert(target, node, anchor);
}
function detach_dev(node) {
  dispatch_dev("SvelteDOMRemove", { node });
  detach(node);
}
function listen_dev(
  node,
  event,
  handler,
  options,
  has_prevent_default,
  has_stop_propagation
) {
  const modifiers =
    options === true
      ? ["capture"]
      : options
      ? Array.from(Object.keys(options))
      : [];
  if (has_prevent_default) modifiers.push("preventDefault");
  if (has_stop_propagation) modifiers.push("stopPropagation");
  dispatch_dev("SvelteDOMAddEventListener", {
    node,
    event,
    handler,
    modifiers,
  });
  const dispose = listen(node, event, handler, options);
  return () => {
    dispatch_dev("SvelteDOMRemoveEventListener", {
      node,
      event,
      handler,
      modifiers,
    });
    dispose();
  };
}
function attr_dev(node, attribute, value) {
  attr(node, attribute, value);
  if (value == null)
    dispatch_dev("SvelteDOMRemoveAttribute", { node, attribute });
  else dispatch_dev("SvelteDOMSetAttribute", { node, attribute, value });
}
function set_data_dev(text, data) {
  data = "" + data;
  if (text.data === data) return;
  dispatch_dev("SvelteDOMSetData", { node: text, data });
  text.data = data;
}
function validate_each_argument(arg) {
  if (
    typeof arg !== "string" &&
    !(arg && typeof arg === "object" && "length" in arg)
  ) {
    let msg = "{#each} only iterates over array-like objects.";
    if (typeof Symbol === "function" && arg && Symbol.iterator in arg) {
      msg += " You can use a spread to convert this iterable into an array.";
    }
    throw new Error(msg);
  }
}
function validate_slots(name, slot, keys) {
  for (const slot_key of Object.keys(slot)) {
    if (!~keys.indexOf(slot_key)) {
      console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
    }
  }
}
class SvelteComponentDev extends SvelteComponent {
  constructor(options) {
    if (!options || (!options.target && !options.$$inline)) {
      throw new Error(`'target' is a required option`);
    }
    super();
  }
  $destroy() {
    super.$destroy();
    this.$destroy = () => {
      console.warn(`Component was already destroyed`); // eslint-disable-line no-console
    };
  }
  $capture_state() {}
  $inject_state() {}
}

const TRADING_GW_URL = "https://api-gw-trading";

const assetGroupsUrl = "/v1/trading/asset-groups";

const symbolsUrl = "/v1/trading/symbols";

const subscriber_queue = [];
/**
 * Create a `Writable` store that allows both updating and reading by subscription.
 * @param {*=}value initial value
 * @param {StartStopNotifier=}start start and stop notifications for subscriptions
 */
function writable(value, start = noop) {
  let stop;
  const subscribers = [];
  function set(new_value) {
    if (safe_not_equal(value, new_value)) {
      value = new_value;
      if (stop) {
        // store is ready
        const run_queue = !subscriber_queue.length;
        for (let i = 0; i < subscribers.length; i += 1) {
          const s = subscribers[i];
          s[1]();
          subscriber_queue.push(s, value);
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
    subscribers.push(subscriber);
    if (subscribers.length === 1) {
      stop = start(set) || noop;
    }
    run(value);
    return () => {
      const index = subscribers.indexOf(subscriber);
      if (index !== -1) {
        subscribers.splice(index, 1);
      }
      if (subscribers.length === 0) {
        stop();
        stop = null;
      }
    };
  }
  return { set, update, subscribe };
}

const filterSymbolsByAssetGroup = ({
  options,
  allSymbols,
  activeAssetGroup,
}) => {
  const groupSetting = options[activeAssetGroup.type];
  const groupSymbols = allSymbols.filter((symbolFromServer) =>
    activeAssetGroup.symbols.includes(symbolFromServer.name)
  );

  if (groupSetting.symbolsAmount) {
    return groupSymbols.slice(0, groupSetting.symbolsAmount);
  } else if (groupSetting.symbolsList) {
    return groupSymbols.filter((symbol) =>
      groupSetting.symbolsList.includes(symbol.name)
    );
  } else {
    return groupSymbols;
  }
};

const mapAssetGroupsDataFromServer = ({ options, data }) => {
  if (Object.keys(options).length && data.length) {
    return data.filter((assetGroup) =>
      Object.keys(options).includes(assetGroup.type)
    );
  }
  return data;
};

const storeState = {
  options: {},
  activeAssetGroup: {},
  activeSymbol: {},
  assetGroups: {
    visibleGroups: [],
    allGroups: [],
    loading: false,
    error: "",
  },
  symbols: {
    visibleSymbols: [],
    allSymbols: [],
    loading: false,
    error: "",
  },
};
const mainStore = writable(storeState);

const { update: update$1 } = mainStore;

const setAssetGroups = ({ data }) => {
  update$1((store) => {
    const newData = mapAssetGroupsDataFromServer({
      data,
      options: store.options,
    });
    return {
      ...store,
      activeAssetGroup: newData[0],
      assetGroups: {
        ...store.assetGroups,
        visibleGroups: newData,
        allGroups: data,
      },
    };
  });
};

const updateAssetGroups = (assetGroups) => {
  update$1((store) => ({
    ...store,
    assetGroups: { ...store.assetGroups, ...assetGroups },
  }));
};

const updateSymbols = (symbols) => {
  update$1((store) => ({
    ...store,
    symbols: { ...store.symbols, ...symbols },
  }));
};

const setSymbols = (activeAssetGroup) => {
  update$1((store) => {
    const newData = filterSymbolsByAssetGroup({
      allSymbols: store.symbols.allSymbols,
      options: store.options,
      activeAssetGroup,
    });
    return {
      ...store,
      // activeSymbol: newData[0],
      symbols: { ...store.symbols, visibleSymbols: newData },
    };
  });
};

const updateOptions = (options) => {
  update$1((store) => ({ ...store, options }));
};

const setActiveAssetGroup = (activeAssetGroup) => {
  update$1((store) => ({ ...store, activeAssetGroup, activeSymbol: {} }));
};

const setActiveSymbol = (activeSymbol) => {
  update$1((store) => ({ ...store, activeSymbol }));
};

const getUrlService = ({ url, brand, env }) => {
  return `${TRADING_GW_URL}-${brand}${
    env === "dev" ? "-dev" : ""
  }.crmarts.com${url}`;
};

const getSymbols = async ({ brand, env }) => {
  updateSymbols({ loading: true });
  try {
    const response = await fetch(
      getUrlService({ url: symbolsUrl, brand, env })
    );
    const { data } = await response.json();
    updateSymbols({ allSymbols: data });
  } catch (error) {
    updateSymbols({ error: true });
  }
  updateSymbols({ loading: false });
};

const numberWithDigits = (number, digits) => number.toFixed(digits);

const getTrendSymbol = (trend) => trend[0] - trend[trend.length - 1] > 0;
const getPercentage = (trend) => {
  const a = trend[0];
  const b = trend[trend.length - 1];
  if (a > b) {
    return (((a - b) / b) * 100).toFixed(2) + "%";
  } else {
    return "-" + (((b - a) / b) * 100).toFixed(2) + "%";
  }
};

/* src/components/symbolsTableWidget/Trend.svelte generated by Svelte v3.23.2 */

const { console: console_1 } = globals;
const file = "src/components/symbolsTableWidget/Trend.svelte";

function get_each_context(ctx, list, i) {
  const child_ctx = ctx.slice();
  child_ctx[6] = list[i];
  child_ctx[8] = i;
  return child_ctx;
}

// (46:2) {:else}
function create_else_block(ctx) {
  let text_1;
  let t;

  const block = {
    c: function create() {
      text_1 = svg_element("text");
      t = text("No data provided");
      attr_dev(text_1, "x", "20");
      attr_dev(text_1, "y", "20");
      attr_dev(text_1, "class", "svelte-1ipbbux");
      add_location(text_1, file, 46, 4, 1079);
    },
    m: function mount(target, anchor) {
      insert_dev(target, text_1, anchor);
      append_dev(text_1, t);
    },
    d: function destroy(detaching) {
      if (detaching) detach_dev(text_1);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_else_block.name,
    type: "else",
    source: "(46:2) {:else}",
    ctx,
  });

  return block;
}

// (40:2) {#each rectHeight as value, i}
function create_each_block(ctx) {
  let rect;
  let rect_y_value;
  let rect_x_value;
  let rect_height_value;

  const block = {
    c: function create() {
      rect = svg_element("rect");
      attr_dev(rect, "y", (rect_y_value = svgHeight - /*value*/ ctx[6]));
      attr_dev(rect, "width", /*xwidth*/ ctx[2]);
      attr_dev(rect, "x", (rect_x_value = /*i*/ ctx[8] * /*xwidth*/ ctx[2]));
      attr_dev(rect, "height", (rect_height_value = /*value*/ ctx[6]));
      add_location(rect, file, 40, 4, 952);
    },
    m: function mount(target, anchor) {
      insert_dev(target, rect, anchor);
    },
    p: function update(ctx, dirty) {
      if (
        dirty & /*rectHeight*/ 2 &&
        rect_y_value !== (rect_y_value = svgHeight - /*value*/ ctx[6])
      ) {
        attr_dev(rect, "y", rect_y_value);
      }

      if (dirty & /*xwidth*/ 4) {
        attr_dev(rect, "width", /*xwidth*/ ctx[2]);
      }

      if (
        dirty & /*xwidth*/ 4 &&
        rect_x_value !== (rect_x_value = /*i*/ ctx[8] * /*xwidth*/ ctx[2])
      ) {
        attr_dev(rect, "x", rect_x_value);
      }

      if (
        dirty & /*rectHeight*/ 2 &&
        rect_height_value !== (rect_height_value = /*value*/ ctx[6])
      ) {
        attr_dev(rect, "height", rect_height_value);
      }
    },
    d: function destroy(detaching) {
      if (detaching) detach_dev(rect);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_each_block.name,
    type: "each",
    source: "(40:2) {#each rectHeight as value, i}",
    ctx,
  });

  return block;
}

function create_fragment(ctx) {
  let svg;
  let svg_fill_value;
  let each_value = /*rectHeight*/ ctx[1];
  validate_each_argument(each_value);
  let each_blocks = [];

  for (let i = 0; i < each_value.length; i += 1) {
    each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
  }

  let each_1_else = null;

  if (!each_value.length) {
    each_1_else = create_else_block(ctx);
  }

  const block = {
    c: function create() {
      svg = svg_element("svg");

      for (let i = 0; i < each_blocks.length; i += 1) {
        each_blocks[i].c();
      }

      if (each_1_else) {
        each_1_else.c();
      }

      attr_dev(svg, "height", svgHeight);
      attr_dev(svg, "width", svgWidth);
      attr_dev(
        svg,
        "fill",
        (svg_fill_value = `${
          getTrendSymbol(/*data*/ ctx[0]) ? "#49b47a" : "#fd3b5e"
        }`)
      );
      add_location(svg, file, 34, 0, 803);
    },
    l: function claim(nodes) {
      throw new Error(
        "options.hydrate only works if the component was compiled with the `hydratable: true` option"
      );
    },
    m: function mount(target, anchor) {
      insert_dev(target, svg, anchor);

      for (let i = 0; i < each_blocks.length; i += 1) {
        each_blocks[i].m(svg, null);
      }

      if (each_1_else) {
        each_1_else.m(svg, null);
      }
    },
    p: function update(ctx, [dirty]) {
      if (dirty & /*svgHeight, rectHeight, xwidth*/ 6) {
        each_value = /*rectHeight*/ ctx[1];
        validate_each_argument(each_value);
        let i;

        for (i = 0; i < each_value.length; i += 1) {
          const child_ctx = get_each_context(ctx, each_value, i);

          if (each_blocks[i]) {
            each_blocks[i].p(child_ctx, dirty);
          } else {
            each_blocks[i] = create_each_block(child_ctx);
            each_blocks[i].c();
            each_blocks[i].m(svg, null);
          }
        }

        for (; i < each_blocks.length; i += 1) {
          each_blocks[i].d(1);
        }

        each_blocks.length = each_value.length;

        if (each_value.length) {
          if (each_1_else) {
            each_1_else.d(1);
            each_1_else = null;
          }
        } else if (!each_1_else) {
          each_1_else = create_else_block(ctx);
          each_1_else.c();
          each_1_else.m(svg, null);
        }
      }

      if (
        dirty & /*data*/ 1 &&
        svg_fill_value !==
          (svg_fill_value = `${
            getTrendSymbol(/*data*/ ctx[0]) ? "#49b47a" : "#fd3b5e"
          }`)
      ) {
        attr_dev(svg, "fill", svg_fill_value);
      }
    },
    i: noop,
    o: noop,
    d: function destroy(detaching) {
      if (detaching) detach_dev(svg);
      destroy_each(each_blocks, detaching);
      if (each_1_else) each_1_else.d();
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_fragment.name,
    type: "component",
    source: "",
    ctx,
  });

  return block;
}

const svgHeight = 40;
const svgWidth = 72;

function instance($$self, $$props, $$invalidate) {
  let { data = [] } = $$props;
  let rectHeight = [];
  const writable_props = ["data"];

  Object.keys($$props).forEach((key) => {
    if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$")
      console_1.warn(`<Trend> was created with unknown prop '${key}'`);
  });

  let { $$slots = {}, $$scope } = $$props;
  validate_slots("Trend", $$slots, []);

  $$self.$set = ($$props) => {
    if ("data" in $$props) $$invalidate(0, (data = $$props.data));
  };

  $$self.$capture_state = () => ({
    getTrendSymbol,
    data,
    svgHeight,
    svgWidth,
    rectHeight,
    min,
    max,
    yheight,
    xwidth,
  });

  $$self.$inject_state = ($$props) => {
    if ("data" in $$props) $$invalidate(0, (data = $$props.data));
    if ("rectHeight" in $$props)
      $$invalidate(1, (rectHeight = $$props.rectHeight));
    if ("min" in $$props) $$invalidate(3, (min = $$props.min));
    if ("max" in $$props) $$invalidate(4, (max = $$props.max));
    if ("yheight" in $$props) $$invalidate(5, (yheight = $$props.yheight));
    if ("xwidth" in $$props) $$invalidate(2, (xwidth = $$props.xwidth));
  };

  let min;
  let max;
  let yheight;
  let xwidth;

  if ($$props && "$$inject" in $$props) {
    $$self.$inject_state($$props.$$inject);
  }

  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*data*/ 1) {
      $$invalidate(3, (min = Math.min(...data)));
    }

    if ($$self.$$.dirty & /*data*/ 1) {
      $$invalidate(4, (max = Math.max(...data)));
    }

    if ($$self.$$.dirty & /*max, min*/ 24) {
      $$invalidate(5, (yheight = max - min));
    }

    if ($$self.$$.dirty & /*data*/ 1) {
      $$invalidate(
        2,
        (xwidth = data.length ? svgWidth / data.length : svgWidth)
      );
    }

    if ($$self.$$.dirty & /*data, max, yheight*/ 49) {
      if (data) {
        $$invalidate(
          1,
          (rectHeight = data.map((height) => {
            const res = Math.ceil((svgHeight * (max - height)) / yheight);
            return res > 0 ? res : 1;
          }))
        );
      }
    }

    if ($$self.$$.dirty & /*rectHeight*/ 2) {
      console.log(">>> rectHeight", rectHeight);
    }

    if ($$self.$$.dirty & /*data*/ 1) {
      console.log(">>> data", data);
    }

    if ($$self.$$.dirty & /*min*/ 8) {
      console.log(">>> min", min);
    }

    if ($$self.$$.dirty & /*max*/ 16) {
      console.log(">>> max", max);
    }
  };

  return [data, rectHeight, xwidth];
}

class Trend extends SvelteComponentDev {
  constructor(options) {
    super(options);
    init(this, options, instance, create_fragment, safe_not_equal, { data: 0 });

    dispatch_dev("SvelteRegisterComponent", {
      component: this,
      tagName: "Trend",
      options,
      id: create_fragment.name,
    });
  }

  get data() {
    throw new Error(
      "<Trend>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
    );
  }

  set data(value) {
    throw new Error(
      "<Trend>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
    );
  }
}

/* src/components/symbolsTableWidget/SymbolsTableWidget.svelte generated by Svelte v3.23.2 */

const { console: console_1$1 } = globals;
const file$1 = "src/components/symbolsTableWidget/SymbolsTableWidget.svelte";

function get_each_context$1(ctx, list, i) {
  const child_ctx = ctx.slice();
  child_ctx[11] = list[i];
  return child_ctx;
}

// (116:2) {:else}
function create_else_block$1(ctx) {
  let each_1_anchor;
  let current;
  let each_value = /*symbolsData*/ ctx[0];
  validate_each_argument(each_value);
  let each_blocks = [];

  for (let i = 0; i < each_value.length; i += 1) {
    each_blocks[i] = create_each_block$1(
      get_each_context$1(ctx, each_value, i)
    );
  }

  const out = (i) =>
    transition_out(each_blocks[i], 1, 1, () => {
      each_blocks[i] = null;
    });

  const block = {
    c: function create() {
      for (let i = 0; i < each_blocks.length; i += 1) {
        each_blocks[i].c();
      }

      each_1_anchor = empty();
    },
    m: function mount(target, anchor) {
      for (let i = 0; i < each_blocks.length; i += 1) {
        each_blocks[i].m(target, anchor);
      }

      insert_dev(target, each_1_anchor, anchor);
      current = true;
    },
    p: function update(ctx, dirty) {
      if (
        dirty &
        /*symbolsData, activeSymbol, handleTableRowClick, numberWithDigits, getTrendSymbol, getPercentage*/ 25
      ) {
        each_value = /*symbolsData*/ ctx[0];
        validate_each_argument(each_value);
        let i;

        for (i = 0; i < each_value.length; i += 1) {
          const child_ctx = get_each_context$1(ctx, each_value, i);

          if (each_blocks[i]) {
            each_blocks[i].p(child_ctx, dirty);
            transition_in(each_blocks[i], 1);
          } else {
            each_blocks[i] = create_each_block$1(child_ctx);
            each_blocks[i].c();
            transition_in(each_blocks[i], 1);
            each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
          }
        }

        group_outros();

        for (i = each_value.length; i < each_blocks.length; i += 1) {
          out(i);
        }

        check_outros();
      }
    },
    i: function intro(local) {
      if (current) return;

      for (let i = 0; i < each_value.length; i += 1) {
        transition_in(each_blocks[i]);
      }

      current = true;
    },
    o: function outro(local) {
      each_blocks = each_blocks.filter(Boolean);

      for (let i = 0; i < each_blocks.length; i += 1) {
        transition_out(each_blocks[i]);
      }

      current = false;
    },
    d: function destroy(detaching) {
      destroy_each(each_blocks, detaching);
      if (detaching) detach_dev(each_1_anchor);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_else_block$1.name,
    type: "else",
    source: "(116:2) {:else}",
    ctx,
  });

  return block;
}

// (114:25)
function create_if_block_1(ctx) {
  let t0;
  let t1;

  const block = {
    c: function create() {
      t0 = text("Error: ");
      t1 = text(/*symbolsError*/ ctx[2]);
    },
    m: function mount(target, anchor) {
      insert_dev(target, t0, anchor);
      insert_dev(target, t1, anchor);
    },
    p: function update(ctx, dirty) {
      if (dirty & /*symbolsError*/ 4) set_data_dev(t1, /*symbolsError*/ ctx[2]);
    },
    i: noop,
    o: noop,
    d: function destroy(detaching) {
      if (detaching) detach_dev(t0);
      if (detaching) detach_dev(t1);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_if_block_1.name,
    type: "if",
    source: "(114:25) ",
    ctx,
  });

  return block;
}

// (112:2) {#if symbolsLoading}
function create_if_block(ctx) {
  let t;

  const block = {
    c: function create() {
      t = text("Symbols are loading...");
    },
    m: function mount(target, anchor) {
      insert_dev(target, t, anchor);
    },
    p: noop,
    i: noop,
    o: noop,
    d: function destroy(detaching) {
      if (detaching) detach_dev(t);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_if_block.name,
    type: "if",
    source: "(112:2) {#if symbolsLoading}",
    ctx,
  });

  return block;
}

// (131:10) {:else}
function create_else_block_1(ctx) {
  let span;
  let img;
  let img_src_value;

  const block = {
    c: function create() {
      span = element("span");
      img = element("img");
      if (img.src !== (img_src_value = "../../assets/svg/down.svg"))
        attr_dev(img, "src", img_src_value);
      attr_dev(img, "alt", "down trend");
      add_location(img, file$1, 132, 15, 2891);
      attr_dev(span, "class", "trend-symbol svelte-1chrn99");
      add_location(span, file$1, 131, 12, 2849);
    },
    m: function mount(target, anchor) {
      insert_dev(target, span, anchor);
      append_dev(span, img);
    },
    d: function destroy(detaching) {
      if (detaching) detach_dev(span);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_else_block_1.name,
    type: "else",
    source: "(131:10) {:else}",
    ctx,
  });

  return block;
}

// (127:10) {#if getTrendSymbol(symbol.trend)}
function create_if_block_2(ctx) {
  let span;
  let img;
  let img_src_value;

  const block = {
    c: function create() {
      span = element("span");
      img = element("img");
      if (img.src !== (img_src_value = "../../assets/svg/up.svg"))
        attr_dev(img, "src", img_src_value);
      attr_dev(img, "alt", "up trend");
      add_location(img, file$1, 128, 15, 2746);
      attr_dev(span, "class", "trend-symbol svelte-1chrn99");
      add_location(span, file$1, 127, 12, 2704);
    },
    m: function mount(target, anchor) {
      insert_dev(target, span, anchor);
      append_dev(span, img);
    },
    d: function destroy(detaching) {
      if (detaching) detach_dev(span);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_if_block_2.name,
    type: "if",
    source: "(127:10) {#if getTrendSymbol(symbol.trend)}",
    ctx,
  });

  return block;
}

// (117:4) {#each symbolsData as symbol}
function create_each_block$1(ctx) {
  let div5;
  let div0;
  let show_if;
  let t0;
  let t1_value = /*symbol*/ ctx[11].name.toUpperCase() + "";
  let t1;
  let t2;
  let div1;
  let trend;
  let t3;
  let div2;
  let span;
  let t4_value = getPercentage(/*symbol*/ ctx[11].trend) + "";
  let t4;
  let span_class_value;
  let t5;
  let div3;
  let t6_value =
    numberWithDigits(/*symbol*/ ctx[11].ask, /*symbol*/ ctx[11].digits) + "";
  let t6;
  let t7;
  let div4;
  let t8_value =
    numberWithDigits(/*symbol*/ ctx[11].bid, /*symbol*/ ctx[11].digits) + "";
  let t8;
  let t9;
  let div5_class_value;
  let current;
  let mounted;
  let dispose;

  function select_block_type_1(ctx, dirty) {
    if (show_if == null || dirty & /*symbolsData*/ 1)
      show_if = !!getTrendSymbol(/*symbol*/ ctx[11].trend);
    if (show_if) return create_if_block_2;
    return create_else_block_1;
  }

  let current_block_type = select_block_type_1(ctx, -1);
  let if_block = current_block_type(ctx);

  trend = new Trend({
    props: { data: /*symbol*/ ctx[11].trend },
    $$inline: true,
  });

  function click_handler(...args) {
    return /*click_handler*/ ctx[6](/*symbol*/ ctx[11], ...args);
  }

  const block = {
    c: function create() {
      div5 = element("div");
      div0 = element("div");
      if_block.c();
      t0 = space();
      t1 = text(t1_value);
      t2 = space();
      div1 = element("div");
      create_component(trend.$$.fragment);
      t3 = space();
      div2 = element("div");
      span = element("span");
      t4 = text(t4_value);
      t5 = space();
      div3 = element("div");
      t6 = text(t6_value);
      t7 = space();
      div4 = element("div");
      t8 = text(t8_value);
      t9 = space();
      attr_dev(
        div0,
        "class",
        "table-widget__column column__name svelte-1chrn99"
      );
      add_location(div0, file$1, 125, 8, 2599);
      attr_dev(
        div1,
        "class",
        "table-widget__column column__trend svelte-1chrn99"
      );
      add_location(div1, file$1, 137, 8, 3045);

      attr_dev(
        span,
        "class",
        (span_class_value =
          "" +
          (null_to_empty(
            `${
              getTrendSymbol(/*symbol*/ ctx[11].trend)
                ? "up-trend"
                : "down-trend"
            }`
          ) +
            " svelte-1chrn99"))
      );

      add_location(span, file$1, 141, 10, 3220);
      attr_dev(
        div2,
        "class",
        "table-widget__column column__percent svelte-1chrn99"
      );
      add_location(div2, file$1, 140, 8, 3159);
      attr_dev(
        div3,
        "class",
        "table-widget__column column__ask svelte-1chrn99"
      );
      add_location(div3, file$1, 147, 8, 3409);
      attr_dev(
        div4,
        "class",
        "table-widget__column column__bid svelte-1chrn99"
      );
      add_location(div4, file$1, 150, 8, 3535);

      attr_dev(
        div5,
        "class",
        (div5_class_value =
          "" +
          (null_to_empty(
            `symbols-table-widget__row ${
              /*symbol*/ ctx[11].name === /*activeSymbol*/ ctx[3].name
                ? "active"
                : ""
            }`
          ) +
            " svelte-1chrn99"))
      );

      add_location(div5, file$1, 117, 6, 2381);
    },
    m: function mount(target, anchor) {
      insert_dev(target, div5, anchor);
      append_dev(div5, div0);
      if_block.m(div0, null);
      append_dev(div0, t0);
      append_dev(div0, t1);
      append_dev(div5, t2);
      append_dev(div5, div1);
      mount_component(trend, div1, null);
      append_dev(div5, t3);
      append_dev(div5, div2);
      append_dev(div2, span);
      append_dev(span, t4);
      append_dev(div5, t5);
      append_dev(div5, div3);
      append_dev(div3, t6);
      append_dev(div5, t7);
      append_dev(div5, div4);
      append_dev(div4, t8);
      append_dev(div5, t9);
      current = true;

      if (!mounted) {
        dispose = listen_dev(div5, "click", click_handler, false, false, false);
        mounted = true;
      }
    },
    p: function update(new_ctx, dirty) {
      ctx = new_ctx;

      if (
        current_block_type !==
        (current_block_type = select_block_type_1(ctx, dirty))
      ) {
        if_block.d(1);
        if_block = current_block_type(ctx);

        if (if_block) {
          if_block.c();
          if_block.m(div0, t0);
        }
      }

      if (
        (!current || dirty & /*symbolsData*/ 1) &&
        t1_value !== (t1_value = /*symbol*/ ctx[11].name.toUpperCase() + "")
      )
        set_data_dev(t1, t1_value);
      const trend_changes = {};
      if (dirty & /*symbolsData*/ 1)
        trend_changes.data = /*symbol*/ ctx[11].trend;
      trend.$set(trend_changes);
      if (
        (!current || dirty & /*symbolsData*/ 1) &&
        t4_value !== (t4_value = getPercentage(/*symbol*/ ctx[11].trend) + "")
      )
        set_data_dev(t4, t4_value);

      if (
        !current ||
        (dirty & /*symbolsData*/ 1 &&
          span_class_value !==
            (span_class_value =
              "" +
              (null_to_empty(
                `${
                  getTrendSymbol(/*symbol*/ ctx[11].trend)
                    ? "up-trend"
                    : "down-trend"
                }`
              ) +
                " svelte-1chrn99")))
      ) {
        attr_dev(span, "class", span_class_value);
      }

      if (
        (!current || dirty & /*symbolsData*/ 1) &&
        t6_value !==
          (t6_value =
            numberWithDigits(
              /*symbol*/ ctx[11].ask,
              /*symbol*/ ctx[11].digits
            ) + "")
      )
        set_data_dev(t6, t6_value);
      if (
        (!current || dirty & /*symbolsData*/ 1) &&
        t8_value !==
          (t8_value =
            numberWithDigits(
              /*symbol*/ ctx[11].bid,
              /*symbol*/ ctx[11].digits
            ) + "")
      )
        set_data_dev(t8, t8_value);

      if (
        !current ||
        (dirty & /*symbolsData, activeSymbol*/ 9 &&
          div5_class_value !==
            (div5_class_value =
              "" +
              (null_to_empty(
                `symbols-table-widget__row ${
                  /*symbol*/ ctx[11].name === /*activeSymbol*/ ctx[3].name
                    ? "active"
                    : ""
                }`
              ) +
                " svelte-1chrn99")))
      ) {
        attr_dev(div5, "class", div5_class_value);
      }
    },
    i: function intro(local) {
      if (current) return;
      transition_in(trend.$$.fragment, local);
      current = true;
    },
    o: function outro(local) {
      transition_out(trend.$$.fragment, local);
      current = false;
    },
    d: function destroy(detaching) {
      if (detaching) detach_dev(div5);
      if_block.d();
      destroy_component(trend);
      mounted = false;
      dispose();
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_each_block$1.name,
    type: "each",
    source: "(117:4) {#each symbolsData as symbol}",
    ctx,
  });

  return block;
}

function create_fragment$1(ctx) {
  let div;
  let current_block_type_index;
  let if_block;
  let current;
  const if_block_creators = [
    create_if_block,
    create_if_block_1,
    create_else_block$1,
  ];
  const if_blocks = [];

  function select_block_type(ctx, dirty) {
    if (/*symbolsLoading*/ ctx[1]) return 0;
    if (/*symbolsError*/ ctx[2]) return 1;
    return 2;
  }

  current_block_type_index = select_block_type(ctx);
  if_block = if_blocks[current_block_type_index] =
    if_block_creators[current_block_type_index](ctx);

  const block = {
    c: function create() {
      div = element("div");
      if_block.c();
      attr_dev(div, "class", "symbols-table-widget_wrapper svelte-1chrn99");
      add_location(div, file$1, 110, 0, 2186);
    },
    l: function claim(nodes) {
      throw new Error(
        "options.hydrate only works if the component was compiled with the `hydratable: true` option"
      );
    },
    m: function mount(target, anchor) {
      insert_dev(target, div, anchor);
      if_blocks[current_block_type_index].m(div, null);
      current = true;
    },
    p: function update(ctx, [dirty]) {
      let previous_block_index = current_block_type_index;
      current_block_type_index = select_block_type(ctx);

      if (current_block_type_index === previous_block_index) {
        if_blocks[current_block_type_index].p(ctx, dirty);
      } else {
        group_outros();

        transition_out(if_blocks[previous_block_index], 1, 1, () => {
          if_blocks[previous_block_index] = null;
        });

        check_outros();
        if_block = if_blocks[current_block_type_index];

        if (!if_block) {
          if_block = if_blocks[current_block_type_index] =
            if_block_creators[current_block_type_index](ctx);
          if_block.c();
        }

        transition_in(if_block, 1);
        if_block.m(div, null);
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
      if (detaching) detach_dev(div);
      if_blocks[current_block_type_index].d();
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_fragment$1.name,
    type: "component",
    source: "",
    ctx,
  });

  return block;
}

function instance$1($$self, $$props, $$invalidate) {
  let { options } = $$props;
  const { brand, env } = options;
  let { symbolsData, symbolsLoading, symbolsError, activeSymbol, assetGroup } =
    {};
  let activeGroupSymbolsList = [];

  onMount(() => {
    getSymbols({ brand, env });
  });

  mainStore.subscribe(
    ({ activeSymbol: activeSymbolFromStore, symbols, activeAssetGroup }) => {
      $$invalidate(0, (symbolsData = symbols.visibleSymbols));
      $$invalidate(2, (symbolsError = symbols.error));
      $$invalidate(7, (assetGroup = activeAssetGroup));
      $$invalidate(1, (symbolsLoading = symbols.loading));
      $$invalidate(3, (activeSymbol = activeSymbolFromStore));
    }
  );

  const handleTableRowClick = (symbol) => {
    console.log(">>> symbol", symbol);
    setActiveSymbol(symbol);
  };

  const writable_props = ["options"];

  Object.keys($$props).forEach((key) => {
    if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$")
      console_1$1.warn(
        `<SymbolsTableWidget> was created with unknown prop '${key}'`
      );
  });

  let { $$slots = {}, $$scope } = $$props;
  validate_slots("SymbolsTableWidget", $$slots, []);

  const click_handler = (symbol) => {
    handleTableRowClick(symbol);
  };

  $$self.$set = ($$props) => {
    if ("options" in $$props) $$invalidate(5, (options = $$props.options));
  };

  $$self.$capture_state = () => ({
    onMount,
    getSymbols,
    mainStore,
    setSymbols,
    setActiveSymbol,
    getPercentage,
    getTrendSymbol,
    numberWithDigits,
    Trend,
    options,
    brand,
    env,
    symbolsData,
    symbolsLoading,
    symbolsError,
    activeSymbol,
    assetGroup,
    activeGroupSymbolsList,
    handleTableRowClick,
  });

  $$self.$inject_state = ($$props) => {
    if ("options" in $$props) $$invalidate(5, (options = $$props.options));
    if ("symbolsData" in $$props)
      $$invalidate(0, (symbolsData = $$props.symbolsData));
    if ("symbolsLoading" in $$props)
      $$invalidate(1, (symbolsLoading = $$props.symbolsLoading));
    if ("symbolsError" in $$props)
      $$invalidate(2, (symbolsError = $$props.symbolsError));
    if ("activeSymbol" in $$props)
      $$invalidate(3, (activeSymbol = $$props.activeSymbol));
    if ("assetGroup" in $$props)
      $$invalidate(7, (assetGroup = $$props.assetGroup));
    if ("activeGroupSymbolsList" in $$props)
      activeGroupSymbolsList = $$props.activeGroupSymbolsList;
  };

  if ($$props && "$$inject" in $$props) {
    $$self.$inject_state($$props.$$inject);
  }

  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*assetGroup, activeSymbol, symbolsData*/ 137) {
      if (assetGroup && assetGroup.type) {
        setSymbols(assetGroup);

        if (!activeSymbol.name && symbolsData.length) {
          setActiveSymbol(symbolsData[0]);
        }
      }
    }

    if ($$self.$$.dirty & /*activeSymbol, symbolsData*/ 9) {
      {
        console.log(">>>----------------------- activeSymbol1", activeSymbol);
        console.log(">>>----------------------- symbolsData", symbolsData);
      }
    }
  };

  return [
    symbolsData,
    symbolsLoading,
    symbolsError,
    activeSymbol,
    handleTableRowClick,
    options,
    click_handler,
  ];
}

class SymbolsTableWidget extends SvelteComponentDev {
  constructor(options) {
    super(options);
    init(this, options, instance$1, create_fragment$1, safe_not_equal, {
      options: 5,
    });

    dispatch_dev("SvelteRegisterComponent", {
      component: this,
      tagName: "SymbolsTableWidget",
      options,
      id: create_fragment$1.name,
    });

    const { ctx } = this.$$;
    const props = options.props || {};

    if (/*options*/ ctx[5] === undefined && !("options" in props)) {
      console_1$1.warn(
        "<SymbolsTableWidget> was created without expected prop 'options'"
      );
    }
  }

  get options() {
    throw new Error(
      "<SymbolsTableWidget>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
    );
  }

  set options(value) {
    throw new Error(
      "<SymbolsTableWidget>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
    );
  }
}

const widgetNames = {
  ASSET_GROUPS_WIDGET: "assetGroups",
  SYMBOLS_TABLE_WIDGET: "symbolsTable",
  CHART_WIDGET: "chart",
  QUOTES_SYMBOLS_WIDGET: "quotesSymbols",
  SYMBOLS_CAROUSEL_WIDGET: "symbolsCarousel",
};

const getAssetGroups = async ({ brand, env }) => {
  updateAssetGroups({ loading: true });
  try {
    const response = await fetch(
      getUrlService({ url: assetGroupsUrl, brand, env })
    );
    const { data } = await response.json();
    setAssetGroups({ data });
  } catch (error) {
    updateAssetGroups({ error: true });
  }
  updateAssetGroups({ loading: false });
};

/* src/components/assetGroupsWidget/AssetsGroupWidget.svelte generated by Svelte v3.23.2 */

const { console: console_1$2 } = globals;
const file$2 = "src/components/assetGroupsWidget/AssetsGroupWidget.svelte";

function get_each_context$2(ctx, list, i) {
  const child_ctx = ctx.slice();
  child_ctx[8] = list[i];
  return child_ctx;
}

// (62:2) {:else}
function create_else_block$2(ctx) {
  let each_1_anchor;
  let each_value = /*assetGroupsList*/ ctx[1];
  validate_each_argument(each_value);
  let each_blocks = [];

  for (let i = 0; i < each_value.length; i += 1) {
    each_blocks[i] = create_each_block$2(
      get_each_context$2(ctx, each_value, i)
    );
  }

  const block = {
    c: function create() {
      for (let i = 0; i < each_blocks.length; i += 1) {
        each_blocks[i].c();
      }

      each_1_anchor = empty();
    },
    m: function mount(target, anchor) {
      for (let i = 0; i < each_blocks.length; i += 1) {
        each_blocks[i].m(target, anchor);
      }

      insert_dev(target, each_1_anchor, anchor);
    },
    p: function update(ctx, dirty) {
      if (dirty & /*activeGroup, assetGroupsList, setActiveAssetGroup*/ 3) {
        each_value = /*assetGroupsList*/ ctx[1];
        validate_each_argument(each_value);
        let i;

        for (i = 0; i < each_value.length; i += 1) {
          const child_ctx = get_each_context$2(ctx, each_value, i);

          if (each_blocks[i]) {
            each_blocks[i].p(child_ctx, dirty);
          } else {
            each_blocks[i] = create_each_block$2(child_ctx);
            each_blocks[i].c();
            each_blocks[i].m(each_1_anchor.parentNode, each_1_anchor);
          }
        }

        for (; i < each_blocks.length; i += 1) {
          each_blocks[i].d(1);
        }

        each_blocks.length = each_value.length;
      }
    },
    d: function destroy(detaching) {
      destroy_each(each_blocks, detaching);
      if (detaching) detach_dev(each_1_anchor);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_else_block$2.name,
    type: "else",
    source: "(62:2) {:else}",
    ctx,
  });

  return block;
}

// (60:33)
function create_if_block_1$1(ctx) {
  let t0;
  let t1;

  const block = {
    c: function create() {
      t0 = text("Error: ");
      t1 = text(/*assetGroupsDataError*/ ctx[3]);
    },
    m: function mount(target, anchor) {
      insert_dev(target, t0, anchor);
      insert_dev(target, t1, anchor);
    },
    p: function update(ctx, dirty) {
      if (dirty & /*assetGroupsDataError*/ 8)
        set_data_dev(t1, /*assetGroupsDataError*/ ctx[3]);
    },
    d: function destroy(detaching) {
      if (detaching) detach_dev(t0);
      if (detaching) detach_dev(t1);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_if_block_1$1.name,
    type: "if",
    source: "(60:33) ",
    ctx,
  });

  return block;
}

// (58:2) {#if assetGroupsDataLoading}
function create_if_block$1(ctx) {
  let t;

  const block = {
    c: function create() {
      t = text("Asset groups loading...");
    },
    m: function mount(target, anchor) {
      insert_dev(target, t, anchor);
    },
    p: noop,
    d: function destroy(detaching) {
      if (detaching) detach_dev(t);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_if_block$1.name,
    type: "if",
    source: "(58:2) {#if assetGroupsDataLoading}",
    ctx,
  });

  return block;
}

// (63:4) {#each assetGroupsList as assetGroup}
function create_each_block$2(ctx) {
  let button;
  let t_value = /*assetGroup*/ ctx[8].type + "";
  let t;
  let button_class_value;
  let mounted;
  let dispose;

  function click_handler(...args) {
    return /*click_handler*/ ctx[5](/*assetGroup*/ ctx[8], ...args);
  }

  const block = {
    c: function create() {
      button = element("button");
      t = text(t_value);

      attr_dev(
        button,
        "class",
        (button_class_value =
          "" +
          (null_to_empty(
            `asset-groups-item ${
              /*activeGroup*/ ctx[0].type === /*assetGroup*/ ctx[8].type
                ? "active"
                : ""
            }`
          ) +
            " svelte-1nm1vns"))
      );

      add_location(button, file$2, 63, 6, 1372);
    },
    m: function mount(target, anchor) {
      insert_dev(target, button, anchor);
      append_dev(button, t);

      if (!mounted) {
        dispose = listen_dev(
          button,
          "click",
          click_handler,
          false,
          false,
          false
        );
        mounted = true;
      }
    },
    p: function update(new_ctx, dirty) {
      ctx = new_ctx;
      if (
        dirty & /*assetGroupsList*/ 2 &&
        t_value !== (t_value = /*assetGroup*/ ctx[8].type + "")
      )
        set_data_dev(t, t_value);

      if (
        dirty & /*activeGroup, assetGroupsList*/ 3 &&
        button_class_value !==
          (button_class_value =
            "" +
            (null_to_empty(
              `asset-groups-item ${
                /*activeGroup*/ ctx[0].type === /*assetGroup*/ ctx[8].type
                  ? "active"
                  : ""
              }`
            ) +
              " svelte-1nm1vns"))
      ) {
        attr_dev(button, "class", button_class_value);
      }
    },
    d: function destroy(detaching) {
      if (detaching) detach_dev(button);
      mounted = false;
      dispose();
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_each_block$2.name,
    type: "each",
    source: "(63:4) {#each assetGroupsList as assetGroup}",
    ctx,
  });

  return block;
}

function create_fragment$2(ctx) {
  let div;

  function select_block_type(ctx, dirty) {
    if (/*assetGroupsDataLoading*/ ctx[2]) return create_if_block$1;
    if (/*assetGroupsDataError*/ ctx[3]) return create_if_block_1$1;
    return create_else_block$2;
  }

  let current_block_type = select_block_type(ctx);
  let if_block = current_block_type(ctx);

  const block = {
    c: function create() {
      div = element("div");
      if_block.c();
      attr_dev(div, "class", "asset-groups-widget-wrapper svelte-1nm1vns");
      add_location(div, file$2, 56, 0, 1145);
    },
    l: function claim(nodes) {
      throw new Error(
        "options.hydrate only works if the component was compiled with the `hydratable: true` option"
      );
    },
    m: function mount(target, anchor) {
      insert_dev(target, div, anchor);
      if_block.m(div, null);
    },
    p: function update(ctx, [dirty]) {
      if (
        current_block_type === (current_block_type = select_block_type(ctx)) &&
        if_block
      ) {
        if_block.p(ctx, dirty);
      } else {
        if_block.d(1);
        if_block = current_block_type(ctx);

        if (if_block) {
          if_block.c();
          if_block.m(div, null);
        }
      }
    },
    i: noop,
    o: noop,
    d: function destroy(detaching) {
      if (detaching) detach_dev(div);
      if_block.d();
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_fragment$2.name,
    type: "component",
    source: "",
    ctx,
  });

  return block;
}

function instance$2($$self, $$props, $$invalidate) {
  let { options } = $$props;
  const { brand, env } = options;
  let {
    activeGroup,
    assetGroupsList,
    assetGroupsDataLoading,
    assetGroupsDataError,
  } = {};

  mainStore.subscribe(({ assetGroups, activeAssetGroup }) => {
    $$invalidate(0, (activeGroup = activeAssetGroup));
    $$invalidate(1, (assetGroupsList = assetGroups.visibleGroups));
    $$invalidate(3, (assetGroupsDataError = assetGroups.error));
    $$invalidate(2, (assetGroupsDataLoading = assetGroups.loading));
  });

  onMount(() => {
    getAssetGroups({ brand, env });
  });

  const writable_props = ["options"];

  Object.keys($$props).forEach((key) => {
    if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$")
      console_1$2.warn(
        `<AssetsGroupWidget> was created with unknown prop '${key}'`
      );
  });

  let { $$slots = {}, $$scope } = $$props;
  validate_slots("AssetsGroupWidget", $$slots, []);

  const click_handler = (assetGroup) => {
    setActiveAssetGroup(assetGroup);
  };

  $$self.$set = ($$props) => {
    if ("options" in $$props) $$invalidate(4, (options = $$props.options));
  };

  $$self.$capture_state = () => ({
    onMount,
    getAssetGroups,
    mainStore,
    setActiveAssetGroup,
    options,
    brand,
    env,
    activeGroup,
    assetGroupsList,
    assetGroupsDataLoading,
    assetGroupsDataError,
  });

  $$self.$inject_state = ($$props) => {
    if ("options" in $$props) $$invalidate(4, (options = $$props.options));
    if ("activeGroup" in $$props)
      $$invalidate(0, (activeGroup = $$props.activeGroup));
    if ("assetGroupsList" in $$props)
      $$invalidate(1, (assetGroupsList = $$props.assetGroupsList));
    if ("assetGroupsDataLoading" in $$props)
      $$invalidate(
        2,
        (assetGroupsDataLoading = $$props.assetGroupsDataLoading)
      );
    if ("assetGroupsDataError" in $$props)
      $$invalidate(3, (assetGroupsDataError = $$props.assetGroupsDataError));
  };

  if ($$props && "$$inject" in $$props) {
    $$self.$inject_state($$props.$$inject);
  }

  $$self.$$.update = () => {
    if ($$self.$$.dirty & /*activeGroup*/ 1) {
      console.log(">>>----------------------- activeGroup", activeGroup);
    }
  };

  return [
    activeGroup,
    assetGroupsList,
    assetGroupsDataLoading,
    assetGroupsDataError,
    options,
    click_handler,
  ];
}

class AssetsGroupWidget extends SvelteComponentDev {
  constructor(options) {
    super(options);
    init(this, options, instance$2, create_fragment$2, safe_not_equal, {
      options: 4,
    });

    dispatch_dev("SvelteRegisterComponent", {
      component: this,
      tagName: "AssetsGroupWidget",
      options,
      id: create_fragment$2.name,
    });

    const { ctx } = this.$$;
    const props = options.props || {};

    if (/*options*/ ctx[4] === undefined && !("options" in props)) {
      console_1$2.warn(
        "<AssetsGroupWidget> was created without expected prop 'options'"
      );
    }
  }

  get options() {
    throw new Error(
      "<AssetsGroupWidget>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
    );
  }

  set options(value) {
    throw new Error(
      "<AssetsGroupWidget>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
    );
  }
}

/* src/App.svelte generated by Svelte v3.23.2 */
const file$3 = "src/App.svelte";

// (9:0) {#if widgetName === widgetNames.ASSET_GROUPS_WIDGET}
function create_if_block_4(ctx) {
  let assetgroupwidget;
  let current;

  assetgroupwidget = new AssetsGroupWidget({
    props: { options: /*options*/ ctx[1] },
    $$inline: true,
  });

  const block = {
    c: function create() {
      create_component(assetgroupwidget.$$.fragment);
    },
    m: function mount(target, anchor) {
      mount_component(assetgroupwidget, target, anchor);
      current = true;
    },
    p: function update(ctx, dirty) {
      const assetgroupwidget_changes = {};
      if (dirty & /*options*/ 2)
        assetgroupwidget_changes.options = /*options*/ ctx[1];
      assetgroupwidget.$set(assetgroupwidget_changes);
    },
    i: function intro(local) {
      if (current) return;
      transition_in(assetgroupwidget.$$.fragment, local);
      current = true;
    },
    o: function outro(local) {
      transition_out(assetgroupwidget.$$.fragment, local);
      current = false;
    },
    d: function destroy(detaching) {
      destroy_component(assetgroupwidget, detaching);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_if_block_4.name,
    type: "if",
    source: "(9:0) {#if widgetName === widgetNames.ASSET_GROUPS_WIDGET}",
    ctx,
  });

  return block;
}

// (12:0) {#if widgetName === widgetNames.SYMBOLS_TABLE_WIDGET}
function create_if_block_3(ctx) {
  let symbolstablewidget;
  let current;

  symbolstablewidget = new SymbolsTableWidget({
    props: { options: /*options*/ ctx[1] },
    $$inline: true,
  });

  const block = {
    c: function create() {
      create_component(symbolstablewidget.$$.fragment);
    },
    m: function mount(target, anchor) {
      mount_component(symbolstablewidget, target, anchor);
      current = true;
    },
    p: function update(ctx, dirty) {
      const symbolstablewidget_changes = {};
      if (dirty & /*options*/ 2)
        symbolstablewidget_changes.options = /*options*/ ctx[1];
      symbolstablewidget.$set(symbolstablewidget_changes);
    },
    i: function intro(local) {
      if (current) return;
      transition_in(symbolstablewidget.$$.fragment, local);
      current = true;
    },
    o: function outro(local) {
      transition_out(symbolstablewidget.$$.fragment, local);
      current = false;
    },
    d: function destroy(detaching) {
      destroy_component(symbolstablewidget, detaching);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_if_block_3.name,
    type: "if",
    source: "(12:0) {#if widgetName === widgetNames.SYMBOLS_TABLE_WIDGET}",
    ctx,
  });

  return block;
}

// (15:0) {#if widgetName === widgetNames.CHART_WIDGET}
function create_if_block_2$1(ctx) {
  let h3;

  const block = {
    c: function create() {
      h3 = element("h3");
      h3.textContent = "Chart widget";
      add_location(h3, file$3, 15, 2, 553);
    },
    m: function mount(target, anchor) {
      insert_dev(target, h3, anchor);
    },
    d: function destroy(detaching) {
      if (detaching) detach_dev(h3);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_if_block_2$1.name,
    type: "if",
    source: "(15:0) {#if widgetName === widgetNames.CHART_WIDGET}",
    ctx,
  });

  return block;
}

// (18:0) {#if widgetName === widgetNames.QUOTES_SYMBOLS_WIDGET}
function create_if_block_1$2(ctx) {
  let h3;

  const block = {
    c: function create() {
      h3 = element("h3");
      h3.textContent = "Quotes Symbols widget";
      add_location(h3, file$3, 18, 2, 638);
    },
    m: function mount(target, anchor) {
      insert_dev(target, h3, anchor);
    },
    d: function destroy(detaching) {
      if (detaching) detach_dev(h3);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_if_block_1$2.name,
    type: "if",
    source: "(18:0) {#if widgetName === widgetNames.QUOTES_SYMBOLS_WIDGET}",
    ctx,
  });

  return block;
}

// (21:0) {#if widgetName === widgetNames.SYMBOLS_CAROUSEL_WIDGET}
function create_if_block$2(ctx) {
  let h3;

  const block = {
    c: function create() {
      h3 = element("h3");
      h3.textContent = "Symbols Carousel widget";
      add_location(h3, file$3, 21, 2, 734);
    },
    m: function mount(target, anchor) {
      insert_dev(target, h3, anchor);
    },
    d: function destroy(detaching) {
      if (detaching) detach_dev(h3);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_if_block$2.name,
    type: "if",
    source: "(21:0) {#if widgetName === widgetNames.SYMBOLS_CAROUSEL_WIDGET}",
    ctx,
  });

  return block;
}

function create_fragment$3(ctx) {
  let t0;
  let t1;
  let t2;
  let t3;
  let if_block4_anchor;
  let current;
  let if_block0 =
    /*widgetName*/ ctx[0] === widgetNames.ASSET_GROUPS_WIDGET &&
    create_if_block_4(ctx);
  let if_block1 =
    /*widgetName*/ ctx[0] === widgetNames.SYMBOLS_TABLE_WIDGET &&
    create_if_block_3(ctx);
  let if_block2 =
    /*widgetName*/ ctx[0] === widgetNames.CHART_WIDGET &&
    create_if_block_2$1(ctx);
  let if_block3 =
    /*widgetName*/ ctx[0] === widgetNames.QUOTES_SYMBOLS_WIDGET &&
    create_if_block_1$2(ctx);
  let if_block4 =
    /*widgetName*/ ctx[0] === widgetNames.SYMBOLS_CAROUSEL_WIDGET &&
    create_if_block$2(ctx);

  const block = {
    c: function create() {
      if (if_block0) if_block0.c();
      t0 = space();
      if (if_block1) if_block1.c();
      t1 = space();
      if (if_block2) if_block2.c();
      t2 = space();
      if (if_block3) if_block3.c();
      t3 = space();
      if (if_block4) if_block4.c();
      if_block4_anchor = empty();
    },
    l: function claim(nodes) {
      throw new Error(
        "options.hydrate only works if the component was compiled with the `hydratable: true` option"
      );
    },
    m: function mount(target, anchor) {
      if (if_block0) if_block0.m(target, anchor);
      insert_dev(target, t0, anchor);
      if (if_block1) if_block1.m(target, anchor);
      insert_dev(target, t1, anchor);
      if (if_block2) if_block2.m(target, anchor);
      insert_dev(target, t2, anchor);
      if (if_block3) if_block3.m(target, anchor);
      insert_dev(target, t3, anchor);
      if (if_block4) if_block4.m(target, anchor);
      insert_dev(target, if_block4_anchor, anchor);
      current = true;
    },
    p: function update(ctx, [dirty]) {
      if (/*widgetName*/ ctx[0] === widgetNames.ASSET_GROUPS_WIDGET) {
        if (if_block0) {
          if_block0.p(ctx, dirty);

          if (dirty & /*widgetName*/ 1) {
            transition_in(if_block0, 1);
          }
        } else {
          if_block0 = create_if_block_4(ctx);
          if_block0.c();
          transition_in(if_block0, 1);
          if_block0.m(t0.parentNode, t0);
        }
      } else if (if_block0) {
        group_outros();

        transition_out(if_block0, 1, 1, () => {
          if_block0 = null;
        });

        check_outros();
      }

      if (/*widgetName*/ ctx[0] === widgetNames.SYMBOLS_TABLE_WIDGET) {
        if (if_block1) {
          if_block1.p(ctx, dirty);

          if (dirty & /*widgetName*/ 1) {
            transition_in(if_block1, 1);
          }
        } else {
          if_block1 = create_if_block_3(ctx);
          if_block1.c();
          transition_in(if_block1, 1);
          if_block1.m(t1.parentNode, t1);
        }
      } else if (if_block1) {
        group_outros();

        transition_out(if_block1, 1, 1, () => {
          if_block1 = null;
        });

        check_outros();
      }

      if (/*widgetName*/ ctx[0] === widgetNames.CHART_WIDGET) {
        if (if_block2);
        else {
          if_block2 = create_if_block_2$1(ctx);
          if_block2.c();
          if_block2.m(t2.parentNode, t2);
        }
      } else if (if_block2) {
        if_block2.d(1);
        if_block2 = null;
      }

      if (/*widgetName*/ ctx[0] === widgetNames.QUOTES_SYMBOLS_WIDGET) {
        if (if_block3);
        else {
          if_block3 = create_if_block_1$2(ctx);
          if_block3.c();
          if_block3.m(t3.parentNode, t3);
        }
      } else if (if_block3) {
        if_block3.d(1);
        if_block3 = null;
      }

      if (/*widgetName*/ ctx[0] === widgetNames.SYMBOLS_CAROUSEL_WIDGET) {
        if (if_block4);
        else {
          if_block4 = create_if_block$2(ctx);
          if_block4.c();
          if_block4.m(if_block4_anchor.parentNode, if_block4_anchor);
        }
      } else if (if_block4) {
        if_block4.d(1);
        if_block4 = null;
      }
    },
    i: function intro(local) {
      if (current) return;
      transition_in(if_block0);
      transition_in(if_block1);
      current = true;
    },
    o: function outro(local) {
      transition_out(if_block0);
      transition_out(if_block1);
      current = false;
    },
    d: function destroy(detaching) {
      if (if_block0) if_block0.d(detaching);
      if (detaching) detach_dev(t0);
      if (if_block1) if_block1.d(detaching);
      if (detaching) detach_dev(t1);
      if (if_block2) if_block2.d(detaching);
      if (detaching) detach_dev(t2);
      if (if_block3) if_block3.d(detaching);
      if (detaching) detach_dev(t3);
      if (if_block4) if_block4.d(detaching);
      if (detaching) detach_dev(if_block4_anchor);
    },
  };

  dispatch_dev("SvelteRegisterBlock", {
    block,
    id: create_fragment$3.name,
    type: "component",
    source: "",
    ctx,
  });

  return block;
}

function instance$3($$self, $$props, $$invalidate) {
  let { widgetName } = $$props;
  let { options } = $$props;
  const writable_props = ["widgetName", "options"];

  Object.keys($$props).forEach((key) => {
    if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$")
      console.warn(`<App> was created with unknown prop '${key}'`);
  });

  let { $$slots = {}, $$scope } = $$props;
  validate_slots("App", $$slots, []);

  $$self.$set = ($$props) => {
    if ("widgetName" in $$props)
      $$invalidate(0, (widgetName = $$props.widgetName));
    if ("options" in $$props) $$invalidate(1, (options = $$props.options));
  };

  $$self.$capture_state = () => ({
    SymbolsTableWidget,
    widgetName,
    options,
    widgetNames,
    AssetGroupWidget: AssetsGroupWidget,
  });

  $$self.$inject_state = ($$props) => {
    if ("widgetName" in $$props)
      $$invalidate(0, (widgetName = $$props.widgetName));
    if ("options" in $$props) $$invalidate(1, (options = $$props.options));
  };

  if ($$props && "$$inject" in $$props) {
    $$self.$inject_state($$props.$$inject);
  }

  return [widgetName, options];
}

class App extends SvelteComponentDev {
  constructor(options) {
    super(options);
    init(this, options, instance$3, create_fragment$3, safe_not_equal, {
      widgetName: 0,
      options: 1,
    });

    dispatch_dev("SvelteRegisterComponent", {
      component: this,
      tagName: "App",
      options,
      id: create_fragment$3.name,
    });

    const { ctx } = this.$$;
    const props = options.props || {};

    if (/*widgetName*/ ctx[0] === undefined && !("widgetName" in props)) {
      console.warn("<App> was created without expected prop 'widgetName'");
    }

    if (/*options*/ ctx[1] === undefined && !("options" in props)) {
      console.warn("<App> was created without expected prop 'options'");
    }
  }

  get widgetName() {
    throw new Error(
      "<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
    );
  }

  set widgetName(value) {
    throw new Error(
      "<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
    );
  }

  get options() {
    throw new Error(
      "<App>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
    );
  }

  set options(value) {
    throw new Error(
      "<App>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'"
    );
  }
}

const getApp = ({ elementId, widgetName, widgetOption }) => {
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
      widgetOption,
    },
  });
};

window.getApp = getApp;

const setOptionsToStore = (options) => {
  updateOptions(options);
};
window.setWidgetOptions = setOptionsToStore;
//# sourceMappingURL=bundle.js.map
