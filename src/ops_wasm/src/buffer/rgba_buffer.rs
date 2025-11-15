use crate::{
    buffer::{
        effects::{
            brightness_contrast::{brightness_contrast, BrightnessContrastOption},
            dithering::{dithering, DitheringMode, DitheringOption},
            dust_removal::{dust_removal, DustRemovalOption},
            gaussian_blur::{gaussian_blur, AlphaBlurMode, GaussianBlurOption},
            grayscale::grayscale,
            invert::invert,
            posterize::{posterize, PosterizeOption},
        },
        packing::{png_to_raw, raw_to_png, raw_to_webp, webp_to_raw},
        patch_buffer_rgba::{patch_buffer_rgba_instant, AntialiasMode, PatchBufferRgbaOption},
    },
    fill::{
        area_fill::fill_mask_area,
        flood_fill::{scanline_flood_fill, scanline_flood_fill_with_mask},
    },
};
use js_sys::Uint8ClampedArray;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct RgbaBuffer {
    width: u32,
    height: u32,
    data: Vec<u8>,
}

#[wasm_bindgen]
impl RgbaBuffer {
    #[wasm_bindgen(constructor)]
    pub fn new(width: u32, height: u32) -> RgbaBuffer {
        let size = (width as usize) * (height as usize) * 4;
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

    fn overwrite_with(&mut self, raw: Vec<u8>, width: u32, height: u32) -> bool {
        let expected = (width as usize) * (height as usize) * 4;
        if raw.len() != expected {
            return false;
        }
        self.width = width;
        self.height = height;
        self.data = raw;
        true
    }

    #[wasm_bindgen(js_name = exportWebp)]
    pub fn export_webp(&self) -> Vec<u8> {
        raw_to_webp(&self.data, self.width, self.height)
    }

    #[wasm_bindgen(js_name = exportPng)]
    pub fn export_png(&self) -> Vec<u8> {
        raw_to_png(&self.data, self.width, self.height)
    }

    #[wasm_bindgen(js_name = importRaw)]
    pub fn import_raw(&mut self, raw: &[u8], width: u32, height: u32) -> bool {
        let expected = (width as usize) * (height as usize) * 4;
        if raw.len() != expected {
            return false;
        }
        self.width = width;
        self.height = height;
        self.data.resize(expected, 0);
        self.data.copy_from_slice(raw);
        true
    }

    #[wasm_bindgen(js_name = importWebp)]
    pub fn import_webp(&mut self, webp_buffer: &[u8], width: u32, height: u32) -> bool {
        let decoded = webp_to_raw(webp_buffer, width, height);
        self.overwrite_with(decoded, width, height)
    }

    #[wasm_bindgen(js_name = importPng)]
    pub fn import_png(&mut self, png_buffer: &[u8], width: u32, height: u32) -> bool {
        let decoded = png_to_raw(png_buffer, width, height);
        self.overwrite_with(decoded, width, height)
    }

    #[wasm_bindgen(js_name = readRect)]
    pub fn read_rect(&self, rect_x: i32, rect_y: i32, rect_width: u32, rect_height: u32) -> Vec<u8> {
        let width = rect_width as i32;
        let height = rect_height as i32;
        if width <= 0 || height <= 0 {
            return Vec::new();
        }

        let src_w = self.width as i32;
        let src_h = self.height as i32;

        let mut result = vec![0u8; (rect_width as usize) * (rect_height as usize) * 4];
        for row in 0..height {
            let sy = rect_y + row;
            if sy < 0 || sy >= src_h {
                continue;
            }

            let dst_row_offset = (row as usize) * (rect_width as usize) * 4;
            let mut start_col = 0;
            let mut end_col = width;

            if rect_x < 0 {
                start_col = -rect_x;
            }
            if rect_x + end_col > src_w {
                end_col = src_w - rect_x;
            }

            if start_col >= end_col {
                continue;
            }

            let copy_w = (end_col - start_col) as usize;
            let dst_offset = dst_row_offset + (start_col as usize) * 4;
            let src_offset = ((sy * src_w + rect_x + start_col) as usize) * 4;

            result[dst_offset..dst_offset + copy_w * 4]
                .copy_from_slice(&self.data[src_offset..src_offset + copy_w * 4]);
        }

        result
    }

    #[wasm_bindgen(js_name = writeRect)]
    pub fn write_rect(&mut self, rect_x: i32, rect_y: i32, rect_width: u32, rect_height: u32, data: &[u8]) -> bool {
        let width = rect_width as i32;
        let height = rect_height as i32;
        if width <= 0 || height <= 0 {
            return false;
        }

        let expected = (rect_width as usize) * (rect_height as usize) * 4;
        if data.len() != expected {
            return false;
        }

        let dst_w = self.width as i32;
        let dst_h = self.height as i32;

        for row in 0..height {
            let sy = rect_y + row;
            if sy < 0 || sy >= dst_h {
                continue;
            }

            let src_row_offset = (row as usize) * (rect_width as usize) * 4;
            let mut start_col = 0;
            let mut end_col = width;

            if rect_x < 0 {
                start_col = -rect_x;
            }
            if rect_x + end_col > dst_w {
                end_col = dst_w - rect_x;
            }

            if start_col >= end_col {
                continue;
            }

            let copy_w = (end_col - start_col) as usize;
            let dst_offset = ((sy * dst_w + rect_x + start_col) as usize) * 4;
            let src_offset = src_row_offset + (start_col as usize) * 4;

            self.data[dst_offset..dst_offset + copy_w * 4]
                .copy_from_slice(&data[src_offset..src_offset + copy_w * 4]);
        }

        true
    }

    #[wasm_bindgen(js_name = writePixels)]
    pub fn write_pixels(&mut self, coords: &[u32], colors: &[u8]) -> bool {
        if coords.len() % 2 != 0 || colors.len() % 4 != 0 {
            return false;
        }
        let pixels = coords.len() / 2;
        if colors.len() / 4 != pixels {
            return false;
        }

        let width = self.width as usize;
        let height = self.height as usize;

        for i in 0..pixels {
            let x = coords[i * 2] as usize;
            let y = coords[i * 2 + 1] as usize;
            if x >= width || y >= height {
                continue;
            }

            let dst_index = (y * width + x) * 4;
            let color_index = i * 4;
            self.data[dst_index..dst_index + 4].copy_from_slice(&colors[color_index..color_index + 4]);
        }

        true
    }

    #[wasm_bindgen(js_name = resize_instant)]
    pub fn resize_with_origins(
        &mut self,
        new_width: u32,
        new_height: u32,
        src_origin_x: f32,
        src_origin_y: f32,
        dest_origin_x: f32,
        dest_origin_y: f32,
    ) {
        let old_w = self.width as i32;
        let old_h = self.height as i32;
        let new_w = new_width as i32;
        let new_h = new_height as i32;
        if new_width == 0 || new_height == 0 {
            return;
        }

        let src_origin_x = src_origin_x.floor() as i32;
        let src_origin_y = src_origin_y.floor() as i32;
        let dest_origin_x = dest_origin_x.floor() as i32;
        let dest_origin_y = dest_origin_y.floor() as i32;

        if old_w == new_w
            && old_h == new_h
            && src_origin_x == 0
            && src_origin_y == 0
            && dest_origin_x == 0
            && dest_origin_y == 0
        {
            return;
        }

        let pixel_stride = 4usize;
        let valid_dx_min = dest_origin_x - src_origin_x;
        let valid_dx_max = dest_origin_x - src_origin_x + old_w;
        let valid_dy_min = dest_origin_y - src_origin_y;
        let valid_dy_max = dest_origin_y - src_origin_y + old_h;
        let copy_dst_left = 0.max(valid_dx_min);
        let copy_dst_top = 0.max(valid_dy_min);
        let copy_dst_right = new_w.min(valid_dx_max);
        let copy_dst_bottom = new_h.min(valid_dy_max);

        if new_w * new_h > old_w * old_h {
            // grow: allocate new buffer and copy overlapping rows
            let mut new_buf = vec![0u8; (new_w * new_h * 4) as usize];
            if copy_dst_left < copy_dst_right && copy_dst_top < copy_dst_bottom {
                let row_copy_width = (copy_dst_right - copy_dst_left) as usize;
                for dy in copy_dst_top..copy_dst_bottom {
                    let sy = dy - dest_origin_y + src_origin_y;
                    if sy < 0 || sy >= old_h {
                        continue;
                    }
                    let sx_first = copy_dst_left - dest_origin_x + src_origin_x;
                    if sx_first < 0 || sx_first + row_copy_width as i32 > old_w {
                        continue;
                    }
                    let src_index = (sy * old_w + sx_first) as usize * pixel_stride;
                    let dst_index = (dy * new_w + copy_dst_left) as usize * pixel_stride;
                    let byte_len = row_copy_width * pixel_stride;
                    new_buf[dst_index..dst_index + byte_len]
                        .copy_from_slice(&self.data[src_index..src_index + byte_len]);
                }
            }
            self.data = new_buf;
            self.width = new_width;
            self.height = new_height;
            return;
        }

        if copy_dst_left < copy_dst_right && copy_dst_top < copy_dst_bottom {
            // shrink/in-place: copy rows within existing buffer, guarding overlap
            let row_copy_width = (copy_dst_right - copy_dst_left) as usize;
            for dy in copy_dst_top..copy_dst_bottom {
                let sy = dy - dest_origin_y + src_origin_y;
                if sy < 0 || sy >= old_h {
                    continue;
                }
                let sx_first = copy_dst_left - dest_origin_x + src_origin_x;
                if sx_first < 0 || sx_first + row_copy_width as i32 > old_w {
                    continue;
                }
                let src_index = (sy * old_w + sx_first) as usize * pixel_stride;
                let dst_index = (dy * new_w + copy_dst_left) as usize * pixel_stride;
                let byte_len = row_copy_width * pixel_stride;
                if src_index != dst_index {
                    let mut tmp = vec![0u8; byte_len];
                    tmp.copy_from_slice(&self.data[src_index..src_index + byte_len]);
                    self.data[dst_index..dst_index + byte_len].copy_from_slice(&tmp);
                }
            }
        }

        let new_len = (new_w * new_h * 4) as usize;
        self.data.truncate(new_len);
        self.width = new_width;
        self.height = new_height;
    }

    #[wasm_bindgen(js_name = fillMaskArea)]
    pub fn fill_mask_area(
        &mut self,
        mask: &[u8],
        fill_color_r: u8,
        fill_color_g: u8,
        fill_color_b: u8,
        fill_color_a: u8,
    ) -> bool {
        fill_mask_area(
            &mut self.data,
            mask,
            fill_color_r,
            fill_color_g,
            fill_color_b,
            fill_color_a,
        )
    }

    #[wasm_bindgen(js_name = floodFill)]
    #[allow(clippy::too_many_arguments)]
    pub fn flood_fill(
        &mut self,
        start_x: u32,
        start_y: u32,
        fill_color_r: u8,
        fill_color_g: u8,
        fill_color_b: u8,
        fill_color_a: u8,
        threshold: u8,
    ) -> bool {
        scanline_flood_fill(
            &mut self.data,
            self.width,
            self.height,
            start_x,
            start_y,
            fill_color_r,
            fill_color_g,
            fill_color_b,
            fill_color_a,
            threshold,
        )
    }

    #[wasm_bindgen(js_name = floodFillWithMask)]
    #[allow(clippy::too_many_arguments)]
    pub fn flood_fill_with_mask(
        &mut self,
        start_x: u32,
        start_y: u32,
        fill_color_r: u8,
        fill_color_g: u8,
        fill_color_b: u8,
        fill_color_a: u8,
        threshold: u8,
        selection_mask: &[u8],
        limit_mode: &str,
    ) -> bool {
        scanline_flood_fill_with_mask(
            &mut self.data,
            self.width,
            self.height,
            start_x,
            start_y,
            fill_color_r,
            fill_color_g,
            fill_color_b,
            fill_color_a,
            threshold,
            selection_mask,
            limit_mode,
        )
    }

    #[wasm_bindgen(js_name = blitFromRaw)]
    #[allow(clippy::too_many_arguments)]
    pub fn blit_from_raw(
        &mut self,
        source: &[u8],
        source_width: u32,
        source_height: u32,
        offset_x: f32,
        offset_y: f32,
        scale_x: f32,
        scale_y: f32,
        rotate_deg: f32,
        antialias_mode: AntialiasMode,
        flip_x: bool,
        flip_y: bool,
    ) {
        if (source_width as usize) * (source_height as usize) * 4 != source.len() {
            return;
        }
        let options = PatchBufferRgbaOption {
            antialias_mode,
            flip_x,
            flip_y,
        };
        patch_buffer_rgba_instant(
            &mut self.data,
            self.width,
            self.height,
            source,
            source_width,
            source_height,
            offset_x,
            offset_y,
            scale_x,
            scale_y,
            rotate_deg,
            &options,
        );
    }

    #[wasm_bindgen(js_name = blitFromBuffer)]
    #[allow(clippy::too_many_arguments)]
    pub fn blit_from_buffer(
        &mut self,
        source: &RgbaBuffer,
        offset_x: f32,
        offset_y: f32,
        scale_x: f32,
        scale_y: f32,
        rotate_deg: f32,
        antialias_mode: AntialiasMode,
        flip_x: bool,
        flip_y: bool,
    ) {
        self.blit_from_raw(
            &source.data,
            source.width,
            source.height,
            offset_x,
            offset_y,
            scale_x,
            scale_y,
            rotate_deg,
            antialias_mode,
            flip_x,
            flip_y,
        );
    }

    #[wasm_bindgen(js_name = sliceWithMask)]
    pub fn slice_with_mask(
        &self,
        mask: &[u8],
        mask_width: u32,
        mask_height: u32,
        mask_offset_x: f32,
        mask_offset_y: f32,
    ) -> Vec<u8> {
        let sw = self.width as i32;
        let sh = self.height as i32;
        let mw = mask_width as i32;
        let mh = mask_height as i32;
        if mw <= 0 || mh <= 0 {
            return Vec::new();
        }
        if (mask_width as usize) * (mask_height as usize) > mask.len() {
            return Vec::new();
        }

        let mut result = vec![0u8; (mask_width as usize) * (mask_height as usize) * 4];
        let ox = mask_offset_x.round() as i32;
        let oy = mask_offset_y.round() as i32;

        for y in 0..mh {
            for x in 0..mw {
                let mi = (y * mw + x) as usize;
                if mi >= mask.len() || mask[mi] == 0 {
                    continue;
                }
                let sx = x + ox;
                let sy = y + oy;
                if sx < 0 || sy < 0 || sx >= sw || sy >= sh {
                    continue;
                }
                let src_index = (sy * sw + sx) as usize * 4;
                if src_index + 3 >= self.data.len() {
                    continue;
                }
                let dst_index = mi * 4;
                result[dst_index..dst_index + 4]
                    .copy_from_slice(&self.data[src_index..src_index + 4]);
            }
        }

        result
    }

    #[wasm_bindgen(js_name = cropWithMask)]
    pub fn crop_with_mask(
        &self,
        mask: &[u8],
        mask_width: u32,
        mask_height: u32,
        mask_offset_x: f32,
        mask_offset_y: f32,
    ) -> Vec<u8> {
        let sw = self.width as i32;
        let sh = self.height as i32;
        let mw = mask_width as i32;
        let mh = mask_height as i32;
        if sw <= 0 || sh <= 0 {
            return Vec::new();
        }

        let total_mask = (mask_width as usize) * (mask_height as usize);
        if total_mask > mask.len() {
            return Vec::new();
        }

        let mut result = vec![0u8; self.data.len()];
        let ox = mask_offset_x.round() as i32;
        let oy = mask_offset_y.round() as i32;

        for sy in 0..sh {
            for sx in 0..sw {
                let mx = sx - ox;
                let my = sy - oy;
                let mut covered = false;
                if mx >= 0 && mx < mw && my >= 0 && my < mh {
                    let midx = (my * mw + mx) as usize;
                    if midx < mask.len() {
                        covered = mask[midx] != 0;
                    }
                }
                if covered {
                    continue;
                }
                let idx = (sy * sw + sx) as usize * 4;
                if idx + 3 >= self.data.len() {
                    continue;
                }
                result[idx..idx + 4].copy_from_slice(&self.data[idx..idx + 4]);
            }
        }

        result
    }

    #[wasm_bindgen(js_name = brightnessAndContrast)]
    pub fn brightness_contrast(&mut self, brightness: f32, contrast: f32) {
        brightness_contrast(
            &mut self.data,
            self.width,
            self.height,
            &BrightnessContrastOption::new(brightness, contrast),
        );
    }

    #[wasm_bindgen(js_name = invert)]
    pub fn invert(&mut self) {
        invert(&mut self.data, self.width, self.height);
    }

    #[wasm_bindgen(js_name = grayscale)]
    pub fn grayscale(&mut self) {
        grayscale(&mut self.data, self.width, self.height);
    }

    #[wasm_bindgen(js_name = gaussianBlur)]
    pub fn gaussian_blur(&mut self, radius: f32, alpha_mode: AlphaBlurMode) {
        let options = GaussianBlurOption::new(radius, alpha_mode);
        gaussian_blur(&mut self.data, self.width, self.height, &options);
    }

    #[wasm_bindgen(js_name = posterize)]
    pub fn posterize(&mut self, levels: u32) {
        let options = PosterizeOption::new(levels);
        posterize(&mut self.data, self.width, self.height, &options);
    }

    #[wasm_bindgen(js_name = dustRemoval)]
    pub fn dust_removal(&mut self, max_size: u32, alpha_threshold: u8) {
        let options = DustRemovalOption::new(max_size, alpha_threshold);
        dust_removal(&mut self.data, self.width, self.height, &options);
    }

    #[wasm_bindgen(js_name = dithering)]
    pub fn dithering(&mut self, mode: DitheringMode, levels: u32, strength: f32) {
        let options = DitheringOption::new(mode, levels, strength);
        dithering(&mut self.data, self.width, self.height, &options);
    }
}
