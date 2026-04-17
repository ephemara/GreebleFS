//! SVT Page Table Manager - CPU-side LRU cache management
//!
//! Tracks which virtual tiles are loaded into physical VRAM.
//! Handles eviction when cache is full.

use std::collections::{HashMap, VecDeque};

pub struct PageTableManager {
    /// Virtual texture dimensions
    virtual_size: u32,
    /// Physical cache size
    physical_size: u32,
    /// Size of a single tile
    tile_size: u32,

    /// Maps Virtual Page (x, y) -> Physical Page (x, y)
    active_pages: HashMap<(u32, u32), (u32, u32)>,

    /// LRU Queue to know what to evict
    lru_queue: VecDeque<(u32, u32)>,

    /// Pool of free physical slots
    free_physical_slots: Vec<(u32, u32)>,
}

impl PageTableManager {
    pub fn new(virtual_size: u32, physical_size: u32, tile_size: u32) -> Self {
        let mut free_physical_slots = Vec::new();
        let physical_tiles = physical_size / tile_size;

        for y in 0..physical_tiles {
            for x in 0..physical_tiles {
                free_physical_slots.push((x, y));
            }
        }

        Self {
            virtual_size,
            physical_size,
            tile_size,
            active_pages: HashMap::new(),
            lru_queue: VecDeque::new(),
            free_physical_slots,
        }
    }

    /// Call this when the brush moves. Returns a list of updates to send to GPU.
    pub fn request_tiles(&mut self, virtual_uvs: Vec<(f32, f32)>) -> Vec<PageUpdate> {
        let mut updates = Vec::new();

        let page_dim = self.virtual_size / self.tile_size;
        for (u, v) in virtual_uvs {
            let v_page_x = ((u * self.virtual_size as f32) / self.tile_size as f32) as u32;
            let v_page_y = ((v * self.virtual_size as f32) / self.tile_size as f32) as u32;

            // Clamp to valid range
            let v_page_x = v_page_x.min(page_dim.saturating_sub(1));
            let v_page_y = v_page_y.min(page_dim.saturating_sub(1));

            if self.active_pages.contains_key(&(v_page_x, v_page_y)) {
                // Already loaded. Move to back of LRU (mark as recently used).
                self.touch_page(v_page_x, v_page_y);
                continue;
            }

            // Not loaded. We need a slot.
            let phys_slot = if let Some(slot) = self.free_physical_slots.pop() {
                slot
            } else {
                // Evict oldest!
                let old_virtual = self.lru_queue.pop_front().unwrap();
                let old_phys = self.active_pages.remove(&old_virtual).unwrap();

                // Unmap old page in GPU Page Table
                updates.push(PageUpdate {
                    v_page: old_virtual,
                    p_page: None, // None means "Clear this entry"
                });

                old_phys
            };

            // Map new page
            self.active_pages.insert((v_page_x, v_page_y), phys_slot);
            self.lru_queue.push_back((v_page_x, v_page_y));

            updates.push(PageUpdate {
                v_page: (v_page_x, v_page_y),
                p_page: Some(phys_slot),
            });
        }
        updates
    }

    /// Move a page to the back of the LRU queue (mark as recently used)
    fn touch_page(&mut self, x: u32, y: u32) {
        // Remove from current position
        if let Some(pos) = self.lru_queue.iter().position(|&p| p == (x, y)) {
            self.lru_queue.remove(pos);
        }
        // Add to back (most recently used)
        self.lru_queue.push_back((x, y));
    }

    /// Get the physical slot for a virtual page, if loaded
    pub fn get_physical(&self, v_page: (u32, u32)) -> Option<(u32, u32)> {
        self.active_pages.get(&v_page).copied()
    }

    /// Number of tiles currently loaded
    pub fn loaded_count(&self) -> usize {
        self.active_pages.len()
    }

    /// Maximum tiles that can be loaded
    pub fn capacity(&self) -> u32 {
        let physical_tiles = self.physical_size / self.tile_size;
        physical_tiles * physical_tiles
    }
}

pub struct PageUpdate {
    pub v_page: (u32, u32),
    pub p_page: Option<(u32, u32)>,
}
