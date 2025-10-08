use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn resize(
    // target
    buffer: &[u8],
    old_width: u32,
    old_height: u32,
    new_width: u32,
    new_height: u32,
    src_origin_x: f32,
    src_origin_y: f32,
    dest_origin_x: f32,
    dest_origin_y: f32,
) -> Vec<u8> {
    // RGBA buffer resize with offset copy semantics.
    // Copies the overlapping region defined by src_origin -> dest_origin.
    // Areas not covered are left transparent (0-filled).

    let old_w = old_width as i32;
    let old_h = old_height as i32;
    let new_w = new_width as i32;
    let new_h = new_height as i32;

    // Early returns
    if old_w <= 0 || old_h <= 0 || new_w <= 0 || new_h <= 0 {
        return vec![0u8; (new_width as usize) * (new_height as usize) * 4];
    }
    if buffer.len() != (old_width as usize) * (old_height as usize) * 4 {
        // invalid input size; return transparent new buffer
        return vec![0u8; (new_width as usize) * (new_height as usize) * 4];
    }

    // Round origins to nearest integer (consistent with JS implementation rounding behavior)
    let src_ox = src_origin_x.floor() as i32; // floor to avoid sampling beyond actual source
    let src_oy = src_origin_y.floor() as i32;
    let dst_ox = dest_origin_x.floor() as i32;
    let dst_oy = dest_origin_y.floor() as i32;

    // Compute copy region in destination space (intersection)
    // Source rectangle in old buffer: (src_ox, src_oy) -> (src_ox + new_w, src_oy + new_h) conceptually
    // But actual copy is constrained by both old buffer and new buffer bounds when mapped with dest origins.

    // We want to copy pixels such that source (sx, sy) maps to dest (dx, dy) where:
    // dx = (sx - src_ox) + dst_ox  => sx = dx - dst_ox + src_ox
    // We'll iterate destination copy rect and sample source.

    // Destination copy bounds initial (full new buffer)
    let mut copy_dst_left = 0;
    let mut copy_dst_top = 0;
    let mut copy_dst_right = new_w; // exclusive
    let mut copy_dst_bottom = new_h; // exclusive

    // Clamp by where valid source exists.
    // For a given dest (dx,dy), source (sx,sy) = dx - dst_ox + src_ox, dy - dst_oy + src_oy must be within [0, old_w/old_h)
    // So dx in [dst_ox - src_ox, dst_ox - src_ox + old_w)
    let valid_dx_min = dst_ox - src_ox; // inclusive
    let valid_dx_max = dst_ox - src_ox + old_w; // exclusive
    let valid_dy_min = dst_oy - src_oy;
    let valid_dy_max = dst_oy - src_oy + old_h;

    // Intersect with new buffer bounds [0,new_w) & [0,new_h)
    copy_dst_left = copy_dst_left.max(valid_dx_min).max(0);
    copy_dst_top = copy_dst_top.max(valid_dy_min).max(0);
    copy_dst_right = copy_dst_right.min(valid_dx_max).min(new_w);
    copy_dst_bottom = copy_dst_bottom.min(valid_dy_max).min(new_h);

    // If no overlap
    if copy_dst_left >= copy_dst_right || copy_dst_top >= copy_dst_bottom {
        return vec![0u8; (new_width as usize) * (new_height as usize) * 4];
    }

    let mut out = vec![0u8; (new_width as usize) * (new_height as usize) * 4];

    // Iterate row by row, perform single slice copy per row.
    // For a given destination x-range [copy_dst_left, copy_dst_right), the corresponding source x-range is
    // sx_first = copy_dst_left - dst_ox + src_ox
    // Because we already constrained destination rectangle to overlap region, resulting sx_first.. is guaranteed in bounds.
    let row_copy_width = (copy_dst_right - copy_dst_left) as usize; // in pixels
    for dy in copy_dst_top..copy_dst_bottom {
        let sy = dy - dst_oy + src_oy;
        if sy < 0 || sy >= old_h { continue; }

        let sx_first = copy_dst_left - dst_ox + src_ox;
        if sx_first < 0 || sx_first + (row_copy_width as i32) > old_w { continue; } // safety guard

        let src_index = (sy * old_w + sx_first) as usize * 4;
        let dst_index = (dy * new_w + copy_dst_left) as usize * 4;
        let byte_len = row_copy_width * 4;
        out[dst_index..dst_index + byte_len].copy_from_slice(&buffer[src_index..src_index + byte_len]);
    }

    out
}
