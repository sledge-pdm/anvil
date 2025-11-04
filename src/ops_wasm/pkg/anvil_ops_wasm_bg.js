let wasm;
export function __wbg_set_wasm(val) {
    wasm = val;
}


let cachedUint8ArrayMemory0 = null;

function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let WASM_VECTOR_LEN = 0;

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}
/**
 * スキャンライン方式のFloodFill実装
 *
 * この実装は以下の特徴を持ちます：
 * - メモリ効率的なスキャンライン方式
 * - スタックオーバーフロー回避
 * - 高速な隣接色判定
 * - 選択範囲制限サポート
 * @param {Uint8Array} buffer
 * @param {number} width
 * @param {number} height
 * @param {number} start_x
 * @param {number} start_y
 * @param {number} fill_color_r
 * @param {number} fill_color_g
 * @param {number} fill_color_b
 * @param {number} fill_color_a
 * @param {number} threshold
 * @returns {boolean}
 */
export function scanline_flood_fill(buffer, width, height, start_x, start_y, fill_color_r, fill_color_g, fill_color_b, fill_color_a, threshold) {
    var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    const ret = wasm.scanline_flood_fill(ptr0, len0, buffer, width, height, start_x, start_y, fill_color_r, fill_color_g, fill_color_b, fill_color_a, threshold);
    return ret !== 0;
}

const cachedTextEncoder = new TextEncoder();

if (!('encodeInto' in cachedTextEncoder)) {
    cachedTextEncoder.encodeInto = function (arg, view) {
        const buf = cachedTextEncoder.encode(arg);
        view.set(buf);
        return {
            read: arg.length,
            written: buf.length
        };
    }
}

function passStringToWasm0(arg, malloc, realloc) {

    if (realloc === undefined) {
        const buf = cachedTextEncoder.encode(arg);
        const ptr = malloc(buf.length, 1) >>> 0;
        getUint8ArrayMemory0().subarray(ptr, ptr + buf.length).set(buf);
        WASM_VECTOR_LEN = buf.length;
        return ptr;
    }

    let len = arg.length;
    let ptr = malloc(len, 1) >>> 0;

    const mem = getUint8ArrayMemory0();

    let offset = 0;

    for (; offset < len; offset++) {
        const code = arg.charCodeAt(offset);
        if (code > 0x7F) break;
        mem[ptr + offset] = code;
    }

    if (offset !== len) {
        if (offset !== 0) {
            arg = arg.slice(offset);
        }
        ptr = realloc(ptr, len, len = offset + arg.length * 3, 1) >>> 0;
        const view = getUint8ArrayMemory0().subarray(ptr + offset, ptr + len);
        const ret = cachedTextEncoder.encodeInto(arg, view);

        offset += ret.written;
        ptr = realloc(ptr, len, offset, 1) >>> 0;
    }

    WASM_VECTOR_LEN = offset;
    return ptr;
}
/**
 * 選択範囲制限付きスキャンライン FloodFill
 * @param {Uint8Array} buffer
 * @param {number} width
 * @param {number} height
 * @param {number} start_x
 * @param {number} start_y
 * @param {number} fill_color_r
 * @param {number} fill_color_g
 * @param {number} fill_color_b
 * @param {number} fill_color_a
 * @param {number} threshold
 * @param {Uint8Array} selection_mask
 * @param {string} limit_mode
 * @returns {boolean}
 */
