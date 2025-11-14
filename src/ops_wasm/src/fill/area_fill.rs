use wasm_bindgen::prelude::*;

#[wasm_bindgen]
#[allow(clippy::too_many_arguments)]
pub fn fill_mask_area(
    buffer: &mut [u8],
    mask: &[u8],
    width: u32,
    height: u32,
    fill_color_r: u8,
    fill_color_g: u8,
    fill_color_b: u8,
    fill_color_a: u8,
) -> bool {
    let width = width as usize;
    let height = height as usize;

    let fill_color = [fill_color_r, fill_color_g, fill_color_b, fill_color_a];
    let mask_length = height * width;

    for mi in 0..mask_length {
        if mask[mi] != 0 {
            let bi = mi * 4;
            buffer[bi] = fill_color[0];
            buffer[bi + 1] = fill_color[1];
            buffer[bi + 2] = fill_color[2];
            buffer[bi + 3] = fill_color[3];
        }
    }

    true
}
