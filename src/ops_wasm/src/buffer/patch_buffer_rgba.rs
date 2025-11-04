use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn patch_buffer_rgba(
    // target
    target: &[u8],
    target_width: u32,
    target_height: u32,
    // patch
    patch: &[u8],
    patch_width: u32,
    patch_height: u32,
    offset_x: f32,
    offset_y: f32,
) -> Vec<u8> {
    let w = target_width as i32;
    let h = target_height as i32;

    // Expect RGBA buffers
    let mut result = target.to_vec();

    // Validate patch buffer size matches dimensions (RGBA)
    let src_w = patch_width as i32;
    let src_h = patch_height as i32;
    if src_w <= 0 || src_h <= 0 {
        return result;
    }
    if (src_w as usize) * (src_h as usize) * 4 != patch.len() {
        return result;
    }

    let dx = offset_x.round() as i32;
    let dy = offset_y.round() as i32;

    for sy in 0..src_h {
        for sx in 0..src_w {
            let src_idx = (sy * src_w + sx) as usize;
            let src_start = src_idx * 4;
            if src_start + 3 >= patch.len() {
                continue;
            }

            let px_r = patch[src_start] as u8;
            let px_g = patch[src_start + 1] as u8;
            let px_b = patch[src_start + 2] as u8;
            let px_a = patch[src_start + 3] as u8;

            if px_a == 0 {
                continue;
            }

            let tx = sx + dx;
            let ty = sy + dy;

            if tx < 0 || tx >= w || ty < 0 || ty >= h {
                continue;
            }

            let tgt_idx = (ty * w + tx) as usize;
            let tgt_start = tgt_idx * 4;
            if tgt_start + 3 >= result.len() {
                continue;
            }

            let dst_r = result[tgt_start] as f32;
            let dst_g = result[tgt_start + 1] as f32;
            let dst_b = result[tgt_start + 2] as f32;
            let dst_a = result[tgt_start + 3] as f32;

            let src_a_f = px_a as f32 / 255.0;
            let dst_a_f = dst_a / 255.0;

            // premultiplied-like alpha blend (source over)
            let out_r = (px_r as f32 * src_a_f + dst_r * (1.0 - src_a_f))
                .round()
                .clamp(0.0, 255.0) as u8;
            let out_g = (px_g as f32 * src_a_f + dst_g * (1.0 - src_a_f))
                .round()
                .clamp(0.0, 255.0) as u8;
            let out_b = (px_b as f32 * src_a_f + dst_b * (1.0 - src_a_f))
                .round()
                .clamp(0.0, 255.0) as u8;
            let out_a = ((src_a_f + dst_a_f * (1.0 - src_a_f)) * 255.0)
                .round()
                .clamp(0.0, 255.0) as u8;

            result[tgt_start] = out_r;
            result[tgt_start + 1] = out_g;
            result[tgt_start + 2] = out_b;
            result[tgt_start + 3] = out_a;
        }
    }

    result
}