export function scanline_flood_fill_with_mask(buffer, width, height, start_x, start_y, fill_color_r, fill_color_g, fill_color_b, fill_color_a, threshold, selection_mask, limit_mode) {
    var ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(selection_mask, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ptr2 = passStringToWasm0(limit_mode, wasm.__wbindgen_malloc, wasm.__wbindgen_realloc);
    const len2 = WASM_VECTOR_LEN;
    const ret = wasm.scanline_flood_fill_with_mask(ptr0, len0, buffer, width, height, start_x, start_y, fill_color_r, fill_color_g, fill_color_b, fill_color_a, threshold, ptr1, len1, ptr2, len2);
    return ret !== 0;
}

/**
 * @param {Uint8Array} target
 * @param {number} target_width
 * @param {number} target_height
 * @param {Uint8Array} patch
 * @param {number} patch_width
 * @param {number} patch_height
 * @param {number} offset_x
 * @param {number} offset_y
 * @returns {Uint8Array}
 */
export function patch_buffer_rgba(target, target_width, target_height, patch, patch_width, patch_height, offset_x, offset_y) {
    const ptr0 = passArray8ToWasm0(target, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(patch, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    const ret = wasm.patch_buffer_rgba(ptr0, len0, target_width, target_height, ptr1, len1, patch_width, patch_height, offset_x, offset_y);
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}

/**
 * @param {Uint8Array} target
 * @param {number} target_width
 * @param {number} target_height
 * @param {Uint8Array} patch
 * @param {number} patch_width
 * @param {number} patch_height
 * @param {number} offset_x
 * @param {number} offset_y
 * @param {number} scale_x
 * @param {number} scale_y
 * @param {number} rotate_deg
 */
export function patch_buffer_rgba_instant(target, target_width, target_height, patch, patch_width, patch_height, offset_x, offset_y, scale_x, scale_y, rotate_deg) {
    var ptr0 = passArray8ToWasm0(target, wasm.__wbindgen_malloc);
    var len0 = WASM_VECTOR_LEN;
    const ptr1 = passArray8ToWasm0(patch, wasm.__wbindgen_malloc);
    const len1 = WASM_VECTOR_LEN;
    wasm.patch_buffer_rgba_instant(ptr0, len0, target, target_width, target_height, ptr1, len1, patch_width, patch_height, offset_x, offset_y, scale_x, scale_y, rotate_deg);
}

/**
 * @param {Uint8Array} buffer
 * @param {number} old_width
 * @param {number} old_height
 * @param {number} new_width
 * @param {number} new_height
 * @param {number} src_origin_x
 * @param {number} src_origin_y
 * @param {number} dest_origin_x
 * @param {number} dest_origin_y
 * @returns {Uint8Array}
 */
export function resize(buffer, old_width, old_height, new_width, new_height, src_origin_x, src_origin_y, dest_origin_x, dest_origin_y) {
    const ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.resize(ptr0, len0, old_width, old_height, new_width, new_height, src_origin_x, src_origin_y, dest_origin_x, dest_origin_y);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} buffer
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function raw_to_webp(buffer, width, height) {
    const ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.raw_to_webp(ptr0, len0, width, height);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} webp_buffer
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function webp_to_raw(webp_buffer, width, height) {
    const ptr0 = passArray8ToWasm0(webp_buffer, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.webp_to_raw(ptr0, len0, width, height);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} buffer
 * @param {number} width
 * @param {number} height
 * @returns {Uint8Array}
 */
export function raw_to_png(buffer, width, height) {
    const ptr0 = passArray8ToWasm0(buffer, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.raw_to_png(ptr0, len0, width, height);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

/**
 * @param {Uint8Array} png_buffer
 * @param {number} _width
 * @param {number} _height
 * @returns {Uint8Array}
 */
export function png_to_raw(png_buffer, _width, _height) {
    const ptr0 = passArray8ToWasm0(png_buffer, wasm.__wbindgen_malloc);
    const len0 = WASM_VECTOR_LEN;
    const ret = wasm.png_to_raw(ptr0, len0, _width, _height);
    var v2 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v2;
}

export function __wbg_wbindgencopytotypedarray_d105febdb9374ca3(arg0, arg1, arg2) {
    new Uint8Array(arg2.buffer, arg2.byteOffset, arg2.byteLength).set(getArrayU8FromWasm0(arg0, arg1));
};

export function __wbindgen_init_externref_table() {
    const table = wasm.__wbindgen_export_0;
    const offset = table.grow(4);
    table.set(0, undefined);
    table.set(offset + 0, undefined);
    table.set(offset + 1, null);
    table.set(offset + 2, true);
    table.set(offset + 3, false);
    ;
};

