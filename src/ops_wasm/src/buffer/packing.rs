use image_webp::{WebPDecoder, WebPEncoder};
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn raw_to_webp(buffer: &[u8], width: u32, height: u32) -> Vec<u8> {
    let mut output = Vec::new();

    let encoder = WebPEncoder::new(&mut output);
    encoder
        .encode(buffer, width, height, image_webp::ColorType::Rgba8)
        .unwrap_or_default();

    output
}

#[wasm_bindgen]
pub fn webp_to_raw(webp_buffer: &[u8], width: u32, height: u32) -> Vec<u8> {
    let w = width as usize;
    let h = height as usize;
    let mut output = vec![0u8; w * h * 4];

    let mut cursor = std::io::Cursor::new(webp_buffer);
    let mut decoder = match WebPDecoder::new(&mut cursor) {
        Ok(decoder) => decoder,
        Err(_) => return output,
    };
    let _ = decoder.read_image(&mut output);

    output
}
