import { describe, it, expect } from 'vitest'

// Simple utility functions tests
describe('Utility Functions', () => {
  describe('Math Utilities', () => {
    it('should clamp values correctly', () => {
      const clamp = (value: number, min: number, max: number) => 
        Math.min(Math.max(value, min), max)
      
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-5, 0, 10)).toBe(0)
      expect(clamp(15, 0, 10)).toBe(10)
    })

    it('should calculate distance between vectors', () => {
      const distance3D = (a: [number, number, number], b: [number, number, number]) => {
        const dx = a[0] - b[0]
        const dy = a[1] - b[1]
        const dz = a[2] - b[2]
        return Math.sqrt(dx * dx + dy * dy + dz * dz)
      }
      
      expect(distance3D([0, 0, 0], [1, 0, 0])).toBe(1)
      expect(distance3D([0, 0, 0], [0, 1, 0])).toBe(1)
      expect(distance3D([0, 0, 0], [1, 1, 0])).toBeCloseTo(Math.sqrt(2))
    })

    it('should generate unique IDs', () => {
      const generateId = () => `object_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      
      const id1 = generateId()
      const id2 = generateId()
      
      expect(id1).toMatch(/^object_\d+_[a-z0-9]+$/)
      expect(id2).toMatch(/^object_\d+_[a-z0-9]+$/)
      expect(id1).not.toBe(id2)
    })
  })

  describe('Array Utilities', () => {
    it('should check if arrays are equal', () => {
      const arraysEqual = (a: any[], b: any[]) => 
        a.length === b.length && a.every((val, i) => val === b[i])
      
      expect(arraysEqual([1, 2, 3], [1, 2, 3])).toBe(true)
      expect(arraysEqual([1, 2, 3], [1, 2, 4])).toBe(false)
      expect(arraysEqual([], [])).toBe(true)
    })

    it('should remove duplicates from array', () => {
      const unique = (arr: any[]) => [...new Set(arr)]
      
      expect(unique([1, 2, 2, 3, 3, 3])).toEqual([1, 2, 3])
      expect(unique(['a', 'b', 'a', 'c'])).toEqual(['a', 'b', 'c'])
      expect(unique([])).toEqual([])
    })
  })

  describe('Color Utilities', () => {
    it('should convert hex to RGB', () => {
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : null
      }
      
      expect(hexToRgb('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
      expect(hexToRgb('#00ff00')).toEqual({ r: 0, g: 255, b: 0 })
      expect(hexToRgb('#0000ff')).toEqual({ r: 0, g: 0, b: 255 })
      expect(hexToRgb('invalid')).toBe(null)
    })

    it('should convert RGB to hex', () => {
      const rgbToHex = (r: number, g: number, b: number) => 
        `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`
      
      expect(rgbToHex(255, 0, 0)).toBe('#ff0000')
      expect(rgbToHex(0, 255, 0)).toBe('#00ff00')
      expect(rgbToHex(0, 0, 255)).toBe('#0000ff')
    })
  })
})