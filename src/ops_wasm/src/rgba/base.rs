use crate::rgba::RgbaBuffer;
use js_sys::Uint8ClampedArray;
use wasm_bindgen::prelude::*;

pub fn pixel_byte_len(width: u32, height: u32) -> usize {
    (width as usize)
        .saturating_mul(height as usize)
        .saturating_mul(4)
}

pub fn mask_pixel_count(mask_width: u32, mask_height: u32) -> usize {
    (mask_width as usize).saturating_mul(mask_height as usize)
}

pub fn mask_is_valid(mask_width: u32, mask_height: u32, mask: &[u8]) -> bool {
    mask_pixel_count(mask_width, mask_height) <= mask.len()
}

pub fn positive_area(width: i32, height: i32) -> bool {
    width > 0 && height > 0
}

#[wasm_bindgen]
impl RgbaBuffer {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> RgbaBuffer {
        let size = pixel_byte_len(width, height);
        RgbaBuffer {
            width,
            height,
            data: vec![0u8; size],
        }
    }

    pub fn width(&self) -> u32 {
        self.width
    }
    pub fn height(&self) -> u32 {
        self.height
    }
    pub fn len(&self) -> usize {
        self.data.len()
    }
    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }
    pub fn ptr(&self) -> *const u8 {
        self.data.as_ptr()
    }
    #[wasm_bindgen(js_name = data)]
    pub fn data_view(&self) -> Uint8ClampedArray {
        // Safety: view becomes invalid if wasm memory grows; callers must refresh after resize.
        unsafe { Uint8ClampedArray::view(&self.data) }
    }

    #[wasm_bindgen(js_name = isInBounds)]
    pub fn in_bounds(&self, x: u32, y: u32) -> bool {
        x < self.width && y < self.height
    }

    #[wasm_bindgen(js_name = overwriteWith)]
    pub fn overwrite_with(&mut self, raw: Vec<u8>, width: u32, height: u32) -> bool {
        let expected = pixel_byte_len(width, height);
        if raw.len() != expected {
            return false;
        }
        self.width = width;
        self.height = height;
        self.data = raw;
        true
    }

    #[wasm_bindgen(js_name = getPixel)]
    pub fn get_pixel(&self, x: u32, y: u32) -> Uint8ClampedArray {
        if !self.in_bounds(x, y) {
            return Uint8ClampedArray::new_with_length(4);
        }
        let idx = ((y * self.width + x) * 4) as usize;
        let mut buf = [0u8; 4];
        buf.copy_from_slice(&self.data[idx..idx + 4]);
        Uint8ClampedArray::from(&buf[..])
    }

    #[wasm_bindgen(js_name = setPixel)]
    pub fn set_pixel(&mut self, x: u32, y: u32, r: u8, g: u8, b: u8, a: u8) -> bool {
        if !self.in_bounds(x, y) {
            return false;
        }
        let idx = ((y * self.width + x) * 4) as usize;
        let slice = &mut self.data[idx..idx + 4];
        let changed = slice != [r, g, b, a];
        slice.copy_from_slice(&[r, g, b, a]);
        changed
    }

    #[wasm_bindgen(js_name = indexGet)]
    pub fn index_get(&self, idx: u32) -> Uint8ClampedArray {
        let start = idx as usize;
        if start + 4 > self.data.len() {
            return Uint8ClampedArray::new_with_length(4);
        }
        let mut buf = [0u8; 4];
        buf.copy_from_slice(&self.data[start..start + 4]);
        Uint8ClampedArray::from(&buf[..])
    }

    #[wasm_bindgen(js_name = indexSet)]
    pub fn index_set(&mut self, idx: u32, r: u8, g: u8, b: u8, a: u8) -> bool {
        let start = idx as usize;
        if start + 4 > self.data.len() {
            return false;
        }
        let slice = &mut self.data[start..start + 4];
        let changed = slice != [r, g, b, a];
        slice.copy_from_slice(&[r, g, b, a]);
        changed
    }
}