#[wasm_bindgen]
pub fn patch_buffer_rgba_instant(
    // target (mutable)
    target: &mut [u8],
    target_width: u32,
    target_height: u32,
    // patch
    patch: &[u8],
    patch_width: u32,
    patch_height: u32,
    offset_x: f32,
    offset_y: f32,
    scale_x: f32,
    scale_y: f32,
    rotate_deg: f32,
) {
    let target_w = target_width as i32;
    let target_h = target_height as i32;
    let src_w = patch_width as i32;
    let src_h = patch_height as i32;

    if src_w <= 0 || src_h <= 0 {
        return;
    }
    if (src_w as usize) * (src_h as usize) * 4 != patch.len() {
        return;
    }
    if (target_w as usize) * (target_h as usize) * 4 != target.len() {
        return;
    }

    // Convert rotation from degrees to radians
    let rotate_rad = rotate_deg * std::f32::consts::PI / 180.0;
    let cos_r = rotate_rad.cos();
    let sin_r = rotate_rad.sin();

    // Source image center after scaling
    let src_center_x = (src_w as f32 * scale_x) / 2.0;
    let src_center_y = (src_h as f32 * scale_y) / 2.0;

    // For each pixel in the target buffer
    for ty in 0..target_h {
        for tx in 0..target_w {
            let tgt_idx = (ty * target_w + tx) as usize;
            let tgt_start = tgt_idx * 4;

            // Convert target coordinates to source coordinates
            // First, apply offset
            let rel_x = tx as f32 - offset_x;
            let rel_y = ty as f32 - offset_y;

            // Apply inverse rotation around the center
            let centered_x = rel_x - src_center_x;
            let centered_y = rel_y - src_center_y;

            let rotated_x = centered_x * cos_r + centered_y * sin_r + src_center_x;
            let rotated_y = -centered_x * sin_r + centered_y * cos_r + src_center_y;

            // Apply inverse scaling
            let src_x = rotated_x / scale_x;
            let src_y = rotated_y / scale_y;

            // Check bounds
            if src_x < 0.0 || src_y < 0.0 || src_x >= src_w as f32 || src_y >= src_h as f32 {
                continue;
            }

            // Bilinear interpolation
            let sx0 = src_x.floor() as i32;
            let sy0 = src_y.floor() as i32;
            let sx1 = (sx0 + 1).min(src_w - 1);
            let sy1 = (sy0 + 1).min(src_h - 1);

            let fx = src_x - sx0 as f32;
            let fy = src_y - sy0 as f32;

            // Sample four pixels
            let get_pixel = |x: i32, y: i32| -> (f32, f32, f32, f32) {
                if x < 0 || x >= src_w || y < 0 || y >= src_h {
                    return (0.0, 0.0, 0.0, 0.0);
                }
                let idx = (y * src_w + x) as usize * 4;
                (
                    patch[idx] as f32,
                    patch[idx + 1] as f32,
                    patch[idx + 2] as f32,
                    patch[idx + 3] as f32,
                )
            };

            let (r00, g00, b00, a00) = get_pixel(sx0, sy0);
            let (r10, g10, b10, a10) = get_pixel(sx1, sy0);
            let (r01, g01, b01, a01) = get_pixel(sx0, sy1);
            let (r11, g11, b11, a11) = get_pixel(sx1, sy1);

            // Interpolate
            let r0 = r00 * (1.0 - fx) + r10 * fx;
            let g0 = g00 * (1.0 - fx) + g10 * fx;
            let b0 = b00 * (1.0 - fx) + b10 * fx;
            let a0 = a00 * (1.0 - fx) + a10 * fx;

            let r1 = r01 * (1.0 - fx) + r11 * fx;
            let g1 = g01 * (1.0 - fx) + g11 * fx;
            let b1 = b01 * (1.0 - fx) + b11 * fx;
            let a1 = a01 * (1.0 - fx) + a11 * fx;

            let src_r = r0 * (1.0 - fy) + r1 * fy;
            let src_g = g0 * (1.0 - fy) + g1 * fy;
            let src_b = b0 * (1.0 - fy) + b1 * fy;
            let src_a = a0 * (1.0 - fy) + a1 * fy;

            if src_a < 1.0 {
                continue; // Skip transparent pixels
            }

            // Alpha blend (source over)
            let dst_r = target[tgt_start] as f32;
            let dst_g = target[tgt_start + 1] as f32;
            let dst_b = target[tgt_start + 2] as f32;
            let dst_a = target[tgt_start + 3] as f32;

            let src_a_norm = src_a / 255.0;
            let dst_a_norm = dst_a / 255.0;

            let out_r = (src_r * src_a_norm + dst_r * (1.0 - src_a_norm))
                .round()
                .clamp(0.0, 255.0) as u8;
            let out_g = (src_g * src_a_norm + dst_g * (1.0 - src_a_norm))
                .round()
                .clamp(0.0, 255.0) as u8;
            let out_b = (src_b * src_a_norm + dst_b * (1.0 - src_a_norm))
                .round()
                .clamp(0.0, 255.0) as u8;
            let out_a = ((src_a_norm + dst_a_norm * (1.0 - src_a_norm)) * 255.0)
                .round()
                .clamp(0.0, 255.0) as u8;

            target[tgt_start] = out_r;
            target[tgt_start + 1] = out_g;
            target[tgt_start + 2] = out_b;
            target[tgt_start + 3] = out_a;
        }
    }
}
