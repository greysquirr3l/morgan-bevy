// Spatial data structures for 3D level editing
// This module provides efficient spatial queries and collision detection

use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use crate::Transform3D;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BoundingBox {
    pub min: [f32; 3],
    pub max: [f32; 3],
}

impl BoundingBox {
    pub fn new(min: [f32; 3], max: [f32; 3]) -> Self {
        Self { min, max }
    }
    
    pub fn from_transform(transform: &Transform3D) -> Self {
        let pos = transform.position;
        let scale = transform.scale;
        let half_scale = [scale[0] * 0.5, scale[1] * 0.5, scale[2] * 0.5];
        
        Self {
            min: [pos[0] - half_scale[0], pos[1] - half_scale[1], pos[2] - half_scale[2]],
            max: [pos[0] + half_scale[0], pos[1] + half_scale[1], pos[2] + half_scale[2]],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpatialIndex {
    objects: HashMap<String, BoundingBox>,
}

impl SpatialIndex {
    pub fn new() -> Self {
        Self {
            objects: HashMap::new(),
        }
    }
    
    pub fn insert(&mut self, object_id: &str, transform: &Transform3D) {
        let bounds = BoundingBox::from_transform(transform);
        self.objects.insert(object_id.to_string(), bounds);
    }
    
    pub fn update(&mut self, object_id: &str, transform: &Transform3D) {
        let bounds = BoundingBox::from_transform(transform);
        self.objects.insert(object_id.to_string(), bounds);
    }
    
    pub fn remove(&mut self, object_id: &str) {
        self.objects.remove(object_id);
    }
    
    pub fn clear(&mut self) {
        self.objects.clear();
    }
    
    pub fn query_bounds(&self, bounds: &BoundingBox) -> Vec<String> {
        let mut results = Vec::new();
        for (id, obj_bounds) in &self.objects {
            if bounds_intersect(bounds, obj_bounds) {
                results.push(id.clone());
            }
        }
        results
    }
}

fn bounds_intersect(a: &BoundingBox, b: &BoundingBox) -> bool {
    a.max[0] >= b.min[0] && a.min[0] <= b.max[0] &&
    a.max[1] >= b.min[1] && a.min[1] <= b.max[1] &&
    a.max[2] >= b.min[2] && a.min[2] <= b.max[2]
}

impl Default for SpatialIndex {
    fn default() -> Self {
        Self::new()
    }
}